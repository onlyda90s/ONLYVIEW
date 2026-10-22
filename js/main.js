import { store } from './store.js';
import { db } from './firebase-config.js';
import { initAuth } from './modules/auth.js';
import { renderDashboardView } from './modules/dashboard.js';
import { filterAndRender, populateYearFilter } from './modules/list.js';
import { renderSettlementView } from './modules/settlement.js';
import { applyStatusCSSColors, updateDeadlineButtons, updateChartModeButtonsUI, renderStatusColorPickers, applySidebarUI, updateFormVisibility } from './modules/settings.js';
import { initFormHandlers, renderPlatformChips } from './modules/form.js';
import { formatCleanDate } from './utils.js';
import './modules/excel.js';

import { collection, getDocs, query, where, doc, getDoc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

window.renderDashboardView = renderDashboardView;
window.filterAndRender = filterAndRender;
window.renderSettlementView = renderSettlementView;

window.refreshAllViews = function() {
  filterAndRender();
  renderDashboardView();
  renderSettlementView();
};

window.loadCampaigns = async function() {
  if (!db || !store.targetUserId) return;
  try {
    let querySnapshot;
    try {
      const q = query(collection(db, "campaigns"), where("userId", "==", store.targetUserId));
      querySnapshot = await getDocs(q);
    } catch (err) {
      querySnapshot = await getDocs(collection(db, "campaigns"));
    }
    store.rawCampaignList = [];
    querySnapshot.forEach((docSnap) => {
      const d = docSnap.data();
      if (d.userId === store.targetUserId || !d.userId) {
        store.rawCampaignList.push({
          id: docSnap.id, ...d,
          applyDate: formatCleanDate(d.applyDate || ''),
          visitDate: formatCleanDate(d.visitDate || ''),
          deadlineDate: formatCleanDate(d.deadlineDate || '')
        });
      }
    });

    const now = new Date(); const targetYear = now.getFullYear(); const yearGroup = {};
    store.rawCampaignList.forEach(item => {
      const date = item.visitDate || '';
      if (date && date.length >= 7) {
        const y = date.slice(0, 4); const m = parseInt(date.slice(5, 7));
        if (y === String(targetYear) && m >= 1 && m <= 12) yearGroup[m] = (yearGroup[m] || 0) + 1;
      }
    });
    for (let m = 1; m <= 12; m++) {
      const saved = localStorage.getItem("onlyview_monthlyDetailCollapsed_" + m);
      if (saved === null) store.monthlyDetailsCollapseState[m] = !(yearGroup[m] && yearGroup[m] > 0);
      else store.monthlyDetailsCollapseState[m] = (saved === 'true');
    }

    populateYearFilter();
    window.refreshAllViews();
  } catch (e) { console.error("데이터 로드 실패:", e); }
};

window.switchTab = function(tabName, pushState = true) {
  if (store.isReadOnly && (tabName === 'form' || tabName === 'settings')) return alert("읽기 전용 모드에서는 접근할 수 없습니다.");
  ['sectionDashboard', 'sectionList', 'sectionForm', 'sectionSettlement', 'sectionSettings'].forEach(s => document.getElementById(s)?.classList.add('hidden'));
  document.querySelectorAll('.nav-item').forEach(btn => { btn.classList.remove('bg-theme', 'text-white'); btn.classList.add('text-sidebar', 'hover:bg-black/5'); });
  const activeBtn = document.getElementById("nav-" + tabName);
  if (activeBtn) { activeBtn.classList.remove('text-sidebar', 'hover:bg-black/5'); activeBtn.classList.add('bg-theme', 'text-white'); }
  if (pushState && window.location.hash !== "#" + tabName) history.pushState({ tab: tabName }, '', "#" + tabName);
  ['dayModal', 'editModal', 'colorPickerModal', 'dashRegisterModal'].forEach(id => document.getElementById(id)?.classList.add('hidden'));

  if (tabName === 'dashboard') { store.currentCalDate = new Date(); document.getElementById('sectionDashboard')?.classList.remove('hidden'); renderDashboardView(); }
  else if (tabName === 'list') {
    store.isBatchEditing = false; store.newBatchRows = []; store.listSubTab = 'ongoing'; store.isFilterExpanded = false;
    const filterBox = document.getElementById('filterBoxContainer'); const toggleBtn = document.getElementById('filterToggleBtn');
    if (filterBox && toggleBtn) { filterBox.classList.add('hidden'); filterBox.classList.remove('flex'); toggleBtn.innerText = '▼ 필터'; }
    document.getElementById('searchInput').value = ''; document.getElementById('filterStatus').value = 'ALL'; document.getElementById('filterYear').value = 'ALL'; document.getElementById('filterMonth').value = 'ALL';
    document.getElementById('sectionList')?.classList.remove('hidden');
    filterAndRender();
  }
  else if (tabName === 'form') {
    document.getElementById('campaignForm')?.reset();
    window.setStatusBtn('신청'); window.selectPlatformChip('개별');
    document.getElementById('sectionForm')?.classList.remove('hidden');
    document.getElementById('applyDate').value = new Date().toISOString().slice(0, 10);
  }
  else if (tabName === 'settlement') { document.getElementById('sectionSettlement')?.classList.remove('hidden'); window.setSettlementSubTab('report'); }
  else if (tabName === 'settings') { document.getElementById('sectionSettings')?.classList.remove('hidden'); renderStatusColorPickers(); }
};

function initApp() {
  initAuth(window.loadCampaigns);
  initFormHandlers();
  applyStatusCSSColors();
  applySidebarUI();
  renderPlatformChips();
  updateDeadlineButtons();
  updateChartModeButtonsUI();

  // 초대 코드 입력창 엔터(Enter) 키 리스너 복구
  document.getElementById('loginInviteCodeInput')?.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
      window.enterWithInviteCode();
    }
  });

  // 검색/필터 바인딩
  document.getElementById('searchInput')?.addEventListener('input', filterAndRender);
  document.getElementById('filterStatus')?.addEventListener('change', filterAndRender);
  document.getElementById('filterYear')?.addEventListener('change', filterAndRender);
  document.getElementById('filterMonth')?.addEventListener('change', filterAndRender);
  document.getElementById('settlementYearSelect')?.addEventListener('change', renderSettlementView);

  // 대시보드 월 이동
  document.getElementById('prevMonthBtn')?.addEventListener('click', () => { store.currentCalDate.setMonth(store.currentCalDate.getMonth() - 1); renderDashboardView(); });
  document.getElementById('todayMonthBtn')?.addEventListener('click', () => { store.currentCalDate = new Date(); renderDashboardView(); });
  document.getElementById('nextMonthBtn')?.addEventListener('click', () => { store.currentCalDate.setMonth(store.currentCalDate.getMonth() + 1); renderDashboardView(); });

  // 모달 닫기
  document.getElementById('closeModalBtn')?.addEventListener('click', () => document.getElementById('dayModal')?.classList.add('hidden'));
  document.getElementById('closeEditModalBtn')?.addEventListener('click', () => document.getElementById('editModal')?.classList.add('hidden'));
  document.getElementById('closeColorModalBtn')?.addEventListener('click', () => document.getElementById('colorPickerModal')?.classList.add('hidden'));
  document.getElementById('closeDashRegisterModalBtn')?.addEventListener('click', window.closeDashRegisterModal);

  // 동반자/초대 관리
  document.getElementById('editCodeBtn')?.addEventListener('click', async () => {
    if (store.isReadOnly) return alert("읽기 전용 모드입니다.");
    const newCode = prompt("새로운 공유 코드를 입력하세요 (4자리 또는 6자리):", store.myCustomCode);
    if (!newCode) return;
    const trimmed = newCode.trim();
    if (trimmed.length !== 4 && trimmed.length !== 6) return alert("4자리 또는 6자리여야 합니다.");
    try {
      const snap = await getDoc(doc(db, "userCodes", trimmed));
      if (snap.exists() && snap.data().uid !== store.currentUser.uid) return alert("이미 사용 중인 코드입니다.");
      if (store.myCustomCode && store.myCustomCode !== trimmed) { try { await deleteDoc(doc(db, "userCodes", store.myCustomCode)); } catch(e){} }
      await setDoc(doc(db, "userCodes", trimmed), { uid: store.currentUser.uid }, { merge: true });
      await setDoc(doc(db, "users", store.currentUser.uid), { customCode: trimmed }, { merge: true });
      store.myCustomCode = trimmed;
      document.getElementById('myShareCode').innerText = store.myCustomCode;
      alert("공유 코드가 변경되었습니다!");
    } catch(err) { alert(err.message); }
  });

  document.getElementById('applyPartnerCodeBtn')?.addEventListener('click', async () => {
    const partnerCode = document.getElementById('partnerCodeInput')?.value.trim();
    if (!partnerCode) return alert("코드를 입력해주세요.");
    try {
      let realUid = partnerCode;
      const snap = await getDoc(doc(db, "userCodes", partnerCode));
      if (snap.exists()) realUid = snap.data().uid;
      if (store.currentUser && realUid === store.currentUser.uid) { store.targetUserId = store.currentUser.uid; store.isReadOnly = false; alert("본인 모드로 전환되었습니다."); }
      else { store.targetUserId = realUid; store.isReadOnly = true; alert("동반자 모드로 전환되었습니다."); }
      updateFormVisibility();
      await window.loadCampaigns();
      window.switchTab('dashboard');
    } catch(err) { alert(err.message); }
  });

  document.getElementById('resetToMyDataBtn')?.addEventListener('click', () => {
    if (!store.currentUser) return;
    store.targetUserId = store.currentUser.uid;
    store.isReadOnly = false;
    document.getElementById('partnerCodeInput').value = '';
    updateFormVisibility();
    window.loadCampaigns();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
