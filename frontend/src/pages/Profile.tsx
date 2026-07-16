import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { disableTotp, enableTotp, getAvatarUrl, getRegistrationStatus, getTotpStatus, setRegistrationStatus, setupTotp, updateProfile, uploadAvatar } from "../api/auth";
import type { TotpSetup } from "../types";

export default function Profile() {
  const { t, i18n } = useTranslation();
  const { user, setUser } = useAuth();
  const [email, setEmail] = useState(user?.email ?? "");
  const [username, setUsername] = useState(user?.username ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  const [totpEnabled, setTotpEnabled] = useState(false);
  const [totpSetup, setTotpSetup] = useState<TotpSetup | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [totpLoading, setTotpLoading] = useState(false);
  const [totpMessage, setTotpMessage] = useState("");
  const [disablePassword, setDisablePassword] = useState("");
  const [regOpen, setRegOpen] = useState(true);
  const [regLoading, setRegLoading] = useState(false);

  useEffect(() => {
    getTotpStatus().then((s) => setTotpEnabled(s.totp_enabled)).catch(() => {});
    getRegistrationStatus().then((s) => setRegOpen(s.registration_open)).catch(() => {});
  }, []);

  if (!user) return null;

  const hasLocalAvatar = user.avatar_path !== null;
  const avatarUrl = getAvatarUrl();

  const handleSave = async () => {
    setError("");
    setSaved(false);
    try {
      const data: Record<string, string> = {};
      if (email !== user.email) data.email = email;
      if (username !== user.username) data.username = username;
      if (password) data.password = password;
      if (Object.keys(data).length === 0) return;
      const updated = await updateProfile(data);
      setUser(updated);
      setSaved(true);
      setPassword("");
      setTimeout(() => setSaved(false), 2000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("common.error"));
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const updated = await uploadAvatar(file);
      setUser(updated);
      setAvatarError(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("profile.error_upload"));
    } finally {
      setUploading(false);
    }
  };

  const handleSetupTotp = async () => {
    setTotpLoading(true);
    setTotpMessage("");
    try {
      const result = await setupTotp();
      setTotpSetup(result);
    } catch (e: unknown) {
      setTotpMessage(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setTotpLoading(false);
    }
  };

  const handleEnableTotp = async () => {
    setTotpLoading(true);
    setTotpMessage("");
    try {
      await enableTotp(totpCode);
      setTotpEnabled(true);
      setTotpSetup(null);
      setTotpCode("");
      setTotpMessage(t("profile.2fa_activated_msg"));
    } catch (e: unknown) {
      setTotpMessage(e instanceof Error ? e.message : t("auth.code_invalid"));
    } finally {
      setTotpLoading(false);
    }
  };

  const handleDisableTotp = async () => {
    setTotpLoading(true);
    setTotpMessage("");
    try {
      await disableTotp(disablePassword);
      setTotpEnabled(false);
      setDisablePassword("");
      setTotpMessage(t("profile.2fa_deactivated_msg"));
    } catch (e: unknown) {
      setTotpMessage(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setTotpLoading(false);
    }
  };

  const handleToggleRegistration = async () => {
    setRegLoading(true);
    try {
      const result = await setRegistrationStatus(!regOpen);
      setRegOpen(result.registration_open);
    } catch {
      // ignore
    } finally {
      setRegLoading(false);
    }
  };

  const handleLanguageChange = async (lang: string) => {
    await i18n.changeLanguage(lang);
    try {
      const updated = await updateProfile({ language: lang });
      setUser(updated);
    } catch {
      // ignore
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>{t("profile.title")}</h1>
        <button className="btn btn-primary" onClick={handleSave}>
          {saved ? `\u2713 ${t("profile.saved")}` : t("profile.save")}
        </button>
      </div>
      {error && <div className="alert alert-error">{error}</div>}

      <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <div className="form-card">
            <h2 style={{ marginBottom: 16 }}>{t("profile.general")}</h2>
            <div className="detail-grid">
              <div className="form-row">
                <label className="label">{t("profile.email")}</label>
                <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="form-row">
                <label className="label">{t("profile.username")}</label>
                <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} />
              </div>
              <div className="form-row">
                <label className="label">{t("profile.language")}</label>
                <select
                  className="input"
                  value={user.language}
                  onChange={(e) => handleLanguageChange(e.target.value)}
                  style={{ cursor: "pointer" }}
                >
                  <option value="en">{t("profile.language_en")}</option>
                  <option value="de">{t("profile.language_de")}</option>
                </select>
              </div>
            </div>
          </div>

          <div className="form-card">
            <h2 style={{ marginBottom: 16 }}>{t("profile.password_section")}</h2>
            <p style={{ fontSize: "0.85rem", color: "var(--neutral-500)", marginBottom: 12 }}>
              {t("profile.password_hint")}
            </p>
            <div className="form-row">
              <label className="label">{t("profile.new_password")}</label>
              <input className="input" type="password" value={password} placeholder={t("profile.password_placeholder")} onChange={(e) => setPassword(e.target.value)} />
            </div>
          </div>

          {user.is_superuser && (
            <div className="form-card">
              <h2 style={{ marginBottom: 16 }}>{t("profile.registration_section")}</h2>
              <p style={{ fontSize: "0.85rem", color: "var(--neutral-500)", marginBottom: 12 }}>
                {t("profile.registration_desc")}
              </p>
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={regOpen}
                  onChange={handleToggleRegistration}
                  disabled={regLoading}
                  style={{ width: 18, height: 18, accentColor: "var(--green-500)" }}
                />
                <span>{t("profile.registration_toggle")}</span>
              </label>
            </div>
          )}

          <div className="form-card">
            <h2 style={{ marginBottom: 16 }}>{t("profile.2fa_section")}</h2>
            {totpMessage && <div style={{ color: "var(--green-600)", marginBottom: 12, fontSize: "0.9rem" }}>{totpMessage}</div>}

            {!totpEnabled ? (
              !totpSetup ? (
                <div>
                  <p style={{ fontSize: "0.85rem", color: "var(--neutral-500)", marginBottom: 12 }}>
                    {t("profile.2fa_intro")}
                  </p>
                  <button className="btn btn-primary" onClick={handleSetupTotp} disabled={totpLoading}>
                    {totpLoading ? t("profile.2fa_preparing") : t("profile.2fa_setup_btn")}
                  </button>
                </div>
              ) : (
                <div>
                  <p style={{ fontSize: "0.85rem", color: "var(--neutral-500)", marginBottom: 12 }}>
                    {t("profile.2fa_scan")}
                  </p>
                  <div style={{ textAlign: "center", marginBottom: 12 }}>
                    <img src={`data:image/png;base64,${totpSetup.qr_code}`} alt="QR Code" style={{ width: 180, height: 180, borderRadius: 8 }} />
                  </div>
                  <details style={{ marginBottom: 12, fontSize: "0.8rem", color: "var(--neutral-400)" }}>
                    <summary>{t("profile.2fa_manual")}</summary>
                    <p style={{ marginTop: 6, wordBreak: "break-all", fontFamily: "var(--font-mono)" }}>{totpSetup.secret}</p>
                  </details>
                  <div className="form-row">
                    <label className="label">{t("auth.2fa_code")}</label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input className="input" value={totpCode} onChange={(e) => setTotpCode(e.target.value)} placeholder={t("profile.2fa_code_placeholder")} maxLength={6} style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: "1.1rem", letterSpacing: 4 }} />
                      <button className="btn btn-primary" onClick={handleEnableTotp} disabled={totpLoading || totpCode.length < 6}>
                        {t("profile.2fa_activate_btn")}
                      </button>
                    </div>
                  </div>
                </div>
              )
            ) : (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <span style={{ color: "var(--green-500)", fontSize: "1.2rem" }}>&#10003;</span>
                  <span style={{ fontWeight: 600 }}>{t("profile.2fa_active")}</span>
                </div>
                <div className="form-row">
                  <label className="label">{t("profile.2fa_deactivate_hint")}</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input className="input" type="password" value={disablePassword} onChange={(e) => setDisablePassword(e.target.value)} placeholder={t("auth.password")} style={{ flex: 1 }} />
                    <button className="btn btn-secondary" onClick={handleDisableTotp} disabled={totpLoading || !disablePassword}>
                      {t("profile.2fa_deactivate_btn")}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="form-card" style={{ width: 300, flexShrink: 0 }}>
          <h2 style={{ marginBottom: 16 }}>{t("profile.avatar")}</h2>
          {hasLocalAvatar && !avatarError ? (
            <img src={avatarUrl} alt="Avatar" onError={() => setAvatarError(true)} style={{ width: "100%", borderRadius: "var(--radius-sm)", marginBottom: 12, aspectRatio: "1", objectFit: "cover" }} />
          ) : (
            <div style={{ width: "100%", aspectRatio: "1", borderRadius: "var(--radius-sm)", background: "var(--neutral-100)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--neutral-400)", fontSize: "0.9rem", marginBottom: 12 }}>
              {t("profile.no_avatar")}
            </div>
          )}
          <label className="btn btn-secondary" style={{ cursor: "pointer", width: "100%", textAlign: "center" }}>
            {uploading ? t("profile.uploading") : t("profile.select_avatar")}
            <input type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: "none" }} disabled={uploading} />
          </label>
        </div>
      </div>
    </div>
  );
}
