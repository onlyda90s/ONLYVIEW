import { store } from '../store.js';
import { formatCleanDate, getEffectiveStatus } from '../utils.js';
import { getActiveChartColors } from './settings.js';

export function renderSettlementView() {
  try {
    const yearSelect = document.getElementById('settlementYearSelect');
    const selectedYearVal = yearSelect ? yearSelect.value : 'ALL';
    const now = new Date();
    const actualRealYear = now.getFullYear();
    const actualRealMonth = now.getMonth() + 1;
    const targetYear = selectedYearVal === 'ALL' ? actualRealYear : parseInt(selectedYearVal);
    const isCurrentYear = (targetYear === actualRealYear);

    const yearlyAccumulatedLabel = document.getElementById('yearlyAccumulatedLabel');
    if (yearlyAccumulatedLabel) yearlyAccumulatedLabel.innerText = selectedYearVal === 'ALL' ? '누적 총 수익' : targetYear + "년 누적";

    const chartColors = getActiveChartColors();
    let doneCount = 0, doneAmount = 0, planCount = 0, planAmount = 0, prevDoneAmount = 0;
    let hasPrevYearData = false;
    const monthlyRevenues = new Array(12).fill(0);
    const monthlyCounts = new Array(12).fill(0);
    const platformMap = {};
    const monthlyDetailsData = {};
    for(let m = 1; m <= 12; m++) monthlyDetailsData[m] = [];

    store.rawCampaignList.forEach(item => {
      const sponsored = Number(item.sponsoredAmount || 0);
      const paid = Number(item.paidAmount || 0);
      const inputRev = Number(item.revenue || 0);
      let calcRevenue = paid === 0 ? (sponsored > 0 ? sponsored : inputRev) : ((sponsored - paid) + inputRev);

      const refDate = formatCleanDate(item.visitDate || '');
      if (!refDate || refDate.length < 7) return; 
      const itemYear = parseInt(refDate.slice(0, 4));
      const itemMonth = parseInt(refDate.slice(5, 7));
      const effectiveSt = getEffectiveStatus(item);
      const isCompleted = (effectiveSt === '제출' || effectiveSt === '완료');
      const platformName = item.platformName || '개별';

      if (selectedYearVal === 'ALL' || itemYear === targetYear) {
        if (!platformMap[platformName]) platformMap[platformName] = { doneCount: 0, doneAmount: 0 };
        if (isCompleted) {
          doneCount++; doneAmount += calcRevenue;
          platformMap[platformName].doneCount++; platformMap[platformName].doneAmount += calcRevenue;
          if (itemMonth >= 1 && itemMonth <= 12) {
            monthlyRevenues[itemMonth - 1] += calcRevenue; monthlyCounts[itemMonth - 1]++;
            monthlyDetailsData[itemMonth].push({ storeName: item.storeName || '미지정', sponsoredAmount: sponsored, paidAmount: paid, revenueAmount: calcRevenue, sortRefDate: refDate });
          }
        } else {
          planCount++; planAmount += calcRevenue;
        }
      }
      if (itemYear === targetYear - 1) {
        hasPrevYearData = true;
        if (isCompleted) prevDoneAmount += calcRevenue;
      }
    });

    const totalAmount = doneAmount + planAmount;
    if (document.getElementById('yearlyTotalRevenueText')) document.getElementById('yearlyTotalRevenueText').innerText = totalAmount.toLocaleString() + "원";
    if (document.getElementById('yearlyDoneCount')) document.getElementById('yearlyDoneCount').innerText = doneCount + "건";
    if (document.getElementById('yearlyDoneAmount')) document.getElementById('yearlyDoneAmount').innerText = doneAmount.toLocaleString() + "원";
    if (document.getElementById('yearlyPlanCount')) document.getElementById('yearlyPlanCount').innerText = planCount + "건";
    if (document.getElementById('yearlyPlanAmount')) document.getElementById('yearlyPlanAmount').innerText = planAmount.toLocaleString() + "원";

    const diffAmount = doneAmount - prevDoneAmount;
    const compareContainer = document.getElementById('yearlyCompareContainer');
    if (compareContainer) {
      if (!hasPrevYearData) {
        compareContainer.innerHTML = '<div class="flex items-center gap-2"><span class="text-[11px] text-gray-400 font-normal shrink-0">전년 대비 증가</span><span class="text-xs text-gray-400 font-normal">비교 데이터 없음</span></div>';
      } else {
        const rate = prevDoneAmount === 0 ? 100 : ((diffAmount / prevDoneAmount) * 100).toFixed(1);
        let diffStr = diffAmount >= 0 ? "+" + diffAmount.toLocaleString() + "원" : diffAmount.toLocaleString() + "원";
        let rateStr = diffAmount >= 0 ? "+" + rate + "%" : rate + "%";
        let badgeClass = diffAmount >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700';
        compareContainer.innerHTML = '<div class="flex items-center gap-2"><span class="text-[11px] text-gray-400 font-normal shrink-0">전년 대비 증가</span><span class="font-normal text-gray-900 text-lg">' + diffStr + '</span><span class="px-2 py-0.5 rounded-full text-[11px] font-normal ' + badgeClass + '">' + rateStr + '</span></div>';
      }
    }

    const ctxYearly = document.getElementById('yearlyDonutChart')?.getContext('2d');
    if (ctxYearly) {
      if (store.charts.yearly) store.charts.yearly.destroy();
      const doughnutValues = totalAmount === 0 ? [1, 0] : [doneAmount, planAmount];
      let doughnutFills = [], doughnutBorders = [], doughnutWidths = 0;
      if (chartColors.isOutline) {
        doughnutFills = totalAmount === 0 ? ['#F3F4F6', '#FFFFFF'] : [chartColors.mainFill, chartColors.pendingFill];
        doughnutBorders = totalAmount === 0 ? ['#E5E7EB', '#E5E7EB'] : [chartColors.mainBorder, chartColors.pendingBorder];
        doughnutWidths = 2;
      } else {
        doughnutFills = totalAmount === 0 ? ['#E5E7EB', '#F3F4F6'] : [chartColors.main, chartColors.pending];
        doughnutBorders = ['transparent', 'transparent']; doughnutWidths = 0;
      }
      store.charts.yearly = new Chart(ctxYearly, {
        type: 'doughnut', data: { labels: ['정산 완료', '정산 예정'], datasets: [{ data: doughnutValues, backgroundColor: doughnutFills, borderColor: doughnutBorders, borderWidth: doughnutWidths, hoverOffset: 2 }] },
        options: { responsive: true, maintainAspectRatio: false, animation: false, cutout: '68%', plugins: { legend: { display: false }, tooltip: { enabled: totalAmount > 0 } } }
      });
    }

    let maxMonthIdx = 0, maxRevVal = 0;
    monthlyRevenues.forEach((val, idx) => { if (val > maxRevVal) { maxRevVal = val; maxMonthIdx = idx; } });
    const monthlyDataTenThousand = monthlyRevenues.map(v => Number((v / 10000).toFixed(1)));
    const barFills = monthlyRevenues.map((_, idx) => {
      const monthNum = idx + 1;
      if (isCurrentYear) {
        if (monthNum === actualRealMonth) return chartColors.isOutline ? chartColors.highlightFill : chartColors.highlight; 
        if (monthNum < actualRealMonth) return chartColors.isOutline ? chartColors.mainFill : chartColors.main;   
        return chartColors.isOutline ? chartColors.pendingFill : chartColors.pending;                                  
      } else return chartColors.isOutline ? chartColors.mainFill : chartColors.main; 
    });
    const barBorders = monthlyRevenues.map((_, idx) => {
      const monthNum = idx + 1;
      if (!chartColors.isOutline) return 'transparent';
      if (isCurrentYear && monthNum === actualRealMonth) return chartColors.highlightBorder;
      return chartColors.mainBorder;
    });

    if (document.getElementById('monthlyBestMonthText')) document.getElementById('monthlyBestMonthText').innerText = maxRevVal === 0 ? '-' : (maxMonthIdx + 1) + "월 · " + maxRevVal.toLocaleString() + "원";
    if (document.getElementById('monthlyCurrentMonthText')) document.getElementById('monthlyCurrentMonthText').innerText = (isCurrentYear && totalAmount > 0) ? actualRealMonth + "월 · " + (monthlyRevenues[actualRealMonth - 1] || 0).toLocaleString() + "원" : '-';

    const ctxMonthly = document.getElementById('monthlyBarChart')?.getContext('2d');
    if (ctxMonthly) {
      if (store.charts.monthly) store.charts.monthly.destroy();
      store.charts.monthly = new Chart(ctxMonthly, {
        type: 'bar', data: { labels: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'], datasets: [{ data: monthlyDataTenThousand, backgroundColor: barFills, borderColor: barBorders, borderWidth: chartColors.isOutline ? 2 : 0, borderRadius: 6, borderSkipped: false, barPercentage: 0.6 }] },
        plugins: [ChartDataLabels], options: { responsive: true, maintainAspectRatio: false, animation: false, layout: { padding: { top: 22 } }, scales: { x: { grid: { display: false }, ticks: { font: { size: 10, weight: 'normal' }, color: '#6B7280' } }, y: { display: false } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (context) => (context.raw * 10000).toLocaleString() + "원" } }, datalabels: { anchor: 'end', align: 'end', offset: 2, font: { size: 10, weight: 'normal' }, color: (context) => barFills[context.dataIndex], formatter: (value) => { if (!value || value <= 0) return ''; return Number.isInteger(value) ? value : value.toFixed(1); } } } }
      });
    }

    let maxCountMonthIdx = 0, maxCountVal = 0;
    monthlyCounts.forEach((val, idx) => { if (val > maxCountVal) { maxCountVal = val; maxCountMonthIdx = idx; } });
    if (document.getElementById('monthlyAnalysisBestText')) document.getElementById('monthlyAnalysisBestText').innerText = maxCountVal === 0 ? '-' : (maxCountMonthIdx + 1) + "월 · " + maxCountVal + "건";
    if (document.getElementById('monthlyAnalysisCurrentText')) document.getElementById('monthlyAnalysisCurrentText').innerText = isCurrentYear ? actualRealMonth + "월 · " + (monthlyCounts[actualRealMonth - 1] || 0) + "건" : '-';

    const pointFills = monthlyCounts.map((_, idx) => {
      const monthNum = idx + 1;
      if (isCurrentYear && monthNum === actualRealMonth) return chartColors.isOutline ? chartColors.highlightFill : chartColors.highlight;
      return chartColors.isOutline ? chartColors.mainFill : chartColors.main;
    });

    const ctxMonthlyAnalysis = document.getElementById('monthlyAnalysisLineChart')?.getContext('2d');
    if (ctxMonthlyAnalysis) {
      if (store.charts.monthlyAnalysis) store.charts.monthlyAnalysis.destroy();
      store.charts.monthlyAnalysis = new Chart(ctxMonthlyAnalysis, {
        type: 'line', data: { labels: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'], datasets: [{ data: monthlyCounts, borderColor: chartColors.isOutline ? chartColors.mainBorder : chartColors.main, borderWidth: 2.5, borderDash: chartColors.isOutline ? [4, 4] : [], pointBackgroundColor: pointFills, pointBorderColor: chartColors.isOutline ? chartColors.mainBorder : pointFills, pointRadius: 4, pointHoverRadius: 6, tension: 0.25, fill: false }] },
        plugins: [ChartDataLabels], options: { responsive: true, maintainAspectRatio: false, animation: false, layout: { padding: { top: 22 } }, scales: { x: { grid: { display: false }, ticks: { font: { size: 10, weight: 'normal' }, color: '#6B7280' } }, y: { display: false } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (context) => context.raw + "건" } }, datalabels: { anchor: 'end', align: 'end', offset: 2, font: { size: 10, weight: 'normal' }, color: (context) => pointFills[context.dataIndex], formatter: (value) => (value > 0 ? value : '') } } }
      });
    }

    const platformColLeft = document.getElementById('platformColLeft');
    const platformColRight = document.getElementById('platformColRight');
    const platformCountInfo = document.getElementById('platformAnalysisCountInfo');

    if (platformColLeft && platformColRight) {
      platformColLeft.innerHTML = ''; platformColRight.innerHTML = '';
      const sortedPlatforms = Object.keys(platformMap).map(pName => { const data = platformMap[pName]; return { pName, doneCount: data ? data.doneCount : 0, doneAmount: data ? data.doneAmount : 0 }; }).filter(p => p.doneCount > 0).sort((a, b) => b.doneCount - a.doneCount || b.doneAmount - a.doneAmount);
      if (platformCountInfo) platformCountInfo.innerText = "올해 건수·실수익 (" + sortedPlatforms.length + "개 플랫폼)";
      if (sortedPlatforms.length > 0) {
        const maxDoneCnt = sortedPlatforms[0].doneCount || 1;
        const leftThreshold = Math.ceil(sortedPlatforms.length / 2);
        sortedPlatforms.forEach((p, idx) => {
          const barPercent = Math.max(10, Math.round((p.doneCount / maxDoneCnt) * 100));
          const itemDiv = document.createElement('div');
          itemDiv.className = "flex items-center justify-between text-xs py-1 px-0.5";
          const barBgColor = chartColors.isOutline ? chartColors.mainFill : chartColors.main;
          const barBorderStyle = chartColors.isOutline ? "border: 1px solid " + chartColors.mainBorder + ";" : '';
          itemDiv.innerHTML = '<span class="font-normal text-gray-800 truncate w-16 shrink-0 text-[11px]">' + p.pName + '</span>'
            + '<div class="flex-1 mx-1 bg-gray-100 h-1.5 rounded-full overflow-hidden"><div class="h-full rounded-full transition-colors" style="width: ' + barPercent + '%; background-color: ' + barBgColor + '; ' + barBorderStyle + '"></div></div>'
            + '<div class="flex items-center gap-1 shrink-0 text-right whitespace-nowrap"><span class="text-gray-400 font-normal text-[10px] text-right">' + p.doneCount + '건</span><span class="text-gray-900 font-normal text-[11px] text-right">' + p.doneAmount.toLocaleString() + '원</span></div>';
          if (idx < leftThreshold) platformColLeft.appendChild(itemDiv); else platformColRight.appendChild(itemDiv);
        });
      } else { platformColLeft.innerHTML = '<div class="text-xs text-gray-400 py-12 text-center font-normal col-span-2">해당 기간의 정산 완료 플랫폼 데이터가 없습니다.</div>'; }
    }

    const monthlyDetailsGrid = document.getElementById('monthlyDetailsGrid');
    if (monthlyDetailsGrid) {
      monthlyDetailsGrid.innerHTML = '';
      for (let m = 1; m <= 12; m++) {
        const list = monthlyDetailsData[m];
        list.sort((a, b) => a.sortRefDate.localeCompare(b.sortRefDate));
        const isCollapsed = store.monthlyDetailsCollapseState[m] === true;
        const totalMCount = list.length; const totalMRevenue = list.reduce((sum, item) => sum + item.revenueAmount, 0);

        const cardDiv = document.createElement('div');
        cardDiv.className = "bg-white pt-2.5 px-4 pb-3 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between overflow-hidden transition-colors min-h-[48px]";
        let html = '<div onclick="window.toggleMonthlyDetailsCard(' + m + ')" class="flex justify-between items-center h-[36px] pb-1.5 border-b border-gray-100 cursor-pointer select-none">'
          + '<span class="text-xs font-bold text-gray-800">' + m + '월</span><div class="flex items-center gap-2">'
          + (isCollapsed ? '<span class="text-xs text-gray-900 font-normal">' + totalMCount + '건 · ' + totalMRevenue.toLocaleString() + '원</span>' : '')
          + '<span class="text-xs text-gray-400 font-bold">' + (isCollapsed ? '▼' : '▲') + '</span></div></div>';

        if (!isCollapsed) {
          html += '<div class="flex-1 flex flex-col justify-between min-h-[200px] mt-2.5"><div class="flex-1 overflow-y-auto widget-scroll max-h-[200px] my-1 pr-1 space-y-1.5">';
          if (list.length === 0) { html += '<div class="text-center text-gray-300 font-normal py-16 text-[11px]">이 달의 완료된 체험이 없습니다.</div>'; } 
          else {
            html += '<div class="flex items-center justify-between font-normal text-gray-400 text-[10px] mb-1"><span class="w-1/2 text-left">매장명</span><span class="w-1/4 text-right">제공금액</span><span class="w-1/4 text-right">결제금액</span></div>';
            list.forEach(item => {
              html += '<div class="flex items-center justify-between text-[11px] py-1 border-b border-dashed border-gray-50"><span class="w-1/2 font-normal text-gray-800 truncate" title="' + item.storeName + '">' + item.storeName + '</span><span class="w-1/4 text-right font-normal text-gray-500">' + item.sponsoredAmount.toLocaleString() + '원</span><span class="w-1/4 text-right font-normal text-gray-400">' + (item.paidAmount > 0 ? item.paidAmount.toLocaleString() + '원' : '0원') + '</span></div>';
            });
          }
          html += '</div><div class="mt-2.5 p-2 bg-gray-50/80 rounded-xl flex justify-between items-center border border-gray-100/60 shrink-0 px-3 text-xs"><span class="text-[10px] font-normal text-gray-400">소계 <b class="text-gray-900 text-xs font-normal ml-1">' + totalMCount + '건</b></span><span class="text-[10px] font-normal text-gray-400">실수익 <b class="text-gray-900 text-xs font-normal ml-1">' + totalMRevenue.toLocaleString() + '원</b></span></div></div>';
        }
        cardDiv.innerHTML = html;
        monthlyDetailsGrid.appendChild(cardDiv);
      }
    }
  } catch (err) { console.error(err); }
}

