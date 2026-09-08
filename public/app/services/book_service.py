import re
from pathlib import Path
from typing import List, Optional

import pandas as pd

from app.config import BOOKS_DATA_PATH

COLUMN_MAP = {
  "등록번호": "reg_no",
  "자료명": "title",
  "저자": "author",
  "출판사": "publisher",
  "출판년도": "pub_year",
  "청구기호": "call_number",
  "등록일": "registered_date",
  "자료상태": "status",
  "소장처": "location",
}

_df: Optional[pd.DataFrame] = None


def _clean_pub_year(value) -> Optional[int]:
  """
  '[2017]', '2010ㅠ', '2006(c2003' 같은 지저분한 값에서
  4자리 연도만 추출, 못 찾으면 None
  """
  if pd.isna(value):
    return None
  match = re.search(r"(19|20)\d{2}", str(value))
  return int(match.group()) if match else None


def _load_dataframe() -> pd.DataFrame:
  global _df
  if _df is None:
    raw = pd.read_csv(BOOKS_DATA_PATH)
    raw = raw.rename(columns=COLUMN_MAP)
    raw = raw[list(COLUMN_MAP.values())]
    raw["pub_year"] = raw["pub_year"].apply(_clean_pub_year)
    _df = raw
  return _df


def search_books(q: Optional[str]) -> List[dict]:
  df = _load_dataframe()

  if q:
    mask = df["title"].str.contains(q, case=False, na=False)
    result = df[mask]
  else:
    result = df

  records = result.to_dict(orient="records")
  return [_clean_record(r) for r in records]


def _clean_record(record: dict) -> dict:
  """
  pandas가 만든 dict 안의 NaN(float) 값을 전부 None으로 변환
  (pandas가 int+None 컬럼을 float64로 승격시키면서
  None이 다시 NaN이 되는 문제를 여기서 최종적으로 정리함)
  """
  return {k: (None if pd.isna(v) else v) for k, v in record.items()}