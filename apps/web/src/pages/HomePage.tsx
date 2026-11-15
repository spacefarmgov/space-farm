import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowDown,
  ArrowRight,
  BellRing,
  Bot,
  CheckCircle2,
  ChevronDown,
  CloudSun,
  FlaskConical,
  Globe2,
  Layers3,
  Lock,
  LogIn,
  MapPin,
  Satellite,
  ShieldCheck,
  Sparkles,
  UserPlus,
} from "lucide-react";
import { HeroEarth3D } from "../components/earth/HeroEarth3D";
import { HeroTypewriter } from "../components/features/HeroTypewriter";
import { AppShell } from "../components/layout/AppShell";
import { SpiderWebCanvas } from "../components/layout/SpiderWebCanvas";
import { CropIcon } from "../components/ui/StatusPrimitives";
import { useSpaceFarm } from "../context/SpaceFarmContext";
import { REPO_GITHUB_URL, VERIFIED_AZ_REGIONS } from "../data/regions";
import {
  AZ_DISTRICTS,
  findAzDistrict,
  resolveRegionPresetOrDistrict,
} from "../data/azDistricts";

const LANDING_CROPS = [
  { id: "wheat", nameEn: "Wheat", nameAz: "Buğda", family: "Poaceae", tagEn: "Cereal staple", tagAz: "Əsas taxıl" },
  { id: "barley", nameEn: "Barley", nameAz: "Arpa", family: "Poaceae", tagEn: "Low-rain resilient", tagAz: "Az yağışa davamlı" },
  { id: "chickpea", nameEn: "Chickpea", nameAz: "Noxud", family: "Fabaceae", tagEn: "N-fixing legume", tagAz: "Azot fiksasiyalı" },
  { id: "lentil", nameEn: "Lentil", nameAz: "Mərci", family: "Fabaceae", tagEn: "Soil restorer", tagAz: "Torpaq bərpaçısı" },
  { id: "sunflower", nameEn: "Sunflower", nameAz: "Günəbaxan", family: "Asteraceae", tagEn: "Broadleaf break", tagAz: "Enliyarpaqlı fasilə" },
  { id: "maize", nameEn: "Maize", nameAz: "Qarğıdalı", family: "Poaceae", tagEn: "Irrigated option", tagAz: "Suvarma seçimi" },
] as const;

const REGION_QUICK_CLIMATE: Record<string, { rainMm: string; meanC: string }> = {
  "ganja-dashkasan": { rainMm: "506.5 mm", meanC: "10.6 °C" },
  "aran-barda": { rainMm: "457.5 mm", meanC: "15.7 °C" },
  "quba-khachmaz": { rainMm: "516.2 mm", meanC: "15.0 °C" },
  "sheki-zaqatala": { rainMm: "588.5 mm", meanC: "15.7 °C" },
};

