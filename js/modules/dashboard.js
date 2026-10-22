import { store } from '../store.js';
import { getEffectiveStatus, formatCleanDate, formatShortDate, isItemOverdue, displayStatusName, getStatusTextClass } from '../utils.js';

export function renderDashboardView() {
  const year = store.currentCalDate.getFullYear();
  const month = store.currentCalDate.getMonth() + 1;
  const monthPrefix = year + "-" + String(month).padStart(2, '0');
  
  const titleElem = document.getElementById('dashMonthTitle');
  if (titleElem) titleElem.innerText = year + "년 " + month + "월";

  let cntSelect = 0, cntVisitWait = 0, cntVisitPlan = 0, cntSubmitWait = 0, cntSubmitDone = 0;
  const now = new Date(); now.setHours(0, 0, 0, 0);

  store.rawCampaignList.forEach(item => {
    const st = getEffectiveStatus(item);
    if (st === '제출' || st === '완료') {
      const refDate = formatCleanDate(item.visitDate || item.deadlineDate || item.applyDate || '');
      if (refDate && refDate.startsWith(monthPrefix)) cntSubmitDone++;
      return;
    }
    cntSelect++;
    if (isItemOverdue(item) || st === '미제출') cntSubmitWait++;
    if ((st === '선정' || st === '방문') && !item.visitDate) cntVisitWait++;
    if ((st === '선정' || st === '방문') && item.visitDate) {
      const vDateObj = new Date(formatCleanDate(item.visitDate));
      vDateObj.setHours(0, 0, 0, 0);
      if (vDateObj >= now) cntVisitPlan++;
    }
  });

  const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
  setTxt('cntSelect', cntSelect + '건');
  setTxt('cntVisitWait', cntVisitWait + '건');
  setTxt('cntVisitPlan', cntVisitPlan + '건');
  setTxt('cntSubmitWait', cntSubmitWait + '건');
  setTxt('cntSubmitDone', cntSubmitDone + '건');

  renderCalendar(year, month);
  renderUpcomingDeadlines();
  renderAllScheduledVisits();
}

export function renderCalendar(year, month) {
  const calGrid = document.getElementById('calendarGrid');
  if (!calGrid) return;
  calGrid.innerHTML = '';
  const firstDay = new Date(year, month - 1, 1).getDay();
  const lastDate = new Date(year, month, 0).getDate();
  const days = ['일', '월', '화', '수', '목', '금', '토'];

  days.forEach((d, idx) => {
    const dh = document.createElement('div');
    dh.className = "text-center text-[11px] font-bold pb-1.5 " + (idx === 0 ? 'text-rose-500' : idx === 6 ? 'text-blue-500' : 'text-gray-500');
    dh.innerText = d;
    calGrid.appendChild(dh);
  });

  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement('div');
    empty.className = 'bg-gray-50/40 rounded-xl aspect-square w-full cal-cell-fixed';
    calGrid.appendChild(empty);
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  for (let date = 1; date <= lastDate; date++) {
    const dateStr = year + "-" + String(month).padStart(2, '0') + "-" + String(date).padStart(2, '0');
    const dayCell = document.createElement('div');
    dayCell.className = "bg-white p-1 rounded-xl border border-gray-100 aspect-square w-full cal-cell-fixed flex flex-col justify-start cursor-pointer hover:border-theme transition-colors " + (dateStr === todayStr ? 'ring-2 ring-theme' : '');
    
    const visitMatches = store.rawCampaignList.filter(c => formatCleanDate(c.visitDate) === dateStr);
    const deadlineMatches = store.rawCampaignList.filter(c => formatCleanDate(c.deadlineDate) === dateStr && c.status !== '신청');

    let badgeHtml = '';
    if (visitMatches.length > 0) badgeHtml += '<span class="text-[10px] text-emerald-600 font-bold whitespace-nowrap">🟢 ' + visitMatches.length + '건</span>';
    if (deadlineMatches.length > 0) badgeHtml += '<span class="text-[10px] text-rose-500 font-bold whitespace-nowrap">🔴 ' + deadlineMatches.length + '건</span>';

    dayCell.innerHTML = '<div class="flex items-center justify-between w-full mb-0.5"><span class="text-[10px] font-normal text-gray-500 pl-0.5">' + date + '</span><div class="flex flex-col items-end gap-0.5 pr-0.5">' + badgeHtml + '</div></div>';
    const allMatched = store.rawCampaignList.filter(c => formatCleanDate(c.visitDate) === dateStr || (formatCleanDate(c.deadlineDate) === dateStr && c.status !== '신청'));
    dayCell.onclick = () => window.openDayModal(dateStr, allMatched);
    calGrid.appendChild(dayCell);
  }
}

