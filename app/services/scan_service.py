"""서가 사진 처리 서비스.

흐름: 서가 사진 → YOLO 책등 탐지 → 책등별 OCR(Google Vision, 병렬)
      → 목표 도서와 유사도 매칭 → 해당 책등을 하이라이트한 이미지 저장
"""
import logging
import re
import unicodedata
import uuid
from concurrent.futures import ThreadPoolExecutor
from typing import Optional

import cv2
import numpy as np
from google.cloud import vision
from rapidfuzz import fuzz

from app.config import SCANS_DIR

logger = logging.getLogger(__name__)

# ── 탐지 / OCR 설정 ──────────────────────────────────────────
YOLO_IMGSZ = 1280
YOLO_CONF = 0.15
OCR_LANGS = ["ko", "en"]
OCR_WORKERS = 8          # Vision API 동시 호출 수
OCR_TIMEOUT = 15         # 초

# ── 매칭 설정 ────────────────────────────────────────────────
MATCH_THRESHOLD = 65     # 이 점수 이상이어야 후보로 인정
MATCH_MARGIN = 8         # 1등과 2등의 점수 차이가 이 이상이어야 '확실'

# ── 하이라이트 색상 (BGR) ────────────────────────────────────
COLOR_FOUND = (255, 191, 0)    # 확실: 청록색
COLOR_UNSURE = (0, 230, 255)   # 불확실: 밝은 노란색


