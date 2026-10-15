"""
체험단 캠페인 URL -> 정보 추출 API
지원: 리뷰노트(reviewnote.co.kr), 레뷰(revu.net), 디너의여왕(dinnerqueen.net)

사용:  GET /extract?url=<캠페인 URL>[&debug=1]
인증:  환경변수 API_KEY 가 설정돼 있으면 헤더 X-API-Key 필요
"""
import json
import os
import re
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup
from fastapi import FastAPI, Header, HTTPException, Query

app = FastAPI(title="체험단 URL 추출기")

# 허용 도메인 화이트리스트 (SSRF 방지 겸 사이트 판별)
SITES = {
    "reviewnote.co.kr": "reviewnote",
    "revu.net": "revu",
    "dinnerqueen.net": "dinnerqueen",
}

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    ),
    "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.5",
}

# 항목명 -> 페이지에서 찾을 라벨 후보들 (사이트마다 표현이 달라 넉넉히 지정)
LABELS = {
    "recruit_count": ["모집인원", "모집 인원", "모집인", "선정인원", "선정 인원"],
    "apply_period": ["신청기간", "신청 기간", "모집기간", "모집 기간", "캠페인 신청"],
    "announce_date": ["발표일", "인플루언서 발표", "선정발표", "당첨자 발표", "발표"],
    "experience_period": ["체험기간", "체험 기간", "방문기간", "방문 기간", "이용기간", "이용 기간"],
    "review_deadline": ["리뷰기간", "리뷰 기간", "리뷰 마감", "등록기간", "콘텐츠 등록"],
    "benefit": ["제공내역", "제공 내역", "제공혜택", "제공 혜택", "제공상품", "제공 서비스"],
    "address": ["방문주소", "방문 주소", "주소", "위치", "방문 장소"],
    "channel": ["채널", "미디어", "참여 채널"],
    "keywords": ["키워드", "필수 키워드"],
    "mission": ["미션", "리뷰 미션", "참여 미션"],
}


def detect_site(url: str) -> str:
    p = urlparse(url)
    if p.scheme not in ("http", "https") or not p.hostname:
        raise HTTPException(400, "올바른 http(s) URL이 아닙니다.")
    host = p.hostname.lower()
    for domain, name in SITES.items():
        if host == domain or host.endswith("." + domain):
            return name
    raise HTTPException(400, f"지원하지 않는 사이트입니다: {host}")


def meta(soup: BeautifulSoup, *names: str) -> str | None:
    for n in names:
        tag = soup.find("meta", attrs={"property": n}) or soup.find("meta", attrs={"name": n})
        if tag and tag.get("content"):
            return tag["content"].strip()
    return None


def extract_json_blobs(soup: BeautifulSoup) -> dict:
    """JSON-LD, Next.js __NEXT_DATA__ 등 페이지에 심어진 구조화 데이터."""
    out = {"jsonld": [], "next_data": None}
    for s in soup.find_all("script", type="application/ld+json"):
        try:
            out["jsonld"].append(json.loads(s.string or ""))
        except Exception:
            pass
    nd = soup.find("script", id="__NEXT_DATA__")
    if nd and nd.string:
        try:
            out["next_data"] = json.loads(nd.string)
        except Exception:
            pass
    return out


def extract_fields_from_text(lines: list[str]) -> dict:
    """'라벨: 값' 또는 '라벨' 다음 줄이 값인 구조를 모두 처리하는 범용 추출."""
    result = {}
    for key, labels in LABELS.items():
        for i, line in enumerate(lines):
            hit = next((l for l in labels if l in line), None)
            if not hit:
                continue
            value = None
            # 1) "라벨: 값" / "라벨 값"
            m = re.search(re.escape(hit) + r"\s*[:：]\s*(.+)", line)
            if m:
                value = m.group(1).strip()
            # 2) 라벨만 있는 줄이면 다음 줄이 값
            elif len(line) <= len(hit) + 4 and i + 1 < len(lines):
                value = lines[i + 1].strip()
            if value and value not in labels:
                result[key] = value[:500]
                break
    return result


def parse(html: str, url: str, site: str, debug: bool = False) -> dict:
    soup = BeautifulSoup(html, "html.parser")
    blobs = extract_json_blobs(soup)

    for t in soup(["script", "style", "noscript"]):
        t.decompose()
    lines = [l.strip() for l in soup.get_text("\n", strip=True).split("\n") if l.strip()]

    data = {
        "source": site,
        "url": url,
        "title": meta(soup, "og:title", "twitter:title") or (soup.title.string.strip() if soup.title and soup.title.string else None),
        "description": meta(soup, "og:description", "description", "twitter:description"),
        "image": meta(soup, "og:image", "twitter:image"),
        "fields": extract_fields_from_text(lines),
        "jsonld": blobs["jsonld"] or None,
    }

    # Next.js 사이트(리뷰노트 등)는 __NEXT_DATA__ 안에 캠페인 원본 데이터가 있는 경우가 많음
    if blobs["next_data"]:
        props = blobs["next_data"].get("props", {}).get("pageProps")
        data["page_props"] = props

    if not data["fields"] and not data.get("page_props"):
        data["warning"] = (
            "본문에서 항목을 찾지 못했습니다. JS로 렌더링되는 페이지일 수 있습니다. "
            "debug=1로 원문 텍스트를 확인하세요."
        )
    if debug:
        data["debug_lines"] = lines[:200]
    return data


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/extract")
async def extract(
    url: str = Query(..., description="체험단 캠페인 URL"),
    debug: bool = False,
    x_api_key: str | None = Header(default=None),
):
    expected = os.getenv("API_KEY")
    if expected and x_api_key != expected:
        raise HTTPException(401, "API 키가 올바르지 않습니다.")

    site = detect_site(url)
    try:
        async with httpx.AsyncClient(headers=HEADERS, follow_redirects=True, timeout=15) as client:
            resp = await client.get(url)
    except httpx.HTTPError as e:
        raise HTTPException(502, f"페이지를 가져오지 못했습니다: {e}")

    detect_site(str(resp.url))  # 리다이렉트로 다른 도메인에 간 경우 차단
    if resp.status_code != 200:
        raise HTTPException(502, f"대상 사이트 응답 코드: {resp.status_code}")

    return parse(resp.text, url, site, debug)