export function renderUpcomingDeadlines() {
  const container = document.getElementById('upcomingList');
  if (!container) return;
  container.innerHTML = '';
  const today = new Date(); today.setHours(0,0,0,0);
  let deadlineList = store.rawCampaignList.filter(c => {
    const effSt = getEffectiveStatus(c);
    if (!c.deadlineDate || effSt === '제출' || effSt === '완료' || effSt === '신청') return false;
    const cleanDDate = formatCleanDate(c.deadlineDate);
    const parts = cleanDDate.split('-');
    return parts.length === 3 && !isNaN(new Date(cleanDDate).getTime());
  }).map(c => {
    const cleanDDate = formatCleanDate(c.deadlineDate);
    const dDate = new Date(cleanDDate); dDate.setHours(0,0,0,0);
    const diffDays = Math.ceil((dDate - today) / (1000 * 60 * 60 * 24));
    return { ...c, diffDays };
  }).filter(c => c.diffDays <= store.deadlineAlertDays).sort((a, b) => a.diffDays - b.diffDays);

  if (deadlineList.length === 0) {
    container.innerHTML = '<div class="text-xs text-gray-400 py-4 text-center font-normal">마감 임박 (' + store.deadlineAlertDays + '일 이내) 일정이 없습니다.</div>';
    return;
  }
  deadlineList.forEach(item => {
    const card = document.createElement('div');
    card.className = 'p-2.5 bg-white rounded-xl border border-gray-100 flex items-center justify-between text-xs cursor-pointer hover:border-theme transition-colors shadow-sm';
    card.onclick = () => window.openDetailItemModal(item.id);
    let dText = item.diffDays < 0 ? "지연 (D+" + Math.abs(item.diffDays) + ")" : (item.diffDays === 0 ? '오늘 마감' : "D-" + item.diffDays);
    card.innerHTML = '<div><span class="font-normal text-gray-900">' + item.storeName + '</span><span class="text-[11px] text-gray-400 ml-1.5 font-normal">(' + formatShortDate(item.deadlineDate) + ')</span></div><span class="px-2 py-0.5 rounded-lg text-[10px] bg-rose-500 text-white font-normal">' + dText + '</span>';
    container.appendChild(card);
  });
}

export function renderAllScheduledVisits() {
  const visitContainer = document.getElementById('scheduledVisitList');
  const unscheduledContainer = document.getElementById('unscheduledVisitList');
  if (!visitContainer || !unscheduledContainer) return;
  visitContainer.innerHTML = ''; unscheduledContainer.innerHTML = '';
  const now = new Date(); now.setHours(0, 0, 0, 0);

  const scheduledItems = store.rawCampaignList.filter(c => {
    const effSt = getEffectiveStatus(c);
    if (!c.visitDate || effSt === '제출' || effSt === '완료') return false;
    const vDateObj = new Date(formatCleanDate(c.visitDate)); vDateObj.setHours(0, 0, 0, 0);
    return vDateObj >= now;
  }).sort((a, b) => (formatCleanDate(a.visitDate) + " " + (a.visitTime || '00:00')).localeCompare(formatCleanDate(b.visitDate) + " " + (b.visitTime || '00:00')));

  if (scheduledItems.length === 0) visitContainer.innerHTML = '<div class="text-xs text-gray-400 py-4 text-center font-normal">예정된 방문 일정이 없습니다.</div>';
  else {
    scheduledItems.forEach(item => {
      const div = document.createElement('div');
      div.className = 'p-2.5 bg-white rounded-xl border border-gray-100 space-y-0.5 text-xs cursor-pointer hover:border-theme transition-colors shadow-sm';
      div.onclick = () => window.openDetailItemModal(item.id);
      const dateFormatted = formatShortDate(item.visitDate) + (item.visitTime ? " (" + item.visitTime + ")" : '');
      div.innerHTML = '<div class="flex justify-between items-center text-gray-600 font-normal"><span>' + dateFormatted + '</span>' + (item.companions ? '<span class="text-[11px] text-gray-400 font-normal">' + item.companions + '</span>' : '') + '</div><div class="font-normal text-gray-900 text-sm truncate">' + item.storeName + '</div>';
      visitContainer.appendChild(div);
    });
  }

  const unscheduledItems = store.rawCampaignList.filter(c => (getEffectiveStatus(c) === '선정' || getEffectiveStatus(c) === '방문') && !c.visitDate);
  if (unscheduledItems.length === 0) unscheduledContainer.innerHTML = '<div class="text-xs text-gray-400 py-4 text-center font-normal">일정 미지정 항목이 없습니다.</div>';
  else {
    unscheduledItems.forEach(item => {
      const div = document.createElement('div');
      div.className = 'p-2.5 bg-white rounded-xl border border-gray-100 flex justify-between items-center text-xs cursor-pointer hover:border-theme transition-colors shadow-sm';
      div.onclick = () => window.openDetailItemModal(item.id);
      div.innerHTML = '<div class="truncate mr-2"><span class="font-normal text-gray-900">' + item.storeName + '</span><span class="text-[11px] text-gray-400 ml-1 font-normal">(' + (formatShortDate(item.deadlineDate) || '마감미정') + ')</span></div>'
        + (!store.isReadOnly ? '<button onclick="event.stopPropagation(); window.openEditModalFromId(\'' + item.id + '\')" class="shrink-0 text-[10px] bg-theme bg-theme-hover text-white px-2 py-1 rounded-lg font-normal shadow-sm transition-colors">일정 잡기</button>' : '');
      unscheduledContainer.appendChild(div);
    });
  }
}

