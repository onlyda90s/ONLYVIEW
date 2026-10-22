import { store } from '../store.js';
import { db } from '../firebase-config.js';
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export function applyStatusCSSColors() {
  document.documentElement.style.setProperty('--color-status-apply', store.customStatusColors.apply);
  document.documentElement.style.setProperty('--color-status-select', store.customStatusColors.select);
  document.documentElement.style.setProperty('--color-status-visit', store.customStatusColors.visit || '#F4A261');
  document.documentElement.style.setProperty('--color-status-unsubmitted', store.customStatusColors.unsubmitted || '#E63946');
  document.documentElement.style.setProperty('--color-status-submit', store.customStatusColors.submit);
  document.documentElement.style.setProperty('--color-status-delivery', store.customStatusColors.delivery);
  document.documentElement.style.setProperty('--color-status-fee', store.customStatusColors.fee);
}

export function updateDeadlineButtons() {
  [7, 10, 14].forEach(d => {
    const btn = document.getElementById("btnDeadlineDay_" + d);
    if (btn) {
      if (d === store.deadlineAlertDays) btn.className = "deadline-btn py-1.5 px-3.5 rounded-lg font-bold border border-theme bg-theme text-white text-xs transition-colors shadow-sm";
      else btn.className = "deadline-btn py-1.5 px-3.5 rounded-lg font-normal border border-gray-200 bg-white text-gray-600 text-xs hover:border-gray-300 transition-colors";
    }
  });
}

export function updateChartModeButtonsUI() {
  ['default', 'light', 'outline', 'theme'].forEach(m => {
    const btn = document.getElementById("btnChartMode_" + m);
    if (btn) {
      if (m === store.currentChartMode) btn.className = "chart-mode-btn py-1.5 px-3.5 rounded-lg font-bold border border-theme bg-theme text-white text-xs transition-colors shadow-sm";
      else btn.className = "chart-mode-btn py-1.5 px-3.5 rounded-lg font-normal border border-gray-200 bg-white text-gray-600 text-xs hover:border-gray-300 transition-colors";
    }
  });
}

export function getActiveChartColors() {
  const activeThemeKey = localStorage.getItem('onlyview_theme') || 'slate';
  if (store.currentChartMode === 'theme') {
    const preset = store.chartStylePalettes.themePreset[activeThemeKey] || store.chartStylePalettes.themePreset.slate;
    return { highlight: preset.highlight, main: preset.main, pending: preset.pending, isOutline: false };
  }
  if (store.currentChartMode === 'outline') return store.chartStylePalettes.outline;
  if (store.currentChartMode === 'light') return store.chartStylePalettes.light;
  return store.chartStylePalettes.default;
}

export function renderStatusColorPickers() {
  const keys = ['apply', 'select', 'visit', 'unsubmitted', 'submit', 'delivery', 'fee'];
  keys.forEach(k => {
    const badge = document.getElementById("picker_badge_" + k);
    if (badge) badge.style.backgroundColor = store.customStatusColors[k] || '#6B7280';
  });
}

export function applySidebarUI() {
  const sidebar = document.getElementById('mainSidebar');
  const toggleBtn = document.getElementById('sidebarToggleBtn');
  const textElems = document.querySelectorAll('.sidebar-text-label');
  if (store.isSidebarCollapsed) {
    sidebar?.classList.remove('md:w-64'); sidebar?.classList.add('md:w-20');
    if (toggleBtn) toggleBtn.innerText = '▶';
    textElems.forEach(el => el.classList.add('hidden'));
  } else {
    sidebar?.classList.remove('md:w-20'); sidebar?.classList.add('md:w-64');
    if (toggleBtn) toggleBtn.innerText = '◀';
    textElems.forEach(el => el.classList.remove('hidden'));
  }
}

export function updateFormVisibility() {
  const readOnlyBadge = document.getElementById('readOnlyBadge');
  const resetBtn = document.getElementById('resetToMyDataBtn');
  const dashRegisterBtn = document.getElementById('dashRegisterBtn');
  const navForm = document.getElementById('nav-form');
  const navSettings = document.getElementById('nav-settings');
  const downloadExcelBtn = document.getElementById('downloadExcelBtn');
  if (store.isReadOnly) {
    readOnlyBadge?.classList.remove('hidden'); resetBtn?.classList.remove('hidden'); dashRegisterBtn?.classList.add('hidden'); navForm?.classList.add('hidden'); navSettings?.classList.add('hidden'); downloadExcelBtn?.classList.add('hidden');
  } else {
    readOnlyBadge?.classList.add('hidden'); resetBtn?.classList.add('hidden'); dashRegisterBtn?.classList.remove('hidden'); navForm?.classList.remove('hidden'); navSettings?.classList.remove('hidden'); downloadExcelBtn?.classList.remove('hidden');
  }
}

