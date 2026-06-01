/* Sticker Tracker — UI components (Login, Sticker, Sheet, Toast, BottomNav) */
const { useState: useStateC, useEffect: useEffectC, useRef: useRefC } = React;

const STORAGE_KEY = "stickerTrackerV1";
const PIN_KEY = "stickerTrackerPinV1";
const ONBOARDED_KEY = "stickerTrackerOnboardedV1";
const SETUP_MODE_KEY = "stickerTrackerSetupModeV1";
const USERS_KEY = "stickerTrackerUsersV1";
const ACTIVE_USER_KEY = "stickerTrackerActiveUserV1";

function normalizeCode(c) { return (c || "").trim().toLowerCase(); }

function loadUsers() {
  try { return JSON.parse(localStorage.getItem(USERS_KEY) || "{}"); } catch { return {}; }
}
function saveUsers(u) { localStorage.setItem(USERS_KEY, JSON.stringify(u)); }
function userKey(codeword, base) { return `${base}::${normalizeCode(codeword)}`; }

// --- Persistence helpers ------------------------------------------------
function loadState(codeword) {
  try {
    const raw = localStorage.getItem(userKey(codeword, STORAGE_KEY));
    if (!raw) return {};
    return JSON.parse(raw);
  } catch { return {}; }
}
function saveState(codeword, s) {
  try { localStorage.setItem(userKey(codeword, STORAGE_KEY), JSON.stringify(s)); } catch {}
}

function stickerCount(state, id) { return state[id]?.c || 0; }
function isHave(state, id) { return stickerCount(state, id) >= 1; }
function dupCount(state, id) { return Math.max(0, stickerCount(state, id) - 1); }
function getName(state, id) { return state[id]?.name || ""; }

function setStickerCount(state, id, newCount) {
  const next = { ...state };
  const existing = next[id] || {};
  if (newCount <= 0) {
    if (existing.name) next[id] = { c: 0, name: existing.name };
    else delete next[id];
  } else {
    next[id] = { ...existing, c: newCount };
  }
  return next;
}
function setStickerName(state, id, name) {
  const next = { ...state };
  const existing = next[id] || { c: 0 };
  const trimmed = (name || "").trim();
  if (!trimmed && !existing.c) { delete next[id]; }
  else next[id] = { ...existing, name: trimmed };
  return next;
}

// --- Missing / Duplicates builders --------------------------------------
function buildMissing(state) {
  const result = [];
  for (const t of window.ALL_TEAMS) {
    const ids = [];
    for (let i = 1; i <= window.TEAM_STICKERS_PER_TEAM; i++) {
      const id = `${t.code}-${i}`;
      if (!isHave(state, id)) ids.push(id);
    }
    if (ids.length) result.push({ team: t, missing: ids });
  }
  const fwcFront = window.FWC_FRONT.filter(id => !isHave(state, id));
  const fwcBack  = window.FWC_BACK.filter(id => !isHave(state, id));
  return { teams: result, fwcFront, fwcBack };
}

function buildDuplicates(state) {
  const result = [];
  for (const t of window.ALL_TEAMS) {
    const items = [];
    for (let i = 1; i <= window.TEAM_STICKERS_PER_TEAM; i++) {
      const id = `${t.code}-${i}`;
      const d = dupCount(state, id);
      if (d > 0) items.push({ id, n: d });
    }
    if (items.length) result.push({ team: t, items });
  }
  const fwcFront = window.FWC_FRONT.map(id => ({ id, n: dupCount(state, id) })).filter(x => x.n > 0);
  const fwcBack  = window.FWC_BACK.map(id => ({ id, n: dupCount(state, id) })).filter(x => x.n > 0);
  return { teams: result, fwcFront, fwcBack };
}

async function copyText(txt) {
  try { await navigator.clipboard.writeText(txt); return true; }
  catch {
    const ta = document.createElement("textarea");
    ta.value = txt; document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); document.body.removeChild(ta); return true; }
    catch { document.body.removeChild(ta); return false; }
  }
}

// --- Toast ---------------------------------------------------------------
function Toast({ msg }) {
  if (!msg) return null;
  return <div className="toast"><span className="ic">✓</span>{msg}</div>;
}

