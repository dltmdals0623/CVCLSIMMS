from typing import List, Optional

from fastapi import APIRouter, Query

from app.schemas import BookResponse, BookSearchResponse
from app.services import book_service, library_api_service

router = APIRouter()


@router.get("", response_model=BookSearchResponse)
async def search_books(q: str = Query(..., description="검색어")):
  """
  read365 외부 API로 실시간 검색
  예: /api/books?q=코스모스
  """
  return await library_api_service.search_books(keyword=q)


@router.get("/all", response_model=List[BookResponse])
async def get_all_books():
  """
  로컬 CSV 전체를 그대로 JSON으로 반환
  예: /api/books/all
  """
  return book_service.search_books(q=None)