import { store } from '../store.js';
import { db } from '../firebase-config.js';
import { formatCleanDate, parseCurrencyValue, formatCurrencyInput, formatPhoneNumber } from '../utils.js';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

window.setStatusBtn = function(status) {
  store.selectedStatus = status;
  ['신청', '선정', '배송', '원고료'].forEach(s => {
    const btn = document.getElementById("btnStatus_" + s);
    if (btn) {
      if (s === status) btn.className = "py-1.5 px-3.5 rounded-lg font-bold border border-theme bg-theme text-white text-xs transition-colors shadow-sm";
      else btn.className = "py-1.5 px-3.5 rounded-lg font-normal border border-gray-200 bg-white text-gray-600 text-xs hover:border-gray-300 transition-colors";
    }
  });
  const storeLabel = document.getElementById('storeNameLabel'); const amountLabel = document.getElementById('sponsoredAmountLabel');
  const rowApplyDate = document.getElementById('rowApplyDate'); const rowDeadlineDate = document.getElementById('rowDeadlineDate');
  const rowVisit = document.getElementById('rowVisit'); const rowFinancial = document.getElementById('rowFinancial');
  const rowContact = document.getElementById('rowContact'); const rowMemo = document.getElementById('rowMemo');
  if (status === '신청') {
    if (storeLabel) storeLabel.innerText = "매장명 (업체명) *"; if (amountLabel) amountLabel.innerText = "제공금액 (원)";
    rowApplyDate?.classList.remove('hidden'); rowDeadlineDate?.classList.add('hidden'); rowVisit?.classList.add('hidden'); rowFinancial?.classList.add('hidden'); rowContact?.classList.add('hidden'); rowMemo?.classList.add('hidden');
  } else {
    rowApplyDate?.classList.add('hidden'); rowDeadlineDate?.classList.remove('hidden'); rowContact?.classList.remove('hidden'); rowMemo?.classList.remove('hidden');
    if (status === '선정') {
      if (storeLabel) storeLabel.innerText = "매장명 (업체명) *"; if (amountLabel) amountLabel.innerText = "제공금액 (원)";
      rowVisit?.classList.remove('hidden'); rowFinancial?.classList.remove('hidden');
      if (!document.getElementById('visitTime')?.value) { const now = new Date(); document.getElementById('visitTime').value = String(now.getHours()).padStart(2, '0') + ":" + String(now.getMinutes()).padStart(2, '0'); }
    } else if (status === '배송') {
      if (storeLabel) storeLabel.innerText = "매장명 (제품명) *"; if (amountLabel) amountLabel.innerText = "제공금액 (원)";
      rowVisit?.classList.add('hidden'); rowFinancial?.classList.remove('hidden');
    } else if (status === '원고료') {
      if (storeLabel) storeLabel.innerText = "매장명 (업체명) *"; if (amountLabel) amountLabel.innerText = "원고료 (원)";
      rowVisit?.classList.add('hidden'); rowFinancial?.classList.add('hidden');
    }
  }
};

window.setModalStatusBtn = function(status) {
  store.modalSelectedStatus = status;
  ['신청', '선정', '배송', '원고료'].forEach(s => {
    const btn = document.getElementById("btnModalStatus_" + s);
    if (btn) {
      if (s === status) btn.className = "py-1.5 px-3.5 rounded-lg font-bold border border-theme bg-theme text-white text-xs";
      else btn.className = "py-1.5 px-3.5 rounded-lg font-normal border border-gray-200 bg-white text-gray-600 text-xs";
    }
  });
  const rowApplyDate = document.getElementById('modalRowApplyDate'); const rowDeadlineDate = document.getElementById('modalRowDeadlineDate');
  const rowVisit = document.getElementById('modalRowVisit'); const rowFinancial = document.getElementById('modalRowFinancial');
  const rowContact = document.getElementById('modalRowContact'); const rowMemo = document.getElementById('modalRowMemo');
  if (status === '신청') {
    rowApplyDate?.classList.remove('hidden'); rowDeadlineDate?.classList.add('hidden'); rowVisit?.classList.add('hidden'); rowFinancial?.classList.add('hidden'); rowContact?.classList.add('hidden'); rowMemo?.classList.add('hidden');
  } else {
    rowApplyDate?.classList.add('hidden'); rowDeadlineDate?.classList.remove('hidden'); rowContact?.classList.remove('hidden'); rowMemo?.classList.remove('hidden');
    if (status === '선정') {
      rowVisit?.classList.remove('hidden'); rowFinancial?.classList.remove('hidden');
      if (!document.getElementById('modalVisitTime')?.value) { const now = new Date(); document.getElementById('modalVisitTime').value = String(now.getHours()).padStart(2, '0') + ":" + String(now.getMinutes()).padStart(2, '0'); }
    } else if (status === '배송') {
      rowVisit?.classList.add('hidden'); rowFinancial?.classList.remove('hidden');
    } else if (status === '원고료') {
      rowVisit?.classList.add('hidden'); rowFinancial?.classList.add('hidden');
    }
  }
};

