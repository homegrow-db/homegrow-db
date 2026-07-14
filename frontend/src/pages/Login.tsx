import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { login, verify2fa } from "../api/auth";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { t } = useTranslation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [tempToken, setTempToken] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { setUser } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (tempToken) {
      await handle2fa();
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await login(username, password);
      if (res.requires_2fa && res.temp_token) {
        setTempToken(res.temp_token);
        setLoading(false);
        return;
      }
      localStorage.setItem("token", res.access_token!);
      const me = await (
        await fetch("/auth/me", {
          headers: { Authorization: `Bearer ${res.access_token}` },
        })
      ).json();
      setUser(me);
      navigate("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("auth.invalid_credentials"));
    } finally {
      setLoading(false);
    }
  };

  const handle2fa = async () => {
    if (!tempToken) return;
    setError("");
    setLoading(true);
    try {
      localStorage.setItem("token", tempToken);
      const res = await verify2fa(code);
      localStorage.setItem("token", res.access_token);
      const me = await (
        await fetch("/auth/me", {
          headers: { Authorization: `Bearer ${res.access_token}` },
        })
      ).json();
      setUser(me);
      navigate("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("auth.code_invalid"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="logo-icon">{'\u262E'}</div>
        <h1>{t("auth.login_title")}</h1>
        <p className="subtitle">{tempToken ? t("auth.login_2fa_subtitle") : t("auth.login_subtitle")}</p>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleLogin}>
          {!tempToken ? (
            <>
              <div className="form-row">
                <label className="label">{t("auth.username")}</label>
                <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder={t("auth.username_placeholder")} required />
              </div>
              <div className="form-row">
                <label className="label">{t("auth.password")}</label>
                <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("auth.password_placeholder")} required />
              </div>
            </>
          ) : (
            <div className="form-row">
              <label className="label">{t("auth.2fa_code")}</label>
              <input className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="000000" maxLength={6} required autoFocus />
            </div>
          )}
          <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={loading}>
            {loading ? t("common.loading") : tempToken ? t("auth.2fa_confirm") : t("auth.login_btn")}
          </button>
        </form>
        {tempToken ? (
          <p className="auth-footer">
            <button className="btn btn-secondary btn-sm" onClick={() => { setTempToken(null); setCode(""); }} style={{ marginTop: 12 }}>
              {t("auth.back_to_login")}
            </button>
          </p>
        ) : (
          <p className="auth-footer">
            {t("auth.no_account")} <Link to="/register">{t("auth.register_link")}</Link>
          </p>
        )}
      </div>
    </div>
  );
}
