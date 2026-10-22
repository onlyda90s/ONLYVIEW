from flask import Flask, request, jsonify
from flask_cors import CORS
from bs4 import BeautifulSoup
import requests
import json
import re

app = Flask(__name__)
CORS(app)

@app.route('/parse', methods=['GET'])
def parse_url():
    target_url = request.args.get('url')
    if not target_url:
        return jsonify({'error': 'URL이 필요합니다.'}), 400

    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
    }

    store_name = ""
    sponsored_amount = 0
    deadline_date = ""

    try:
        # 1. 리뷰노트(reviewnote.co.kr) 전용 API 파싱
        if "reviewnote.co.kr" in target_url:
            campaign_id_match = re.search(r'campaigns/([0-9a-zA-Z]+)', target_url)
            if campaign_id_match:
                cid = campaign_id_match.group(1)
                # 리뷰노트 백엔드 API 직통 호출
                api_url = f"https://www.reviewnote.co.kr/api/v1/campaigns/{cid}"
                api_res = requests.get(api_url, headers=headers, timeout=10)
                
                if api_res.status_code == 200:
                    res_json = api_res.json()
                    data = res_json.get('data', res_json)
                    
                    store_name = data.get('title') or data.get('storeName') or data.get('name') or ""
                    
                    offer = data.get('benefit') or data.get('offer') or data.get('providedService') or ""
                    man_m = re.search(r'([0-9]+)\s*만\s*원', str(offer))
                    if man_m:
                        sponsored_amount = int(man_m.group(1)) * 10000
                    else:
                        price_m = re.search(r'([0-9,]+)\s*원', str(offer))
                        if price_m:
                            sponsored_amount = int(price_m.group(1).replace(',', ''))

                    raw_end = data.get('reviewEndDate') or data.get('endDate') or data.get('closedAt') or ""
                    if raw_end:
                        deadline_date = str(raw_end)[:10]

        # 2. 일반 범용 파싱 (레뷰, 디너퀸, 마블, 링블 등)
        if not store_name:
            res = requests.get(target_url, headers=headers, timeout=15)
            soup = BeautifulSoup(res.text, 'html.parser')

            # __NEXT_DATA__ 태그 탐색
            next_data = soup.find('script', id='__NEXT_DATA__')
            if next_data and next_data.string:
                try:
                    data = json.loads(next_data.string)
                    page_props = data.get('props', {}).get('pageProps', {})
                    campaign = page_props.get('campaign', {}) or page_props.get('data', {})

                    if campaign:
                        store_name = campaign.get('title') or campaign.get('name') or campaign.get('storeName', '')
                        offer = campaign.get('offer') or campaign.get('benefit', '')
                        price_m = re.search(r'([0-9,]+)\s*원', str(offer))
                        if price_m:
                            sponsored_amount = int(price_m.group(1).replace(',', ''))
                        raw_d = campaign.get('reviewEndDate') or campaign.get('endDate', '')
                        if raw_d:
                            deadline_date = str(raw_d)[:10]
                except Exception:
                    pass

            # og:title 및 H1 태그 백업 탐색
            if not store_name:
                h1 = soup.find('h1')
                og_title = soup.find('meta', property='og:title')
                raw_title = h1.text if h1 else (og_title['content'] if og_title else soup.title.text if soup.title else "")
                store_name = raw_title

            # 제목 정제
            store_name = re.sub(r'\[.*?\]|\(.*?\)', '', store_name)
            store_name = re.sub(r'리뷰노트|레뷰|디너의여왕|디너퀸|체험단|모집|캠페인', '', store_name)
            store_name = store_name.split('-')[0].split('|')[0].strip()

            if not sponsored_amount:
                body_text = soup.get_text()
                man_m = re.search(r'([0-9]+)\s*만\s*원', body_text)
                if man_m:
                    sponsored_amount = int(man_m.group(1)) * 10000
                else:
                    price_m = re.search(r'([0-9,]+)\s*원', body_text)
                    if price_m:
                        p_val = int(price_m.group(1).replace(',', ''))
                        if p_val >= 1000:
                            sponsored_amount = p_val

            if not deadline_date:
                body_text = soup.get_text()
                date_m = re.search(r'(?:마감|제출|포스팅)[^0-9]*?(202[0-9][-.\/][0-1]?[0-9][-.\/][0-3]?[0-9])', body_text)
                if date_m:
                    deadline_date = date_m.group(1).replace('.', '-').replace('/', '-')

        return jsonify({
            'success': True,
            'storeName': store_name,
            'sponsoredAmount': sponsored_amount,
            'deadlineDate': deadline_date
        })

    except Exception as e:
        # 에러 로그 반환으로 원인 파악 가능하게 함
        return jsonify({'success': False, 'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=10000)