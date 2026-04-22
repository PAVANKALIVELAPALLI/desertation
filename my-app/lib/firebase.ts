import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import {
  getFirestore as _getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyByI6rbv7U4Z3Te4FWrC4XXpMPaePqHkuM",
  authDomain: "desertation-ccace.firebaseapp.com",
  projectId: "desertation-ccace",
  storageBucket: "desertation-ccace.firebasestorage.app",
  messagingSenderId: "855349082142",
  appId: "1:855349082142:web:0e3f82eadb9abaea89d60f",
  measurementId: "G-Y2JDWGZSW8",
};

export { firebaseConfig };

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;

function app(): FirebaseApp {
  if (_app) return _app;
  _app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  return _app;
}

export function getFirebaseApp(): FirebaseApp {
  return app();
}

export function getFirebaseAuth(): Auth {
  if (_auth) return _auth;
  _auth = getAuth(app());
  return _auth;
}

export function getFirestore(): Firestore {
  if (_db) return _db;
  try {
    _db = initializeFirestore(app(), {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch {
    _db = _getFirestore(app());
  }
  return _db;
}
