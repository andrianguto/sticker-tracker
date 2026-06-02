import { useState, useEffect, useRef, useCallback } from 'react';
import { doc, onSnapshot, updateDoc, setDoc, serverTimestamp, deleteField } from 'firebase/firestore';
import { db } from '../firebase';
import { AlbumState, StickerRecord } from '../types';
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

const STORAGE_PENDING_KEY = "stickerTrackerV1::pending";

export const savePendingChanges = (
  codeword: string,
  pending: Map<string, StickerRecord | null>,
  inFlight: Map<string, StickerRecord | null>
) => {
  try {
    const obj: Record<string, StickerRecord | null> = {};
    for (const [id, val] of inFlight) {
      obj[id] = val;
    }
    for (const [id, val] of pending) {
      obj[id] = val;
    }
    localStorage.setItem(getUserStorageKey(codeword, STORAGE_PENDING_KEY), JSON.stringify(obj));
  } catch (err) {
    console.error("[PendingState] Save failed:", err);
  }
};

export const loadPendingChanges = (codeword: string): Map<string, StickerRecord | null> => {
  try {
    const raw = localStorage.getItem(getUserStorageKey(codeword, STORAGE_PENDING_KEY));
    if (!raw) return new Map();
    const obj: Record<string, StickerRecord | null> = JSON.parse(raw);
    const map = new Map<string, StickerRecord | null>();
    for (const [id, val] of Object.entries(obj)) {
      map.set(id, val);
    }
    return map;
  } catch {
    return new Map();
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
  
  // Two-queue write pipeline
  const pendingChangesRef = useRef<Map<string, StickerRecord | null>>(new Map());
  const inFlightChangesRef = useRef<Map<string, StickerRecord | null>>(new Map());

  // Ref to break circular dependency between scheduleFlush and flushToCloud
  const flushToCloudRef = useRef<(() => Promise<void>) | undefined>(undefined);

  // Full-document replace. Used only for whole-album operations (reset).
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

  // 500ms debounced flush trigger.
  const scheduleFlush = useCallback(() => {
    if (!activeUser) return;
    if (cloudSaveTimer.current) {
      clearTimeout(cloudSaveTimer.current);
    }
    cloudSaveTimer.current = setTimeout(() => { 
      flushToCloudRef.current?.(); 
    }, 500);
  }, [activeUser]);

  // Flush queued per-sticker edits to Firestore using field-level writes.
  // Only allows one active in-flight write at a time.
  const flushToCloud = useCallback(async () => {
    if (!activeUser) return;
    if (inFlightChangesRef.current.size > 0) return; // Wait for active write to finish

    const flushing = pendingChangesRef.current;
    if (flushing.size === 0) return;

    // Move pending changes to in-flight
    inFlightChangesRef.current = flushing;
    pendingChangesRef.current = new Map();
    savePendingChanges(activeUser, pendingChangesRef.current, inFlightChangesRef.current);

    const docRef = doc(db, "users", activeUser);
    const updates: Record<string, unknown> = { updatedAt: serverTimestamp() };
    for (const [id, val] of flushing) {
      updates[`state.${id}`] = val === null ? deleteField() : val;
    }

    try {
      await updateDoc(docRef, updates);
      
      // Success! Clear in-flight
      inFlightChangesRef.current = new Map();
      savePendingChanges(activeUser, pendingChangesRef.current, inFlightChangesRef.current);

      if (pendingChangesRef.current.size > 0) {
        scheduleFlush();
      } else {
        saveLocalStateMeta(activeUser, { synced: true });
      }
    } catch {
      // Document might not exist yet: create it from current local state.
      try {
        await setDoc(docRef, {
          state: loadLocalState(activeUser),
          updatedAt: serverTimestamp()
        }, { merge: true });
        
        // Success! Clear in-flight
        inFlightChangesRef.current = new Map();
        savePendingChanges(activeUser, pendingChangesRef.current, inFlightChangesRef.current);

        if (pendingChangesRef.current.size > 0) {
          scheduleFlush();
        } else {
          saveLocalStateMeta(activeUser, { synced: true });
        }
      } catch (err) {
        console.warn("[Stickers] Cloud sync failed:", err);
        // Move in-flight back to pending (without overwriting newer edits in pending)
        for (const [id, val] of flushing) {
          if (!pendingChangesRef.current.has(id)) {
            pendingChangesRef.current.set(id, val);
          }
        }
        inFlightChangesRef.current = new Map();
        savePendingChanges(activeUser, pendingChangesRef.current, inFlightChangesRef.current);
        
        // Retry
        scheduleFlush();
      }
    }
  }, [activeUser, scheduleFlush]);

  // Keep the ref updated with the latest flushToCloud callback
  useEffect(() => {
    flushToCloudRef.current = flushToCloud;
  }, [flushToCloud]);

  // Set up real-time listener inside useEffect
  useEffect(() => {
    if (!activeUser) {
      setLocalState({});
      setLoading(false);
      return;
    }

    setLoading(true);

    const initialMeta = loadLocalStateMeta(activeUser);
    const initialData = loadLocalState(activeUser);

    // Load persisted pending changes from localStorage on mount
    const savedPending = loadPendingChanges(activeUser);
    pendingChangesRef.current = savedPending;

    if (savedPending.size > 0) {
      console.info(`[LiveSync] Found ${savedPending.size} unsynced changes on mount. Scheduling flush…`);
      saveLocalStateMeta(activeUser, { synced: false });
      scheduleFlush();
    }

    const docRef = doc(db, "users", activeUser);
    let isFirst = true;

    const unsubscribe = onSnapshot(docRef, 
      (docSnap) => {
        if (!docSnap.exists()) {
          // Document does not exist yet in cloud: fall back to local
          setLocalState(loadLocalState(activeUser));
          setLoading(false);
          return;
        }

        const cloudState: AlbumState = docSnap.data().state || {};

        if (isFirst) {
          isFirst = false;
          // Legacy migration check: if initialMeta.synced is false, but savedPending was empty,
          // compare local data and cloudState on the first snapshot.
          if (initialMeta.synced === false && savedPending.size === 0) {
            console.info("[LiveSync] Legacy unsynced state detected. Comparing with cloud state…");
            const migratedPending = new Map<string, StickerRecord | null>();
            for (const [id, localVal] of Object.entries(initialData)) {
              const cloudVal = cloudState[id];
              if (!cloudVal || cloudVal.c !== localVal.c || cloudVal.name !== localVal.name) {
                migratedPending.set(id, localVal);
              }
            }

            if (migratedPending.size > 0) {
              console.info(`[LiveSync] Migrated ${migratedPending.size} legacy unsynced changes.`);
              pendingChangesRef.current = migratedPending;
              savePendingChanges(activeUser, pendingChangesRef.current, inFlightChangesRef.current);
              saveLocalStateMeta(activeUser, { synced: false });
              scheduleFlush();
            } else {
              saveLocalStateMeta(activeUser, { synced: true });
            }
          }
        }

        const pending = pendingChangesRef.current;
        const inFlight = inFlightChangesRef.current;

        // Accept the server's view, but keep our own un-flushed and in-flight edits on top.
        setLocalState(prev => {
          let next = cloudState;
          if (pending.size > 0 || inFlight.size > 0) {
            next = { ...cloudState };
            
            // Merge in-flight changes first
            for (const id of inFlight.keys()) {
              const localVal = prev[id];
              if (localVal !== undefined) next[id] = localVal;
              else delete next[id];
            }
            
            // Merge pending changes (pending takes precedence over in-flight)
            for (const id of pending.keys()) {
              const localVal = prev[id];
              if (localVal !== undefined) next[id] = localVal;
              else delete next[id];
            }
          }
          saveLocalState(activeUser, next);
          return next;
        });

        saveLocalStateMeta(activeUser, { synced: pending.size === 0 && inFlight.size === 0 });
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
  }, [activeUser, scheduleFlush]);

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
      return next;
    });

    const singleObj = setStickerCount({}, id, count);
    const newVal = singleObj[id] ?? null;

    pendingChangesRef.current.set(id, newVal);
    savePendingChanges(activeUser, pendingChangesRef.current, inFlightChangesRef.current);
    scheduleFlush();
  }, [activeUser, scheduleFlush]);

  const setStickerPlayerName = useCallback((id: string, name: string) => {
    if (!activeUser) return;
    setLocalState(prev => {
      const next = setStickerName(prev, id, name);
      saveLocalState(activeUser, next);
      saveLocalStateMeta(activeUser, { synced: false });
      return next;
    });

    const singleObj = setStickerName({}, id, name);
    const newVal = singleObj[id] ?? null;

    pendingChangesRef.current.set(id, newVal);
    savePendingChanges(activeUser, pendingChangesRef.current, inFlightChangesRef.current);
    scheduleFlush();
  }, [activeUser, scheduleFlush]);

  const resetAlbum = useCallback(async () => {
    if (!activeUser) return;
    if (cloudSaveTimer.current) clearTimeout(cloudSaveTimer.current);
    pendingChangesRef.current = new Map();
    inFlightChangesRef.current = new Map();
    savePendingChanges(activeUser, new Map(), new Map());

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