// --- Login (multi-user: code word + PIN, cloud-backed) -------------------
function Login({ onUnlock }) {
  const users = loadUsers();
  const userCount = Object.keys(users).length;
  const hasLegacy = !!localStorage.getItem(PIN_KEY) && userCount === 0;

  const [mode, setMode] = useStateC(() =>
    userCount === 0 && !hasLegacy ? "signup" : hasLegacy ? "migrate" : "signin"
  );
  const [code, setCode] = useStateC("");
  const [pin, setPin] = useStateC("");
  const [confirm, setConfirm] = useStateC("");
  const [err, setErr] = useStateC("");
  const [submitting, setSubmitting] = useStateC(false);

  const submit = async () => {
    setErr("");
    const c = normalizeCode(code);
    if (!c) return setErr("Pick a code word.");
    if (c.length > 24) return setErr("Code word too long (max 24 chars).");
    if (pin.length < 4) return setErr("PIN needs at least 4 digits.");

    setSubmitting(true);

    if (mode === "signin") {
      let existing = loadUsers();
      let userPin = existing[c];

      if (!userPin) {
        // Not cached locally — look up in Firestore
        const cloudUser = await cloudGetUser(c);
        if (cloudUser) {
          userPin = cloudUser.pin;
          existing[c] = userPin;
          saveUsers(existing); // cache it for offline use
        }
      }

      if (userPin === pin) {
        localStorage.setItem(ACTIVE_USER_KEY, c);
        onUnlock(c);
      } else {
        setErr("Wrong code word or PIN.");
        setSubmitting(false);
      }
      return;
    }

    if (mode === "signup") {
      if (pin !== confirm) { setSubmitting(false); return setErr("PINs don't match."); }
      const existing = loadUsers();
      if (existing[c]) { setSubmitting(false); return setErr("Code word taken on this device."); }

      // Also check Firestore so two devices can't grab the same code word
      const takenOnCloud = await cloudCheckCodeword(c);
      if (takenOnCloud) { setSubmitting(false); return setErr("Code word already taken. Choose another."); }

      existing[c] = pin;
      saveUsers(existing);
      await cloudCreateUser(c, pin);
      localStorage.setItem(ACTIVE_USER_KEY, c);
      onUnlock(c);
      return;
    }

    if (mode === "migrate") {
      const legacyPin = localStorage.getItem(PIN_KEY);
      if (pin !== legacyPin) { setSubmitting(false); return setErr("PIN doesn't match your existing account."); }
      const existing = loadUsers();
      if (existing[c]) { setSubmitting(false); return setErr("Code word taken on this device."); }

      const takenOnCloud = await cloudCheckCodeword(c);
      if (takenOnCloud) { setSubmitting(false); return setErr("Code word already taken. Choose another."); }

      existing[c] = pin;
      saveUsers(existing);

      const oldStateRaw = localStorage.getItem(STORAGE_KEY);
      const oldState = oldStateRaw ? JSON.parse(oldStateRaw) : {};
      if (oldStateRaw) localStorage.setItem(userKey(c, STORAGE_KEY), oldStateRaw);
      const oldOnb = localStorage.getItem(ONBOARDED_KEY);
      if (oldOnb) localStorage.setItem(userKey(c, ONBOARDED_KEY), oldOnb);
      const oldMode = localStorage.getItem(SETUP_MODE_KEY);
      if (oldMode) localStorage.setItem(userKey(c, SETUP_MODE_KEY), oldMode);
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(PIN_KEY);
      localStorage.removeItem(ONBOARDED_KEY);
      localStorage.removeItem(SETUP_MODE_KEY);
      localStorage.setItem(ACTIVE_USER_KEY, c);

      await cloudCreateUser(c, pin);
      if (Object.keys(oldState).length > 0) await cloudSaveState(c, oldState);

      onUnlock(c);
      return;
    }
  };

  const titles = {
    signin: "Welcome back",
    signup: userCount === 0 ? "Create your account" : "Add another account",
    migrate: "Name your album",
  };
  const subs = {
    signin: "Enter your code word and PIN to open your album.",
    signup: "Choose a code word (your nickname) and a PIN. Two people on the same device can each have their own album with different code words.",
    migrate: "Add a code word to your existing account so you can share this device with someone else.",
  };

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-logo"><span className="dot"></span>Sticker Tracker</div>
        <h1>{titles[mode]}</h1>
        <p>{subs[mode]}</p>

        <div className="login-fields">
          <label className="login-label">Code word</label>
          <input
            className="login-input"
            type="text"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={24}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. messi-fan"
            disabled={submitting}
          />

          <label className="login-label">PIN</label>
          <input
            className="pin-input"
            type="tel"
            inputMode="numeric"
            pattern="[0-9]*"
            value={pin}
            maxLength={8}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            placeholder="••••"
            disabled={submitting}
            onKeyDown={(e) => { if (e.key === "Enter") (mode === "signup" ? document.getElementById("c2")?.focus() : submit()); }}
          />

          {mode === "signup" && (
            <>
              <label className="login-label">Confirm PIN</label>
              <input
                id="c2"
                className="pin-input"
                type="tel"
                inputMode="numeric"
                value={confirm}
                maxLength={8}
                onChange={(e) => setConfirm(e.target.value.replace(/\D/g, ""))}
                placeholder="confirm"
                disabled={submitting}
                onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              />
            </>
          )}
        </div>

        <div className="login-err">{err}&nbsp;</div>
        <button
          className="btn-primary"
          onClick={submit}
          disabled={submitting || !code.trim() || pin.length < 4 || (mode === "signup" && confirm.length < 4)}
        >
          {submitting ? "Please wait…" : mode === "signin" ? "Unlock" : mode === "migrate" ? "Save & Unlock" : "Create account"}
        </button>

        <div className="login-switch">
          {mode === "signin" && !submitting && (
            <button className="btn-ghost" onClick={() => { setMode("signup"); setErr(""); setPin(""); setConfirm(""); setCode(""); }}>
              + Create another account on this device
            </button>
          )}
          {mode === "signup" && !submitting && (
            <button className="btn-ghost" onClick={() => { setMode("signin"); setErr(""); setPin(""); setConfirm(""); setCode(""); }}>
              Already have an account? Sign in
            </button>
          )}
        </div>

        {mode === "signin" && userCount > 0 && (
          <div className="who-tip">Accounts on this device: <b>{Object.keys(users).join(", ")}</b></div>
        )}

        {mode !== "migrate" && !submitting && (
          <button className="btn-ghost danger" onClick={() => {
            const ok = window.confirm("Reset the app? This erases every account and album on this device.");
            if (ok) { localStorage.clear(); location.reload(); }
          }}>Forgot PIN? Reset app</button>
        )}
      </div>
    </div>
  );
}

