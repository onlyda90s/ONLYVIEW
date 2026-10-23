import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, browserLocalPersistence, setPersistence } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
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
  provider.setCustomParameters({ prompt: 'select_account' });
  // 팝업-부모창 간 토큰 유실을 방지하기 위해 로컬 영구 저장소 사용
  setPersistence(auth, browserLocalPersistence).catch(e => console.error(e));
} catch (e) {
  console.error("Firebase 초기화 에러:", e);
}

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

let currentUser = null, targetUserId = null, isReadOnly = false;
let isSettlementShared = localStorage.getItem('onlyview_shareSettlement') === 'true';
let rawCampaignList = [], isBatchEditing = false, listSubTab = 'ongoing', settlementSubTab = 'report', isFilterExpanded = false, newBatchRows = [];
let yearlyChartInstance = null, monthlyChartInstance = null, monthlyAnalysisChartInstance = null;
let isSidebarCollapsed = localStorage.getItem('onlyview_sidebarCollapsed') === 'true';
let monthlyDetailsCollapseState = {};
let sortColumn = localStorage.getItem('onlyview_sortColumn') || 'none';
let sortAsc = localStorage.getItem('onlyview_sortAsc') === 'true';
let myCustomCode = localStorage.getItem('onlyview_customCode') || "";
let currentCalDate = new Date();
let selectedStatus = "신청", modalSelectedStatus = "신청", editSelectedStatus = "선정", editingId = null, activeColorPickerKey = null;
let deadlineAlertDays = Number(localStorage.getItem('onlyview_deadlineAlertDays')) || 7;

let isPlatformEditing = false;
let isModalPlatformEditing = false;

let platformList = ['개별', '리뷰노트', '레뷰', '디너의여왕'];
try {
  const savedP = localStorage.getItem('onlyview_platforms');
  if (savedP) platformList = JSON.parse(savedP);
} catch(e) {}

const presetPalette = ['#6B7280', '#111827', '#E63946', '#F4A261', '#E9C46A', '#059669', '#2563EB', '#4F46E5', '#9333EA', '#D97706', '#EC4899', '#0891B2'];

let savedColors = {};
try {
  savedColors = JSON.parse(localStorage.getItem('onlyview_statusColors') || '{}');
} catch(e) {}

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

function formatCleanDate(d) {
  if (!d) return "";
  let s = String(d).trim().replace(/[/.]/g, '-');
  const p = s.split("-");
  if (p.length === 3) {
    let y = p[0].replace(/[^0-9]/g, '');
    let m = p[1].replace(/[^0-9]/g, '').padStart(2, '0');
    let day = p[2].replace(/[^0-9]/g, '').padStart(2, '0');
    if (y.length === 2) y = "20" + y;
    else if (y.length > 4) y = y.slice(0, 4);
    if (y.length === 4 && m && day) return y + "-" + m + "-" + day;
  }
  return s;
}

function formatShortDate(d) {
  if (!d) return "-";
  const s = formatCleanDate(d);
  const p = s.split("-");
  if (p.length === 3) {
    const yy = p[0].length === 4 ? p[0].substring(2, 4) : p[0];
    return yy + "-" + String(Number(p[1])).padStart(2, '0') + "-" + String(Number(p[2])).padStart(2, '0');
  }
  return s || "-";
}

function isItemOverdue(item) {
  const rawSt = item.status;
  if (rawSt === '제출' || rawSt === '완료' || rawSt === '미제출') return false;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  if (item.deadlineDate) {
    const cD = formatCleanDate(item.deadlineDate);
    if (cD && new Date(cD).setHours(0,0,0,0) < now) return true;
  }
  if (item.visitDate) {
    const cV = formatCleanDate(item.visitDate);
    if (cV && new Date(cV).setHours(0,0,0,0) < now) return true;
  }
  return false;
}

function getEffectiveStatus(item) { return item.status || '신청'; }
function displayStatusName(status) { return status || '신청'; }

window.getStatusColor = function(st) {
  if (st === '제출' || st === '완료') return customStatusColors.submit || '#059669';
  if (st === '원고료') return customStatusColors.fee || '#9333EA';
  if (st === '배송') return customStatusColors.delivery || '#2563EB';
  if (st === '미제출') return customStatusColors.unsubmitted || '#E63946';
  if (st === '방문') return customStatusColors.visit || '#F4A261';
  if (st === '선정') return customStatusColors.select || '#111827';
  return customStatusColors.apply || '#6B7280';
};

