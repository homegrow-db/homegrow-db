import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getStrain, getStrainImageUrl, updateStrain, uploadStrainImage } from "../api/strains";

export default function StrainDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [strain, setStrain] = useState<any>(null);
  const [form, setForm] = useState({
    breeder: "", genetics: "", genetic_origin: "", effects: "", aroma: "",
    thc_content: "", cbd_content: "", flowering_weeks: "", description: "",
  });
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (!id) return;
    getStrain(id)
      .then((s) => {
        setStrain(s);
        setForm({
          breeder: s.breeder ?? "", genetics: s.genetics ?? "",
          genetic_origin: s.genetic_origin ?? "", effects: s.effects ?? "", aroma: s.aroma ?? "",
          thc_content: s.thc_content?.toString() ?? "", cbd_content: s.cbd_content?.toString() ?? "",
          flowering_weeks: s.flowering_weeks?.toString() ?? "", description: s.description ?? "",
        });
      })
      .catch((e: Error) => setError(e.message));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const url = getStrainImageUrl(id);
    setImageUrl(url);
    setImageError(false);
  }, [id]);

  const handleSave = async () => {
    if (!id || !strain) return;
    setError(""); setSaved(false);
    try {
      const updated = await updateStrain(id, {
        breeder: form.breeder || null, genetics: form.genetics || null,
        genetic_origin: form.genetic_origin || null, effects: form.effects || null, aroma: form.aroma || null,
        thc_content: form.thc_content ? parseFloat(form.thc_content) : null,
        cbd_content: form.cbd_content ? parseFloat(form.cbd_content) : null,
        flowering_weeks: form.flowering_weeks ? parseInt(form.flowering_weeks) : null,
        description: form.description || null,
      });
      setStrain(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Fehler");
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    setUploading(true); setError("");
    try {
      await uploadStrainImage(id, file);
      const url = `${getStrainImageUrl(id)}&t=${Date.now()}`;
      setImageUrl(url);
      setImageError(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload fehlgeschlagen");
    } finally {
      setUploading(false);
    }
  };

  const handleImageError = () => setImageError(true);

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
        <button className="btn btn-primary" onClick={handleSave}>
          {saved ? `\u2713 ${t("common.saved")}` : t("common.save")}
        </button>
      </div>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="detail-layout">
        <div style={{ flex: 1 }}>
          <div className="form-card">
            <h2 style={{ marginBottom: 16 }}>{t("strains.general_info")}</h2>
            <div className="detail-grid">
              <div className="form-row">
                <label className="label">{t("strains.breeder")}</label>
                <input className="input" value={form.breeder} onChange={(e) => setForm({ ...form, breeder: e.target.value })} placeholder="z.B. DJ Short" />
              </div>
              <div className="form-row">
                <label className="label">{t("strains.genetics")}</label>
                <input className="input" value={form.genetics} onChange={(e) => setForm({ ...form, genetics: e.target.value })} placeholder="z.B. Sativa / Indica / Hybrid" />
              </div>
            </div>
          </div>

          <div className="form-card">
            <h2 style={{ marginBottom: 16 }}>{t("strains.strain_details")}</h2>
            <div className="detail-grid">
              <div className="form-row">
                <label className="label">{t("strains.genetic_origin")}</label>
                <textarea className="textarea" value={form.genetic_origin} onChange={(e) => setForm({ ...form, genetic_origin: e.target.value })} placeholder="z.B. Blueberry x Haze" rows={3} />
              </div>
              <div className="form-row">
                <label className="label">{t("strains.aroma")}</label>
                <textarea className="textarea" value={form.aroma} onChange={(e) => setForm({ ...form, aroma: e.target.value })} placeholder="z.B. fruchtig, erdig, kiefern" rows={3} />
              </div>
            </div>
            <div className="form-row">
              <label className="label">{t("strains.effects")}</label>
              <textarea className="textarea" value={form.effects} onChange={(e) => setForm({ ...form, effects: e.target.value })} placeholder="z.B. euphorisch, entspannend, kreativ" rows={3} />
            </div>
          </div>

          <div className="form-card">
            <h2 style={{ marginBottom: 16 }}>{t("strains.thc")} / {t("strains.cbd")} &amp; {t("strains.flowering_weeks")}</h2>
            <div className="detail-grid">
              <div className="form-row">
                <label className="label">{t("strains.thc")}</label>
                <input className="input" type="number" step="0.1" min="0" max="100" value={form.thc_content} onChange={(e) => setForm({ ...form, thc_content: e.target.value })} placeholder="z.B. 21" />
              </div>
              <div className="form-row">
                <label className="label">{t("strains.cbd")}</label>
                <input className="input" type="number" step="0.1" min="0" max="100" value={form.cbd_content} onChange={(e) => setForm({ ...form, cbd_content: e.target.value })} placeholder="z.B. 0.5" />
              </div>
              <div className="form-row">
                <label className="label">{t("strains.flowering_weeks")}</label>
                <input className="input" type="number" min="1" value={form.flowering_weeks} onChange={(e) => setForm({ ...form, flowering_weeks: e.target.value })} placeholder="z.B. 8" />
              </div>
              <div></div>
            </div>
            <div className="form-row">
              <label className="label">{t("strains.description")}</label>
              <textarea className="textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Notizen zum Strain..." rows={3} />
            </div>
          </div>
        </div>

        <div className="form-card" style={{ width: 300, flexShrink: 0 }}>
          <h2 style={{ marginBottom: 16 }}>{t("strains.images_gallery")}</h2>
          {imageUrl && !imageError ? (
            <img
              src={imageUrl}
              alt={strain.name}
              onError={handleImageError}
              style={{ width: "100%", borderRadius: "var(--radius-sm)", marginBottom: 12 }}
            />
          ) : (
            <div
              style={{
                width: "100%", height: 200, borderRadius: "var(--radius-sm)",
                background: "var(--neutral-100)", display: "flex", alignItems: "center",
                justifyContent: "center", color: "var(--neutral-400)", fontSize: "0.9rem",
                marginBottom: 12,
              }}
            >
              {t("common.no_image")}
            </div>
          )}
          <label className="btn btn-secondary" style={{ cursor: "pointer", width: "100%", textAlign: "center" }}>
            {uploading ? t("common.loading") : t("grows.upload_image")}
            <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: "none" }} disabled={uploading} />
          </label>
        </div>
      </div>
    </div>
  );
}
