import { useState, useEffect, useRef, useCallback } from 'react';
import { doc, onSnapshot, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { AlbumState } from '../types';
import { getUserStorageKey } from './useAuth';
import { ALL_TEAMS, FWC_FRONT, FWC_BACK, TEAM_STICKERS_PER_TEAM } from '../data';

const STORAGE_KEY = "stickerTrackerV1";
const STORAGE_META_KEY = "stickerTrackerV1::meta";

// --- State persistence helpers ---
export const loadLocalState = (codeword: string): AlbumState => {
  try {
    const raw = localStorage.getItem(getUserStorageKey(codeword, STORAGE_KEY));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

export const saveLocalState = (codeword: string, state: AlbumState) => {
  try {
    localStorage.setItem(getUserStorageKey(codeword, STORAGE_KEY), JSON.stringify(state));
  } catch (err) {
    console.error("[LocalState] Save failed:", err);
  }
};

export const loadLocalStateMeta = (codeword: string): { synced: boolean } => {
  try {
    const raw = localStorage.getItem(getUserStorageKey(codeword, STORAGE_META_KEY));
    return raw ? JSON.parse(raw) : { synced: true };
  } catch {
    return { synced: true };
  }
};

export const saveLocalStateMeta = (codeword: string, meta: { synced: boolean }) => {
  try {
    localStorage.setItem(getUserStorageKey(codeword, STORAGE_META_KEY), JSON.stringify(meta));
  } catch (err) {
    console.error("[LocalMeta] Save failed:", err);
  }
};

// --- Sticker calculations ---
export const stickerCount = (state: AlbumState, id: string): number => state[id]?.c || 0;
export const isHave = (state: AlbumState, id: string): boolean => stickerCount(state, id) >= 1;
export const dupCount = (state: AlbumState, id: string): number => Math.max(0, stickerCount(state, id) - 1);
export const getName = (state: AlbumState, id: string): string => state[id]?.name || "";

export const setStickerCount = (state: AlbumState, id: string, newCount: number): AlbumState => {
  const next = { ...state };
  const existing = next[id] || {};
  if (newCount <= 0) {
    if (existing.name) {
      next[id] = { c: 0, name: existing.name };
    } else {
      delete next[id];
    }
  } else {
    next[id] = { ...existing, c: newCount };
  }
  return next;
};

export const setStickerName = (state: AlbumState, id: string, name: string): AlbumState => {
  const next = { ...state };
  const existing = next[id] || { c: 0 };
  const trimmed = (name || "").trim();
  if (!trimmed && !existing.c) {
    delete next[id];
  } else {
    next[id] = { ...existing, name: trimmed };
  }
  return next;
};

// --- Missing / Duplicates builders ---
export interface MissingTeamData {
  team: typeof ALL_TEAMS[0];
  missing: string[];
}

export const buildMissing = (state: AlbumState) => {
  const result: MissingTeamData[] = [];
  for (const t of ALL_TEAMS) {
    const ids: string[] = [];
    for (let i = 1; i <= TEAM_STICKERS_PER_TEAM; i++) {
      const id = `${t.code}-${i}`;
      if (!isHave(state, id)) ids.push(id);
    }
    if (ids.length) result.push({ team: t, missing: ids });
  }
  const fwcFront = FWC_FRONT.filter(id => !isHave(state, id));
  const fwcBack  = FWC_BACK.filter(id => !isHave(state, id));
  return { teams: result, fwcFront, fwcBack };
};

export interface DuplicateItem {
  id: string;
  n: number;
}

export interface DuplicateTeamData {
  team: typeof ALL_TEAMS[0];
  items: DuplicateItem[];
}

export const buildDuplicates = (state: AlbumState) => {
  const result: DuplicateTeamData[] = [];
  for (const t of ALL_TEAMS) {
    const items: DuplicateItem[] = [];
    for (let i = 1; i <= TEAM_STICKERS_PER_TEAM; i++) {
      const id = `${t.code}-${i}`;
      const d = dupCount(state, id);
      if (d > 0) items.push({ id, n: d });
    }
    if (items.length) result.push({ team: t, items });
  }
  const fwcFront = FWC_FRONT.map(id => ({ id, n: dupCount(state, id) })).filter(x => x.n > 0);
  const fwcBack  = FWC_BACK.map(id => ({ id, n: dupCount(state, id) })).filter(x => x.n > 0);
  return { teams: result, fwcFront, fwcBack };
};

export const useStickers = (activeUser: string | null) => {
  const [localState, setLocalState] = useState<AlbumState>({});
  const [loading, setLoading] = useState(true);
  const cloudSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Firestore update helper that avoids phantom owned resurrecting stickers.
  // Replaces the 'state' map outright while leaving other fields (like PIN) intact.
  const syncToCloud = useCallback(async (stateToSave: AlbumState): Promise<boolean> => {
    if (!activeUser) return false;
    const docRef = doc(db, "users", activeUser);
    try {
      await updateDoc(docRef, {
        state: stateToSave,
        updatedAt: serverTimestamp()
      });
      return true;
    } catch (err: any) {
      // Document might not exist yet: create it via set (merge is safe here since no prior data exists)
      try {
        await setDoc(docRef, {
          state: stateToSave,
          updatedAt: serverTimestamp()
        }, { merge: true });
        return true;
      } catch (err2) {
        console.warn("[Stickers] Cloud sync failed:", err2);
        return false;
      }
    }
  }, [activeUser]);

  // Set up real-time listener inside useEffect
  useEffect(() => {
    if (!activeUser) {
      setLocalState({});
      setLoading(false);
      return;
    }

    setLoading(true);

    // Initial check: if local cache is dirty, sync it immediately
    const initialMeta = loadLocalStateMeta(activeUser);
    const initialData = loadLocalState(activeUser);

    if (initialMeta.synced === false) {
      console.info("[LiveSync] Unsynced changes found on mount. Pushing immediately…");
      syncToCloud(initialData).then((success) => {
        if (success) {
          saveLocalStateMeta(activeUser, { synced: true });
        }
      });
    }

    const docRef = doc(db, "users", activeUser);
    const unsubscribe = onSnapshot(docRef, 
      (docSnap) => {
        // If we have pending local writes, Firestore optimistically updates the cache.
        // Ignore the server snapshot in this case.
        if (docSnap.metadata.hasPendingWrites) {
          setLoading(false);
          return;
        }

        // Verify if local changes are dirty (race-condition protection)
        const currentMeta = loadLocalStateMeta(activeUser);
        if (currentMeta.synced === false) {
          const currentData = loadLocalState(activeUser);
          syncToCloud(currentData).then((success) => {
            if (success) {
              saveLocalStateMeta(activeUser, { synced: true });
            }
          });
          setLoading(false);
          return;
        }

        if (docSnap.exists()) {
          const cloudState = docSnap.data().state || {};
          saveLocalState(activeUser, cloudState);
          saveLocalStateMeta(activeUser, { synced: true });
          setLocalState(cloudState);
        } else {
          // Document does not exist yet in cloud: fall back to local
          const fallback = loadLocalState(activeUser);
          setLocalState(fallback);
        }
        setLoading(false);
      },
      (err) => {
        console.warn("[LiveSync] Listener error, using local fallback:", err);
        const fallback = loadLocalState(activeUser);
        setLocalState(fallback);
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [activeUser, syncToCloud]);

  // 500ms Debounced cloud save mechanism
  const triggerCloudSave = useCallback((stateToSave: AlbumState) => {
    if (!activeUser) return;
    if (cloudSaveTimer.current) {
      clearTimeout(cloudSaveTimer.current);
    }
    cloudSaveTimer.current = setTimeout(async () => {
      const success = await syncToCloud(stateToSave);
      if (success) {
        saveLocalStateMeta(activeUser, { synced: true });
      }
    }, 500); // 500ms per instructions
  }, [activeUser, syncToCloud]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (cloudSaveTimer.current) clearTimeout(cloudSaveTimer.current);
    };
  }, []);

  const setSticker = useCallback((id: string, count: number) => {
    if (!activeUser) return;
    setLocalState(prev => {
      const next = setStickerCount(prev, id, count);
      saveLocalState(activeUser, next);
      saveLocalStateMeta(activeUser, { synced: false });
      triggerCloudSave(next);
      return next;
    });
  }, [activeUser, triggerCloudSave]);

  const setStickerPlayerName = useCallback((id: string, name: string) => {
    if (!activeUser) return;
    setLocalState(prev => {
      const next = setStickerName(prev, id, name);
      saveLocalState(activeUser, next);
      saveLocalStateMeta(activeUser, { synced: false });
      triggerCloudSave(next);
      return next;
    });
  }, [activeUser, triggerCloudSave]);

  const resetAlbum = useCallback(async () => {
    if (!activeUser) return;
    if (cloudSaveTimer.current) clearTimeout(cloudSaveTimer.current);

    setLocalState({});
    saveLocalState(activeUser, {});
    saveLocalStateMeta(activeUser, { synced: false });

    const success = await syncToCloud({});
    if (success) {
      saveLocalStateMeta(activeUser, { synced: true });
    }
  }, [activeUser, syncToCloud]);

  return {
    state: localState,
    loading,
    setSticker,
    setStickerPlayerName,
    resetAlbum,
  };
};
