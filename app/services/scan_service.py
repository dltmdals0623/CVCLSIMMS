import uuid
import io
from typing import Optional

from app.config import SCANS_DIR
# from app.services import book_service # 필요한 경우 사용
from ultralytics import YOLO
from PIL import Image

def process_scan(image_bytes: bytes, seg_model, vision_client) -> dict:
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

    results = seg_model.predict(
        image,
        conf=0.15,
        retina_masks=True,
    )

    # 수정된 함수 호출
    image_url = _save_result_image(results[0])

    return {
        "found": False,
        "book_info": None,
        "image_url": image_url,
        "message": f"YOLO 탐지 결과: {len(results[0].boxes)}개 박스 발견 (다음 단계에서 처리 예정)",
    }

def _save_result_image(result) -> str:
    """
    YOLO Results 객체에서 바운딩 박스가 그려진 이미지를 추출해 저장하고 URL 반환
    """
    filename = f"{uuid.uuid4().hex}.jpg"
    filepath = SCANS_DIR / filename
    
    # 1. result.plot()을 호출하여 BGR 형태의 numpy 배열 이미지를 얻음
    img_array = result.plot()
    
    # 2. numpy 배열을 PIL Image 객체로 변환 (BGR을 RGB로 뒤집어줌)
    img_pil = Image.fromarray(img_array[..., ::-1])
    
    # 3. 지정된 경로에 JPEG로 저장
    img_pil.save(filepath, format="JPEG")
    
    return f"/scans/{filename}"