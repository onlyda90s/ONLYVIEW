import { auth, db, provider } from '../firebase-config.js';
import { store } from '../store.js';
import { signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDoc, setDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 구글 로그인 함수: 전역 window에 즉시 등록
window.loginWithGoogle = async function() {
  try {
    if (!auth || !provider) {
      return alert("Firebase 인증 모듈이 초기화되지 않았습니다. 잠시 후 다시 시도해 주세요.");
    }
    await signInWithPopup(auth, provider);
  } catch (err) {
    if (err.code === 'auth/unauthorized-domain') {
      alert("현재 도메인이 Firebase 승인 도메인(Authorized Domains)에 등록되어 있지 않습니다.\nFirebase 콘솔 > Authentication > Settings > Authorized domains에서 현재 주소(예: onlyda90s.github.io)를 추가해 주세요.");
    } else if (err.code !== 'auth/popup-closed-by-user') {
      alert("로그인 오류 (" + err.code + "): " + err.message);
    }
  }
};

window.logout = function() {
  if (auth) signOut(auth);
  window.location.reload();
};

// 초대코드 입장 함수: 전역 window에 즉시 등록
window.enterWithInviteCode = async function() {
  const codeInput = document.getElementById('loginInviteCodeInput')?.value.trim();
  if (!codeInput) return alert("초대 코드를 입력해주세요.");
  try {
    if (!db) return alert("데이터베이스에 연결되지 않았습니다.");
    const codeSnap = await getDoc(doc(db, "userCodes", codeInput));
    if (!codeSnap.exists()) {
      return alert("유효하지 않은 초대 코드입니다. 코드를 다시 확인해 주세요.");
    }
    store.targetUserId = codeSnap.data().uid;
    store.isReadOnly = true;
    document.getElementById('authSection')?.classList.add('hidden');
    const appSec = document.getElementById('appSection');
    appSec?.classList.remove('hidden');
    appSec?.classList.add('flex');
    const userNameElem = document.getElementById('userName');
    if (userNameElem) userNameElem.innerText = "초대 접속자 (" + codeInput + ")";
    
    if (window.updateFormVisibility) window.updateFormVisibility();
    if (window.loadCampaigns) await window.loadCampaigns();
    if (window.switchTab) window.switchTab('dashboard', false);
  } catch (err) {
    alert("초대 코드 조회 실패: " + err.message);
  }
};

export function initAuth(onUserReady) {
  let autoLogoutTimer;
  function resetTimer() {
    clearTimeout(autoLogoutTimer);
    autoLogoutTimer = setTimeout(() => {
      if (auth && auth.currentUser) {
        signOut(auth);
        alert("2시간 동안 활동이 없어 자동 로그아웃 되었습니다.");
        window.location.reload();
      }
    }, 2 * 60 * 60 * 1000);
  }
  ['click', 'mousemove', 'keydown', 'scroll', 'touchstart'].forEach(evt => window.addEventListener(evt, resetTimer));
  resetTimer();

  onAuthStateChanged(auth, async (user) => {
    const authSec = document.getElementById('authSection');
    const appSec = document.getElementById('appSection');
    if (user) {
      store.currentUser = user;
      store.targetUserId = user.uid;
      store.isReadOnly = false;
      authSec?.classList.add('hidden');
      appSec?.classList.remove('hidden');
      appSec?.classList.add('flex');
      const userNameElem = document.getElementById('userName');
      if (userNameElem) userNameElem.innerText = user.displayName || user.email;
      
      await fetchUserCustomCode();
      if (window.updateFormVisibility) window.updateFormVisibility();
      if (onUserReady) await onUserReady();
      if (window.switchTab) window.switchTab('dashboard', false);
    } else if (!store.targetUserId) {
      store.currentUser = null;
      authSec?.classList.remove('hidden');
      appSec?.classList.add('hidden');
      appSec?.classList.remove('flex');
    }
  });
}

export async function fetchUserCustomCode() {
  if (!store.currentUser) return;
  try {
    const userDocRef = doc(db, "users", store.currentUser.uid);
    const userSnap = await getDoc(userDocRef);
    if (userSnap.exists()) {
      const data = userSnap.data();
      if (data.customCode) store.myCustomCode = data.customCode;
      if (data.deadlineAlertDays) store.deadlineAlertDays = data.deadlineAlertDays;
      if (data.statusColors) {
        Object.assign(store.customStatusColors, data.statusColors);
        localStorage.setItem('onlyview_statusColors', JSON.stringify(store.customStatusColors));
        if (window.applyStatusCSSColors) window.applyStatusCSSColors();
        if (window.renderStatusColorPickers) window.renderStatusColorPickers();
      }
    } else {
      store.myCustomCode = Math.floor(100000 + Math.random() * 900000).toString();
      await setDoc(userDocRef, { customCode: store.myCustomCode, uid: store.currentUser.uid }, { merge: true });
      await setDoc(doc(db, "userCodes", store.myCustomCode), { uid: store.currentUser.uid });
    }
    const codeElem = document.getElementById('myShareCode');
    if (codeElem) codeElem.innerText = store.myCustomCode;
  } catch (e) { console.error("설정 로드 실패:", e); }
}
