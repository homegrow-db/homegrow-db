import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getStrains, createStrain, deleteStrain, getStrainImageUrl } from "../api/strains";
import type { Strain } from "../types";
import ConfirmModal from "../components/ConfirmModal";

function StrainTile({ strain }: { strain: Strain }) {
  const [imgError, setImgError] = useState(false);
  const imgUrl = getStrainImageUrl(strain.id);

  return (
    <div className="strain-tile">
      <Link to={`/strains/${strain.id}`} style={{ textDecoration: "none", color: "inherit" }}>
        <div className="strain-tile-img">
          {!imgError ? (
            <img
              src={imgUrl}
              alt={strain.name}
              onError={() => setImgError(true)}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <span>&#127807; {strain.name.charAt(0)}</span>
          )}
        </div>
        <div className="strain-tile-body">
          <h3>{strain.name}</h3>
          {strain.breeder && <div className="meta">{strain.breeder}</div>}
          {strain.genetics && <div className="meta">{strain.genetics}</div>}
          {strain.thc_content != null && (
            <div className="thc" style={{ marginTop: 6 }}>{strain.thc_content}% THC</div>
          )}
        </div>
      </Link>
      <div className="strain-tile-footer">
        <span className="seed-badge">{strain.seed_count} {strain.seed_count === 1 ? "Seed" : "Seeds"}</span>
        <span className="seed-badge">{strain.grow_count} {strain.grow_count === 1 ? "Grow" : "Grows"}</span>
      </div>
    </div>
  );
}

export default function Strains() {
  const { t } = useTranslation();
  const [strains, setStrains] = useState<Strain[]>([]);
  const [total, setTotal] = useState(0);
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"list" | "grid">("grid");
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const load = useCallback(async (q: string, sb: string, so: "asc" | "desc") => {
    try {
      const data = await getStrains(0, 100, q || undefined, sb, so);
      setStrains(data.items);
      setTotal(data.total);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Fehler");
    }
  }, []);

  useEffect(() => {
    load(search, sortBy, sortOrder);
  }, [search, sortBy, sortOrder, load]);

  const toggleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setSearch(value), 250);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createStrain({ name });
      setName("");
      await load(search, sortBy, sortOrder);
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
      await deleteStrain(deleteTarget);
      await load(search, sortBy, sortOrder);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setDeleteTarget(null);
    }
  };

  const sortArrow = (field: string) => {
    if (sortBy !== field) return " \u2195";
    return sortOrder === "asc" ? " \u2191" : " \u2193";
  };

  return (
    <div>
      <div className="page-header">
        <h1>{t("strains.title")}{search ? ` (${total} ${t("common.search")})` : ` (${total})`}</h1>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            className="input"
            placeholder={t("strains.search_placeholder")}
            defaultValue={search}
            onChange={handleSearchChange}
            style={{ width: 220 }}
          />
          <div className="view-toggle">
            <button
              className={view === "list" ? "active" : ""}
              onClick={() => setView("list")}
              title={t("grows.list_view")}
            >
              &#9776;
            </button>
            <button
              className={view === "grid" ? "active" : ""}
              onClick={() => setView("grid")}
              title={t("grows.grid_view")}
            >
              &#9638;
            </button>
          </div>
        </div>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="form-card">
        <form className="inline-form" onSubmit={handleCreate}>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("strains.create_title")}
            required
            style={{ minWidth: 260 }}
          />
          <button type="submit" className="btn btn-primary">+ {t("strains.create")}</button>
        </form>
      </div>

      {view === "list" ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => toggleSort("name")}>{t("strains.name")}{sortArrow("name")}</th>
                <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => toggleSort("breeder")}>{t("strains.breeder")}{sortArrow("breeder")}</th>
                <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => toggleSort("genetics")}>{t("strains.genetics")}{sortArrow("genetics")}</th>
                <th style={{ textAlign: "center" }}>{t("strains.seeds")}</th>
                <th style={{ textAlign: "center" }}>{t("strains.grows")}</th>
                <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => toggleSort("thc_content")}>THC{sortArrow("thc_content")}</th>
                <th style={{ width: 100 }}>{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {strains.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", color: "var(--neutral-400)", padding: 32 }}>
                    {search ? t("dashboard.no_results") : t("strains.no_strains")}
                  </td>
                </tr>
              )}
              {strains.map((s) => (
                <tr key={s.id}>
                  <td>
                    <Link to={`/strains/${s.id}`} style={{ fontWeight: 500 }}>{s.name}</Link>
                  </td>
                  <td>{s.breeder ?? "-"}</td>
                  <td>{s.genetics ?? "-"}</td>
                  <td style={{ textAlign: "center" }}>
                    {s.seed_count > 0 ? (
                      <span style={{ background: "var(--green-50)", color: "var(--green-700)", fontWeight: 600, padding: "2px 10px", borderRadius: 12 }}>
                        {s.seed_count}
                      </span>
                    ) : (
                      <span style={{ color: "var(--neutral-300)" }}>0</span>
                    )}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    {s.grow_count > 0 ? (
                      <span style={{ background: "var(--green-50)", color: "var(--green-700)", fontWeight: 600, padding: "2px 10px", borderRadius: 12 }}>
                        {s.grow_count}
                      </span>
                    ) : (
                      <span style={{ color: "var(--neutral-300)" }}>0</span>
                    )}
                  </td>
                  <td>
                    {s.thc_content != null ? (
                      <span style={{ color: "var(--green-600)", fontWeight: 600 }}>{s.thc_content}%</span>
                    ) : "-"}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <Link to={`/strains/${s.id}`} className="btn-icon" title={t("common.edit")}>&#9998;</Link>
                    <button className="btn-icon btn-icon-danger" onClick={() => handleDelete(s.id)} title={t("common.delete")}>&#128465;</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="strain-grid">
          {strains.length === 0 ? (
            <p style={{ color: "var(--neutral-400)", gridColumn: "1 / -1", textAlign: "center", padding: 32 }}>
              {search ? t("dashboard.no_results") : t("strains.no_strains")}
            </p>
          ) : (
            strains.map((s) => (
              <StrainTile key={s.id} strain={s} />
            ))
          )}
        </div>
      )}
      <ConfirmModal
        open={deleteTarget !== null}
        title={t("strains.delete_confirm_title")}
        message={t("strains.delete_confirm_msg")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
