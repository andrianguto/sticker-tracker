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

  // When active user changes: pull latest state from Firestore, fall back to localStorage
  useEffect(() => {
    if (!activeUser) return;

    setLoadingUser(true);

    cloudGetUser(activeUser)
      .then(cloudUser => {
        if (cloudUser && cloudUser.state && Object.keys(cloudUser.state).length > 0) {
          saveState(activeUser, cloudUser.state); // refresh local cache
          setState(cloudUser.state);
        } else {
          setState(loadState(activeUser));
        }
      })
      .catch(() => {
        setState(loadState(activeUser));
      })
      .finally(() => {
        setOnboarding(!localStorage.getItem(userKey(activeUser, ONBOARDED_KEY)));
        setSetupModeRaw(localStorage.getItem(userKey(activeUser, SETUP_MODE_KEY)) || "have");
        setLoadingUser(false);
      });
  }, [activeUser]);

  // Persist state: localStorage immediately, Firestore debounced 2 s after last tap
  useEffect(() => {
    if (!activeUser || loadingUser) return;
    saveState(activeUser, state);

    clearTimeout(cloudSaveTimer.current);
    cloudSaveTimer.current = setTimeout(() => {
      cloudSaveState(activeUser, state);
    }, 2000);
  }, [state, activeUser]);

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
