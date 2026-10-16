import { auth, db, provider } from '../config/firebase.js';
import { onAuthStateChanged, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDoc, doc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { renderDashboardView } from './dashboard.js';
import { loadCampaigns, filterAndRender } from './campaign.js';
import { renderStatusColorPickers, updateDeadlineButtons } from './settings.js';

export let currentUser = null;
export let targetUserId = null;
export let isReadOnly = false;
export let myCustomCode = "";

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

export function switchTab(tabName, pushState = true) {
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

  if (pushState && window.location.hash !== `#${tabName}`) {
    history.pushState({ tab: tabName }, '', `#${tabName}`);
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

  ['nav-dashboard', 'nav-form', 'nav-list', 'nav-settlement', 'nav-settings'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', () => switchTab(id.replace('nav-', '')));
  });

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUser = user;
      targetUserId = user.uid;
      isReadOnly = false;

      document.getElementById('authSection').classList.add('hidden');
      document.getElementById('appSection').classList.remove('hidden');
      document.getElementById('userName').innerText = user.displayName || user.email;

      await loadCampaigns();
      switchTab('dashboard', false);
    }
  });
});
