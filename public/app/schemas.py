from datetime import date
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class BookResponse(BaseModel):
  reg_no: str                        # 등록번호
  title: str                         # 자료명
  author: Optional[str] = None       # 저자
  publisher: Optional[str] = None    # 출판사
  pub_year: Optional[int] = None     # 출판년도
  call_number: str                   # 청구기호
  registered_date: Optional[date] = None  # 등록일
  status: Optional[str] = None       # 자료상태
  location: Optional[str] = None     # 소장처


class ScanResponse(BaseModel):
  found: bool                          # 매칭되는 책을 찾았는지 여부
  book_info: Optional[BookResponse] = None  # 찾은 책 정보 (못 찾으면 None)
  image_url: Optional[str] = None    # 이미지 URL
  message: Optional[str] = None        # 실패 사유 등 안내 메시지


class KdcInfo(BaseModel):
  model_config = ConfigDict(populate_by_name=True)

  lcode: Optional[str] = None
  ldesc: Optional[str] = None
  mcode: Optional[str] = None
  mdesc: Optional[str] = None
  scode: Optional[str] = None
  sdesc: Optional[str] = None


class CategoryInfo(BaseModel):
  model_config = ConfigDict(populate_by_name=True)

  lcode: Optional[str] = None
  ldesc: Optional[str] = None
  mcode: Optional[str] = None
  mdesc: Optional[str] = None
  scode: Optional[str] = None
  sdesc: Optional[str] = None


class LibraryBookInfo(BaseModel):
  model_config = ConfigDict(populate_by_name=True)

  book_key: str = Field(alias="bookKey")
  species_key: Optional[str] = Field(None, alias="speciesKey")
  prov_code: str = Field(alias="provCode")
  prov_name: Optional[str] = Field(None, alias="provName")
  neis_code: str = Field(alias="neisCode")
  lib_name: Optional[str] = Field(None, alias="libName")
  school_name: Optional[str] = Field(None, alias="schoolName")
  school_level: Optional[str] = Field(None, alias="schoolLevel")
  title: str
  author: Optional[str] = None
  publisher: Optional[str] = None
  pub_year: Optional[str] = Field(None, alias="pubYear")
  cover_yn: Optional[str] = Field(None, alias="coverYn")
  cover_url: Optional[str] = Field(None, alias="coverUrl")
  pub_form_code: Optional[str] = Field(None, alias="pubFormCode")
  pub_form_code_desc: Optional[str] = Field(None, alias="pubFormCodeDesc")
  isbn: Optional[str] = None
  reg_no: Optional[str] = Field(None, alias="regNo")
  class_no: Optional[str] = Field(None, alias="classNo")
  call_no: Optional[str] = Field(None, alias="callNo")
  location_code: Optional[str] = Field(None, alias="locationCode")
  location_name: Optional[str] = Field(None, alias="locationName")
  volume: Optional[str] = None
  volume_title: Optional[str] = Field(None, alias="volumeTitle")
  appendix_yn: Optional[str] = Field(None, alias="appendixYn")
  lang: Optional[str] = None
  page: Optional[int] = None
  reg_date: Optional[str] = Field(None, alias="regDate")
  kdc_info: Optional[KdcInfo] = Field(None, alias="kdcInfo")
  category_info: Optional[CategoryInfo] = Field(None, alias="categoryInfo")
  highlight_title: Optional[str] = Field(None, alias="highlightTitle")
  highlight_author: Optional[str] = Field(None, alias="highlightAuthor")
  highlight_publisher: Optional[str] = Field(None, alias="highlightPublisher")
  translate_title: Optional[str] = Field(None, alias="translateTitle")
  translate_author: Optional[str] = Field(None, alias="translateAuthor")
  translate_publisher: Optional[str] = Field(None, alias="translatePublisher")
  status: Optional[str] = None
  rsvt_count: Optional[int] = Field(None, alias="rsvtCount")
  return_plan_date: Optional[str] = Field(None, alias="returnPlanDate")
  rsvt_yn: Optional[str] = Field(None, alias="rsvtYn")
  ill_yn: Optional[str] = Field(None, alias="illYn")

  @field_validator("*", mode="before")
  @classmethod
  def empty_str_to_none(cls, v):
    return None if v == "" else v


class BookSearchResponse(BaseModel):
  total_count: int
  books: list[LibraryBookInfo]