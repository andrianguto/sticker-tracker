import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth, getUserStorageKey } from './hooks/useAuth';
import { useStickers, isHave } from './hooks/useStickers';
import { allStickerIds, TOTAL_STICKERS } from './data';
import { Toast } from './components/Toast';
import { Login } from './components/Login';
import { BottomNav } from './components/BottomNav';
import { StickerSheet } from './components/StickerSheet';
import { AlbumView } from './views/AlbumView';
import { Onboarding } from './views/Onboarding';
import { MissingView } from './views/MissingView';
import { DuplicatesView } from './views/DuplicatesView';
import { StatsView } from './views/StatsView';

const ONBOARDED_KEY = "stickerTrackerOnboardedV1";
const SETUP_MODE_KEY = "stickerTrackerSetupModeV1";

export const App: React.FC = () => {
  const { 
    activeUser, 
    loading: authLoading, 
    login, 
    register, 
    logout, 
    error: authError,
    setError: setAuthError
  } = useAuth();

  const {
    state,
    loading: stickersLoading,
    setSticker,
    setStickerPlayerName,
    resetAlbum
  } = useStickers(activeUser);

  const [tab, setTab] = useState<string>("album");
  const [sheet, setSheet] = useState<string | null>(null);
  const [toast, setToast] = useState<string>("");
  const [onboarding, setOnboarding] = useState<boolean>(false);
  const [setupMode, setSetupModeRaw] = useState<"have" | "missing">("have");

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!activeUser) return;
    
    const onbKey = getUserStorageKey(activeUser, ONBOARDED_KEY);
    const modeKey = getUserStorageKey(activeUser, SETUP_MODE_KEY);
    
    setOnboarding(!localStorage.getItem(onbKey));
    setSetupModeRaw((localStorage.getItem(modeKey) as "have" | "missing") || "have");
  }, [activeUser]);

  const setSetupMode = useCallback((m: "have" | "missing") => {
    setSetupModeRaw(m);
    if (activeUser) {
      const modeKey = getUserStorageKey(activeUser, SETUP_MODE_KEY);
      localStorage.setItem(modeKey, m);
    }
  }, [activeUser]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 1800);
  }, []);

  const handleTap = useCallback((id: string) => {
    if (onboarding) {
      const c = state[id]?.c || 0;
      setSticker(id, c >= 1 ? 0 : 1);
    } else {
      const c = state[id]?.c || 0;
      if (c === 0) {
        setSticker(id, 1);
      } else {
        setSheet(id);
      }
    }
  }, [state, onboarding, setSticker]);

  const handleSet = useCallback((id: string, newCount: number) => {
    setSticker(id, newCount);
  }, [setSticker]);

  const handleName = useCallback((id: string, name: string) => {
    setStickerPlayerName(id, name);
  }, [setStickerPlayerName]);

  const handleFinishOnboarding = useCallback(() => {
    if (activeUser) {
      const onbKey = getUserStorageKey(activeUser, ONBOARDED_KEY);
      localStorage.setItem(onbKey, "1");
    }
    setOnboarding(false);
    showToast("Setup complete");
  }, [activeUser, showToast]);

  const handleSkipOnboarding = useCallback(() => {
    if (activeUser) {
      const onbKey = getUserStorageKey(activeUser, ONBOARDED_KEY);
      localStorage.setItem(onbKey, "1");
    }
    setOnboarding(false);
  }, [activeUser]);

  const lockApp = useCallback(() => {
    logout();
    setTab("album");
    setSheet(null);
  }, [logout]);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  if (authLoading) {
    return (
      <div className="app">
        <div className="cloud-loading">
          <div className="cloud-spinner"></div>
          <div className="cloud-msg">Verifying session…</div>
        </div>
      </div>
    );
  }

  if (!activeUser) {
    return (
      <Login 
        onUnlock={() => {}} 
        loginFn={login} 
        registerFn={register} 
        authError={authError}
        clearAuthError={setAuthError}
      />
    );
  }

  if (stickersLoading) {
    return (
      <div className="app">
        <div className="cloud-loading">
          <div className="cloud-spinner"></div>
          <div className="cloud-msg">Loading your album…</div>
        </div>
      </div>
    );
  }

  if (onboarding) {
    return (
      <div className="app">
        <header className="topbar">
          <div className="title">Album Setup <span className="user-chip">{activeUser}</span></div>
          <button className="topbar-skip" onClick={handleSkipOnboarding}>Skip ✕</button>
        </header>
        <Onboarding
          state={state}
          onTap={handleTap}
          onSet={handleSet}
          setupMode={setupMode}
          setSetupMode={setSetupMode}
          onFinish={handleFinishOnboarding}
          onSkip={handleSkipOnboarding}
        />
        <StickerSheet 
          id={sheet} 
          state={state} 
          onClose={() => setSheet(null)} 
          onSet={handleSet} 
          onName={handleName} 
        />
        <Toast msg={toast} />
      </div>
    );
  }

  const haveCount = allStickerIds().filter(id => isHave(state, id)).length;

  return (
    <div className="app">
      <header className="topbar">
        <div className="title">Sticker Tracker <span className="user-chip">{activeUser}</span></div>
        <div className="count">{haveCount}/{TOTAL_STICKERS}</div>
      </header>

      {tab === "album" && <AlbumView state={state} onTap={handleTap} />}
      {tab === "missing" && (
        <MissingView 
          state={state} 
          onSet={(id, n) => { handleSet(id, n); showToast(`${id} marked as got`); }} 
          onToast={showToast} 
        />
      )}
      {tab === "dupes" && <DuplicatesView state={state} onSet={handleSet} onToast={showToast} />}
      {tab === "stats" && (
        <StatsView
          state={state}
          activeUser={activeUser}
          onLogout={lockApp}
          onReset={() => {
            if (window.confirm("Reset all sticker progress? This cannot be undone.")) {
              resetAlbum();
              if (activeUser) {
                const onbKey = getUserStorageKey(activeUser, ONBOARDED_KEY);
                localStorage.removeItem(onbKey);
              }
              showToast("Collection cleared");
            }
          }}
          onReplayOnboarding={() => { setOnboarding(true); setTab("album"); }}
        />
      )}

      <StickerSheet 
        id={sheet} 
        state={state} 
        onClose={() => setSheet(null)} 
        onSet={handleSet} 
        onName={handleName} 
      />
      <Toast msg={toast} />
      <BottomNav tab={tab} setTab={setTab} />
    </div>
  );
};
export default App;