window.setEditStatusBtn = function(status) {
  store.editSelectedStatus = status;
  ['신청', '선정', '방문', '미제출', '제출', '배송', '원고료'].forEach(s => {
    const btn = document.getElementById("btnEditStatus_" + s);
    if (btn) {
      if (s === status) btn.className = "py-1.5 px-3 rounded-lg font-bold border border-theme bg-theme text-white text-xs";
      else btn.className = "py-1.5 px-3 rounded-lg font-normal border border-gray-200 bg-white text-gray-600 text-xs";
    }
  });
};

export function renderPlatformChips() {
  const container = document.getElementById('platformChipsContainer');
  const modalContainer = document.getElementById('modalPlatformChipsContainer');
  const renderChips = (targetElem, isModal = false) => {
    if (!targetElem) return;
    targetElem.innerHTML = '';
    const inputId = isModal ? 'modalPlatformName' : 'platformName';
    const currentVal = document.getElementById(inputId)?.value || store.platformList[0];
    store.platformList.forEach(name => {
      const btn = document.createElement('button'); btn.type = 'button'; btn.innerText = name;
      if (name === currentVal) btn.className = "platform-chip px-3 py-1.5 rounded-lg border border-theme bg-theme-light text-theme font-bold text-xs transition-colors";
      else btn.className = "platform-chip px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 font-normal text-xs hover:border-gray-300 transition-colors";
      btn.onclick = () => { const platformElem = document.getElementById(inputId); if (platformElem) platformElem.value = name; renderPlatformChips(); };
      targetElem.appendChild(btn);
    });
    const addBtn = document.createElement('button'); addBtn.type = 'button'; addBtn.innerText = '+ 추가';
    addBtn.className = "px-3 py-1.5 rounded-lg border border-dashed border-gray-300 bg-gray-50 text-gray-500 font-normal text-xs hover:bg-gray-100 transition-colors";
    addBtn.onclick = window.addCustomPlatform;
    targetElem.appendChild(addBtn);
  };
  renderChips(container, false); renderChips(modalContainer, true);
}

window.selectPlatformChip = function(name) {
  const platformElem = document.getElementById('platformName');
  if (platformElem) platformElem.value = name;
  renderPlatformChips();
};

window.addCustomPlatform = function() {
  if (store.isReadOnly) return alert("읽기 전용 모드에서는 플랫폼을 추가할 수 없습니다.");
  const newSite = prompt("추가할 사이트명을 입력하세요:");
  if (!newSite || !newSite.trim()) return;
  const trimmed = newSite.trim();
  if (!store.platformList.includes(trimmed)) {
    store.platformList.push(trimmed);
    localStorage.setItem('onlyview_platforms', JSON.stringify(store.platformList));
    window.selectPlatformChip(trimmed);
  }
};

window.openDashRegisterModal = function() {
  if (store.isReadOnly) return alert("읽기 전용 모드에서는 등록할 수 없습니다.");
  document.getElementById('modalCampaignForm')?.reset();
  window.setModalStatusBtn('신청');
  const modalApplyDate = document.getElementById('modalApplyDate');
  if (modalApplyDate) modalApplyDate.value = new Date().toISOString().slice(0, 10);
  renderPlatformChips();
  document.getElementById('dashRegisterModal')?.classList.remove('hidden');
};

window.closeDashRegisterModal = function() { document.getElementById('dashRegisterModal')?.classList.add('hidden'); };

window.openEditModalFromId = function(id) {
  if (store.isReadOnly) return alert("읽기 전용 모드에서는 수정할 수 없습니다.");
  const item = store.rawCampaignList.find(c => c.id === id);
  if (!item) return;
  store.editingId = id;
  const editStore = document.getElementById('editStoreName'); if (editStore) editStore.value = item.storeName || '';
  const editPlatform = document.getElementById('editPlatformName'); if (editPlatform) editPlatform.value = item.platformName || '개별';
  window.setEditStatusBtn(item.status || '선정');
  const setVal = (elmId, val) => { const el = document.getElementById(elmId); if(el) el.value = val; };
  setVal('editDeadlineDate', formatCleanDate(item.deadlineDate || ''));
  setVal('editVisitDate', formatCleanDate(item.visitDate || ''));
  setVal('editVisitTime', item.visitTime || '');
  setVal('editCompanions', item.companions || '');
  setVal('editSponsoredAmount', formatCurrencyInput(item.sponsoredAmount || 0));
  setVal('editPaidAmount', formatCurrencyInput(item.paidAmount || 0));
  setVal('editRevenue', formatCurrencyInput(item.revenue || 0));
  setVal('editContact', formatPhoneNumber(item.contact || ''));
  setVal('editMemo', item.memo || '');
  document.getElementById('editModal')?.classList.remove('hidden');
};

