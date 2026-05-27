// ============================================================
// FILL IN YOUR FIREBASE CONFIG — see instructions below
// ============================================================
// 1. Go to https://console.firebase.google.com
// 2. Click "Add project", give it a name (e.g. "sticker-tracker"), continue
// 3. Inside the project: click the </> Web icon to register a web app
// 4. Copy the firebaseConfig values into the object below
// 5. Then: Build → Firestore Database → Create database → Start in test mode
// ============================================================

const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyCpv2FcHWx8a6bAD2YtbPVaObVFCyEpFC4",
  authDomain:        "sticker-tracker-76175.firebaseapp.com",
  projectId:         "sticker-tracker-76175",
  storageBucket:     "sticker-tracker-76175.firebasestorage.app",
  messagingSenderId: "989637989257",
  appId:             "1:989637989257:web:e260e10b2ab87ddeed8758"
};

firebase.initializeApp(FIREBASE_CONFIG);
window.db = firebase.firestore();
window.FIREBASE_READY = true;
