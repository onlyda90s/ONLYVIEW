export function formatCleanDate(dateVal) {
  if (!dateVal) return "";
  let str = String(dateVal).trim();
  if (!str) return "";
  const parts = str.split("-");
  if (parts.length === 3) {
    let year = parts[0].replace(/[^0-9]/g, '');
    if (year.length > 4) year = year.slice(-4);
    const month = String(parts[1]).replace(/[^0-9]/g, '').padStart(2, '0');
    const day = String(parts[2]).replace(/[^0-9]/g, '').padStart(2, '0');
    if (!year || !month || !day) return "";
    return year + "-" + month + "-" + day;
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
