/**
 * Firebase 초기화 모듈
 * auth, app 인스턴스를 한 곳에서 export하여 각 스크립트가 재사용
 *
 * Firebase Client SDK 키는 클라이언트에 노출되도록 설계된 공개 키이며,
 * Firebase Security Rules로 접근을 제어합니다.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAJIDQVElEekGCk7bWOCefFrcK46dP6CBA",
  authDomain: "cvclsimms.firebaseapp.com",
  projectId: "cvclsimms",
  storageBucket: "cvclsimms.firebasestorage.app",
  messagingSenderId: "961047829073",
  appId: "1:961047829073:web:4f5a95bffef3e7141af670",
  measurementId: "G-G1X0VK463S"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
getAnalytics(app);

export default auth; db;
export { app, db, auth }; 