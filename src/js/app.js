import { auth, provider } from '../config/firebase.js';
import { onAuthStateChanged, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { renderDashboardView } from './dashboard.js';
import { loadCampaigns, filterAndRender, submitCampaignForm, toggleBatchEdit, saveAllBatchEdits, setListSubTab } from './campaign.js';
import { renderStatusColorPickers, setDeadlineDays, changeTheme } from './settings.js';

export let currentUser = null;
export let targetUserId = null;
export let isReadOnly = false;

// HTML 템플릿 로더
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
      console.error(`[컴포넌트 로드 실패] ${comp.file}:`, err);
    }
  }
}

export function switchTab(tabName) {
  if (isReadOnly && (tabName === 'form' || tabName === 'settings')) {
    alert("현재 읽기 전용 모드입니다.");
    return;
  }

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
    const applyDateElem = document.getElementById('applyDate');
    if (applyDateElem && !applyDateElem.value) {
      applyDateElem.value = new Date().toISOString().slice(0, 10);
    }
  } else if (tabName === 'settlement') {
    document.getElementById('sectionSettlement')?.classList.remove('hidden');
  } else if (tabName === 'settings') {
    document.getElementById('sectionSettings')?.classList.remove('hidden');
    renderStatusColorPickers();
  }
}

// 글로벌 핸들러 등록 (HTML inline onclick 대응)
window.switchTab = switchTab;
window.setListSubTab = setListSubTab;
window.toggleBatchEdit = toggleBatchEdit;
window.saveAllBatchEdits = saveAllBatchEdits;

document.addEventListener('DOMContentLoaded', async () => {
  await loadComponents();

  // 글로벌 이벤트 리스너 바인딩 (컴포넌트 로드 완료 후 실행)
  document.getElementById('loginBtn')?.addEventListener('click', () => signInWithPopup(auth, provider));
  document.getElementById('logoutBtn')?.addEventListener('click', () => signOut(auth).then(() => location.reload()));

  // 사이드바 메뉴 클릭 이벤트
  ['dashboard', 'form', 'list', 'settlement', 'settings'].forEach(name => {
    document.getElementById(`nav-${name}`)?.addEventListener('click', () => switchTab(name));
  });

  // 대시보드 "+ 체험 등록" 버튼 연동
  document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'dashRegisterBtn') {
      switchTab('form');
    }
  });

  // 체험단 등록 폼 제출 이벤트 바인딩
  const formElem = document.getElementById('campaignForm');
  if (formElem) {
    formElem.addEventListener('submit', submitCampaignForm);
  }

  // 모달 닫기 버튼
  document.getElementById('closeModalBtn')?.addEventListener('click', () => document.getElementById('dayModal')?.classList.add('hidden'));
  document.getElementById('closeEditModalBtn')?.addEventListener('click', () => document.getElementById('editModal')?.classList.add('hidden'));
  document.getElementById('closeColorModalBtn')?.addEventListener('click', () => document.getElementById('colorPickerModal')?.classList.add('hidden'));

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

      await loadCampaigns();
      switchTab('dashboard');
    }
  });
});