def process_scan(
    image_bytes: bytes,
    target: Optional[dict],
    seg_model,
    vision_client,
) -> dict:
    """서가 사진에서 target 도서를 찾아 하이라이트한 이미지를 저장하고 결과를 반환합니다.

    target: {"title", "author", "publisher", "call_no", "reg_no"} (title 필수, 나머지 선택)
            None이면 책등 탐지 결과만 그려서 반환합니다.
    """
    img = cv2.imdecode(np.frombuffer(image_bytes, np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("이미지를 읽을 수 없습니다.")

    # 'book' 클래스만 사용합니다 (파인튜닝 모델로 바뀌어도 클래스명으로 찾음)
    book_ids = [i for i, n in seg_model.names.items() if n == "book"]
    result = seg_model.predict(
        img,
        imgsz=YOLO_IMGSZ,
        conf=YOLO_CONF,
        classes=book_ids or None,
        retina_masks=True,
        verbose=False,
    )[0]

    if result.masks is None or len(result.masks.xy) == 0:
        return _response(False, None, None, "책등을 찾지 못했습니다. 서가가 잘 보이도록 다시 촬영해 주세요.")

    # 매칭 정보가 없거나 OCR을 쓸 수 없으면 탐지 결과만 반환
    if not target or not target.get("title") or vision_client is None:
        url = _save(result.plot())
        why = "검색할 도서가 지정되지 않았습니다." if not (target and target.get("title")) else "OCR 클라이언트가 설정되지 않았습니다."
        return _response(False, None, url, f"책등 {len(result.masks.xy)}개를 탐지했습니다. {why}")

    # 1) 책등별 크롭
    crops = []
    for j, (poly, box) in enumerate(zip(result.masks.xy, result.boxes.xyxy.cpu().numpy())):
        crop = _crop_book(img, poly, box)
        if crop is not None:
            crops.append((j, crop))

    # 2) OCR (병렬)
    with ThreadPoolExecutor(max_workers=OCR_WORKERS) as pool:
        texts = list(pool.map(lambda jc: _ocr(vision_client, jc[1]), crops))

    if not any(texts):
        return _response(False, None, _save(result.plot()), "책등의 글자를 인식하지 못했습니다.")

    # 3) 매칭: (총점, 제목점수, 청구기호점수, 책등 번호) 내림차순
    t = _prepare_target(target)
    scored = sorted(
        ((*_score(text, t), j) for (j, _), text in zip(crops, texts)),
        key=lambda s: s[0],
        reverse=True,
    )
    for total, s_title, s_call, j in scored[:3]:
        logger.info("idx=%02d total=%.0f title=%.0f call=%.0f", j, total, s_title, s_call)

    best_total, _, _, best_j = scored[0]
    second_total = scored[1][0] if len(scored) > 1 else 0
    found = best_total >= MATCH_THRESHOLD and (best_total - second_total) >= MATCH_MARGIN

    # 4) 하이라이트 이미지 저장
    url = _save(_highlight(img, result.masks.xy[best_j], found))

    if found:
        book_info = {
            "reg_no": target.get("reg_no") or "",
            "title": target["title"],
            "author": target.get("author") or None,
            "publisher": target.get("publisher") or None,
            "call_number": target.get("call_no") or "",
        }
        return _response(True, book_info, url, f"'{target['title']}' 책을 찾았습니다.")

    # 확실하지 않을 때는 안내 문구 없이 가장 비슷한 후보를 하이라이트한 사진만 반환
    return _response(False, None, url, None)


# ── 내부 함수 ────────────────────────────────────────────────
def _response(found: bool, book_info: Optional[dict], image_url: Optional[str], message: Optional[str]) -> dict:
    return {"found": found, "book_info": book_info, "image_url": image_url, "message": message}


def _save(img_bgr: np.ndarray) -> str:
    """BGR 이미지를 JPEG로 저장하고 URL을 반환합니다."""
    filename = f"{uuid.uuid4().hex}.jpg"
    cv2.imwrite(str(SCANS_DIR / filename), img_bgr)
    return f"/scans/{filename}"


def _crop_book(img: np.ndarray, poly: np.ndarray, box) -> Optional[np.ndarray]:
    """책등 폴리곤 바깥을 흰색으로 지운 뒤 바운딩 박스 크기로 잘라냅니다.
    (마스크를 박스 크기로만 만들어 전체 이미지 크기 마스크 생성 비용을 줄였습니다.)"""
    h, w = img.shape[:2]
    x1, y1 = max(int(box[0]), 0), max(int(box[1]), 0)
    x2, y2 = min(int(box[2]), w), min(int(box[3]), h)
    if len(poly) == 0 or x2 <= x1 or y2 <= y1:
        return None

    mask = np.zeros((y2 - y1, x2 - x1), np.uint8)
    cv2.fillPoly(mask, [poly.astype(np.int32) - np.array([x1, y1], np.int32)], 255)

    crop = img[y1:y2, x1:x2].copy()
    crop[mask == 0] = 255
    return crop


def _ocr(client, crop: np.ndarray) -> str:
    """책등 이미지 한 장을 OCR해 한 줄 텍스트로 반환합니다. 실패하면 빈 문자열입니다."""
    ok, buf = cv2.imencode(".jpg", crop, [cv2.IMWRITE_JPEG_QUALITY, 95])
    if not ok:
        return ""
    try:
        res = client.document_text_detection(
            image=vision.Image(content=buf.tobytes()),
            image_context=vision.ImageContext(language_hints=OCR_LANGS),
            timeout=OCR_TIMEOUT,
        )
    except Exception as e:  # 네트워크/인증 오류 하나로 전체가 죽지 않도록
        logger.warning("OCR 호출 실패: %s", e)
        return ""
    if res.error.message:
        logger.warning("OCR API 오류: %s", res.error.message)
        return ""
    return res.full_text_annotation.text.replace("\n", " ").strip()


def _norm(s: str) -> str:
    """공백·특수문자 제거, 소문자화 (OCR 노이즈 줄이기)"""
    s = unicodedata.normalize("NFKC", str(s or "")).lower()
    return re.sub(r"[^0-9a-z가-힣.]", "", s)


def _prepare_target(target: dict) -> dict:
    """목표 도서 정보를 한 번만 정규화해 둡니다 (책등마다 반복 계산 방지)."""
    title = target.get("title") or ""
    return {
        "title": _norm(title),
        "words": [w for w in map(_norm, title.split()) if len(w) >= 2],
        "call_no": _norm(target.get("call_no")),
        "author": _norm(target.get("author")),
        "publisher": _norm(target.get("publisher")),
    }


def _partial(value: str, ocr: str, min_len: int) -> float:
    return fuzz.partial_ratio(value, ocr) if len(value) >= min_len else 0.0


def _score(ocr_text: str, t: dict) -> tuple[float, float, float]:
    """(총점, 제목점수, 청구기호점수) — 제목 0.5 / 청구기호 0.35 / 저자 0.1 / 출판사 0.05"""
    ocr = _norm(ocr_text)
    if not ocr:
        return 0.0, 0.0, 0.0

    # 제목: 전체 유사도 vs 제목 단어 중 OCR에서 발견된 비율 중 큰 값
    s_words = 0.0
    if t["words"]:
        s_words = 100 * sum(fuzz.partial_ratio(w, ocr) >= 80 for w in t["words"]) / len(t["words"])
    s_title = max(_partial(t["title"], ocr, 4), s_words)

    s_call = _partial(t["call_no"], ocr, 4)
    total = (
        0.50 * s_title
        + 0.35 * s_call
        + 0.10 * _partial(t["author"], ocr, 2)
        + 0.05 * _partial(t["publisher"], ocr, 2)
    )
    return total, s_title, s_call


def _highlight(img: np.ndarray, poly: np.ndarray, found: bool, dim: float = 0.5, thickness: int = 3) -> np.ndarray:
    """선택한 책등 밖을 어둡게 하고 책등 윤곽선을 그립니다."""
    poly = poly.astype(np.int32)
    book = np.zeros(img.shape[:2], np.uint8)
    cv2.fillPoly(book, [poly], 1)
    book = book.astype(bool)

    out = cv2.convertScaleAbs(img, alpha=1 - dim)
    out[book] = img[book]
    cv2.polylines(out, [poly], True, COLOR_FOUND if found else COLOR_UNSURE, thickness, cv2.LINE_AA)
    return out
