import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  BookOpenCheck,
  Bot,
  Check,
  ChevronDown,
  CloudSun,
  FlaskConical,
  LogIn,
  LogOut,
  MapPin,
  Moon,
  Shield,
  Sun,
  User,
  UserCircle2,
  UserPlus,
} from "lucide-react";
import { useSpaceFarm } from "../../context/SpaceFarmContext";

type OpenPopover = "notifications" | "account" | "language" | null;

export function formatShortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "User";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1].charAt(0).toUpperCase()}.`;
}

export function getUserInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "SF";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
}

interface TopbarUtilityProps {
  isHome: boolean;
}

export function TopbarUtilityCluster({ isHome }: TopbarUtilityProps) {
  const {
    locale,
    setLocale,
    t,
    theme,
    toggleTheme,
    user,
    openAuthModal,
    logoutUser,
    openMethodology,
    notifications,
    unreadNotificationCount,
    markNotificationRead,
    markAllNotificationsRead,
  } = useSpaceFarm();
  const location = useLocation();
  const navigate = useNavigate();

  const [openMenu, setOpenMenu] = useState<OpenPopover>(null);
  const clusterRef = useRef<HTMLDivElement | null>(null);

  // Close popovers on outside click or Escape
  useEffect(() => {
    if (!openMenu) return;
    const onPointerDown = (e: MouseEvent) => {
      if (clusterRef.current && !clusterRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenMenu(null);
      }
    };
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [openMenu]);

  // Close popovers cleanly on route transition
  useEffect(() => {
    setOpenMenu(null);
  }, [location.pathname]);

  function toggleMenu(next: Exclude<OpenPopover, null>) {
    setOpenMenu((prev) => (prev === next ? null : next));
  }

  function handleNavigate(path: string) {
    setOpenMenu(null);
    navigate(path);
  }

  function handleLogout() {
    setOpenMenu(null);
    logoutUser();
    navigate("/");
  }

  const shortName = user ? formatShortName(user.name) : "";
  const initials = user ? getUserInitials(user.name) : "SF";
  const isField = location.pathname.startsWith("/field");
  const isClimate = location.pathname.startsWith("/climate");
  const isScenarios = location.pathname.startsWith("/scenarios");
  const isSources = location.pathname.startsWith("/sources");

  return (
    <div ref={clusterRef} className="sf-topbar-actions sf-utility-cluster">
        <span className="sf-topbar-divider sf-breadcrumb-hide-sm" aria-hidden="true" />

        {/* Dark / Light Mode Toggle */}
        <button
          type="button"
          className="sf-icon-circle-btn"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? t.topbarMenus.themeToLight : t.topbarMenus.themeToDark}
          title={theme === "dark" ? t.topbarMenus.themeToLight : t.topbarMenus.themeToDark}
        >
          {theme === "dark" ? (
            <Sun size={17} strokeWidth={2} aria-hidden="true" />
          ) : (
            <Moon size={17} strokeWidth={2} aria-hidden="true" />
          )}
        </button>

        {/* Notifications Bell (when authenticated) */}
        {user && (
          <div className="sf-menu-anchor">
            <button
              type="button"
              className={`sf-icon-circle-btn ${openMenu === "notifications" ? "is-open" : ""}`}
              onClick={() => toggleMenu("notifications")}
              aria-label={t.topbarMenus.notificationsTitle}
              title={t.topbarMenus.notificationsTitle}
              aria-expanded={openMenu === "notifications"}
              aria-haspopup="dialog"
            >
              <Bell size={17} strokeWidth={2} aria-hidden="true" />
              {unreadNotificationCount > 0 && (
                <span className="sf-notif-dot" aria-label={`${unreadNotificationCount} unread`} />
              )}
            </button>

            {openMenu === "notifications" && (
              <div
                className="sf-popover-menu sf-notif-popover"
                role="dialog"
                aria-label={t.topbarMenus.notificationsTitle}
              >
                <div className="sf-popover-header">
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <strong style={{ fontSize: 14 }}>{t.topbarMenus.notificationsTitle}</strong>
                    {unreadNotificationCount > 0 && (
                      <span className="sf-badge sf-badge-violet">{unreadNotificationCount}</span>
                    )}
                  </div>
                  {unreadNotificationCount > 0 && (
                    <button
                      type="button"
                      className="sf-popover-text-btn"
                      onClick={markAllNotificationsRead}
                    >
                      {t.topbarMenus.markAllRead}
                    </button>
                  )}
                </div>

                <div className="sf-notif-list">
                  {notifications.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`sf-notif-item ${!item.read ? "unread" : ""}`}
                      onClick={() => {
                        markNotificationRead(item.id);
                        handleNavigate(item.route);
                      }}
                    >
                      <span
                        className={`sf-notif-bullet ${item.tone}`}
                        style={{ opacity: item.read ? 0.35 : 1 }}
                        aria-hidden="true"
                      />
                      <div style={{ minWidth: 0, textAlign: "left" }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                          {item.title}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                          {item.detail}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Signed-in User Dropdown Menu Pill OR Landing Login/Register Buttons */}
        {user ? (
          <div className="sf-menu-anchor">
            <button
              type="button"
              className={`sf-user-pill ${openMenu === "account" ? "is-open" : ""}`}
              onClick={() => toggleMenu("account")}
              aria-expanded={openMenu === "account"}
              aria-haspopup="menu"
              title={user.name}
            >
              <span className="sf-user-pill-name">{shortName}</span>
              <UserCircle2 size={18} strokeWidth={1.9} aria-hidden="true" />
            </button>

            {openMenu === "account" && (
              <div
                className="sf-popover-menu sf-account-popover"
                role="menu"
                aria-label={shortName}
              >
                <div className="sf-account-card">
                  <div className="sf-account-avatar" aria-hidden="true">
                    {initials}
                  </div>
                  <div className="sf-account-meta">
                    <div className="sf-account-name">{user.name}</div>
                    <div className="sf-account-email">{user.email}</div>
                  </div>
                </div>

                <div className="sf-popover-divider" />

                <button
                  type="button"
                  role="menuitem"
                  className="sf-account-row"
                  onClick={() => {
                    setOpenMenu(null);
                    navigate("/profile");
                  }}
                >
                  <User size={16} className="sf-row-icon" aria-hidden="true" />
                  <span>{t.topbarMenus.menuMyProfile}</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="sf-account-row"
                  onClick={() => {
                    setOpenMenu(null);
                    navigate("/ai");
                  }}
                >
                  <Bot size={16} className="sf-row-icon" aria-hidden="true" />
                  <span>{t.topbarMenus.menuAi}</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  className="sf-account-row"
                  onClick={() => setOpenMenu("notifications")}
                >
                  <Bell size={16} className="sf-row-icon" aria-hidden="true" />
                  <span style={{ flex: 1, textAlign: "left" }}>{t.topbarMenus.menuNotifications}</span>
                  {unreadNotificationCount > 0 && (
                    <span className="sf-account-badge">{unreadNotificationCount}</span>
                  )}
                </button>

                <button
                  type="button"
                  role="menuitem"
                  className={`sf-account-row ${isField ? "is-active-panel" : ""}`}
                  onClick={() => handleNavigate("/field")}
                >
                  <MapPin size={16} className="sf-row-icon" aria-hidden="true" />
                  <span>{t.topbarMenus.menuField}</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  className={`sf-account-row ${isClimate ? "is-active-panel" : ""}`}
                  onClick={() => handleNavigate("/climate")}
                >
                  <CloudSun size={16} className="sf-row-icon" aria-hidden="true" />
                  <span>{t.topbarMenus.menuClimate}</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  className={`sf-account-row ${isScenarios ? "is-active-panel" : ""}`}
                  onClick={() => handleNavigate("/scenarios")}
                >
                  <FlaskConical size={16} className="sf-row-icon" aria-hidden="true" />
                  <span>{t.topbarMenus.menuScenario}</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  className={`sf-account-row ${isSources ? "is-active-panel" : ""}`}
                  onClick={() => handleNavigate("/sources")}
                >
                  <BookOpenCheck size={16} className="sf-row-icon" aria-hidden="true" />
                  <span>{t.topbarMenus.menuSources}</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  className="sf-account-row"
                  onClick={() => {
                    setOpenMenu(null);
                    openMethodology();
                  }}
                >
                  <Shield size={16} className="sf-row-icon" aria-hidden="true" />
                  <span>{t.topbarMenus.menuMethodology}</span>
                </button>

                <div className="sf-popover-divider" />

                <button
                  type="button"
                  role="menuitem"
                  className="sf-account-row sf-account-logout"
                  onClick={handleLogout}
                >
                  <LogOut size={16} aria-hidden="true" />
                  <span>{t.topbarMenus.menuLogout}</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          isHome && (
            <>
              <button
                type="button"
                className="sf-btn sf-btn-sm sf-breadcrumb-hide-sm"
                onClick={() => openAuthModal("login", null, "/explore")}
              >
                <LogIn size={14} aria-hidden="true" />
                <span>{t.nav.login}</span>
              </button>
              <button
                type="button"
                className="sf-btn sf-btn-sm sf-btn-primary sf-breadcrumb-hide-sm"
                onClick={() => openAuthModal("register", null, "/explore")}
              >
                <UserPlus size={14} aria-hidden="true" />
                <span>{t.nav.register}</span>
              </button>
            </>
          )
        )}

        {/* Language Dropdown Pill (Az ⌄ / En ⌄) */}
        <div className="sf-menu-anchor">
          <button
            type="button"
            className={`sf-lang-pill ${openMenu === "language" ? "is-open" : ""}`}
            onClick={() => toggleMenu("language")}
            aria-label="Language selector"
            aria-expanded={openMenu === "language"}
            aria-haspopup="listbox"
          >
            <span>{t.topbarMenus.langShort}</span>
            <ChevronDown size={14} aria-hidden="true" />
          </button>

          {openMenu === "language" && (
            <div className="sf-popover-menu sf-lang-popover" role="listbox" aria-label="Language">
              <button
                type="button"
                role="option"
                aria-selected={locale === "az"}
                className={`sf-account-row ${locale === "az" ? "is-active-panel" : ""}`}
                onClick={() => {
                  setLocale("az");
                  setOpenMenu(null);
                }}
              >
                <span style={{ flex: 1, textAlign: "left" }}>{t.topbarMenus.langFullAz}</span>
                {locale === "az" && <Check size={14} aria-hidden="true" />}
              </button>
              <button
                type="button"
                role="option"
                aria-selected={locale === "en"}
                className={`sf-account-row ${locale === "en" ? "is-active-panel" : ""}`}
                onClick={() => {
                  setLocale("en");
                  setOpenMenu(null);
                }}
              >
                <span style={{ flex: 1, textAlign: "left" }}>{t.topbarMenus.langFullEn}</span>
                {locale === "en" && <Check size={14} aria-hidden="true" />}
              </button>
            </div>
          )}
        </div>
      </div>
  );
}
