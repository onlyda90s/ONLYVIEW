import { store } from '../store.js';
import { db } from '../firebase-config.js';
import { getEffectiveStatus, formatCleanDate, formatShortDate, isItemOverdue, displayStatusName, getStatusTextClass, formatCurrencyInput, formatRevenueDisplay, parseCurrencyValue } from '../utils.js';
import { updateDoc, deleteDoc, doc, addDoc, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export function getSortIndicatorHtml(colName) {
  if (store.sortColumn !== colName || store.sortColumn === 'none') return '<span class="text-gray-300 ml-0.5">↕</span>';
  return store.sortAsc ? '<span class="text-theme font-bold ml-0.5">▲</span>' : '<span class="text-theme font-bold ml-0.5">▼</span>';
}

export function filterAndRender() {
  const tableBody = document.getElementById('campaignTableBody');
  const cardList = document.getElementById('campaignCardList');
  const searchText = document.getElementById('searchInput')?.value.toLowerCase() || '';
  const filterStatus = document.getElementById('filterStatus')?.value || 'ALL';
  const filterYear = document.getElementById('filterYear')?.value || 'ALL';
  const filterMonth = document.getElementById('filterMonth')?.value || 'ALL';
  const batchBtn = document.getElementById('batchEditBtn');
  const saveBatchBtn = document.getElementById('saveBatchBtn');

  if (batchBtn && saveBatchBtn) {
    if (store.isBatchEditing) {
      batchBtn.className = "px-4 py-1.5 rounded-lg font-bold text-xs bg-rose-500 text-white shadow-sm transition-colors mr-1";
      batchBtn.innerText = "취소";
      saveBatchBtn.className = "px-4 py-1.5 rounded-lg font-bold text-xs bg-emerald-600 text-white shadow-sm transition-colors hover:bg-emerald-700 mr-1";
      saveBatchBtn.classList.remove('hidden');
    } else {
      batchBtn.className = "tab-fixed-btn text-center py-1.5 rounded-lg font-bold text-xs bg-theme text-white shadow-sm transition-colors hover:bg-theme-hover mr-1";
      batchBtn.innerText = "수정";
      saveBatchBtn.classList.add('hidden');
    }
  }

  ['storeName', 'status', 'platformName', 'visitDate', 'deadlineDate', 'sponsoredAmount', 'paidAmount', 'revenue'].forEach(col => {
    const elem = document.getElementById("sortInd_" + col);
    if (elem) elem.innerHTML = getSortIndicatorHtml(col);
  });

  let filteredList = store.rawCampaignList.filter(item => {
    const effSt = getEffectiveStatus(item);
    const isCompleted = (effSt === '제출' || effSt === '완료');
    if (store.listSubTab === 'ongoing' && isCompleted) return false;
    if (store.listSubTab === 'submitted' && !isCompleted) return false;
    const matchesName = (item.storeName || '').toLowerCase().includes(searchText) || (item.platformName || '').toLowerCase().includes(searchText);
    const matchesStatus = (filterStatus === 'ALL') || (effSt === filterStatus);
    const refDate = formatCleanDate(item.visitDate || item.deadlineDate || item.applyDate || '');
    let matchesYear = true, matchesMonth = true;
    if (refDate && refDate.length >= 7) {
      if (filterYear !== 'ALL' && refDate.slice(0, 4) !== filterYear) matchesYear = false;
      if (filterMonth !== 'ALL' && String(Number(refDate.slice(5, 7))) !== filterMonth) matchesMonth = false;
    } else if (filterYear !== 'ALL' || filterMonth !== 'ALL') { matchesYear = false; }
    return matchesName && matchesStatus && matchesYear && matchesMonth;
  });

  if (store.sortColumn !== 'none') {
    filteredList.sort((a, b) => {
      let valA = a[store.sortColumn] || ''; let valB = b[store.sortColumn] || '';
      if (['sponsoredAmount', 'paidAmount', 'revenue'].includes(store.sortColumn)) { valA = Number(valA) || 0; valB = Number(valB) || 0; }
      if (valA < valB) return store.sortAsc ? -1 : 1;
      if (valA > valB) return store.sortAsc ? 1 : -1;
      return 0;
    });
  }

  if (tableBody) tableBody.innerHTML = '';
  if (cardList) cardList.innerHTML = '';

  filteredList.forEach((item) => {
    const effSt = getEffectiveStatus(item);
    const overdue = isItemOverdue(item);
    const isCompleted = (effSt === '제출' || effSt === '완료');
    const sponsored = Number(item.sponsoredAmount || 0);
    const paid = Number(item.paidAmount || 0);
    const inputRev = Number(item.revenue || 0);
    let calcRevenue = paid === 0 ? (sponsored > 0 ? sponsored : inputRev) : ((sponsored - paid) + inputRev);

    let revDisplayHtml = '<span class="font-normal ' + (isCompleted ? 'text-gray-900' : 'text-gray-400') + '">' + formatRevenueDisplay(calcRevenue) + (isCompleted ? '' : ' (예상)') + '</span>';
    const overdueBadgeHtml = overdue ? '<span class="text-rose-500 font-bold text-[11px] ml-1.5 shrink-0">[상태확인]</span>' : '';

    if (store.isBatchEditing) {
      const cleanVisitDate = formatCleanDate(item.visitDate);
      const cleanDeadlineDate = formatCleanDate(item.deadlineDate);
      const row = document.createElement('tr');
      row.className = 'bg-amber-50/60 border-b border-amber-200 text-xs text-gray-900';
      row.innerHTML = '<td class="p-2 text-left"><div class="flex items-center"><input type="text" id="batch_store_' + item.id + '" value="' + (item.storeName || '') + '" class="w-full border p-1.5 rounded-lg outline-none text-xs bg-white font-normal">' + overdueBadgeHtml + '</div></td>'
        + '<td class="p-2 text-center col-fixed-status"><select id="batch_status_' + item.id + '" class="select-center w-full border border-gray-300 p-1.5 rounded-lg outline-none text-xs bg-white font-normal text-center focus:border-theme">'
        + '<option value="신청" ' + (item.status === '신청' ? 'selected' : '') + '>신청</option><option value="선정" ' + (item.status === '선정' ? 'selected' : '') + '>선정</option><option value="방문" ' + (item.status === '방문' ? 'selected' : '') + '>방문</option><option value="미제출" ' + (item.status === '미제출' ? 'selected' : '') + '>미제출</option><option value="제출" ' + (item.status === '제출' ? 'selected' : '') + '>제출</option><option value="배송" ' + (item.status === '배송' ? 'selected' : '') + '>배송</option><option value="원고료" ' + (item.status === '원고료' ? 'selected' : '') + '>원고료</option></select></td>'
        + '<td class="p-2 text-center col-fixed-platform"><input type="text" id="batch_platform_' + item.id + '" value="' + (item.platformName || '') + '" class="w-full border p-1.5 rounded-lg outline-none text-xs bg-white font-normal text-center"></td>'
        + '<td class="p-2 text-center col-fixed-visit"><div class="flex items-center gap-1 justify-center"><input type="date" id="batch_visitDate_' + item.id + '" value="' + cleanVisitDate + '" class="border p-1 rounded-lg outline-none text-[11px] bg-white font-normal w-28"><button type="button" onclick="window.openEditModalFromId(\'' + item.id + '\')" class="p-1 text-gray-500 hover:text-theme transition-colors" title="시간/세부 정보 수정">🕒</button></div><input type="hidden" id="batch_visitTime_' + item.id + '" value="' + (item.visitTime || '') + '"></td>'
        + '<td class="p-2 text-center col-fixed-deadline"><input type="date" id="batch_deadlineDate_' + item.id + '" value="' + cleanDeadlineDate + '" class="w-full border border-gray-300 p-1.5 rounded-lg outline-none text-[11px] bg-white font-normal"></td>'
        + '<td class="p-2 text-center col-fixed-sponsored"><input type="text" id="batch_sponsored_' + item.id + '" value="' + formatCurrencyInput(item.sponsoredAmount || 0) + '" class="w-full border p-1.5 rounded-lg outline-none text-xs bg-white font-normal text-center"></td>'
        + '<td class="p-2 text-center col-fixed-paid"><input type="text" id="batch_paid_' + item.id + '" value="' + formatCurrencyInput(item.paidAmount || 0) + '" class="w-full border p-1.5 rounded-lg outline-none text-xs bg-white font-normal text-center"></td>'
        + '<td class="p-2 text-center font-normal text-gray-700 col-fixed-revenue">' + formatRevenueDisplay(calcRevenue) + '</td>'
        + '<td class="p-2 text-center col-fixed-note"><button onclick="window.deleteCampaign(\'' + item.id + '\')" class="text-xs bg-rose-500 text-white hover:bg-rose-600 px-2 py-1 rounded-lg font-bold shadow-sm">삭제</button></td>';
      tableBody?.appendChild(row);
    } else {
      let noteBadge = isCompleted ? '<span class="text-gray-900 font-normal">정산완료</span>' : '<span class="text-gray-400 font-normal">미정산</span>';
      const statusSelectHtml = '<select onchange="window.quickUpdateStatus(\'' + item.id + '\', this.value)" class="select-center border-0 bg-transparent text-xs font-normal ' + getStatusTextClass(effSt) + ' outline-none cursor-pointer text-center">'
        + '<option value="신청" ' + (effSt === '신청' ? 'selected' : '') + ' class="text-gray-800 font-normal">신청</option><option value="선정" ' + (effSt === '선정' ? 'selected' : '') + ' class="text-gray-800 font-normal">선정</option><option value="방문" ' + (effSt === '방문' ? 'selected' : '') + ' class="text-gray-800 font-normal">방문</option><option value="미제출" ' + (effSt === '미제출' ? 'selected' : '') + ' class="text-gray-800 font-normal">미제출</option><option value="제출" ' + (effSt === '제출' ? 'selected' : '') + ' class="text-gray-800 font-normal">제출</option><option value="배송" ' + (effSt === '배송' ? 'selected' : '') + ' class="text-gray-800 font-normal">배송</option><option value="원고료" ' + (effSt === '원고료' ? 'selected' : '') + ' class="text-gray-800 font-normal">원고료</option></select>';

      const row = document.createElement('tr');
      row.className = 'border-b border-gray-100 hover:bg-theme-light text-xs text-gray-900 font-normal';
      row.innerHTML = '<td class="p-3 font-normal text-gray-900 cursor-pointer hover:underline hover:text-theme text-xs text-left truncate" onclick="window.openDetailItemModal(\'' + item.id + '\')"><div class="flex items-center"><span class="truncate">' + item.storeName + '</span>' + overdueBadgeHtml + '</div></td>'
        + '<td class="p-3 text-xs text-center col-fixed-status">' + statusSelectHtml + '</td>'
        + '<td class="p-3 text-gray-900 text-xs font-normal text-center col-fixed-platform">' + (item.platformName || '-') + '</td>'
        + '<td class="p-3 text-gray-900 text-xs font-normal text-center col-fixed-visit">' + formatShortDate(item.visitDate) + '</td>'
        + '<td class="p-3 text-gray-900 text-xs font-normal text-center col-fixed-deadline">' + formatShortDate(item.deadlineDate) + '</td>'
        + '<td class="p-3 text-gray-900 text-xs font-normal text-center col-fixed-sponsored">' + sponsored.toLocaleString() + '원</td>'
        + '<td class="p-3 text-gray-900 text-xs font-normal text-center col-fixed-paid">' + paid.toLocaleString() + '원</td>'
        + '<td class="p-3 text-xs font-normal text-center col-fixed-revenue">' + revDisplayHtml + '</td>'
        + '<td class="p-3 text-xs font-normal text-center col-fixed-note">' + noteBadge + '</td>';
      tableBody?.appendChild(row);
    }

    const card = document.createElement('div');
    card.className = 'bg-white p-4 rounded-2xl shadow-sm border border-gray-100 space-y-2 text-xs text-gray-900';
    card.innerHTML = '<div class="flex justify-between items-start"><div><span class="' + getStatusTextClass(effSt) + ' text-xs mr-1.5 font-normal">' + displayStatusName(effSt) + '</span><span class="text-xs text-gray-400 font-normal">' + (item.platformName || '') + '</span><div class="flex items-center mt-1"><h3 class="font-normal text-xs text-gray-900 cursor-pointer hover:text-theme" onclick="window.openDetailItemModal(\'' + item.id + '\')">' + item.storeName + '</h3>' + overdueBadgeHtml + '</div></div><span class="text-xs font-normal text-gray-900 bg-gray-100 px-2 py-1 rounded">' + (isCompleted ? formatRevenueDisplay(calcRevenue) : formatRevenueDisplay(calcRevenue) + "(예상)") + '</span></div>'
      + '<div class="text-xs text-gray-800 space-y-0.5 font-normal"><div>방문일: ' + formatShortDate(item.visitDate) + ' | 마감일: <span class="font-normal text-gray-900">' + formatShortDate(item.deadlineDate) + '</span></div><div>동반인원: <span class="font-normal text-gray-900">' + (item.companions || '없음') + '</span></div></div>';
    cardList?.appendChild(card);
  });

  if (store.isBatchEditing) {
    store.newBatchRows.forEach((row, idx) => {
      const newRow = document.createElement('tr');
      newRow.className = 'bg-amber-50/60 border-b border-amber-200 text-xs text-gray-900';
      const defaultStatus = store.listSubTab === 'submitted' ? '제출' : '선정';
      newRow.innerHTML = '<td class="p-2 text-left"><input type="text" id="new_batch_store_' + idx + '" placeholder="+ 새 매장명 입력..." class="w-full border border-gray-300 p-1.5 rounded-lg outline-none text-xs bg-white font-normal focus:border-theme"></td>'
        + '<td class="p-2 text-center col-fixed-status"><select id="new_batch_status_' + idx + '" class="select-center w-full border border-gray-300 p-1.5 rounded-lg outline-none text-xs bg-white font-normal text-center focus:border-theme"><option value="신청" ' + (defaultStatus === '신청' ? 'selected' : '') + '>신청</option><option value="선정" ' + (defaultStatus === '선정' ? 'selected' : '') + '>선정</option><option value="방문" ' + (defaultStatus === '방문' ? 'selected' : '') + '>방문</option><option value="미제출" ' + (defaultStatus === '미제출' ? 'selected' : '') + '>미제출</option><option value="제출" ' + (defaultStatus === '제출' ? 'selected' : '') + '>제출</option><option value="배송" ' + (defaultStatus === '배송' ? 'selected' : '') + '>배송</option><option value="원고료" ' + (defaultStatus === '원고료' ? 'selected' : '') + '>원고료</option></select></td>'
        + '<td class="p-2 text-center col-fixed-platform"><input type="text" id="new_batch_platform_' + idx + '" placeholder="사이트" value="개별" class="w-full border border-gray-300 p-1.5 rounded-lg outline-none text-xs bg-white font-normal text-center focus:border-theme"></td>'
        + '<td class="p-2 text-center col-fixed-visit"><div class="flex items-center gap-1 justify-center"><input type="date" id="new_batch_visitDate_' + idx + '" class="border border-gray-300 p-1 rounded-lg outline-none text-[11px] bg-white font-normal w-28 focus:border-theme"><button type="button" onclick="window.toggleNewRowTimeInput(' + idx + ')" class="p-1 text-gray-500 hover:text-gray-800 transition-colors" title="시간 설정">🕒</button></div><div id="newTimeContainer_' + idx + '" class="hidden mt-1"><input type="time" id="new_batch_visitTime_' + idx + '" class="border border-gray-300 p-1 rounded-lg outline-none text-[11px] bg-white font-normal w-20 focus:border-theme"></div></td>'
        + '<td class="p-2 text-center col-fixed-deadline"><input type="date" id="new_batch_deadlineDate_' + idx + '" class="w-full border border-gray-300 p-1.5 rounded-lg outline-none text-[11px] bg-white font-normal focus:border-theme"></td>'
        + '<td class="p-2 text-center col-fixed-sponsored"><input type="text" id="new_batch_sponsored_' + idx + '" placeholder="0" class="w-full border border-gray-300 p-1.5 rounded-lg outline-none text-xs bg-white font-normal text-center focus:border-theme"></td>'
        + '<td class="p-2 text-center col-fixed-paid"><input type="text" id="new_batch_paid_' + idx + '" placeholder="0" class="w-full border border-gray-300 p-1.5 rounded-lg outline-none text-xs bg-white font-normal text-center focus:border-theme"></td>'
        + '<td class="p-2 text-center font-normal text-gray-400 col-fixed-revenue">자동계산</td>'
        + '<td class="p-2 text-center col-fixed-note"><button onclick="window.removeNewBatchRow(' + idx + ')" class="text-xs bg-gray-400 text-white hover:bg-gray-500 px-2 py-1 rounded-lg font-bold shadow-sm">취소</button></td>';
      tableBody?.appendChild(newRow);
    });
    const addBtnRow = document.createElement('tr');
    addBtnRow.innerHTML = '<td colspan="9" class="p-3 text-center bg-gray-50/80"><button onclick="window.addNewBatchRow()" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors">+ 새 체험 추가</button></td>';
    tableBody?.appendChild(addBtnRow);
  }

  if (filteredList.length === 0 && !store.isBatchEditing && tableBody) {
    tableBody.innerHTML = '<tr><td colspan="10"><div class="p-6 text-center text-gray-400 text-xs font-normal">조건에 해당하는 체험단이 없습니다.</div></td></tr>';
  }
}

window.handleSort = function(colName) {
  if (store.sortColumn === colName) store.sortAsc = !store.sortAsc;
  else { store.sortColumn = colName; store.sortAsc = true; }
  localStorage.setItem('onlyview_sortColumn', store.sortColumn);
  localStorage.setItem('onlyview_sortAsc', store.sortAsc.toString());
  filterAndRender();
};

window.toggleFilterArea = function() {
  store.isFilterExpanded = !store.isFilterExpanded;
  const filterBox = document.getElementById('filterBoxContainer');
  const toggleBtn = document.getElementById('filterToggleBtn');
  if (filterBox && toggleBtn) {
    if (store.isFilterExpanded) { filterBox.classList.remove('hidden'); filterBox.classList.add('flex'); toggleBtn.innerText = '▲ 필터'; } 
    else { filterBox.classList.add('hidden'); filterBox.classList.remove('flex'); toggleBtn.innerText = '▼ 필터'; }
  }
};

window.setListSubTab = function(type) {
  store.listSubTab = type;
  const btnOngoing = document.getElementById('subTabOngoing'); const btnSubmitted = document.getElementById('subTabSubmitted');
  if (type === 'ongoing') {
    if (btnOngoing) btnOngoing.className = "tab-fixed-btn py-1.5 rounded-lg font-bold text-xs bg-theme text-white shadow-sm transition-colors";
    if (btnSubmitted) btnSubmitted.className = "tab-fixed-btn py-1.5 rounded-lg font-normal text-xs bg-[#EAECEF] hover:bg-gray-200 text-gray-700 transition-colors";
  } else {
    if (btnOngoing) btnOngoing.className = "tab-fixed-btn py-1.5 rounded-lg font-normal text-xs bg-[#EAECEF] hover:bg-gray-200 text-gray-700 transition-colors";
    if (btnSubmitted) btnSubmitted.className = "tab-fixed-btn py-1.5 rounded-lg font-bold text-xs bg-theme text-white shadow-sm transition-colors";
  }
  filterAndRender();
};

window.toggleBatchEdit = function() {
  if (store.isReadOnly) return alert("읽기 전용 모드에서는 수정할 수 없습니다.");
  store.isBatchEditing = !store.isBatchEditing; store.newBatchRows = []; filterAndRender();
};

window.addNewBatchRow = function() { store.newBatchRows.push({ tempId: Date.now() + Math.random(), showTimeInput: false }); filterAndRender(); };
window.removeNewBatchRow = function(index) { store.newBatchRows.splice(index, 1); filterAndRender(); };
window.toggleNewRowTimeInput = function(idx) {
  const timeContainer = document.getElementById("newTimeContainer_" + idx);
  if (timeContainer) timeContainer.classList.toggle('hidden');
};

window.saveAllBatchEdits = async function() {
  if (store.isReadOnly || !store.currentUser) return;
  const promises = [];
  store.rawCampaignList.forEach(item => {
    const storeElem = document.getElementById("batch_store_" + item.id);
    if (!storeElem) return;
    const payload = {
      storeName: storeElem.value || '',
      status: document.getElementById("batch_status_" + item.id)?.value || '선정',
      platformName: document.getElementById("batch_platform_" + item.id)?.value || '개별',
      visitDate: formatCleanDate(document.getElementById("batch_visitDate_" + item.id)?.value || ''),
      visitTime: document.getElementById("batch_visitTime_" + item.id)?.value || '',
      deadlineDate: formatCleanDate(document.getElementById("batch_deadlineDate_" + item.id)?.value || ''),
      sponsoredAmount: parseCurrencyValue(document.getElementById("batch_sponsored_" + item.id)?.value),
      paidAmount: parseCurrencyValue(document.getElementById("batch_paid_" + item.id)?.value)
    };
    promises.push(updateDoc(doc(db, "campaigns", item.id), payload));
  });
  store.newBatchRows.forEach((row, idx) => {
    const storeVal = document.getElementById("new_batch_store_" + idx)?.value;
    if (storeVal && storeVal.trim()) {
      const payload = {
        userId: store.currentUser.uid, storeName: storeVal.trim(),
        status: document.getElementById("new_batch_status_" + idx)?.value || '선정',
        platformName: document.getElementById("new_batch_platform_" + idx)?.value || '개별',
        applyDate: formatCleanDate(new Date().toISOString().slice(0, 10)),
        visitDate: formatCleanDate(document.getElementById("new_batch_visitDate_" + idx)?.value || ''),
        visitTime: document.getElementById("new_batch_visitTime_" + idx)?.value || '',
        deadlineDate: formatCleanDate(document.getElementById("new_batch_deadlineDate_" + idx)?.value || ''),
        sponsoredAmount: parseCurrencyValue(document.getElementById("new_batch_sponsored_" + idx)?.value),
        paidAmount: parseCurrencyValue(document.getElementById("new_batch_paid_" + idx)?.value),
        revenue: 0, createdAt: serverTimestamp()
      };
      promises.push(addDoc(collection(db, "campaigns"), payload));
    }
  });
  try {
    await Promise.all(promises); alert('모든 체험 정보가 저장되었습니다!');
    store.isBatchEditing = false; store.newBatchRows = []; if(window.loadCampaigns) window.loadCampaigns();
  } catch (err) { alert('일괄 저장 실패: ' + err.message); }
};

window.quickUpdateStatus = async function(id, newStatus) {
  if (store.isReadOnly) return alert("읽기 전용 모드에서는 변경할 수 없습니다.");
  try {
    await updateDoc(doc(db, "campaigns", id), { status: newStatus });
    const item = store.rawCampaignList.find(c => c.id === id);
    if (item) item.status = newStatus;
    if (window.refreshAllViews) window.refreshAllViews();
  } catch (err) { alert("상태 변경 실패: " + err.message); }
};

window.deleteCampaign = async function(id) {
  if (store.isReadOnly) return alert("읽기 전용 모드에서는 삭제할 수 없습니다.");
  if (!confirm("정말 이 체험단 항목을 삭제하시겠습니까?")) return;
  try { await deleteDoc(doc(db, "campaigns", id)); alert("삭제되었습니다."); if(window.loadCampaigns) window.loadCampaigns(); } catch (err) { alert("삭제 실패: " + err.message); }
};

export function populateYearFilter() {
  const yearSelect = document.getElementById('filterYear');
  const settlementYearSelect = document.getElementById('settlementYearSelect');
  if (!yearSelect) return;
  const currentYear = new Date().getFullYear();
  const yearsSet = new Set([2025, currentYear]);
  store.rawCampaignList.forEach(item => {
    [item.applyDate, item.visitDate, item.deadlineDate].forEach(d => {
      if (d && typeof d === 'string' && d.length >= 4) { const y = parseInt(d.slice(0, 4)); if (!isNaN(y)) yearsSet.add(y); }
    });
  });
  const sortedYears = Array.from(yearsSet).sort((a, b) => b - a);
  yearSelect.innerHTML = '<option value="ALL">연도 전체</option>';
  if (settlementYearSelect) settlementYearSelect.innerHTML = '<option value="ALL">연도 전체 (누적)</option>';
  sortedYears.forEach(y => {
    const opt = document.createElement('option'); opt.value = y.toString(); opt.innerText = y + "년"; yearSelect.appendChild(opt);
    if (settlementYearSelect) {
      const optS = document.createElement('option'); optS.value = y.toString(); optS.innerText = y + "년 전체";
      if (y === currentYear) optS.selected = true; settlementYearSelect.appendChild(optS);
    }
  });
}