window.changeTheme = function(colorKey) {
  if (store.isReadOnly) return alert("읽기 전용 모드에서는 테마를 변경할 수 없습니다.");
  const theme = store.themeColors[colorKey] || store.themeColors.slate;
  document.documentElement.style.setProperty('--primary', theme.primary);
  document.documentElement.style.setProperty('--primary-hover', theme.hover);
  document.documentElement.style.setProperty('--primary-text', theme.text);
  document.documentElement.style.setProperty('--primary-light', theme.light);
  document.documentElement.style.setProperty('--main-bg', theme.bg);
  document.documentElement.style.setProperty('--sidebar-bg', theme.sidebarBg);
  document.documentElement.style.setProperty('--sidebar-text', theme.sidebarText);
  document.documentElement.style.setProperty('--sidebar-text-muted', theme.sidebarText === '#E6E8EE' ? '#9CA3AF' : '#6B7280');
  localStorage.setItem('onlyview_theme', colorKey);
  if (store.currentChartMode === 'theme' && window.renderSettlementView) window.renderSettlementView();
};

window.setChartMode = function(modeKey) {
  if (store.isReadOnly) return alert("읽기 전용 모드에서는 스타일을 변경할 수 없습니다.");
  store.currentChartMode = modeKey;
  localStorage.setItem('onlyview_chartMode', modeKey);
  updateChartModeButtonsUI();
  if (window.renderSettlementView) window.renderSettlementView();
};

window.setDeadlineDays = async function(days) {
  if (store.isReadOnly) return alert("읽기 전용 모드에서는 변경할 수 없습니다.");
  store.deadlineAlertDays = Number(days);
  updateDeadlineButtons();
  if (window.renderDashboardView) window.renderDashboardView();
  if (store.currentUser && !store.isReadOnly) {
    try { await setDoc(doc(db, "users", store.currentUser.uid), { deadlineAlertDays: store.deadlineAlertDays }, { merge: true }); } catch(e) {}
  }
};

window.openColorPickerModal = function(key, label) {
  if (store.isReadOnly) return alert("읽기 전용 모드입니다.");
  store.activeColorPickerKey = key;
  const titleElem = document.getElementById('colorModalTitle');
  if (titleElem) titleElem.innerText = label + " 상태 글자 색상 선택";
  const grid = document.getElementById('colorPaletteGrid');
  if (grid) {
    grid.innerHTML = '';
    const currentColor = store.customStatusColors[key] || '#6B7280';
    store.presetPalette.forEach(hex => {
      const isSelected = currentColor.toLowerCase() === hex.toLowerCase();
      const btn = document.createElement('button'); btn.type = 'button';
      btn.className = "w-10 h-10 rounded-full border-2 transition-transform hover:scale-110 shadow-sm flex items-center justify-center " + (isSelected ? "border-gray-900 ring-2 ring-gray-400 scale-110" : "border-white");
      btn.style.backgroundColor = hex;
      if (isSelected) btn.innerHTML = '<span class="text-white text-xs font-bold">✓</span>';
      btn.onclick = () => window.updateCustomStatusColor(key, hex);
      grid.appendChild(btn);
    });
  }
  document.getElementById('colorPickerModal')?.classList.remove('hidden');
};

window.updateCustomStatusColor = async function(key, val) {
  if (store.isReadOnly) return;
  store.customStatusColors[key] = val;
  applyStatusCSSColors();
  renderStatusColorPickers();
  if (window.filterAndRender) window.filterAndRender();
  document.getElementById('colorPickerModal')?.classList.add('hidden');
  if (store.currentUser && !store.isReadOnly) {
    try { await setDoc(doc(db, "users", store.currentUser.uid), { statusColors: store.customStatusColors }, { merge: true }); } catch(e) {}
  }
};

window.toggleSidebar = function() {
  store.isSidebarCollapsed = !store.isSidebarCollapsed;
  localStorage.setItem('onlyview_sidebarCollapsed', store.isSidebarCollapsed.toString());
  applySidebarUI();
};
