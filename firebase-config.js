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
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID"
};

firebase.initializeApp(FIREBASE_CONFIG);
window.db = firebase.firestore();
window.FIREBASE_READY = true;
