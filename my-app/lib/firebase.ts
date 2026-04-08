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

export async function getFirebaseApp() {
  const { initializeApp, getApps, getApp } = await import("firebase/app");
  return getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
}

export async function getFirebaseAuth() {
  const app = await getFirebaseApp();
  const { getAuth } = await import("firebase/auth");
  return getAuth(app);
}

export async function getFirestore() {
  const app = await getFirebaseApp();
  const { getFirestore: _getFirestore } = await import("firebase/firestore");
  return _getFirestore(app);
}
