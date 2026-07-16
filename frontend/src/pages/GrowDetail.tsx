import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  getGrow,
  updateGrow,
  getGrowWeeks,
  createGrowWeek,
  updateGrowWeek,
  deleteGrowWeek,
  getGrowHarvest,
  createGrowHarvest,
  updateGrowHarvest,
  deleteGrowHarvest,
  uploadGrowWeekImage,
  uploadGrowHarvestImage,
  getGrowImages,
  getGrowImageUrl,
} from "../api/grows";
import { getStrain } from "../api/strains";
import type { Grow, GrowWeek, GrowHarvest, GrowImage, Strain } from "../types";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import ConfirmModal from "../components/ConfirmModal";

type WeekForm = {
  week_number: string;
  notes: string;
  fertilizer: string;
  watering: string;
  light_intensity: string;
  light_cycle: string;
  temperature: string;
};

const emptyWeekForm: WeekForm = {
  week_number: "",
  notes: "",
  fertilizer: "",
  watering: "",
  light_intensity: "",
  light_cycle: "",
  temperature: "",
};

type HarvestForm = {
  harvest_date: string;
  weight: string;
  notes: string;
};

const emptyHarvestForm: HarvestForm = {
  harvest_date: "",
  weight: "",
  notes: "",
};

function Lightbox({
  image,
  images,
  onClose,
  onNavigate,
  getImageUrl,
}: {
  image: GrowImage;
  images: GrowImage[];
  onClose: () => void;
  onNavigate: (img: GrowImage) => void;
  getImageUrl: (id: string) => string;
}) {
  const currentIndex = images.findIndex((img) => img.id === image.id);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        const prev = images[currentIndex - 1];
        if (prev) onNavigate(prev);
      } else if (e.key === "ArrowRight") {
        const next = images[currentIndex + 1];
        if (next) onNavigate(next);
      } else if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [images, currentIndex, onNavigate, onClose]);

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <button className="lightbox-close" onClick={onClose}>&times;</button>
      {currentIndex > 0 && (
        <button className="lightbox-nav lightbox-prev" onClick={(e) => { e.stopPropagation(); onNavigate(images[currentIndex - 1]); }}>&lsaquo;</button>
      )}
      {currentIndex < images.length - 1 && (
        <button className="lightbox-nav lightbox-next" onClick={(e) => { e.stopPropagation(); onNavigate(images[currentIndex + 1]); }}>&rsaquo;</button>
      )}
      <img src={getImageUrl(image.id)} alt={image.file_name}
        className="lightbox-image" onClick={(e) => e.stopPropagation()} />
      <div className="lightbox-counter">{currentIndex + 1} / {images.length}</div>
    </div>
  );
}

