import { useEffect, useRef, useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowUp,
  BookOpenCheck,
  Bot,
  ChevronRight,
  CloudSun,
  FlaskConical,
  Globe,
  HelpCircle,
  Home,
  Layers3,
  LogIn,
  LogOut,
  MapPin,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldAlert,
  Sun,
  User,
  UserPlus,
  X,
} from "lucide-react";
import { useSpaceFarm } from "../../context/SpaceFarmContext";
import { BrandMark } from "./BrandMark";
import { MethodologyModal, SourceDrawer } from "./SourceDrawer";
import { TopbarUtilityCluster } from "./TopbarMenus";

interface AppShellProps {
  variant?: "home" | "inner";
  children: ReactNode;
}

export function AppShell({ variant = "inner", children }: AppShellProps) {
  const {
    t,
    draft,
    sidebarExpanded,
    toggleSidebarExpanded,
    openMethodology,
    toastMessage,
    user,
    theme,
    toggleTheme,
    openAuthModal,
    logoutUser,
  } = useSpaceFarm();
  const location = useLocation();
  const navigate = useNavigate();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [drawerClosing, setDrawerClosing] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("hero");
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const closeDrawerBtnRef = useRef<HTMLButtonElement | null>(null);
  const drawerCloseTimerRef = useRef<number | null>(null);

  const isHome = variant === "home";

  const landingNavItems = [
    { id: "hero", href: "#hero", label: t.nav.landingLinks.hero },
    { id: "about", href: "#about", label: t.nav.landingLinks.about },
    { id: "platform", href: "#platform", label: t.nav.landingLinks.platform },
    { id: "workflow", href: "#workflow", label: t.nav.landingLinks.workflow },
    { id: "telemetry", href: "#telemetry", label: t.nav.landingLinks.telemetry },
    { id: "solutions", href: "#solutions", label: t.nav.landingLinks.solutions },
    { id: "insights", href: "#insights", label: t.nav.landingLinks.insights },
  ];

  const navItems = [
    { to: "/", label: t.nav.home, icon: Home, end: true },
    { to: "/explore", label: t.nav.explore, icon: Globe, end: false },
    { to: "/field", label: t.nav.field, icon: MapPin, end: false },
    { to: "/climate", label: t.nav.climate, icon: CloudSun, end: false },
    { to: "/rotation", label: t.nav.rotation, icon: Layers3, end: false },
    { to: "/scenarios", label: t.nav.scenarios, icon: FlaskConical, end: false },
    { to: "/alerts", label: t.nav.alerts, icon: ShieldAlert, end: false },
    { to: "/ai", label: t.nav.ai, icon: Bot, end: false },
    { to: "/profile", label: t.nav.profile, icon: User, end: false },
    { to: "/sources", label: t.nav.sources, icon: BookOpenCheck, end: false },
  ];

  const activeNav = navItems.find((item) =>
    item.end ? location.pathname === item.to : location.pathname.startsWith(item.to),
  );

  function openMobileDrawer() {
    if (drawerCloseTimerRef.current) {
      window.clearTimeout(drawerCloseTimerRef.current);
      drawerCloseTimerRef.current = null;
    }
    setDrawerClosing(false);
    setMobileOpen(true);
  }

  function closeMobileDrawer(restoreFocus = false) {
    if (!mobileOpen || drawerClosing) return;
    setDrawerClosing(true);
    drawerCloseTimerRef.current = window.setTimeout(() => {
      setMobileOpen(false);
      setDrawerClosing(false);
      if (restoreFocus) {
        triggerRef.current?.focus();
      }
    }, 220);
  }

  // Close drawer cleanly on route change
  useEffect(() => {
    if (drawerCloseTimerRef.current) {
      window.clearTimeout(drawerCloseTimerRef.current);
    }
    setMobileOpen(false);
    setDrawerClosing(false);
  }, [location.pathname]);

  useEffect(() => {
    return () => {
      if (drawerCloseTimerRef.current) {
        window.clearTimeout(drawerCloseTimerRef.current);
      }
    };
  }, []);

  // Track vertical scroll for floating Back-to-Top button
  useEffect(() => {
    const updateScroll = () => {
      setShowBackToTop(window.scrollY > 220);
    };
    updateScroll();
    window.addEventListener("scroll", updateScroll, { passive: true });
    return () => window.removeEventListener("scroll", updateScroll);
  }, [location.pathname]);

  function scrollToTop() {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: prefersReduced ? "auto" : "smooth" });
  }

  function handleSectionJump(sectionId: string, closeDrawer = false) {
    if (closeDrawer) closeMobileDrawer(false);
    setActiveSection(sectionId);
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (sectionId === "hero") {
      window.scrollTo({ top: 0, behavior: prefersReduced ? "auto" : "smooth" });
      return;
    }
    const el = document.getElementById(sectionId);
    if (!el) return;
    el.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth", block: "start" });
  }

  function handleLogout() {
    logoutUser();
    closeMobileDrawer(false);
    navigate("/");
  }

  // Highlight active one-page section while scrolling on Home
  useEffect(() => {
    if (!isHome) return;
    const ids = ["hero", "about", "platform", "workflow", "telemetry", "solutions", "insights"];
    const onScrollSpy = () => {
      if (window.scrollY < 160) {
        setActiveSection("hero");
        return;
      }
      const scrollMarker = window.scrollY + 140;
      let current = ids[0];
      for (const id of ids) {
        const node = document.getElementById(id);
        if (node && node.offsetTop <= scrollMarker) {
          current = id;
        }
      }
      setActiveSection(current);
    };
    window.addEventListener("scroll", onScrollSpy, { passive: true });
    onScrollSpy();
    return () => window.removeEventListener("scroll", onScrollSpy);
  }, [isHome]);

  // Escape & focus management for mobile drawer
  useEffect(() => {
    if (!mobileOpen) return;
    window.setTimeout(() => closeDrawerBtnRef.current?.focus(), 0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeMobileDrawer(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mobileOpen]);

  return (
    <div className="sf-app-shell">
      <a href="#main-content" className="sf-skip-link">
        {t.skipToContent}
      </a>

      {/* Shared 64px Topbar */}
      <header className={`sf-topbar ${isHome ? "sf-topbar-home" : ""}`}>
        <div className="sf-topbar-left">
          <NavLink to="/" className="sf-brand-link" aria-label="SpaceFarm Home">
            <BrandMark showByline bylineText={t.byline} />
          </NavLink>

          {!isHome && activeNav && (
            <nav aria-label="Breadcrumb" className="sf-breadcrumb sf-breadcrumb-hide-sm">
              <span className="sf-topbar-divider" aria-hidden="true" />
              <span className="sf-breadcrumb-field">{draft.label}</span>
              <ChevronRight size={14} className="sf-breadcrumb-sep" aria-hidden="true" />
              <span className="sf-breadcrumb-current">{activeNav.label}</span>
            </nav>
          )}
        </div>

        {/* Center primary links on Home: 7 one-page project showcase links */}
        {isHome && (
          <nav aria-label="Primary one-page navigation" className="sf-home-nav">
            {landingNavItems.map((item) => (
              <a
                key={item.id}
                href={item.href}
                onClick={(e) => {
                  e.preventDefault();
                  handleSectionJump(item.id);
                }}
                className={`sf-top-link ${activeSection === item.id ? "active" : ""}`}
              >
                {item.label}
              </a>
            ))}
          </nav>
        )}

        {/* Right utility actions + Right-aligned Animated Hamburger Menu */}
        <div className="sf-topbar-right">
          <TopbarUtilityCluster isHome={isHome} />

          <button
            ref={triggerRef}
            type="button"
            className={`sf-burger-btn sf-mobile-trigger ${isHome ? "sf-home-mobile-trigger" : ""} ${
              mobileOpen && !drawerClosing ? "is-open" : ""
            }`}
            onClick={() => (mobileOpen ? closeMobileDrawer(true) : openMobileDrawer())}
            aria-label={mobileOpen ? t.nav.closeMenu : t.nav.openMenu}
            aria-expanded={mobileOpen}
          >
            <span className={`sf-burger-lines ${mobileOpen && !drawerClosing ? "is-open" : ""}`} aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </button>
        </div>
      </header>

      {/* Main Content Layout */}
      {isHome ? (
        <main id="main-content" className="sf-page-content">
          {children}
        </main>
      ) : (
        <div className="sf-workspace-frame">
          {/* Expandable / Collapsible Left Navigation Rail */}
          <aside
            className={`sf-icon-rail ${sidebarExpanded ? "is-expanded" : ""}`}
            aria-label="Workspace navigation"
          >
            <button
              type="button"
              className="sf-rail-toggle"
              onClick={toggleSidebarExpanded}
              aria-expanded={sidebarExpanded}
              aria-label={sidebarExpanded ? t.nav.collapseSidebar : t.nav.expandSidebar}
              title={sidebarExpanded ? t.nav.collapseSidebar : t.nav.expandSidebar}
            >
              {sidebarExpanded ? (
                <PanelLeftClose size={18} strokeWidth={1.85} aria-hidden="true" />
              ) : (
                <PanelLeftOpen size={18} strokeWidth={1.85} aria-hidden="true" />
              )}
              {sidebarExpanded && (
                <span className="sf-rail-label">{t.nav.collapseSidebar}</span>
              )}
            </button>

            <div className="sf-rail-links">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    aria-label={item.label}
                    className={({ isActive }) => `sf-rail-item ${isActive ? "active" : ""}`}
                  >
                    <Icon size={20} strokeWidth={1.85} aria-hidden="true" className="sf-rail-icon" />
                    {sidebarExpanded ? (
                      <span className="sf-rail-label">{item.label}</span>
                    ) : (
                      <span className="sf-rail-tooltip" aria-hidden="true">
                        {item.label}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </aside>

          <main id="main-content" className="sf-page-content">
            {children}
          </main>
        </div>
      )}

      {/* Accessible Animated Right-Side Mobile Navigation Drawer */}
      {mobileOpen && (
        <>
          <div
            className={`sf-drawer-backdrop ${drawerClosing ? "is-closing" : ""}`}
            onClick={() => closeMobileDrawer(true)}
            aria-hidden="true"
          />
          <nav
            className={`sf-drawer-panel ${drawerClosing ? "is-closing" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-label="Mobile navigation"
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <BrandMark showByline bylineText={t.byline} />
              <button
                ref={closeDrawerBtnRef}
                type="button"
                className="sf-icon-circle-btn"
                onClick={() => closeMobileDrawer(true)}
                aria-label={t.nav.closeMenu}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            {isHome && !user ? (
              <>
                {landingNavItems.map((item, idx) => (
                  <a
                    key={item.id}
                    href={item.href}
                    onClick={(e) => {
                      e.preventDefault();
                      handleSectionJump(item.id, true);
                    }}
                    className={`sf-btn sf-drawer-stagger ${activeSection === item.id ? "sf-btn-primary" : ""}`}
                    style={{ justifyContent: "flex-start", animationDelay: `${idx * 35}ms` }}
                  >
                    <span>{item.label}</span>
                  </a>
                ))}

                <div
                  className="sf-drawer-stagger"
                  style={{ display: "grid", gap: 8, marginTop: 10, animationDelay: `${landingNavItems.length * 35}ms` }}
                >
                  <button
                    type="button"
                    className="sf-btn"
                    style={{ justifyContent: "flex-start" }}
                    onClick={() => {
                      closeMobileDrawer(false);
                      openAuthModal("login", null, "/explore");
                    }}
                  >
                    <LogIn size={17} aria-hidden="true" />
                    <span>{t.nav.login}</span>
                  </button>
                  <button
                    type="button"
                    className="sf-btn sf-btn-primary"
                    style={{ justifyContent: "flex-start" }}
                    onClick={() => {
                      closeMobileDrawer(false);
                      openAuthModal("register", null, "/explore");
                    }}
                  >
                    <UserPlus size={17} aria-hidden="true" />
                    <span>{t.nav.register}</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                {navItems.map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      onClick={() => closeMobileDrawer(false)}
                      className={({ isActive }) =>
                        `sf-btn sf-drawer-stagger ${isActive ? "sf-btn-primary" : ""}`
                      }
                      style={{ justifyContent: "flex-start", animationDelay: `${idx * 20}ms` }}
                    >
                      <Icon size={18} aria-hidden="true" />
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}

                <button
                  type="button"
                  className="sf-btn sf-drawer-stagger"
                  style={{ justifyContent: "flex-start", marginTop: 8, animationDelay: "145ms" }}
                  onClick={() => toggleTheme()}
                >
                  {theme === "dark" ? (
                    <Sun size={18} aria-hidden="true" />
                  ) : (
                    <Moon size={18} aria-hidden="true" />
                  )}
                  <span>{theme === "dark" ? t.topbarMenus.themeToLight : t.topbarMenus.themeToDark}</span>
                </button>

                <button
                  type="button"
                  className="sf-btn sf-drawer-stagger"
                  style={{ justifyContent: "flex-start", animationDelay: "170ms" }}
                  onClick={() => {
                    closeMobileDrawer(false);
                    openMethodology();
                  }}
                >
                  <HelpCircle size={18} aria-hidden="true" />
                  <span>{t.actions.viewMethodology}</span>
                </button>

                {user && (
                  <button
                    type="button"
                    className="sf-btn sf-drawer-stagger"
                    style={{ justifyContent: "flex-start", animationDelay: "195ms" }}
                    onClick={handleLogout}
                  >
                    <LogOut size={18} aria-hidden="true" />
                    <span>{t.nav.logout}</span>
                  </button>
                )}
              </>
            )}
          </nav>
        </>
      )}

      <button
        type="button"
        className={`sf-back-to-top ${showBackToTop ? "is-visible" : ""}`}
        onClick={scrollToTop}
        aria-label={t.actions.backToTop}
        title={t.actions.backToTop}
        aria-hidden={!showBackToTop}
        tabIndex={showBackToTop ? 0 : -1}
      >
        <ArrowUp size={18} strokeWidth={2.15} aria-hidden="true" />
      </button>

      <SourceDrawer />
      <MethodologyModal />

      {toastMessage && (
        <div className="sf-toast" role="status" aria-live="polite">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
