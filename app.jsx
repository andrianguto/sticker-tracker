/* Sticker Tracker — app root */
const { useState, useEffect, useRef, useCallback } = React;

function App() {
  const [activeUser, setActiveUser] = useState(() => localStorage.getItem(ACTIVE_USER_KEY) || null);
  const [state, setState] = useState({});
  const [tab, setTab] = useState("album");
  const [sheet, setSheet] = useState(null);
  const [toast, setToast] = useState("");
  const [onboarding, setOnboarding] = useState(false);
  const [setupMode, setSetupModeRaw] = useState("have");
  const [loadingUser, setLoadingUser] = useState(() => !!localStorage.getItem(ACTIVE_USER_KEY));
  const toastTimer = useRef(null);
  const cloudSaveTimer = useRef(null);

  // Set up real-time listener for active user's album state
  useEffect(() => {
    if (!activeUser) return;

    setLoadingUser(true);

    // Initial check: if local cache is dirty (unsynced changes exist),
    // sync it to Firestore immediately before starting the listener.
    const localMeta = loadStateMeta(activeUser);
    const localData = loadState(activeUser);

    if (localMeta.synced === false) {
      console.info("[LiveSync] Unsynced changes found on load. Pushing to Firestore…");
      cloudSaveState(activeUser, localData)
        .then((success) => {
          if (success) saveStateMeta(activeUser, { synced: true });
        });
    }

    const unsubscribe = window.db.collection("users").doc(activeUser).onSnapshot(
      (docSnap) => {
        // If we have pending local writes, Firestore has already updated the cache optimistically,
        // so we don't want to overwrite with stale server snapshot.
        if (docSnap.metadata.hasPendingWrites) {
          setLoadingUser(false);
          return;
        }

        if (docSnap.exists) {
          const cloudData = docSnap.data();
          const cloudState = cloudData.state || {};
          
          // Re-verify if we have dirty local changes (to prevent race conditions)
          const currentMeta = loadStateMeta(activeUser);
          if (currentMeta.synced === false) {
            // Unsynced changes take precedence. Force upload them instead of overwriting.
            cloudSaveState(activeUser, loadState(activeUser))
              .then((success) => {
                if (success) saveStateMeta(activeUser, { synced: true });
              });
            setLoadingUser(false);
            return;
          }

          // Otherwise, sync cloud state to local cache and React state
          saveState(activeUser, cloudState);
          saveStateMeta(activeUser, { synced: true });
          setState(cloudState);
        } else {
          // Document doesn't exist in cloud yet, use local state
          const localData = loadState(activeUser);
          setState(localData);
        }
        setLoadingUser(false);
      },
      (err) => {
        console.warn("[LiveSync] listener error:", err.message);
        // Fallback to local storage
        setState(loadState(activeUser));
        setLoadingUser(false);
      }
    );

    // Load onboarding settings
    setOnboarding(!localStorage.getItem(userKey(activeUser, ONBOARDED_KEY)));
    setSetupModeRaw(localStorage.getItem(userKey(activeUser, SETUP_MODE_KEY)) || "have");

    return () => {
      unsubscribe();
    };
  }, [activeUser]);

  // Persist state: localStorage immediately with dirty flag, Firestore debounced 2 s
  useEffect(() => {
    if (!activeUser || loadingUser) return;
    
    // Save to LocalStorage immediately and mark as unsynced
    saveState(activeUser, state);
    saveStateMeta(activeUser, { synced: false });

    clearTimeout(cloudSaveTimer.current);
    cloudSaveTimer.current = setTimeout(() => {
      cloudSaveState(activeUser, state)
        .then((success) => {
          if (success) {
            saveStateMeta(activeUser, { synced: true });
          }
        });
    }, 2000);
  }, [state, activeUser, loadingUser]);

  const setSetupMode = useCallback((m) => {
    setSetupModeRaw(m);
    if (activeUser) localStorage.setItem(userKey(activeUser, SETUP_MODE_KEY), m);
  }, [activeUser]);

  const showToast = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 1800);
  }, []);

  const handleTap = useCallback((id) => {
    if (onboarding) {
      setState(s => {
        const c = stickerCount(s, id);
        return setStickerCount(s, id, c >= 1 ? 0 : 1);
      });
    } else {
      const c = stickerCount(state, id);
      if (c === 0) setState(s => setStickerCount(s, id, 1));
      else setSheet(id);
    }
  }, [state, onboarding]);

  const handleSet = useCallback((id, newCount) => {
    setState(s => setStickerCount(s, id, newCount));
  }, []);

  const handleName = useCallback((id, name) => {
    setState(s => setStickerName(s, id, name));
  }, []);

  const lockApp = useCallback(() => {
    localStorage.removeItem(ACTIVE_USER_KEY);
    setActiveUser(null);
    setState({});
    setTab("album");
    setSheet(null);
    setLoadingUser(false);
  }, []);

  // ── Not logged in ──────────────────────────────────────────────────────
  if (!activeUser) return <Login onUnlock={(u) => { setLoadingUser(true); setActiveUser(u); }} />;

  // ── Loading from cloud ─────────────────────────────────────────────────
  if (loadingUser) {
    return (
      <div className="app">
        <div className="cloud-loading">
          <div className="cloud-spinner"></div>
          <div className="cloud-msg">Loading your album…</div>
        </div>
      </div>
    );
  }

  // ── Onboarding ─────────────────────────────────────────────────────────
  if (onboarding) {
    return (
      <div className="app">
        <header className="topbar">
          <div className="title">Album Setup <span className="user-chip">{activeUser}</span></div>
          <button className="topbar-skip" onClick={() => {
            localStorage.setItem(userKey(activeUser, ONBOARDED_KEY), "1");
            setOnboarding(false);
          }}>Skip ✕</button>
        </header>
        <Onboarding
          state={state}
          onTap={handleTap}
          onSet={handleSet}
          setupMode={setupMode}
          setSetupMode={setSetupMode}
          onFinish={() => { localStorage.setItem(userKey(activeUser, ONBOARDED_KEY), "1"); setOnboarding(false); showToast("Setup complete"); }}
          onSkip={() => { localStorage.setItem(userKey(activeUser, ONBOARDED_KEY), "1"); setOnboarding(false); }}
        />
        <StickerSheet id={sheet} state={state} onClose={() => setSheet(null)} onSet={handleSet} onName={handleName} />
        <Toast msg={toast} />
      </div>
    );
  }

  // ── Main app ───────────────────────────────────────────────────────────
  const haveCount = window.allStickerIds().filter(id => isHave(state, id)).length;

  return (
    <div className="app">
      <header className="topbar">
        <div className="title">Sticker Tracker <span className="user-chip">{activeUser}</span></div>
        <div className="count">{haveCount}/{window.TOTAL_STICKERS}</div>
      </header>

      {tab === "album"   && <AlbumView state={state} onTap={handleTap} />}
      {tab === "missing" && <MissingView state={state} onSet={(id, n) => { handleSet(id, n); showToast(`${id} marked as got`); }} onToast={showToast} />}
      {tab === "dupes"   && <DuplicatesView state={state} onSet={handleSet} onToast={showToast} />}
      {tab === "stats"   && (
        <StatsView
          state={state}
          activeUser={activeUser}
          onLogout={lockApp}
          onReset={() => {
            if (window.confirm("Reset all sticker progress? This cannot be undone.")) {
              setState({});
              cloudSaveState(activeUser, {});
              localStorage.removeItem(userKey(activeUser, ONBOARDED_KEY));
              showToast("Collection cleared");
            }
          }}
          onReplayOnboarding={() => { setOnboarding(true); setTab("album"); }}
        />
      )}

      <StickerSheet id={sheet} state={state} onClose={() => setSheet(null)} onSet={handleSet} onName={handleName} />
      <Toast msg={toast} />
      <BottomNav tab={tab} setTab={setTab} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
