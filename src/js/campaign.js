import { db } from '../config/firebase.js';
import { collection, getDocs, query, where, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { currentUser, targetUserId, isReadOnly, switchTab } from './app.js';

export let rawCampaignList = [];
export let listSubTab = 'ongoing';
export let isBatchEditing = false;
export let selectedStatus = "신청";

export async function loadCampaigns() {
  if (!db || !targetUserId) return;
  try {
    const q = query(collection(db, "campaigns"), where("userId", "==", targetUserId));
    const querySnapshot = await getDocs(q);
    
    rawCampaignList = [];
    querySnapshot.forEach((docSnap) => {
      rawCampaignList.push({ id: docSnap.id, ...docSnap.data() });
    });

    filterAndRender();
  } catch (e) {
    console.error("데이터 로드 실패:", e);
  }
}

export function setListSubTab(type) {
  listSubTab = type;
  const btnOngoing = document.getElementById('subTabOngoing');
  const btnSubmitted = document.getElementById('subTabSubmitted');
  
  if (type === 'ongoing') {
    if (btnOngoing) btnOngoing.className = "flex-1 w-28 text-center py-1.5 rounded-lg font-bold text-xs bg-theme text-white shadow-sm transition";
    if (btnSubmitted) btnSubmitted.className = "flex-1 w-28 text-center py-1.5 rounded-lg font-bold text-xs bg-transparent text-gray-600 hover:bg-gray-200 transition";
  } else {
    if (btnOngoing) btnOngoing.className = "flex-1 w-28 text-center py-1.5 rounded-lg font-bold text-xs bg-transparent text-gray-600 hover:bg-gray-200 transition";
    if (btnSubmitted) btnSubmitted.className = "flex-1 w-28 text-center py-1.5 rounded-lg font-bold text-xs bg-theme text-white shadow-sm transition";
  }
  filterAndRender();
}

export function toggleBatchEdit() {
  if (isReadOnly) return alert("읽기 전용 모드에서는 수정할 수 없습니다.");
  isBatchEditing = !isBatchEditing;
  filterAndRender();
}

export async function saveAllBatchEdits() {
  if (isReadOnly || !currentUser) return;
  const promises = [];

  rawCampaignList.forEach(item => {
    const storeElem = document.getElementById(`batch_store_${item.id}`);
    if (!storeElem) return;

    const payload = {
      storeName: storeElem.value || '',
      status: document.getElementById(`batch_status_${item.id}`)?.value || '선정',
      platformName: document.getElementById(`batch_platform_${item.id}`)?.value || '개별',
      visitDate: document.getElementById(`batch_visitDate_${item.id}`)?.value || '',
      visitTime: document.getElementById(`batch_visitTime_${item.id}`)?.value || '',
      deadlineDate: document.getElementById(`batch_deadlineDate_${item.id}`)?.value || ''
    };
    promises.push(updateDoc(doc(db, "campaigns", item.id), payload));
  });

  try {
    await Promise.all(promises);
    alert('모든 체험 정보가 일괄 저장되었습니다!');
    isBatchEditing = false;
    await loadCampaigns();
  } catch (err) {
    alert('일괄 저장 실패: ' + err.message);
  }
}

export async function submitCampaignForm(e) {
  e.preventDefault();
  if (isReadOnly || !currentUser) return alert("읽기 전용 모드입니다.");

  const payload = {
    userId: currentUser.uid,
    storeName: document.getElementById('storeName').value,
    platformName: document.getElementById('platformName').value || '개별',
    status: selectedStatus,
    applyDate: document.getElementById('applyDate')?.value || '',
    deadlineDate: document.getElementById('deadlineDate')?.value || '',
    visitDate: document.getElementById('visitDate')?.value || '',
    visitTime: document.getElementById('visitTime')?.value || '',
    createdAt: serverTimestamp()
  };

  try {
    await addDoc(collection(db, "campaigns"), payload);
    alert('성공적으로 등록되었습니다!');
    document.getElementById('campaignForm').reset();
    await loadCampaigns();
    switchTab('list');
  } catch (err) {
    alert('저장 실패: ' + err.message);
  }
}

export function filterAndRender() {
  const tableBody = document.getElementById('campaignTableBody');
  if (!tableBody) return;
  tableBody.innerHTML = '';

  const searchText = document.getElementById('searchInput')?.value.toLowerCase() || '';
  const filteredList = rawCampaignList.filter(item => {
    const isCompleted = (item.status === '제출' || item.status === '완료');
    if (listSubTab === 'ongoing' && isCompleted) return false;
    if (listSubTab === 'submitted' && !isCompleted) return false;
    return (item.storeName || '').toLowerCase().includes(searchText);
  });

  filteredList.forEach(item => {
    const row = document.createElement('tr');
    row.className = 'border-b border-gray-100 text-sm text-gray-900';
    row.innerHTML = `
      <td class="p-3 font-semibold">${item.storeName}</td>
      <td class="p-3">${item.status}</td>
      <td class="p-3">${item.platformName || '-'}</td>
      <td class="p-3">${item.visitDate || '-'}</td>
      <td class="p-3">${item.deadlineDate || '-'}</td>
      <td class="p-3">${Number(item.sponsoredAmount || 0).toLocaleString()}원</td>
      <td class="p-3">-${Number(item.paidAmount || 0).toLocaleString()}원</td>
      <td class="p-3 font-bold">+${Number(item.revenue || 0).toLocaleString()}원</td>
      <td class="p-3">${item.memo || '-'}</td>
    `;
    tableBody.appendChild(row);
  });
}