export function initFormHandlers() {
  document.getElementById('campaignForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (store.isReadOnly || !store.currentUser) return alert("읽기 전용 모드입니다.");
    const payload = {
      userId: store.currentUser.uid, storeName: document.getElementById('storeName')?.value || '', platformName: document.getElementById('platformName')?.value || '',
      status: store.selectedStatus, applyDate: formatCleanDate(document.getElementById('applyDate')?.value || ''), deadlineDate: formatCleanDate(document.getElementById('deadlineDate')?.value || ''),
      visitDate: formatCleanDate(document.getElementById('visitDate')?.value || ''), visitTime: document.getElementById('visitTime')?.value || '',
      companions: document.getElementById('companions')?.value || '', sponsoredAmount: parseCurrencyValue(document.getElementById('sponsoredAmount')?.value),
      paidAmount: parseCurrencyValue(document.getElementById('paidAmount')?.value), revenue: parseCurrencyValue(document.getElementById('revenue')?.value),
      contact: document.getElementById('contact')?.value || '', memo: document.getElementById('memo')?.value || '', createdAt: serverTimestamp()
    };
    try { await addDoc(collection(db, "campaigns"), payload); alert('등록되었습니다!'); document.getElementById('campaignForm')?.reset(); window.setStatusBtn('신청'); window.selectPlatformChip('개별'); if(window.loadCampaigns) window.loadCampaigns(); } catch (err) { alert(err.message); }
  });

  document.getElementById('modalCampaignForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (store.isReadOnly || !store.currentUser) return alert("읽기 전용 모드입니다.");
    const payload = {
      userId: store.currentUser.uid, storeName: document.getElementById('modalStoreName')?.value || '', platformName: document.getElementById('modalPlatformName')?.value || '개별',
      status: store.modalSelectedStatus, applyDate: formatCleanDate(document.getElementById('modalApplyDate')?.value || ''), deadlineDate: formatCleanDate(document.getElementById('modalDeadlineDate')?.value || ''),
      visitDate: formatCleanDate(document.getElementById('modalVisitDate')?.value || ''), visitTime: document.getElementById('modalVisitTime')?.value || '',
      companions: document.getElementById('modalCompanions')?.value || '', sponsoredAmount: parseCurrencyValue(document.getElementById('modalSponsoredAmount')?.value),
      paidAmount: parseCurrencyValue(document.getElementById('modalPaidAmount')?.value), revenue: parseCurrencyValue(document.getElementById('modalRevenue')?.value),
      contact: document.getElementById('modalContact')?.value || '', memo: document.getElementById('modalMemo')?.value || '', createdAt: serverTimestamp()
    };
    try { await addDoc(collection(db, "campaigns"), payload); alert('등록되었습니다!'); window.closeDashRegisterModal(); if(window.loadCampaigns) window.loadCampaigns(); } catch (err) { alert(err.message); }
  });

  document.getElementById('editForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (store.isReadOnly || !store.currentUser || !store.editingId) return;
    const payload = {
      storeName: document.getElementById('editStoreName')?.value || '', platformName: document.getElementById('editPlatformName')?.value || '',
      status: store.editSelectedStatus, deadlineDate: formatCleanDate(document.getElementById('editDeadlineDate')?.value || ''),
      visitDate: formatCleanDate(document.getElementById('editVisitDate')?.value || ''), visitTime: document.getElementById('editVisitTime')?.value || '',
      companions: document.getElementById('editCompanions')?.value || '', sponsoredAmount: parseCurrencyValue(document.getElementById('editSponsoredAmount')?.value),
      paidAmount: parseCurrencyValue(document.getElementById('editPaidAmount')?.value), revenue: parseCurrencyValue(document.getElementById('editRevenue')?.value),
      contact: document.getElementById('editContact')?.value || '', memo: document.getElementById('editMemo')?.value || '',
    };
    try { await updateDoc(doc(db, "campaigns", store.editingId), payload); alert('수정되었습니다!'); document.getElementById('editModal')?.classList.add('hidden'); store.editingId = null; if(window.loadCampaigns) window.loadCampaigns(); } catch (err) { alert(err.message); }
  });
}
