from flask import Flask, request, jsonify
from flask_cors import CORS
from playwright.sync_api import sync_playwright
import re

app = Flask(__name__)
CORS(app)

@app.route('/parse', methods=['GET'])
def parse_url():
    target_url = request.args.get('url')
    if not target_url:
        return jsonify({'error': 'URL이 필요합니다.'}), 400

    try:
        # 실제 크롬 브라우저 엔진(Playwright)을 띄워서 접속
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            )
            page = context.new_page()
            
            # 페이지 로딩 후 자바스크립트 실행을 위해 대기
            page.goto(target_url, wait_until='domcontentloaded', timeout=20000)
            page.wait_for_timeout(2500) # 리뷰노트 화면이 다 뜰 때까지 2.5초 대기

            # 1. 화면에 출력된 진짜 매장명(H1 또는 제목) 가져오기
            store_name = ""
            h1_elem = page.query_selector('h1')
            if h1_elem:
                store_name = h1_elem.inner_text().strip()
            else:
                store_name = page.title()

            # 지역 태그([전북/전주시] 등) 및 사이트명 정제
            store_name = re.sub(r'\[.*?\]|\(.*?\)', '', store_name)
            store_name = re.sub(r'리뷰노트|레뷰|디너의여왕|디너퀸|체험단|모집|캠페인', '', store_name)
            store_name = store_name.split('-')[0].split('|')[0].strip()

            # 2. 브라우저 화면 전체 텍스트 가져오기
            body_text = page.inner_text('body')

            # 3. 제공금액 계산 (7만원 -> 70000 등)
            sponsored_amount = 0
            man_match = re.search(r'([0-9]+)\s*만\s*원', body_text)
            if man_match:
                sponsored_amount = int(man_match.group(1)) * 10000
            else:
                price_match = re.search(r'([0-9,]+)\s*원', body_text)
                if price_match:
                    p_val = int(price_match.group(1).replace(',', ''))
                    if p_val >= 1000:
                        sponsored_amount = p_val

            # 4. 포스팅 마감일 추출
            deadline_date = ""
            date_match = re.search(r'(?:마감|제출|포스팅)[^0-9]*?(202[0-9][-.\/][0-1]?[0-9][-.\/][0-3]?[0-9])', body_text)
            if date_match:
                deadline_date = date_match.group(1).replace('.', '-').replace('/', '-')

            browser.close()

            return jsonify({
                'success': True,
                'storeName': store_name,
                'sponsoredAmount': sponsored_amount,
                'deadlineDate': deadline_date
            })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=10000)
