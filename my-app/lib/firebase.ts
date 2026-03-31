import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyByI6rbv7U4Z3Te4FWrC4XXpMPaePqHkuM",
  authDomain: "desertation-ccace.firebaseapp.com",
  projectId: "desertation-ccace",
  storageBucket: "desertation-ccace.firebasestorage.app",
  messagingSenderId: "855349082142",
  appId: "1:855349082142:web:0e3f82eadb9abaea89d60f",
  measurementId: "G-Y2JDWGZSW8",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

export { app, auth };
