import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getRegistrationStatus, register } from "../api/auth";

export default function Register() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [regOpen, setRegOpen] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    getRegistrationStatus()
      .then((s) => setRegOpen(s.registration_open))
      .catch(() => setRegOpen(true))
      .finally(() => setChecking(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(email, username, password);
      navigate("/login");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("auth.register_failed"));
    } finally {
      setLoading(false);
    }
  };

  if (checking) return null;

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="logo-icon">{'\u262E'}</div>
        <h1>{t("auth.register_title")}</h1>
        <p className="subtitle">{t("auth.register_subtitle")}</p>
        {error && <div className="alert alert-error">{error}</div>}
        {regOpen === false ? (
          <div>
            <div className="alert alert-error" style={{ marginBottom: 16 }}>
              {t("auth.registration_disabled")}
            </div>
            <Link to="/login" className="btn btn-primary" style={{ display: "block", textAlign: "center" }}>
              {t("auth.to_login")}
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <label className="label">{t("auth.email")}</label>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("auth.email_placeholder")}
                required
              />
            </div>
            <div className="form-row">
              <label className="label">{t("auth.username")}</label>
              <input
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t("auth.username_placeholder")}
                minLength={3}
                required
              />
            </div>
            <div className="form-row">
              <label className="label">{t("auth.password")}</label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("auth.password_placeholder")}
                minLength={8}
                required
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: "100%" }}
              disabled={loading}
            >
              {loading ? t("common.loading") : t("auth.register_btn")}
            </button>
          </form>
        )}
        <p className="auth-footer">
          {t("auth.has_account")} <Link to="/login">{t("auth.login_link")}</Link>
        </p>
      </div>
    </div>
  );
}
