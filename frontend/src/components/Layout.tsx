import { useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { md5 } from "../utils/md5";
import { getAvatarUrl } from "../api/auth";
import { useTheme } from "../hooks/useTheme";
import HelpButton from "./HelpButton";

function UserAvatar({ email, username, avatarPath }: { email: string; username: string; avatarPath: string | null }) {
  const [gravatarOk, setGravatarOk] = useState(true);
  const [localAvatarOk, setLocalAvatarOk] = useState(true);

  if (avatarPath && localAvatarOk) {
    return (
      <img
        src={getAvatarUrl()}
        alt=""
        onError={() => setLocalAvatarOk(false)}
        className="sidebar-user-avatar"
        style={{ objectFit: "cover" }}
      />
    );
  }

  if (gravatarOk) {
    const hash = md5(email.trim().toLowerCase());
    return (
      <img
        src={`https://www.gravatar.com/avatar/${hash}?d=404&s=72`}
        alt=""
        onError={() => setGravatarOk(false)}
        className="sidebar-user-avatar"
        style={{ objectFit: "cover" }}
      />
    );
  }

  return <div className="sidebar-user-avatar">{username.charAt(0).toUpperCase()}</div>;
}

export default function Layout() {
  const { user, setUser } = useAuth();
  const { t } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems = [
    { path: "/", label: t("nav.dashboard"), icon: "\u{1F3E0}" },
    { path: "/strains", label: t("nav.strains"), icon: "\u{1F9EC}" },
    { path: "/seeds", label: t("nav.seeds"), icon: "\u{1F331}" },
    { path: "/grows", label: t("nav.grows"), icon: "\u{1F33F}" },
  ];

  const handleLogout = () => {
    localStorage.removeItem("token");
    setUser(null);
    navigate("/login");
  };

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  if (!user) return null;

  return (
    <div className="app-layout">
      <div className={`sidebar-overlay ${sidebarOpen ? "active" : ""}`} onClick={() => setSidebarOpen(false)} />

      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-header-row">
          <div className="sidebar-brand">
            <h2>
              <span className="brand-icon">{'\u262E'}</span>
              Homegrow DB
            </h2>
          </div>
          <button className="sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Close menu">
            &times;
          </button>
        </div>
        <Link to="/profile" className="sidebar-user" style={{ textDecoration: "none", color: "inherit" }} onClick={() => setSidebarOpen(false)}>
          <UserAvatar email={user.email} username={user.username} avatarPath={user.avatar_path} />
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{user.username}</div>
            <div className="sidebar-user-email">{user.email}</div>
          </div>
        </Link>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={isActive(item.path) ? "active" : ""}
              onClick={() => setSidebarOpen(false)}
            >
              <span className="sidebar-nav-icon">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-footer">
          <Link to="/profile" className={isActive("/profile") ? "active" : ""} onClick={() => setSidebarOpen(false)}>
            <span className="sidebar-nav-icon">&#9881;</span>
            {t("nav.profile")}
          </Link>
          <button onClick={() => { toggleTheme(); setSidebarOpen(false); }} title={theme === "dark" ? t("nav.light_theme") : t("nav.dark_theme")}>
            <span className="sidebar-nav-icon">{theme === "dark" ? "\u2600" : "\u263E"}</span>
            {theme === "dark" ? t("nav.light_theme") : t("nav.dark_theme")}
          </button>
          <button onClick={handleLogout}>
            <span className="sidebar-nav-icon">&#10140;</span>
            {t("nav.logout")}
          </button>
        </div>
        <HelpButton />
      </aside>

      <div className="main-content">
        <header className="main-header">
          <button className="hamburger" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            <span /><span /><span />
          </button>
          <h1>{navItems.find((i) => isActive(i.path))?.label || t("nav.profile")}</h1>
          <div />
        </header>
        <main className="main-body">
          <Outlet />
        </main>
      </div>

      <nav className="bottom-nav">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`bottom-nav-item ${isActive(item.path) ? "active" : ""}`}
          >
            <span className="bottom-nav-icon">{item.icon}</span>
            <span className="bottom-nav-label">{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
