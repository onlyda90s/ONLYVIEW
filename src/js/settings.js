import { db } from '../config/firebase.js';
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { currentUser, isReadOnly, myCustomCode } from './app.js';
import { renderDashboardView } from './dashboard.js';
import { filterAndRender } from './campaign.js';

export let deadlineAlertDays = 7;

export const customStatusColors = {
  apply: '#6B7280',
  select: '#111827',
  visit: '#F4A261',
  unsubmitted: '#E63946',
  submit: '#059669',
  delivery: '#2563EB',
  fee: '#9333EA'
};

const presetPalette = [
  '#6B7280', '#111827', '#E63946', '#F4A261', '#E9C46A',
  '#059669', '#2563EB', '#4F46E5', '#9333EA', '#D97706',
  '#EC4899', '#0891B2'
];

const themeColors = {
  orange: { primary: '#F4A261', hover: '#E76F51', text: '#C85A17', light: '#FFFBF7', bg: '#FAF8F5' },
  red:    { primary: '#E63946', hover: '#D62828', text: '#D62828', light: '#FFF8F8', bg: '#FFF5F5' },
  yellow: { primary: '#E9C46A', hover: '#F4A261', text: '#B5820F', light: '#FFFCF5', bg: '#FCFBF7' },
  green:  { primary: '#2A9D8F', hover: '#218380', text: '#1B6A60', light: '#F7FCFC', bg: '#F4FBF9' },
  blue:   { primary: '#457B9D', hover: '#1D3557', text: '#1D3557', light: '#F8FCFE', bg: '#F4F8FB' },
  purple: { primary: '#9D4EDD', hover: '#7B2CBF', text: '#5A189A', light: '#FCF8FE', bg: '#FAF5FC' },
  black:  { primary: '#2B2D42', hover: '#111111', text: '#111111', light: '#F8F8F9', bg: '#F2F2F4' }
};

export function applyStatusCSSColors() {
  document.documentElement.style.setProperty('--color-status-apply', customStatusColors.apply);
  document.documentElement.style.setProperty('--color-status-select', customStatusColors.select);
  document.documentElement.style.setProperty('--color-status-visit', customStatusColors.visit || '#F4A261');
  document.documentElement.style.setProperty('--color-status-unsubmitted', customStatusColors.unsubmitted || '#E63946');
  document.documentElement.style.setProperty('--color-status-submit', customStatusColors.submit);
  document.documentElement.style.setProperty('--color-status-delivery', customStatusColors.delivery);
  document.documentElement.style.setProperty('--color-status-fee', customStatusColors.fee);
}

export function renderStatusColorPickers() {
  const keys = ['apply', 'select', 'visit', 'unsubmitted', 'submit', 'delivery', 'fee'];
  keys.forEach(key => {
    const badge = document.getElementById(`picker_badge_${key}`);
    if (badge) badge.style.backgroundColor = customStatusColors[key] || '#6B7280';
  });
}

export function updateDeadlineButtons() {
  [7, 10, 14].forEach(d => {
    const btn = document.getElementById(`btnDeadlineDay_${d}`);
    if (btn) {
      if (d === deadlineAlertDays) {
        btn.className = "py-1.5 px-3.5 rounded-lg font-bold border border-theme bg-theme text-white text-xs transition shadow-sm";
      } else {
        btn.className = "py-1.5 px-3.5 rounded-lg font-bold border border-gray-200 bg-white text-gray-600 text-xs hover:border-gray-300 transition";
      }
    }
  });
}

// --- 전역(window) 이벤트 함수 연결 ---

window.setDeadlineDays = async function(days) {
  if (isReadOnly) return alert("읽기 전용 모드에서는 설정을 변경할 수 없습니다.");
  deadlineAlertDays = Number(days);
  updateDeadlineButtons();
  renderDashboardView();

  if (currentUser && !isReadOnly) {
    try {
      await setDoc(doc(db, "users", currentUser.uid), {
        deadlineAlertDays: deadlineAlertDays
      }, { merge: true });
    } catch(e) { console.error("마감일 DB 저장 실패:", e); }
  }
};

window.changeTheme = function(colorKey) {
  if (isReadOnly) return alert("읽기 전용 모드에서는 테마를 변경할 수 없습니다.");
  const theme = themeColors[colorKey] || themeColors.orange;
  document.documentElement.style.setProperty('--primary', theme.primary);
  document.documentElement.style.setProperty('--primary-hover', theme.hover);
  document.documentElement.style.setProperty('--primary-text', theme.text);
  document.documentElement.style.setProperty('--primary-light', theme.light);
  document.documentElement.style.setProperty('--bg-color', theme.bg);
  localStorage.setItem('onlyview_theme', colorKey);
};

window.openColorPickerModal = function(key, label) {
  if (isReadOnly) return alert("읽기 전용 모드에서는 설정을 변경할 수 없습니다.");
  
  const modalTitle = document.getElementById('colorModalTitle');
  if (modalTitle) modalTitle.innerText = `${label} 상태 글자 색상 선택`;
  
  const grid = document.getElementById('colorPaletteGrid');
  if (!grid) return;
  grid.innerHTML = '';

  const currentColor = customStatusColors[key] || '#6B7280';

  presetPalette.forEach(hex => {
    const isSelected = currentColor.toLowerCase() === hex.toLowerCase();
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `w-10 h-10 rounded-full border-2 transition hover:scale-110 shadow-sm flex items-center justify-center ${isSelected ? 'border-gray-900 ring-2 ring-gray-400 scale-110' : 'border-white'}`;
    btn.style.backgroundColor = hex;
    if (isSelected) {
      btn.innerHTML = '<span class="text-white text-xs font-bold">✓</span>';
    }
    btn.onclick = () => window.updateCustomStatusColor(key, hex);
    grid.appendChild(btn);
  });

  document.getElementById('colorPickerModal')?.classList.remove('hidden');
};

window.updateCustomStatusColor = async function(key, val) {
  if (isReadOnly) return alert("읽기 전용 모드에서는 설정을 변경할 수 없습니다.");
  customStatusColors[key] = val;
  applyStatusCSSColors();
  renderStatusColorPickers();
  filterAndRender();
  document.getElementById('colorPickerModal')?.classList.add('hidden');

  if (currentUser && !isReadOnly) {
    try {
      await setDoc(doc(db, "users", currentUser.uid), {
        statusColors: customStatusColors
      }, { merge: true });
    } catch(e) { console.error("색상 DB 저장 실패:", e); }
  }
};

// 유저 개인 설정(색상, D-day 마감일) 로드
export async function fetchUserCustomCode() {
  if (!currentUser) return;
  try {
    const userDocRef = doc(db, "users", currentUser.uid);
    const userSnap = await getDoc(userDocRef);

    if (userSnap.exists()) {
      const data = userSnap.data();
      if (data.deadlineAlertDays) {
        deadlineAlertDays = data.deadlineAlertDays;
        updateDeadlineButtons();
      }
      if (data.statusColors) {
        Object.assign(customStatusColors, data.statusColors);
        applyStatusCSSColors();
        renderStatusColorPickers();
      }
    }
    const codeElem = document.getElementById('myShareCode');
    if (codeElem && myCustomCode) codeElem.innerText = myCustomCode;
  } catch (e) {
    console.error("유저 설정 로드 에러:", e);
  }
}
