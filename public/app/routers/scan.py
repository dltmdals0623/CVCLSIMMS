from fastapi import APIRouter, File, HTTPException, Request, UploadFile

from app.schemas import ScanResponse
from app.services import scan_service

router = APIRouter()

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png"}


@router.post("", response_model=ScanResponse)
async def scan_image(request: Request, file: UploadFile = File(...)):
  if file.content_type not in ALLOWED_CONTENT_TYPES:
    raise HTTPException(
      status_code=400,
      detail=f"지원하지 않는 파일 형식입니다: {file.content_type}",
    )

  image_bytes = await file.read()

  result = scan_service.process_scan(
    image_bytes=image_bytes,
    seg_model=request.app.state.seg_model,
    vision_client=request.app.state.vision_client,
  )

  return result