from pathlib import Path

# 프로젝트 루트 경로 (app/ 폴더의 부모)
BASE_DIR = Path(__file__).resolve().parent.parent

# 도서 데이터
BOOKS_DATA_PATH = BASE_DIR / "data" / "book_list.csv"

# YOLO 모델
MODELS_DIR = BASE_DIR / "models"
YOLO_MODEL_PATH = MODELS_DIR / "yolo26m-seg.pt"

# 스캔 결과 이미지 저장 폴더
SCANS_DIR = BASE_DIR / "scans"
SCANS_DIR.mkdir(parents=True, exist_ok=True)

# GCP 서비스 계정 키 (OCR에 Google Vision 등 쓸 경우 대비, 지금은 자리만)
GCP_KEY_PATH = BASE_DIR / "secrets" / "infra-throne-504002-d2-c87795f913f8.json"

LIBRARY_API_BASE_URL = "https://read365.edunet.net/alpasq/api"
LIBRARY_PROV_CODE = "R10"
LIBRARY_NEIS_CODE = "R100000798"
LIBRARY_SCHOOL_NAME = "도개중고등학교"