function formatCurrencyInput(v) {
  if (!v && v !== 0) return "";
  const num = String(v).replace(/[^0-9]/g, '');
  return num ? Number(num).toLocaleString() : "";
}
function parseCurrencyValue(v) {
  if (!v) return 0;
  return Number(String(v).replace(/[^0-9]/g, '')) || 0;
}
function formatRevenueDisplay(num) {
  const val = Number(num) || 0;
  return (val < 0 ? "-" + Math.abs(val).toLocaleString() : val.toLocaleString()) + "원";
}
function formatPhoneNumber(v) {
  if (!v) return "";
  const n = v.replace(/[^0-9]/g, '');
  if (n.length < 3) return n;
  if (n.startsWith("02")) {
    if (n.length <= 5) return n.slice(0, 2) + "-" + n.slice(2);
    if (n.length <= 9) return n.slice(0, 2) + "-" + n.slice(2, 5) + "-" + n.slice(5);
    return n.slice(0, 2) + "-" + n.slice(2, 6) + "-" + n.slice(6, 10);
  } else {
    if (n.length <= 6) return n.slice(0, 3) + "-" + n.slice(3);
    if (n.length <= 10) return n.slice(0, 3) + "-" + n.slice(3, 6) + "-" + n.slice(6);
    return n.slice(0, 3) + "-" + n.slice(3, 7) + "-" + n.slice(7, 11);
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

function applyThemeCSS(k) {
  const theme = themeColors[k] || themeColors.slate;
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

function getSortIndicatorHtml(col) {
  if (sortColumn !== col || sortColumn === 'none') return '<span class="text-gray-300 ml-0.5">↕</span>';
  return sortAsc ? '<span class="text-theme font-bold ml-0.5">▲</span>' : '<span class="text-theme font-bold ml-0.5">▼</span>';
}

function updateChartModeButtonsUI() {
  ['default', 'light', 'outline', 'theme'].forEach(m => {
    const btn = document.getElementById("btnChartMode_" + m);
    if (btn) {
      btn.className = (m === currentChartMode)
        ? "py-2 px-1 rounded-xl font-bold border border-theme bg-theme text-white text-xs text-center shadow-sm"
        : "py-2 px-1 rounded-xl font-normal border border-gray-200 bg-white text-gray-600 text-xs text-center hover:border-gray-300";
    }
  });
}

function getActiveChartColors() {
  const activeKey = localStorage.getItem('onlyview_theme') || 'slate';
  if (currentChartMode === 'theme') {
    const preset = chartStylePalettes.themePreset[activeKey] || chartStylePalettes.themePreset.slate;
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
  ['apply', 'select', 'visit', 'unsubmitted', 'submit', 'delivery', 'fee'].forEach(k => {
    const badge = document.getElementById("picker_badge_" + k);
    if (badge) badge.style.backgroundColor = customStatusColors[k] || '#6B7280';
  });
}

function updateShareSettlementUI() {
  const label = document.getElementById('shareSettlementLabel');
  const btn = document.getElementById('toggleShareSettlementBtn');
  const circle = document.getElementById('toggleShareSettlementCircle');
  if (label) { label.innerText = isSettlementShared ? "공개" : "비공개"; label.className = isSettlementShared ? "text-xs font-bold text-theme" : "text-xs font-bold text-gray-500"; }
  if (btn) btn.className = (isSettlementShared ? "bg-theme" : "bg-gray-300") + " w-11 h-6 rounded-full p-1 transition-colors relative flex items-center";
  if (circle) circle.className = "w-4 h-4 bg-white rounded-full transition-transform transform " + (isSettlementShared ? "translate-x-5" : "translate-x-0") + " shadow-sm";
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
    const userSnap = await getDoc(doc(db, "users", uid));
    if (userSnap.exists()) {
      const d = userSnap.data();
      if (d.statusColors) { 
        Object.assign(customStatusColors, d.statusColors); 
        localStorage.setItem('onlyview_statusColors', JSON.stringify(customStatusColors));
        applyStatusCSSColors(); 
        renderStatusColorPickers(); 
      }
      if (d.platforms && Array.isArray(d.platforms) && d.platforms.length > 0) {
        platformList = d.platforms;
        localStorage.setItem('onlyview_platforms', JSON.stringify(platformList));
        renderPlatformChips();
      }
      if (d.theme) { applyThemeCSS(d.theme); localStorage.setItem('onlyview_theme', d.theme); }
      if (d.chartMode) { currentChartMode = d.chartMode; localStorage.setItem('onlyview_chartMode', d.chartMode); updateChartModeButtonsUI(); }
      if (d.deadlineAlertDays) { deadlineAlertDays = d.deadlineAlertDays; updateDeadlineButtons(); }
    }
  } catch (err) { console.error("설정 동기화 실패:", err); }
}

// 사용자 로그인 성공 후 대시보드 화면 전환을 100% 보장하는 공통 핸들러
async function handleUserLoggedIn(user) {
  if (!user) return;
  currentUser = user;
  targetUserId = user.uid;
  isReadOnly = false;
  
  const authSec = document.getElementById('authSection');
  const appSec = document.getElementById('appSection');
  authSec?.classList.add('hidden');
  appSec?.classList.remove('hidden');
  appSec?.classList.add('flex', 'lg:flex');
  
  const userNameElem = document.getElementById('userName');
  if (userNameElem) userNameElem.innerText = user.displayName || user.email;
  
  await fetchUserCustomCode();
  updateFormVisibility();
  await loadCampaigns();
  window.switchTab('dashboard', false);
}

window.loginWithGoogle = async function() {
  try {
    if (!auth || !provider) {
      return alert("Firebase 초기화 중입니다. 잠시 후 다시 시도해 주세요.");
    }
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('kakao') || ua.includes('instagram') || ua.includes('naver')) {
      return alert("인앱 브라우저에서는 구글 정책상 로그인이 제한됩니다. Safari 또는 Chrome 등 정식 브라우저로 접속해 주세요.");
    }
    
    // 팝업 로그인 실행
    const cred = await signInWithPopup(auth, provider);
    if (cred && cred.user) {
      // 팝업 종료 즉시 부모창을 대시보드로 직접 진입
      await handleUserLoggedIn(cred.user);
    }
  } catch (err) {
    console.error("로그인 에러:", err);
    if (err.code === 'auth/popup-closed-by-user') return;
    if (err.code === 'auth/popup-blocked') {
      return alert("브라우저 팝업이 차단되었습니다. 팝업 허용 후 다시 시도해 주세요.");
    }
    if (err.code === 'auth/unauthorized-domain') {
      return alert("Firebase '승인된 도메인'에 현재 웹사이트 주소가 등록되지 않았습니다.\n\nFirebase 콘솔 > Authentication > Settings > 승인된 도메인에 현재 도메인을 추가해 주세요.");
    }
    alert(`로그인 오류 (${err.code || '알 수 없음'}): ${err.message}`);
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
      if (myCustomCode) await setDoc(doc(db, "userCodes", myCustomCode), { shareSettlement: isSettlementShared }, { merge: true });
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
    const currentC = customStatusColors[key] || '#6B7280';
    presetPalette.forEach(hex => {
      const isSel = currentC.toLowerCase() === hex.toLowerCase();
      const btn = document.createElement('button'); btn.type = 'button';
      btn.className = "w-8 h-8 md:w-10 md:h-10 rounded-full border-2 transition-transform hover:scale-110 shadow-sm flex items-center justify-center " + (isSel ? "border-gray-900 ring-2 ring-gray-400 scale-110" : "border-white");
      btn.style.backgroundColor = hex;
      if (isSel) btn.innerHTML = '<span class="text-white text-xs font-bold">✓</span>';
      btn.onclick = () => window.updateCustomStatusColor(key, hex);
      grid.appendChild(btn);
    });
  }
  document.getElementById('colorPickerModal')?.classList.remove('hidden');
};

window.setChartMode = async function(m) {
  if (isReadOnly) return alert("읽기 전용 모드입니다.");
  currentChartMode = m;
  localStorage.setItem('onlyview_chartMode', m);
  updateChartModeButtonsUI();
  window.renderSettlementView();
  if (currentUser && !isReadOnly) {
    try { await setDoc(doc(db, "users", currentUser.uid), { chartMode: m }, { merge: true }); } catch(e) {}
  }
};

window.changeTheme = async function(k) {
  if (isReadOnly) return alert("읽기 전용 모드입니다.");
  applyThemeCSS(k);
  localStorage.setItem('onlyview_theme', k);
  if (currentChartMode === 'theme') window.renderSettlementView();
  if (currentUser && !isReadOnly) {
    try { await setDoc(doc(db, "users", currentUser.uid), { theme: k }, { merge: true }); } catch(e) {}
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
    filterBox.classList.toggle('hidden', !isFilterExpanded);
    filterBox.classList.toggle('flex', isFilterExpanded);
    toggleBtn.innerText = isFilterExpanded ? '▲ 필터' : '▼ 필터';
  }
};

window.setSettlementSubTab = function(type) {
  settlementSubTab = type;
  const btnReport = document.getElementById('settlementSubTabReport');
  const btnDetail = document.getElementById('settlementSubTabDetail');
  const panelReport = document.getElementById('settlementPanelReport');
  const panelDetail = document.getElementById('settlementPanelDetail');
  if (type === 'report') {
    if (btnReport) btnReport.className = "flex-1 sm:flex-initial py-1.5 px-3 rounded-lg font-bold text-xs bg-theme text-white shadow-sm transition-colors text-center";
    if (btnDetail) btnDetail.className = "flex-1 sm:flex-initial py-1.5 px-3 rounded-lg font-normal text-xs bg-transparent hover:bg-gray-200 text-gray-700 transition-colors text-center";
    panelReport?.classList.remove('hidden'); panelDetail?.classList.add('hidden');
  } else {
    if (btnReport) btnReport.className = "flex-1 sm:flex-initial py-1.5 px-3 rounded-lg font-normal text-xs bg-transparent hover:bg-gray-200 text-gray-700 transition-colors text-center";
    if (btnDetail) btnDetail.className = "flex-1 sm:flex-initial py-1.5 px-3 rounded-lg font-bold text-xs bg-theme text-white shadow-sm transition-colors text-center";
    panelDetail?.classList.remove('hidden'); panelReport?.classList.add('hidden');
  }
  window.renderSettlementView();
};

window.toggleMonthlyDetailsCard = function(m) {
  monthlyDetailsCollapseState[m] = !monthlyDetailsCollapseState[m];
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

  const mainViewport = document.querySelector('main');
  if (mainViewport) mainViewport.scrollTop = 0;

  ['sectionDashboard', 'sectionList', 'sectionForm', 'sectionSettlement', 'sectionSettings'].forEach(s => document.getElementById(s)?.classList.add('hidden'));
  
  document.querySelectorAll('.nav-item').forEach(btn => { btn.classList.remove('bg-theme', 'text-white'); btn.classList.add('text-sidebar', 'hover:bg-black/5'); });
  const activeBtn = document.getElementById("nav-" + tabName);
  if (activeBtn) { activeBtn.classList.remove('text-sidebar', 'hover:bg-black/5'); activeBtn.classList.add('bg-theme', 'text-white'); }
  
  document.querySelectorAll('.bottom-nav-item').forEach(btn => { btn.classList.remove('text-theme'); btn.classList.add('text-gray-400'); });
  const activeBottomBtn = document.getElementById("bottom-nav-" + tabName);
  if (activeBottomBtn) { activeBottomBtn.classList.remove('text-gray-400'); activeBottomBtn.classList.add('text-theme'); }
  
  if (pushState && window.location.hash !== "#" + tabName) {
    history.pushState({ tab: tabName }, '', "#" + tabName);
  }
  
  ['dayModal', 'editModal', 'colorPickerModal', 'dashRegisterModal'].forEach(id => document.getElementById(id)?.classList.add('hidden'));

  if (tabName === 'dashboard') {
    document.getElementById('sectionDashboard')?.classList.remove('hidden');
    window.renderDashboardView();
  }
  else if (tabName === 'list') {
    isBatchEditing = false; newBatchRows = []; isFilterExpanded = false;
    const filterBox = document.getElementById('filterBoxContainer'); const toggleBtn = document.getElementById('filterToggleBtn');
    if (filterBox && toggleBtn) { filterBox.classList.add('hidden'); filterBox.classList.remove('flex'); toggleBtn.innerText = '▼ 필터'; }
    const searchEl = document.getElementById('searchInput'); if (searchEl) searchEl.value = '';
    const stEl = document.getElementById('filterStatus'); if (stEl) stEl.value = 'ALL';
    const yrEl = document.getElementById('filterYear'); if (yrEl) yrEl.value = 'ALL';
    const moEl = document.getElementById('filterMonth'); if (moEl) moEl.value = 'ALL';
    
    document.getElementById('sectionList')?.classList.remove('hidden');
    window.filterAndRender();
  }
  else if (tabName === 'form') {
    document.getElementById('campaignForm')?.reset();
    isPlatformEditing = false;
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
  window.switchTab(['dashboard', 'form', 'list', 'settlement', 'settings'].includes(hash) ? hash : 'dashboard', false);
});

window.setStatusBtn = function(status) {
  selectedStatus = status;
  ['신청', '선정', '배송', '원고료'].forEach(s => {
    const btn = document.getElementById("btnStatus_" + s);
    if (btn) {
      btn.className = (s === status)
        ? "py-2 sm:py-1.5 px-3 rounded-xl font-bold border border-theme bg-theme text-white text-xs text-center shadow-sm"
        : "py-2 sm:py-1.5 px-3 rounded-xl font-normal border border-gray-200 bg-white text-gray-600 text-xs text-center hover:border-gray-300";
    }
  });
  const sL = document.getElementById('storeNameLabel'), aL = document.getElementById('sponsoredAmountLabel');
  const rApp = document.getElementById('rowApplyDate'), rDead = document.getElementById('rowDeadlineDate');
  const rVis = document.getElementById('rowVisit'), rFin = document.getElementById('rowFinancial');
  const rCon = document.getElementById('rowContact'), rMemo = document.getElementById('rowMemo');
  if (status === '신청') {
    if (sL) sL.innerText = "매장명 (업체명) *"; if (aL) aL.innerText = "제공금액 (원)";
    rApp?.classList.remove('hidden'); rDead?.classList.add('hidden'); rVis?.classList.add('hidden'); rFin?.classList.add('hidden'); rCon?.classList.add('hidden'); rMemo?.classList.add('hidden');
  } else {
    rApp?.classList.add('hidden'); rDead?.classList.remove('hidden'); rCon?.classList.remove('hidden'); rMemo?.classList.remove('hidden');
    if (status === '선정') {
      if (sL) sL.innerText = "매장명 (업체명) *"; if (aL) aL.innerText = "제공금액 (원)";
      rVis?.classList.remove('hidden'); rFin?.classList.remove('hidden');
      if (!document.getElementById('visitTime')?.value) { const n = new Date(); document.getElementById('visitTime').value = String(n.getHours()).padStart(2, '0') + ":" + String(n.getMinutes()).padStart(2, '0'); }
    } else if (status === '배송') {
      if (sL) sL.innerText = "매장명 (제품명) *"; if (aL) aL.innerText = "제공금액 (원)";
      rVis?.classList.add('hidden'); rFin?.classList.remove('hidden');
    } else if (status === '원고료') {
      if (sL) sL.innerText = "매장명 (업체명) *"; if (aL) aL.innerText = "원고료 (원)";
      rVis?.classList.add('hidden'); rFin?.classList.add('hidden');
    }
  }
};

window.setModalStatusBtn = function(status) {
  modalSelectedStatus = status;
  ['신청', '선정', '배송', '원고료'].forEach(s => {
    const btn = document.getElementById("btnModalStatus_" + s);
    if (btn) {
      btn.className = (s === status)
        ? "py-2 sm:py-1.5 px-3 rounded-xl font-bold border border-theme bg-theme text-white text-xs text-center shadow-sm"
        : "py-2 sm:py-1.5 px-3 rounded-xl font-normal border border-gray-200 bg-white text-gray-600 text-xs text-center";
    }
  });
  const rApp = document.getElementById('modalRowApplyDate'), rDead = document.getElementById('modalRowDeadlineDate');
  const rVis = document.getElementById('modalRowVisit'), rFin = document.getElementById('modalRowFinancial');
  const rCon = document.getElementById('modalRowContact'), rMemo = document.getElementById('modalRowMemo');
  if (status === '신청') {
    rApp?.classList.remove('hidden'); rDead?.classList.add('hidden'); rVis?.classList.add('hidden'); rFin?.classList.add('hidden'); rCon?.classList.add('hidden'); rMemo?.classList.add('hidden');
  } else {
    rApp?.classList.add('hidden'); rDead?.classList.remove('hidden'); rCon?.classList.remove('hidden'); rMemo?.classList.remove('hidden');
    if (status === '선정') {
      rVis?.classList.remove('hidden'); rFin?.classList.remove('hidden');
      if (!document.getElementById('modalVisitTime')?.value) { const n = new Date(); document.getElementById('modalVisitTime').value = String(n.getHours()).padStart(2, '0') + ":" + String(n.getMinutes()).padStart(2, '0'); }
    } else if (status === '배송') {
      rVis?.classList.add('hidden'); rFin?.classList.remove('hidden');
    } else if (status === '원고료') {
      rVis?.classList.add('hidden'); rFin?.classList.add('hidden');
    }
  }
};

window.setEditStatusBtn = function(status) {
  editSelectedStatus = status;
  ['신청', '선정', '방문', '미제출', '제출', '배송', '원고료'].forEach(s => {
    const btn = document.getElementById("btnEditStatus_" + s);
    if (btn) btn.className = (s === status) ? "py-1.5 px-3 rounded-lg font-bold border border-theme bg-theme text-white text-xs" : "py-1.5 px-3 rounded-lg font-normal border border-gray-200 bg-white text-gray-600 text-xs";
  });
};

window.selectPlatformChip = function(name) {
  const el = document.getElementById('platformName'); if (el) el.value = name;
  renderPlatformChips();
};

window.togglePlatformEdit = function(isModal = false) {
  if (isReadOnly) return alert("읽기 전용 모드입니다.");
  if (isModal) isModalPlatformEditing = !isModalPlatformEditing;
  else isPlatformEditing = !isPlatformEditing;
  renderPlatformChips();
};

window.deleteCustomPlatform = async function(name) {
  if (isReadOnly) return alert("읽기 전용 모드입니다.");
  if (name === '개별') return alert("'개별' 항목은 기본 사이트이므로 삭제할 수 없습니다.");
  if (!confirm(`'${name}' 사이트를 목록에서 삭제하시겠습니까?\n(기존에 등록된 체험단 내역은 그대로 유지됩니다)`)) return;
  platformList = platformList.filter(p => p !== name);
  localStorage.setItem('onlyview_platforms', JSON.stringify(platformList));
  const pInput = document.getElementById('platformName'); if (pInput && pInput.value === name) pInput.value = '개별';
  const mInput = document.getElementById('modalPlatformName'); if (mInput && mInput.value === name) mInput.value = '개별';
  renderPlatformChips();
  if (currentUser && !isReadOnly) { try { await setDoc(doc(db, "users", currentUser.uid), { platforms: platformList }, { merge: true }); } catch(e) {} }
};

window.addCustomPlatform = async function() {
  if (isReadOnly) return alert("읽기 전용 모드입니다.");
  const newSite = prompt("추가할 사이트명을 입력하세요:");
  if (!newSite || !newSite.trim()) return;
  const t = newSite.trim();
  if (!platformList.includes(t)) {
    platformList.push(t); localStorage.setItem('onlyview_platforms', JSON.stringify(platformList)); window.selectPlatformChip(t);
    if (currentUser && !isReadOnly) { try { await setDoc(doc(db, "users", currentUser.uid), { platforms: platformList }, { merge: true }); } catch(e) {} }
  } else { window.selectPlatformChip(t); }
};

function renderPlatformChips() {
  const container = document.getElementById('platformChipsContainer');
  const modalContainer = document.getElementById('modalPlatformChipsContainer');
  const render = (target, isM) => {
    if (!target) return;
    target.innerHTML = '';
    const inputId = isM ? 'modalPlatformName' : 'platformName';
    const curVal = document.getElementById(inputId)?.value || platformList[0] || '개별';
    const isEditing = isM ? isModalPlatformEditing : isPlatformEditing;

    platformList.forEach(name => {
      const isSelected = (name === curVal);
      const chipWrap = document.createElement('div');
      chipWrap.className = "relative inline-flex items-center";

      const btn = document.createElement('button');
      btn.type = 'button'; btn.innerText = name;
      btn.className = (isSelected)
        ? "platform-chip px-3 py-1.5 rounded-lg border border-theme bg-theme-light text-theme font-bold text-xs transition-colors"
        : "platform-chip px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 font-normal text-xs hover:border-gray-300 transition-colors";
      btn.onclick = () => { const el = document.getElementById(inputId); if (el) el.value = name; renderPlatformChips(); };
      chipWrap.appendChild(btn);

      if (isEditing && name !== '개별') {
        const delBtn = document.createElement('button');
        delBtn.type = 'button'; delBtn.innerHTML = '×';
        delBtn.title = '사이트 삭제';
        delBtn.className = "absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-rose-500 text-white text-[12px] font-black flex items-center justify-center shadow-md hover:bg-rose-600 transition-colors leading-none pb-0.5";
        delBtn.onclick = (e) => { e.stopPropagation(); window.deleteCustomPlatform(name); };
        chipWrap.appendChild(delBtn);
      }
      target.appendChild(chipWrap);
    });

    if (isEditing) {
      const addBtn = document.createElement('button');
      addBtn.type = 'button'; addBtn.innerText = '+ 추가';
      addBtn.className = "px-3 py-1.5 rounded-lg border border-dashed border-gray-300 bg-gray-50 text-gray-500 font-normal text-xs hover:bg-gray-100 transition-colors";
      addBtn.onclick = window.addCustomPlatform;
      target.appendChild(addBtn);
    }
    const editToggleBtn = document.createElement('button');
    editToggleBtn.type = 'button';
    editToggleBtn.innerText = isEditing ? '완료' : '수정';
    editToggleBtn.className = isEditing
      ? "px-3 py-1.5 rounded-lg font-bold text-xs bg-theme text-white shadow-sm transition-colors"
      : "px-3 py-1.5 rounded-lg font-normal text-xs bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors";
    editToggleBtn.onclick = () => window.togglePlatformEdit(isM);
    target.appendChild(editToggleBtn);
  };
  render(container, false);
  render(modalContainer, true);
}

window.setDeadlineDays = async function(days) {
  if (isReadOnly) return alert("읽기 전용 모드에서는 설정을 변경할 수 없습니다.");
  deadlineAlertDays = Number(days);
  localStorage.setItem('onlyview_deadlineAlertDays', deadlineAlertDays.toString());
  window.renderDashboardView(); 
  updateDeadlineButtons();
  if (currentUser && !isReadOnly) {
    try { await setDoc(doc(db, "users", currentUser.uid), { deadlineAlertDays }, { merge: true }); } catch(e) {}
  }
};

function updateDeadlineButtons() {
  [7, 10, 14].forEach(d => {
    const btn = document.getElementById("btnDeadlineDay_" + d);
    if (btn) {
      btn.className = (d === deadlineAlertDays)
        ? "py-2 px-3 rounded-xl font-bold border border-theme bg-theme text-white text-xs text-center shadow-sm"
        : "py-2 px-3 rounded-xl font-normal border border-gray-200 bg-white text-gray-600 text-xs text-center hover:border-gray-300";
    }
  });
}

window.openDashRegisterModal = function() {
  if (isReadOnly) return alert("읽기 전용 모드에서는 체험을 등록할 수 없습니다.");
  document.getElementById('modalCampaignForm')?.reset();
  isModalPlatformEditing = false;
  window.setModalStatusBtn('신청');
  const mApp = document.getElementById('modalApplyDate');
  if (mApp) mApp.value = new Date().toISOString().slice(0, 10);
  renderPlatformChips();
  document.getElementById('dashRegisterModal')?.classList.remove('hidden');
};
window.closeDashRegisterModal = function() { document.getElementById('dashRegisterModal')?.classList.add('hidden'); };

window.handleSort = function(col) {
  if (sortColumn === col) sortAsc = !sortAsc;
  else { sortColumn = col; sortAsc = true; }
  localStorage.setItem('onlyview_sortColumn', sortColumn);
  localStorage.setItem('onlyview_sortAsc', sortAsc.toString());
  window.filterAndRender();
};

window.setListSubTab = function(type) {
  listSubTab = type;
  const btnO = document.getElementById('subTabOngoing'), btnS = document.getElementById('subTabSubmitted');
  if (btnO) btnO.className = (type === 'ongoing') ? "flex-1 sm:flex-initial py-1.5 px-3 rounded-lg font-bold text-xs bg-theme text-white shadow-sm transition-colors text-center" : "flex-1 sm:flex-initial py-1.5 px-3 rounded-lg font-normal text-xs bg-transparent hover:bg-gray-200 text-gray-700 transition-colors text-center";
  if (btnS) btnS.className = (type === 'submitted') ? "flex-1 sm:flex-initial py-1.5 px-3 rounded-lg font-bold text-xs bg-theme text-white shadow-sm transition-colors text-center" : "flex-1 sm:flex-initial py-1.5 px-3 rounded-lg font-normal text-xs bg-transparent hover:bg-gray-200 text-gray-700 transition-colors text-center";
  window.filterAndRender();
};

window.toggleBatchEdit = function() {
  if (isReadOnly) return alert("읽기 전용 모드에서는 수정할 수 없습니다.");
  isBatchEditing = !isBatchEditing; newBatchRows = []; window.filterAndRender();
};
window.addNewBatchRow = function() { newBatchRows.push({ tempId: Date.now() + Math.random(), showTimeInput: false }); window.filterAndRender(); };
window.removeNewBatchRow = function(i) { newBatchRows.splice(i, 1); window.filterAndRender(); };
window.toggleNewRowTimeInput = function(i) { document.getElementById("newTimeContainer_" + i)?.classList.toggle('hidden'); };

window.saveAllBatchEdits = async function() {
  if (isReadOnly || !currentUser) return;
  const promises = [];
  rawCampaignList.forEach(item => {
    const sEl = document.getElementById("batch_store_" + item.id);
    if (!sEl) return;
    promises.push(updateDoc(doc(db, "campaigns", item.id), {
      storeName: sEl.value || '',
      status: document.getElementById("batch_status_" + item.id)?.value || '선정',
      platformName: document.getElementById("batch_platform_" + item.id)?.value || '개별',
      visitDate: formatCleanDate(document.getElementById("batch_visitDate_" + item.id)?.value || ''),
      visitTime: document.getElementById("batch_visitTime_" + item.id)?.value || '',
      deadlineDate: formatCleanDate(document.getElementById("batch_deadlineDate_" + item.id)?.value || ''),
      sponsoredAmount: parseCurrencyValue(document.getElementById("batch_sponsored_" + item.id)?.value),
      paidAmount: parseCurrencyValue(document.getElementById("batch_paid_" + item.id)?.value)
    }));
  });
  newBatchRows.forEach((row, idx) => {
    const sVal = document.getElementById("new_batch_store_" + idx)?.value;
    if (sVal && sVal.trim()) {
      promises.push(addDoc(collection(db, "campaigns"), {
        userId: currentUser.uid, storeName: sVal.trim(),
        status: document.getElementById("new_batch_status_" + idx)?.value || '선정',
        platformName: document.getElementById("new_batch_platform_" + idx)?.value || '개별',
        applyDate: formatCleanDate(new Date().toISOString().slice(0, 10)),
        visitDate: formatCleanDate(document.getElementById("new_batch_visitDate_" + idx)?.value || ''),
        visitTime: document.getElementById("new_batch_visitTime_" + idx)?.value || '',
        deadlineDate: formatCleanDate(document.getElementById("new_batch_deadlineDate_" + idx)?.value || ''),
        sponsoredAmount: parseCurrencyValue(document.getElementById("new_batch_sponsored_" + idx)?.value),
        paidAmount: parseCurrencyValue(document.getElementById("new_batch_paid_" + idx)?.value),
        revenue: 0, createdAt: serverTimestamp()
      }));
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
  const setVal = (elId, val) => { const el = document.getElementById(elId); if(el) el.value = val; };
  setVal('editStoreName', item.storeName || '');
  setVal('editPlatformName', item.platformName || '개별');
  window.setEditStatusBtn(item.status || '선정');
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

// 4개 시트(대시보드, 정산 세부 내역, 진행중 체험단, 완료 체험단) 완전 복원
window.downloadExcel = async function() {
  if (!rawCampaignList || rawCampaignList.length === 0) return alert("내보낼 체험단 데이터가 없습니다.");
  if (typeof ExcelJS === 'undefined') return alert("엑셀 모듈 로딩 중입니다.");
  try {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'ONLYVIEW';
    const COLOR_PRIMARY = 'FF3B6FB6', COLOR_LIGHT = 'FFE5EBF4', COLOR_BORDER = 'FFD1D5DB';
    const borderStyle = { top: { style: 'thin', color: { argb: COLOR_BORDER } }, left: { style: 'thin', color: { argb: COLOR_BORDER } }, bottom: { style: 'thin', color: { argb: COLOR_BORDER } }, right: { style: 'thin', color: { argb: COLOR_BORDER } } };
    const dateStr = new Date().toLocaleDateString('ko-KR');
    
    let tCnt = rawCampaignList.length, cCnt = 0, tSpon = 0, tPaid = 0, tRev = 0;
    const mSum = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, done: 0, revenue: 0 }));
    const pMap = {};
    
    rawCampaignList.forEach(item => {
      const isDone = (getEffectiveStatus(item) === '제출' || getEffectiveStatus(item) === '완료');
      const sp = Number(item.sponsoredAmount || 0), pd = Number(item.paidAmount || 0), rev = Number(item.revenue || 0);
      const calcRev = pd === 0 ? (sp > 0 ? sp : rev) : ((sp - pd) + rev);
      if (isDone) {
        cCnt++; tSpon += sp; tPaid += pd; tRev += calcRev;
        const refD = formatCleanDate(item.visitDate || item.deadlineDate || item.applyDate || '');
        if (refD && refD.length >= 7) {
          const m = parseInt(refD.slice(5, 7));
          if (m >= 1 && m <= 12) { mSum[m - 1].done++; mSum[m - 1].revenue += calcRev; }
        }
        const pN = item.platformName || '개별'; pMap[pN] = (pMap[pN] || 0) + calcRev;
      }
    });

    // 1. 대시보드 시트
    const sh1 = wb.addWorksheet('대시보드', { views: [{ showGridLines: true }] });
    sh1.mergeCells('B2:H2');
    const tCell = sh1.getCell('B2'); tCell.value = '온리뷰 (ONLYVIEW) 종합 리포트'; tCell.font = { name: '맑은 고딕', size: 15, bold: true, color: { argb: COLOR_PRIMARY } };
    sh1.getCell('B3').value = `기준일시: ${dateStr}`;
    
    const kpi = [ { c: 'B', t: '총 진행 건수', v: `${tCnt}건` }, { c: 'C', t: '제출 완료 건수', v: `${cCnt}건` }, { c: 'D', t: '총 제공금액', v: `${tSpon.toLocaleString()}원` }, { c: 'E', t: '순 실수익 (누적)', v: `${tRev.toLocaleString()}원` } ];
    kpi.forEach(k => {
      const h = sh1.getCell(`${k.c}5`), v = sh1.getCell(`${k.c}6`);
      h.value = k.t; h.font = { name: '맑은 고딕', size: 9, bold: true }; h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_LIGHT } }; h.border = borderStyle;
      v.value = k.v; v.font = { name: '맑은 고딕', size: 12, bold: true }; v.border = borderStyle;
    });

    sh1.getCell('B8').value = '1. 월별 완료 실적'; sh1.getCell('B8').font = { name: '맑은 고딕', size: 11, bold: true };
    ['월', '완료 건수', '실수익'].forEach((t, i) => { const c = sh1.getCell(`${String.fromCharCode(66+i)}9`); c.value = t; c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_PRIMARY } }; c.border = borderStyle; });
    mSum.forEach((m, i) => {
      const r = 10 + i;
      sh1.getCell(`B${r}`).value = `${m.month}월`; sh1.getCell(`C${r}`).value = m.done; sh1.getCell(`C${r}`).numFmt = '#,##0"건"'; sh1.getCell(`D${r}`).value = m.revenue; sh1.getCell(`D${r}`).numFmt = '#,##0"원"';
      ['B','C','D'].forEach(c => sh1.getCell(`${c}${r}`).border = borderStyle);
    });

    sh1.getCell('F8').value = '2. 플랫폼 수익 랭킹'; sh1.getCell('F8').font = { name: '맑은 고딕', size: 11, bold: true };
    ['플랫폼명', '총 수익'].forEach((t, i) => { const c = sh1.getCell(`${String.fromCharCode(70+i)}9`); c.value = t; c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_PRIMARY } }; c.border = borderStyle; });
    Object.entries(pMap).sort((a, b) => b[1] - a[1]).forEach(([n, v], i) => {
      const r = 10 + i; sh1.getCell(`F${r}`).value = n; sh1.getCell(`G${r}`).value = v; sh1.getCell(`G${r}`).numFmt = '#,##0"원"';
      ['F','G'].forEach(c => sh1.getCell(`${c}${r}`).border = borderStyle);
    });
    sh1.columns = [{ width: 4 }, { width: 15 }, { width: 15 }, { width: 18 }, { width: 20 }, { width: 15 }, { width: 18 }];

    // 공통 시트 빌더 함수
    const buildSheet = (sName, items) => {
      const sh = wb.addWorksheet(sName, { views: [{ showGridLines: true }] });
      const hds = [ { h: '매장명', k: 'storeName', w: 24 }, { h: '상태', k: 'status', w: 10 }, { h: '사이트', k: 'platformName', w: 12 }, { h: '방문일', k: 'visitDate', w: 12 }, { h: '마감일', k: 'deadlineDate', w: 12 }, { h: '제공금액', k: 'sponsoredAmount', w: 14 }, { h: '결제금액', k: 'paidAmount', w: 14 }, { h: '실수익', k: 'revenue', w: 14 }, { h: '비고', k: 'memo', w: 20 } ];
      const hr = sh.getRow(1); hr.height = 24;
      hds.forEach((h, i) => { const c = hr.getCell(i+1); c.value = h.h; c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_PRIMARY } }; c.border = borderStyle; });
      let rIdx = 2;
      items.forEach(it => {
        const r = sh.getRow(rIdx++);
        const eff = getEffectiveStatus(it); const sp = Number(it.sponsoredAmount || 0), pd = Number(it.paidAmount || 0), rv = Number(it.revenue || 0); const cRev = pd === 0 ? (sp > 0 ? sp : rv) : ((sp - pd) + rv);
        r.getCell(1).value = it.storeName || ''; r.getCell(2).value = displayStatusName(eff); r.getCell(3).value = it.platformName || '개별'; r.getCell(4).value = formatCleanDate(it.visitDate) || '-'; r.getCell(5).value = formatCleanDate(it.deadlineDate) || '-'; r.getCell(6).value = sp; r.getCell(7).value = pd; r.getCell(8).value = cRev; r.getCell(9).value = it.memo || '';
        hds.forEach((h, i) => { const c = r.getCell(i+1); c.border = borderStyle; if(i>=5 && i<=7) c.numFmt = '#,##0"원"'; });
      });
      sh.columns = hds.map(h => ({ width: h.w }));
    };

    // 2. 정산 세부 내역 (완료된 건 정렬)
    buildSheet('정산 세부 내역', rawCampaignList.filter(c => getEffectiveStatus(c) === '제출' || getEffectiveStatus(c) === '완료').sort((a, b) => (formatCleanDate(a.visitDate || a.deadlineDate) || '').localeCompare(formatCleanDate(b.visitDate || b.deadlineDate) || '')));
    // 3. 진행중 체험단 (미완료 건)
    buildSheet('진행중 체험단', rawCampaignList.filter(c => getEffectiveStatus(c) !== '제출' && getEffectiveStatus(c) !== '완료'));
    // 4. 완료 체험단
    buildSheet('완료 체험단', rawCampaignList.filter(c => getEffectiveStatus(c) === '제출' || getEffectiveStatus(c) === '완료'));

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `온리뷰_정산_리포트_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.xlsx`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); window.URL.revokeObjectURL(url);
  } catch (err) { alert("엑셀 다운로드 중 오류: " + err.message); }
};

