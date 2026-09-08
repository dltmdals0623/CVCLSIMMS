import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from ultralytics import YOLO
from google.cloud import vision

from app.config import GCP_KEY_PATH, SCANS_DIR, YOLO_MODEL_PATH
from app.routers import books, scan


@asynccontextmanager
async def lifespan(app: FastAPI):
  print("Loading a model")

  # YOLO 모델 로딩 (서버 켤 때 1번만)
  app.state.seg_model = YOLO(str(YOLO_MODEL_PATH))

  # # Google Cloud Vision 클라이언트 생성 (서버 켤 때 1번만)
  # os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = str(GCP_KEY_PATH)
  # app.state.vision_client = vision.ImageAnnotatorClient()

  print("Finished loading a model")

  yield

  # print("Stopping Server")


app = FastAPI(title="Smart Library API", lifespan=lifespan)

app.include_router(books.router, prefix="/api/books", tags=["books"])
app.include_router(scan.router, prefix="/api/scan", tags=["scan"])
app.mount("/scans", StaticFiles(directory=str(SCANS_DIR)), name="scans")
app.mount("/", StaticFiles(directory="C:/이승민/바탕화면에 있던거/도개고/CVCLSIMMS/public/app/static", html=True), name="static")
# app.mount("/", StaticFiles(directory="static", html=True), name="static")