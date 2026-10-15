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
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    });

    const html = await response.text();

    let storeName = "";
    let sponsoredAmount = 0;
    let deadlineDate = "";

    // 1. 디너퀸 (dinnerqueen.net) 전용 추출
    if (url.includes("dinnerqueen.net")) {
      // 매장명 (og:title에서 '디너의여왕' 및 뒤쪽 꼬리표 제외)
      const ogTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
      if (ogTitle && ogTitle[1]) {
        storeName = ogTitle[1]
          .replace(/^디너의여왕\s*-\s*/i, '')
          .replace(/\[.*?\]|\(.*?\)/g, '')
          .split('-')[0]
          .split('|')[0]
          .trim();
      }

      // 제공 내역 및 금액 탐색 (상세 설명 문맥 추출)
      const descMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
      const searchTarget = (descMatch ? descMatch[1] : "") + " " + html;
      
      const priceMatch = searchTarget.match(/([0-9,]+)\s*원/);
      if (priceMatch && priceMatch[1]) {
        const p = parseInt(priceMatch[1].replace(/,/g, ''), 10);
        if (!isNaN(p) && p >= 1000) sponsoredAmount = p;
      }

      // 마감일 추출 (리뷰 등록 마감일 / 포스팅 마감일)
      const dateMatch = html.match(/(?:마감일|마감|제출)[^0-9]*?(202[0-9][-.\/][0-1]?[0-9][-.\/][0-3]?[0-9])/i);
      if (dateMatch && dateMatch[1]) {
        deadlineDate = dateMatch[1].replace(/[\.\/]/g, '-');
      }
    } 
    // 2. 레뷰 (revu.net) 전용 추출
    else if (url.includes("revu.net")) {
      const ogTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
      if (ogTitle && ogTitle[1]) {
        storeName = ogTitle[1]
          .replace(/\[.*?\]|\(.*?\)/g, '')
          .replace(/레뷰|모집|캠페인/g, '')
          .trim();
      }

      const priceMatch = html.match(/([0-9,]+)\s*원/);
      if (priceMatch && priceMatch[1]) {
        const p = parseInt(priceMatch[1].replace(/,/g, ''), 10);
        if (!isNaN(p) && p >= 1000) sponsoredAmount = p;
      }

      const dateMatch = html.match(/(?:포스팅|마감)[^0-9]*?(202[0-9][-.\/][0-1]?[0-9][-.\/][0-3]?[0-9])/i);
      if (dateMatch && dateMatch[1]) {
        deadlineDate = dateMatch[1].replace(/[\.\/]/g, '-');
      }
    } 
    // 3. 공통/기타 플랫폼 파싱
    else {
      const titleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
                         html.match(/<title[^>]*>([^<]+)<\/title>/i);
      let rawTitle = titleMatch ? titleMatch[1] : "";

      storeName = rawTitle
        .replace(/\[.*?\]|\(.*?\)|<.*?>/g, '')
        .replace(/디너의여왕|디너퀸|레뷰|리뷰노트|체험단|모집|캠페인/g, '')
        .split('-')[0]
        .split('|')[0]
        .trim();

      const priceMatch = html.match(/([0-9,]+)\s*원/);
      if (priceMatch && priceMatch[1]) {
        const p = parseInt(priceMatch[1].replace(/,/g, ''), 10);
        if (!isNaN(p) && p >= 1000) sponsoredAmount = p;
      }

      const dateMatch = html.match(/202[0-9][-.\/][0-1]?[0-9][-.\/][0-3]?[0-9]/);
      if (dateMatch) {
        deadlineDate = dateMatch[0].replace(/[\.\/]/g, '-');
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