window.filterAndRender = function() {
  const tableBody = document.getElementById('campaignTableBody');
  const cardList = document.getElementById('campaignCardList');
  const searchText = document.getElementById('searchInput')?.value.toLowerCase() || '';
  const filterStatus = document.getElementById('filterStatus')?.value || 'ALL';
  const filterYear = document.getElementById('filterYear')?.value || 'ALL';
  const filterMonth = document.getElementById('filterMonth')?.value || 'ALL';
  const batchBtn = document.getElementById('batchEditBtn'), saveBatchBtn = document.getElementById('saveBatchBtn');

  if (cardList) cardList.className = 'block sm:hidden space-y-2.5 w-full';

  if (batchBtn && saveBatchBtn) {
    if (isBatchEditing) {
      batchBtn.className = "px-3.5 py-2 rounded-xl font-bold text-xs bg-rose-500 text-white shadow-sm shrink-0";
      batchBtn.innerText = "취소";
      saveBatchBtn.className = "px-3.5 py-2 rounded-xl font-bold text-xs bg-emerald-600 text-white shadow-sm shrink-0 hover:bg-emerald-700";
      saveBatchBtn.classList.remove('hidden');
    } else {
      batchBtn.className = "px-3.5 py-2 rounded-xl font-bold text-xs bg-theme text-white shadow-sm shrink-0 hover:bg-theme-hover";
      batchBtn.innerText = "수정";
      saveBatchBtn.classList.add('hidden');
    }
  }

  ['storeName', 'status', 'platformName', 'visitDate', 'deadlineDate', 'sponsoredAmount', 'paidAmount', 'revenue'].forEach(c => {
    const el = document.getElementById("sortInd_" + c); if (el) el.innerHTML = getSortIndicatorHtml(c);
  });

  let filtered = rawCampaignList.filter(item => {
    const isCompleted = (getEffectiveStatus(item) === '제출' || getEffectiveStatus(item) === '완료');
    if (listSubTab === 'ongoing' && isCompleted) return false;
    if (listSubTab === 'submitted' && !isCompleted) return false;
    const mName = (item.storeName || '').toLowerCase().includes(searchText) || (item.platformName || '').toLowerCase().includes(searchText);
    const mStatus = (filterStatus === 'ALL') || (getEffectiveStatus(item) === filterStatus);
    const refD = formatCleanDate(item.visitDate || item.deadlineDate || item.applyDate || '');
    let mY = true, mM = true;
    if (refD && refD.length >= 7) {
      if (filterYear !== 'ALL' && refD.slice(0, 4) !== filterYear) mY = false;
      if (filterMonth !== 'ALL' && String(Number(refD.slice(5, 7))) !== filterMonth) mM = false;
    } else if (filterYear !== 'ALL' || filterMonth !== 'ALL') { mY = false; }
    return mName && mStatus && mY && mM;
  });

  if (sortColumn !== 'none') {
    filtered.sort((a, b) => {
      let vA = a[sortColumn] || '', vB = b[sortColumn] || '';
      if (['sponsoredAmount', 'paidAmount', 'revenue'].includes(sortColumn)) { vA = Number(vA) || 0; vB = Number(vB) || 0; }
      return sortAsc ? (vA < vB ? -1 : 1) : (vA > vB ? -1 : 1);
    });
  }

  if (tableBody) tableBody.innerHTML = '';
  if (cardList) cardList.innerHTML = '';

  filtered.forEach(item => {
    const effSt = getEffectiveStatus(item);
    const overdue = isItemOverdue(item);
    const isCompleted = (effSt === '제출' || effSt === '완료');
    const sp = Number(item.sponsoredAmount || 0), pd = Number(item.paidAmount || 0), rev = Number(item.revenue || 0);
    const calcRev = pd === 0 ? (sp > 0 ? sp : rev) : ((sp - pd) + rev);
    const overdueBadge = overdue ? '<span class="text-rose-500 font-bold text-[10px] md:text-[11px] ml-1.5 shrink-0">[상태확인]</span>' : '';

    if (isBatchEditing) {
      const row = document.createElement('tr');
      row.className = 'bg-amber-50/60 border-b border-amber-200 text-xs text-gray-900';
      row.innerHTML = `<td class="py-1 px-2.5 truncate"><input type="text" id="batch_store_${item.id}" value="${item.storeName || ''}" class="w-full border p-1 rounded-lg outline-none text-xs bg-white font-normal">${overdueBadge}</td>`
        + `<td class="py-1 px-1 text-center"><select id="batch_status_${item.id}" style="color:${window.getStatusColor(item.status)}; font-weight:600;" class="w-full border py-1 px-0.5 rounded-lg text-xs bg-white text-center"><option value="신청" ${item.status==='신청'?'selected':''}>신청</option><option value="선정" ${item.status==='선정'?'selected':''}>선정</option><option value="방문" ${item.status==='방문'?'selected':''}>방문</option><option value="미제출" ${item.status==='미제출'?'selected':''}>미제출</option><option value="제출" ${item.status==='제출'?'selected':''}>제출</option><option value="배송" ${item.status==='배송'?'selected':''}>배송</option><option value="원고료" ${item.status==='원고료'?'selected':''}>원고료</option></select></td>`
        + `<td class="py-1 px-2 text-center truncate"><input type="text" id="batch_platform_${item.id}" value="${item.platformName || ''}" class="w-full border p-1 rounded-lg text-xs bg-white text-center"></td>`
        + `<td class="py-1 px-2 text-center"><input type="date" id="batch_visitDate_${item.id}" value="${formatCleanDate(item.visitDate)}" class="border p-1 rounded-lg text-xs bg-white w-full"><input type="hidden" id="batch_visitTime_${item.id}" value="${item.visitTime || ''}"></td>`
        + `<td class="py-1 px-2 text-center"><input type="date" id="batch_deadlineDate_${item.id}" value="${formatCleanDate(item.deadlineDate)}" class="w-full border p-1 rounded-lg text-xs bg-white"></td>`
        + `<td class="py-1 px-2 text-right"><input type="text" id="batch_sponsored_${item.id}" value="${formatCurrencyInput(sp)}" class="w-full border p-1 rounded-lg text-xs bg-white text-right"></td>`
        + `<td class="py-1 px-2 text-right"><input type="text" id="batch_paid_${item.id}" value="${formatCurrencyInput(pd)}" class="w-full border p-1 rounded-lg text-xs bg-white text-right"></td>`
        + `<td class="py-1 px-2 text-right truncate font-bold text-gray-900">${formatRevenueDisplay(calcRev)}</td>`
        + `<td class="py-1 px-2 text-center"><button onclick="window.deleteCampaign('${item.id}')" class="text-xs bg-rose-500 text-white px-2 py-1 rounded-lg font-bold">삭제</button></td>`;
      tableBody?.appendChild(row);
    } else {
      const statusSelect = `<select onchange="window.quickUpdateStatus('${item.id}', this.value); this.style.color = window.getStatusColor(this.value);" style="color:${window.getStatusColor(effSt)}; font-weight:600;" class="border-0 bg-transparent text-xs outline-none cursor-pointer text-center"><option value="신청" ${effSt==='신청'?'selected':''}>신청</option><option value="선정" ${effSt==='선정'?'selected':''}>선정</option><option value="방문" ${effSt==='방문'?'selected':''}>방문</option><option value="미제출" ${effSt==='미제출'?'selected':''}>미제출</option><option value="제출" ${effSt==='제출'?'selected':''}>제출</option><option value="배송" ${effSt==='배송'?'selected':''}>배송</option><option value="원고료" ${effSt==='원고료'?'selected':''}>원고료</option></select>`;
      const row = document.createElement('tr');
      row.className = 'border-b border-gray-100 hover:bg-theme-light text-xs text-gray-900 font-normal';
      row.innerHTML = `<td class="py-2.5 px-3 cursor-pointer hover:underline hover:text-theme truncate" onclick="window.openDetailItemModal('${item.id}')">${item.storeName}${overdueBadge}</td>`
        + `<td class="py-2.5 px-1 text-center">${statusSelect}</td>`
        + `<td class="py-2.5 px-2 text-center truncate">${item.platformName || '-'}</td>`
        + `<td class="py-2.5 px-2 text-center truncate">${formatShortDate(item.visitDate)}</td>`
        + `<td class="py-2.5 px-2 text-center truncate">${formatShortDate(item.deadlineDate)}</td>`
        + `<td class="py-2.5 px-2 text-right truncate">${sp.toLocaleString()}원</td>`
        + `<td class="py-2.5 px-2 text-right truncate">${pd.toLocaleString()}원</td>`
        + `<td class="py-2.5 px-2 text-right truncate ${isCompleted ? 'text-gray-900 font-bold' : 'text-gray-400'}">${formatRevenueDisplay(calcRev)}${isCompleted ? '' : ' (예상)'}</td>`
        + `<td class="py-2.5 px-2 text-center text-gray-400 truncate">${isCompleted ? '정산완료' : '미정산'}</td>`;
      tableBody?.appendChild(row);
    }

    const card = document.createElement('div');
    card.className = 'bg-white p-3.5 rounded-2xl shadow-sm border border-gray-100 space-y-1.5 text-xs text-gray-900 cursor-pointer hover:border-theme transition-colors w-full';
    card.onclick = () => window.openDetailItemModal(item.id);
    card.innerHTML = `<div class="flex justify-between items-center"><div class="flex items-center gap-1 min-w-0 pr-2"><h3 class="font-bold text-xs text-gray-900 truncate">${item.storeName}</h3>${overdueBadge}</div><span class="text-xs font-bold text-gray-900 shrink-0">${sp.toLocaleString()}원</span></div>`
      + `<div class="flex justify-between items-center text-[11px] text-gray-500 font-normal"><div class="flex items-center gap-2"><span style="color:${window.getStatusColor(effSt)};" class="font-bold">${displayStatusName(effSt)}</span><span>방문: ${formatShortDate(item.visitDate)}</span><span>마감: ${formatShortDate(item.deadlineDate)}</span></div><span class="text-gray-300">›</span></div>`;
    cardList?.appendChild(card);
  });

  if (isBatchEditing) {
    newBatchRows.forEach((row, idx) => {
      const nRow = document.createElement('tr');
      nRow.className = 'bg-amber-50/60 border-b border-amber-200 text-xs text-gray-900';
      nRow.innerHTML = `<td class="py-1 px-2 truncate"><input type="text" id="new_batch_store_${idx}" placeholder="+ 매장명 입력" class="w-full border p-1 rounded-lg text-xs bg-white"></td>`
        + `<td class="py-1 px-1 text-center"><select id="new_batch_status_${idx}" class="w-full border py-1 px-0.5 rounded-lg text-xs bg-white text-center"><option value="신청">신청</option><option value="선정" selected>선정</option><option value="방문">방문</option><option value="미제출">미제출</option><option value="제출">제출</option><option value="배송">배송</option><option value="원고료">원고료</option></select></td>`
        + `<td class="py-1 px-2 text-center truncate"><input type="text" id="new_batch_platform_${idx}" value="개별" class="w-full border p-1 rounded-lg text-xs bg-white text-center"></td>`
        + `<td class="py-1 px-2 text-center"><input type="date" id="new_batch_visitDate_${idx}" class="border p-1 rounded-lg text-xs bg-white w-full"></td>`
        + `<td class="py-1 px-2 text-center"><input type="date" id="new_batch_deadlineDate_${idx}" class="w-full border p-1 rounded-lg text-xs bg-white"></td>`
        + `<td class="py-1 px-2 text-right"><input type="text" id="new_batch_sponsored_${idx}" placeholder="0" class="w-full border p-1 rounded-lg text-xs bg-white text-right"></td>`
        + `<td class="py-1 px-2 text-right"><input type="text" id="new_batch_paid_${idx}" placeholder="0" class="w-full border p-1 rounded-lg text-xs bg-white text-right"></td>`
        + `<td class="py-1 px-2 text-right text-gray-400 truncate">자동계산</td>`
        + `<td class="py-1 px-2 text-center"><button onclick="window.removeNewBatchRow(${idx})" class="text-xs bg-gray-400 text-white px-2 py-1 rounded-lg font-bold">취소</button></td>`;
      tableBody?.appendChild(nRow);
    });
    const addRow = document.createElement('tr');
    addRow.innerHTML = '<td colspan="9" class="p-3 text-center bg-gray-50/80"><button onclick="window.addNewBatchRow()" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors">+ 새 체험 추가</button></td>';
    tableBody?.appendChild(addRow);
  }

  if (filtered.length === 0 && !isBatchEditing) {
    if (tableBody) tableBody.innerHTML = '<tr><td colspan="9"><div class="p-8 text-center text-gray-400 text-xs font-normal">조건에 해당하는 체험단이 없습니다.</div></td></tr>';
    if (cardList) cardList.innerHTML = '<div class="bg-white p-8 rounded-2xl border border-gray-100 text-center text-gray-400 text-xs font-normal shadow-sm">조건에 해당하는 체험단이 없습니다.</div>';
  }
};

