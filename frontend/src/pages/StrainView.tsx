import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import jsPDF from "jspdf";
import { getStrain, getStrainImageUrl } from "../api/strains";

const PDF_GREEN: [number, number, number] = [46, 125, 50];
const PDF_DARK: [number, number, number] = [40, 44, 42];
const PDF_GRAY: [number, number, number] = [125, 130, 127];
const PDF_LIGHT: [number, number, number] = [240, 244, 241];

async function loadImageDataUrl(url: string, maxDim = 1200): Promise<string | null> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    const objUrl = URL.createObjectURL(blob);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = reject;
        el.src = objUrl;
      });
      const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", 0.85);
    } finally {
      URL.revokeObjectURL(objUrl);
    }
  } catch {
    return null;
  }
}

async function exportStrainPDF(
  strain: any,
  imageUrl: string | null,
  t: (key: string) => string,
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const H = 297;
  const M = 18;
  let y = 46;

  doc.setFillColor(...PDF_GREEN);
  doc.rect(0, 0, W, 36, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.text(strain.name, M, 17);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const subtitle = [strain.breeder, strain.genetics].filter(Boolean).join("   •   ");
  doc.text(subtitle || "Homegrow DB", M, 26);
  doc.setFontSize(9);
  doc.text(new Date().toLocaleDateString(), W - M, 17, { align: "right" });

  const rightW = 70;
  const leftW = W - M * 2 - rightW - 10;
  let leftY = y;

  const chip = (label: string, value: string, x: number, yy: number, w: number) => {
    doc.setFillColor(...PDF_LIGHT);
    doc.roundedRect(x, yy, w, 12, 2, 2, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...PDF_GRAY);
    doc.text(label, x + 4, yy + 5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...PDF_DARK);
    doc.text(value, x + 4, yy + 10);
  };

  const chipW = (leftW - 6) / 2;
  chip(t("strains.thc"), strain.thc_content != null ? `${strain.thc_content}%` : "–", M, leftY, chipW);
  chip(t("strains.cbd"), strain.cbd_content != null ? `${strain.cbd_content}%` : "–", M + chipW + 6, leftY, chipW);
  leftY += 16;
  chip(t("strains.flowering_weeks"), strain.flowering_weeks != null ? `${strain.flowering_weeks}` : "–", M, leftY, chipW);
  chip(t("strains.seeds"), `${strain.seed_count}`, M + chipW + 6, leftY, chipW);
  leftY += 16;
  chip(t("strains.grows"), `${strain.grow_count}`, M, leftY, chipW);
  leftY += 12;

  let imageBottom = y;
  if (imageUrl) {
    const dataUrl = await loadImageDataUrl(imageUrl);
    if (dataUrl) {
      const dims = new Image();
      dims.src = dataUrl;
      await new Promise((r) => { dims.onload = r; dims.onerror = r; });
      const aspect = dims.naturalHeight > 0 ? dims.naturalHeight / dims.naturalWidth : 1.4;
      const imgH = Math.min(rightW * aspect, 110);
      const imgW = imgH / aspect;
      const ix = W - M - imgW;
      doc.addImage(dataUrl, "JPEG", ix, y, imgW, imgH);
      doc.setDrawColor(220, 224, 221);
      doc.setLineWidth(0.3);
      doc.roundedRect(ix, y, imgW, imgH, 1.5, 1.5, "S");
      imageBottom = y + imgH;
    }
  }

  y = Math.max(leftY, imageBottom) + 4;

  const section = (title: string, text: string | null | undefined) => {
    if (!text) return;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...PDF_GREEN);
    doc.text(title.toUpperCase(), M, y);
    y += 3;
    doc.setDrawColor(...PDF_LIGHT);
    doc.setLineWidth(0.5);
    doc.line(M, y, W - M, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...PDF_DARK);
    const lines = doc.splitTextToSize(text, W - M * 2);
    for (const line of lines as string[]) {
      if (y > H - 22) {
        doc.addPage();
        y = 22;
      }
      doc.text(line, M, y);
      y += 4.8;
    }
    y += 7;
  };

  section(t("strains.genetic_origin"), strain.genetic_origin);
  section(t("strains.aroma"), strain.aroma);
  section(t("strains.effects"), strain.effects);
  section(t("strains.description"), strain.description);

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...PDF_LIGHT);
    doc.setLineWidth(0.4);
    doc.line(M, H - 14, W - M, H - 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...PDF_GRAY);
    doc.text("Homegrow DB", M, H - 9);
    doc.text(`${strain.name}  •  ${new Date().toLocaleDateString()}`, W / 2, H - 9, { align: "center" });
    doc.text(`${p} / ${pages}`, W - M, H - 9, { align: "right" });
  }

  const slug = strain.name.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
  doc.save(`strain-${slug}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export default function StrainView() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [strain, setStrain] = useState<any>(null);
  const [error, setError] = useState("");
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [fullUrl, setFullUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!id) return;
    setThumbUrl(getStrainImageUrl(id, "thumb"));
    setFullUrl(getStrainImageUrl(id));
    setImageError(false);
    getStrain(id)
      .then(setStrain)
      .catch((e: Error) => setError(e.message));
  }, [id]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightboxOpen]);

  const show = (value: string | number | null | undefined) =>
    value != null && value !== "" ? String(value) : "-";

  const handleExportPDF = async () => {
    if (!strain) return;
    setExporting(true);
    try {
      await exportStrainPDF(strain, imageError ? null : fullUrl, t);
    } finally {
      setExporting(false);
    }
  };

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
          <button className="btn btn-secondary" onClick={handleExportPDF} disabled={exporting}>
            {exporting ? t("common.loading") : `\u{1F4C4} ${t("strains.export_pdf")}`}
          </button>
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
          {thumbUrl && !imageError ? (
            <img
              src={thumbUrl}
              alt={strain.name}
              onError={() => setImageError(true)}
              onClick={() => setLightboxOpen(true)}
              title={t("strains.image_zoom")}
              style={{ width: "100%", borderRadius: "var(--radius-sm)", cursor: "zoom-in" }}
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

      {lightboxOpen && (
        <div className="lightbox-overlay" onClick={() => setLightboxOpen(false)}>
          <button className="lightbox-close" onClick={() => setLightboxOpen(false)}>&times;</button>
          <img src={fullUrl ?? undefined} alt={strain.name} onClick={(e) => e.stopPropagation()} className="lightbox-image" />
        </div>
      )}
    </div>
  );
}