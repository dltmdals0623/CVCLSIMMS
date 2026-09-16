from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from google.cloud import vision
from ultralytics import YOLO

from app.config import GCP_KEY_PATH, SCANS_DIR, YOLO_MODEL_PATH
from app.routers import books, scan


def _create_vision_client():
    """GCP 키가 없거나 인증에 실패하면 None을 반환합니다 (이 경우 OCR 없이 탐지 결과만 반환)."""
    try:
        if GCP_KEY_PATH.exists():
            return vision.ImageAnnotatorClient.from_service_account_file(str(GCP_KEY_PATH))
        # 키 파일이 없으면 GOOGLE_APPLICATION_CREDENTIALS 환경변수 등 기본 인증을 시도
        return vision.ImageAnnotatorClient()
    except Exception as e:
        print(f"Vision 클라이언트를 만들지 못했습니다: {e}")
        return None


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Loading a model")
    app.state.seg_model = YOLO(str(YOLO_MODEL_PATH))
    app.state.vision_client = _create_vision_client()
    print("Finished loading a model")
    yield


app = FastAPI(title="Smart Library API", lifespan=lifespan)

# CORS 설정 (프론트엔드 API 요청 허용)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(books.router, prefix="/api/books", tags=["books"])
app.include_router(scan.router, prefix="/api/scan", tags=["scan"])

app.mount("/scans", StaticFiles(directory=str(SCANS_DIR)), name="scans")

PUBLIC_DIR = Path(__file__).resolve().parent.parent / "public"
if PUBLIC_DIR.exists():
    app.mount("/", StaticFiles(directory=str(PUBLIC_DIR), html=True), name="static")
