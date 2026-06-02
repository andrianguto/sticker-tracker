import { useState, useEffect, useCallback } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth, getFirebaseCredentials } from '../firebase';
import { AlbumState } from '../types';

const ACTIVE_USER_KEY = "stickerTrackerActiveUserV1";
const USERS_KEY = "stickerTrackerUsersV1";
const STORAGE_KEY = "stickerTrackerV1";
const ONBOARDED_KEY = "stickerTrackerOnboardedV1";
const SETUP_MODE_KEY = "stickerTrackerSetupModeV1";

// Helper to resolve localized keys
export const getUserStorageKey = (codeword: string, base: string) => {
  return `${base}::${codeword.trim().toLowerCase()}`;
};

export const useAuth = () => {
  const [activeUser, setActiveUser] = useState<string | null>(() => localStorage.getItem(ACTIVE_USER_KEY));
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Monitor auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      if (!user) {
        setActiveUser(null);
        localStorage.removeItem(ACTIVE_USER_KEY);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Background Migration Flow at Startup
  useEffect(() => {
    const runMigration = async () => {
      try {
        const rawUsers = localStorage.getItem(USERS_KEY);
        if (!rawUsers) return;

        const usersMap: Record<string, string> = JSON.parse(rawUsers);
        const codewords = Object.keys(usersMap);
        if (codewords.length === 0) return;

        console.info(`[Migration] Found ${codewords.length} local accounts to migrate.`);

        for (const codeword of codewords) {
          const pin = usersMap[codeword];
          const { email, password, codeword: cleanCode } = getFirebaseCredentials(codeword, pin);

          // Get local state for this user
          const stateKey = getUserStorageKey(cleanCode, STORAGE_KEY);
          const rawState = localStorage.getItem(stateKey);
          const localState: AlbumState = rawState ? JSON.parse(rawState) : {};

          console.info(`[Migration] Migrating codeword: "${cleanCode}" to Firebase.`);

          let userCredential;
          try {
            // Attempt to register in Firebase Auth
            userCredential = await createUserWithEmailAndPassword(auth, email, password);
            console.info(`[Migration] Registered Firebase Auth for "${cleanCode}".`);
          } catch (err: any) {
            if (err.code === 'auth/email-already-in-use') {
              // Already registered, attempt login to sync state
              userCredential = await signInWithEmailAndPassword(auth, email, password);
              console.info(`[Migration] Logged in existing Firebase Auth for "${cleanCode}".`);
            } else {
              console.warn(`[Migration] Auth migration failed for "${cleanCode}":`, err.message);
              continue;
            }
          }

          if (userCredential.user) {
            // Push local album progress to Firestore
            const userDocRef = doc(db, "users", cleanCode);
            const docSnap = await getDoc(userDocRef);

            let mergedState = { ...localState };
            if (docSnap.exists()) {
              const cloudState = docSnap.data().state || {};
              mergedState = { ...cloudState, ...localState }; // Merge
            }

            await setDoc(userDocRef, {
              pin,
              state: mergedState,
              updatedAt: serverTimestamp(),
              uid: userCredential.user.uid
            }, { merge: true });

            console.info(`[Migration] Synced state to Firestore for "${cleanCode}".`);

            // Migrate onboarding flags
            const onbKey = getUserStorageKey(cleanCode, ONBOARDED_KEY);
            const modeKey = getUserStorageKey(cleanCode, SETUP_MODE_KEY);
            const legacyOnb = localStorage.getItem("stickerTrackerOnboardedV1");
            const legacyMode = localStorage.getItem("stickerTrackerSetupModeV1");
            if (legacyOnb) {
              localStorage.setItem(onbKey, legacyOnb);
            }
            if (legacyMode) {
              localStorage.setItem(modeKey, legacyMode);
            }

            // Mark this user as migrated from LocalStorage list
            delete usersMap[codeword];
          }
        }

        // Clean up legacy keys once everything is migrated
        if (Object.keys(usersMap).length === 0) {
          localStorage.removeItem(USERS_KEY);
          localStorage.removeItem("stickerTrackerPinV1");
          localStorage.removeItem("stickerTrackerOnboardedV1");
          localStorage.removeItem("stickerTrackerSetupModeV1");
          localStorage.removeItem("stickerTrackerV1");
        } else {
          localStorage.setItem(USERS_KEY, JSON.stringify(usersMap));
        }

        console.info("[Migration] Migration completed successfully.");
      } catch (err: any) {
        console.warn("[Migration] Background migration encountered an error:", err);
      }
    };

    runMigration();
  }, []);

  const login = useCallback(async (codeword: string, pin: string) => {
    setError(null);
    const { email, password, codeword: cleanCode } = getFirebaseCredentials(codeword, pin);

    try {
      let userCredential;
      try {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
      } catch (authErr: any) {
        if (authErr.code === 'auth/user-not-found' || authErr.code === 'auth/invalid-credential') {
          const userDocRef = doc(db, "users", cleanCode);
          const docSnap = await getDoc(userDocRef);
          if (docSnap.exists() && docSnap.data().pin === pin) {
            userCredential = await createUserWithEmailAndPassword(auth, email, password);
            await setDoc(userDocRef, {
              uid: userCredential.user.uid,
              updatedAt: serverTimestamp()
            }, { merge: true });
          } else {
            throw authErr;
          }
        } else {
          throw authErr;
        }
      }
      
      const userDocRef = doc(db, "users", cleanCode);
      const docSnap = await getDoc(userDocRef);

      if (!docSnap.exists()) {
        await setDoc(userDocRef, {
          pin,
          state: {},
          updatedAt: serverTimestamp(),
          uid: userCredential.user.uid
        });
      } else {
        if (!docSnap.data()?.uid) {
          await setDoc(userDocRef, {
            uid: userCredential.user.uid,
            updatedAt: serverTimestamp()
          }, { merge: true });
        }
      }

      const localUsers = localStorage.getItem(USERS_KEY) ? JSON.parse(localStorage.getItem(USERS_KEY)!) : {};
      localUsers[cleanCode] = pin;
      localStorage.setItem(USERS_KEY, JSON.stringify(localUsers));

      localStorage.setItem(ACTIVE_USER_KEY, cleanCode);
      setActiveUser(cleanCode);
      return cleanCode;
    } catch (err: any) {
      console.error("[Auth] Login error:", err);
      let errMsg = "Wrong code word or PIN.";
      if (err.code === 'auth/user-not-found') {
        errMsg = "Codeword not registered. Try creating an account.";
      } else if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        errMsg = "Incorrect PIN.";
      } else if (err.code === 'auth/network-request-failed') {
        errMsg = "Network error. Check your connection.";
      }
      setError(errMsg);
      throw new Error(errMsg);
    }
  }, []);

  const register = useCallback(async (codeword: string, pin: string) => {
    setError(null);
    const { email, password, codeword: cleanCode } = getFirebaseCredentials(codeword, pin);

    try {
      const userDocRef = doc(db, "users", cleanCode);
      const docSnap = await getDoc(userDocRef);
      if (docSnap.exists()) {
        throw new Error("Code word already taken. Choose another.");
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);

      await setDoc(userDocRef, {
        pin,
        state: {},
        updatedAt: serverTimestamp(),
        uid: userCredential.user.uid
      });

      const localUsers = localStorage.getItem(USERS_KEY) ? JSON.parse(localStorage.getItem(USERS_KEY)!) : {};
      localUsers[cleanCode] = pin;
      localStorage.setItem(USERS_KEY, JSON.stringify(localUsers));

      localStorage.setItem(ACTIVE_USER_KEY, cleanCode);
      setActiveUser(cleanCode);
      return cleanCode;
    } catch (err: any) {
      console.error("[Auth] Register error:", err);
      let errMsg = err.message || "Could not create account.";
      if (err.code === 'auth/email-already-in-use') {
        errMsg = "Code word already taken. Choose another.";
      } else if (err.code === 'auth/invalid-email') {
        errMsg = "Invalid codeword characters.";
      }
      setError(errMsg);
      throw new Error(errMsg);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await signOut(auth);
      localStorage.removeItem(ACTIVE_USER_KEY);
      setActiveUser(null);
    } catch (err) {
      console.error("[Auth] Sign out error:", err);
    }
  }, []);

  return {
    activeUser,
    firebaseUser,
    loading,
    error,
    login,
    register,
    logout,
    setError
  };
};