window.setSettlementSubTab = function(type) {
  store.settlementSubTab = type;
  const btnReport = document.getElementById('settlementSubTabReport');
  const btnDetail = document.getElementById('settlementSubTabDetail');
  const panelReport = document.getElementById('settlementPanelReport');
  const panelDetail = document.getElementById('settlementPanelDetail');
  if (type === 'report') {
    if (btnReport) btnReport.className = "tab-fixed-btn py-1.5 rounded-lg font-bold text-xs bg-theme text-white shadow-sm transition-colors";
    if (btnDetail) btnDetail.className = "tab-fixed-btn py-1.5 rounded-lg font-normal text-xs bg-[#EAECEF] hover:bg-gray-200 text-gray-700 transition-colors";
    panelReport?.classList.remove('hidden'); panelDetail?.classList.add('hidden');
  } else {
    if (btnReport) btnReport.className = "tab-fixed-btn py-1.5 rounded-lg font-normal text-xs bg-[#EAECEF] hover:bg-gray-200 text-gray-700 transition-colors";
    if (btnDetail) btnDetail.className = "tab-fixed-btn py-1.5 rounded-lg font-bold text-xs bg-theme text-white shadow-sm transition-colors";
    panelDetail?.classList.remove('hidden'); panelReport?.classList.add('hidden');
  }
  renderSettlementView();
};

window.toggleMonthlyDetailsCard = function(month) {
  store.monthlyDetailsCollapseState[month] = !store.monthlyDetailsCollapseState[month];
  localStorage.setItem("onlyview_monthlyDetailCollapsed_" + month, store.monthlyDetailsCollapseState[month]);
  renderSettlementView(); 
};
