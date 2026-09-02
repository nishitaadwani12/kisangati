import { useState } from "react";
import { useAuth } from "../auth";
import { useI18n } from "../i18n";
import { ThemeSwitcher } from "../theme";

export function Login() {
  const { login } = useAuth();
  const { t, lang, setLang } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    try { await login(email.trim(), password); }
    catch (e2) { setErr((e2 as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="login-lang">
          <button type="button" className={lang === "hi" ? "on" : ""} onClick={() => setLang("hi")}>हिं</button>
          <button type="button" className={lang === "en" ? "on" : ""} onClick={() => setLang("en")}>EN</button>
        </div>
        <h1 className="brand-title">KisanGati</h1>
        <p className="muted" style={{ marginTop: 0 }}>{t("loginTagline")}</p>
        {err && <div className="err">{err}</div>}
        <div className="field" style={{ marginBottom: 10 }}>
          <label>{t("email")}</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        </div>
        <div className="field" style={{ marginBottom: 14 }}>
          <label>{t("password")}</label>
          <div className="pw-row">
            <input type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="button" className="pw-toggle" onClick={() => setShowPw(!showPw)}>
              {showPw ? t("hide") : t("show")}
            </button>
          </div>
        </div>
        <button type="submit" disabled={busy || !email || !password} style={{ width: "100%" }}>{t("signIn")}</button>
        <ThemeSwitcher variant="login" />
      </form>
    </div>
  );
}
