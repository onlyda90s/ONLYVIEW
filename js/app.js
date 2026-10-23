import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, setPersistence, browserSessionPersistence } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, getDoc, doc, setDoc, updateDoc, deleteDoc, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBfKBcYsKume9YqbZwFGtVuFvElrfVGNzY",
  authDomain: "onlyview-2ef88.firebaseapp.com",
  projectId: "onlyview-2ef88",
  storageBucket: "onlyview-2ef88.firebasestorage.app",
  messagingSenderId: "110107089396",
  appId: "1:110107089396:web:a0670b16ce10655c2481a1"
};

let app, auth, db, provider;
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  provider = new GoogleAuthProvider();
  setPersistence(auth, browserSessionPersistence).catch(e => console.error(e));
} catch (e) { console.error("Firebase 초기화 에러:", e); }

let autoLogoutTimer;
function resetAutoLogoutTimer() {
  clearTimeout(autoLogoutTimer);
  autoLogoutTimer = setTimeout(() => {
    if (auth && auth.currentUser) {
      signOut(auth);
      alert("2시간 동안 활동이 없어 안전하게 자동 로그아웃 되었습니다.");
      window.location.reload();
    }
  }, 2 * 60 * 60 * 1000);
}
['click', 'mousemove', 'keydown', 'scroll', 'touchstart'].forEach(evt => window.addEventListener(evt, resetAutoLogoutTimer));
resetAutoLogoutTimer();

let currentUser = null;
let targetUserId = null;
let isReadOnly = false;
let isSettlementShared = localStorage.getItem('onlyview_shareSettlement') === 'true';
let rawCampaignList = [];
let isBatchEditing = false; 
let listSubTab = 'ongoing'; 
let settlementSubTab = 'report'; 
let isFilterExpanded = false; 
let newBatchRows = []; 
let yearlyChartInstance = null;
let monthlyChartInstance = null;
let monthlyAnalysisChartInstance = null;
let isSidebarCollapsed = localStorage.getItem('onlyview_sidebarCollapsed') === 'true';
let monthlyDetailsCollapseState = {}; 
let sortColumn = localStorage.getItem('onlyview_sortColumn') || 'none'; 
let sortAsc = localStorage.getItem('onlyview_sortAsc') === 'true'; 
let myCustomCode = localStorage.getItem('onlyview_customCode') || "";
let currentCalDate = new Date();
let selectedStatus = "신청";
let modalSelectedStatus = "신청";
let editSelectedStatus = "선정";
let editingId = null;
let activeColorPickerKey = null;
let deadlineAlertDays = Number(localStorage.getItem('onlyview_deadlineAlertDays')) || 7;
let platformList = JSON.parse(localStorage.getItem('onlyview_platforms')) || ['개별', '리뷰노트', '레뷰', '디너의여왕'];

const presetPalette = ['#6B7280', '#111827', '#E63946', '#F4A261', '#E9C46A', '#059669', '#2563EB', '#4F46E5', '#9333EA', '#D97706', '#EC4899', '#0891B2'];

const savedColors = JSON.parse(localStorage.getItem('onlyview_statusColors') || '{}');
const customStatusColors = {
  apply: savedColors.apply || '#6B7280',
  select: savedColors.select || '#111827',
  visit: savedColors.visit || '#F4A261',
  unsubmitted: savedColors.unsubmitted || '#E63946',
  submit: savedColors.submit || '#059669',
  delivery: savedColors.delivery || '#2563EB',
  fee: savedColors.fee || '#9333EA'
};

let currentChartMode = localStorage.getItem('onlyview_chartMode') || 'default';
const chartStylePalettes = {
  default: { highlight: '#335A90', main: '#658EC6', pending: '#B2C6E2', isOutline: false },
  light:   { highlight: '#2F5FA8', main: '#5C8FD6', pending: '#A9C6EC', isOutline: false },
  outline: { highlightBorder: '#3F73C2', highlightFill: '#9DB8E3', mainBorder: '#4F82CC', mainFill: '#C7D7EE', pendingBorder: '#4F82CC', pendingFill: '#E3EAF5', isOutline: true },
  themePreset: {
    slate: { highlight: '#335A90', main: '#658EC6', pending: '#B2C6E2' },
    terracotta: { highlight: '#994A20', main: '#CF7B4F', pending: '#E7BCA5' },
    forest: { highlight: '#2A583F', main: '#5B8B71', pending: '#ACC4B7' },
    violet: { highlight: '#58419A', main: '#8C75CF', pending: '#C6BAE7' },
    graphite: { highlight: '#272B31', main: '#595C61', pending: '#ACADB0' },
    brick: { highlight: '#8D3029', main: '#C3635B', pending: '#E1B0AC' },
    mustard: { highlight: '#7D5705', main: '#B28A36', pending: '#D9C598' },
    indigo: { highlight: '#2C3B89', main: '#606EBB', pending: '#AFB6DD' },
    emerald: { highlight: '#0F6554', main: '#429887', pending: '#A0CCC3' },
    ink: { highlight: '#20242B', main: '#53575D', pending: '#AAABAF' }
  }
};
const themeColors = {
  slate: { primary: '#3B6FB6', hover: '#2C5796', text: '#3B6FB6', light: '#E5EBF4', bg: '#F4F6F9', sidebarBg: '#E5EBF4', sidebarText: '#333333' },
  terracotta: { primary: '#C2571F', hover: '#A04313', text: '#C2571F', light: '#F4E7DD', bg: '#F8F3EE', sidebarBg: '#F4E7DD', sidebarText: '#333333' },
  forest: { primary: '#2E6B4A', hover: '#225238', text: '#2E6B4A', light: '#E1EAE4', bg: '#F4F7F5', sidebarBg: '#E1EAE4', sidebarText: '#333333' },
  violet: { primary: '#6D4FC2', hover: '#553BA3', text: '#6D4FC2', light: '#EAE6F6', bg: '#F3F3F4', sidebarBg: '#EAE6F6', sidebarText: '#333333' },
  graphite: { primary: '#2B2F36', hover: '#191C21', text: '#2B2F36', light: '#E3E3E5', bg: '#F3F3F4', sidebarBg: '#E3E3E5', sidebarText: '#333333' },
  brick: { primary: '#B2382F', hover: '#8E2820', text: '#B2382F', light: '#F3E4E1', bg: '#F9F3F1', sidebarBg: '#F3E4E1', sidebarText: '#333333' },
  mustard: { primary: '#9C6A00', hover: '#7A5200', text: '#9C6A00', light: '#F2EBD7', bg: '#FAF6EA', sidebarBg: '#F2EBD7', sidebarText: '#333333' },
  indigo: { primary: '#3446A8', hover: '#253488', text: '#3446A8', light: '#E8EBF8', bg: '#F2F4FA', sidebarBg: '#1D2760', sidebarText: '#E6E8EE' },
  emerald: { primary: '#0E7C66', hover: '#095E4D', text: '#0E7C66', light: '#DCEDE9', bg: '#EEF7F4', sidebarBg: '#DCEDE9', sidebarText: '#333333' },
  ink: { primary: '#232830', hover: '#14171C', text: '#232830', light: '#E2E5EB', bg: '#F4F4F6', sidebarBg: '#16181D', sidebarText: '#E6E8EE' }
};

function formatCleanDate(dateVal) {
  if (!dateVal) return "";
  let str = String(dateVal).trim().replace(/[/.]/g, '-');
  if (!str) return "";
  const parts = str.split("-");
  if (parts.length === 3) {
    let year = parts[0].replace(/[^0-9]/g, '');
    let month = parts[1].replace(/[^0-9]/g, '').padStart(2, '0');
    let day = parts[2].replace(/[^0-9]/g, '').padStart(2, '0');
    if (year.length === 2) year = "20" + year;
    else if (year.length > 4) year = year.slice(0, 4);
    if (year.length === 4 && month && day) return year + "-" + month + "-" + day;
  }
  return str;
}

