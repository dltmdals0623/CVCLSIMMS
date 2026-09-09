import asyncio
import httpx
import math

from app.config import (
  LIBRARY_API_BASE_URL,
  LIBRARY_NEIS_CODE,
  LIBRARY_PROV_CODE,
  LIBRARY_SCHOOL_NAME,
)

async def search_books(keyword: str, ddc: str = None, page: int = 1, display: int = 50) -> dict:
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

async def search_books(keyword: str, ddc: str = None, target_count: int = 150) -> dict:
    display_limit = 50  # API 1회 최대 제한
    # 필요한 총 페이지 수 계산 (예: 150개 원하면 3페이지 필요)
    max_pages = math.ceil(target_count / display_limit)

    async with httpx.AsyncClient() as client:
        # 1. 1페이지부터 max_pages까지 비동기 요청 생성
        tasks = []
        for page in range(1, max_pages + 1):
            payload = {
                "searchKeyword": keyword,
                "page": page,
                "display": display_limit,
                "neisCode": [LIBRARY_NEIS_CODE],
                "provCode": LIBRARY_PROV_CODE,
                "schoolName": LIBRARY_SCHOOL_NAME,
                "coverYn": "N",
                "facet": "Y",
            }
            tasks.append(client.post(f"{LIBRARY_API_BASE_URL}/search", json=payload))

        # 모든 페이지 요청을 동시에 실행
        responses = await asyncio.gather(*tasks)

        # 2. 검색 결과 병합
        raw_book_list = []
        for res in responses:
            if res.status_code == 200:
                data = res.json()
                raw_book_list.extend(data.get("data", {}).get("bookList", []))

        # 3. 1차 필터링: 제목 또는 저자 조건
        keyword_lower = keyword.lower()
        book_list = [
            b for b in raw_book_list
            if (b.get("title") and keyword_lower in b.get("title").lower()) or 
               (b.get("author") and keyword_lower in b.get("author").lower())
        ]

        # 4. 2차 필터링: DDC 분류 조건
        if ddc:
            book_list = [
                b for b in book_list
                if b.get("classNo") and str(b.get("classNo")).startswith(str(ddc))
            ]

        # 5. 각 도서별 상태(대출 여부 등) 개별 조회
        states = await asyncio.gather(
            *[
                _fetch_book_state(client, b["bookKey"], b["neisCode"], b["provCode"])
                for b in book_list
            ]
        )

    merged_books = [{**book, **state} for book, state in zip(book_list, states)]

    return {
        "total_count": len(merged_books),
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