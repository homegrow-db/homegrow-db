import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { getSeeds, createSeed, updateSeed, deleteSeed } from "../api/seeds";
import { getStrains } from "../api/strains";
import type { Seed, Strain } from "../types";
import ConfirmModal from "../components/ConfirmModal";

function exportPDF(seeds: Seed[], strainMap: Map<string, string>, t: (key: string) => string) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setFontSize(16);
  doc.text(t("seeds.title"), 14, 20);
  doc.setFontSize(10);
  doc.text(new Date().toLocaleDateString(), 14, 28);

  autoTable(doc, {
    startY: 34,
    head: [[t("seeds.strain"), t("seeds.quantity"), t("seeds.source"), t("seeds.purchase_date")]],
    body: seeds.map((s) => [
      strainMap.get(s.strain_id) ?? s.strain_id,
      String(s.quantity),
      s.source ?? "-",
      s.purchase_date ?? "-",
    ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [76, 175, 80] },
    alternateRowStyles: { fillColor: [245, 245, 248] },
  });

  doc.save(`seeds-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export default function Seeds() {
  const { t } = useTranslation();
  const [seeds, setSeeds] = useState<Seed[]>([]);
  const [strains, setStrains] = useState<Strain[]>([]);
  const [total, setTotal] = useState(0);
  const [form, setForm] = useState({ strain_id: "", quantity: 1 });
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editSource, setEditSource] = useState("");
  const [editQuantity, setEditQuantity] = useState(1);
  const [sortBy, setSortBy] = useState("");
  const [sortOrder, setSortOrder] = useState("desc");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const load = useCallback(async (search?: string) => {
    try {
      const [s, st] = await Promise.all([getSeeds({ search, sortBy: sortBy || undefined, sortOrder }), getStrains()]);
      setSeeds(s.items);
      setTotal(s.total);
      setStrains(st.items);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Fehler");
    }
  }, [sortBy, sortOrder]);

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  };

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(searchQuery || undefined), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery, load]);

  const refresh = useCallback(() => load(searchQuery || undefined), [load, searchQuery]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createSeed(form);
      setForm({ strain_id: "", quantity: 1 });
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Fehler");
    }
  };

  const handleEdit = (s: Seed) => {
    setEditId(s.id);
    setEditSource(s.source ?? "");
    setEditQuantity(s.quantity);
  };

  const handleSaveEdit = async () => {
    if (!editId) return;
    try {
      await updateSeed(editId, { source: editSource || null, quantity: editQuantity });
      setEditId(null);
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Fehler");
    }
  };

  const handleDelete = async (id: string) => {
    setDeleteTarget(id);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteSeed(deleteTarget);
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setDeleteTarget(null);
    }
  };

  const strainMap = new Map(strains.map((s) => [s.id, s.name]));

  return (
    <div>
      <div className="page-header">
        <h1>{t("seeds.title")} ({total})</h1>
        <button className="btn btn-secondary" onClick={() => exportPDF(seeds, strainMap, t)}>
          &#128196; {t("seeds.pdf_export")}
        </button>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="search-bar" style={{ marginBottom: 20 }}>
        <span className="search-bar-icon">&#128269;</span>
        <input
          className="input"
          type="text"
          placeholder={t("seeds.search_placeholder")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              if (debounceRef.current) clearTimeout(debounceRef.current);
              refresh();
            }
          }}
          autoComplete="off"
        />
        {searchQuery && (
          <button className="search-bar-clear" onClick={() => setSearchQuery("")}>&times;</button>
        )}
      </div>
      <div className="form-card">
        <form className="inline-form" onSubmit={handleCreate}>
          <select
            className="select"
            value={form.strain_id}
            onChange={(e) => setForm({ ...form, strain_id: e.target.value })}
            required
            style={{ minWidth: 200 }}
          >
            <option value="">{t("seeds.select_strain")}</option>
            {strains.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <input
            className="input"
            type="number"
            value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) || 1 })}
            min={1}
            style={{ width: 80 }}
          />
          <button type="submit" className="btn btn-primary">
            + {t("seeds.create")}
          </button>
        </form>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="sortable" onClick={() => handleSort("strain_name")}>
                {t("seeds.strain")} {sortBy === "strain_name" ? (sortOrder === "asc" ? " \u25B2" : " \u25BC") : ""}
              </th>
              <th className="sortable" onClick={() => handleSort("quantity")}>
                {t("seeds.quantity")} {sortBy === "quantity" ? (sortOrder === "asc" ? " \u25B2" : " \u25BC") : ""}
              </th>
              <th className="sortable" onClick={() => handleSort("source")}>
                {t("seeds.source")} {sortBy === "source" ? (sortOrder === "asc" ? " \u25B2" : " \u25BC") : ""}
              </th>
              <th style={{ width: 100 }}>{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {seeds.length === 0 && (
              <tr>
                <td colSpan={4} style={{ textAlign: "center", color: "var(--neutral-400)", padding: 32 }}>
                  {t("seeds.no_seeds")}
                </td>
              </tr>
            )}
            {seeds.map((s) => (
              <tr key={s.id}>
                <td style={{ fontWeight: 500, cursor: "pointer" }} onClick={() => handleEdit(s)} title={t("common.edit")}>{strainMap.get(s.strain_id) ?? s.strain_id}</td>
                <td>
                  {editId === s.id ? (
                    <input
                      className="input"
                      type="number"
                      value={editQuantity}
                      onChange={(e) => setEditQuantity(parseInt(e.target.value) || 1)}
                      min={1}
                      style={{ padding: "4px 8px", fontSize: "0.85rem", width: 70 }}
                    />
                  ) : (
                    <span style={{ cursor: "pointer" }} onClick={() => handleEdit(s)} title={t("common.edit")}>{s.quantity}</span>
                  )}
                </td>
                <td>
                  {editId === s.id ? (
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <input
                        className="input"
                        value={editSource}
                        onChange={(e) => setEditSource(e.target.value)}
                        style={{ padding: "4px 8px", fontSize: "0.85rem", flex: 1 }}
                        autoFocus
                        onKeyDown={(e) => { if (e.key === "Enter") handleSaveEdit(); if (e.key === "Escape") setEditId(null); }}
                      />
                      <button className="btn btn-primary btn-sm" onClick={handleSaveEdit} style={{ padding: "4px 10px" }}>{t("common.save")}</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => setEditId(null)} style={{ padding: "4px 10px" }}>{t("common.cancel")}</button>
                    </div>
                  ) : (
                    <span style={{ cursor: "pointer" }} onClick={() => handleEdit(s)} title={t("common.edit")}>{s.source || <span style={{ color: "var(--neutral-400)" }}>-</span>}</span>
                  )}
                </td>
                <td style={{ whiteSpace: "nowrap" }}>
                  {editId !== s.id ? (
                    <>
                      <button className="btn-icon" onClick={() => handleEdit(s)} title={t("common.edit")}>&#9998;</button>
                      <button className="btn-icon btn-icon-danger" onClick={() => handleDelete(s.id)} title={t("common.delete")}>&#128465;</button>
                    </>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ConfirmModal
        open={deleteTarget !== null}
        title={t("seeds.delete_confirm_title")}
        message={t("seeds.delete_confirm_msg")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
