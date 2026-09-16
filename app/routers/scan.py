from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile

from app.schemas import ScanResponse
from app.services import scan_service

router = APIRouter()

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png"}


# async가 아닌 일반 def: YOLO/OCR이 오래 걸리는 동기 작업이라
# FastAPI가 스레드풀에서 실행해 이벤트 루프(다른 요청)를 막지 않습니다.
@router.post("", response_model=ScanResponse)
def scan_image(
    request: Request,
    file: UploadFile = File(...),
    title: str = Form(""),        # 찾을 도서 정보 (title이 없으면 탐지 결과만 반환)
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

    try:
        return scan_service.process_scan(
            image_bytes=file.file.read(),
            target={
                "title": title,
                "author": author,
                "publisher": publisher,
                "call_no": call_no,
                "reg_no": reg_no,
            },
            seg_model=request.app.state.seg_model,
            vision_client=request.app.state.vision_client,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
