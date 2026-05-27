/* Sticker Tracker — Cloud persistence helpers (Firestore)
   All functions fail silently and fall back to localStorage
   when Firebase is offline or not yet configured. */

function isCloudReady() {
  try {
    return window.FIREBASE_READY === true &&
           !!window.db &&
           window.db.app.options.projectId !== "YOUR_PROJECT_ID";
  } catch { return false; }
}

// Fetch a user record → { pin, state } or null
async function cloudGetUser(codeword) {
  if (!isCloudReady()) return null;
  try {
    const snap = await window.db.collection("users").doc(codeword).get();
    return snap.exists ? snap.data() : null;
  } catch (e) {
    console.warn("[cloud] read failed:", e.message);
    return null;
  }
}

// Returns true if the codeword is already registered in Firestore
async function cloudCheckCodeword(codeword) {
  if (!isCloudReady()) return false;
  try {
    const snap = await window.db.collection("users").doc(codeword).get();
    return snap.exists;
  } catch { return false; }
}

// Create a new user record in Firestore
async function cloudCreateUser(codeword, pin) {
  if (!isCloudReady()) return;
  try {
    await window.db.collection("users").doc(codeword).set({
      pin,
      state: {},
      updatedAt: new Date()
    });
  } catch (e) {
    console.warn("[cloud] create user failed:", e.message);
  }
}

// Persist sticker state (merge so pin field is preserved)
async function cloudSaveState(codeword, state) {
  if (!isCloudReady()) return;
  try {
    await window.db.collection("users").doc(codeword).set(
      { state, updatedAt: new Date() },
      { merge: true }
    );
  } catch (e) {
    console.warn("[cloud] save state failed:", e.message);
  }
}

Object.assign(window, {
  isCloudReady,
  cloudGetUser,
  cloudCheckCodeword,
  cloudCreateUser,
  cloudSaveState,
});
