import uuid, io
from typing import Optional

from app.config import SCANS_DIR
from app.services import book_service

from ultralytics import YOLO
from google.cloud import vision
from PIL import Image

def process_scan(image_bytes: bytes, seg_model, vision_client) -> dict:
  image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

  results = seg_model.predict(
    image,
    # imgsz=1920,
    conf=0.15,
    retina_masks=True,
    save=True,
  )

  image_url = _save_result_image(results[0])

  return {
    "found": False,
    "book_info": None,
    "image_url": image_url,
    "message": f"YOLO 탐지 결과: {len(results[0].boxes)}개 박스 발견 (다음 단계에서 처리 예정)",
  }


def _save_result_image(image_bytes: bytes) -> str:
  """
  결과 이미지를 scans/ 폴더에 저장하고 URL 경로 반환
  (지금은 사용 안 되지만 나중에 process_scan 안에서 호출할 자리)
  """
  filename = f"{uuid.uuid4().hex}.jpg"
  filepath = SCANS_DIR / filename
  filepath.write_bytes(image_bytes)
  return f"/scans/{filename}"