export function HomePage() {
  const {
    t,
    locale,
    user,
    selectRegion,
    openMethodology,
    openAuthModal,
    triggerAuthAlert,
  } = useSpaceFarm();
  const navigate = useNavigate();
  const heroRef = useRef<HTMLElement | null>(null);

  const [featuredRegionId, setFeaturedRegionId] = useState<string>(VERIFIED_AZ_REGIONS[0].id);
  const [activeSolutionId, setActiveSolutionId] = useState<string>(t.landing.solutionTabs[0]?.id ?? "explore");
  const [openFaqIdx, setOpenFaqIdx] = useState<number>(0);

  const featuredDistrict = findAzDistrict(featuredRegionId);
  const featuredRegion =
    resolveRegionPresetOrDistrict(featuredRegionId) ?? VERIFIED_AZ_REGIONS[0];
  const featuredPrimaryLabRegion =
    VERIFIED_AZ_REGIONS.find((r) => r.id === featuredRegionId) ?? VERIFIED_AZ_REGIONS[0];
  const isPrimaryFeatured = Boolean(REGION_QUICK_CLIMATE[featuredRegion.id]);
  const featuredClim = REGION_QUICK_CLIMATE[featuredRegion.id] ?? (
    featuredDistrict
      ? {
          rainMm: `${featuredDistrict.annualRainMm.toFixed(1)} mm`,
          meanC: `${featuredDistrict.meanTempC.toFixed(1)} °C`,
        }
      : { rainMm: "506.5 mm", meanC: "10.6 °C" }
  );
  const activeSolution =
    t.landing.solutionTabs.find((item) => item.id === activeSolutionId) ?? t.landing.solutionTabs[0];

  // Smooth IntersectionObserver scroll-reveal animation for landing sections
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-sf-reveal]"));
    if (!nodes.length) return;
    if (
      typeof IntersectionObserver === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      nodes.forEach((n) => n.classList.add("is-visible"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -30px 0px" },
    );
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, []);

  function guardWorkspaceAccess(targetRoute: string) {
    if (!user) {
      triggerAuthAlert(targetRoute);
      return;
    }
    navigate(targetRoute);
  }

  function handleRegionInspect(regionId: string, route = "/field") {
    selectRegion(regionId);
    if (!user) {
      triggerAuthAlert(route);
      return;
    }
    navigate(route);
  }

  function handleScrollToAbout(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    const target = document.getElementById("about") ?? document.getElementById("platform");
    if (!target) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth", block: "start" });
  }

  function renderSolutionIcon(id: string) {
    switch (id) {
      case "explore":
        return <Globe2 size={16} aria-hidden="true" />;
      case "field":
        return <FlaskConical size={16} aria-hidden="true" />;
      case "rotation":
        return <Layers3 size={16} aria-hidden="true" />;
      case "alerts":
        return <BellRing size={16} aria-hidden="true" />;
      case "ai":
        return <Bot size={16} aria-hidden="true" />;
      default:
        return <Sparkles size={16} aria-hidden="true" />;
    }
  }

  return (
    <AppShell variant="home">
      {/* Above-the-fold Hero Header with Interactive 3D Earth, Infinite Satellite & Spider-Web */}
      <section ref={heroRef} id="hero" className="sf-hero" aria-labelledby="hero-heading">
        <div className="sf-hero-media">
          <div className="sf-hero-stars" aria-hidden="true" />
          <div className="sf-hero-ambient" aria-hidden="true" />
          <div className="sf-hero-scrim" aria-hidden="true" />
        </div>

        <HeroEarth3D />

        <SpiderWebCanvas hostRef={heroRef} className="sf-hero-fx" />

        <div className="sf-hero-inner">
          <div className="sf-hero-copy">
            <span className="sf-eyebrow sf-eyebrow-live sf-hero-stagger sf-hero-stagger-1">
              <span className="sf-pulse-dot" aria-hidden="true" />
              <span>{t.home.eyebrow}</span>
            </span>

            <h1 id="hero-heading" className="sf-hero-h1 sf-hero-stagger sf-hero-stagger-2">
              <span className="sf-sr-only">
                {t.home.headlinePrefix}
                {t.home.headlineAccent}
              </span>
              <span className="sf-hero-h1-sizer" aria-hidden="true">
                {t.home.headlineCycleWords.map((word) => (
                  <span key={word} className="sf-hero-h1-ghost">
                    {t.home.headlinePrefix}
                    {word}
                    <span className="sf-typewriter-caret" />
                  </span>
                ))}
                <span className="sf-hero-h1-live">
                  {t.home.headlinePrefix}
                  <HeroTypewriter
                    words={t.home.headlineCycleWords}
                    fallback={t.home.headlineAccent}
                  />
                </span>
              </span>
            </h1>

            <p
              className="sf-hero-subtitle sf-hero-stagger sf-hero-stagger-3"
              style={{ margin: 0, fontSize: 17, color: "var(--text-secondary)", maxWidth: "46ch", lineHeight: 1.6 }}
            >
              {t.home.subtitle}
            </p>

            <div className="sf-hero-actions sf-hero-stagger sf-hero-stagger-4">
              <button
                type="button"
                className="sf-btn sf-btn-primary sf-btn-hero-primary"
                onClick={() => guardWorkspaceAccess("/explore")}
              >
                <span>{t.actions.exploreYourField}</span>
                <ArrowRight size={17} className="sf-btn-arrow" aria-hidden="true" />
              </button>

              <button
                type="button"
                className="sf-btn sf-btn-hero-secondary"
                onClick={() => guardWorkspaceAccess("/ai")}
              >
                <span>{t.actions.openAiAdvisor}</span>
              </button>
            </div>

            <a
              href="#about"
              onClick={handleScrollToAbout}
              className="sf-scroll-cue sf-hero-stagger sf-hero-stagger-5"
            >
              <span className="sf-scroll-cue-icon" aria-hidden="true">
                <ArrowDown size={14} />
              </span>
              <span>{t.home.scrollPrompt}</span>
            </a>
          </div>
        </div>
      </section>

      {/* About Section: #about — Team CODE44 & NASA Space Apps Mission */}
      <section
        id="about"
        className="sf-container sf-onepage-section sf-reveal"
        data-sf-reveal
        aria-labelledby="about-heading"
      >
        <div className="sf-section-head">
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span className="sf-eyebrow">{t.landing.aboutEyebrow}</span>
            <span className="sf-badge sf-badge-cyan">
              <Satellite size={12} aria-hidden="true" />
              <span>{t.landing.aboutChallengeBadge}</span>
            </span>
          </div>
          <h2 id="about-heading" className="sf-page-title">{t.landing.aboutTitle}</h2>
          <p className="sf-subtitle" style={{ maxWidth: "74ch", fontSize: 15 }}>
            {t.landing.aboutSubtitle}
          </p>
          <p style={{ margin: "4px 0 0", maxWidth: "78ch", color: "var(--text-secondary)", fontSize: 14.5, lineHeight: 1.65 }}>
            {t.landing.aboutLead}
          </p>
        </div>

        <div className="sf-grid-3">
          {t.landing.aboutCards.map((card, idx) => {
            const Icon = idx === 0 ? Satellite : idx === 1 ? FlaskConical : ShieldCheck;
            const badgeColor =
              idx === 0 ? "var(--accent-cyan)" : idx === 1 ? "#6ee7b7" : "var(--accent-soft)";
            return (
              <article
                key={card.title}
                className="sf-panel sf-panel-compact sf-card-hover"
                style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 12 }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 34,
                        height: 34,
                        borderRadius: 10,
                        background: "rgba(139, 92, 246, 0.14)",
                        color: badgeColor,
                      }}
                    >
                      <Icon size={17} aria-hidden="true" />
                    </span>
                    <span className="mono" style={{ fontSize: 11.5, color: badgeColor, fontWeight: 600 }}>
                      {card.metric}
                    </span>
                  </div>
                  <h3 style={{ margin: "0 0 6px", fontSize: 16.5 }}>{card.title}</h3>
                  <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-secondary)", lineHeight: 1.55 }}>
                    {card.desc}
                  </p>
                </div>
              </article>
            );
          })}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <button
            type="button"
            className="sf-btn sf-btn-sm sf-btn-primary"
            onClick={() => openMethodology()}
          >
            <Layers3 size={14} aria-hidden="true" />
            <span>{t.landing.aboutChallengeLinkLabel}</span>
          </button>
          <a
            href="#platform"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById("platform")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="sf-btn sf-btn-sm"
          >
            <span>{t.nav.landingLinks.platform}</span>
            <ArrowRight size={14} aria-hidden="true" />
          </a>
        </div>
      </section>

      {/* Section 1: #platform — Clear Value Overview & Live Region Selector */}
      <section id="platform" className="sf-container sf-onepage-section sf-reveal" data-sf-reveal>
        <div className="sf-section-head">
          <span className="sf-eyebrow">{t.landing.platformEyebrow}</span>
          <h2 className="sf-page-title">{t.landing.platformTitle}</h2>
          <p className="sf-subtitle" style={{ maxWidth: "72ch" }}>
            {t.landing.platformLead}
          </p>
        </div>

        <div className="sf-grid-3">
          {t.landing.kpis.map((kpi) => (
            <div key={kpi.value} className="sf-panel sf-panel-compact sf-card-hover">
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(22px, 2.3vw, 30px)",
                  fontWeight: 700,
                  color: kpi.tone === "cyan" ? "var(--accent-cyan)" : kpi.tone === "success" ? "#6ee7b7" : "var(--accent-soft)",
                }}
              >
                {kpi.value}
              </div>
              <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "var(--text-secondary)" }}>
                {kpi.label}
              </p>
            </div>
          ))}
        </div>

        {/* Interactive Split: Regions Left + Visual Photo Preview Right */}
        <div className="sf-platform-split">
          <div className="sf-panel" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 16 }}>
            <div>
              <h3 className="sf-section-title" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <MapPin size={18} style={{ color: "var(--accent-soft)" }} aria-hidden="true" />
                <span>{t.landing.regionsHeading}</span>
              </h3>
              <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-secondary)" }}>
                {t.landing.regionsNote}
              </p>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {VERIFIED_AZ_REGIONS.map((reg) => (
                <button
                  key={reg.id}
                  type="button"
                  className={`sf-btn sf-btn-sm ${featuredRegion.id === reg.id ? "sf-btn-primary" : ""}`}
                  onClick={() => setFeaturedRegionId(reg.id)}
                >
                  ★ {locale === "az" ? reg.nameAz : reg.nameEn}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <select
                className="sf-select"
                aria-label={locale === "az" ? "Bütün 67 rayon" : "All 67 districts"}
                value={featuredRegion.id}
                onChange={(e) => setFeaturedRegionId(e.target.value)}
                style={{ minWidth: 260, flex: "1 1 240px", fontSize: 13 }}
              >
                <optgroup label={locale === "az" ? "★ Əsas Bölgələr (4)" : "★ Primary Regions (4)"}>
                  {VERIFIED_AZ_REGIONS.map((reg) => (
                    <option key={reg.id} value={reg.id}>
                      ★ {locale === "az" ? reg.nameAz : reg.nameEn}
                    </option>
                  ))}
                </optgroup>
                <optgroup
                  label={
                    locale === "az"
                      ? `Bütün ${AZ_DISTRICTS.length} Rayon (A–Z · NASA POWER + SRTM)`
                      : `All ${AZ_DISTRICTS.length} Districts (A–Z · NASA POWER + SRTM)`
                  }
                >
                  {AZ_DISTRICTS.map((d) => (
                    <option key={d.id} value={d.id}>
                      {locale === "az"
                        ? `${d.nameAz} (${d.economicRegionAz}) · ${d.elevationM.toFixed(0)} m`
                        : `${d.nameEn} (${d.economicRegionEn}) · ${d.elevationM.toFixed(0)} m`}
                    </option>
                  ))}
                </optgroup>
              </select>
              <span className="sf-badge sf-badge-cyan" style={{ fontSize: 11 }}>
                {locale === "az" ? "67/67 Rayon · NASA + SRTM Doğrulanıb" : "67/67 Districts · NASA + SRTM Verified"}
              </span>
            </div>

            {/* Clean Real Metrics Grid for Selected Region */}
            <div className="sf-lab-chip-grid">
              <div className="sf-lab-chip">
                <span>{locale === "az" ? "Orta istilik" : "Mean temp"}</span>
                <strong>{featuredClim.meanC}</strong>
              </div>
              <div className="sf-lab-chip">
                <span>{locale === "az" ? "İllik yağıntı" : "Annual rain"}</span>
                <strong>{featuredClim.rainMm}</strong>
              </div>
              <div className="sf-lab-chip">
                <span>
                  {!isPrimaryFeatured && featuredDistrict
                    ? locale === "az"
                      ? "SRTM · Aqro pH"
                      : "SRTM · Agro pH"
                    : "Lab pH · Humus"}
                </span>
                <strong style={{ color: "#6ee7b7" }}>
                  {!isPrimaryFeatured && featuredDistrict
                    ? `${featuredDistrict.elevationM.toFixed(0)} m · pH ${featuredDistrict.defaultPh.toFixed(1)}`
                    : `${featuredRegion.ph.toFixed(1)} · ${featuredRegion.labMetrics.organicMatterPct}%`}
                </strong>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
              <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                {locale === "az" ? featuredRegion.snapshotNoteAz : featuredRegion.snapshotNoteEn}
              </span>
              <button
                type="button"
                className="sf-btn sf-btn-primary sf-btn-sm"
                onClick={() => handleRegionInspect(featuredRegion.id, "/field")}
              >
                {!user && <Lock size={13} aria-hidden="true" />}
                <span>{t.landing.openInDashboard}</span>
                <ArrowRight size={14} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="sf-media-showcase-card">
            <img
              src="/assets/orbital-farmland.png"
              alt={locale === "az" ? "Peyk müşahidəsi altında kənd təsərrüfatı sahəsi" : "Agricultural farmland under orbital satellite monitoring"}
              className="sf-media-showcase-img"
            />
            <div className="sf-media-showcase-overlay">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <span className="sf-badge sf-badge-cyan">
                  <Satellite size={12} aria-hidden="true" />
                  <span>{locale === "az" ? featuredRegion.nameAz : featuredRegion.nameEn}</span>
                </span>
                <span className="mono" style={{ fontSize: 11.5, color: "#cbd5e1" }}>
                  {featuredRegion.latitude.toFixed(2)}°N, {featuredRegion.longitude.toFixed(2)}°E
                </span>
              </div>
              <div style={{ fontSize: 14.5, fontWeight: 600 }}>
                {!isPrimaryFeatured && featuredDistrict
                  ? locale === "az"
                    ? `NASA POWER 2024: ${featuredDistrict.meanTempC.toFixed(1)} °C · ${featuredDistrict.annualRainMm.toFixed(1)} mm · SRTM ${featuredDistrict.elevationM.toFixed(0)} m · pH ${featuredDistrict.defaultPh.toFixed(1)}`
                    : `NASA POWER 2024: ${featuredDistrict.meanTempC.toFixed(1)} °C · ${featuredDistrict.annualRainMm.toFixed(1)} mm · SRTM ${featuredDistrict.elevationM.toFixed(0)} m · pH ${featuredDistrict.defaultPh.toFixed(1)}`
                  : locale === "az"
                    ? `Lab Hesabat: ${featuredRegion.soilSourceRef} · N ${featuredRegion.labMetrics.nitrogenMgKg} / P ${featuredRegion.labMetrics.phosphorusMgKg} / K ${featuredRegion.labMetrics.potassiumMgKg} mq/kq`
                    : `Lab Report: ${featuredRegion.soilSourceRef} · N ${featuredRegion.labMetrics.nitrogenMgKg} / P ${featuredRegion.labMetrics.phosphorusMgKg} / K ${featuredRegion.labMetrics.potassiumMgKg} mg/kg`}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: #workflow — Clean 4-Step Animated Farmer Flow */}
      <section id="workflow" className="sf-container sf-onepage-section sf-reveal" data-sf-reveal>
        <div className="sf-section-head">
          <span className="sf-eyebrow">{t.landing.workflowEyebrow}</span>
          <h2 className="sf-page-title">{t.landing.workflowTitle}</h2>
          <p className="sf-subtitle">{t.landing.workflowSubtitle}</p>
        </div>

        <div className="sf-workflow-grid">
          {t.landing.steps.map((step) => (
            <article key={step.num} className="sf-workflow-step-card">
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <span className="sf-workflow-num">{step.num}</span>
                  <span className="sf-badge sf-badge-violet" style={{ fontSize: 11 }}>
                    {step.badge}
                  </span>
                </div>
                <h3 style={{ fontSize: 16.5, margin: 0 }}>{step.title}</h3>
                <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-secondary)", lineHeight: 1.55 }}>
                  {step.desc}
                </p>
              </div>
              <div style={{ paddingTop: 10, borderTop: "1px dashed var(--border-default)" }}>
                <button
                  type="button"
                  className="sf-btn sf-btn-sm"
                  style={{ width: "100%", justifyContent: "space-between" }}
                  onClick={() => guardWorkspaceAccess(step.route)}
                >
                  <span>{locale === "az" ? "Bölməni aç" : "Open step"}</span>
                  {!user ? <Lock size={13} aria-hidden="true" /> : <ArrowRight size={13} aria-hidden="true" />}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Section 3: #telemetry — Satellite Above & Soil Lab Below (Dual Visual Pillars) */}
      <section id="telemetry" className="sf-container sf-onepage-section sf-reveal" data-sf-reveal>
        <div className="sf-section-head">
          <span className="sf-eyebrow">{t.landing.telemetryEyebrow}</span>
          <h2 className="sf-page-title">{t.landing.telemetryTitle}</h2>
          <p className="sf-subtitle">{t.landing.telemetrySubtitle}</p>
        </div>

        <div className="sf-grid-2">
          {/* Pillar A: Orbital Climate Imagery + 3 Simple Farmer Points */}
          <article className="sf-telemetry-pillar">
            <div className="sf-telemetry-banner">
              <img
                src="/assets/scenario-panorama.jpg"
                alt={locale === "az" ? "Peyk iqlim və yağıntı monitorinqi" : "Orbital climate and moisture monitoring panorama"}
              />
              <span className="sf-badge sf-badge-cyan sf-telemetry-banner-badge">
                <CloudSun size={13} aria-hidden="true" />
                <span>{t.landing.satelliteCardBadge}</span>
              </span>
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
              <div>
                <h3 style={{ fontSize: 18, margin: "0 0 6px" }}>{t.landing.satelliteCardTitle}</h3>
                <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-secondary)", lineHeight: 1.55 }}>
                  {t.landing.satelliteCardDesc}
                </p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {t.landing.satellitePoints.map((pt) => (
                  <div
                    key={pt.title}
                    style={{
                      padding: "10px 12px",
                      borderRadius: "var(--radius-sm)",
                      background: "var(--bg-deep)",
                      border: "1px solid var(--border-default)",
                    }}
                  >
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>
                      {pt.title}
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{pt.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </article>

          {/* Pillar B: Bespoke Soil Lab 3D Illustration + Real Lab Readouts */}
          <article className="sf-telemetry-pillar">
            <div className="sf-telemetry-banner">
              <img
                src="/assets/lab-soil-analysis.jpg"
                alt={locale === "az" ? "Laboratoriya torpaq pH və NPK kimyəvi analizi" : "Laboratory soil pH and NPK chemical analysis"}
              />
              <span className="sf-badge sf-badge-success sf-telemetry-banner-badge">
                <FlaskConical size={13} aria-hidden="true" />
                <span>{t.landing.labCardBadge}</span>
              </span>
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14, justifyContent: "space-between", flex: 1 }}>
              <div>
                <h3 style={{ fontSize: 18, margin: "0 0 6px" }}>{t.landing.labCardTitle}</h3>
                <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-secondary)", lineHeight: 1.55 }}>
                  {t.landing.labCardDesc}
                </p>
              </div>

              <div className="sf-lab-chip-grid">
                <div className="sf-lab-chip">
                  <span>{locale === "az" ? "Torpaq pH" : "Soil pH"}</span>
                  <strong>{featuredPrimaryLabRegion.ph.toFixed(1)}</strong>
                </div>
                <div className="sf-lab-chip">
                  <span>{locale === "az" ? "Humus" : "Organic Humus"}</span>
                  <strong>{featuredPrimaryLabRegion.labMetrics.organicMatterPct.toFixed(1)}%</strong>
                </div>
                <div className="sf-lab-chip">
                  <span>{locale === "az" ? "Duzluluq EC" : "Salinity EC"}</span>
                  <strong>{featuredPrimaryLabRegion.labMetrics.ecDsM.toFixed(2)} dS/m</strong>
                </div>
                <div className="sf-lab-chip">
                  <span>{locale === "az" ? "Azot (N)" : "Nitrogen (N)"}</span>
                  <strong>{featuredPrimaryLabRegion.labMetrics.nitrogenMgKg} mq/kq</strong>
                </div>
                <div className="sf-lab-chip">
                  <span>{locale === "az" ? "Fosfor (P₂O₅)" : "Phosphorus"}</span>
                  <strong>{featuredPrimaryLabRegion.labMetrics.phosphorusMgKg} mq/kq</strong>
                </div>
                <div className="sf-lab-chip">
                  <span>{locale === "az" ? "Kalium (K₂O)" : "Potassium"}</span>
                  <strong>{featuredPrimaryLabRegion.labMetrics.potassiumMgKg} mq/kq</strong>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="sf-btn sf-btn-sm sf-btn-primary"
                  onClick={() => guardWorkspaceAccess("/field")}
                >
                  <span>{locale === "az" ? "Öz Lab Analizimi Daxil Et" : "Enter My Soil Lab Report"}</span>
                  <ArrowRight size={14} aria-hidden="true" />
                </button>
              </div>
            </div>
          </article>
        </div>
      </section>

      {/* Section 4: #solutions — Interactive Capabilities Switcher & Crops Strip */}
      <section id="solutions" className="sf-container sf-onepage-section sf-reveal" data-sf-reveal>
        <div className="sf-section-head">
          <span className="sf-eyebrow">{t.landing.solutionsEyebrow}</span>
          <h2 className="sf-page-title">{t.landing.solutionsTitle}</h2>
          <p className="sf-subtitle">{t.landing.solutionsSubtitle}</p>
        </div>

        <div className="sf-solution-tabs-bar" role="tablist" aria-label={t.landing.solutionsTitle}>
          {t.landing.solutionTabs.map((tab) => {
            const active = tab.id === activeSolution?.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={`sf-solution-tab-btn ${active ? "is-active" : ""}`}
                onClick={() => setActiveSolutionId(tab.id)}
              >
                {renderSolutionIcon(tab.id)}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {activeSolution && (
          <div key={activeSolution.id} className="sf-solution-stage" role="tabpanel">
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <span className="sf-badge sf-badge-violet" style={{ alignSelf: "flex-start" }}>
                {activeSolution.metricLabel}: {activeSolution.metricValue}
              </span>
              <h3 style={{ fontSize: 22, margin: 0 }}>{activeSolution.title}</h3>
              <p style={{ margin: 0, fontSize: 14.5, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                {activeSolution.summary}
              </p>
              <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
                {activeSolution.bullets.map((bullet) => (
                  <li key={bullet} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13.5 }}>
                    <CheckCircle2 size={16} style={{ color: "#6ee7b7", marginTop: 2, flexShrink: 0 }} aria-hidden="true" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
              <div style={{ paddingTop: 4 }}>
                <button
                  type="button"
                  className="sf-btn sf-btn-primary"
                  onClick={() => guardWorkspaceAccess(activeSolution.route)}
                >
                  {!user && <Lock size={14} aria-hidden="true" />}
                  <span>{locale === "az" ? "Bu Modulu Aç" : "Open Module"}</span>
                  <ArrowRight size={15} aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Clean Visual Summary Card per Module */}
            <div
              className="sf-panel sf-panel-compact"
              style={{
                background: "var(--bg-deep)",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span className="sf-badge sf-badge-success">
                  <ShieldCheck size={12} aria-hidden="true" />
                  <span>{t.home.reasoningTitle}</span>
                </span>
                <span className="mono" style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                  pH {featuredRegion.ph.toFixed(1)}
                </span>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{t.home.reasoningPlanTitle}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span className="sf-badge sf-badge-cyan">
                  <CropIcon cropId="chickpea" size={14} />
                  <span>1. {locale === "az" ? "Noxud" : "Chickpea"}</span>
                </span>
                <ArrowRight size={13} style={{ color: "var(--text-muted)" }} aria-hidden="true" />
                <span className="sf-badge sf-badge-violet">
                  <CropIcon cropId="barley" size={14} />
                  <span>2. {locale === "az" ? "Arpa" : "Barley"}</span>
                </span>
                <ArrowRight size={13} style={{ color: "var(--text-muted)" }} aria-hidden="true" />
                <span className="sf-badge sf-badge-success">
                  <CropIcon cropId="lentil" size={14} />
                  <span>3. {locale === "az" ? "Mərci" : "Lentil"}</span>
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.55 }}>
                {t.home.reasoningPlanNote}
              </p>
            </div>
          </div>
        )}

        {/* Six Cataloged Crops Quick Bar */}
        <div className="sf-panel" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <h3 className="sf-section-title" style={{ margin: 0 }}>{t.landing.cropsHeading}</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
            {LANDING_CROPS.map((crop) => (
              <div
                key={crop.id}
                style={{
                  padding: "10px 12px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-default)",
                  background: "var(--bg-deep)",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <CropIcon cropId={crop.id} size={20} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>
                    {locale === "az" ? crop.nameAz : crop.nameEn}
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                    {locale === "az" ? crop.tagAz : crop.tagEn}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 5: #insights — Clean FAQ Accordion + Get Started CTA */}
      <section id="insights" className="sf-container sf-onepage-section sf-reveal" data-sf-reveal>
        <div className="sf-section-head">
          <span className="sf-eyebrow">{t.landing.insightsEyebrow}</span>
          <h2 className="sf-page-title">{t.landing.insightsTitle}</h2>
          <p className="sf-subtitle">{t.landing.insightsSubtitle}</p>
        </div>

        <div className="sf-faq-list">
          {t.landing.faqs.map((faq, idx) => {
            const isOpen = openFaqIdx === idx;
            return (
              <div key={faq.q} className={`sf-faq-item ${isOpen ? "is-open" : ""}`}>
                <button
                  type="button"
                  className="sf-faq-trigger"
                  aria-expanded={isOpen}
                  onClick={() => setOpenFaqIdx(isOpen ? -1 : idx)}
                >
                  <span>{faq.q}</span>
                  <ChevronDown size={18} className="sf-faq-chevron" aria-hidden="true" />
                </button>
                {isOpen && <div className="sf-faq-body">{faq.a}</div>}
              </div>
            );
          })}
        </div>

        <div className="sf-cta-banner">
          <div style={{ maxWidth: "60ch" }}>
            <h3 style={{ fontSize: 22, margin: "0 0 6px" }}>{t.home.finalCtaTitle}</h3>
            <p style={{ margin: 0, fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.55 }}>
              {user ? t.home.finalCtaBody : t.landing.ctaUnlockNote}
            </p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {user ? (
              <button
                type="button"
                className="sf-btn sf-btn-primary"
                onClick={() => navigate("/explore")}
              >
                <span>{t.nav.dashboard}</span>
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="sf-btn"
                  onClick={() => openAuthModal("login", null, "/explore")}
                >
                  <LogIn size={16} aria-hidden="true" />
                  <span>{t.landing.loginToContinue}</span>
                </button>
                <button
                  type="button"
                  className="sf-btn sf-btn-primary"
                  onClick={() => openAuthModal("register", null, "/explore")}
                >
                  <UserPlus size={16} aria-hidden="true" />
                  <span>{t.landing.registerToStart}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      <footer className="sf-footer">
        <div className="sf-footer-inner">
          <span style={{ maxWidth: "64ch" }}>{t.home.footerNote}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <button
              type="button"
              className="sf-btn sf-btn-sm"
              onClick={openMethodology}
            >
              <span>{t.actions.viewMethodology}</span>
            </button>
            <a
              href={REPO_GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              style={{ color: "var(--accent-soft)", fontWeight: 500 }}
            >
              {t.home.footerGithub}
            </a>
          </div>
        </div>
      </footer>
    </AppShell>
  );
}
