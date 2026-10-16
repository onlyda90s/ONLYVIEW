import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBfKBcYsKume9YqbZwFGtVuFvElrfVGNzY",
  authDomain: "onlyview-2ef88.firebaseapp.com",
  projectId: "onlyview-2ef88",
  storageBucket: "onlyview-2ef88.firebasestorage.app",
  messagingSenderId: "110107089396",
  appId: "1:110107089396:web:a0670b16ce10655c2481a1"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const provider = new GoogleAuthProvider();