window.openCounterListModal = function(counterType, titleName) {
  const year = store.currentCalDate.getFullYear(); const month = store.currentCalDate.getMonth() + 1;
  const monthPrefix = year + "-" + String(month).padStart(2, '0');
  const now = new Date(); now.setHours(0, 0, 0, 0);
  let matchedItems = [];

  if (counterType === 'select') matchedItems = store.rawCampaignList.filter(c => { const st = getEffectiveStatus(c); return st !== '제출' && st !== '완료'; });
  else if (counterType === 'visitWait') matchedItems = store.rawCampaignList.filter(c => { const st = getEffectiveStatus(c); return (st === '선정' || st === '방문') && !c.visitDate; });
  else if (counterType === 'visitPlan') matchedItems = store.rawCampaignList.filter(c => {
    const st = getEffectiveStatus(c); if ((st !== '선정' && st !== '방문') || !c.visitDate) return false;
    const vDateObj = new Date(formatCleanDate(c.visitDate)); vDateObj.setHours(0, 0, 0, 0); return vDateObj >= now;
  });
  else if (counterType === 'submitWait') matchedItems = store.rawCampaignList.filter(c => { const st = getEffectiveStatus(c); if (st === '제출' || st === '완료') return false; return isItemOverdue(c) || st === '미제출'; });
  else if (counterType === 'submitDone') matchedItems = store.rawCampaignList.filter(c => {
    const st = getEffectiveStatus(c); if (st !== '제출' && st !== '완료') return false;
    const refDate = formatCleanDate(c.visitDate || c.deadlineDate || c.applyDate || ''); return refDate && refDate.startsWith(monthPrefix);
  });

  const modalTitleElem = document.getElementById('modalDateTitle');
  if (modalTitleElem) modalTitleElem.innerText = "[" + titleName + "] 목록 (" + matchedItems.length + "건)";
  const modalList = document.getElementById('modalItemList');
  if (modalList) {
    modalList.innerHTML = '';
    if (matchedItems.length === 0) modalList.innerHTML = '<div class="text-xs text-gray-400 py-6 text-center font-normal">' + titleName + ' 항목이 없습니다.</div>';
    else {
      matchedItems.forEach(item => {
        const effSt = getEffectiveStatus(item); const overdue = isItemOverdue(item);
        const div = document.createElement('div');
        div.className = 'p-3.5 bg-white rounded-2xl border border-gray-100 space-y-2 text-xs shadow-sm cursor-pointer hover:border-theme transition-colors';
        div.onclick = () => window.openDetailItemModal(item.id);
        div.innerHTML = '<div class="flex justify-between items-center"><div class="flex items-center gap-1.5"><span class="font-normal text-sm text-gray-900">' + item.storeName + '</span>' + (overdue ? '<span class="text-rose-500 font-bold text-[11px]">[상태확인]</span>' : '') + '</div><span class="' + getStatusTextClass(effSt) + ' font-normal">' + displayStatusName(effSt) + '</span></div><div class="flex justify-between text-gray-500 text-[11px] font-normal"><span>사이트: ' + (item.platformName || '개별') + '</span><span>' + (item.visitDate ? "방문일: " + formatShortDate(item.visitDate) : (item.deadlineDate ? "마감일: " + formatShortDate(item.deadlineDate) : '')) + '</span></div>';
        modalList.appendChild(div);
      });
    }
  }
  document.getElementById('dayModal')?.classList.remove('hidden');
};

