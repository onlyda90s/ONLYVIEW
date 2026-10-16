import { auth, provider } from '../config/firebase.js';
import { onAuthStateChanged, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { renderDashboardView } from './dashboard.js';
import { loadCampaigns, filterAndRender } from './campaign.js';
import { renderStatusColorPickers } from './settings.js';

export let currentUser = null;
export let targetUserId = null;
export let isReadOnly = false;

// 1. 컴포넌트 HTML 동적 로드 (완료될 때까지 대기)
async function loadComponents() {
  const components = [
    { id: 'sectionDashboard', file: './src/components/dashboard.html' },
    { id: 'sectionForm', file: './src/components/form.html' },
    { id: 'sectionList', file: './src/components/list.html' },
    { id: 'sectionSettlement', file: './src/components/settlement.html' },
    { id: 'sectionSettings', file: './src/components/settings.html' }
  ];

  for (const comp of components) {
    try {
      const res = await fetch(comp.file);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      const elem = document.getElementById(comp.id);
      if (elem) elem.innerHTML = html;
    } catch (err) {
      console.error(`[파일 로드 에러] ${comp.file}:`, err);
    }
  }
}

export function switchTab(tabName) {
  const sections = ['sectionDashboard', 'sectionList', 'sectionForm', 'sectionSettlement', 'sectionSettings'];
  sections.forEach(s => document.getElementById(s)?.classList.add('hidden'));

  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.remove('bg-theme', 'text-white');
    btn.classList.add('text-gray-600', 'hover:bg-gray-100');
  });

  const activeBtn = document.getElementById(`nav-${tabName}`);
  if (activeBtn) {
    activeBtn.classList.remove('text-gray-600', 'hover:bg-gray-100');
    activeBtn.classList.add('bg-theme', 'text-white');
  }

  if (tabName === 'dashboard') {
    document.getElementById('sectionDashboard')?.classList.remove('hidden');
    renderDashboardView();
  } else if (tabName === 'list') {
    document.getElementById('sectionList')?.classList.remove('hidden');
    filterAndRender();
  } else if (tabName === 'form') {
    document.getElementById('sectionForm')?.classList.remove('hidden');
  } else if (tabName === 'settlement') {
    document.getElementById('sectionSettlement')?.classList.remove('hidden');
  } else if (tabName === 'settings') {
    document.getElementById('sectionSettings')?.classList.remove('hidden');
    renderStatusColorPickers();
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  // HTML 컴포넌트들을 모두 불러온 후 초기화 진행
  await loadComponents();

  document.getElementById('loginBtn')?.addEventListener('click', () => signInWithPopup(auth, provider));
  document.getElementById('logoutBtn')?.addEventListener('click', () => signOut(auth).then(() => location.reload()));

  ['dashboard', 'form', 'list', 'settlement', 'settings'].forEach(name => {
    document.getElementById(`nav-${name}`)?.addEventListener('click', () => switchTab(name));
  });

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUser = user;
      targetUserId = user.uid;
      isReadOnly = false;

      document.getElementById('authSection')?.classList.add('hidden');
      const appSec = document.getElementById('appSection');
      if (appSec) {
        appSec.classList.remove('hidden');
        appSec.classList.add('flex');
      }
      
      const userNameElem = document.getElementById('userName');
      if (userNameElem) userNameElem.innerText = user.displayName || user.email;

      // 데이터 및 화면 렌더링
      await loadCampaigns();
      switchTab('dashboard');
    }
  });
});
