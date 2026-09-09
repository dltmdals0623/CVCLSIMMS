import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from ultralytics import YOLO

from app.config import SCANS_DIR, YOLO_MODEL_PATH
from app.routers import books, scan

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Loading a model")
    app.state.seg_model = YOLO(str(YOLO_MODEL_PATH))
    
    # GCP Vision 클라이언트를 안 쓸 경우 오류가 나지 않도록 None으로 초기화해 둡니다.
    app.state.vision_client = None
    
    print("Finished loading a model")
    yield

app = FastAPI(title="Smart Library API", lifespan=lifespan)

# CORS 설정 추가 (프론트엔드 API 요청 허용)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(books.router, prefix="/api/books", tags=["books"])
app.include_router(scan.router, prefix="/api/scan", tags=["scan"])

# 하드코딩된 C 드라이브 경로를 제거하고, 상대 경로를 이용해 public 폴더 마운트
app.mount("/scans", StaticFiles(directory=str(SCANS_DIR)), name="scans")

PUBLIC_DIR = Path(__file__).resolve().parent.parent / "public"
if PUBLIC_DIR.exists():
    app.mount("/", StaticFiles(directory=str(PUBLIC_DIR), html=True), name="static")