function formatShortDate(dateVal) {
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

function isItemOverdue(item) {
  const rawSt = item.status;
  if (rawSt === '제출' || rawSt === '완료' || rawSt === '미제출') return false;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  if (item.deadlineDate) {
    const cleanDDate = formatCleanDate(item.deadlineDate);
    if (cleanDDate) {
      const dDateObj = new Date(cleanDDate); dDateObj.setHours(0, 0, 0, 0);
      if (!isNaN(dDateObj.getTime()) && dDateObj < now) return true;
    }
  }
  if (item.visitDate) {
    const cleanVDate = formatCleanDate(item.visitDate);
    if (cleanVDate) {
      const vDateObj = new Date(cleanVDate); vDateObj.setHours(0, 0, 0, 0);
      if (!isNaN(vDateObj.getTime()) && vDateObj < now) return true;
    }
  }
  return false;
}

function getEffectiveStatus(item) { return item.status || '신청'; }
function displayStatusName(status) { return status || '신청'; }

window.getStatusColor = function(status) {
  const colors = customStatusColors || {};
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
};

function formatCurrencyInput(value) {
  if (!value && value !== 0) return "";
  const num = String(value).replace(/[^0-9]/g, '');
  return num ? Number(num).toLocaleString() : "";
}
function parseCurrencyValue(value) {
  if (!value) return 0;
  return Number(String(value).replace(/[^0-9]/g, '')) || 0;
}
function formatRevenueDisplay(num) {
  const val = Number(num) || 0;
  if (val < 0) return "-" + Math.abs(val).toLocaleString() + "원";
  return val.toLocaleString() + "원";
}
function formatPhoneNumber(value) {
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

function applyStatusCSSColors() {
  document.documentElement.style.setProperty('--color-status-apply', customStatusColors.apply);
  document.documentElement.style.setProperty('--color-status-select', customStatusColors.select);
  document.documentElement.style.setProperty('--color-status-visit', customStatusColors.visit || '#F4A261');
  document.documentElement.style.setProperty('--color-status-unsubmitted', customStatusColors.unsubmitted || '#E63946');
  document.documentElement.style.setProperty('--color-status-submit', customStatusColors.submit);
  document.documentElement.style.setProperty('--color-status-delivery', customStatusColors.delivery);
  document.documentElement.style.setProperty('--color-status-fee', customStatusColors.fee);
}

function applyThemeCSS(colorKey) {
  const theme = themeColors[colorKey] || themeColors.slate;
  document.documentElement.style.setProperty('--primary', theme.primary);
  document.documentElement.style.setProperty('--primary-hover', theme.hover);
  document.documentElement.style.setProperty('--primary-text', theme.text);
  document.documentElement.style.setProperty('--primary-light', theme.light);
  document.documentElement.style.setProperty('--main-bg', theme.bg);
  document.documentElement.style.setProperty('--sidebar-bg', theme.sidebarBg);
  document.documentElement.style.setProperty('--sidebar-text', theme.sidebarText);
  document.documentElement.style.setProperty('--sidebar-text-muted', theme.sidebarText === '#E6E8EE' ? '#9CA3AF' : '#6B7280');
}

applyStatusCSSColors();
applyThemeCSS(localStorage.getItem('onlyview_theme') || 'slate');

function getSortIndicatorHtml(colName) {
  if (sortColumn !== colName || sortColumn === 'none') return '<span class="text-gray-300 ml-0.5">↕</span>';
  return sortAsc ? '<span class="text-theme font-bold ml-0.5">▲</span>' : '<span class="text-theme font-bold ml-0.5">▼</span>';
}

function updateChartModeButtonsUI() {
  ['default', 'light', 'outline', 'theme'].forEach(m => {
    const btn = document.getElementById("btnChartMode_" + m);
    if (btn) {
      if (m === currentChartMode) btn.className = "py-1.5 px-3 rounded-lg font-bold border border-theme bg-theme text-white text-[11px] transition-colors shadow-sm";
      else btn.className = "py-1.5 px-3 rounded-lg font-normal border border-gray-200 bg-white text-gray-600 text-[11px] hover:border-gray-300 transition-colors";
    }
  });
}

function getActiveChartColors() {
  const activeThemeKey = localStorage.getItem('onlyview_theme') || 'slate';
  if (currentChartMode === 'theme') {
    const preset = chartStylePalettes.themePreset[activeThemeKey] || chartStylePalettes.themePreset.slate;
    return { highlight: preset.highlight, main: preset.main, pending: preset.pending, isOutline: false };
  }
  if (currentChartMode === 'outline') return chartStylePalettes.outline;
  if (currentChartMode === 'light') return chartStylePalettes.light;
  return chartStylePalettes.default;
}

function applySidebarUI() {
  const sidebar = document.getElementById('mainSidebar');
  const toggleBtn = document.getElementById('sidebarToggleBtn');
  const textElems = document.querySelectorAll('.sidebar-text-label');
  if (isSidebarCollapsed) {
    sidebar?.classList.remove('lg:w-64'); sidebar?.classList.add('lg:w-20');
    if (toggleBtn) toggleBtn.innerText = '▶';
    textElems.forEach(el => el.classList.add('hidden'));
  } else {
    sidebar?.classList.remove('lg:w-20'); sidebar?.classList.add('lg:w-64');
    if (toggleBtn) toggleBtn.innerText = '◀';
    textElems.forEach(el => el.classList.remove('hidden'));
  }
}

function renderStatusColorPickers() {
  const keys = ['apply', 'select', 'visit', 'unsubmitted', 'submit', 'delivery', 'fee'];
  keys.forEach(k => {
    const badge = document.getElementById("picker_badge_" + k);
    if (badge) badge.style.backgroundColor = customStatusColors[k] || '#6B7280';
  });
}

function updateShareSettlementUI() {
  const label = document.getElementById('shareSettlementLabel');
  const btn = document.getElementById('toggleShareSettlementBtn');
  const circle = document.getElementById('toggleShareSettlementCircle');

  if (isSettlementShared) {
    if (label) { label.innerText = "공개"; label.className = "text-[11px] md:text-xs font-bold text-theme"; }
    if (btn) { btn.className = "w-10 md:w-11 h-5 md:h-6 bg-theme rounded-full p-1 transition-colors relative flex items-center"; }
    if (circle) { circle.className = "w-3.5 h-3.5 md:w-4 md:h-4 bg-white rounded-full transition-transform transform translate-x-5 shadow-sm"; }
  } else {
    if (label) { label.innerText = "비공개"; label.className = "text-[11px] md:text-xs font-bold text-gray-500"; }
    if (btn) { btn.className = "w-10 md:w-11 h-5 md:h-6 bg-gray-300 rounded-full p-1 transition-colors relative flex items-center"; }
    if (circle) { circle.className = "w-3.5 h-3.5 md:w-4 md:h-4 bg-white rounded-full transition-transform transform translate-x-0 shadow-sm"; }
  }
}

function renderSettingsUI() {
  const codeElem = document.getElementById('myShareCode');
  if (codeElem) codeElem.innerText = myCustomCode || "------";
  updateShareSettlementUI();
  renderStatusColorPickers();
  updateChartModeButtonsUI();
  updateDeadlineButtons();
}

async function loadTargetUserSettings(uid) {
  if (!uid || !db) return;
  try {
    const userDocRef = doc(db, "users", uid);
    const userSnap = await getDoc(userDocRef);
    if (userSnap.exists()) {
      const data = userSnap.data();
      if (data.statusColors) {
        Object.assign(customStatusColors, data.statusColors);
        applyStatusCSSColors();
        renderStatusColorPickers();
      }
      if (data.theme) {
        applyThemeCSS(data.theme);
        localStorage.setItem('onlyview_theme', data.theme);
      }
      if (data.chartMode) {
        currentChartMode = data.chartMode;
        localStorage.setItem('onlyview_chartMode', data.chartMode);
        updateChartModeButtonsUI();
      }
      if (data.deadlineAlertDays) {
        deadlineAlertDays = data.deadlineAlertDays;
        updateDeadlineButtons();
      }
    }
  } catch (err) { console.error("설정 동기화 실패:", err); }
}

window.loginWithGoogle = async function() {
  try {
    if (!auth || !provider) return alert("Firebase 초기화 중입니다. 잠시 후 시도해 주세요.");
    await signInWithPopup(auth, provider);
  } catch (err) {
    if (err.code !== 'auth/popup-closed-by-user') alert("로그인 오류: " + err.message);
  }
};

window.logout = function() {
  if (auth) signOut(auth);
  window.location.reload();
};

window.toggleShareSettlement = async function() {
  if (isReadOnly) return alert("읽기 전용 모드에서는 변경할 수 없습니다.");
  isSettlementShared = !isSettlementShared;
  localStorage.setItem('onlyview_shareSettlement', isSettlementShared.toString());
  updateShareSettlementUI();

  if (currentUser && !isReadOnly) {
    try {
      await setDoc(doc(db, "users", currentUser.uid), { shareSettlement: isSettlementShared }, { merge: true });
      if (myCustomCode) {
        await setDoc(doc(db, "userCodes", myCustomCode), { shareSettlement: isSettlementShared }, { merge: true });
      }
    } catch(e) {}
  }
};

window.enterWithInviteCode = async function() {
  const codeInput = document.getElementById('loginInviteCodeInput')?.value.trim();
  if (!codeInput) return alert("초대 코드를 입력해주세요.");
  try {
    if (!db) return alert("데이터베이스 연결 실패");
    const codeSnap = await getDoc(doc(db, "userCodes", codeInput));
    if (!codeSnap.exists()) return alert("유효하지 않은 초대 코드입니다.");
    
    const codeData = codeSnap.data();
    targetUserId = codeData.uid;
    isSettlementShared = codeData.shareSettlement === true;
    isReadOnly = true;

    await loadTargetUserSettings(targetUserId);

    document.getElementById('authSection')?.classList.add('hidden');
    const appSec = document.getElementById('appSection');
    appSec?.classList.remove('hidden');
    appSec?.classList.add('flex', 'lg:flex');
    const userNameElem = document.getElementById('userName');
    if (userNameElem) userNameElem.innerText = "초대 접속자 (" + codeInput + ")";
    
    updateFormVisibility();
    await loadCampaigns();
    window.switchTab('dashboard', false);
  } catch (err) { alert("코드 조회 실패: " + err.message); }
};

window.updateCustomStatusColor = async function(key, val) {
  if (isReadOnly) return;
  customStatusColors[key] = val;
  localStorage.setItem('onlyview_statusColors', JSON.stringify(customStatusColors));
  applyStatusCSSColors();
  renderStatusColorPickers();
  window.filterAndRender();
  window.renderDashboardView();
  document.getElementById('colorPickerModal')?.classList.add('hidden');
  if (currentUser && !isReadOnly) {
    try { await setDoc(doc(db, "users", currentUser.uid), { statusColors: customStatusColors }, { merge: true }); } catch(e) {}
  }
};

window.openColorPickerModal = function(key, label) {
  if (isReadOnly) return alert("읽기 전용 모드입니다.");
  activeColorPickerKey = key;
  const titleElem = document.getElementById('colorModalTitle');
  if (titleElem) titleElem.innerText = label + " 상태 글자 색상 선택";
  const grid = document.getElementById('colorPaletteGrid');
  if (grid) {
    grid.innerHTML = '';
    const currentColor = customStatusColors[key] || '#6B7280';
    presetPalette.forEach(hex => {
      const isSelected = currentColor.toLowerCase() === hex.toLowerCase();
      const btn = document.createElement('button'); btn.type = 'button';
      btn.className = "w-8 h-8 md:w-10 md:h-10 rounded-full border-2 transition-transform hover:scale-110 shadow-sm flex items-center justify-center " + (isSelected ? "border-gray-900 ring-2 ring-gray-400 scale-110" : "border-white");
      btn.style.backgroundColor = hex;
      if (isSelected) btn.innerHTML = '<span class="text-white text-xs font-bold">✓</span>';
      btn.onclick = () => window.updateCustomStatusColor(key, hex);
      grid.appendChild(btn);
    });
  }
  document.getElementById('colorPickerModal')?.classList.remove('hidden');
};

window.setChartMode = async function(modeKey) {
  if (isReadOnly) return alert("읽기 전용 모드입니다.");
  currentChartMode = modeKey;
  localStorage.setItem('onlyview_chartMode', modeKey);
  updateChartModeButtonsUI();
  window.renderSettlementView();
  if (currentUser && !isReadOnly) {
    try { await setDoc(doc(db, "users", currentUser.uid), { chartMode: modeKey }, { merge: true }); } catch(e) {}
  }
};

window.changeTheme = async function(colorKey) {
  if (isReadOnly) return alert("읽기 전용 모드입니다.");
  applyThemeCSS(colorKey);
  localStorage.setItem('onlyview_theme', colorKey);
  if (currentChartMode === 'theme') window.renderSettlementView();
  if (currentUser && !isReadOnly) {
    try { await setDoc(doc(db, "users", currentUser.uid), { theme: colorKey }, { merge: true }); } catch(e) {}
  }
};

window.toggleSidebar = function() {
  isSidebarCollapsed = !isSidebarCollapsed;
  localStorage.setItem('onlyview_sidebarCollapsed', isSidebarCollapsed.toString());
  applySidebarUI();
};

window.toggleFilterArea = function() {
  isFilterExpanded = !isFilterExpanded;
  const filterBox = document.getElementById('filterBoxContainer');
  const toggleBtn = document.getElementById('filterToggleBtn');
  if (filterBox && toggleBtn) {
    if (isFilterExpanded) { filterBox.classList.remove('hidden'); filterBox.classList.add('flex'); toggleBtn.innerText = '▲ 필터'; } 
    else { filterBox.classList.add('hidden'); filterBox.classList.remove('flex'); toggleBtn.innerText = '▼ 필터'; }
  }
};

window.setSettlementSubTab = function(type) {
  settlementSubTab = type;
  const btnReport = document.getElementById('settlementSubTabReport');
  const btnDetail = document.getElementById('settlementSubTabDetail');
  const panelReport = document.getElementById('settlementPanelReport');
  const panelDetail = document.getElementById('settlementPanelDetail');
  if (type === 'report') {
    if (btnReport) btnReport.className = "tab-fixed-btn py-1.5 px-2 md:px-3 rounded-lg font-bold text-[10px] md:text-xs bg-theme text-white shadow-sm transition-colors";
    if (btnDetail) btnDetail.className = "tab-fixed-btn py-1.5 px-2 md:px-3 rounded-lg font-normal text-[10px] md:text-xs bg-[#EAECEF] hover:bg-gray-200 text-gray-700 transition-colors";
    panelReport?.classList.remove('hidden'); panelDetail?.classList.add('hidden');
  } else {
    if (btnReport) btnReport.className = "tab-fixed-btn py-1.5 px-2 md:px-3 rounded-lg font-normal text-[10px] md:text-xs bg-[#EAECEF] hover:bg-gray-200 text-gray-700 transition-colors";
    if (btnDetail) btnDetail.className = "tab-fixed-btn py-1.5 px-2 md:px-3 rounded-lg font-bold text-[10px] md:text-xs bg-theme text-white shadow-sm transition-colors";
    panelDetail?.classList.remove('hidden'); panelReport?.classList.add('hidden');
  }
  window.renderSettlementView();
};

window.toggleMonthlyDetailsCard = function(month) {
  monthlyDetailsCollapseState[month] = !monthlyDetailsCollapseState[month];
  localStorage.setItem("onlyview_monthlyDetailCollapsed_" + month, monthlyDetailsCollapseState[month]);
  window.renderSettlementView(); 
};

window.switchTab = function(tabName, pushState = true) {
  if (isReadOnly && (tabName === 'form' || tabName === 'settings')) {
    if (!pushState) { window.switchTab('dashboard', false); return; }
    return alert("읽기 전용 모드에서는 접근할 수 없습니다.");
  }
  if (isReadOnly && !isSettlementShared && tabName === 'settlement') {
    if (!pushState) { window.switchTab('dashboard', false); return; }
    return alert("상대방이 정산 내역을 비공개로 설정했습니다.");
  }

  ['sectionDashboard', 'sectionList', 'sectionForm', 'sectionSettlement', 'sectionSettings'].forEach(s => document.getElementById(s)?.classList.add('hidden'));
  
  document.querySelectorAll('.nav-item').forEach(btn => { btn.classList.remove('bg-theme', 'text-white'); btn.classList.add('text-sidebar', 'hover:bg-black/5'); });
  const activeBtn = document.getElementById("nav-" + tabName);
  if (activeBtn) { activeBtn.classList.remove('text-sidebar', 'hover:bg-black/5'); activeBtn.classList.add('bg-theme', 'text-white'); }
  
  document.querySelectorAll('.bottom-nav-item').forEach(btn => {
    btn.classList.remove('text-theme');
    btn.classList.add('text-gray-400');
  });
  const activeBottomBtn = document.getElementById("bottom-nav-" + tabName);
  if (activeBottomBtn) {
    activeBottomBtn.classList.remove('text-gray-400');
    activeBottomBtn.classList.add('text-theme');
  }
  
  if (pushState && window.location.hash !== "#" + tabName) {
    history.pushState({ tab: tabName }, '', "#" + tabName);
  }
  
  ['dayModal', 'editModal', 'colorPickerModal', 'dashRegisterModal'].forEach(id => document.getElementById(id)?.classList.add('hidden'));

  if (tabName === 'dashboard') {
    currentCalDate = new Date();
    document.getElementById('sectionDashboard')?.classList.remove('hidden');
    window.renderDashboardView();
  }
  else if (tabName === 'list') {
    isBatchEditing = false; newBatchRows = []; listSubTab = 'ongoing'; isFilterExpanded = false; 
    const filterBox = document.getElementById('filterBoxContainer'); const toggleBtn = document.getElementById('filterToggleBtn');
    if (filterBox && toggleBtn) { filterBox.classList.add('hidden'); filterBox.classList.remove('flex'); toggleBtn.innerText = '▼ 필터'; }
    document.getElementById('searchInput').value = ''; document.getElementById('filterStatus').value = 'ALL'; document.getElementById('filterYear').value = 'ALL'; document.getElementById('filterMonth').value = 'ALL';
    document.getElementById('sectionList')?.classList.remove('hidden');
    window.filterAndRender();
  }
  else if (tabName === 'form') {
    document.getElementById('campaignForm')?.reset();
    window.setStatusBtn('신청'); window.selectPlatformChip('개별');
    document.getElementById('sectionForm')?.classList.remove('hidden');
    document.getElementById('applyDate').value = new Date().toISOString().slice(0, 10);
  }
  else if (tabName === 'settlement') {
    document.getElementById('sectionSettlement')?.classList.remove('hidden');
    window.setSettlementSubTab('report');
  }
  else if (tabName === 'settings') {
    document.getElementById('sectionSettings')?.classList.remove('hidden');
    renderSettingsUI();
  }
};

window.addEventListener('popstate', () => {
  const hash = (window.location.hash || '').replace('#', '');
  const validTabs = ['dashboard', 'form', 'list', 'settlement', 'settings'];
  if (validTabs.includes(hash)) {
    window.switchTab(hash, false);
  } else {
    window.switchTab('dashboard', false);
  }
});

window.setStatusBtn = function(status) {
  selectedStatus = status;
  ['신청', '선정', '배송', '원고료'].forEach(s => {
    const btn = document.getElementById("btnStatus_" + s);
    if (btn) {
      if (s === status) btn.className = "py-1.5 px-3.5 rounded-lg font-bold border border-theme bg-theme text-white text-[11px] transition-colors shadow-sm";
      else btn.className = "py-1.5 px-3.5 rounded-lg font-normal border border-gray-200 bg-white text-gray-600 text-[11px] hover:border-gray-300 transition-colors";
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
  modalSelectedStatus = status;
  ['신청', '선정', '배송', '원고료'].forEach(s => {
    const btn = document.getElementById("btnModalStatus_" + s);
    if (btn) {
      if (s === status) btn.className = "py-1.5 px-3.5 rounded-lg font-bold border border-theme bg-theme text-white text-[11px]";
      else btn.className = "py-1.5 px-3.5 rounded-lg font-normal border border-gray-200 bg-white text-gray-600 text-[11px]";
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
  editSelectedStatus = status;
  ['신청', '선정', '방문', '미제출', '제출', '배송', '원고료'].forEach(s => {
    const btn = document.getElementById("btnEditStatus_" + s);
    if (btn) {
      if (s === status) btn.className = "py-1.5 px-3 rounded-lg font-bold border border-theme bg-theme text-white text-[11px]";
      else btn.className = "py-1.5 px-3 rounded-lg font-normal border border-gray-200 bg-white text-gray-600 text-[11px]";
    }
  });
};

window.selectPlatformChip = function(name) {
  const platformElem = document.getElementById('platformName');
  if (platformElem) platformElem.value = name;
  renderPlatformChips();
};

window.addCustomPlatform = function() {
  if (isReadOnly) return alert("읽기 전용 모드입니다.");
  const newSite = prompt("추가할 사이트명을 입력하세요:");
  if (!newSite || !newSite.trim()) return;
  const trimmed = newSite.trim();
  if (!platformList.includes(trimmed)) {
    platformList.push(trimmed); localStorage.setItem('onlyview_platforms', JSON.stringify(platformList)); window.selectPlatformChip(trimmed);
  }
};

function renderPlatformChips() {
  const container = document.getElementById('platformChipsContainer');
  const modalContainer = document.getElementById('modalPlatformChipsContainer');
  const renderChips = (targetElem, isModal = false) => {
    if (!targetElem) return;
    targetElem.innerHTML = '';
    const inputId = isModal ? 'modalPlatformName' : 'platformName';
    const currentVal = document.getElementById(inputId)?.value || platformList[0];
    platformList.forEach(name => {
      const btn = document.createElement('button'); btn.type = 'button'; btn.innerText = name;
      if (name === currentVal) btn.className = "platform-chip px-3 py-1.5 rounded-lg border border-theme bg-theme-light text-theme font-bold text-[11px] transition-colors";
      else btn.className = "platform-chip px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 font-normal text-[11px] hover:border-gray-300 transition-colors";
      btn.onclick = () => { const platformElem = document.getElementById(inputId); if (platformElem) platformElem.value = name; renderPlatformChips(); };
      targetElem.appendChild(btn);
    });
    const addBtn = document.createElement('button'); addBtn.type = 'button'; addBtn.innerText = '+ 추가';
    addBtn.className = "px-3 py-1.5 rounded-lg border border-dashed border-gray-300 bg-gray-50 text-gray-500 font-normal text-[11px] hover:bg-gray-100 transition-colors";
    addBtn.onclick = window.addCustomPlatform;
    targetElem.appendChild(addBtn);
  };
  renderChips(container, false); renderChips(modalContainer, true);
}

window.setDeadlineDays = async function(days) {
  if (isReadOnly) return alert("읽기 전용 모드에서는 설정을 변경할 수 없습니다.");
  deadlineAlertDays = Number(days);
  localStorage.setItem('onlyview_deadlineAlertDays', deadlineAlertDays.toString());
  window.renderDashboardView(); 
  updateDeadlineButtons();
  if (currentUser && !isReadOnly) {
    try { await setDoc(doc(db, "users", currentUser.uid), { deadlineAlertDays: deadlineAlertDays }, { merge: true }); } catch(e) {}
  }
};

function updateDeadlineButtons() {
  [7, 10, 14].forEach(d => {
    const btn = document.getElementById("btnDeadlineDay_" + d);
    if (btn) {
      if (d === deadlineAlertDays) btn.className = "py-1.5 px-3 rounded-lg font-bold border border-theme bg-theme text-white text-[11px] transition-colors shadow-sm";
      else btn.className = "py-1.5 px-3 rounded-lg font-normal border border-gray-200 bg-white text-gray-600 text-[11px] hover:border-gray-300 transition-colors";
    }
  });
}

window.openDashRegisterModal = function() {
  if (isReadOnly) return alert("읽기 전용 모드에서는 체험을 등록할 수 없습니다.");
  document.getElementById('modalCampaignForm')?.reset();
  window.setModalStatusBtn('신청');
  const modalApplyDate = document.getElementById('modalApplyDate');
  if (modalApplyDate) modalApplyDate.value = new Date().toISOString().slice(0, 10);
  renderPlatformChips();
  document.getElementById('dashRegisterModal')?.classList.remove('hidden');
};
window.closeDashRegisterModal = function() { document.getElementById('dashRegisterModal')?.classList.add('hidden'); };

window.handleSort = function(colName) {
  if (sortColumn === colName) sortAsc = !sortAsc;
  else { sortColumn = colName; sortAsc = true; }
  localStorage.setItem('onlyview_sortColumn', sortColumn);
  localStorage.setItem('onlyview_sortAsc', sortAsc.toString());
  window.filterAndRender();
};

window.setListSubTab = function(type) {
  listSubTab = type;
  const btnOngoing = document.getElementById('subTabOngoing'); const btnSubmitted = document.getElementById('subTabSubmitted');
  if (type === 'ongoing') {
    if (btnOngoing) btnOngoing.className = "tab-fixed-btn py-1.5 px-2 md:px-3 rounded-lg font-bold text-[10px] md:text-[11px] bg-theme text-white shadow-sm transition-colors";
    if (btnSubmitted) btnSubmitted.className = "tab-fixed-btn py-1.5 px-2 md:px-3 rounded-lg font-normal text-[10px] md:text-[11px] bg-[#EAECEF] hover:bg-gray-200 text-gray-700 transition-colors";
  } else {
    if (btnOngoing) btnOngoing.className = "tab-fixed-btn py-1.5 px-2 md:px-3 rounded-lg font-normal text-[10px] md:text-[11px] bg-[#EAECEF] hover:bg-gray-200 text-gray-700 transition-colors";
    if (btnSubmitted) btnSubmitted.className = "tab-fixed-btn py-1.5 px-2 md:px-3 rounded-lg font-bold text-[10px] md:text-[11px] bg-theme text-white shadow-sm transition-colors";
  }
  window.filterAndRender();
};

window.toggleBatchEdit = function() {
  if (isReadOnly) return alert("읽기 전용 모드에서는 수정할 수 없습니다.");
  isBatchEditing = !isBatchEditing; newBatchRows = []; window.filterAndRender();
};
window.addNewBatchRow = function() { newBatchRows.push({ tempId: Date.now() + Math.random(), showTimeInput: false }); window.filterAndRender(); };
window.removeNewBatchRow = function(index) { newBatchRows.splice(index, 1); window.filterAndRender(); };
window.toggleNewRowTimeInput = function(idx) {
  const timeContainer = document.getElementById("newTimeContainer_" + idx);
  if (timeContainer) timeContainer.classList.toggle('hidden');
};

window.saveAllBatchEdits = async function() {
  if (isReadOnly || !currentUser) return;
  const promises = [];
  rawCampaignList.forEach(item => {
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
  newBatchRows.forEach((row, idx) => {
    const storeVal = document.getElementById("new_batch_store_" + idx)?.value;
    if (storeVal && storeVal.trim()) {
      const payload = {
        userId: currentUser.uid, storeName: storeVal.trim(),
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
    isBatchEditing = false; newBatchRows = []; await loadCampaigns();
  } catch (err) { alert('일괄 저장 실패: ' + err.message); }
};

window.quickUpdateStatus = async function(id, newStatus) {
  if (isReadOnly) return alert("읽기 전용 모드에서는 변경할 수 없습니다.");
  try {
    await updateDoc(doc(db, "campaigns", id), { status: newStatus });
    const item = rawCampaignList.find(c => c.id === id);
    if (item) item.status = newStatus;
    window.refreshAllViews();
  } catch (err) { alert("상태 변경 실패: " + err.message); }
};

window.deleteCampaign = async function(id) {
  if (isReadOnly) return alert("읽기 전용 모드에서는 삭제할 수 없습니다.");
  if (!confirm("정말 이 체험단 항목을 삭제하시겠습니까?")) return;
  try { await deleteDoc(doc(db, "campaigns", id)); alert("삭제되었습니다."); loadCampaigns(); } catch (err) { alert("삭제 실패: " + err.message); }
};

window.openEditModalFromId = function(id) {
  if (isReadOnly) return alert("읽기 전용 모드에서는 수정할 수 없습니다.");
  const item = rawCampaignList.find(c => c.id === id);
  if (!item) return;
  editingId = id;
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

window.downloadExcel = async function() {
  if (!rawCampaignList || rawCampaignList.length === 0) return alert("내보낼 체험단 데이터가 없습니다.");
  if (typeof ExcelJS === 'undefined') return alert("엑셀 로딩 중입니다.");

  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ONLYVIEW';
    workbook.created = new Date();

    const COLOR_PRIMARY = 'FF3B6FB6';
    const COLOR_LIGHT = 'FFE5EBF4';
    const COLOR_TEXT_DARK = 'FF1F2937';
    const COLOR_WHITE = 'FFFFFFFF';
    const COLOR_BORDER = 'FFD1D5DB';

    const borderStyle = { top: { style: 'thin', color: { argb: COLOR_BORDER } }, left: { style: 'thin', color: { argb: COLOR_BORDER } }, bottom: { style: 'thin', color: { argb: COLOR_BORDER } }, right: { style: 'thin', color: { argb: COLOR_BORDER } } };

    // 1. 대시보드 시트
    const dashSheet = workbook.addWorksheet('대시보드', { views: [{ showGridLines: true }] });
    dashSheet.mergeCells('B2:H2');
    const titleCell = dashSheet.getCell('B2');
    titleCell.value = '온리뷰 (ONLYVIEW) 체험단 정산 & 일정 종합 리포트';
    titleCell.font = { name: '맑은 고딕', size: 15, bold: true, color: { argb: COLOR_PRIMARY } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
    const todayStr = new Date().toLocaleDateString('ko-KR');
    dashSheet.getCell('B3').value = `기준일시: ${todayStr} | 기본 슬레이트 정산 규격`;
    dashSheet.getCell('B3').font = { name: '맑은 고딕', size: 9, color: { argb: 'FF6B7280' } };

    let totalCount = rawCampaignList.length; let completedCount = 0; let totalSponsored = 0; let totalPaid = 0; let totalRevenue = 0;
    const monthlySummary = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, total: 0, done: 0, revenue: 0 }));
    const platformMap = {};
    rawCampaignList.forEach(item => {
      const effSt = getEffectiveStatus(item); const isDone = (effSt === '제출' || effSt === '완료');
      const sp = Number(item.sponsoredAmount || 0); const pd = Number(item.paidAmount || 0); const inputRev = Number(item.revenue || 0);
      const calcRev = pd === 0 ? (sp > 0 ? sp : inputRev) : ((sp - pd) + inputRev);
      if (isDone) {
        completedCount++; totalSponsored += sp; totalPaid += pd; totalRevenue += calcRev;
        const refDate = formatCleanDate(item.visitDate || item.deadlineDate || item.applyDate || '');
        if (refDate && refDate.length >= 7) { const m = parseInt(refDate.slice(5, 7)); if (m >= 1 && m <= 12) { monthlySummary[m - 1].done++; monthlySummary[m - 1].revenue += calcRev; } }
        const pName = item.platformName || '개별'; platformMap[pName] = (platformMap[pName] || 0) + calcRev;
      }
    });

    const kpiCards = [ { col1: 'B', col2: 'B', title: '총 진행 건수', val: `${totalCount}건` }, { col1: 'C', col2: 'D', title: '제출 완료 (정산완료)', val: `${completedCount}건` }, { col1: 'E', col2: 'F', title: '총 제공금액', val: `${totalSponsored.toLocaleString()}원` }, { col1: 'G', col2: 'G', title: '총 결제금액', val: `${totalPaid.toLocaleString()}원` }, { col1: 'H', col2: 'I', title: '순 실수익 (누적)', val: `${totalRevenue.toLocaleString()}원`, isHighlight: true } ];
    kpiCards.forEach(c => {
      dashSheet.mergeCells(`${c.col1}5:${c.col2}5`); dashSheet.mergeCells(`${c.col1}6:${c.col2}6`);
      const hCell = dashSheet.getCell(`${c.col1}5`); const vCell = dashSheet.getCell(`${c.col1}6`);
      hCell.value = c.title; hCell.font = { name: '맑은 고딕', size: 9, bold: true, color: { argb: c.isHighlight ? COLOR_PRIMARY : 'FF4B5563' } }; hCell.alignment = { horizontal: 'center', vertical: 'middle' }; hCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: c.isHighlight ? COLOR_LIGHT : 'FFF3F4F6' } };
      vCell.value = c.val; vCell.font = { name: '맑은 고딕', size: 12, bold: true, color: { argb: c.isHighlight ? COLOR_PRIMARY : COLOR_TEXT_DARK } }; vCell.alignment = { horizontal: 'center', vertical: 'middle' }; vCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: c.isHighlight ? COLOR_LIGHT : 'FFF9FAFB' } };
      [hCell, vCell].forEach(cell => cell.border = borderStyle);
    });

    dashSheet.getCell('B8').value = '1. 월별 정산 및 완료 실적 요약'; dashSheet.getCell('B8').font = { name: '맑은 고딕', size: 11, bold: true, color: { argb: COLOR_TEXT_DARK } };
    const monthHeaders = ['월', '완료 건수', '실수익'];
    ['B', 'C', 'D'].forEach((col, idx) => {
      const cell = dashSheet.getCell(`${col}9`); cell.value = monthHeaders[idx]; cell.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: COLOR_WHITE } }; cell.alignment = { horizontal: 'center', vertical: 'middle' }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_PRIMARY } }; cell.border = borderStyle;
    });
    monthlySummary.forEach((m, idx) => {
      const rowIdx = 10 + idx; const cMonth = dashSheet.getCell(`B${rowIdx}`); const cDone = dashSheet.getCell(`C${rowIdx}`); const cRev = dashSheet.getCell(`D${rowIdx}`);
      cMonth.value = `${m.month}월`; cMonth.alignment = { horizontal: 'center' }; cDone.value = m.done; cDone.numFmt = '#,##0"건"'; cDone.alignment = { horizontal: 'center' }; cRev.value = m.revenue; cRev.numFmt = '#,##0"원"'; cRev.alignment = { horizontal: 'right' };
      [cMonth, cDone, cRev].forEach(c => { c.font = { name: '맑은 고딕', size: 10 }; c.border = borderStyle; });
    });
    const sumRowIdx = 22; dashSheet.getCell(`B${sumRowIdx}`).value = '소계'; dashSheet.getCell(`B${sumRowIdx}`).alignment = { horizontal: 'center' }; dashSheet.getCell(`C${sumRowIdx}`).value = { formula: `SUM(C10:C21)` }; dashSheet.getCell(`C${sumRowIdx}`).numFmt = '#,##0"건"'; dashSheet.getCell(`C${sumRowIdx}`).alignment = { horizontal: 'center' }; dashSheet.getCell(`D${sumRowIdx}`).value = { formula: `SUM(D10:D21)` }; dashSheet.getCell(`D${sumRowIdx}`).numFmt = '#,##0"원"'; dashSheet.getCell(`D${sumRowIdx}`).alignment = { horizontal: 'right' };
    ['B', 'C', 'D'].forEach(col => { const c = dashSheet.getCell(`${col}${sumRowIdx}`); c.font = { name: '맑은 고딕', size: 10, bold: true }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_LIGHT } }; c.border = { top: { style: 'thin' }, bottom: { style: 'double' } }; });

    dashSheet.getCell('F8').value = '2. 주요 플랫폼별 수익 랭킹'; dashSheet.getCell('F8').font = { name: '맑은 고딕', size: 11, bold: true, color: { argb: COLOR_TEXT_DARK } };
    const pHeaders = ['플랫폼명', '총 정산 수익'];
    ['F', 'G'].forEach((col, idx) => {
      const cell = dashSheet.getCell(`${col}9`); cell.value = pHeaders[idx]; cell.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: COLOR_WHITE } }; cell.alignment = { horizontal: 'center', vertical: 'middle' }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_PRIMARY } }; cell.border = borderStyle;
    });
    const sortedPlatforms = Object.entries(platformMap).sort((a, b) => b[1] - a[1]);
    sortedPlatforms.forEach(([name, rev], idx) => {
      const rIdx = 10 + idx; const cName = dashSheet.getCell(`F${rIdx}`); const cRev = dashSheet.getCell(`G${rIdx}`);
      cName.value = name; cName.alignment = { horizontal: 'center' }; cRev.value = rev; cRev.numFmt = '#,##0"원"'; cRev.alignment = { horizontal: 'right' };
      [cName, cRev].forEach(c => { c.font = { name: '맑은 고딕', size: 10 }; c.border = borderStyle; });
    });
    dashSheet.columns = [ { width: 3 }, { width: 12 }, { width: 14 }, { width: 16 }, { width: 4 }, { width: 16 }, { width: 18 }, { width: 16 }, { width: 16 } ];

    // 2. 세부 내역 시트
    const detailSheet = workbook.addWorksheet('정산 세부 내역', { views: [{ showGridLines: true }] });
    detailSheet.mergeCells('B2:H2');
    const dTitle = detailSheet.getCell('B2'); dTitle.value = '월별 정산 세부 내역 (1월 ~ 12월)'; dTitle.font = { name: '맑은 고딕', size: 14, bold: true, color: { argb: COLOR_PRIMARY } }; dTitle.alignment = { vertical: 'middle', horizontal: 'left' }; detailSheet.getRow(2).height = 24;
    detailSheet.getCell('B3').value = `* 완료된(제출) 체험단의 월별 세부 정산 내역입니다.`; detailSheet.getCell('B3').font = { name: '맑은 고딕', size: 9, color: { argb: 'FF6B7280' } }; detailSheet.getRow(3).height = 18;

    let dRowIdx = 5;
    for (let m = 1; m <= 12; m++) {
      const mItems = rawCampaignList.filter(item => {
        const effSt = getEffectiveStatus(item); if (effSt !== '제출' && effSt !== '완료') return false;
        const refDate = formatCleanDate(item.visitDate || item.deadlineDate || item.applyDate || '');
        if (!refDate || refDate.length < 7) return false; return parseInt(refDate.slice(5, 7)) === m;
      }).sort((a, b) => (formatCleanDate(a.visitDate || a.deadlineDate) || '').localeCompare(formatCleanDate(b.visitDate || b.deadlineDate) || ''));

      const mCount = mItems.length; let mTotalRev = 0;
      mItems.forEach(item => { const sp = Number(item.sponsoredAmount || 0); const pd = Number(item.paidAmount || 0); const rev = Number(item.revenue || 0); mTotalRev += pd === 0 ? (sp > 0 ? sp : rev) : ((sp - pd) + rev); });

      detailSheet.mergeCells(`B${dRowIdx}:H${dRowIdx}`);
      const mHeaderCell = detailSheet.getCell(`B${dRowIdx}`);
      mHeaderCell.value = `■ ${m}월 정산 내역  (완료: ${mCount}건 | 실수익 합계: ${mTotalRev.toLocaleString()}원)`; mHeaderCell.font = { name: '맑은 고딕', size: 10.5, bold: true, color: { argb: COLOR_PRIMARY } }; mHeaderCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_LIGHT } }; mHeaderCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }; mHeaderCell.border = { top: { style: 'thin', color: { argb: COLOR_PRIMARY } }, bottom: { style: 'thin', color: { argb: COLOR_PRIMARY } } }; detailSheet.getRow(dRowIdx).height = 24; dRowIdx++;

      const mCols = ['매장명 (업체명)', '사이트', '방문일', '마감일', '제공금액', '결제금액', '실수익'];
      mCols.forEach((colName, cIdx) => {
        const colLetter = String.fromCharCode(66 + cIdx); const c = detailSheet.getCell(`${colLetter}${dRowIdx}`);
        c.value = colName; c.font = { name: '맑은 고딕', size: 9.5, bold: true, color: { argb: 'FF374151' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } }; c.alignment = { vertical: 'middle', horizontal: 'center' }; c.border = borderStyle;
      });
      detailSheet.getRow(dRowIdx).height = 20; dRowIdx++;

      if (mCount === 0) {
        detailSheet.mergeCells(`B${dRowIdx}:H${dRowIdx}`);
        const emptyCell = detailSheet.getCell(`B${dRowIdx}`); emptyCell.value = '해당 월에 완료된 정산 내역이 없습니다.'; emptyCell.font = { name: '맑은 고딕', size: 9, color: { argb: 'FF9CA3AF' } }; emptyCell.alignment = { vertical: 'middle', horizontal: 'center' }; emptyCell.border = borderStyle; detailSheet.getRow(dRowIdx).height = 20; dRowIdx++;
      } else {
        const startItemRow = dRowIdx;
        mItems.forEach(item => {
          const sp = Number(item.sponsoredAmount || 0); const pd = Number(item.paidAmount || 0); const inputRev = Number(item.revenue || 0);
          const calcRev = pd === 0 ? (sp > 0 ? sp : inputRev) : ((sp - pd) + inputRev);
          const r = detailSheet.getRow(dRowIdx); r.height = 19;
          r.getCell(2).value = item.storeName || ''; r.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };
          r.getCell(3).value = item.platformName || '개별'; r.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };
          r.getCell(4).value = formatCleanDate(item.visitDate) || '-'; r.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };
          r.getCell(5).value = formatCleanDate(item.deadlineDate) || '-'; r.getCell(5).alignment = { vertical: 'middle', horizontal: 'center' };
          r.getCell(6).value = sp; r.getCell(6).numFmt = '#,##0"원"'; r.getCell(6).alignment = { vertical: 'middle', horizontal: 'right' };
          r.getCell(7).value = pd; r.getCell(7).numFmt = '#,##0"원"'; r.getCell(7).alignment = { vertical: 'middle', horizontal: 'right' };
          r.getCell(8).value = calcRev; r.getCell(8).numFmt = '#,##0"원"'; r.getCell(8).alignment = { vertical: 'middle', horizontal: 'right' };
          for (let c = 2; c <= 8; c++) { r.getCell(c).font = { name: '맑은 고딕', size: 9.5 }; r.getCell(c).border = borderStyle; }
          dRowIdx++;
        });
        const subTotalRow = detailSheet.getRow(dRowIdx); subTotalRow.height = 21; detailSheet.mergeCells(`B${dRowIdx}:E${dRowIdx}`);
        subTotalRow.getCell(2).value = `${m}월 소계`; subTotalRow.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
        subTotalRow.getCell(6).value = { formula: `SUM(F${startItemRow}:F${dRowIdx - 1})` }; subTotalRow.getCell(6).numFmt = '#,##0"원"'; subTotalRow.getCell(6).alignment = { vertical: 'middle', horizontal: 'right' };
        subTotalRow.getCell(7).value = { formula: `SUM(G${startItemRow}:G${dRowIdx - 1})` }; subTotalRow.getCell(7).numFmt = '#,##0"원"'; subTotalRow.getCell(7).alignment = { vertical: 'middle', horizontal: 'right' };
        subTotalRow.getCell(8).value = { formula: `SUM(H${startItemRow}:H${dRowIdx - 1})` }; subTotalRow.getCell(8).numFmt = '#,##0"원"'; subTotalRow.getCell(8).alignment = { vertical: 'middle', horizontal: 'right' };
        for (let c = 2; c <= 8; c++) { subTotalRow.getCell(c).font = { name: '맑은 고딕', size: 9.5, bold: true, color: { argb: 'FF1F2937' } }; subTotalRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }; subTotalRow.getCell(c).border = { top: { style: 'thin' }, bottom: { style: 'thin' } }; }
        dRowIdx++;
      }
      dRowIdx++;
    }
    detailSheet.columns = [ { width: 3 }, { width: 26 }, { width: 14 }, { width: 13 }, { width: 13 }, { width: 15 }, { width: 15 }, { width: 16 } ];

    const buildCampaignSheet = (sheetName, items) => {
      const sheet = workbook.addWorksheet(sheetName, { views: [{ showGridLines: true }] });
      const headers = [ { header: '매장명 (업체명)', key: 'storeName', width: 24, align: 'left' }, { header: '진행 상태', key: 'status', width: 12, align: 'center' }, { header: '사이트', key: 'platformName', width: 14, align: 'center' }, { header: '방문예정일', key: 'visitDate', width: 14, align: 'center' }, { header: '포스팅마감일', key: 'deadlineDate', width: 14, align: 'center' }, { header: '제공금액', key: 'sponsoredAmount', width: 15, align: 'right' }, { header: '결제금액', key: 'paidAmount', width: 15, align: 'right' }, { header: '실수익', key: 'revenue', width: 16, align: 'right' }, { header: '비고 / 메모', key: 'memo', width: 26, align: 'left' } ];
      sheet.getRow(1).height = 12; const headerRow = sheet.getRow(2); headerRow.height = 26;
      headers.forEach((h, idx) => { const cell = headerRow.getCell(idx + 1); cell.value = h.header; cell.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: COLOR_WHITE } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_PRIMARY } }; cell.alignment = { vertical: 'middle', horizontal: 'center' }; cell.border = borderStyle; });
      let currentRowIdx = 3;
      items.forEach(item => {
        const row = sheet.getRow(currentRowIdx); row.height = 20;
        const effSt = getEffectiveStatus(item); const sp = Number(item.sponsoredAmount || 0); const pd = Number(item.paidAmount || 0); const inputRev = Number(item.revenue || 0); const calcRev = pd === 0 ? (sp > 0 ? sp : inputRev) : ((sp - pd) + inputRev);
        row.getCell(1).value = item.storeName || ''; row.getCell(2).value = displayStatusName(effSt); row.getCell(3).value = item.platformName || '개별'; row.getCell(4).value = formatCleanDate(item.visitDate) || '-'; row.getCell(5).value = formatCleanDate(item.deadlineDate) || '-'; row.getCell(6).value = sp; row.getCell(7).value = pd; row.getCell(8).value = calcRev; row.getCell(9).value = item.memo || '';
        headers.forEach((h, idx) => { const cell = row.getCell(idx + 1); cell.font = { name: '맑은 고딕', size: 9.5 }; cell.alignment = { vertical: 'middle', horizontal: h.align }; cell.border = borderStyle; if (['sponsoredAmount', 'paidAmount', 'revenue'].includes(h.key)) { cell.numFmt = '#,##0"원"'; } });
        currentRowIdx++;
      });
      if (items.length > 0) {
        const totalRow = sheet.getRow(currentRowIdx); totalRow.height = 24;
        totalRow.getCell(1).value = '합계'; totalRow.getCell(6).value = { formula: `SUM(F3:F${currentRowIdx - 1})` }; totalRow.getCell(7).value = { formula: `SUM(G3:G${currentRowIdx - 1})` }; totalRow.getCell(8).value = { formula: `SUM(H3:H${currentRowIdx - 1})` };
        headers.forEach((h, idx) => { const cell = totalRow.getCell(idx + 1); cell.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: COLOR_TEXT_DARK } }; cell.alignment = { vertical: 'middle', horizontal: h.align }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_LIGHT } }; cell.border = { top: { style: 'thin' }, bottom: { style: 'double' } }; if (['sponsoredAmount', 'paidAmount', 'revenue'].includes(h.key)) { cell.numFmt = '#,##0"원"'; } });
      }
      sheet.columns = headers.map(h => ({ width: h.width }));
    };

    const ongoingItems = rawCampaignList.filter(item => { const st = getEffectiveStatus(item); return st !== '제출' && st !== '완료'; });
    buildCampaignSheet('진행중 체험단', ongoingItems);
    const completedItems = rawCampaignList.filter(item => { const st = getEffectiveStatus(item); return st === '제출' || st === '완료'; });
    buildCampaignSheet('완료 체험단', completedItems);

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    const yyyymmdd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    a.download = `온리뷰_체험단_정산_리포트_${yyyymmdd}.xlsx`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); window.URL.revokeObjectURL(url);
  } catch (err) { alert("엑셀 다운로드 중 오류가 발생했습니다: " + err.message); }
};

