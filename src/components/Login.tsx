import React, { useState } from 'react';

interface LoginProps {
  onUnlock: (codeword: string) => void;
  loginFn: (codeword: string, pin: string) => Promise<string>;
  registerFn: (codeword: string, pin: string) => Promise<string>;
  authError: string | null;
  clearAuthError: (err: string | null) => void;
}

export const Login: React.FC<LoginProps> = ({ 
  onUnlock, 
  loginFn, 
  registerFn, 
  authError,
  clearAuthError
}) => {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const cachedAccounts = () => {
    try {
      const usersRaw = localStorage.getItem("stickerTrackerUsersV1");
      return usersRaw ? Object.keys(JSON.parse(usersRaw)) : [];
    } catch {
      return [];
    }
  };
  const userList = cachedAccounts();

  const submit = async () => {
    setErr("");
    clearAuthError(null);
    const cleanCode = code.trim().toLowerCase();

    if (!cleanCode) return setErr("Pick a code word.");
    if (cleanCode.length > 24) return setErr("Code word too long (max 24 chars).");
    if (pin.length < 4) return setErr("PIN needs at least 4 digits.");

    setSubmitting(true);

    try {
      if (mode === "signin") {
        const u = await loginFn(cleanCode, pin);
        onUnlock(u);
      } else {
        if (pin !== confirm) {
          setSubmitting(false);
          return setErr("PINs don't match.");
        }
        const u = await registerFn(cleanCode, pin);
        onUnlock(u);
      }
    } catch (e: any) {
      setErr(e.message || "Authentication failed.");
      setSubmitting(false);
    }
  };

  const titles = {
    signin: "Welcome back",
    signup: userList.length === 0 ? "Create your account" : "Add another account"
  };

  const subs = {
    signin: "Enter your code word and PIN to open your album.",
    signup: "Choose a code word (your nickname) and a PIN. Two people on the same device can each have their own album with different code words."
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
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (mode === "signup") {
                  document.getElementById("c2")?.focus();
                } else {
                  submit();
                }
              }
            }}
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
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                }}
              />
            </>
          )}
        </div>

        <div className="login-err">{err || authError || <>&nbsp;</>}</div>
        <button
          className="btn-primary"
          onClick={submit}
          disabled={submitting || !code.trim() || pin.length < 4 || (mode === "signup" && confirm.length < 4)}
        >
          {submitting ? "Please wait…" : mode === "signin" ? "Unlock" : "Create account"}
        </button>

        <div className="login-switch">
          {mode === "signin" && !submitting && (
            <button className="btn-ghost" onClick={() => { setMode("signup"); setErr(""); setPin(""); setConfirm(""); setCode(""); clearAuthError(null); }}>
              + Create another account on this device
            </button>
          )}
          {mode === "signup" && !submitting && (
            <button className="btn-ghost" onClick={() => { setMode("signin"); setErr(""); setPin(""); setConfirm(""); setCode(""); clearAuthError(null); }}>
              Already have an account? Sign in
            </button>
          )}
        </div>

        {mode === "signin" && userList.length > 0 && (
          <div className="who-tip">Accounts on this device: <b>{userList.join(", ")}</b></div>
        )}

        {!submitting && (
          <button className="btn-ghost danger" onClick={() => {
            const ok = window.confirm("Reset the app? This erases every account and album on this device.");
            if (ok) { 
              localStorage.clear(); 
              window.location.reload(); 
            }
          }}>Forgot PIN? Reset app</button>
        )}
      </div>
    </div>
  );
};
export default Login;