function exportGrowPDF(
  grow: Grow,
  strain: Strain | null,
  weeks: GrowWeek[],
  harvest: GrowHarvest | null,
  images: GrowImage[],
  t: (key: string) => string,
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const dateStr = new Date().toLocaleDateString();

  doc.setFontSize(18);
  doc.text(t("grows.title"), 14, 20);
  doc.setFontSize(10);
  doc.text(dateStr, 14, 28);
  doc.setFontSize(14);
  doc.text(grow.name, 14, 38);

  autoTable(doc, {
    startY: 44,
    body: [
      [t("grows.status"), t(`grows.status_${grow.status}`)],
      [t("grows.strain"), strain?.name ?? grow.strain_id],
      [t("grows.start_date"), grow.start_date],
      [t("grows.end_date"), grow.end_date ?? "-"],
      [t("grows.medium"), grow.medium ?? "-"],
      [t("grows.lighting"), grow.lighting ?? "-"],
      [t("grows.nutrients"), grow.nutrients ?? "-"],
      [t("grows.notes"), grow.notes ?? "-"],
    ],
    theme: "plain",
    styles: { fontSize: 9 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 40 } },
  });

  if (weeks.length > 0) {
    doc.setFontSize(14);
    doc.text(t("grows.journal"), 14, (doc as any).lastAutoTable.finalY + 16);

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 22,
      head: [[t("grows.week"), t("grows.week_number").replace("{number}", ""), t("grows.notes"), t("grows.fertilizer"), t("grows.watering"), t("grows.light_intensity"), t("grows.light_cycle"), t("grows.temperature")]],
      body: weeks.map((w) => [
        `${w.week_number}.`,
        w.notes ?? "-",
        w.fertilizer ?? "-",
        w.watering ?? "-",
        w.light_intensity ?? "-",
        w.light_cycle ?? "-",
        w.temperature ?? "-",
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [76, 175, 80] },
      alternateRowStyles: { fillColor: [245, 245, 248] },
    });
  }

  if (harvest) {
    doc.setFontSize(14);
    doc.text(t("grows.harvest"), 14, (doc as any).lastAutoTable.finalY + 16);

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 22,
      body: [
        [t("grows.harvest_date"), harvest.harvest_date],
        [t("grows.weight"), harvest.weight != null ? `${harvest.weight}${t("common.grams")}` : "-"],
        [t("grows.notes"), harvest.notes ?? "-"],
      ],
      theme: "plain",
      styles: { fontSize: 9 },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 40 } },
    });
  }

  const imageCount = images.filter((img) => !img.grow_week_id && !img.grow_harvest_id).length;
  if (imageCount > 0) {
    doc.setFontSize(10);
    doc.text(
      `\u2022 ${images.length} images (${imageCount} without week/harvest)`,
      14,
      ((doc as any).lastAutoTable?.finalY ?? 44) + 12,
    );
  }

  doc.save(`grow-${grow.name.replace(/[^a-zA-Z0-9]/g, "-")}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export default function GrowDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [grow, setGrow] = useState<Grow | null>(null);
  const [strain, setStrain] = useState<Strain | null>(null);
  const [growForm, setGrowForm] = useState({
    name: "", status: "planned", start_date: "", end_date: "",
    medium: "", lighting: "", nutrients: "", notes: "",
  });
  const [weeks, setWeeks] = useState<GrowWeek[]>([]);
  const [harvest, setHarvest] = useState<GrowHarvest | null>(null);
  const [images, setImages] = useState<GrowImage[]>([]);
  const [editingWeekId, setEditingWeekId] = useState<string | null>(null);
  const [weekForm, setWeekForm] = useState<WeekForm>(emptyWeekForm);
  const [showAddWeek, setShowAddWeek] = useState(false);
  const [newWeekForm, setNewWeekForm] = useState<WeekForm>(emptyWeekForm);
  const [harvestForm, setHarvestForm] = useState<HarvestForm>(emptyHarvestForm);
  const [showHarvestForm, setShowHarvestForm] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "week" | "harvest"; id?: string } | null>(null);
  const [uploadingWeekId, setUploadingWeekId] = useState<string | null>(null);
  const [uploadingHarvest, setUploadingHarvest] = useState(false);
  const [newWeekFiles, setNewWeekFiles] = useState<File[]>([]);
  const [newHarvestFiles, setNewHarvestFiles] = useState<File[]>([]);
  const [lightboxImage, setLightboxImage] = useState<GrowImage | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [g, w, imgs] = await Promise.all([
        getGrow(id),
        getGrowWeeks(id),
        getGrowImages(id),
      ]);
      setGrow(g);
      setGrowForm({
        name: g.name, status: g.status, start_date: g.start_date,
        end_date: g.end_date ?? "", medium: g.medium ?? "",
        lighting: g.lighting ?? "", nutrients: g.nutrients ?? "",
        notes: g.notes ?? "",
      });
      setWeeks(w);
      setImages(imgs);

      try {
        const h = await getGrowHarvest(id);
        setHarvest(h);
        setHarvestForm({
          harvest_date: h.harvest_date,
          weight: h.weight?.toString() ?? "",
          notes: h.notes ?? "",
        });
      } catch {
        setHarvest(null);
      }

      try {
        const s = await getStrain(g.strain_id);
        setStrain(s);
      } catch {
        // strain might be deleted
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("common.error"));
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleSaveGrow = async () => {
    if (!id || !grow) return;
    setError(""); setSaved(false);
    try {
      const updated = await updateGrow(id, {
        name: growForm.name,
        status: growForm.status as Grow["status"],
        start_date: growForm.start_date,
        end_date: growForm.end_date || null,
        medium: growForm.medium || null,
        lighting: growForm.lighting || null,
        nutrients: growForm.nutrients || null,
        notes: growForm.notes || null,
      });
      setGrow(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("common.error"));
    }
  };

  const handleAddWeek = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setError("");
    try {
      const week = await createGrowWeek(id, {
        week_number: parseInt(newWeekForm.week_number),
        notes: newWeekForm.notes || null,
        fertilizer: newWeekForm.fertilizer || null,
        watering: newWeekForm.watering || null,
        light_intensity: newWeekForm.light_intensity || null,
        light_cycle: newWeekForm.light_cycle || null,
        temperature: newWeekForm.temperature || null,
      });
      for (const file of newWeekFiles) {
        await uploadGrowWeekImage(id, week.id, file);
      }
      setNewWeekForm(emptyWeekForm);
      setNewWeekFiles([]);
      setShowAddWeek(false);
      const [w, imgs] = await Promise.all([getGrowWeeks(id), getGrowImages(id)]);
      setWeeks(w);
      setImages(imgs);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("common.error"));
    }
  };

  const startEditWeek = (week: GrowWeek) => {
    setEditingWeekId(week.id);
    setWeekForm({
      week_number: week.week_number.toString(),
      notes: week.notes ?? "",
      fertilizer: week.fertilizer ?? "",
      watering: week.watering ?? "",
      light_intensity: week.light_intensity ?? "",
      light_cycle: week.light_cycle ?? "",
      temperature: week.temperature ?? "",
    });
  };

  const cancelEditWeek = () => {
    setEditingWeekId(null);
    setWeekForm(emptyWeekForm);
  };

  const saveEditWeek = async () => {
    if (!id || !editingWeekId) return;
    setError("");
    try {
      await updateGrowWeek(id, editingWeekId, {
        week_number: parseInt(weekForm.week_number),
        notes: weekForm.notes || null,
        fertilizer: weekForm.fertilizer || null,
        watering: weekForm.watering || null,
        light_intensity: weekForm.light_intensity || null,
        light_cycle: weekForm.light_cycle || null,
        temperature: weekForm.temperature || null,
      });
      setEditingWeekId(null);
      setWeekForm(emptyWeekForm);
      const w = await getGrowWeeks(id);
      setWeeks(w);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("common.error"));
    }
  };

  const handleDeleteWeek = async () => {
    if (!deleteTarget || deleteTarget.type !== "week" || !deleteTarget.id || !id) return;
    try {
      await deleteGrowWeek(id, deleteTarget.id);
      const w = await getGrowWeeks(id);
      setWeeks(w);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("common.error"));
    }
  };

  const handleCreateHarvest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setError("");
    try {
      const h = await createGrowHarvest(id, {
        harvest_date: harvestForm.harvest_date || undefined,
        weight: harvestForm.weight ? parseFloat(harvestForm.weight) : null,
        notes: harvestForm.notes || undefined,
      });
      for (const file of newHarvestFiles) {
        await uploadGrowHarvestImage(id, file);
      }
      setHarvest(h);
      setHarvestForm({
        harvest_date: h.harvest_date,
        weight: h.weight?.toString() ?? "",
        notes: h.notes ?? "",
      });
      setNewHarvestFiles([]);
      setShowHarvestForm(false);
      const imgs = await getGrowImages(id);
      setImages(imgs);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("common.error"));
    }
  };

  const handleUpdateHarvest = async () => {
    if (!id || !harvest) return;
    setError("");
    try {
      const h = await updateGrowHarvest(id, {
        harvest_date: harvestForm.harvest_date || undefined,
        weight: harvestForm.weight ? parseFloat(harvestForm.weight) : null,
        notes: harvestForm.notes || undefined,
      });
      setHarvest(h);
      setShowHarvestForm(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("common.error"));
    }
  };

  const handleDeleteHarvest = async () => {
    if (!id) return;
    try {
      await deleteGrowHarvest(id);
      setHarvest(null);
      setHarvestForm(emptyHarvestForm);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("common.error"));
    }
  };

  const handleWeekImageUpload = async (weekId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    setUploadingWeekId(weekId);
    setError("");
    try {
      await uploadGrowWeekImage(id, weekId, file);
      const imgs = await getGrowImages(id);
      setImages(imgs);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("common.upload_failed"));
    } finally {
      setUploadingWeekId(null);
    }
  };

  const handleHarvestImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    setUploadingHarvest(true);
    setError("");
    try {
      await uploadGrowHarvestImage(id, file);
      const imgs = await getGrowImages(id);
      setImages(imgs);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("common.upload_failed"));
    } finally {
      setUploadingHarvest(false);
    }
  };

  const weekImages = (weekId: string) =>
    images.filter((img) => img.grow_week_id === weekId);

  const harvestImages = () =>
    images.filter((img) => img.grow_harvest_id !== null);

  if (!grow && !error) return <p style={{ padding: 32, color: "var(--neutral-400)" }}>{t("common.loading")}</p>;
  if (!grow) return <div className="alert alert-error">{error}</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate("/grows")} style={{ marginBottom: 8 }}>
            &larr; {t("common.back")}
          </button>
          <h1>{grow.name}</h1>
          <span className={`badge badge-${grow.status}`} style={{ marginLeft: 8, verticalAlign: "middle" }}>
            {t(`grows.status_${grow.status}`)}
          </span>
          {strain && (
            <span style={{ marginLeft: 12, color: "var(--neutral-500)", fontSize: "0.9rem" }}>
              {strain.name}
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="btn btn-secondary" onClick={() => exportGrowPDF(grow, strain, weeks, harvest, images, t)}>
            &#128196; {t("grows.pdf_export")}
          </button>
          <button className="btn btn-primary" onClick={handleSaveGrow}>
            {saved ? `\u2713 ${t("common.saved")}` : t("common.save")}
          </button>
        </div>
      </div>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="form-card">
        <h2 style={{ marginBottom: 16 }}>{t("grows.overview")}</h2>
        <div className="detail-grid">
          <div className="form-row">
            <label className="label">{t("grows.name")}</label>
            <input className="input" value={growForm.name} onChange={(e) => setGrowForm({ ...growForm, name: e.target.value })} />
          </div>
          <div className="form-row">
            <label className="label">{t("grows.status")}</label>
            <select className="select" value={growForm.status} onChange={(e) => setGrowForm({ ...growForm, status: e.target.value })}>
              <option value="planned">{t("grows.status_planned")}</option>
              <option value="ongoing">{t("grows.status_ongoing")}</option>
              <option value="completed">{t("grows.status_completed")}</option>
              <option value="failed">{t("grows.status_failed")}</option>
            </select>
          </div>
          <div className="form-row">
            <label className="label">{t("grows.start_date")}</label>
            <input className="input" type="date" value={growForm.start_date} onChange={(e) => setGrowForm({ ...growForm, start_date: e.target.value })} />
          </div>
          <div className="form-row">
            <label className="label">{t("grows.end_date")}</label>
            <input className="input" type="date" value={growForm.end_date} onChange={(e) => setGrowForm({ ...growForm, end_date: e.target.value })} />
          </div>
          <div className="form-row">
            <label className="label">{t("grows.medium")}</label>
            <input className="input" value={growForm.medium} onChange={(e) => setGrowForm({ ...growForm, medium: e.target.value })} placeholder={t("grows.medium_placeholder")} />
          </div>
          <div className="form-row">
            <label className="label">{t("grows.lighting")}</label>
            <input className="input" value={growForm.lighting} onChange={(e) => setGrowForm({ ...growForm, lighting: e.target.value })} placeholder={t("grows.lighting_placeholder")} />
          </div>
          <div className="form-row">
            <label className="label">{t("grows.nutrients")}</label>
            <input className="input" value={growForm.nutrients} onChange={(e) => setGrowForm({ ...growForm, nutrients: e.target.value })} placeholder={t("grows.nutrients_placeholder")} />
          </div>
        </div>
        <div className="form-row">
          <label className="label">{t("grows.notes")}</label>
          <textarea className="textarea" value={growForm.notes} onChange={(e) => setGrowForm({ ...growForm, notes: e.target.value })} rows={3} />
        </div>
      </div>

      {images.length > 0 && (
        <div className="form-card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="cover-image">
            <img src={getGrowImageUrl(images[0].id)} alt=""
              onClick={() => setLightboxImage(images[0])}
              style={{ width: "100%", display: "block", cursor: "pointer" }} />
          </div>
          {images.length > 1 && (
            <div style={{ padding: 12 }}>
              <div className="image-grid">
                {images.slice(1).map((img) => (
                  <img key={img.id} src={getGrowImageUrl(img.id)} alt=""
                    onClick={() => setLightboxImage(img)}
                    className="image-grid-thumb" />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="form-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>{t("grows.journal")}</h2>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowAddWeek(!showAddWeek)}>
            {showAddWeek ? t("common.cancel") : `+ ${t("grows.add_week")}`}
          </button>
        </div>

        {showAddWeek && (
          <form onSubmit={handleAddWeek} style={{ marginBottom: 20, padding: 16, background: "var(--neutral-50)", borderRadius: "var(--radius-sm)" }}>
            <div className="detail-grid">
              <div className="form-row">
                <label className="label">{t("grows.week")} #</label>
                <input className="input" type="number" min="1" required value={newWeekForm.week_number}
                  onChange={(e) => setNewWeekForm({ ...newWeekForm, week_number: e.target.value })} />
              </div>
              <div className="form-row">
                <label className="label">{t("grows.fertilizer")}</label>
                  <input className="input" value={newWeekForm.fertilizer}
                  onChange={(e) => setNewWeekForm({ ...newWeekForm, fertilizer: e.target.value })} placeholder={t("grows.fertilizer_placeholder")} />
              </div>
              <div className="form-row">
                <label className="label">{t("grows.watering")}</label>
                <input className="input" value={newWeekForm.watering}
                  onChange={(e) => setNewWeekForm({ ...newWeekForm, watering: e.target.value })} placeholder={t("grows.watering_placeholder")} />
              </div>
              <div className="form-row">
                <label className="label">{t("grows.light_intensity")}</label>
                <input className="input" value={newWeekForm.light_intensity}
                  onChange={(e) => setNewWeekForm({ ...newWeekForm, light_intensity: e.target.value })} placeholder={t("grows.light_intensity_placeholder")} />
              </div>
              <div className="form-row">
                <label className="label">{t("grows.light_cycle")}</label>
                <input className="input" value={newWeekForm.light_cycle}
                  onChange={(e) => setNewWeekForm({ ...newWeekForm, light_cycle: e.target.value })} placeholder={t("grows.light_cycle_placeholder")} />
              </div>
              <div className="form-row">
                <label className="label">{t("grows.temperature")}</label>
                <input className="input" value={newWeekForm.temperature}
                  onChange={(e) => setNewWeekForm({ ...newWeekForm, temperature: e.target.value })} placeholder={t("grows.temperature_placeholder")} />
              </div>
            </div>
            <div className="form-row">
              <label className="label">{t("grows.notes")}</label>
              <textarea className="textarea" value={newWeekForm.notes}
                onChange={(e) => setNewWeekForm({ ...newWeekForm, notes: e.target.value })} rows={2} />
            </div>
            <div className="form-row">
              <label className="label">{t("grows.images")}</label>
              <input className="input" type="file" accept="image/*" multiple
                onChange={(e) => setNewWeekFiles(Array.from(e.target.files || []))} />
            </div>
            <button type="submit" className="btn btn-primary" style={{ marginTop: 8 }}>{t("grows.add_week")}</button>
          </form>
        )}

        {weeks.length === 0 && !showAddWeek && (
          <p style={{ color: "var(--neutral-400)", textAlign: "center", padding: 24 }}>
            {t("grows.no_weeks")}
          </p>
        )}

        {weeks.map((week) => (
          <div key={week.id} style={{
            border: "1px solid var(--neutral-200)",
            borderRadius: "var(--radius-sm)",
            padding: 16, marginBottom: 12,
          }}>
            {editingWeekId === week.id ? (
              <div>
                <div className="detail-grid">
                  <div className="form-row">
                    <label className="label">{t("grows.week")} #</label>
                    <input className="input" type="number" min="1" value={weekForm.week_number}
                      onChange={(e) => setWeekForm({ ...weekForm, week_number: e.target.value })} />
                  </div>
                  <div className="form-row">
                    <label className="label">{t("grows.fertilizer")}</label>
                    <input className="input" value={weekForm.fertilizer}
                      onChange={(e) => setWeekForm({ ...weekForm, fertilizer: e.target.value })} />
                  </div>
                  <div className="form-row">
                    <label className="label">{t("grows.watering")}</label>
                    <input className="input" value={weekForm.watering}
                      onChange={(e) => setWeekForm({ ...weekForm, watering: e.target.value })} />
                  </div>
                  <div className="form-row">
                    <label className="label">{t("grows.light_intensity")}</label>
                    <input className="input" value={weekForm.light_intensity}
                      onChange={(e) => setWeekForm({ ...weekForm, light_intensity: e.target.value })} />
                  </div>
                  <div className="form-row">
                    <label className="label">{t("grows.light_cycle")}</label>
                    <input className="input" value={weekForm.light_cycle}
                      onChange={(e) => setWeekForm({ ...weekForm, light_cycle: e.target.value })} />
                  </div>
                  <div className="form-row">
                    <label className="label">{t("grows.temperature")}</label>
                    <input className="input" value={weekForm.temperature}
                      onChange={(e) => setWeekForm({ ...weekForm, temperature: e.target.value })} />
                  </div>
                </div>
                <div className="form-row">
                  <label className="label">{t("grows.notes")}</label>
                  <textarea className="textarea" value={weekForm.notes}
                    onChange={(e) => setWeekForm({ ...weekForm, notes: e.target.value })} rows={2} />
                </div>
                <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                  <button className="btn btn-primary btn-sm" onClick={saveEditWeek}>{t("common.save")}</button>
                  <button className="btn btn-secondary btn-sm" onClick={cancelEditWeek}>{t("common.cancel")}</button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <h3 style={{ margin: 0, fontSize: "1rem" }}>{t("grows.week")} {week.week_number}</h3>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button className="btn-icon" onClick={() => startEditWeek(week)} title={t("common.edit")}>&#9998;</button>
                    <button className="btn-icon btn-icon-danger" onClick={() => setDeleteTarget({ type: "week", id: week.id })} title={t("common.delete")}>&#128465;</button>
                  </div>
                </div>
                <div className="detail-grid" style={{ fontSize: "0.9rem" }}>
                  {week.fertilizer && <div><strong>{t("grows.fertilizer")}:</strong> {week.fertilizer}</div>}
                  {week.watering && <div><strong>{t("grows.watering")}:</strong> {week.watering}</div>}
                  {week.light_intensity && <div><strong>{t("grows.light_intensity")}:</strong> {week.light_intensity}</div>}
                  {week.light_cycle && <div><strong>{t("grows.light_cycle")}:</strong> {week.light_cycle}</div>}
                  {week.temperature && <div><strong>{t("grows.temperature")}:</strong> {week.temperature}</div>}
                </div>
                {week.notes && <p style={{ margin: "8px 0 0", color: "var(--neutral-600)" }}>{week.notes}</p>}

                {weekImages(week.id).length > 0 && (
                  <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                    {weekImages(week.id).map((img) => (
                      <img key={img.id} src={getGrowImageUrl(img.id)}
                        alt={img.file_name} style={{ width: 80, height: 80, objectFit: "cover", borderRadius: "var(--radius-sm)" }} />
                    ))}
                  </div>
                )}
                <label className="btn btn-secondary btn-sm" style={{ cursor: "pointer", marginTop: 8, display: "inline-block" }}>
                  {uploadingWeekId === week.id ? "..." : t("grows.upload_image")}
                  <input type="file" accept="image/*" onChange={(e) => handleWeekImageUpload(week.id, e)} style={{ display: "none" }} disabled={uploadingWeekId === week.id} />
                </label>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="form-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>{t("grows.harvest")}</h2>
          {harvest ? (
            <div style={{ display: "flex", gap: 4 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowHarvestForm(!showHarvestForm)}>
                {showHarvestForm ? t("common.cancel") : t("common.edit")}
              </button>
              <button className="btn btn-secondary btn-sm btn-icon-danger" style={{ border: "1px solid var(--danger)" }} onClick={() => setDeleteTarget({ type: "harvest" })}>
                &#128465; {t("common.delete")}
              </button>
            </div>
          ) : (
            <button className="btn btn-secondary btn-sm" onClick={() => setShowHarvestForm(!showHarvestForm)}>
              {showHarvestForm ? t("common.cancel") : `+ ${t("grows.add_harvest")}`}
            </button>
          )}
        </div>

        {showHarvestForm && (
          <form onSubmit={harvest ? handleUpdateHarvest : handleCreateHarvest} style={{ marginBottom: 20, padding: 16, background: "var(--neutral-50)", borderRadius: "var(--radius-sm)" }}>
            <div className="detail-grid">
              <div className="form-row">
                <label className="label">{t("grows.harvest_date")}</label>
                <input className="input" type="date" value={harvestForm.harvest_date}
                  onChange={(e) => setHarvestForm({ ...harvestForm, harvest_date: e.target.value })} required />
              </div>
              <div className="form-row">
                <label className="label">{t("grows.weight")} ({t("common.grams")})</label>
                <input className="input" type="number" step="0.1" min="0" value={harvestForm.weight}
                  onChange={(e) => setHarvestForm({ ...harvestForm, weight: e.target.value })} />
              </div>
            </div>
            <div className="form-row">
              <label className="label">{t("grows.notes")}</label>
              <textarea className="textarea" value={harvestForm.notes}
                onChange={(e) => setHarvestForm({ ...harvestForm, notes: e.target.value })} rows={2} />
            </div>
            {!harvest && (
              <div className="form-row">
                <label className="label">{t("grows.images")}</label>
                <input className="input" type="file" accept="image/*" multiple
                  onChange={(e) => setNewHarvestFiles(Array.from(e.target.files || []))} />
              </div>
            )}
            <button type="submit" className="btn btn-primary" style={{ marginTop: 8 }}>
              {harvest ? t("common.save") : t("grows.add_harvest")}
            </button>
          </form>
        )}

        {harvest && !showHarvestForm && (
          <div>
            <div className="detail-grid" style={{ fontSize: "0.9rem" }}>
              <div><strong>{t("grows.harvest_date")}:</strong> {harvest.harvest_date}</div>
              {harvest.weight != null && <div><strong>{t("grows.weight")}:</strong> {harvest.weight}{t("common.grams")}</div>}
            </div>
            {harvest.notes && <p style={{ margin: "8px 0 0", color: "var(--neutral-600)" }}>{harvest.notes}</p>}

            {harvestImages().length > 0 && (
              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                {harvestImages().map((img) => (
                  <img key={img.id} src={getGrowImageUrl(img.id)}
                    alt={img.file_name} style={{ width: 80, height: 80, objectFit: "cover", borderRadius: "var(--radius-sm)" }} />
                ))}
              </div>
            )}
            <label className="btn btn-secondary btn-sm" style={{ cursor: "pointer", marginTop: 8, display: "inline-block" }}>
              {uploadingHarvest ? "..." : t("grows.upload_image")}
              <input type="file" accept="image/*" onChange={handleHarvestImageUpload} style={{ display: "none" }} disabled={uploadingHarvest} />
            </label>
          </div>
        )}

        {!harvest && !showHarvestForm && (
          <p style={{ color: "var(--neutral-400)", textAlign: "center", padding: 24 }}>
            {t("grows.no_harvest")}
          </p>
        )}
      </div>

      {images.length > 0 && (
        <div className="form-card">
          <h2 style={{ marginBottom: 16 }}>{t("grows.gallery")}</h2>
          <div className="image-grid">
            {images.map((img) => (
              <img key={img.id} src={getGrowImageUrl(img.id)} alt={img.file_name}
                onClick={() => setLightboxImage(img)}
                className="image-grid-thumb" />
            ))}
          </div>
        </div>
      )}

      {lightboxImage && <Lightbox
        image={lightboxImage}
        images={images}
        onClose={() => setLightboxImage(null)}
        onNavigate={setLightboxImage}
        getImageUrl={getGrowImageUrl}
      />}

      <ConfirmModal
        open={deleteTarget !== null}
        title={deleteTarget?.type === "week" ? t("grows.edit_week") : t("grows.edit_harvest")}
        message={deleteTarget?.type === "week" ? t("grows.delete_confirm_msg") : t("grows.delete_confirm_msg")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onConfirm={deleteTarget?.type === "week" ? handleDeleteWeek : handleDeleteHarvest}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
