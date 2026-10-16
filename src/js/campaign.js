import { db } from '../config/firebase.js'; 
import { collection, getDocs, query, where, addDoc, updateDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { currentUser, targetUserId, isReadOnly } from './app.js';

export let rawCampaignList = [];
export let listSubTab = 'ongoing';
export let isBatchEditing = false;

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
