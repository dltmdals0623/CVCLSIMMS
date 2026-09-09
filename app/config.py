from pathlib import Path

# BASE_DIR을 app/ 폴더로 기준점 변경
BASE_DIR = Path(__file__).resolve().parent

# 데이터 및 모델 경로 수정
BOOKS_DATA_PATH = BASE_DIR / "data" / "book_list.csv"
MODELS_DIR = BASE_DIR / "models"
YOLO_MODEL_PATH = MODELS_DIR / "yolo26m-seg.pt"

# 스캔 결과 임시 저장 폴더
SCANS_DIR = BASE_DIR / "scans"
SCANS_DIR.mkdir(parents=True, exist_ok=True)

GCP_KEY_PATH = BASE_DIR / "secrets" / "infra-throne-504002-d2-c87795f913f8.json"

LIBRARY_API_BASE_URL = "https://read365.edunet.net/alpasq/api"
LIBRARY_PROV_CODE = "R10"
LIBRARY_NEIS_CODE = "R100000798"
LIBRARY_SCHOOL_NAME = "도개중고등학교"