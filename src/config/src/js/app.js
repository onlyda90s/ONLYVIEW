import { auth, db, provider } from '../config/firebase.js';
import { initDashboard } from './dashboard.js';
import { initCampaign } from './campaign.js';
import { initSettings } from './settings.js';

// 메뉴별 HTML 템플릿 컴포넌트 자동 주입
async function loadComponents() {
  const components = [
    { id: 'sectionDashboard', file: 'src/components/dashboard.html' },
    { id: 'sectionForm', file: 'src/components/form.html' },
    { id: 'sectionList', file: 'src/components/list.html' },
    { id: 'sectionSettlement', file: 'src/components/settlement.html' },
    { id: 'sectionSettings', file: 'src/components/settings.html' }
  ];

  for (const comp of components) {
    const res = await fetch(comp.file);
    const html = await res.text();
    document.getElementById(comp.id).innerHTML = html;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadComponents();
  
  // 컴포넌트 로드 후 기능별 JS 모듈 초기화
  initDashboard();
  initCampaign();
  initSettings();
});
