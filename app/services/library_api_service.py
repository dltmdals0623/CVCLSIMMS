import asyncio
import httpx

from app.config import (
  LIBRARY_API_BASE_URL,
  LIBRARY_NEIS_CODE,
  LIBRARY_PROV_CODE,
  LIBRARY_SCHOOL_NAME,
)

async def search_books(keyword: str, ddc: str = None, page: int = 1, display: int = 10) -> dict:
  """
  1. 검색 API 호출
  2. 검색된 책마다 상태 API(대출상태, 표지 등)를 동시에 호출
  3. 각 책 정보에 상태 정보를 합쳐서 반환
  """
  payload = {
    "searchKeyword": keyword,
    "page": page,
    "display": display,
    "neisCode": [LIBRARY_NEIS_CODE],
    "provCode": LIBRARY_PROV_CODE,
    "schoolName": LIBRARY_SCHOOL_NAME,
    "coverYn": "N",
    "facet": "Y",
  }

  async with httpx.AsyncClient() as client:
    response = await client.post(f"{LIBRARY_API_BASE_URL}/search", json=payload)
    response.raise_for_status()
    search_data = response.json()

    raw_book_list = search_data["data"]["bookList"]

    # 1차 필터링: 제목 또는 저자에 검색어가 포함된 책만 필터링
    keyword_lower = keyword.lower()
    book_list = [
        b for b in raw_book_list
        if (b.get("title") and keyword_lower in b.get("title").lower()) or 
          (b.get("author") and keyword_lower in b.get("author").lower())
    ]

    # 2차 필터링: ddc(분류) 값이 존재하면, 분류 기호(classNo)의 시작 번호가 일치하는 도서만 필터링
    if ddc:
        book_list = [
            b for b in book_list
            if b.get("classNo") and str(b.get("classNo")).startswith(str(ddc))
        ]

    # 책 리스트 전체를 동시에 조회 (순차로 하면 책 10권이면 10배 느려짐)
    states = await asyncio.gather(
      *[
        _fetch_book_state(client, b["bookKey"], b["neisCode"], b["provCode"])
        for b in book_list
      ]
    )

  # 검색 결과 + 상태 결과 합치기 (상태 값이 있으면 덮어씀)
  merged_books = [{**book, **state} for book, state in zip(book_list, states)]

  return {
    "total_count": len(merged_books), # 필터링 후의 실제 도서 개수로 업데이트
    "books": merged_books,
  }

async def _fetch_book_state(
  client: httpx.AsyncClient, book_key: str, neis_code: str, prov_code: str
) -> dict:
  """
  책 1권의 실시간 상태(대출중 여부, 표지 URL 등) 조회
  실패해도 검색 전체가 죽지 않도록 빈 dict로 처리
  """
  try:
    response = await client.get(
      f"{LIBRARY_API_BASE_URL}/search/book/state",
      params={"bookKey": book_key, "neisCode": neis_code, "provCode": prov_code},
    )
    response.raise_for_status()
    data = response.json()
    return data.get("data", data)
  except httpx.HTTPError:
    return {}