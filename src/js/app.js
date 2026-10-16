import { auth, db } from '../config/firebase.js';

// 메뉴별 템플릿 동적 로드 함수
async function loadComponents() {
  const sections = [
    { id: 'sectionDashboard', file: 'src/components/dashboard.html' },
    { id: 'sectionForm', file: 'src/components/form.html' },
    { id: 'sectionList', file: 'src/components/list.html' },
    { id: 'sectionSettlement', file: 'src/components/settlement.html' },
    { id: 'sectionSettings', file: 'src/components/settings.html' }
  ];

  for (const sec of sections) {
    const res = await fetch(sec.file);
    const html = await res.text();
    document.getElementById(sec.id).innerHTML = html;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadComponents();
  // 모듈 불러오기 완료 후 스크립트 바인딩 진행
});