// ======================== 화면 렌더링 ========================
window.filterAndRender = function() {
  const tableBody = document.getElementById('campaignTableBody');
  const cardList = document.getElementById('campaignCardList');
  const searchText = document.getElementById('searchInput')?.value.toLowerCase() || '';
  const filterStatus = document.getElementById('filterStatus')?.value || 'ALL';
  const filterYear = document.getElementById('filterYear')?.value || 'ALL';
  const filterMonth = document.getElementById('filterMonth')?.value || 'ALL';
  const batchBtn = document.getElementById('batchEditBtn');
  const saveBatchBtn = document.getElementById('saveBatchBtn');

  if (cardList) {
    cardList.className = 'block sm:hidden space-y-2.5 pb-12';
  }

  if (batchBtn && saveBatchBtn) {
    if (isBatchEditing) {
      batchBtn.className = "px-3 md:px-4 py-1.5 rounded-lg font-bold text-[11px] md:text-xs bg-rose-500 text-white shadow-sm transition-colors mr-1";
      batchBtn.innerText = "취소";
      saveBatchBtn.className = "px-3 md:px-4 py-1.5 rounded-lg font-bold text-[11px] md:text-xs bg-emerald-600 text-white shadow-sm transition-colors hover:bg-emerald-700 mr-1";
      saveBatchBtn.classList.remove('hidden');
    } else {
      batchBtn.className = "tab-fixed-btn py-1.5 px-3 rounded-lg font-bold text-[11px] md:text-xs bg-theme text-white shadow-sm transition-colors hover:bg-theme-hover mr-1";
      batchBtn.innerText = "수정";
      saveBatchBtn.classList.add('hidden');
    }
  }

  ['storeName', 'status', 'platformName', 'visitDate', 'deadlineDate', 'sponsoredAmount', 'paidAmount', 'revenue'].forEach(col => {
    const elem = document.getElementById("sortInd_" + col);
    if (elem) elem.innerHTML = getSortIndicatorHtml(col);
  });

  let filteredList = rawCampaignList.filter(item => {
    const effSt = getEffectiveStatus(item);
    const isCompleted = (effSt === '제출' || effSt === '완료');
    if (listSubTab === 'ongoing' && isCompleted) return false;
    if (listSubTab === 'submitted' && !isCompleted) return false;
    const matchesName = (item.storeName || '').toLowerCase().includes(searchText) || (item.platformName || '').toLowerCase().includes(searchText);
    const matchesStatus = (filterStatus === 'ALL') || (effSt === filterStatus);
    const refDate = formatCleanDate(item.visitDate || item.deadlineDate || item.applyDate || '');
    let matchesYear = true; let matchesMonth = true;
    if (refDate && refDate.length >= 7) {
      if (filterYear !== 'ALL' && refDate.slice(0, 4) !== filterYear) matchesYear = false;
      if (filterMonth !== 'ALL' && String(Number(refDate.slice(5, 7))) !== filterMonth) matchesMonth = false;
    } else if (filterYear !== 'ALL' || filterMonth !== 'ALL') { matchesYear = false; }
    return matchesName && matchesStatus && matchesYear && matchesMonth;
  });

  if (sortColumn !== 'none') {
    filteredList.sort((a, b) => {
      let valA = a[sortColumn] || ''; let valB = b[sortColumn] || '';
      if (['sponsoredAmount', 'paidAmount', 'revenue'].includes(sortColumn)) { valA = Number(valA) || 0; valB = Number(valB) || 0; }
      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
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
    const overdueBadgeHtml = overdue ? '<span class="text-rose-500 font-bold text-[10px] md:text-[11px] ml-1.5 shrink-0">[상태확인]</span>' : '';

    if (isBatchEditing) {
      const cleanVisitDate = formatCleanDate(item.visitDate);
      const cleanDeadlineDate = formatCleanDate(item.deadlineDate);
      const row = document.createElement('tr');
      row.className = 'bg-amber-50/60 border-b border-amber-200 text-[11px] text-gray-900';
      row.innerHTML = '<td class="py-1 px-2.5 text-left"><div class="flex items-center"><input type="text" id="batch_store_' + item.id + '" value="' + (item.storeName || '') + '" class="w-full border p-1 rounded-lg outline-none text-[11px] bg-white font-normal">' + overdueBadgeHtml + '</div></td>'
        + '<td class="py-1 px-1 text-center"><select id="batch_status_' + item.id + '" onchange="this.style.color = window.getStatusColor(this.value);" style="color: ' + window.getStatusColor(item.status) + '; font-weight: 600;" class="select-center w-full border border-gray-300 py-1 px-0.5 rounded-lg outline-none text-[11px] bg-white text-center focus:border-theme"><option value="신청" ' + (item.status === '신청' ? 'selected' : '') + '>신청</option><option value="선정" ' + (item.status === '선정' ? 'selected' : '') + '>선정</option><option value="방문" ' + (item.status === '방문' ? 'selected' : '') + '>방문</option><option value="미제출" ' + (item.status === '미제출' ? 'selected' : '') + '>미제출</option><option value="제출" ' + (item.status === '제출' ? 'selected' : '') + '>제출</option><option value="배송" ' + (item.status === '배송' ? 'selected' : '') + '>배송</option><option value="원고료" ' + (item.status === '원고료' ? 'selected' : '') + '>원고료</option></select></td>'
        + '<td class="py-1 px-2 text-center"><input type="text" id="batch_platform_' + item.id + '" value="' + (item.platformName || '') + '" class="w-full border p-1 rounded-lg outline-none text-[11px] bg-white font-normal text-center"></td>'
        + '<td class="py-1 px-2 text-center"><div class="flex items-center gap-1 justify-center"><input type="date" min="2000-01-01" max="2099-12-31" id="batch_visitDate_' + item.id + '" value="' + cleanVisitDate + '" class="border p-1 rounded-lg outline-none text-[10px] md:text-[11px] bg-white font-normal w-[85px]"><button type="button" onclick="window.openEditModalFromId(\'' + item.id + '\')" class="p-1 text-gray-500 hover:text-theme transition-colors">🕒</button></div><input type="hidden" id="batch_visitTime_' + item.id + '" value="' + (item.visitTime || '') + '"></td>'
        + '<td class="py-1 px-2 text-center"><input type="date" min="2000-01-01" max="2099-12-31" id="batch_deadlineDate_' + item.id + '" value="' + cleanDeadlineDate + '" class="w-full border border-gray-300 p-1 rounded-lg outline-none text-[10px] md:text-[11px] bg-white font-normal"></td>'
        + '<td class="py-1 px-2 text-center"><input type="text" id="batch_sponsored_' + item.id + '" value="' + formatCurrencyInput(item.sponsoredAmount || 0) + '" class="w-full border p-1 rounded-lg outline-none text-[11px] bg-white font-normal text-right"></td>'
        + '<td class="py-1 px-2 text-center"><input type="text" id="batch_paid_' + item.id + '" value="' + formatCurrencyInput(item.paidAmount || 0) + '" class="w-full border p-1 rounded-lg outline-none text-[11px] bg-white font-normal text-right"></td>'
        + '<td class="py-1 px-2 text-right font-normal text-gray-700">' + formatRevenueDisplay(calcRevenue) + '</td>'
        + '<td class="py-1 px-2 text-center"><button onclick="window.deleteCampaign(\'' + item.id + '\')" class="text-[11px] bg-rose-500 text-white hover:bg-rose-600 px-2 py-1 rounded-lg font-bold shadow-sm">삭제</button></td>';
      tableBody?.appendChild(row);
    } else {
      let noteBadge = isCompleted ? '<span class="text-gray-900 font-normal">정산완료</span>' : '<span class="text-gray-400 font-normal">미정산</span>';
      const statusSelectHtml = '<select onchange="window.quickUpdateStatus(\'' + item.id + '\', this.value); this.style.color = window.getStatusColor(this.value);" style="color: ' + window.getStatusColor(effSt) + '; font-weight: 600;" class="select-center border-0 bg-transparent text-[11px] outline-none cursor-pointer text-center">'
        + '<option value="신청" ' + (effSt === '신청' ? 'selected' : '') + ' class="text-gray-800 font-normal">신청</option><option value="선정" ' + (effSt === '선정' ? 'selected' : '') + ' class="text-gray-800 font-normal">선정</option><option value="방문" ' + (effSt === '방문' ? 'selected' : '') + ' class="text-gray-800 font-normal">방문</option><option value="미제출" ' + (effSt === '미제출' ? 'selected' : '') + ' class="text-gray-800 font-normal">미제출</option><option value="제출" ' + (effSt === '제출' ? 'selected' : '') + ' class="text-gray-800 font-normal">제출</option><option value="배송" ' + (effSt === '배송' ? 'selected' : '') + ' class="text-gray-800 font-normal">배송</option><option value="원고료" ' + (effSt === '원고료' ? 'selected' : '') + ' class="text-gray-800 font-normal">원고료</option></select>';

      const row = document.createElement('tr');
      row.className = 'border-b border-gray-100 hover:bg-theme-light text-[11px] text-gray-900 font-normal';
      row.innerHTML = '<td class="py-2.5 px-2.5 font-normal text-gray-900 cursor-pointer hover:underline hover:text-theme text-[11px] md:text-xs text-left truncate" onclick="window.openDetailItemModal(\'' + item.id + '\')"><div class="flex items-center"><span class="truncate">' + item.storeName + '</span>' + overdueBadgeHtml + '</div></td>'
        + '<td class="py-2.5 px-1 text-[11px] text-center">' + statusSelectHtml + '</td>'
        + '<td class="py-2.5 px-2 text-gray-900 text-[11px] font-normal text-center">' + (item.platformName || '-') + '</td>'
        + '<td class="py-2.5 px-2 text-gray-900 text-[11px] font-normal text-center">' + formatShortDate(item.visitDate) + '</td>'
        + '<td class="py-2.5 px-2 text-gray-900 text-[11px] font-normal text-center">' + formatShortDate(item.deadlineDate) + '</td>'
        + '<td class="py-2.5 px-2 text-gray-900 text-[11px] font-normal text-right">' + sponsored.toLocaleString() + '원</td>'
        + '<td class="py-2.5 px-2 text-gray-900 text-[11px] font-normal text-right">' + paid.toLocaleString() + '원</td>'
        + '<td class="py-2.5 px-2 text-[11px] font-normal text-right">' + revDisplayHtml + '</td>'
        + '<td class="py-2.5 px-2 text-[11px] font-normal text-center">' + noteBadge + '</td>';
      tableBody?.appendChild(row);
    }

    const card = document.createElement('div');
    card.className = 'bg-white p-3.5 rounded-2xl shadow-sm border border-gray-100 space-y-1.5 text-xs text-gray-900 cursor-pointer hover:border-theme transition-colors';
    card.onclick = () => window.openDetailItemModal(item.id);
    card.innerHTML = '<div class="flex justify-between items-center"><div class="flex items-center gap-1 min-w-0 pr-2"><h3 class="font-bold text-xs text-gray-900 truncate">' + item.storeName + '</h3>' + overdueBadgeHtml + '</div><span class="text-xs font-bold text-gray-900 shrink-0">' + sponsored.toLocaleString() + '원</span></div>'
      + '<div class="flex justify-between items-center text-[10px] text-gray-500 font-normal"><div class="flex items-center gap-1.5"><span style="color: ' + window.getStatusColor(effSt) + ';" class="font-bold">' + displayStatusName(effSt) + '</span><span>방문: ' + formatShortDate(item.visitDate) + '</span><span>마감: ' + formatShortDate(item.deadlineDate) + '</span></div><span class="text-gray-300">›</span></div>';
    cardList?.appendChild(card);
  });

  if (isBatchEditing) {
    newBatchRows.forEach((row, idx) => {
      const newRow = document.createElement('tr');
      newRow.className = 'bg-amber-50/60 border-b border-amber-200 text-[11px] text-gray-900';
      const defaultStatus = listSubTab === 'submitted' ? '제출' : '선정';
      newRow.innerHTML = '<td class="py-1 px-2 text-left"><input type="text" id="new_batch_store_' + idx + '" placeholder="+ 매장명 입력" class="w-full border border-gray-300 p-1 rounded-lg outline-none text-[11px] bg-white font-normal focus:border-theme"></td>'
        + '<td class="py-1 px-1 text-center"><select id="new_batch_status_' + idx + '" style="color: ' + window.getStatusColor(defaultStatus) + '; font-weight: 600;" class="select-center w-full border border-gray-300 py-1 px-0.5 rounded-lg outline-none text-[11px] bg-white text-center focus:border-theme"><option value="신청" ' + (defaultStatus === '신청' ? 'selected' : '') + '>신청</option><option value="선정" ' + (defaultStatus === '선정' ? 'selected' : '') + '>선정</option><option value="방문" ' + (defaultStatus === '방문' ? 'selected' : '') + '>방문</option><option value="미제출" ' + (defaultStatus === '미제출' ? 'selected' : '') + '>미제출</option><option value="제출" ' + (defaultStatus === '제출' ? 'selected' : '') + '>제출</option><option value="배송" ' + (defaultStatus === '배송' ? 'selected' : '') + '>배송</option><option value="원고료" ' + (defaultStatus === '원고료' ? 'selected' : '') + '>원고료</option></select></td>'
        + '<td class="py-1 px-2 text-center"><input type="text" id="new_batch_platform_' + idx + '" placeholder="사이트" value="개별" class="w-full border border-gray-300 p-1 rounded-lg outline-none text-[11px] bg-white font-normal text-center focus:border-theme"></td>'
        + '<td class="py-1 px-2 text-center"><div class="flex items-center gap-1 justify-center"><input type="date" min="2000-01-01" max="2099-12-31" id="new_batch_visitDate_' + idx + '" class="border border-gray-300 p-1 rounded-lg outline-none text-[10px] bg-white font-normal w-20 md:w-24 focus:border-theme"><button type="button" onclick="window.toggleNewRowTimeInput(' + idx + ')" class="p-1 text-gray-500 hover:text-gray-800 transition-colors">🕒</button></div><div id="newTimeContainer_' + idx + '" class="hidden mt-1"><input type="time" id="new_batch_visitTime_' + idx + '" class="border border-gray-300 p-1 rounded-lg outline-none text-[10px] bg-white font-normal w-16 focus:border-theme"></div></td>'
        + '<td class="py-1 px-2 text-center"><input type="date" min="2000-01-01" max="2099-12-31" id="new_batch_deadlineDate_' + idx + '" class="w-full border border-gray-300 p-1 rounded-lg outline-none text-[10px] bg-white font-normal focus:border-theme"></td>'
        + '<td class="py-1 px-2 text-center"><input type="text" id="new_batch_sponsored_' + idx + '" placeholder="0" class="w-full border border-gray-300 p-1 rounded-lg outline-none text-[11px] bg-white font-normal text-right focus:border-theme"></td>'
        + '<td class="py-1 px-2 text-center"><input type="text" id="new_batch_paid_' + idx + '" placeholder="0" class="w-full border border-gray-300 p-1 rounded-lg outline-none text-[11px] bg-white font-normal text-right focus:border-theme"></td>'
        + '<td class="py-1 px-2 text-right font-normal text-gray-400">자동계산</td>'
        + '<td class="py-1 px-2 text-center"><button onclick="window.removeNewBatchRow(' + idx + ')" class="text-[11px] bg-gray-400 text-white hover:bg-gray-500 px-2 py-1 rounded-lg font-bold shadow-sm">취소</button></td>';
      tableBody?.appendChild(newRow);
    });
    const addBtnRow = document.createElement('tr');
    addBtnRow.innerHTML = '<td colspan="9" class="p-3 text-center bg-gray-50/80"><button onclick="window.addNewBatchRow()" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] md:text-xs rounded-xl shadow-sm transition-colors">+ 새 체험 추가</button></td>';
    tableBody?.appendChild(addBtnRow);
  }

  if (filteredList.length === 0 && !isBatchEditing && tableBody) {
    tableBody.innerHTML = '<tr><td colspan="9"><div class="p-6 text-center text-gray-400 text-[11px] font-normal">조건에 해당하는 체험단이 없습니다.</div></td></tr>';
    if (cardList) cardList.innerHTML = '<div class="p-6 text-center text-gray-400 text-[11px] font-normal">조건에 해당하는 체험단이 없습니다.</div>';
  }
};

window.renderCalendar = function(year, month) {
  const calGrid = document.getElementById('calendarGrid');
  if (!calGrid) return;
  calGrid.innerHTML = '';
  const firstDay = new Date(year, month - 1, 1).getDay();
  const lastDate = new Date(year, month, 0).getDate();
  const days = ['일', '월', '화', '수', '목', '금', '토'];

  days.forEach((d, idx) => {
    const dh = document.createElement('div');
    dh.className = "text-center text-[10px] md:text-[11px] font-bold pb-1.5 " + (idx === 0 ? 'text-rose-500' : idx === 6 ? 'text-blue-500' : 'text-gray-500');
    dh.innerText = d;
    calGrid.appendChild(dh);
  });

  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement('div');
    empty.className = 'bg-gray-50/40 rounded-xl min-h-[64px] sm:min-h-[85px] w-full';
    calGrid.appendChild(empty);
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  for (let date = 1; date <= lastDate; date++) {
    const dateStr = year + "-" + String(month).padStart(2, '0') + "-" + String(date).padStart(2, '0');
    const dayCell = document.createElement('div');
    dayCell.className = "bg-white p-1 md:p-1.5 rounded-xl border border-gray-100 min-h-[64px] sm:min-h-[85px] w-full flex flex-col justify-start cursor-pointer hover:border-theme transition-colors " + (dateStr === todayStr ? 'ring-2 ring-theme' : '');
    
    const visitMatches = rawCampaignList.filter(c => formatCleanDate(c.visitDate) === dateStr);
    const deadlineMatches = rawCampaignList.filter(c => formatCleanDate(c.deadlineDate) === dateStr && c.status !== '신청');

    let badgeHtml = '';
    if (visitMatches.length > 0) {
      badgeHtml += `<div class="text-[9px] sm:text-[10px] md:text-[11px] text-emerald-600 font-bold text-left whitespace-nowrap leading-tight mt-0.5">
        🟢 <span class="hidden sm:inline">방문 </span>${visitMatches.length}건
      </div>`;
    }
    if (deadlineMatches.length > 0) {
      badgeHtml += `<div class="text-[9px] sm:text-[10px] md:text-[11px] text-rose-500 font-bold text-left whitespace-nowrap leading-tight mt-0.5">
        🔴 <span class="hidden sm:inline">마감 </span>${deadlineMatches.length}건
      </div>`;
    }

    dayCell.innerHTML = `<div class="text-[9px] sm:text-[10px] md:text-[11px] font-bold text-gray-500 pl-0.5 mb-0.5 text-left">${date}</div>`
      + `<div class="space-y-0.5 w-full flex flex-col pl-0.5">${badgeHtml}</div>`;

    const allMatched = rawCampaignList.filter(c => formatCleanDate(c.visitDate) === dateStr || (formatCleanDate(c.deadlineDate) === dateStr && c.status !== '신청'));
    dayCell.onclick = () => window.openDayModal(dateStr, allMatched);
    calGrid.appendChild(dayCell);
  }
};

window.renderDashboardView = function() {
  const year = currentCalDate.getFullYear();
  const month = currentCalDate.getMonth() + 1;
  const monthPrefix = year + "-" + String(month).padStart(2, '0');
  
  const titleElem = document.getElementById('dashMonthTitle');
  if (titleElem) titleElem.innerText = year + "년 " + month + "월";

  let cntSelect = 0, cntVisitWait = 0, cntVisitPlan = 0, cntSubmitWait = 0, cntSubmitDone = 0;
  const now = new Date(); now.setHours(0, 0, 0, 0);

  rawCampaignList.forEach(item => {
    const st = getEffectiveStatus(item);
    const overdue = isItemOverdue(item);
    if (st === '제출' || st === '완료') {
      const refDate = formatCleanDate(item.visitDate || item.deadlineDate || item.applyDate || '');
      if (refDate && refDate.startsWith(monthPrefix)) cntSubmitDone++;
      return;
    }
    cntSelect++;
    if (overdue || st === '미제출') cntSubmitWait++;
    if ((st === '선정' || st === '방문') && !item.visitDate) cntVisitWait++;
    if ((st === '선정' || st === '방문') && item.visitDate) {
      const vDateObj = new Date(formatCleanDate(item.visitDate)); vDateObj.setHours(0, 0, 0, 0);
      if (vDateObj >= now) cntVisitPlan++;
    }
  });

  const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
  setTxt('cntSelect', cntSelect + '건'); setTxt('cntVisitWait', cntVisitWait + '건');
  setTxt('cntVisitPlan', cntVisitPlan + '건'); setTxt('cntSubmitWait', cntSubmitWait + '건'); setTxt('cntSubmitDone', cntSubmitDone + '건');

  window.renderCalendar(year, month);
  renderUpcomingDeadlines();
  renderAllScheduledVisits();
};

window.renderSettlementView = function() {
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

    rawCampaignList.forEach(item => {
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
        compareContainer.innerHTML = '<div class="flex items-center gap-2"><span class="text-[11px] text-gray-400 font-normal shrink-0">전년 대비 증가</span><span class="text-[11px] text-gray-400 font-normal">비교 데이터 없음</span></div>';
      } else {
        const rate = prevDoneAmount === 0 ? 100 : ((diffAmount / prevDoneAmount) * 100).toFixed(1);
        let diffStr = diffAmount >= 0 ? "+" + diffAmount.toLocaleString() + "원" : diffAmount.toLocaleString() + "원";
        let rateStr = diffAmount >= 0 ? "+" + rate + "%" : rate + "%";
        let badgeClass = diffAmount >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700';
        compareContainer.innerHTML = '<div class="flex items-center gap-2"><span class="text-[11px] text-gray-400 font-normal shrink-0">전년 대비 증가</span><span class="font-normal text-gray-900 text-sm md:text-base">' + diffStr + '</span><span class="px-2 py-0.5 rounded-full text-[10px] md:text-[11px] font-normal ' + badgeClass + '">' + rateStr + '</span></div>';
      }
    }

    const ctxYearly = document.getElementById('yearlyDonutChart')?.getContext('2d');
    if (ctxYearly) {
      if (yearlyChartInstance) yearlyChartInstance.destroy();
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
      yearlyChartInstance = new Chart(ctxYearly, {
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
      if (monthlyChartInstance) monthlyChartInstance.destroy();
      monthlyChartInstance = new Chart(ctxMonthly, {
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
      if (monthlyAnalysisChartInstance) monthlyAnalysisChartInstance.destroy();
      monthlyAnalysisChartInstance = new Chart(ctxMonthlyAnalysis, {
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
        const isCollapsed = monthlyDetailsCollapseState[m] === true;
        const totalMCount = list.length; const totalMRevenue = list.reduce((sum, item) => sum + item.revenueAmount, 0);

        const cardDiv = document.createElement('div');
        cardDiv.className = "bg-white pt-2.5 px-4 pb-3 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between overflow-hidden transition-colors min-h-[48px]";
        let html = '<div onclick="window.toggleMonthlyDetailsCard(' + m + ')" class="flex justify-between items-center h-[36px] pb-1.5 border-b border-gray-100 cursor-pointer select-none">'
          + '<span class="text-[13px] md:text-xs font-bold text-gray-800">' + m + '월</span><div class="flex items-center gap-2">'
          + (isCollapsed ? '<span class="text-[11px] md:text-xs text-gray-900 font-normal">' + totalMCount + '건 · ' + totalMRevenue.toLocaleString() + '원</span>' : '')
          + '<span class="text-[11px] md:text-xs text-gray-400 font-bold">' + (isCollapsed ? '▼' : '▲') + '</span></div></div>';

        if (!isCollapsed) {
          html += '<div class="flex-1 flex flex-col justify-between min-h-[200px] mt-2.5"><div class="flex-1 overflow-y-auto widget-scroll max-h-[200px] my-1 pr-1 space-y-1.5">';
          if (list.length === 0) { html += '<div class="text-center text-gray-300 font-normal py-16 text-[11px]">이 달의 완료된 체험이 없습니다.</div>'; } 
          else {
            html += '<div class="flex items-center justify-between font-normal text-gray-400 text-[10px] mb-1"><span class="w-1/2 text-left">매장명</span><span class="w-1/4 text-right">제공금액</span><span class="w-1/4 text-right">결제금액</span></div>';
            list.forEach(item => {
              html += '<div class="flex items-center justify-between text-[11px] py-1 border-b border-dashed border-gray-50"><span class="w-1/2 font-normal text-gray-800 truncate" title="' + item.storeName + '">' + item.storeName + '</span><span class="w-1/4 text-right font-normal text-gray-500">' + item.sponsoredAmount.toLocaleString() + '원</span><span class="w-1/4 text-right font-normal text-gray-400">' + (item.paidAmount > 0 ? item.paidAmount.toLocaleString() + '원' : '0원') + '</span></div>';
            });
          }
          html += '</div><div class="mt-2.5 p-2 bg-gray-50/80 rounded-xl flex justify-between items-center border border-gray-100/60 shrink-0 px-3 text-[11px] md:text-xs"><span class="text-[10px] font-normal text-gray-400">소계 <b class="text-gray-900 text-[11px] md:text-xs font-normal ml-1">' + totalMCount + '건</b></span><span class="text-[10px] font-normal text-gray-400">실수익 <b class="text-gray-900 text-[11px] md:text-xs font-normal ml-1">' + totalMRevenue.toLocaleString() + '원</b></span></div></div>';
        }
        cardDiv.innerHTML = html;
        monthlyDetailsGrid.appendChild(cardDiv);
      }
    }
  } catch (err) { console.error(err); }
};

function renderUpcomingDeadlines() {
  const container = document.getElementById('upcomingList');
  if (!container) return;
  container.innerHTML = '';
  const today = new Date(); today.setHours(0,0,0,0);
  let deadlineList = rawCampaignList.filter(c => {
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
  }).filter(c => c.diffDays <= deadlineAlertDays).sort((a, b) => a.diffDays - b.diffDays);

  if (deadlineList.length === 0) {
    container.innerHTML = '<div class="text-[11px] md:text-xs text-gray-400 py-4 text-center font-normal">마감 임박 (' + deadlineAlertDays + '일 이내) 일정이 없습니다.</div>';
    return;
  }
  deadlineList.forEach(item => {
    const card = document.createElement('div');
    card.className = 'p-2.5 bg-white rounded-xl border border-gray-100 flex items-center justify-between text-[11px] md:text-xs cursor-pointer hover:border-theme transition-colors shadow-sm';
    card.onclick = () => window.openDetailItemModal(item.id);
    let dText = item.diffDays < 0 ? "지연 (D+" + Math.abs(item.diffDays) + ")" : (item.diffDays === 0 ? '오늘 마감' : "D-" + item.diffDays);
    card.innerHTML = '<div><span class="font-normal text-gray-900">' + item.storeName + '</span><span class="text-[10px] md:text-[11px] text-gray-400 ml-1.5 font-normal">(' + formatShortDate(item.deadlineDate) + ')</span></div><span class="px-2 py-0.5 rounded-lg text-[9px] md:text-[10px] bg-rose-500 text-white font-normal">' + dText + '</span>';
    container.appendChild(card);
  });
}

function renderAllScheduledVisits() {
  const visitContainer = document.getElementById('scheduledVisitList');
  const unscheduledContainer = document.getElementById('unscheduledVisitList');
  if (!visitContainer || !unscheduledContainer) return;
  visitContainer.innerHTML = ''; unscheduledContainer.innerHTML = '';
  const now = new Date(); now.setHours(0, 0, 0, 0);

  const scheduledItems = rawCampaignList.filter(c => {
    const effSt = getEffectiveStatus(c);
    if (!c.visitDate || effSt === '제출' || effSt === '완료') return false;
    const vDateObj = new Date(formatCleanDate(c.visitDate)); vDateObj.setHours(0, 0, 0, 0);
    return vDateObj >= now;
  }).sort((a, b) => (formatCleanDate(a.visitDate) + " " + (a.visitTime || '00:00')).localeCompare(formatCleanDate(b.visitDate) + " " + (b.visitTime || '00:00')));

  if (scheduledItems.length === 0) visitContainer.innerHTML = '<div class="text-[11px] md:text-xs text-gray-400 py-4 text-center font-normal">예정된 방문 일정이 없습니다.</div>';
  else {
    scheduledItems.forEach(item => {
      const div = document.createElement('div');
      div.className = 'p-2.5 bg-white rounded-xl border border-gray-100 space-y-0.5 text-[11px] md:text-xs cursor-pointer hover:border-theme transition-colors shadow-sm';
      div.onclick = () => window.openDetailItemModal(item.id);
      const dateFormatted = formatShortDate(item.visitDate) + (item.visitTime ? " (" + item.visitTime + ")" : '');
      div.innerHTML = '<div class="flex justify-between items-center text-gray-600 font-normal"><span>' + dateFormatted + '</span>' + (item.companions ? '<span class="text-[10px] md:text-[11px] text-gray-400 font-normal">' + item.companions + '</span>' : '') + '</div><div class="font-normal text-gray-900 text-[13px] md:text-sm truncate">' + item.storeName + '</div>';
      visitContainer.appendChild(div);
    });
  }

  const unscheduledItems = rawCampaignList.filter(c => (getEffectiveStatus(c) === '선정' || getEffectiveStatus(c) === '방문') && !c.visitDate);
  if (unscheduledItems.length === 0) unscheduledContainer.innerHTML = '<div class="text-[11px] md:text-xs text-gray-400 py-4 text-center font-normal">일정 미지정 항목이 없습니다.</div>';
  else {
    unscheduledItems.forEach(item => {
      const div = document.createElement('div');
      div.className = 'p-2.5 bg-white rounded-xl border border-gray-100 flex justify-between items-center text-[11px] md:text-xs cursor-pointer hover:border-theme transition-colors shadow-sm';
      div.onclick = () => window.openDetailItemModal(item.id);
      div.innerHTML = '<div class="truncate mr-2"><span class="font-normal text-gray-900">' + item.storeName + '</span><span class="text-[10px] md:text-[11px] text-gray-400 ml-1 font-normal">(' + (formatShortDate(item.deadlineDate) || '마감미정') + ')</span></div>'
        + (!isReadOnly ? '<button onclick="event.stopPropagation(); window.openEditModalFromId(\'' + item.id + '\')" class="shrink-0 text-[10px] bg-theme bg-theme-hover text-white px-2 py-1 rounded-lg font-normal shadow-sm transition-colors">일정 잡기</button>' : '');
      unscheduledContainer.appendChild(div);
    });
  }
}

window.openCounterListModal = function(counterType, titleName) {
  const year = currentCalDate.getFullYear(); const month = currentCalDate.getMonth() + 1;
  const monthPrefix = year + "-" + String(month).padStart(2, '0');
  const now = new Date(); now.setHours(0, 0, 0, 0);
  let matchedItems = [];

  if (counterType === 'select') matchedItems = rawCampaignList.filter(c => { const st = getEffectiveStatus(c); return st !== '제출' && st !== '완료'; });
  else if (counterType === 'visitWait') matchedItems = rawCampaignList.filter(c => { const st = getEffectiveStatus(c); return (st === '선정' || st === '방문') && !c.visitDate; });
  else if (counterType === 'visitPlan') matchedItems = rawCampaignList.filter(c => {
    const st = getEffectiveStatus(c); if ((st !== '선정' && st !== '방문') || !c.visitDate) return false;
    const vDateObj = new Date(formatCleanDate(c.visitDate)); vDateObj.setHours(0, 0, 0, 0); return vDateObj >= now;
  });
  else if (counterType === 'submitWait') matchedItems = rawCampaignList.filter(c => { const st = getEffectiveStatus(c); if (st === '제출' || st === '완료') return false; return isItemOverdue(c) || st === '미제출'; });
  else if (counterType === 'submitDone') matchedItems = rawCampaignList.filter(c => {
    const st = getEffectiveStatus(c); if (st !== '제출' && st !== '완료') return false;
    const refDate = formatCleanDate(c.visitDate || c.deadlineDate || c.applyDate || ''); return refDate && refDate.startsWith(monthPrefix);
  });

  const modalTitleElem = document.getElementById('modalDateTitle');
  if (modalTitleElem) modalTitleElem.innerText = "[" + titleName + "] 목록 (" + matchedItems.length + "건)";
  const modalList = document.getElementById('modalItemList');
  if (modalList) {
    modalList.innerHTML = '';
    if (matchedItems.length === 0) modalList.innerHTML = '<div class="text-[11px] md:text-xs text-gray-400 py-6 text-center font-normal">' + titleName + ' 항목이 없습니다.</div>';
    else {
      matchedItems.forEach(item => {
        const effSt = getEffectiveStatus(item); const overdue = isItemOverdue(item);
        const div = document.createElement('div');
        div.className = 'p-3 md:p-3.5 bg-white rounded-2xl border border-gray-100 space-y-2 text-[11px] md:text-xs shadow-sm cursor-pointer hover:border-theme transition-colors';
        div.onclick = () => window.openDetailItemModal(item.id);
        div.innerHTML = '<div class="flex justify-between items-center"><div class="flex items-center gap-1.5"><span class="font-normal text-[13px] md:text-sm text-gray-900">' + item.storeName + '</span>' + (overdue ? '<span class="text-rose-500 font-bold text-[10px] md:text-[11px]">[상태확인]</span>' : '') + '</div><span style="color: ' + window.getStatusColor(effSt) + ';" class="font-bold">' + displayStatusName(effSt) + '</span></div><div class="flex justify-between text-gray-500 text-[10px] md:text-[11px] font-normal"><span>사이트: ' + (item.platformName || '개별') + '</span><span>' + (item.visitDate ? "방문일: " + formatShortDate(item.visitDate) : (item.deadlineDate ? "마감일: " + formatShortDate(item.deadlineDate) : '')) + '</span></div>';
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
    if (items.length === 0) modalList.innerHTML = '<div class="text-[11px] md:text-xs text-gray-400 py-6 text-center font-normal">등록된 일정이 없습니다.</div>';
    else {
      const sortedItems = [...items].sort((a, b) => (a.visitTime || '23:59').localeCompare(b.visitTime || '23:59'));
      sortedItems.forEach(item => {
        const overdue = isItemOverdue(item);
        const div = document.createElement('div');
        div.className = 'p-3 md:p-3.5 bg-white rounded-2xl border border-gray-100 space-y-2 text-[11px] md:text-xs shadow-sm cursor-pointer hover:border-theme transition-colors';
        div.onclick = () => window.openDetailItemModal(item.id);
        div.innerHTML = '<div class="flex justify-between items-center"><div class="flex items-center gap-1.5">' + ((formatCleanDate(item.visitDate) === dateStr && item.visitTime) ? '<span class="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded text-[9px] md:text-[10px] font-normal">' + item.visitTime + '</span>' : '') + '<span class="font-normal text-[13px] md:text-sm text-gray-900">' + item.storeName + '</span>' + (overdue ? '<span class="text-rose-500 font-bold text-[10px] md:text-[11px]">[상태확인]</span>' : '') + '</div><span class="text-[10px] md:text-[11px] font-normal text-gray-400">' + (item.platformName || '개별') + '</span></div>' + (item.memo ? '<div class="pt-1.5 text-gray-600 text-[10px] md:text-[11px] font-normal">비고: ' + item.memo + '</div>' : '');
        modalList.appendChild(div);
      });
    }
  }
  document.getElementById('dayModal')?.classList.remove('hidden');
};

window.openDetailItemModal = function(id) {
  const item = rawCampaignList.find(c => c.id === id);
  if (!item) return;
  const effSt = getEffectiveStatus(item);
  document.getElementById('modalDateTitle').innerText = item.storeName + " 상세 정보";
  const modalList = document.getElementById('modalItemList');
  if (modalList) {
    modalList.innerHTML = '<div class="p-3 md:p-4 bg-white rounded-2xl border border-gray-100 space-y-3 text-[11px] md:text-xs shadow-sm"><div class="flex justify-between items-center border-b pb-2"><span class="text-[13px] md:text-sm font-bold text-gray-900">' + item.storeName + '</span><span style="color: ' + window.getStatusColor(effSt) + ';" class="font-bold">' + displayStatusName(effSt) + '</span></div><div class="grid grid-cols-2 gap-2 text-gray-600"><div>체험단 사이트: <span class="font-normal text-gray-800">' + (item.platformName || '-') + '</span></div><div>신청일: <span class="font-normal text-gray-800">' + (formatCleanDate(item.applyDate) || '-') + '</span></div><div>방문일시: <span class="font-normal text-gray-800">' + (item.visitDate ? formatCleanDate(item.visitDate) + (item.visitTime ? " (" + item.visitTime + ")" : '') : '미정') + '</span></div><div>포스팅 마감일: <span class="font-normal text-gray-800">' + (formatCleanDate(item.deadlineDate) || '미정') + '</span></div><div>제공금액: <span class="font-normal text-gray-800">' + Number(item.sponsoredAmount || 0).toLocaleString() + '원</span></div><div>동반인원: <span class="font-normal text-gray-800">' + (item.companions || '없음') + '</span></div><div>결제금액: <span class="font-normal text-gray-800">' + Number(item.paidAmount || 0).toLocaleString() + '원</span></div><div>실수익·원고료: <span class="font-normal text-gray-800">' + formatRevenueDisplay(item.revenue || 0) + '</span></div></div><div class="pt-2 border-t text-gray-600 space-y-1"><div>업체 연락처: <span class="font-normal text-gray-800">' + (item.contact || '없음') + '</span></div><div class="pt-0.5 text-gray-600">메모: <span class="font-normal text-gray-800">' + (item.memo || '없음') + '</span></div></div>' + (!isReadOnly ? '<div class="flex gap-2 pt-2"><button onclick="document.getElementById(\'dayModal\').classList.add(\'hidden\'); window.openEditModalFromId(\'' + item.id + '\');" class="flex-1 bg-theme text-white py-2 md:py-2.5 rounded-xl font-bold">수정하기</button></div>' : '') + '</div>';
  }
  document.getElementById('dayModal')?.classList.remove('hidden');
};

function populateYearFilter() {
  const yearSelect = document.getElementById('filterYear');
  const settlementYearSelect = document.getElementById('settlementYearSelect');
  if (!yearSelect) return;
  const currentYear = new Date().getFullYear();
  const yearsSet = new Set([2025, currentYear]);
  rawCampaignList.forEach(item => {
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

function updateFormVisibility() {
  const readOnlyBadge = document.getElementById('readOnlyBadge');
  const resetBtns = document.querySelectorAll('.reset-data-btn');
  const dashRegisterBtn = document.getElementById('dashRegisterBtn');
  const navForm = document.querySelectorAll('#nav-form, #bottom-nav-form');
  const navSettlement = document.querySelectorAll('#nav-settlement, #bottom-nav-settlement');
  const navSettings = document.querySelectorAll('#nav-settings, #bottom-nav-settings');
  const excelBtns = document.querySelectorAll('.excel-down-btn');

  if (isReadOnly) {
    readOnlyBadge?.classList.remove('hidden');
    resetBtns.forEach(btn => {
      btn.classList.remove('hidden');
      if (btn.id === 'sidebarResetBtn') btn.classList.add('block');
      if (btn.id === 'settingsResetBtn') btn.classList.add('block', 'sm:block');
    });
    dashRegisterBtn?.classList.add('hidden');
    navForm.forEach(n => n.classList.add('hidden'));
    navSettings.forEach(n => n.classList.add('hidden'));
    excelBtns.forEach(btn => btn.classList.add('hidden'));

    if (isSettlementShared) navSettlement.forEach(n => n.classList.remove('hidden'));
    else navSettlement.forEach(n => n.classList.add('hidden'));
  } else {
    readOnlyBadge?.classList.add('hidden');
    resetBtns.forEach(btn => {
      btn.classList.add('hidden');
      if (btn.id === 'sidebarResetBtn') btn.classList.remove('block');
      if (btn.id === 'settingsResetBtn') btn.classList.remove('block', 'sm:block');
    });
    dashRegisterBtn?.classList.remove('hidden');
    navForm.forEach(n => n.classList.remove('hidden'));
    navSettlement.forEach(n => n.classList.remove('hidden'));
    navSettings.forEach(n => n.classList.remove('hidden'));
    excelBtns.forEach(btn => btn.classList.remove('hidden'));
  }
}

async function fetchUserCustomCode() {
  if (!currentUser) return;
  try {
    const userDocRef = doc(db, "users", currentUser.uid);
    const userSnap = await getDoc(userDocRef);
    if (userSnap.exists()) {
      const data = userSnap.data();
      if (data.customCode) {
        myCustomCode = data.customCode;
        localStorage.setItem('onlyview_customCode', myCustomCode);
      }
      if (data.deadlineAlertDays) {
        deadlineAlertDays = data.deadlineAlertDays;
        localStorage.setItem('onlyview_deadlineAlertDays', deadlineAlertDays.toString());
      }
      if (data.shareSettlement !== undefined) {
        isSettlementShared = data.shareSettlement === true;
        localStorage.setItem('onlyview_shareSettlement', isSettlementShared.toString());
      }
      if (data.theme) {
        applyThemeCSS(data.theme);
        localStorage.setItem('onlyview_theme', data.theme);
      }
      if (data.chartMode) {
        currentChartMode = data.chartMode;
        localStorage.setItem('onlyview_chartMode', data.chartMode);
      }
      if (data.statusColors) {
        Object.assign(customStatusColors, data.statusColors);
        localStorage.setItem('onlyview_statusColors', JSON.stringify(customStatusColors));
        applyStatusCSSColors();
      }
    } else {
      myCustomCode = Math.floor(100000 + Math.random() * 900000).toString();
      isSettlementShared = false;
      localStorage.setItem('onlyview_customCode', myCustomCode);
      localStorage.setItem('onlyview_shareSettlement', 'false');
      await setDoc(userDocRef, { 
        customCode: myCustomCode, uid: currentUser.uid, shareSettlement: false,
        theme: localStorage.getItem('onlyview_theme') || 'slate', chartMode: currentChartMode,
        statusColors: customStatusColors, deadlineAlertDays: deadlineAlertDays
      }, { merge: true });
      await setDoc(doc(db, "userCodes", myCustomCode), { uid: currentUser.uid, shareSettlement: false });
    }
    renderSettingsUI();
  } catch (e) { console.error("설정 로드 실패:", e); }
}

window.refreshAllViews = function() {
  window.filterAndRender();
  window.renderDashboardView();
  window.renderSettlementView();
};

async function loadCampaigns() {
  if (!db || !targetUserId) return;
  try {
    let querySnapshot;
    try {
      const q = query(collection(db, "campaigns"), where("userId", "==", targetUserId));
      querySnapshot = await getDocs(q);
    } catch (err) {
      querySnapshot = await getDocs(collection(db, "campaigns"));
    }
    rawCampaignList = [];
    querySnapshot.forEach((docSnap) => {
      const d = docSnap.data();
      if (d.userId === targetUserId || !d.userId) {
        rawCampaignList.push({
          id: docSnap.id, ...d,
          applyDate: formatCleanDate(d.applyDate || ''),
          visitDate: formatCleanDate(d.visitDate || ''),
          deadlineDate: formatCleanDate(d.deadlineDate || '')
        });
      }
    });

    const now = new Date(); const targetYear = now.getFullYear(); const yearGroup = {};
    rawCampaignList.forEach(item => {
      const date = item.visitDate || '';
      if (date && date.length >= 7) {
        const y = date.slice(0, 4); const m = parseInt(date.slice(5, 7));
        if (y === String(targetYear) && m >= 1 && m <= 12) yearGroup[m] = (yearGroup[m] || 0) + 1;
      }
    });
    for (let m = 1; m <= 12; m++) {
      const saved = localStorage.getItem("onlyview_monthlyDetailCollapsed_" + m);
      if (saved === null) monthlyDetailsCollapseState[m] = !(yearGroup[m] && yearGroup[m] > 0);
      else monthlyDetailsCollapseState[m] = (saved === 'true');
    }

    populateYearFilter();
    window.refreshAllViews();
  } catch (e) { console.error("데이터 로드 실패:", e); }
}

onAuthStateChanged(auth, async (user) => {
  const authSec = document.getElementById('authSection');
  const appSec = document.getElementById('appSection');
  if (user) {
    currentUser = user;
    targetUserId = user.uid;
    isReadOnly = false;
    authSec?.classList.add('hidden');
    appSec?.classList.remove('hidden');
    appSec?.classList.add('flex', 'lg:flex');
    const userNameElem = document.getElementById('userName');
    if (userNameElem) userNameElem.innerText = user.displayName || user.email;
    await fetchUserCustomCode();
    updateFormVisibility();
    await loadCampaigns();
    window.switchTab('dashboard', false);
  } else if (!targetUserId) {
    currentUser = null;
    authSec?.classList.remove('hidden');
    appSec?.classList.add('hidden');
    appSec?.classList.remove('flex', 'lg:flex');
  }
});

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById('loginInviteCodeInput')?.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') window.enterWithInviteCode();
  });
  
  document.getElementById('searchInput')?.addEventListener('input', window.filterAndRender);
  document.getElementById('filterStatus')?.addEventListener('change', window.filterAndRender);
  document.getElementById('filterYear')?.addEventListener('change', window.filterAndRender);
  document.getElementById('filterMonth')?.addEventListener('change', window.filterAndRender);
  document.getElementById('settlementYearSelect')?.addEventListener('change', window.renderSettlementView);

  document.getElementById('prevMonthBtn')?.addEventListener('click', () => { currentCalDate.setMonth(currentCalDate.getMonth() - 1); window.renderDashboardView(); });
  document.getElementById('todayMonthBtn')?.addEventListener('click', () => { currentCalDate = new Date(); window.renderDashboardView(); });
  document.getElementById('nextMonthBtn')?.addEventListener('click', () => { currentCalDate.setMonth(currentCalDate.getMonth() + 1); window.renderDashboardView(); });

  document.getElementById('closeModalBtn')?.addEventListener('click', () => document.getElementById('dayModal')?.classList.add('hidden'));
  document.getElementById('closeEditModalBtn')?.addEventListener('click', () => document.getElementById('editModal')?.classList.add('hidden'));
  document.getElementById('closeColorModalBtn')?.addEventListener('click', () => document.getElementById('colorPickerModal')?.classList.add('hidden'));
  document.getElementById('closeDashRegisterModalBtn')?.addEventListener('click', window.closeDashRegisterModal);

  ['sponsoredAmount', 'paidAmount', 'revenue', 'editSponsoredAmount', 'editPaidAmount', 'editRevenue', 'modalSponsoredAmount', 'modalPaidAmount', 'modalRevenue'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', (e) => e.target.value = formatCurrencyInput(e.target.value));
  });
  ['contact', 'editContact', 'modalContact'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', (e) => e.target.value = formatPhoneNumber(e.target.value));
  });

  document.getElementById('campaignForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (isReadOnly || !currentUser) return alert("읽기 전용 모드입니다.");
    const payload = {
      userId: currentUser.uid, storeName: document.getElementById('storeName')?.value || '', platformName: document.getElementById('platformName')?.value || '',
      status: selectedStatus, applyDate: formatCleanDate(document.getElementById('applyDate')?.value || ''), deadlineDate: formatCleanDate(document.getElementById('deadlineDate')?.value || ''),
      visitDate: formatCleanDate(document.getElementById('visitDate')?.value || ''), visitTime: document.getElementById('visitTime')?.value || '',
      companions: document.getElementById('companions')?.value || '', sponsoredAmount: parseCurrencyValue(document.getElementById('sponsoredAmount')?.value),
      paidAmount: parseCurrencyValue(document.getElementById('paidAmount')?.value), revenue: parseCurrencyValue(document.getElementById('revenue')?.value),
      contact: document.getElementById('contact')?.value || '', memo: document.getElementById('memo')?.value || '', createdAt: serverTimestamp()
    };
    try { await addDoc(collection(db, "campaigns"), payload); alert('등록되었습니다!'); document.getElementById('campaignForm')?.reset(); window.setStatusBtn('신청'); window.selectPlatformChip('개별'); loadCampaigns(); } catch (err) { alert(err.message); }
  });

  document.getElementById('modalCampaignForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (isReadOnly || !currentUser) return alert("읽기 전용 모드입니다.");
    const payload = {
      userId: currentUser.uid, storeName: document.getElementById('modalStoreName')?.value || '', platformName: document.getElementById('modalPlatformName')?.value || '개별',
      status: modalSelectedStatus, applyDate: formatCleanDate(document.getElementById('modalApplyDate')?.value || ''), deadlineDate: formatCleanDate(document.getElementById('modalDeadlineDate')?.value || ''),
      visitDate: formatCleanDate(document.getElementById('modalVisitDate')?.value || ''), visitTime: document.getElementById('modalVisitTime')?.value || '',
      companions: document.getElementById('modalCompanions')?.value || '', sponsoredAmount: parseCurrencyValue(document.getElementById('modalSponsoredAmount')?.value),
      paidAmount: parseCurrencyValue(document.getElementById('modalPaidAmount')?.value), revenue: parseCurrencyValue(document.getElementById('modalRevenue')?.value),
      contact: document.getElementById('modalContact')?.value || '', memo: document.getElementById('modalMemo')?.value || '', createdAt: serverTimestamp()
    };
    try { await addDoc(collection(db, "campaigns"), payload); alert('등록되었습니다!'); window.closeDashRegisterModal(); loadCampaigns(); } catch (err) { alert(err.message); }
  });

  document.getElementById('editForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (isReadOnly || !currentUser || !editingId) return;
    const payload = {
      storeName: document.getElementById('editStoreName')?.value || '', platformName: document.getElementById('editPlatformName')?.value || '',
      status: editSelectedStatus, deadlineDate: formatCleanDate(document.getElementById('editDeadlineDate')?.value || ''),
      visitDate: formatCleanDate(document.getElementById('editVisitDate')?.value || ''), visitTime: document.getElementById('editVisitTime')?.value || '',
      companions: document.getElementById('editCompanions')?.value || '', sponsoredAmount: parseCurrencyValue(document.getElementById('editSponsoredAmount')?.value),
      paidAmount: parseCurrencyValue(document.getElementById('editPaidAmount')?.value), revenue: parseCurrencyValue(document.getElementById('editRevenue')?.value),
      contact: document.getElementById('editContact')?.value || '', memo: document.getElementById('editMemo')?.value || '',
    };
    try { await updateDoc(doc(db, "campaigns", editingId), payload); alert('수정되었습니다!'); document.getElementById('editModal')?.classList.add('hidden'); editingId = null; await loadCampaigns(); } catch (err) { alert(err.message); }
  });

  document.getElementById('editCodeBtn')?.addEventListener('click', async () => {
    if (isReadOnly) return alert("읽기 전용 모드입니다.");
    const newCode = prompt("새로운 공유 코드를 입력하세요 (4자리 또는 6자리):", myCustomCode);
    if (!newCode) return;
    const trimmed = newCode.trim();
    if (trimmed.length !== 4 && trimmed.length !== 6) return alert("공유 코드는 4자리 또는 6자리여야 합니다.");
    try {
      const snap = await getDoc(doc(db, "userCodes", trimmed));
      if (snap.exists() && snap.data().uid !== currentUser.uid) return alert("이미 사용 중인 코드입니다.");
      if (myCustomCode && myCustomCode !== trimmed) { try { await deleteDoc(doc(db, "userCodes", myCustomCode)); } catch(e){} }
      await setDoc(doc(db, "userCodes", trimmed), { uid: currentUser.uid, shareSettlement: isSettlementShared }, { merge: true });
      await setDoc(doc(db, "users", currentUser.uid), { customCode: trimmed }, { merge: true });
      myCustomCode = trimmed; 
      localStorage.setItem('onlyview_customCode', myCustomCode);
      renderSettingsUI(); 
      alert("변경되었습니다!");
    } catch(err) { alert(err.message); }
  });

  document.getElementById('applyPartnerCodeBtn')?.addEventListener('click', async () => {
    const partnerCode = document.getElementById('partnerCodeInput')?.value.trim();
    if (!partnerCode) return alert("코드를 입력해주세요.");
    try {
      const snap = await getDoc(doc(db, "userCodes", partnerCode));
      if (!snap.exists()) return alert("유효하지 않은 코드입니다.");
      const codeData = snap.data();
      let realUid = codeData.uid;
      isSettlementShared = codeData.shareSettlement === true;

      if (currentUser && realUid === currentUser.uid) {
        targetUserId = currentUser.uid;
        isReadOnly = false;
        await loadTargetUserSettings(currentUser.uid);
        alert("본인 모드로 전환되었습니다.");
      } else {
        targetUserId = realUid;
        isReadOnly = true;
        await loadTargetUserSettings(realUid);
        alert("동반자 모드로 전환되었습니다.");
      }
      updateFormVisibility(); 
      await loadCampaigns(); 
      window.switchTab('dashboard');
    } catch(err) { alert("조회 실패: " + err.message); }
  });

  document.querySelectorAll('.reset-data-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!currentUser) return;
      targetUserId = currentUser.uid; isReadOnly = false;
      const pInput = document.getElementById('partnerCodeInput');
      if(pInput) pInput.value = '';
      await loadTargetUserSettings(currentUser.uid);
      updateFormVisibility(); 
      await loadCampaigns();
      window.switchTab('dashboard');
    });
  });

  applySidebarUI(); 
  renderPlatformChips(); 
  renderSettingsUI();
  populateYearFilter();
});
