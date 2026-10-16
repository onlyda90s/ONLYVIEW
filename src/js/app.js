import { auth, provider } from '../config/firebase.js';
import { onAuthStateChanged, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { renderDashboardView } from './dashboard.js';
import { loadCampaigns, filterAndRender } from './campaign.js';
import { renderStatusColorPickers } from './settings.js';

export let currentUser = null;
export let targetUserId = null;
export let isReadOnly = false;

// 상대 경로 오류 방지를 위한 정밀 템플릿 로더
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
      if (!res.ok) throw new Error(`HTTP status ${res.status}`);
      const html = await res.text();
      const targetElem = document.getElementById(comp.id);
      if (targetElem) targetElem.innerHTML = html;
    } catch (err) {
      console.error(`[컴포넌트 로드 실패] ${comp.file}:`, err);
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
      document.getElementById('appSection')?.classList.remove('hidden');
      document.getElementById('appSection')?.classList.add('flex');
      
      const userNameElem = document.getElementById('userName');
      if (userNameElem) userNameElem.innerText = user.displayName || user.email;

      await loadCampaigns();
      switchTab('dashboard');
    }
  });
});
