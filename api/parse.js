import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

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

  let browser = null;

  try {
    // 보안 차단 우회를 위한 헤드리스 크롬 실행
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // 페이지 이동 및 로딩 대기
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });

    // 실제 화면 DOM 구조 기반 데이터 정밀 추출
    const parsedData = await page.evaluate(() => {
      // 1. 매장명 (og:title, title, h1, h2 조합)
      let title = document.querySelector("meta[property='og:title']")?.content || 
                  document.querySelector("h1")?.innerText || 
                  document.title || "";

      let storeName = title
        .replace(/\[.*?\]|\(.*?\)|<.*?>/g, '')
        .replace(/레뷰|리뷰노트|디너퀸|체험단|모집|캠페인/g, '')
        .split('-')[0]
        .split('|')[0]
        .split(':')[0]
        .trim();

      // 2. 제공금액 (원 단위 숫자 탐색)
      let sponsoredAmount = 0;
      const bodyText = document.body.innerText;
      const priceMatch = bodyText.match(/([0-9,]+)\s*원/) || title.match(/([0-9,]+)\s*원/);
      if (priceMatch && priceMatch[1]) {
        const p = parseInt(priceMatch[1].replace(/,/g, ''), 10);
        if (!isNaN(p) && p >= 1000) sponsoredAmount = p;
      }

      // 3. 포스팅 마감일 탐색 (YYYY-MM-DD 또는 MM/DD)
      let deadlineDate = "";
      const dateMatch = bodyText.match(/202[0-9][-.\/][0-1]?[0-9][-.\/][0-3]?[0-9]/);
      if (dateMatch) {
        deadlineDate = dateMatch[0].replace(/[\.\/]/g, '-');
      }

      return { storeName, sponsoredAmount, deadlineDate };
    });

    return res.status(200).json({
      success: true,
      ...parsedData
    });

  } catch (error) {
    console.error("Parsing Error:", error);
    return res.status(500).json({ error: error.message });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
