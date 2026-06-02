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

// Persist sticker state.
// IMPORTANT: use update() (not set with merge) so the whole `state` map is
// REPLACED, not deep-merged. With set({merge:true}) Firestore recursively
// merges map fields, so un-marked/removed stickers (keys deleted locally) are
// never deleted in the cloud and reappear as "owned" on the next load.
// update() replaces the named `state` field outright and leaves `pin` intact.
async function cloudSaveState(codeword, state) {
  if (!isCloudReady()) return;
  const docRef = window.db.collection("users").doc(codeword);
  try {
    await docRef.update({ state, updatedAt: new Date() });
  } catch (e) {
    // Doc doesn't exist yet (e.g. created on another device): create it.
    // There's no prior state to merge against here, so merge is safe.
    try {
      await docRef.set({ state, updatedAt: new Date() }, { merge: true });
    } catch (e2) {
      console.warn("[cloud] save state failed:", e2.message);
    }
  }
}

Object.assign(window, {
  isCloudReady,
  cloudGetUser,
  cloudCheckCodeword,
  cloudCreateUser,
  cloudSaveState,
});
