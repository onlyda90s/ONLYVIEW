export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: 'URL 주소가 필요합니다.' });
  }

  try {
    // JSDOM / Next.js Data 파이프라인 파싱용 헤더 설정
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9'
      }
    });

    const html = await response.text();

    let storeName = "";
    let sponsoredAmount = 0;
    let deadlineDate = "";

    // 1. Next.js / React 동적 상태 스크립트 데이터(__NEXT_DATA__) 우선 정밀 탐색
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (nextDataMatch && nextDataMatch[1]) {
      try {
        const nextJson = JSON.parse(nextDataMatch[1]);
        const pageProps = nextJson?.props?.pageProps || {};
        const campaign = pageProps?.campaign || pageProps?.data || {};

        if (campaign.title || campaign.name || campaign.storeName) {
          storeName = campaign.title || campaign.name || campaign.storeName;
        }
        if (campaign.offer || campaign.benefit) {
          const offerText = campaign.offer || campaign.benefit;
          const pMatch = String(offerText).match(/([0-9,]+)\s*원/);
          if (pMatch) sponsoredAmount = parseInt(pMatch[1].replace(/,/g, ''), 10);
        }
        if (campaign.reviewEndDate || campaign.endDate) {
          deadlineDate = String(campaign.reviewEndDate || campaign.endDate).slice(0, 10);
        }
      } catch (e) {
        console.warn("NEXT_DATA JSON 파싱 스킵", e);
      }
    }

    // 2. 스크립트 데이터 미발견 시 HTML DOM 문맥 2차 보완 파싱
    if (!storeName) {
      // H1 태그, og:title 정제
      const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
      const ogTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
      
      let rawTitle = h1Match ? h1Match[1] : (ogTitle ? ogTitle[1] : "");
      rawTitle = rawTitle.replace(/<[^>]*>/g, '').trim();

      storeName = rawTitle
        .replace(/^\[.*?\]/g, '') // [전북/전주시] 등 지역태그 제거
        .replace(/\[.*?\]|\(.*?\)/g, '')
        .replace(/리뷰노트|레뷰|디너의여왕|디너퀸|체험단|모집|캠페인/g, '')
        .split('-')[0]
        .split('|')[0]
        .trim();
    }

    // 제공 금액 2차 탐색 (7만원식사권 -> 70000 변환 등)
    if (!sponsoredAmount) {
      const manMatch = html.match(/([0-9]+)\s*만\s*원/);
      if (manMatch && manMatch[1]) {
        sponsoredAmount = parseInt(manMatch[1], 10) * 10000;
      } else {
        const priceMatch = html.match(/([0-9,]+)\s*원/);
        if (priceMatch && priceMatch[1]) {
          const p = parseInt(priceMatch[1].replace(/,/g, ''), 10);
          if (!isNaN(p) && p >= 1000) sponsoredAmount = p;
        }
      }
    }

    // 마감일 2차 탐색
    if (!deadlineDate) {
      const dateMatch = html.match(/(?:마감일|마감|제출)[^0-9]*?(202[0-9][-.\/][0-1]?[0-9][-.\/][0-3]?[0-9])/i) ||
                        html.match(/202[0-9][-.\/][0-1]?[0-9][-.\/][0-3]?[0-9]/);
      if (dateMatch) {
        deadlineDate = (dateMatch[1] || dateMatch[0]).replace(/[\.\/]/g, '-');
      }
    }

    return res.status(200).json({
      success: true,
      storeName: storeName,
      sponsoredAmount: sponsoredAmount,
      deadlineDate: deadlineDate
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
