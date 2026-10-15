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

    // og:title, title 파싱
    const titleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
                       html.match(/<title[^>]*>([^<]+)<\/title>/i);

    let rawTitle = titleMatch ? titleMatch[1] : "";

    // 매장명 정제
    let cleanStoreName = rawTitle
      .replace(/\[.*?\]|\(.*?\)|<.*?>/g, '')
      .replace(/레뷰|리뷰노트|디너퀸|체험단|모집|캠페인/g, '')
      .split('-')[0]
      .split('|')[0]
      .split(':')[0]
      .trim();

    // 제공금액 추출
    let sponsoredAmount = 0;
    const priceMatch = html.match(/([0-9,]+)\s*원/) || rawTitle.match(/([0-9,]+)\s*원/);
    if (priceMatch && priceMatch[1]) {
      const price = parseInt(priceMatch[1].replace(/,/g, ''), 10);
      if (!isNaN(price) && price >= 1000) {
        sponsoredAmount = price;
      }
    }

    // 마감일 추출
    let deadlineDate = "";
    const dateMatch = html.match(/202[0-9][-.\/][0-1]?[0-9][-.\/][0-3]?[0-9]/);
    if (dateMatch) {
      deadlineDate = dateMatch[0].replace(/[\.\/]/g, '-');
    }

    return res.status(200).json({
      success: true,
      storeName: cleanStoreName,
      sponsoredAmount: sponsoredAmount,
      deadlineDate: deadlineDate
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
