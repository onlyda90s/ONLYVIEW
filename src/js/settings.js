import { db } from '../config/firebase.js'; 
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { currentUser, isReadOnly } from './app.js';

export let deadlineAlertDays = 7;
export const customStatusColors = {
  apply: '#6B7280', select: '#111827', visit: '#F4A261',
  unsubmitted: '#E63946', submit: '#059669', delivery: '#2563EB', fee: '#9333EA'
};

export function renderStatusColorPickers() {
  Object.keys(customStatusColors).forEach(key => {
    const badge = document.getElementById(`picker_badge_${key}`);
    if (badge) badge.style.backgroundColor = customStatusColors[key];
  });
}

export function updateDeadlineButtons() {
  [7, 10, 14].forEach(d => {
    const btn = document.getElementById(`btnDeadlineDay_${d}`);
    if (btn) {
      btn.className = (d === deadlineAlertDays)
        ? "py-1.5 px-3.5 rounded-lg font-bold border border-theme bg-theme text-white text-xs transition shadow-sm"
        : "py-1.5 px-3.5 rounded-lg font-bold border border-gray-200 bg-white text-gray-600 text-xs hover:border-gray-300 transition";
    }
  });
}
