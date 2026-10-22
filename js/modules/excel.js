import { store } from '../store.js';
import { getEffectiveStatus, formatCleanDate } from '../utils.js';

window.downloadExcel = async function() {
  if (!store.rawCampaignList || store.rawCampaignList.length === 0) {
    return alert("내보낼 체험단 데이터가 없습니다.");
  }
  try {
    const response = await fetch('체험단_정산_리포트_양식.xlsx');
    if (!response.ok) throw new Error("양식 파일(체험단_정산_리포트_양식.xlsx)을 찾을 수 없습니다.");
    const arrayBuffer = await response.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });

    const targetYear = new Date().getFullYear();
    const dashSheet = workbook.Sheets['대시보드'];
    if (dashSheet) XLSX.utils.sheet_add_aoa(dashSheet, [[targetYear]], { origin: 'C2' });

    const ongoingSheet = workbook.Sheets['진행중 체험단'];
    if (ongoingSheet) {
      const ongoingItems = store.rawCampaignList.filter(item => {
        const st = getEffectiveStatus(item);
        return st !== '제출' && st !== '완료';
      });
      const ongoingRows = [];
      for (let i = 0; i < Math.max(ongoingItems.length, 10); i++) {
        if (i < ongoingItems.length) {
          const item = ongoingItems[i];
          const rowNum = 4 + i;
          ongoingRows.push([
            item.storeName || "", getEffectiveStatus(item), item.platformName || "개별", formatCleanDate(item.visitDate), formatCleanDate(item.deadlineDate),
            Number(item.sponsoredAmount || 0), Number(item.paidAmount || 0), "=IF(F" + rowNum + "=\"\",\"\",F" + rowNum + "-G" + rowNum + ")", item.memo || ""
          ]);
        } else {
          const rowNum = 4 + i;
          ongoingRows.push(["", "", "", "", "", "", "", "=IF(F" + rowNum + "=\"\",\"\",F" + rowNum + "-G" + rowNum + ")", ""]);
        }
      }
      XLSX.utils.sheet_add_aoa(ongoingSheet, ongoingRows, { origin: "A4" });
    }

    const completedSheet = workbook.Sheets['완료 체험단'];
    if (completedSheet) {
      const completedItems = store.rawCampaignList.filter(item => {
        const st = getEffectiveStatus(item);
        return st === '제출' || st === '완료';
      });
      const completedRows = [];
      for (let i = 0; i < Math.max(completedItems.length, 10); i++) {
        if (i < completedItems.length) {
          const item = completedItems[i];
          const rowNum = 4 + i;
          completedRows.push([
            item.storeName || "", getEffectiveStatus(item), item.platformName || "개별", formatCleanDate(item.visitDate), formatCleanDate(item.deadlineDate),
            Number(item.sponsoredAmount || 0), Number(item.paidAmount || 0), "=IF(F" + rowNum + "=\"\",\"\",F" + rowNum + "-G" + rowNum + ")", item.memo || "정산완료"
          ]);
        } else {
          const rowNum = 4 + i;
          completedRows.push(["", "", "", "", "", "", "", "=IF(F" + rowNum + "=\"\",\"\",F" + rowNum + "-G" + rowNum + ")", ""]);
        }
      }
      XLSX.utils.sheet_add_aoa(completedSheet, completedRows, { origin: "A4" });
    }

    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    XLSX.writeFile(workbook, "체험단_정산_리포트_" + todayStr + ".xlsx");
  } catch (err) { alert("엑셀 다운로드 오류: " + err.message); }
};
