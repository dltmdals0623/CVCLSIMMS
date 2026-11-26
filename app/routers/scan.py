from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile

from app.schemas import ScanResponse
from app.services import scan_service

router = APIRouter()

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png"}


def _build_target(title: str, author: str, publisher: str, call_no: str, reg_no: str) -> Optional[dict]:
    """선택한 책의 폼 값을 process_scan()의 target 형식으로 정리합니다.
    제목이 비어 있으면(선택한 책이 없으면) None → 책등 탐지 결과만 반환됩니다."""
    target = {
        "title": (title or "").strip(),
        "author": (author or "").strip(),
        "publisher": (publisher or "").strip(),
        "call_no": (call_no or "").strip(),
        "reg_no": (reg_no or "").strip(),
    }
    return target if target["title"] else None


# async가 아닌 일반 def: YOLO/OCR이 오래 걸리는 동기 작업이라
# FastAPI가 스레드풀에서 실행해 이벤트 루프(다른 요청)를 막지 않습니다.
@router.post("", response_model=ScanResponse)
def scan_image(
    request: Request,
    file: UploadFile = File(...),
    # 웹 화면에서 '선택한 책'의 정보 (title이 없으면 탐지 결과만 반환)
    title: str = Form(""),
    author: str = Form(""),
    publisher: str = Form(""),
    call_no: str = Form(""),
    reg_no: str = Form(""),
):
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"지원하지 않는 파일 형식입니다: {file.content_type}",
        )

    target = _build_target(title, author, publisher, call_no, reg_no)

    try:
        return scan_service.process_scan(
            image_bytes=file.file.read(),
            target=target,
            seg_model=request.app.state.seg_model,
            vision_client=request.app.state.vision_client,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