window.openDayModal = function(dateStr, items) {
  document.getElementById('modalDateTitle').innerText = dateStr + " 일정 상세";
  const modalList = document.getElementById('modalItemList');
  if (modalList) {
    modalList.innerHTML = '';
    if (items.length === 0) modalList.innerHTML = '<div class="text-xs text-gray-400 py-6 text-center font-normal">등록된 일정이 없습니다.</div>';
    else {
      const sortedItems = [...items].sort((a, b) => (a.visitTime || '23:59').localeCompare(b.visitTime || '23:59'));
      sortedItems.forEach(item => {
        const overdue = isItemOverdue(item);
        const div = document.createElement('div');
        div.className = 'p-3.5 bg-white rounded-2xl border border-gray-100 space-y-2 text-xs shadow-sm cursor-pointer hover:border-theme transition-colors';
        div.onclick = () => window.openDetailItemModal(item.id);
        div.innerHTML = '<div class="flex justify-between items-center"><div class="flex items-center gap-1.5">' + ((formatCleanDate(item.visitDate) === dateStr && item.visitTime) ? '<span class="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded text-[10px] font-normal">' + item.visitTime + '</span>' : '') + '<span class="font-normal text-sm text-gray-900">' + item.storeName + '</span>' + (overdue ? '<span class="text-rose-500 font-bold text-[11px]">[상태확인]</span>' : '') + '</div><span class="text-xs font-normal text-gray-400">' + (item.platformName || '개별') + '</span></div>' + (item.memo ? '<div class="pt-1.5 text-gray-600 text-[11px] font-normal">비고: ' + item.memo + '</div>' : '');
        modalList.appendChild(div);
      });
    }
  }
  document.getElementById('dayModal')?.classList.remove('hidden');
};

window.openDetailItemModal = function(id) {
  const item = store.rawCampaignList.find(c => c.id === id);
  if (!item) return;
  const effSt = getEffectiveStatus(item);
  document.getElementById('modalDateTitle').innerText = item.storeName + " 상세 정보";
  const modalList = document.getElementById('modalItemList');
  if (modalList) {
    modalList.innerHTML = '<div class="p-4 bg-white rounded-2xl border border-gray-100 space-y-3 text-xs shadow-sm"><div class="flex justify-between items-center border-b pb-2"><span class="text-sm font-bold text-gray-900">' + item.storeName + '</span><span class="' + getStatusTextClass(effSt) + ' font-normal">' + displayStatusName(effSt) + '</span></div><div class="grid grid-cols-2 gap-2 text-gray-600"><div>체험단 사이트: <span class="font-normal text-gray-800">' + (item.platformName || '-') + '</span></div><div>신청일: <span class="font-normal text-gray-800">' + (formatCleanDate(item.applyDate) || '-') + '</span></div><div>방문일시: <span class="font-normal text-gray-800">' + (item.visitDate ? formatCleanDate(item.visitDate) + (item.visitTime ? " (" + item.visitTime + ")" : '') : '미정') + '</span></div><div>포스팅 마감일: <span class="font-normal text-gray-800">' + (formatCleanDate(item.deadlineDate) || '미정') + '</span></div><div>제공금액: <span class="font-normal text-gray-800">' + Number(item.sponsoredAmount || 0).toLocaleString() + '원</span></div><div>동반인원: <span class="font-normal text-gray-800">' + (item.companions || '없음') + '</span></div><div>결제금액: <span class="font-normal text-gray-800">' + Number(item.paidAmount || 0).toLocaleString() + '원</span></div><div>실수익·원고료: <span class="font-normal text-gray-800">' + formatShortDate(item.revenue || 0) + '</span></div></div><div class="pt-2 border-t text-gray-600 space-y-1"><div>업체 연락처: <span class="font-normal text-gray-800">' + (item.contact || '없음') + '</span></div><div class="pt-0.5 text-gray-600">메모: <span class="font-normal text-gray-800">' + (item.memo || '없음') + '</span></div></div>' + (!store.isReadOnly ? '<div class="flex gap-2 pt-2"><button onclick="document.getElementById(\'dayModal\').classList.add(\'hidden\'); window.openEditModalFromId(\'' + item.id + '\');" class="flex-1 bg-theme text-white py-2.5 rounded-xl font-bold">수정하기</button></div>' : '') + '</div>';
  }
  document.getElementById('dayModal')?.classList.remove('hidden');
};