// --- Sticker tile --------------------------------------------------------
function Sticker({ id, state, onTap, dim }) {
  const c = stickerCount(state, id);
  const have = c >= 1;
  const dup = c >= 2;
  const name = getName(state, id);
  const num = id.split("-")[1];
  return (
    <button
      className={`sticker${have ? " have" : ""}${dup ? " dup" : ""}${dim ? " dim" : ""}`}
      onClick={() => onTap(id)}
      aria-label={id + (name ? ` ${name}` : "")}
      title={name || id}
    >
      <span className="snum">{num}</span>
      {name && <span className="sname">{name}</span>}
      {dup && <span className="dup-badge">+{c - 1}</span>}
    </button>
  );
}

// --- Sticker action sheet -----------------------------------------------
function StickerSheet({ id, state, onClose, onSet, onName }) {
  const [nameDraft, setNameDraft] = useStateC("");
  useEffectC(() => { if (id) setNameDraft(getName(state, id)); }, [id]);
  if (!id) return null;

  const c = stickerCount(state, id);
  const have = c >= 1;
  const dup = Math.max(0, c - 1);
  const teamCode = id.startsWith("FWC") ? "FWC" : id.split("-")[0];
  const team = window.ALL_TEAMS.find(t => t.code === teamCode);
  const subtitle = team ? `${team.flag} ${team.name}` : "Special sticker";

  const commitName = () => {
    const stored = getName(state, id);
    if (nameDraft.trim() !== stored) onName(id, nameDraft);
  };

  return (
    <div className="sheet-back" onClick={() => { commitName(); onClose(); }}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="grip"></div>
        <div className="sheet-id">{id}</div>
        <div className="sheet-sub">{subtitle}</div>

        <div className="sheet-actions">
          <button className={`b${!have ? " active" : ""}`} onClick={() => onSet(id, 0)}>
            <span style={{ fontSize: 18 }}>○</span>
            Need it
            <small>missing</small>
          </button>
          <button className={`b${have && !dup ? " active" : ""}`} onClick={() => onSet(id, 1)}>
            <span style={{ fontSize: 18 }}>✓</span>
            Got it
            <small>in album</small>
          </button>
        </div>

        <div className="dup-stepper">
          <div className="lbl">Duplicates {dup > 0 ? `(${dup})` : ""}</div>
          <div className="controls">
            <button className="step" onClick={() => onSet(id, Math.max(1, c - 1))} disabled={c < 2}>−</button>
            <span className="num">{dup}</span>
            <button className="step" onClick={() => onSet(id, Math.max(2, c + 1))}>+</button>
          </div>
        </div>

        <div className="name-field">
          <label>Player / sticker name <span className="opt">(optional, searchable)</span></label>
          <input
            type="text"
            placeholder="e.g. Lionel Messi"
            value={nameDraft}
            maxLength={40}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => { if (e.key === "Enter") { commitName(); onClose(); } }}
          />
        </div>
      </div>
    </div>
  );
}

// --- Bottom nav ----------------------------------------------------------
function BottomNav({ tab, setTab }) {
  const items = [
    { id: "album", ic: "▦", label: "Album" },
    { id: "missing", ic: "✦", label: "Missing" },
    { id: "dupes", ic: "⇄", label: "Dupes" },
    { id: "stats", ic: "◔", label: "Stats" },
  ];
  return (
    <nav className="bottomnav">
      <div className="inner">
        {items.map(it => (
          <button key={it.id} className={tab === it.id ? "active" : ""}
                  onClick={() => { setTab(it.id); window.scrollTo({ top: 0 }); }}>
            <span className="ic">{it.ic}</span>{it.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

Object.assign(window, {
  STORAGE_KEY, PIN_KEY, ONBOARDED_KEY, SETUP_MODE_KEY,
  USERS_KEY, ACTIVE_USER_KEY, normalizeCode, loadUsers, saveUsers, userKey,
  loadState, saveState,
  stickerCount, isHave, dupCount, getName, setStickerCount, setStickerName,
  buildMissing, buildDuplicates, copyText,
  Toast, Login, Sticker, StickerSheet, BottomNav,
});
