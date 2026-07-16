import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getGrows, createGrow, deleteGrow, getGrowCoverUrl, getGrowImages, getGrowImageUrl } from "../api/grows";
import { getStrains } from "../api/strains";
import type { Grow, GrowImage, Strain } from "../types";
import ConfirmModal from "../components/ConfirmModal";

export default function Grows() {
  const { t } = useTranslation();
  const [grows, setGrows] = useState<Grow[]>([]);
  const [strains, setStrains] = useState<Strain[]>([]);
  const [total, setTotal] = useState(0);
  const [form, setForm] = useState({ strain_id: "", name: "", start_date: "" });
  const [statusFilter, setStatusFilter] = useState("");
  const [view, setView] = useState<"list" | "grid">("grid");
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});
  const [galleryGrowId, setGalleryGrowId] = useState<string | null>(null);
  const [galleryImages, setGalleryImages] = useState<GrowImage[]>([]);
  const [galleryLightbox, setGalleryLightbox] = useState<GrowImage | null>(null);
  const [galleryLoading, setGalleryLoading] = useState(false);

  const load = useCallback(
    async (status?: string) => {
      try {
        const [g, st] = await Promise.all([getGrows(status || undefined), getStrains()]);
        setGrows(g.items);
        setTotal(g.total);
        setStrains(st.items);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : t("common.error"));
      }
    },
    []
  );

  useEffect(() => { load(statusFilter); }, [load, statusFilter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createGrow(form);
      setForm({ strain_id: "", name: "", start_date: "" });
      await load(statusFilter);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("common.error"));
    }
  };

  const handleDelete = async (id: string) => {
    setDeleteTarget(id);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteGrow(deleteTarget);
      await load(statusFilter);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setDeleteTarget(null);
    }
  };

  useEffect(() => {
    if (!galleryLightbox || !galleryGrowId) return;
    const handler = (e: KeyboardEvent) => {
      const idx = galleryImages.findIndex((img) => img.id === galleryLightbox.id);
      if (e.key === "ArrowLeft" && idx > 0) setGalleryLightbox(galleryImages[idx - 1]);
      else if (e.key === "ArrowRight" && idx < galleryImages.length - 1) setGalleryLightbox(galleryImages[idx + 1]);
      else if (e.key === "Escape") setGalleryLightbox(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [galleryLightbox, galleryImages, galleryGrowId]);

  const handleOpenGallery = async (growId: string) => {
    setGalleryLoading(true);
    try {
      const imgs = await getGrowImages(growId);
      setGalleryImages(imgs);
      setGalleryGrowId(growId);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setGalleryLoading(false);
    }
  };

  const handleCloseGallery = () => {
    setGalleryGrowId(null);
    setGalleryImages([]);
    setGalleryLightbox(null);
  };

  const strainMap = new Map(strains.map((s) => [s.id, s.name]));

  return (
    <div>
      <div className="page-header">
        <h1>{t("grows.title")} ({total})</h1>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <select
            className="select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: "auto", minWidth: 160 }}
          >
            <option value="">{t("grows.all")}</option>
            <option value="planned">{t("grows.status_planned")}</option>
            <option value="ongoing">{t("grows.status_ongoing")}</option>
            <option value="completed">{t("grows.status_completed")}</option>
            <option value="failed">{t("grows.status_failed")}</option>
          </select>
          <div className="view-toggle">
            <button className={view === "list" ? "active" : ""} onClick={() => setView("list")} title={t("grows.list_view")}>&#9776;</button>
            <button className={view === "grid" ? "active" : ""} onClick={() => setView("grid")} title={t("grows.grid_view")}>&#9638;</button>
          </div>
        </div>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="form-card">
        <form className="inline-form" onSubmit={handleCreate}>
          <select
            className="select"
            value={form.strain_id}
            onChange={(e) => setForm({ ...form, strain_id: e.target.value })}
            required
            style={{ minWidth: 200 }}
          >
            <option value="">{t("grows.select_strain")}</option>
            {strains.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <input
            className="input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder={t("grows.name")}
            required
            style={{ minWidth: 180 }}
          />
          <input
            className="input"
            type="date"
            value={form.start_date}
            onChange={(e) => setForm({ ...form, start_date: e.target.value })}
            required
            style={{ width: 160 }}
          />
          <button type="submit" className="btn btn-primary">
            + {t("grows.create")}
          </button>
        </form>
      </div>
      {view === "list" ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t("grows.name")}</th>
                <th>{t("grows.strain")}</th>
                <th>{t("grows.start_date")}</th>
                <th>{t("grows.end_date")}</th>
                <th>{t("grows.status")}</th>
                <th style={{ width: 100 }}>{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {grows.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", color: "var(--neutral-400)", padding: 32 }}>
                    {t("grows.no_grows")}
                  </td>
                </tr>
              )}
              {grows.map((g) => (
                <tr key={g.id}>
                  <td style={{ fontWeight: 500 }}>
                    <Link to={`/grows/${g.id}`} style={{ textDecoration: "none", color: "var(--primary-600)" }}>
                      {g.name}
                    </Link>
                  </td>
                  <td>{strainMap.get(g.strain_id) ?? g.strain_id}</td>
                  <td>{g.start_date}</td>
                  <td>{g.end_date ?? "-"}</td>
                  <td>
                    <span className={`badge badge-${g.status}`}>
                      {t(`grows.status_${g.status}`)}
                    </span>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button className="btn-icon btn-icon-danger" onClick={() => handleDelete(g.id)} title={t("common.delete")}>&#128465;</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grow-grid">
          {grows.length === 0 ? (
            <p style={{ color: "var(--neutral-400)", gridColumn: "1 / -1", textAlign: "center", padding: 32 }}>
              {t("grows.no_grows")}
            </p>
          ) : (
            grows.map((g) => (
              <div key={g.id} className="grow-tile">
                <Link to={`/grows/${g.id}`} style={{ textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column", height: "100%" }}>
                  {!imgErrors[g.id] && (
                    <div className="grow-tile-img">
                      <img
                        src={getGrowCoverUrl(g.id)}
                        alt=""
                        onError={() => setImgErrors((prev) => ({ ...prev, [g.id]: true }))}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    </div>
                  )}
                  <div className="grow-tile-header">
                    <h3>{g.name}</h3>
                    <span className={`badge badge-${g.status}`}>{t(`grows.status_${g.status}`)}</span>
                  </div>
                  <div className="grow-tile-body">
                    <div className="meta">{strainMap.get(g.strain_id) ?? g.strain_id}</div>
                    <div className="meta">
                      {g.start_date}{g.end_date ? ` - ${g.end_date}` : ""}
                    </div>
                    {(g.medium || g.lighting) && (
                      <div className="meta" style={{ color: "var(--neutral-500)" }}>
                        {[g.medium, g.lighting].filter(Boolean).join(" \u00B7 ")}
                      </div>
                    )}
                  </div>
                </Link>
                <div className="grow-tile-footer">
                  <button className="btn btn-secondary btn-sm" onClick={() => handleOpenGallery(g.id)} title={t("grows.gallery")}>&#128247; {t("grows.gallery")}</button>
                  <button className="btn-icon btn-icon-danger" onClick={() => handleDelete(g.id)} title={t("common.delete")}>&#128465;</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
      <ConfirmModal
        open={deleteTarget !== null}
        title={t("grows.delete_confirm_title")}
        message={t("grows.delete_confirm_msg")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {galleryGrowId && (
        <div className="lightbox-overlay" onClick={handleCloseGallery}>
          <button className="lightbox-close" onClick={handleCloseGallery}>&times;</button>
          <div className="gallery-modal" onClick={(e) => e.stopPropagation()}>
            {galleryLoading ? (
              <p style={{ textAlign: "center", padding: 40, color: "var(--neutral-400)" }}>{t("common.loading")}</p>
            ) : galleryImages.length === 0 ? (
              <p style={{ textAlign: "center", padding: 40, color: "var(--neutral-400)" }}>{t("common.no_data")}</p>
            ) : (
              <div className="image-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
                {galleryImages.map((img) => (
                  <img key={img.id} src={getGrowImageUrl(img.id)} alt={img.file_name}
                    className="image-grid-thumb"
                    onClick={() => setGalleryLightbox(img)}
                    style={{ aspectRatio: "auto", height: 160 }} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {galleryLightbox && (() => {
        const idx = galleryImages.findIndex((img) => img.id === galleryLightbox.id);
        const prev = idx > 0 ? galleryImages[idx - 1] : null;
        const next = idx < galleryImages.length - 1 ? galleryImages[idx + 1] : null;
        return (
          <div className="lightbox-overlay" onClick={() => setGalleryLightbox(null)} style={{ zIndex: 1100 }}>
            <button className="lightbox-close" onClick={() => setGalleryLightbox(null)}>&times;</button>
            {prev && (
              <button className="lightbox-nav lightbox-prev" onClick={(e) => { e.stopPropagation(); setGalleryLightbox(prev); }}>&lsaquo;</button>
            )}
            {next && (
              <button className="lightbox-nav lightbox-next" onClick={(e) => { e.stopPropagation(); setGalleryLightbox(next); }}>&rsaquo;</button>
            )}
            <img src={getGrowImageUrl(galleryLightbox.id)} alt={galleryLightbox.file_name}
              className="lightbox-image" onClick={(e) => e.stopPropagation()} />
            <div className="lightbox-counter">{idx + 1} / {galleryImages.length}</div>
          </div>
        );
      })()}
    </div>
  );
}
