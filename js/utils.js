import { store } from './store.js';

export function formatCleanDate(dateVal) {
  if (!dateVal) return "";
  let str = String(dateVal).trim().replace(/[/.]/g, '-');
  if (!str) return "";
  const parts = str.split("-");
  if (parts.length === 3) {
    let year = parts[0].replace(/[^0-9]/g, '');
    let month = parts[1].replace(/[^0-9]/g, '').padStart(2, '0');
    let day = parts[2].replace(/[^0-9]/g, '').padStart(2, '0');

    // 2자리 연도 보정 (예: 26 -> 2026)
    if (year.length === 2) {
      year = "20" + year;
    }
    // 4자리를 초과하는 비정상 연도 (예: 202222 -> 앞의 4자리 2022/2026 추출)
    else if (year.length > 4) {
      year = year.slice(0, 4);
    }

    if (year.length === 4 && month && day) {
      return year + "-" + month + "-" + day;
    }
  }
  return str;
}

export function formatShortDate(dateVal) {
  if (!dateVal) return "-";
  const str = formatCleanDate(dateVal);
  if (!str) return "-";
  const parts = str.split("-");
  if (parts.length === 3) {
    const yy = parts[0].length === 4 ? parts[0].substring(2, 4) : parts[0];
    const mm = String(Number(parts[1])).padStart(2, '0');
    const dd = String(Number(parts[2])).padStart(2, '0');
    return yy + "-" + mm + "-" + dd;
  }
  return str;
}

export function isItemOverdue(item) {
  const rawSt = item.status;
  if (rawSt === '제출' || rawSt === '완료' || rawSt === '미제출') return false;
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  if (item.deadlineDate) {
    const cleanDDate = formatCleanDate(item.deadlineDate);
    if (cleanDDate) {
      const dDateObj = new Date(cleanDDate);
      dDateObj.setHours(0, 0, 0, 0);
      if (!isNaN(dDateObj.getTime()) && dDateObj < now) return true;
    }
  }
  if (item.visitDate) {
    const cleanVDate = formatCleanDate(item.visitDate);
    if (cleanVDate) {
      const vDateObj = new Date(cleanVDate);
      vDateObj.setHours(0, 0, 0, 0);
      if (!isNaN(vDateObj.getTime()) && vDateObj < now) return true;
    }
  }
  return false;
}

export function getEffectiveStatus(item) { return item.status || '신청'; }
export function displayStatusName(status) { return status || '신청'; }

// 사용자가 설정한 커스텀 상태 색상을 실시간으로 가져오는 함수
export function getStatusColor(status) {
  const colors = store.customStatusColors || {};
  switch(status) {
    case '신청': return colors.apply || '#6B7280';
    case '선정': return colors.select || '#111827';
    case '방문': return colors.visit || '#F4A261';
    case '미제출': return colors.unsubmitted || '#E63946';
    case '제출':
    case '완료': return colors.submit || '#059669';
    case '배송': return colors.delivery || '#2563EB';
    case '원고료': return colors.fee || '#9333EA';
    default: return colors.apply || '#6B7280';
  }
}

export function getStatusTextClass(status) {
  switch(status) {
    case '신청': return 'status-text-apply';
    case '선정': return 'status-text-select';
    case '방문': return 'status-text-visit';
    case '미제출': return 'status-text-unsubmitted';
    case '제출': case '완료': return 'status-text-submit';
    case '배송': return 'status-text-delivery';
    case '원고료': return 'status-text-fee';
    default: return 'status-text-apply';
  }
}

export function formatCurrencyInput(value) {
  if (!value && value !== 0) return "";
  const num = String(value).replace(/[^0-9]/g, '');
  return num ? Number(num).toLocaleString() : "";
}

export function parseCurrencyValue(value) {
  if (!value) return 0;
  return Number(String(value).replace(/[^0-9]/g, '')) || 0;
}

export function formatRevenueDisplay(num) {
  const val = Number(num) || 0;
  if (val < 0) return "-" + Math.abs(val).toLocaleString() + "원";
  return val.toLocaleString() + "원";
}

export function formatPhoneNumber(value) {
  if (!value) return "";
  const num = value.replace(/[^0-9]/g, '');
  if (num.length < 3) return num;
  if (num.startsWith("02")) {
    if (num.length <= 5) return num.slice(0, 2) + "-" + num.slice(2);
    if (num.length <= 9) return num.slice(0, 2) + "-" + num.slice(2, 5) + "-" + num.slice(5);
    return num.slice(0, 2) + "-" + num.slice(2, 6) + "-" + num.slice(6, 10);
  } else {
    if (num.length <= 6) return num.slice(0, 3) + "-" + num.slice(3);
    if (num.length <= 10) return num.slice(0, 3) + "-" + num.slice(3, 6) + "-" + num.slice(6);
    return num.slice(0, 3) + "-" + num.slice(3, 7) + "-" + num.slice(7, 11);
  }
}
