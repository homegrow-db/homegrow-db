import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getStrains } from "../api/strains";
import { getSeeds } from "../api/seeds";
import { getGrows, getGrowCoverUrl } from "../api/grows";
import { globalSearch } from "../api/search";
import type { SearchResults } from "../api/search";
import type { Grow, Strain } from "../types";

export default function Dashboard() {
  const { t } = useTranslation();
  const [strainCount, setStrainCount] = useState(0);
  const [seedCount, setSeedCount] = useState(0);
  const [growCount, setGrowCount] = useState(0);
  const [activeGrows, setActiveGrows] = useState<Grow[]>([]);
  const [strains, setStrains] = useState<Strain[]>([]);
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([getStrains(0, 1), getSeeds({ skip: 0, limit: 1 }), getGrows(undefined, 0, 1), getGrows("ongoing"), getStrains(0, 500)])
      .then(([s, se, g, ag, st]) => {
        setStrainCount(s.total);
        setSeedCount(se.total);
        setGrowCount(g.total);
        setActiveGrows(ag.items);
        setStrains(st.items);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const doSearch = useCallback((q: string) => {
    if (!q.trim()) {
      setSearchResults(null);
      setShowResults(false);
      return;
    }
    setSearchLoading(true);
    globalSearch(q)
      .then((res) => {
        setSearchResults(res);
        setShowResults(true);
      })
      .catch(() => {})
      .finally(() => setSearchLoading(false));
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(searchQuery), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery, doSearch]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowResults(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, []);

  const strainMap = new Map(strains.map((s) => [s.id, s.name]));

  if (error) return <div className="alert alert-error">{error}</div>;

  return (
    <div>
      <div className="page-header">
        <h1>{t("dashboard.title")}</h1>
      </div>

      <div className="search-wrapper" ref={searchRef}>
        <div className="search-bar">
          <span className="search-bar-icon">&#128269;</span>
          <input
            className="input"
            type="text"
            placeholder={t("dashboard.search_placeholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => { if (searchResults) setShowResults(true); }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (debounceRef.current) clearTimeout(debounceRef.current);
                doSearch(searchQuery);
              }
            }}
            autoComplete="off"
          />
          {searchQuery && (
            <button className="search-bar-clear" onClick={() => { setSearchQuery(""); setSearchResults(null); setShowResults(false); }}>&times;</button>
          )}
          {searchLoading && <span className="search-bar-spinner" />}
        </div>

        {showResults && searchResults && (
          <div className="search-dropdown">
            {searchResults.total_strains === 0 && searchResults.total_grows === 0 ? (
              <div className="search-dropdown-empty">{t("dashboard.no_results")}</div>
            ) : (
              <>
                {searchResults.strains.length > 0 && (
                  <div className="search-group">
                    <div className="search-group-header">{t("nav.strains")} ({searchResults.total_strains})</div>
                    {searchResults.strains.map((s) => (
                      <Link key={s.id} to={`/strains/${s.id}`} className="search-item" onClick={() => setShowResults(false)}>
                        <span className="search-item-icon">&#127807;</span>
                        <div className="search-item-body">
                          <span className="search-item-title">{s.name}</span>
                          <span className="search-item-sub">{s.breeder}{s.genetics ? ` \u00B7 ${s.genetics}` : ""}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
                {searchResults.grows.length > 0 && (
                  <div className="search-group">
                    <div className="search-group-header">{t("nav.grows")} ({searchResults.total_grows})</div>
                    {searchResults.grows.map((g) => (
                      <Link key={g.id} to={`/grows/${g.id}`} className="search-item" onClick={() => setShowResults(false)}>
                        <span className="search-item-icon">&#127804;</span>
                        <div className="search-item-body">
                          <span className="search-item-title">{g.name}</span>
                          <span className="search-item-sub">{g.start_date}{g.end_date ? ` - ${g.end_date}` : ""} \u00B7 {g.status}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <div className="stats-grid">
        <Link to="/strains" className="stat-card" style={{ textDecoration: "none", color: "inherit" }}>
          <div className="stat-card-icon green">{'\u{1F9EC}'}</div>
          <div className="stat-card-label">{t("dashboard.total_strains")}</div>
          <div className="stat-card-value">{strainCount}</div>
        </Link>
        <Link to="/seeds" className="stat-card" style={{ textDecoration: "none", color: "inherit" }}>
          <div className="stat-card-icon blue">{'\u{1F331}'}</div>
          <div className="stat-card-label">{t("dashboard.total_seeds")}</div>
          <div className="stat-card-value">{seedCount}</div>
        </Link>
        <Link to="/grows" className="stat-card" style={{ textDecoration: "none", color: "inherit" }}>
          <div className="stat-card-icon orange">{'\u{1F33F}'}</div>
          <div className="stat-card-label">{t("dashboard.total_grows")}</div>
          <div className="stat-card-value">{growCount}</div>
        </Link>
      </div>

      {activeGrows.length > 0 && (
        <section>
          <h2 style={{ fontSize: "1.1rem", marginBottom: 16, color: "var(--neutral-600)" }}>{t("dashboard.active_grows")}</h2>
          <div className="grow-grid">
            {activeGrows.map((g) => (
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
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
