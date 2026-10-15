export default async function handler(req, res) {
  // CORS 허용 (온리뷰 대시보드에서 접근 허용)
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
    // 타겟 URL 페이지 HTML 가져오기 (User-Agent 설정)
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    });

    const html = await response.text();

    // 메타 태그(og:title, title) 추출
    const titleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
                       html.match(/<title[^>]*>([^<]+)<\/title>/i);

    let rawTitle = titleMatch ? titleMatch[1] : "";

    // 매장명(업체명) 정제
    let cleanStoreName = rawTitle
      .replace(/\[.*?\]|\(.*?\)|<.*?>/g, '')
      .replace(/레뷰|리뷰노트|디너퀸|체험단|모집|캠페인/g, '')
      .split('-')[0]
      .split('|')[0]
      .split(':')[0]
      .trim();

    // 금액(제공금액) 숫자 추출 (예: 50,000원 / 3만원 등)
    let sponsoredAmount = 0;
    const priceMatch = html.match(/([0-9,]+)\s*원/) || rawTitle.match(/([0-9,]+)\s*원/);
    if (priceMatch && priceMatch[1]) {
      const price = parseInt(priceMatch[1].replace(/,/g, ''), 10);
      if (!isNaN(price) && price >= 1000) {
        sponsoredAmount = price;
      }
    }

    return res.status(200).json({
      success: true,
      storeName: cleanStoreName,
      sponsoredAmount: sponsoredAmount
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
