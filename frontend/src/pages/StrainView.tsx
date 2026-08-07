import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getStrain, getStrainImageUrl } from "../api/strains";

export default function StrainView() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [strain, setStrain] = useState<any>(null);
  const [error, setError] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (!id) return;
    setImageUrl(getStrainImageUrl(id));
    setImageError(false);
    getStrain(id)
      .then(setStrain)
      .catch((e: Error) => setError(e.message));
  }, [id]);

  const show = (value: string | number | null | undefined) =>
    value != null && value !== "" ? String(value) : "-";

  if (!strain && !error) return <p style={{ padding: 32, color: "var(--neutral-400)" }}>{t("common.loading")}</p>;
  if (!strain) return <div className="alert alert-error">{error}</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate("/strains")} style={{ marginBottom: 8 }}>
            &larr; {t("common.back")}
          </button>
          <h1>{strain.name}</h1>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span className="seed-badge">{strain.seed_count} {t("strains.seeds")}</span>
          <span className="seed-badge">{strain.grow_count} {t("strains.grows")}</span>
          <button className="btn btn-primary" onClick={() => navigate(`/strains/${strain.id}/edit`)}>
            &#9998; {t("common.edit")}
          </button>
        </div>
      </div>

      <div className="detail-layout">
        <div style={{ flex: 1 }}>
          <div className="form-card">
            <h2 style={{ marginBottom: 16 }}>{t("strains.general_info")}</h2>
            <div className="detail-grid">
              <div className="form-row">
                <label className="label">{t("strains.breeder")}</label>
                <div className="input" style={{ background: "var(--neutral-50)" }}>{show(strain.breeder)}</div>
              </div>
              <div className="form-row">
                <label className="label">{t("strains.genetics")}</label>
                <div className="input" style={{ background: "var(--neutral-50)" }}>{show(strain.genetics)}</div>
              </div>
            </div>
          </div>

          <div className="form-card">
            <h2 style={{ marginBottom: 16 }}>{t("strains.strain_details")}</h2>
            <div className="detail-grid">
              <div className="form-row">
                <label className="label">{t("strains.genetic_origin")}</label>
                <div className="input" style={{ background: "var(--neutral-50)", minHeight: 60 }}>{show(strain.genetic_origin)}</div>
              </div>
              <div className="form-row">
                <label className="label">{t("strains.aroma")}</label>
                <div className="input" style={{ background: "var(--neutral-50)", minHeight: 60 }}>{show(strain.aroma)}</div>
              </div>
            </div>
            <div className="form-row">
              <label className="label">{t("strains.effects")}</label>
              <div className="input" style={{ background: "var(--neutral-50)", minHeight: 60 }}>{show(strain.effects)}</div>
            </div>
            <div className="form-row">
              <label className="label">{t("strains.description")}</label>
              <div className="input" style={{ background: "var(--neutral-50)", minHeight: 60 }}>{show(strain.description)}</div>
            </div>
          </div>

          <div className="form-card">
            <h2 style={{ marginBottom: 16 }}>{t("strains.thc")} / {t("strains.cbd")} &amp; {t("strains.flowering_weeks")}</h2>
            <div className="detail-grid">
              <div className="form-row">
                <label className="label">{t("strains.thc")}</label>
                <div className="input" style={{ background: "var(--neutral-50)" }}>{strain.thc_content != null ? `${strain.thc_content}%` : "-"}</div>
              </div>
              <div className="form-row">
                <label className="label">{t("strains.cbd")}</label>
                <div className="input" style={{ background: "var(--neutral-50)" }}>{strain.cbd_content != null ? `${strain.cbd_content}%` : "-"}</div>
              </div>
              <div className="form-row">
                <label className="label">{t("strains.flowering_weeks")}</label>
                <div className="input" style={{ background: "var(--neutral-50)" }}>{show(strain.flowering_weeks)}</div>
              </div>
              <div></div>
            </div>
          </div>
        </div>

        <div className="form-card" style={{ width: 300, flexShrink: 0 }}>
          <h2 style={{ marginBottom: 16 }}>{t("strains.images_gallery")}</h2>
          {imageUrl && !imageError ? (
            <img
              src={imageUrl}
              alt={strain.name}
              onError={() => setImageError(true)}
              style={{ width: "100%", borderRadius: "var(--radius-sm)" }}
            />
          ) : (
            <div
              style={{
                width: "100%", height: 200, borderRadius: "var(--radius-sm)",
                background: "var(--neutral-100)", display: "flex", alignItems: "center",
                justifyContent: "center", color: "var(--neutral-400)", fontSize: "0.9rem",
              }}
            >
              {t("common.no_image")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}