window.renderCalendar = function(year, month) {
  const calGrid = document.getElementById('calendarGrid');
  if (!calGrid) return;
  calGrid.innerHTML = '';
  const firstDay = new Date(year, month - 1, 1).getDay();
  const lastDate = new Date(year, month, 0).getDate();
  ['일', '월', '화', '수', '목', '금', '토'].forEach((d, idx) => {
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

    let bHtml = '';
    if (visitMatches.length > 0) bHtml += `<div class="text-[9px] sm:text-[10px] md:text-[11px] text-emerald-600 font-bold text-left whitespace-nowrap leading-tight mt-0.5">🟢 <span class="hidden sm:inline">방문 </span>${visitMatches.length}건</div>`;
    if (deadlineMatches.length > 0) bHtml += `<div class="text-[9px] sm:text-[10px] md:text-[11px] text-rose-500 font-bold text-left whitespace-nowrap leading-tight mt-0.5">🔴 <span class="hidden sm:inline">마감 </span>${deadlineMatches.length}건</div>`;

    dayCell.innerHTML = `<div class="text-[9px] sm:text-[10px] md:text-[11px] font-bold text-gray-500 pl-0.5 mb-0.5 text-left">${date}</div><div class="space-y-0.5 w-full flex flex-col pl-0.5">${bHtml}</div>`;
    const matched = rawCampaignList.filter(c => formatCleanDate(c.visitDate) === dateStr || (formatCleanDate(c.deadlineDate) === dateStr && c.status !== '신청'));
    dayCell.onclick = () => window.openDayModal(dateStr, matched);
    calGrid.appendChild(dayCell);
  }
};

window.renderDashboardView = function() {
  const year = currentCalDate.getFullYear();
  const month = currentCalDate.getMonth() + 1;
  const monthPrefix = year + "-" + String(month).padStart(2, '0');
  const titleEl = document.getElementById('dashMonthTitle');
  if (titleEl) titleEl.innerText = `${year}년 ${month}월`;

  let cntSelect = 0, cntVisitWait = 0, cntVisitPlan = 0, cntSubmitWait = 0, cntSubmitDone = 0;
  const now = new Date(); now.setHours(0, 0, 0, 0);

  rawCampaignList.forEach(item => {
    const st = getEffectiveStatus(item);
    if (st === '제출' || st === '완료') {
      const refD = formatCleanDate(item.visitDate || item.deadlineDate || item.applyDate || '');
      if (refD && refD.startsWith(monthPrefix)) cntSubmitDone++;
      return;
    }
    cntSelect++;
    if (isItemOverdue(item) || st === '미제출') cntSubmitWait++;
    if ((st === '선정' || st === '방문') && !item.visitDate) cntVisitWait++;
    if ((st === '선정' || st === '방문') && item.visitDate) {
      const vD = new Date(formatCleanDate(item.visitDate)); vD.setHours(0, 0, 0, 0);
      if (vD >= now) cntVisitPlan++;
    }
  });

  const setT = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
  setT('cntSelect', cntSelect + '건'); setT('cntVisitWait', cntVisitWait + '건');
  setT('cntVisitPlan', cntVisitPlan + '건'); setT('cntSubmitWait', cntSubmitWait + '건'); setT('cntSubmitDone', cntSubmitDone + '건');

  window.renderCalendar(year, month);
  renderUpcomingDeadlines();
  renderAllScheduledVisits();
};

window.renderSettlementView = function() {
  const yearSelect = document.getElementById('settlementYearSelect');
  const selectedYearVal = yearSelect ? yearSelect.value : 'ALL';
  const now = new Date();
  const actualRealYear = now.getFullYear();
  const actualRealMonth = now.getMonth() + 1;
  const targetYear = selectedYearVal === 'ALL' ? actualRealYear : parseInt(selectedYearVal);
  const isCurrentYear = (targetYear === actualRealYear);

  const lbl = document.getElementById('yearlyAccumulatedLabel');
  if (lbl) lbl.innerText = selectedYearVal === 'ALL' ? '누적 총 수익' : targetYear + "년 누적";

  const chartColors = getActiveChartColors();
  let doneCount = 0, doneAmount = 0, planCount = 0, planAmount = 0, prevDoneAmount = 0, hasPrevYearData = false;
  const monthlyRevenues = new Array(12).fill(0), monthlyCounts = new Array(12).fill(0), platformMap = {};
  const monthlyDetailsData = {}; for(let m = 1; m <= 12; m++) monthlyDetailsData[m] = [];

  rawCampaignList.forEach(item => {
    const sp = Number(item.sponsoredAmount || 0), pd = Number(item.paidAmount || 0), rev = Number(item.revenue || 0);
    const calcRev = pd === 0 ? (sp > 0 ? sp : rev) : ((sp - pd) + rev);
    const refD = formatCleanDate(item.visitDate || '');
    if (!refD || refD.length < 7) return;
    const iYear = parseInt(refD.slice(0, 4)), iMonth = parseInt(refD.slice(5, 7));
    const isCompleted = (getEffectiveStatus(item) === '제출' || getEffectiveStatus(item) === '완료');
    const pName = item.platformName || '개별';

    if (selectedYearVal === 'ALL' || iYear === targetYear) {
      if (!platformMap[pName]) platformMap[pName] = { doneCount: 0, doneAmount: 0 };
      if (isCompleted) {
        doneCount++; doneAmount += calcRev;
        platformMap[pName].doneCount++; platformMap[pName].doneAmount += calcRev;
        if (iMonth >= 1 && iMonth <= 12) {
          monthlyRevenues[iMonth - 1] += calcRev; monthlyCounts[iMonth - 1]++;
          monthlyDetailsData[iMonth].push({ storeName: item.storeName || '미지정', sponsoredAmount: sp, paidAmount: pd, revenueAmount: calcRev, sortRefDate: refD });
        }
      } else { planCount++; planAmount += calcRev; }
    }
    if (iYear === targetYear - 1) { hasPrevYearData = true; if (isCompleted) prevDoneAmount += calcRev; }
  });

  const totalAmount = doneAmount + planAmount;
  const setT = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
  setT('yearlyTotalRevenueText', totalAmount.toLocaleString() + "원");
  setT('yearlyDoneCount', doneCount + "건"); setT('yearlyDoneAmount', doneAmount.toLocaleString() + "원");
  setT('yearlyPlanCount', planCount + "건"); setT('yearlyPlanAmount', planAmount.toLocaleString() + "원");

  const diffAmount = doneAmount - prevDoneAmount;
  const cmpContainer = document.getElementById('yearlyCompareContainer');
  if (cmpContainer) {
    if (!hasPrevYearData) {
      cmpContainer.innerHTML = '<div class="flex items-center gap-1.5"><span class="text-[10px] sm:text-[11px] text-gray-400 shrink-0">전년 대비</span><span class="text-[10px] sm:text-[11px] text-gray-400">데이터 없음</span></div>';
    } else {
      const rate = prevDoneAmount === 0 ? 100 : ((diffAmount / prevDoneAmount) * 100).toFixed(1);
      cmpContainer.innerHTML = `
        <div class="flex flex-col gap-0.5">
          <span class="text-[10px] text-gray-400 font-normal">전년 대비 증가</span>
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="font-bold text-gray-900 text-xs sm:text-sm">${diffAmount >= 0 ? '+' : ''}${diffAmount.toLocaleString()}원</span>
            <span class="px-1.5 py-0.5 rounded-full text-[10px] font-bold ${diffAmount >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}">${diffAmount >= 0 ? '+' : ''}${rate}%</span>
          </div>
        </div>`;
    }
  }

  // 1. 연간 도넛 차트
  try {
    const ctxY = document.getElementById('yearlyDonutChart')?.getContext('2d');
    if (ctxY) {
      if (yearlyChartInstance) yearlyChartInstance.destroy();
      yearlyChartInstance = new Chart(ctxY, {
        type: 'doughnut',
        data: { labels: ['정산 완료', '정산 예정'], datasets: [{ data: totalAmount === 0 ? [1, 0] : [doneAmount, planAmount], backgroundColor: totalAmount === 0 ? ['#E5E7EB', '#F3F4F6'] : [chartColors.main, chartColors.pending], borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, animation: false, cutout: '72%', plugins: { legend: { display: false } } }
      });
    }
  } catch(e) {}

  // 2. 월간 막대 차트
  try {
    let maxRevVal = 0, maxMonthIdx = 0;
    monthlyRevenues.forEach((v, idx) => { if (v > maxRevVal) { maxRevVal = v; maxMonthIdx = idx; } });
    if (document.getElementById('monthlyBestMonthText')) document.getElementById('monthlyBestMonthText').innerText = maxRevVal === 0 ? '-' : `${maxMonthIdx + 1}월 · ${maxRevVal.toLocaleString()}원`;
    if (document.getElementById('monthlyCurrentMonthText')) document.getElementById('monthlyCurrentMonthText').innerText = (isCurrentYear && totalAmount > 0) ? `${actualRealMonth}월 · ${(monthlyRevenues[actualRealMonth - 1] || 0).toLocaleString()}원` : '-';

    const ctxM = document.getElementById('monthlyBarChart')?.getContext('2d');
    if (ctxM) {
      if (monthlyChartInstance) monthlyChartInstance.destroy();
      monthlyChartInstance = new Chart(ctxM, {
        type: 'bar',
        data: { labels: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'], datasets: [{ data: monthlyRevenues.map(v => Number((v / 10000).toFixed(1))), backgroundColor: chartColors.main, borderRadius: 4, barPercentage: 0.65 }] },
        plugins: (window.ChartDataLabels ? [window.ChartDataLabels] : []),
        options: { responsive: true, maintainAspectRatio: false, animation: false, layout: { padding: { top: 16, bottom: 2, left: 2, right: 2 } }, scales: { x: { grid: { display: false }, ticks: { font: { size: 9 }, color: '#6B7280', padding: 2 } }, y: { display: false } }, plugins: { legend: { display: false }, datalabels: { anchor: 'end', align: 'end', offset: 1, font: { size: 9 }, formatter: v => v > 0 ? v : '' } } }
      });
    }
  } catch(e) {}

  // 3. 월간 분석 꺾은선 차트
  try {
    let maxCountVal = 0, maxCountMonthIdx = 0;
    monthlyCounts.forEach((v, idx) => { if (v > maxCountVal) { maxCountVal = v; maxCountMonthIdx = idx; } });
    if (document.getElementById('monthlyAnalysisBestText')) document.getElementById('monthlyAnalysisBestText').innerText = maxCountVal === 0 ? '-' : `${maxCountMonthIdx + 1}월 · ${maxCountVal}건`;
    if (document.getElementById('monthlyAnalysisCurrentText')) document.getElementById('monthlyAnalysisCurrentText').innerText = isCurrentYear ? `${actualRealMonth}월 · ${monthlyCounts[actualRealMonth - 1] || 0}건` : '-';

    const ctxMA = document.getElementById('monthlyAnalysisLineChart')?.getContext('2d');
    if (ctxMA) {
      if (monthlyAnalysisChartInstance) monthlyAnalysisChartInstance.destroy();
      monthlyAnalysisChartInstance = new Chart(ctxMA, {
        type: 'line',
        data: { labels: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'], datasets: [{ data: monthlyCounts, borderColor: chartColors.main, borderWidth: 2.2, pointBackgroundColor: chartColors.main, pointRadius: 3.5, tension: 0.25, fill: false }] },
        plugins: (window.ChartDataLabels ? [window.ChartDataLabels] : []),
        options: { responsive: true, maintainAspectRatio: false, animation: false, layout: { padding: { top: 16, bottom: 2, left: 4, right: 4 } }, scales: { x: { grid: { display: false }, ticks: { font: { size: 9 }, color: '#6B7280', padding: 2 } }, y: { display: false } }, plugins: { legend: { display: false }, datalabels: { anchor: 'end', align: 'end', offset: 1, font: { size: 9 }, formatter: v => v > 0 ? v : '' } } }
      });
    }
  } catch(e) {}

  // 4. 플랫폼 분석
  try {
    const pLeft = document.getElementById('platformColLeft'), pRight = document.getElementById('platformColRight');
    if (pLeft && pRight) {
      pLeft.innerHTML = ''; pRight.innerHTML = '';
      const sortedP = Object.keys(platformMap).map(n => ({ n, ...platformMap[n] })).filter(p => p.doneCount > 0).sort((a,b) => b.doneCount - a.doneCount);
      const half = Math.ceil(sortedP.length / 2);
      sortedP.forEach((p, idx) => {
        const itemD = document.createElement('div');
        itemD.className = "flex items-center justify-between text-xs py-1 px-0.5";
        const maxCnt = sortedP[0].doneCount || 1;
        const bPercent = Math.max(12, Math.round((p.doneCount / maxCnt) * 100));
        itemD.innerHTML = `
          <span class="font-medium text-gray-800 truncate w-16 sm:w-20 shrink-0 text-xs">${p.n}</span>
          <div class="flex-1 mx-2 sm:mx-3 bg-gray-100 h-2 rounded-full overflow-hidden">
            <div class="h-full rounded-full transition-all" style="width:${bPercent}%; background-color:${chartColors.main};"></div>
          </div>
          <div class="flex items-center gap-1 shrink-0 text-right">
            <span class="w-8 sm:w-10 text-right text-gray-400 text-[11px] font-normal">${p.doneCount}건</span>
            <span class="w-20 sm:w-24 text-right text-gray-900 font-bold text-xs">${p.doneAmount.toLocaleString()}원</span>
          </div>`;
        (idx < half ? pLeft : pRight).appendChild(itemD);
      });
      if (sortedP.length === 0) pLeft.innerHTML = '<div class="text-xs text-gray-400 py-6 text-center font-normal col-span-2">데이터가 없습니다.</div>';
    }
  } catch(e) {}

  // 5. 세부 내역
  try {
    const mGrid = document.getElementById('monthlyDetailsGrid');
    if (mGrid) {
      mGrid.innerHTML = '';
      for (let m = 1; m <= 12; m++) {
        const list = monthlyDetailsData[m];
        list.sort((a, b) => a.sortRefDate.localeCompare(b.sortRefDate));
        const isCollapsed = monthlyDetailsCollapseState[m] !== false;
        const totalC = list.length, totalR = list.reduce((s, i) => s + i.revenueAmount, 0);

        const cardD = document.createElement('div');
        cardD.className = "bg-white p-3.5 sm:p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between";
        let htm = `<div onclick="window.toggleMonthlyDetailsCard(${m})" class="flex justify-between items-center h-[34px] pb-1.5 border-b border-gray-100 cursor-pointer select-none">
          <span class="text-xs sm:text-sm font-bold text-gray-800">${m}월</span>
          <div class="flex items-center gap-2">
            <span class="text-xs text-gray-900 font-normal">${totalC}건 · ${totalR.toLocaleString()}원</span>
            <span class="text-xs text-gray-400 font-bold">${isCollapsed ? '▼' : '▲'}</span>
          </div>
        </div>`;

        if (!isCollapsed) {
          htm += '<div class="mt-2.5 flex-1 flex flex-col justify-between space-y-2">';
          if (list.length === 0) {
            htm += '<div class="text-center text-gray-300 font-normal py-6 text-xs">이 달의 완료된 체험이 없습니다.</div>';
          } else {
            htm += '<div class="flex items-center justify-between text-[10px] text-gray-400 font-normal pb-1 border-b border-gray-100"><span class="w-1/2 text-left">매장명</span><span class="w-1/4 text-right">제공금액</span><span class="w-1/4 text-right">결제금액</span></div>';
            htm += '<div class="space-y-1.5 max-h-[200px] overflow-y-auto widget-scroll pr-1">';
            list.forEach(i => {
              htm += `<div class="flex justify-between items-center text-xs py-1 border-b border-dashed border-gray-50">
                <span class="truncate w-1/2 font-medium text-gray-800" title="${i.storeName}">${i.storeName}</span>
                <span class="w-1/4 text-right text-gray-500 text-[11px]">${i.sponsoredAmount.toLocaleString()}원</span>
                <span class="w-1/4 text-right text-gray-900 font-bold text-xs">${Number(i.paidAmount || 0).toLocaleString()}원</span>
              </div>`;
            });
            htm += '</div>';
          }
          htm += `<div class="mt-2.5 p-2.5 bg-gray-50/80 rounded-xl flex justify-between items-center border border-gray-100/60 shrink-0 px-3 text-xs">
            <span class="text-gray-500 font-normal text-[11px]">소계 <b class="text-gray-900 font-bold ml-1">${totalC}건</b></span>
            <span class="text-gray-500 font-normal text-[11px]">실수익 <b class="text-gray-900 font-bold ml-1">${totalR.toLocaleString()}원</b></span>
          </div>`;
          htm += '</div>';
        }
        cardD.innerHTML = htm;
        mGrid.appendChild(cardD);
      }
    }
  } catch(e) {}
};

function renderUpcomingDeadlines() {
  const c = document.getElementById('upcomingList'); if (!c) return; c.innerHTML = '';
  const now = new Date(); now.setHours(0,0,0,0);
  const list = rawCampaignList.filter(item => {
    const st = getEffectiveStatus(item);
    if (!item.deadlineDate || st === '제출' || st === '완료' || st === '신청') return false;
    const dD = new Date(formatCleanDate(item.deadlineDate));
    const diff = Math.ceil((dD - now) / 86400000);
    return diff <= deadlineAlertDays;
  });
  if (list.length === 0) { c.innerHTML = '<div class="text-xs text-gray-400 py-4 text-center">마감 임박 일정이 없습니다.</div>'; return; }
  list.forEach(i => {
    const div = document.createElement('div');
    div.className = 'p-2.5 bg-white rounded-xl border border-gray-100 flex items-center justify-between text-xs cursor-pointer hover:border-theme shadow-sm';
    div.onclick = () => window.openDetailItemModal(i.id);
    div.innerHTML = `<div><span class="text-gray-900">${i.storeName}</span><span class="text-[11px] text-gray-400 ml-1.5">(${formatShortDate(i.deadlineDate)})</span></div><span class="px-2 py-0.5 rounded-lg text-[10px] bg-rose-500 text-white font-normal">마감</span>`;
    c.appendChild(div);
  });
}

function renderAllScheduledVisits() {
  const vC = document.getElementById('scheduledVisitList'), uC = document.getElementById('unscheduledVisitList');
  if (vC) {
    vC.innerHTML = '';
    const now = new Date(); now.setHours(0,0,0,0);
    const list = rawCampaignList.filter(c => c.visitDate && (getEffectiveStatus(c) !== '제출' && getEffectiveStatus(c) !== '완료') && new Date(formatCleanDate(c.visitDate)) >= now);
    if (list.length === 0) vC.innerHTML = '<div class="text-xs text-gray-400 py-4 text-center">예정된 방문 일정이 없습니다.</div>';
    else list.forEach(i => {
      const d = document.createElement('div');
      d.className = 'p-2.5 bg-white rounded-xl border border-gray-100 text-xs cursor-pointer hover:border-theme shadow-sm';
      d.onclick = () => window.openDetailItemModal(i.id);
      d.innerHTML = `<div class="text-gray-600 text-[11px]">${formatShortDate(i.visitDate)} ${i.visitTime || ''}</div><div class="text-gray-900 font-bold text-sm truncate">${i.storeName}</div>`;
      vC.appendChild(d);
    });
  }
  if (uC) {
    uC.innerHTML = '';
    const list = rawCampaignList.filter(c => (getEffectiveStatus(c) === '선정' || getEffectiveStatus(c) === '방문') && !c.visitDate);
    if (list.length === 0) uC.innerHTML = '<div class="text-xs text-gray-400 py-4 text-center">일정 미지정 항목이 없습니다.</div>';
    else list.forEach(i => {
      const d = document.createElement('div');
      d.className = 'p-2.5 bg-white rounded-xl border border-gray-100 flex justify-between items-center text-xs cursor-pointer hover:border-theme shadow-sm';
      d.onclick = () => window.openDetailItemModal(i.id);
      d.innerHTML = `<span class="truncate mr-2">${i.storeName}</span>` + (!isReadOnly ? `<button onclick="event.stopPropagation(); window.openEditModalFromId('${i.id}')" class="shrink-0 text-[10px] bg-theme text-white px-2 py-1 rounded-lg">일정 잡기</button>` : '');
      uC.appendChild(d);
    });
  }
}

window.openCounterListModal = function(counterType, titleName) {
  const now = new Date(); now.setHours(0,0,0,0);
  const mPrefix = currentCalDate.getFullYear() + "-" + String(currentCalDate.getMonth() + 1).padStart(2, '0');
  let matched = rawCampaignList.filter(c => {
    const st = getEffectiveStatus(c);
    if (counterType === 'select') return st !== '제출' && st !== '완료';
    if (counterType === 'visitWait') return (st === '선정' || st === '방문') && !c.visitDate;
    if (counterType === 'visitPlan') return (st === '선정' || st === '방문') && c.visitDate && new Date(formatCleanDate(c.visitDate)) >= now;
    if (counterType === 'submitWait') return st !== '제출' && st !== '완료' && (isItemOverdue(c) || st === '미제출');
    if (counterType === 'submitDone') return (st === '제출' || st === '완료') && (formatCleanDate(c.visitDate || c.deadlineDate || c.applyDate || '').startsWith(mPrefix));
    return false;
  });

  const mTitle = document.getElementById('modalDateTitle'); if (mTitle) mTitle.innerText = `[${titleName}] (${matched.length}건)`;
  const mList = document.getElementById('modalItemList');
  if (mList) {
    mList.innerHTML = matched.length === 0 ? '<div class="text-xs text-gray-400 py-6 text-center">항목이 없습니다.</div>' : '';
    matched.forEach(i => {
      const d = document.createElement('div');
      d.className = 'p-3.5 bg-white rounded-2xl border border-gray-100 text-xs shadow-sm cursor-pointer hover:border-theme';
      d.onclick = () => window.openDetailItemModal(i.id);
      d.innerHTML = `<div class="flex justify-between items-center"><span class="font-bold text-gray-900">${i.storeName}</span><span style="color:${window.getStatusColor(getEffectiveStatus(i))};" class="font-bold">${displayStatusName(getEffectiveStatus(i))}</span></div><div class="text-gray-400 text-[11px] mt-1">${i.platformName || '개별'} | ${formatShortDate(i.visitDate || i.deadlineDate)}</div>`;
      mList.appendChild(d);
    });
  }
  document.getElementById('dayModal')?.classList.remove('hidden');
};

window.openDayModal = function(dateStr, items) {
  document.getElementById('modalDateTitle').innerText = `${dateStr} 일정 상세`;
  const mList = document.getElementById('modalItemList');
  if (mList) {
    mList.innerHTML = items.length === 0 ? '<div class="text-xs text-gray-400 py-6 text-center">등록된 일정이 없습니다.</div>' : '';
    items.forEach(i => {
      const d = document.createElement('div');
      d.className = 'p-3.5 bg-white rounded-2xl border border-gray-100 text-xs shadow-sm cursor-pointer hover:border-theme';
      d.onclick = () => window.openDetailItemModal(i.id);
      d.innerHTML = `<div class="flex justify-between items-center"><span class="font-bold text-gray-900">${i.storeName}</span><span style="color:${window.getStatusColor(getEffectiveStatus(i))};" class="font-bold">${displayStatusName(getEffectiveStatus(i))}</span></div><div class="text-gray-400 text-[11px] mt-1">${i.platformName || '개별'}</div>`;
      mList.appendChild(d);
    });
  }
  document.getElementById('dayModal')?.classList.remove('hidden');
};

window.openDetailItemModal = function(id) {
  const item = rawCampaignList.find(c => c.id === id); if (!item) return;
  const effSt = getEffectiveStatus(item);
  document.getElementById('modalDateTitle').innerText = `${item.storeName} 상세 정보`;
  const mList = document.getElementById('modalItemList');
  if (mList) {
    mList.innerHTML = `<div class="p-4 bg-white rounded-2xl border border-gray-100 space-y-3 text-xs shadow-sm"><div class="flex justify-between items-center border-b pb-2"><span class="text-sm font-bold text-gray-900">${item.storeName}</span><span style="color:${window.getStatusColor(effSt)};" class="font-bold">${displayStatusName(effSt)}</span></div><div class="grid grid-cols-2 gap-2 text-gray-600"><div>체험단: <span class="font-normal text-gray-800">${item.platformName || '-'}</span></div><div>신청일: <span class="font-normal text-gray-800">${formatCleanDate(item.applyDate) || '-'}</span></div><div>방문일시: <span class="font-normal text-gray-800">${formatCleanDate(item.visitDate) || '미정'}</span></div><div>마감일: <span class="font-normal text-gray-800">${formatCleanDate(item.deadlineDate) || '미정'}</span></div><div>제공금액: <span class="font-normal text-gray-800">${Number(item.sponsoredAmount || 0).toLocaleString()}원</span></div><div>결제금액: <span class="font-normal text-gray-800">${Number(item.paidAmount || 0).toLocaleString()}원</span></div></div>` + (!isReadOnly ? `<button onclick="document.getElementById('dayModal').classList.add('hidden'); window.openEditModalFromId('${item.id}');" class="w-full bg-theme text-white py-2.5 rounded-xl font-bold mt-2">수정하기</button>` : '') + `</div>`;
  }
  document.getElementById('dayModal')?.classList.remove('hidden');
};

function populateYearFilter() {
  const yearSelect = document.getElementById('filterYear');
  const sYearSelect = document.getElementById('settlementYearSelect');
  if (!yearSelect) return;
  const currentY = new Date().getFullYear();
  const yearsSet = new Set([currentY, currentY - 1, 2025]);
  rawCampaignList.forEach(item => {
    [item.applyDate, item.visitDate, item.deadlineDate].forEach(d => {
      if (d && typeof d === 'string' && d.length >= 4) {
        const y = parseInt(d.slice(0, 4));
        if (!isNaN(y)) yearsSet.add(y);
      }
    });
  });
  const sortedYears = Array.from(yearsSet).sort((a, b) => b - a);

  yearSelect.innerHTML = '<option value="ALL">연도 전체</option>';
  if (sYearSelect) sYearSelect.innerHTML = '<option value="ALL">연도 전체 (누적)</option>';
  sortedYears.forEach(y => {
    const o = document.createElement('option'); o.value = y.toString(); o.innerText = `${y}년`; yearSelect.appendChild(o);
    if (sYearSelect) {
      const oS = document.createElement('option'); oS.value = y.toString(); oS.innerText = `${y}년 전체`;
      if (y === currentY) oS.selected = true;
      sYearSelect.appendChild(oS);
    }
  });
}

function updateFormVisibility() {
  const rBadge = document.getElementById('readOnlyBadge');
  const dRegBtn = document.getElementById('dashRegisterBtn');
  document.querySelectorAll('.reset-data-btn').forEach(b => b.classList.toggle('hidden', !isReadOnly));
  document.querySelectorAll('#nav-form, #bottom-nav-form, #nav-settings, #bottom-nav-settings, .excel-down-btn').forEach(el => el.classList.toggle('hidden', isReadOnly));
  rBadge?.classList.toggle('hidden', !isReadOnly);
  dRegBtn?.classList.toggle('hidden', isReadOnly);
}

async function fetchUserCustomCode() {
  if (!currentUser) return;
  try {
    const uSnap = await getDoc(doc(db, "users", currentUser.uid));
    if (uSnap.exists()) {
      const d = uSnap.data();
      if (d.customCode) { myCustomCode = d.customCode; localStorage.setItem('onlyview_customCode', myCustomCode); }
      if (d.deadlineAlertDays) { deadlineAlertDays = d.deadlineAlertDays; localStorage.setItem('onlyview_deadlineAlertDays', deadlineAlertDays.toString()); }
      if (d.shareSettlement !== undefined) { isSettlementShared = d.shareSettlement === true; localStorage.setItem('onlyview_shareSettlement', isSettlementShared.toString()); }
      if (d.platforms && Array.isArray(d.platforms) && d.platforms.length > 0) {
        platformList = d.platforms;
        localStorage.setItem('onlyview_platforms', JSON.stringify(platformList));
        renderPlatformChips();
      }
      if (d.theme) { applyThemeCSS(d.theme); localStorage.setItem('onlyview_theme', d.theme); }
      if (d.chartMode) { currentChartMode = d.chartMode; localStorage.setItem('onlyview_chartMode', d.chartMode); updateChartModeButtonsUI(); }
      if (d.statusColors) { 
        Object.assign(customStatusColors, d.statusColors); 
        localStorage.setItem('onlyview_statusColors', JSON.stringify(customStatusColors));
        applyStatusCSSColors(); 
        renderStatusColorPickers(); 
      }
    } else {
      myCustomCode = Math.floor(100000 + Math.random() * 900000).toString();
      await setDoc(doc(db, "users", currentUser.uid), { customCode: myCustomCode, uid: currentUser.uid, shareSettlement: false, theme: 'slate', chartMode: 'default', platforms: platformList }, { merge: true });
      await setDoc(doc(db, "userCodes", myCustomCode), { uid: currentUser.uid, shareSettlement: false });
    }
    renderSettingsUI();
  } catch (e) { console.error(e); }
}

window.refreshAllViews = function() {
  window.filterAndRender(); window.renderDashboardView(); window.renderSettlementView();
};

async function loadCampaigns() {
  if (!db || !targetUserId) return;
  try {
    const qSnap = await getDocs(query(collection(db, "campaigns"), where("userId", "==", targetUserId)));
    rawCampaignList = [];
    qSnap.forEach(s => {
      const d = s.data();
      rawCampaignList.push({ id: s.id, ...d, applyDate: formatCleanDate(d.applyDate || ''), visitDate: formatCleanDate(d.visitDate || ''), deadlineDate: formatCleanDate(d.deadlineDate || '') });
    });
    for (let m = 1; m <= 12; m++) {
      monthlyDetailsCollapseState[m] = true;
    }
    populateYearFilter();
    window.refreshAllViews();
  } catch (e) { console.error("데이터 로드 실패:", e); }
}

// 페이지 새로고침 시 기존 로그인 세션을 감지하여 자동 복원
onAuthStateChanged(auth, async (user) => {
  if (user) {
    if (!currentUser || currentUser.uid !== user.uid) {
      await handleUserLoggedIn(user);
    }
  } else if (!targetUserId) {
    currentUser = null;
    const authSec = document.getElementById('authSection');
    const appSec = document.getElementById('appSection');
    authSec?.classList.remove('hidden');
    appSec?.classList.add('hidden');
    appSec?.classList.remove('flex', 'lg:flex');
  }
});

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById('loginInviteCodeInput')?.addEventListener('keyup', e => { if (e.key === 'Enter') window.enterWithInviteCode(); });
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
    document.getElementById(id)?.addEventListener('input', e => e.target.value = formatCurrencyInput(e.target.value));
  });
  ['contact', 'editContact', 'modalContact'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', e => e.target.value = formatPhoneNumber(e.target.value));
  });

  document.getElementById('campaignForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    if (isReadOnly || !currentUser) return alert("읽기 전용 모드입니다.");
    try {
      await addDoc(collection(db, "campaigns"), {
        userId: currentUser.uid, storeName: document.getElementById('storeName')?.value || '', platformName: document.getElementById('platformName')?.value || '개별',
        status: selectedStatus, applyDate: formatCleanDate(document.getElementById('applyDate')?.value || ''), deadlineDate: formatCleanDate(document.getElementById('deadlineDate')?.value || ''),
        visitDate: formatCleanDate(document.getElementById('visitDate')?.value || ''), visitTime: document.getElementById('visitTime')?.value || '',
        companions: document.getElementById('companions')?.value || '', sponsoredAmount: parseCurrencyValue(document.getElementById('sponsoredAmount')?.value),
        paidAmount: parseCurrencyValue(document.getElementById('paidAmount')?.value), revenue: parseCurrencyValue(document.getElementById('revenue')?.value),
        contact: document.getElementById('contact')?.value || '', memo: document.getElementById('memo')?.value || '', createdAt: serverTimestamp()
      });
      alert('등록되었습니다!'); document.getElementById('campaignForm')?.reset(); window.setStatusBtn('신청'); window.selectPlatformChip('개별'); loadCampaigns();
    } catch (err) { alert(err.message); }
  });

  document.getElementById('modalCampaignForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    if (isReadOnly || !currentUser) return alert("읽기 전용 모드입니다.");
    try {
      await addDoc(collection(db, "campaigns"), {
        userId: currentUser.uid, storeName: document.getElementById('modalStoreName')?.value || '', platformName: document.getElementById('modalPlatformName')?.value || '개별',
        status: modalSelectedStatus, applyDate: formatCleanDate(document.getElementById('modalApplyDate')?.value || ''), deadlineDate: formatCleanDate(document.getElementById('modalDeadlineDate')?.value || ''),
        visitDate: formatCleanDate(document.getElementById('modalVisitDate')?.value || ''), visitTime: document.getElementById('modalVisitTime')?.value || '',
        companions: document.getElementById('modalCompanions')?.value || '', sponsoredAmount: parseCurrencyValue(document.getElementById('modalSponsoredAmount')?.value),
        paidAmount: parseCurrencyValue(document.getElementById('modalPaidAmount')?.value), revenue: parseCurrencyValue(document.getElementById('modalRevenue')?.value),
        contact: document.getElementById('modalContact')?.value || '', memo: document.getElementById('modalMemo')?.value || '', createdAt: serverTimestamp()
      });
      alert('등록되었습니다!'); window.closeDashRegisterModal(); loadCampaigns();
    } catch (err) { alert(err.message); }
  });

  document.getElementById('editForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    if (isReadOnly || !currentUser || !editingId) return;
    try {
      await updateDoc(doc(db, "campaigns", editingId), {
        storeName: document.getElementById('editStoreName')?.value || '', platformName: document.getElementById('editPlatformName')?.value || '',
        status: editSelectedStatus, deadlineDate: formatCleanDate(document.getElementById('editDeadlineDate')?.value || ''),
        visitDate: formatCleanDate(document.getElementById('editVisitDate')?.value || ''), visitTime: document.getElementById('editVisitTime')?.value || '',
        companions: document.getElementById('editCompanions')?.value || '', sponsoredAmount: parseCurrencyValue(document.getElementById('editSponsoredAmount')?.value),
        paidAmount: parseCurrencyValue(document.getElementById('editPaidAmount')?.value), revenue: parseCurrencyValue(document.getElementById('editRevenue')?.value),
        contact: document.getElementById('editContact')?.value || '', memo: document.getElementById('editMemo')?.value || '',
      });
      alert('수정되었습니다!'); document.getElementById('editModal')?.classList.add('hidden'); editingId = null; await loadCampaigns(); } catch (err) { alert(err.message); }
  });

  document.getElementById('editCodeBtn')?.addEventListener('click', async () => {
    if (isReadOnly) return alert("읽기 전용 모드입니다.");
    const newCode = prompt("새로운 공유 코드를 입력하세요 (4자리 또는 6자리):", myCustomCode);
    if (!newCode) return;
    const t = newCode.trim();
    if (t.length !== 4 && t.length !== 6) return alert("공유 코드는 4자리 또는 6자리여야 합니다.");
    try {
      const snap = await getDoc(doc(db, "userCodes", t));
      if (snap.exists() && snap.data().uid !== currentUser.uid) return alert("이미 사용 중인 코드입니다.");
      if (myCustomCode && myCustomCode !== t) { try { await deleteDoc(doc(db, "userCodes", myCustomCode)); } catch(e){} }
      await setDoc(doc(db, "userCodes", t), { uid: currentUser.uid, shareSettlement: isSettlementShared }, { merge: true });
      await setDoc(doc(db, "users", currentUser.uid), { customCode: t }, { merge: true });
      myCustomCode = t; localStorage.setItem('onlyview_customCode', myCustomCode); renderSettingsUI(); alert("변경되었습니다!");
    } catch(err) { alert(err.message); }
  });

  document.getElementById('applyPartnerCodeBtn')?.addEventListener('click', async () => {
    const pCode = document.getElementById('partnerCodeInput')?.value.trim();
    if (!pCode) return alert("코드를 입력해주세요.");
    try {
      const snap = await getDoc(doc(db, "userCodes", pCode));
      if (!snap.exists()) return alert("유효하지 않은 코드입니다.");
      const cData = snap.data();
      targetUserId = cData.uid;
      isSettlementShared = cData.shareSettlement === true;
      isReadOnly = !(currentUser && targetUserId === currentUser.uid);
      await loadTargetUserSettings(targetUserId);
      updateFormVisibility(); await loadCampaigns(); window.switchTab('dashboard');
    } catch(err) { alert("조회 실패: " + err.message); }
  });

  document.querySelectorAll('.reset-data-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!currentUser) return;
      targetUserId = currentUser.uid; isReadOnly = false;
      const pIn = document.getElementById('partnerCodeInput'); if(pIn) pIn.value = '';
      await loadTargetUserSettings(currentUser.uid); updateFormVisibility(); await loadCampaigns(); window.switchTab('dashboard');
    });
  });

  applySidebarUI(); renderPlatformChips(); renderSettingsUI(); populateYearFilter();
});
