import asyncio

import httpx

from app.config import (
  LIBRARY_API_BASE_URL,
  LIBRARY_NEIS_CODE,
  LIBRARY_PROV_CODE,
  LIBRARY_SCHOOL_NAME,
)


async def search_books(keyword: str, page: int = 1, display: int = 10) -> dict:
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

    book_list = search_data["data"]["bookList"]

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
    "total_count": search_data["data"]["totalCount"],
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