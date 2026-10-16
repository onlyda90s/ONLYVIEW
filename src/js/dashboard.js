import { rawCampaignList } from './campaign.js';

export let currentCalDate = new Date();

export function renderDashboardView() {
  const year = currentCalDate.getFullYear();
  const month = currentCalDate.getMonth() + 1;
  const titleElem = document.getElementById('dashMonthTitle');
  if (titleElem) titleElem.innerText = `${year}년 ${month}월`;

  // 달력 이전달/다음달 버튼 이벤트 보완
  document.getElementById('prevMonthBtn')?.onclick = () => {
    currentCalDate.setMonth(currentCalDate.getMonth() - 1);
    renderDashboardView();
  };
  document.getElementById('nextMonthBtn')?.onclick = () => {
    currentCalDate.setMonth(currentCalDate.getMonth() + 1);
    renderDashboardView();
  };

  const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
  const monthlyCampaigns = rawCampaignList.filter(item => {
    const applyM = item.applyDate ? item.applyDate.slice(0, 7) : '';
    const visitM = item.visitDate ? item.visitDate.slice(0, 7) : '';
    const deadM = item.deadlineDate ? item.deadlineDate.slice(0, 7) : '';
    return applyM === monthPrefix || visitM === monthPrefix || deadM === monthPrefix;
  });

  let cntSelect = 0, cntVisitWait = 0, cntVisitPlan = 0, cntSubmitWait = 0, cntSubmitDone = 0;
  const now = new Date();

  monthlyCampaigns.forEach(item => {
    const st = item.status;
    if (st === '선정' || st === '배송' || st === '원고료') {
      if (st === '선정' && !item.visitDate) {
        cntSelect++; cntVisitWait++;
      } else if (st === '배송' || st === '원고료') {
        cntSelect++;
      } else if (st === '선정' && item.visitDate) {
        const vTime = new Date(`${item.visitDate}T${item.visitTime || '23:59'}:00`);
        if (vTime >= now) cntVisitPlan++;
      }
    } else if (st === '방문') cntSubmitWait++;
    else if (st === '제출' || st === '완료') cntSubmitDone++;
  });

  if (document.getElementById('cntSelect')) document.getElementById('cntSelect').innerText = `${cntSelect}건`;
  if (document.getElementById('cntVisitWait')) document.getElementById('cntVisitWait').innerText = `${cntVisitWait}건`;
  if (document.getElementById('cntVisitPlan')) document.getElementById('cntVisitPlan').innerText = `${cntVisitPlan}건`;
  if (document.getElementById('cntSubmitWait')) document.getElementById('cntSubmitWait').innerText = `${cntSubmitWait}건`;
  if (document.getElementById('cntSubmitDone')) document.getElementById('cntSubmitDone').innerText = `${cntSubmitDone}건`;

  renderCalendar(year, month);
}

function renderCalendar(year, month) {
  const calGrid = document.getElementById('calendarGrid');
  if (!calGrid) return;
  calGrid.innerHTML = '';

  const firstDay = new Date(year, month - 1, 1).getDay();
  const lastDate = new Date(year, month, 0).getDate();
  const days = ['일', '월', '화', '수', '목', '금', '토'];

  days.forEach((d, idx) => {
    const dh = document.createElement('div');
    dh.className = `text-center text-[11px] font-bold py-0.5 ${idx === 0 ? 'text-rose-500' : idx === 6 ? 'text-blue-500' : 'text-gray-400'}`;
    dh.innerText = d;
    calGrid.appendChild(dh);
  });

  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement('div');
    empty.className = 'bg-gray-50/50 rounded-xl min-h-[38px]';
    calGrid.appendChild(empty);
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  for (let date = 1; date <= lastDate; date++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
    const dayCell = document.createElement('div');
    dayCell.className = `bg-white p-1 rounded-xl border border-gray-100 min-h-[40px] flex flex-col justify-start cursor-pointer hover:border-theme transition ${dateStr === todayStr ? 'ring-2 ring-theme' : ''}`;
    
    let html = `<div class="text-[10px] font-bold text-gray-500 mb-0.5">${date}</div>`;
    const visitMatches = rawCampaignList.filter(c => c.visitDate === dateStr);
    const deadlineMatches = rawCampaignList.filter(c => c.deadlineDate === dateStr && c.status !== '신청');

    if (visitMatches.length > 0) html += `<div class="text-[9px] text-emerald-600 font-bold mb-0.5 text-left pl-0.5">🟢 ${visitMatches.length}건</div>`;
    if (deadlineMatches.length > 0) html += `<div class="text-[9px] text-rose-500 font-bold mb-0.5 text-left pl-0.5">🔴 ${deadlineMatches.length}건</div>`;

    dayCell.innerHTML = html;
    calGrid.appendChild(dayCell);
  }
}
