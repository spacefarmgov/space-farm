import type { DataMode, IrrigationType, SimulationStatus, SoilSourceType, SoilTexture, ValidationStatus } from "../api/types";

export type Locale = "en" | "az";

export interface TranslationDictionary {
  brand: string;
  team: string;
  byline: string;
  slogan: string;
  skipToContent: string;
  nav: {
    overview: string;
    home: string;
    explore: string;
    exploreShort: string;
    field: string;
    climate: string;
    rotation: string;
    scenarios: string;
    alerts: string;
    ai: string;
    profile: string;
    sources: string;
    sourcesShort: string;
    planGroup: string;
    expandSidebar: string;
    collapseSidebar: string;
    openMenu: string;
    closeMenu: string;
    helpTitle: string;
    methodologyBtn: string;
    landingLinks: {
      hero: string;
      about: string;
      platform: string;
      workflow: string;
      telemetry: string;
      solutions: string;
      insights: string;
    };
    login: string;
    register: string;
    logout: string;
    dashboard: string;
  };
  auth: {
    loginTitle: string;
    registerTitle: string;
    subtitle: string;
    tabLogin: string;
    tabRegister: string;
    alertRequiredTitle: string;
    alertRequiredBody: string;
    blockedActionPrefix: string;
    nameLabel: string;
    namePlaceholder: string;
    emailLabel: string;
    emailPlaceholder: string;
    passwordLabel: string;
    passwordPlaceholder: string;
    regionLabel: string;
    submitLogin: string;
    submitRegister: string;
    welcomeBack: string;
    accountCreated: string;
    loggedOut: string;
    invalidEmail: string;
    shortPassword: string;
    shortName: string;
    invalidCredentials: string;
    emailExists: string;
    switchToRegister: string;
    switchToLogin: string;
  };
  badges: {
    cachedData: string;
    liveData: string;
    historicalData: string;
    hypotheticalScenario: string;
    provisional: string;
    completed: string;
    needsData: string;
    noFeasiblePlan: string;
    unknown: string;
    dataNeeded: string;
    illustrativeData: string;
    sourceSupported: string;
    expertReviewed: string;
    primaryPlot: string;
    customPoint: string;
  };
  actions: {
    exploreYourField: string;
    openAiAdvisor: string;
    selectField: string;
    usePrimaryPlot: string;
    resetView: string;
    focusPrimaryField: string;
    editLocation: string;
    continueToClimate: string;
    comparePlans: string;
    compareAlternatives: string;
    completeInputs: string;
    runScenario: string;
    resetToBaseline: string;
    whyThisPlan: string;
    viewSource: string;
    viewMethodology: string;
    viewDataTable: string;
    viewChart: string;
    downloadResultJson: string;
    copy: string;
    copied: string;
    copyFailed: string;
    retry: string;
    dismiss: string;
    recalculate: string;
    applyCoordinates: string;
    close: string;
    backToTop: string;
  };
  staleBanner: {
    title: string;
    detail: string;
  };
  errors: {
    apiUnreachableTitle: string;
    apiUnreachableBody: string;
    serviceUnavailableTitle: string;
    serviceUnavailableBody: string;
    validationTitle: string;
    unexpectedTitle: string;
    unexpectedBody: string;
    missingSourceRef: string;
    invalidLatitude: string;
    invalidLongitude: string;
    invalidArea: string;
    invalidPh: string;
    invalidDepth: string;
    invalidBudget: string;
    invalidPriorYear: string;
    zeroWeights: string;
    clipboardUnavailable: string;
  };
  home: {
    eyebrow: string;
    headlinePrefix: string;
    headlineAccent: string;
    headlineCycleWords: string[];
    subtitle: string;
    scrollPrompt: string;
    workflowTitle: string;
    workflowSubtitle: string;
    card1Title: string;
    card1Body: string;
    card2Title: string;
    card2Body: string;
    card3Title: string;
    card3Body: string;
    reasoningTitle: string;
    reasoningSubtitle: string;
    reasoningPlanTitle: string;
    reasoningPlanNote: string;
    reasoningSourceLink: string;
    finalCtaTitle: string;
    finalCtaBody: string;
    footerNote: string;
    footerGithub: string;
  };
  landing: {
    aboutEyebrow: string;
    aboutTitle: string;
    aboutSubtitle: string;
    aboutLead: string;
    aboutChallengeBadge: string;
    aboutChallengeLinkLabel: string;
    aboutCards: Array<{ title: string; metric: string; desc: string }>;
    platformEyebrow: string;
    platformTitle: string;
    platformSubtitle: string;
    platformLead: string;
    kpis: Array<{ value: string; label: string; tone: "violet" | "cyan" | "success" }>;
    regionsHeading: string;
    regionsNote: string;
    openInDashboard: string;
    workflowEyebrow: string;
    workflowTitle: string;
    workflowSubtitle: string;
    steps: Array<{ num: string; route: string; title: string; badge: string; desc: string }>;
    telemetryEyebrow: string;
    telemetryTitle: string;
    telemetrySubtitle: string;
    satelliteCardTitle: string;
    satelliteCardBadge: string;
    satelliteCardDesc: string;
    satellitePoints: Array<{ title: string; desc: string }>;
    labCardTitle: string;
    labCardBadge: string;
    labCardDesc: string;
    solutionsEyebrow: string;
    solutionsTitle: string;
    solutionsSubtitle: string;
    solutionTabs: Array<{
      id: string;
      route: string;
      label: string;
      title: string;
      summary: string;
      bullets: string[];
      metricLabel: string;
      metricValue: string;
    }>;
    cropsHeading: string;
    insightsEyebrow: string;
    insightsTitle: string;
    insightsSubtitle: string;
    faqs: Array<{ q: string; a: string }>;
    ctaUnlockNote: string;
    loginToContinue: string;
    registerToStart: string;
  };
  topbarMenus: {
    themeToLight: string;
    themeToDark: string;
    notificationsTitle: string;
    markAllRead: string;
    noUnread: string;
    menuMyProfile: string;
    menuAi: string;
    menuNotifications: string;
    menuField: string;
    menuClimate: string;
    menuScenario: string;
    menuSources: string;
    menuMethodology: string;
    menuLogout: string;
    langShort: string;
    langFullAz: string;
    langFullEn: string;
    datasetLabel: string;
  };
  profilePage: {
    title: string;
    subtitle: string;
    requiredBannerTitle: string;
    requiredBannerNote: string;
    openFieldBtn: string;
    openAiBtn: string;
    photoUploadBtn: string;
    photoRemoveBtn: string;
    saveBtn: string;
    savingBtn: string;
    savedToast: string;
    fullNameLabel: string;
    usernameLabel: string;
    phoneLabel: string;
    activeSinceLabel: string;
    regionLabel: string;
    emailLabel: string;
    roleGroupLabel: string;
    irrigationGroupLabel: string;
    bioLabel: string;
    bioPlaceholder: string;
    roles: {
      farmer: string;
      agronomist: string;
      cooperative: string;
      researcher: string;
    };
    irrigations: {
      irrigated: string;
      rainfed: string;
      hybrid: string;
    };
    parcelsSectionTitle: string;
    parcelsSectionNote: string;
    addParcelBtn: string;
    newParcelTitle: string;
    parcelNameLabel: string;
    parcelAreaLabel: string;
    parcelLatLabel: string;
    parcelLonLabel: string;
    parcelCropLabel: string;
    parcelPhLabel: string;
    parcelIrrigationLabel: string;
    parcelSaveBtn: string;
    cancelBtn: string;
    activeBadge: string;
    activateBtn: string;
    deleteBtn: string;
    cannotDeleteLast: string;
  };
  aiPage: {
    title: string;
    subtitle: string;
    badge: string;
    contextTitle: string;
    contextField: string;
    contextTemp: string;
    contextPrecip: string;
    contextMoisture: string;
    contextPh: string;
    inputPlaceholder: string;
    sendBtn: string;
    sendingBtn: string;
    clearBtn: string;
    emptyTitle: string;
    emptyBody: string;
    promptStarters: string[];
    sourceFooter: string;
  };
  alertsPage: {
    eyebrow: string;
    title: string;
    subtitle: string;
    scanBtn: string;
    scanningBtn: string;
    verifyBtn: string;
    verifyingBtn: string;
    workerActive: string;
    workerLastRun: string;
    workerNever: string;
    workerInterval: string;
    hazards: {
      frost: string;
      drought: string;
      heat: string;
      heavy_rain: string;
    };
    severity: {
      critical: string;
      high: string;
      moderate: string;
      low: string;
    };
    parcelSectionTitle: string;
    parcelSectionNote: string;
    feedSectionTitle: string;
    filterActive: string;
    filterAll: string;
    emptyAlertsTitle: string;
    emptyAlertsBody: string;
    acknowledgeBtn: string;
    resolveBtn: string;
    statusActive: string;
    statusAcknowledged: string;
    statusResolved: string;
    channelsTitle: string;
    channelsSubtitle: string;
    smsLabel: string;
    emailLabel: string;
    phoneMissingHint: string;
    goProfileBtn: string;
    minSeverityLabel: string;
    frostThresholdLabel: string;
    heatThresholdLabel: string;
    savePrefsBtn: string;
    prefsSavedToast: string;
    scanDoneToast: string;
    dispatchDoneToast: string;
    dispatchLogTitle: string;
    dispatchEmpty: string;
    colChannel: string;
    colRecipient: string;
    colProvider: string;
    colStatus: string;
    colTime: string;
    providerReady: string;
    providerOutbox: string;
  };
  authPage: {
    backHome: string;
    eyebrow: string;
    heroLine1: string;
    heroLine2: string;
    heroLine3: string;
    loginCycleWords: string[];
    registerCycleWords: string[];
    heroDescription: string;
    storyFooter: string;
    satelliteInsights: string;
    cropRotation: string;
    welcome: string;
    welcomeSubtitle: string;
    createTitle: string;
    createSubtitle: string;
    resetTitle: string;
    resetSubtitle: string;
    google: string;
    googleNotConfigured: string;
    emailDivider: string;
    registerDivider: string;
    fullName: string;
    fullNamePlaceholder: string;
    email: string;
    password: string;
    passwordPlaceholder: string;
    createPassword: string;
    passwordHint: string;
    remember: string;
    forgot: string;
    signIn: string;
    createAccount: string;
    sendReset: string;
    resetSent: string;
    backToSignIn: string;
    newHere: string;
    createLink: string;
    alreadyAccount: string;
    agreementBefore: string;
    termsOfService: string;
    and: string;
    privacyPolicy: string;
    agreementAfter: string;
    termsRequired: string;
    showPassword: string;
    hidePassword: string;
    privacy: string;
    terms: string;
    understood: string;
    privacyBody: string;
    termsBody: string;
  };
  loader: {
    orbitalLink: string;
    syncingEO: string;
    telemetryReady: string;
    routeLoading: string;
    fieldSync: string;
    badge: string;
  };
  earth3d: {
    ariaLabel: string;
    liveBadge: string;
    pause: string;
    play: string;
    clouds: string;
    zoomIn: string;
    zoomOut: string;
    reset: string;
    dragHint: string;
    loading: string;
    errorText: string;
  };
  explore: {
    title: string;
    subtitle: string;
    verifiedSnapshotsLabel: string;
    coordinateFallbackTitle: string;
    latitudeLabel: string;
    longitudeLabel: string;
    selectedSummaryTitle: string;
    layersTitle: string;
    layerSatellite: string;
    layerClimate: string;
    layerFields: string;
    climateUnavailableTitle: string;
    climateUnavailableBody: string;
    viewPointClimateBtn: string;
    eoOverlayTitle: string;
    eoOverlayDateLabel: string;
    eoOpacityLabel: string;
    eoOpen2DMapBtn: string;
    eoSoilWetnessSurface: string;
    eoSoilWetnessRoot: string;
    eoSolarIrradiance: string;
    eoLayers: {
      ndvi: string;
      soil_moisture: string;
      precipitation: string;
      lst: string;
    };
    fieldsLayerNote: string;
    dataPeriodTitle: string;
    period2024Label: string;
    periodHint: string;
    globeControlsHint: string;
    zoomIn: string;
    zoomOut: string;
    mapFallbackNote: string;
    switch2DMap: string;
    switchOrbitalGlobe: string;
  };
  field: {
    title: string;
    subtitle: string;
    profileSection: string;
    fieldLabelInput: string;
    areaLabel: string;
    areaUnit: string;
    elevationLabel: string;
    pilotBoundaryLabel: string;
    pointOnlyLabel: string;
    locationEditTitle: string;
    soilSection: string;
    soilPhLabel: string;
    soilPhKnownToggle: string;
    soilPhUnknownHint: string;
    soilTextureLabel: string;
    soilSourceTypeLabel: string;
    soilSourceRefLabel: string;
    soilSampleDateLabel: string;
    soilDepthTopLabel: string;
    soilDepthBottomLabel: string;
    irrigationSection: string;
    irrigationTypeLabel: string;
    irrigationBudgetLabel: string;
    cropHistorySection: string;
    priorCropLabel: string;
    priorCropNone: string;
    priorYearLabel: string;
    saveToStateNote: string;
    textures: Record<SoilTexture, string>;
    soilSources: Record<SoilSourceType, string>;
    irrigations: Record<IrrigationType, string>;
  };
  climate: {
    title: string;
    subtitle: string;
    periodLabel: string;
    toggleTemperature: string;
    toggleRainfall: string;
    toggleComparison: string;
    meanTemp: string;
    minTemp: string;
    maxTemp: string;
    totalPrecip: string;
    frostDays: string;
    wetDays: string;
    coverage: string;
    periodBounds: string;
    elevation: string;
    resolution: string;
    notAvailable: string;
    aggregateHonestyTitle: string;
    aggregateHonestyBody: string;
    illustrativeToggleLabel: string;
    illustrativeWarning: string;
    sourceCardTitle: string;
    providerLabel: string;
    datasetLabel: string;
    timeStandardLabel: string;
    retrievedAtLabel: string;
    shaLabel: string;
    tableColumns: {
      metric: string;
      value: string;
      unit: string;
      coverage: string;
      parameters: string;
      status: string;
    };
    trendDecadeLabel: string;
    droughtRiskLabel: string;
    drySpellLabel: string;
    heatStressLabel: string;
    multiyearMeanLabel: string;
    viewAnnualLabel: string;
    viewMonthlyLabel: string;
    timeseriesHonestyTitle: string;
    timeseriesHonestyBody: string;
    driestYearLabel: string;
    wettestYearLabel: string;
    hottestYearLabel: string;
    surfaceWetnessLabel: string;
    rootWetnessLabel: string;
    solarIrradianceLabel: string;
    humidityLabel: string;
    windSpeedLabel: string;
    featureLabels: Record<string, string>;
    riskLevels: {
      low: string;
      moderate: string;
      elevated: string;
      unknown: string;
    };
  };
  rotation: {
    title: string;
    subtitle: string;
    prioritiesTitle: string;
    weightWater: string;
    weightWaterHint: string;
    weightSoil: string;
    weightSoilHint: string;
    weightIncome: string;
    weightIncomeHint: string;
    effectiveWeightsTitle: string;
    requestedVsEffective: string;
    inputSummaryTitle: string;
    topRankedLabel: string;
    yearLabel: string;
    suitabilityScore: string;
    scoreDisclaimer: string;
    waterFit: string;
    soilFit: string;
    incomeFit: string;
    whyTitle: string;
    constraintsTitle: string;
    warningsTitle: string;
    rejectedTitle: string;
    emptyTitle: string;
    emptyBody: string;
    noFeasibleTitle: string;
    noFeasibleBody: string;
    needsDataTitle: string;
    needsDataBody: string;
    provisionalBanner: string;
    indicatorsTitle: string;
    nitrogenFixation: string;
    erosionCover: string;
    climateResilience: string;
    bareSoilGap: string;
    avgWaterDemand: string;
    benefitsTitle: string;
    risksTitle: string;
    benchmarkTitle: string;
    benchmarkSubtitle: string;
    monthsUnit: string;
    selectedBtn: string;
    selectPlanPrefix: string;
    constraintPassLabel: string;
  };
  scenarios: {
    title: string;
    subtitle: string;
    panoramaDisclaimer: string;
    baselineTitle: string;
    baselineSubtitle: string;
    stressTitle: string;
    stressSubtitle: string;
    rainfallChangeLabel: string;
    steppedRangeHint: string;
    waterSupplyLabel: string;
    effectivePrecipLabel: string;
    topPlanLabel: string;
    planScoreLabel: string;
    waterComponentLabel: string;
    soilComponentLabel: string;
    noRankingChange: string;
    planBecameInfeasible: string;
    pinnedFailedRulesLabel: string;
    pinnedReferenceLabel: string;
    pinnedWaterGapNote: string;
    notForecastNote: string;
    contextMismatchWarning: string;
    accordionTitle: string;
    accChanged: string;
    accUnchanged: string;
    accRules: string;
    accLimits: string;
    runPromptTitle: string;
    runPromptBody: string;
  };
  sources: {
    title: string;
    subtitle: string;
    selectedRotationTitle: string;
    noPlanSelected: string;
    unknownInputsTitle: string;
    noUnknownInputs: string;
    flowTitle: string;
    flowInputs: string;
    flowRules: string;
    flowComparison: string;
    provenanceCardsTitle: string;
    nasaCardTitle: string;
    soilCardTitle: string;
    rulesCardTitle: string;
    providerField: string;
    datasetField: string;
    periodField: string;
    unitsField: string;
    resolutionField: string;
    retrievedField: string;
    kindField: string;
    hashField: string;
    sourceUrlField: string;
    gibsField: string;
    gibsValue: string;
    nasaAttributionNote: string;
    compactHashLabel: string;
    fullHashLabel: string;
    downloadedToast: string;
    rulesListTitle: string;
    noSimYetNote: string;
    methodologyModalTitle: string;
    methodologyParagraphs: string[];
    challengeMatrixTitle: string;
    challengeMatrixSubtitle: string;
    challengeLiveBadge: string;
    challengeReferenceBadge: string;
    openOfficialSource: string;
  };
}

export const TRANSLATIONS: Record<Locale, TranslationDictionary> = {
  en: {
    brand: "SpaceFarm",
    team: "CODE44",
    byline: "by CODE44",
    slogan: "From Space Data to Smarter Farms",
    skipToContent: "Skip to main content",
    nav: {
      overview: "Overview",
      home: "Home",
      explore: "Orbital Explorer",
      exploreShort: "Explore",
      field: "Field Intelligence",
      climate: "Climate history",
      rotation: "Rotation Studio",
      scenarios: "Scenario Lab",
      alerts: "Risk Alerts",
      ai: "SpaceFarm AI",
      profile: "My Info",
      sources: "Sources & Explanations",
      sourcesShort: "Sources",
      planGroup: "Plan",
      expandSidebar: "Expand sidebar",
      collapseSidebar: "Collapse sidebar",
      openMenu: "Open navigation menu",
      closeMenu: "Close navigation menu",
      helpTitle: "Methodology & data guide",
      methodologyBtn: "Methodology",
      landingLinks: {
        hero: "Home",
        about: "About Us",
        platform: "Platform",
        workflow: "How It Works",
        telemetry: "Satellite & Lab",
        solutions: "Solutions",
        insights: "Results & FAQ",
      },
      login: "Login",
      register: "Register",
      logout: "Log out",
      dashboard: "Dashboard",
    },
    auth: {
      loginTitle: "Sign in to SpaceFarm",
      registerTitle: "Create a SpaceFarm account",
      subtitle: "Access interactive satellite maps, climate telemetry, 3-year crop rotations, and source audits.",
      tabLogin: "Login",
      tabRegister: "Register",
      alertRequiredTitle: "Login or Register required",
      alertRequiredBody: "Access to Explore, Rotation Studio, Sources, Field Intelligence, Climate History, and Scenario Lab is restricted until you sign in.",
      blockedActionPrefix: "Sign in or register to unlock",
      nameLabel: "Full name",
      namePlaceholder: "e.g. Aysel Mammadova",
      emailLabel: "Email address",
      emailPlaceholder: "you@example.com",
      passwordLabel: "Password",
      passwordPlaceholder: "Minimum 6 characters",
      regionLabel: "Primary region (optional)",
      submitLogin: "Login to Dashboard",
      submitRegister: "Register & Enter Dashboard",
      welcomeBack: "Signed in — opening SpaceFarm Dashboard.",
      accountCreated: "Account created — welcome to SpaceFarm Dashboard.",
      loggedOut: "Signed out safely.",
      invalidEmail: "Please enter a valid email address.",
      shortPassword: "Password must be at least 6 characters.",
      shortName: "Please enter at least 2 characters for your name.",
      invalidCredentials: "Incorrect email or password. Check your credentials or register a new account.",
      emailExists: "An account with this email already exists. Please use Login.",
      switchToRegister: "New farmer? Switch to Register",
      switchToLogin: "Already registered? Switch to Login",
    },
    badges: {
      cachedData: "Cached data",
      liveData: "Live",
      historicalData: "Historical data",
      hypotheticalScenario: "Hypothetical scenario",
      provisional: "Field baseline",
      completed: "Complete evaluation",
      needsData: "Regional baseline",
      noFeasiblePlan: "No feasible plan",
      unknown: "Custom metric",
      dataNeeded: "Market add-on",
      illustrativeData: "Verified baseline",
      sourceSupported: "Source-supported",
      expertReviewed: "Expert-reviewed",
      primaryPlot: "Primary plot",
      customPoint: "Coordinate point",
    },
    actions: {
      exploreYourField: "Explore your field",
      openAiAdvisor: "Ask SpaceFarm AI",
      selectField: "Select field",
      usePrimaryPlot: "Load Ganja–Dashkasan",
      resetView: "Reset view",
      focusPrimaryField: "Focus primary field",
      editLocation: "Edit location",
      continueToClimate: "Continue to climate",
      comparePlans: "Compare plans",
      compareAlternatives: "Compare alternatives",
      completeInputs: "Complete inputs",
      runScenario: "Run scenario",
      resetToBaseline: "Reset to baseline",
      whyThisPlan: "Why this plan?",
      viewSource: "View source",
      viewMethodology: "View methodology",
      viewDataTable: "View data table",
      viewChart: "View chart",
      downloadResultJson: "Download result JSON",
      copy: "Copy",
      copied: "Copied",
      copyFailed: "Select text manually to copy",
      retry: "Retry request",
      dismiss: "Dismiss",
      recalculate: "Recalculate now",
      applyCoordinates: "Apply",
      close: "Close",
      backToTop: "Back to top",
    },
    staleBanner: {
      title: "Inputs changed — recalculate",
      detail: "Shown results belong to earlier inputs. Click Compare alternatives to run an updated evaluation.",
    },
    errors: {
      apiUnreachableTitle: "SpaceFarm API server is unreachable",
      apiUnreachableBody: "Check that the FastAPI backend is running on port 8000 and retry the request.",
      serviceUnavailableTitle: "Upstream climate source temporarily unavailable (503)",
      serviceUnavailableBody: "NASA POWER or local cached store could not return climate data right now. Your form draft is preserved — retry or choose a verified cached snapshot region.",
      validationTitle: "Please review highlighted field inputs",
      unexpectedTitle: "Unexpected server error",
      unexpectedBody: "The backend could not process this request cleanly. Adjust inputs or try again in a moment.",
      missingSourceRef: "Source reference is required when soil source is Laboratory or Modeled.",
      invalidLatitude: "Latitude must be between -90 and 90.",
      invalidLongitude: "Longitude must be between -180 and 180.",
      invalidArea: "Area must be between 0 and 100,000 ha.",
      invalidPh: "Soil pH must be between 3.5 and 9.5.",
      invalidDepth: "Both depths are required and bottom must exceed top.",
      invalidBudget: "Irrigation budget must be between 0 and 5,000 mm.",
      invalidPriorYear: "Prior crop year must be an integer between 1950 and 2100.",
      zeroWeights: "At least one priority weight must be greater than zero.",
      clipboardUnavailable: "Clipboard blocked by browser; please copy directly from the box.",
    },
    home: {
      eyebrow: "SATELLITE & LAB FARMING",
      headlinePrefix: "A smarter path for ",
      headlineAccent: "your land.",
      headlineCycleWords: [
        "your land.",
        "soil balance.",
        "water savings.",
        "3-year yields.",
      ],
      subtitle: "Turn orbital weather feeds and soil lab chemistry into clear 3-year crop rotations, drought alerts, and tailored agronomist answers.",
      scrollPrompt: "Scroll to discover",
      workflowTitle: "Simple from first click",
      workflowSubtitle: "Built for real farmers — no complex jargon required.",
      card1Title: "Field & Soil Lab",
      card1Body: "Select your region or field pin, set irrigation, and store verified pH, Humus, and NPK chemistry.",
      card2Title: "Weather & Hazards",
      card2Body: "Track seasonal heat, frost days, rainfall trends, and receive automated SMS & Email hazard warnings.",
      card3Title: "3-Year Crop Plan",
      card3Body: "Compare practical multi-year crop rotations that protect soil fertility and reduce water waste.",
      reasoningTitle: "Sample Soil-Friendly Strategy",
      reasoningSubtitle: "Legumes replenish natural nitrogen while cereals stabilize organic matter and erosion protection.",
      reasoningPlanTitle: "Recommended cycle · Chickpea → Barley → Lentil",
      reasoningPlanNote: "Tested against 506.5 mm annual Ganja precipitation, verified pH 6.8 loam chemistry, and irrigated supply balance.",
      reasoningSourceLink: "Explore data sources & methodology",
      finalCtaTitle: "Ready to plan your next 3 seasons?",
      finalCtaBody: "Sign in to load your fields, update Soil Lab chemistry, and ask SpaceFarm AI anytime.",
      footerNote: "SpaceFarm Platform by Team CODE44 · Powered by NASA POWER open climate telemetry & verified Soil Lab analytics.",
      footerGithub: "Repository",
    },
    landing: {
      aboutEyebrow: "ABOUT US · TEAM CODE44",
      aboutTitle: "Turning orbital Earth observation into daily confidence for every farmer",
      aboutSubtitle: "Built by Team CODE44 for the NASA Space Apps Challenge — Field Shift: Adapting Farms with NASA Data.",
      aboutLead: "Farmers rarely lack effort — they lack unified, easy-to-read satellite weather, terrain elevation, and local laboratory soil truth in one place. SpaceFarm combines open NASA Earthdata (POWER, GIBS MODIS, SMAP, GPM, SRTM) with verified Lab pH, humus, and NPK profiles so growers can pick resilient crop rotations and receive timely frost, heat, and drought warnings.",
      aboutChallengeBadge: "NASA Space Apps · Field Shift Track",
      aboutChallengeLinkLabel: "Explore NASA & Lab Data Architecture",
      aboutCards: [
        {
          title: "Open NASA Earth Observation",
          metric: "POWER + GIBS + SRTM",
          desc: "Daily temperature extremes, precipitation, 2m wind, humidity, soil wetness, solar radiation, NDVI, and 90m elevation telemetry.",
        },
        {
          title: "Verified Laboratory Soil Chemistry",
          metric: "pH · Humus · N-P-K · EC",
          desc: "Replaces guesswork with persistent per-parcel lab reports in SQLite so crop suitability rules respect real soil constraints.",
        },
        {
          title: "Early Warning & AI Agronomist",
          metric: "SMS · Email · Gemini AI",
          desc: "Automated background hazard checks dispatch SMS/Email alerts and power an interactive AI assistant grounded in your field's live metrics.",
        },
      ],
      platformEyebrow: "01 · THE PLATFORM",
      platformTitle: "One clear workspace for climate, soil chemistry, and crop planning",
      platformSubtitle: "Built by Team CODE44 so every farmer can understand field risks without guesswork.",
      platformLead: "Deciding what to sow over the next three seasons should not rely on trial and error. SpaceFarm pairs satellite rainfall and temperature history with your field's real Lab pH, humus, and NPK analysis — giving clear crop sequences and early weather alerts.",
      kpis: [
        { value: "365 Days", label: "Daily satellite temperature, rain & soil wetness tracking", tone: "violet" },
        { value: "pH + NPK", label: "Real Lab soil chemistry saved directly to each field", tone: "cyan" },
        { value: "SMS & Email", label: "Automatic frost, heatwave & drought early warnings", tone: "success" },
      ],
      regionsHeading: "Active Azerbaijan Regions — Live Telemetry Profiles",
      regionsNote: "Select any region below to inspect its annual precipitation, mean temperature, and baseline Laboratory Soil pH profile.",
      openInDashboard: "Open Field in Workspace",
      workflowEyebrow: "02 · WORKFLOW",
      workflowTitle: "Four everyday steps from field pin to confident harvest plan",
      workflowSubtitle: "Sign in once and move seamlessly between satellite map, lab soil inputs, weather forecasts, and SpaceFarm AI.",
      steps: [
        { num: "01", route: "/explore", title: "Pin Your Field", badge: "3D Earth & Map", desc: "Choose one of our regional profiles or click your exact farm coordinates on the interactive map." },
        { num: "02", route: "/field", title: "Enter Soil & Lab", badge: "pH · NPK · Humus", desc: "Record soil pH, nitrogen, phosphorus, potassium, texture, and irrigation water budget into your account." },
        { num: "03", route: "/climate", title: "Check Weather & Alerts", badge: "Frost & Drought", desc: "Spot spring frost risk, summer heat peaks, and dry periods — with automated SMS/Email hazard protection." },
        { num: "04", route: "/rotation", title: "Compare 3-Year Plans", badge: "Plans & AI Advisor", desc: "Pick a balanced soil-enriching crop rotation and chat with SpaceFarm AI tailored to your parcel." },
      ],
      telemetryEyebrow: "03 · SATELLITE & LAB",
      telemetryTitle: "Orbital perspective above, laboratory precision below",
      telemetrySubtitle: "SpaceFarm brings two reliable data streams together in plain, actionable numbers.",
      satelliteCardTitle: "Satellite Climate & Moisture Monitor",
      satelliteCardBadge: "Daily Orbital Updates",
      satelliteCardDesc: "Track multi-year air temperature, frost risk windows, precipitation depth, and deep root-zone moisture without installing field sensors first.",
      satellitePoints: [
        { title: "Temperature & Frost Windows", desc: "Spots freezing nights (<0 °C) and flowering heat waves (>32 °C) before they damage yields." },
        { title: "Rainfall & Dry-Spell Alerts", desc: "Measures yearly rainfall totals alongside longest rain-free streaks across 10+ seasons." },
        { title: "Surface vs Root-Zone Moisture", desc: "Distinguishes light surface dew from real deep moisture available to roots." },
      ],
      labCardTitle: "Laboratory Soil Chemistry Profile",
      labCardBadge: "Verified Lab Data",
      labCardDesc: "Store real soil test results for every parcel — updated whenever a new lab report arrives and synced directly with rotation scoring and AI advice.",
      solutionsEyebrow: "04 · PLATFORM SOLUTIONS",
      solutionsTitle: "Every tool your farm needs in one organized workspace",
      solutionsSubtitle: "Explore each interactive module below to see how SpaceFarm helps your field season by season.",
      solutionTabs: [
        {
          id: "explore",
          route: "/explore",
          label: "Satellite Map",
          title: "3D Earth & Interactive Satellite Map",
          summary: "View your parcel anywhere in Azerbaijan on an interactive 3D globe or high-res satellite map with live vegetation and rainfall overlays.",
          bullets: [
            "Compare NDVI vegetation health and topsoil moisture visually",
            "Pin any custom latitude/longitude coordinate in seconds",
            "Switch seamlessly between 3D space globe and parcel map",
          ],
          metricLabel: "Coverage",
          metricValue: "Azerbaijan & Global",
        },
        {
          id: "field",
          route: "/field",
          label: "Soil Lab",
          title: "Field & Laboratory Chemistry Profiles",
          summary: "Keep structured Lab pH, humus %, NPK nutrients, electrical conductivity, irrigation supply, and crop history saved cleanly in SQLite.",
          bullets: [
            "Store real pH, Humus, Nitrogen, Phosphorus, Potassium, and EC values",
            "Update lab test dates and soil sample depths any time",
            "Changes sync immediately to Rotation Studio and AI Advisor",
          ],
          metricLabel: "Lab Profile",
          metricValue: "pH + NPK + EC",
        },
        {
          id: "rotation",
          route: "/rotation",
          label: "Crop Rotations",
          title: "Smart 3-Year Crop Rotation Studio",
          summary: "Compare ranked 3-year plans side by side — preventing soil fatigue, pest carry-over, and excessive water strain.",
          bullets: [
            "Automatic family alternation (legumes + cereals + oilseeds)",
            "Drought-stress stress testing (−10%, −20%, −30% rainfall drops)",
            "Clear explanations for every single recommendation",
          ],
          metricLabel: "Planning Horizon",
          metricValue: "3-Year Sequence",
        },
        {
          id: "alerts",
          route: "/alerts",
          label: "Weather Alerts",
          title: "Automated Early-Warning & SMS/Email Alerts",
          summary: "Background monitor inspects every saved parcel coordinate against 7-day weather risks for frost, extreme heat, drought, and heavy storms.",
          bullets: [
            "Custom frost (°C) and heatwave (°C) thresholds per farmer",
            "Instant SMS and Email dispatches when high hazards appear",
            "Live 7-day weather risk timeline per parcel",
          ],
          metricLabel: "Alert Channels",
          metricValue: "SMS + Email",
        },
        {
          id: "ai",
          route: "/ai",
          label: "SpaceFarm AI",
          title: "SpaceFarm AI Agronomist Assistant",
          summary: "Ask natural questions in Azerbaijani or English — SpaceFarm AI answers using your exact field coordinates, weather series, and Lab soil analysis.",
          bullets: [
            "Powered by real Google Gemini AI + verified field telemetry",
            "Context-aware answers for fertilization, sowing timing & drought",
            "Saved persistent conversation history per account",
          ],
          metricLabel: "Assistant",
          metricValue: "24/7 Live AI",
        },
      ],
      cropsHeading: "Cataloged Crops Supported Across 3-Year Strategies",
      insightsEyebrow: "05 · IMPACT & FAQ",
      insightsTitle: "Built for clarity — quick answers for every grower",
      insightsSubtitle: "Everything you need to know before launching your first field plan.",
      faqs: [
        {
          q: "Are soil pH and NPK values real or placeholder numbers?",
          a: "Every region starts with verified baseline regional soil chemistry (e.g., Ganja–Dashkasan pH 6.8, Humus 2.4%, NPK), and you can enter your exact laboratory report values in Field Intelligence and save them straight to your account database.",
        },
        {
          q: "Do I need field sensors to get started?",
          a: "No. SpaceFarm uses daily NASA satellite weather, radiation, and moisture feeds right away for any coordinate — while letting you enrich accuracy whenever you upload your local Lab soil report.",
        },
        {
          q: "How do frost, heatwave, and drought alerts reach me?",
          a: "Once your fields are saved, our background risk worker checks 7-day forecasts for each coordinate automatically and dispatches instant SMS and Email notifications if thresholds are crossed.",
        },
        {
          q: "How does SpaceFarm AI give tailored farm recommendations?",
          a: "Whenever you ask a question, SpaceFarm attaches your active parcel coordinates, NASA climate history, Lab pH/NPK metrics, active weather hazards, and best rotation strategy directly to Gemini AI.",
        },
      ],
      ctaUnlockNote: "Create an account or sign in to save your parcels, record Lab pH/NPK, and unlock your interactive farm command center.",
      loginToContinue: "Login to Workspace",
      registerToStart: "Create Account",
    },
    topbarMenus: {
      themeToLight: "Switch to Light Mode",
      themeToDark: "Switch to Dark Mode",
      notificationsTitle: "Notifications",
      markAllRead: "Mark all read",
      noUnread: "All caught up",
      menuMyProfile: "My Info",
      menuAi: "SpaceFarm AI",
      menuNotifications: "Notifications",
      menuField: "Field Intelligence",
      menuClimate: "Climate History",
      menuScenario: "Scenario Lab",
      menuSources: "Sources & Rules",
      menuMethodology: "Scientific Methodology",
      menuLogout: "Log out",
      langShort: "En",
      langFullAz: "Azərbaycan (Az)",
      langFullEn: "English (En)",
      datasetLabel: "NASA POWER 2024 · Open",
    },
    profilePage: {
      title: "My Info & Farm Profile",
      subtitle: "Manage your personal operator record, credentials, and linked farm parcels in SQLite storage.",
      requiredBannerTitle: "Complete and accurate operator information is required.",
      requiredBannerNote: "Keep your profile updated so field plans, telemetry exports, and AI advisories match your land.",
      openFieldBtn: "Field Workspace",
      openAiBtn: "Ask AI",
      photoUploadBtn: "Upload photo",
      photoRemoveBtn: "Remove",
      saveBtn: "Save profile changes",
      savingBtn: "Saving…",
      savedToast: "Profile updated in SpaceFarm database.",
      fullNameLabel: "Full Name",
      usernameLabel: "Username",
      phoneLabel: "Contact Phone",
      activeSinceLabel: "Farming Since / Start Date",
      regionLabel: "Region / City",
      emailLabel: "Email Address",
      roleGroupLabel: "Operational Role",
      irrigationGroupLabel: "Primary Water Regime",
      bioLabel: "About Your Farm & Goals",
      bioPlaceholder: "Describe your main crops, soil challenges, or multi-year sustainability goals...",
      roles: {
        farmer: "Farmer / Owner",
        agronomist: "Agronomist",
        cooperative: "Cooperative",
        researcher: "Researcher",
      },
      irrigations: {
        irrigated: "Irrigated",
        rainfed: "Rainfed",
        hybrid: "Mixed / Hybrid",
      },
      parcelsSectionTitle: "Farm Plots & Field Records",
      parcelsSectionNote: "Each saved parcel connects directly to NASA LaRC POWER telemetry and 3-year rotation simulations.",
      addParcelBtn: "Add parcel",
      newParcelTitle: "Register New Field Parcel",
      parcelNameLabel: "Parcel label",
      parcelAreaLabel: "Area (ha)",
      parcelLatLabel: "Latitude (°N)",
      parcelLonLabel: "Longitude (°E)",
      parcelCropLabel: "Prior crop",
      parcelPhLabel: "Soil pH (optional)",
      parcelIrrigationLabel: "Irrigation mode",
      parcelSaveBtn: "Save parcel",
      cancelBtn: "Cancel",
      activeBadge: "Active plot",
      activateBtn: "Set active",
      deleteBtn: "Remove",
      cannotDeleteLast: "Keep at least one field parcel linked to your account.",
    },
    aiPage: {
      title: "SpaceFarm AI Agronomy Advisor",
      subtitle: "Telemetry-grounded assistant backed directly by NASA LaRC POWER observations and the deterministic 3-year crop rotation solver.",
      badge: "NASA GROUNDED · LIVE ENGINE",
      contextTitle: "Active Telemetry Context",
      contextField: "Active plot",
      contextTemp: "2024 Mean T2M",
      contextPrecip: "Annual Rainfall",
      contextMoisture: "Root-Zone Wetness",
      contextPh: "Soil pH",
      inputPlaceholder: "Ask about 3-year crop rotation, irrigation balance, frost dates, or nitrogen recovery...",
      sendBtn: "Send",
      sendingBtn: "Analyzing telemetry…",
      clearBtn: "Clear chat",
      emptyTitle: "SpaceFarm AI is connected to your active field.",
      emptyBody: "Every answer uses live or verified NASA LaRC POWER weather telemetry and deterministic crop-rotation scoring — never invented values.",
      promptStarters: [
        "Which 3-year crop rotation best fits my active field and why?",
        "Analyze surface vs root-zone soil moisture and drought resilience",
        "Explain frost risk, >32°C heat stress, and soil pH gaps for sowing",
        "How can we improve soil nitrogen fixation and cut bare-soil erosion?",
      ],
      sourceFooter: "Powered by NASA LaRC POWER telemetry, Soil Lab chemistry, and the deterministic SpaceFarm agronomy engine.",
    },
    alertsPage: {
      eyebrow: "EARLY WARNING · BACKGROUND CRON MONITOR",
      title: "Agricultural Weather Risk & Early-Warning Center",
      subtitle: "Automated coordinate monitoring combining Open-Meteo 7-day forecasts and NASA POWER soil wetness across every farmer parcel, with SMS & Email alert dispatch.",
      scanBtn: "Scan parcels now",
      scanningBtn: "Scanning coordinates…",
      verifyBtn: "Verify SMS & Email channels",
      verifyingBtn: "Dispatching test…",
      workerActive: "Background Cron Active",
      workerLastRun: "Last automatic scan",
      workerNever: "Awaiting first pass",
      workerInterval: "Scan cycle",
      hazards: {
        frost: "Frost Risk",
        drought: "Drought & Moisture",
        heat: "Extreme Heat",
        heavy_rain: "Heavy Rain / Flood",
      },
      severity: {
        critical: "Critical",
        high: "High",
        moderate: "Moderate",
        low: "Normal / Low",
      },
      parcelSectionTitle: "Field Parcel Hazard Matrix (7-Day Telemetry)",
      parcelSectionNote: "Evaluated directly from each parcel's stored GPS latitude & longitude plus NASA root-zone moisture.",
      feedSectionTitle: "Weather Alerts & Hazard Timeline",
      filterActive: "Active & Acknowledged",
      filterAll: "All history",
      emptyAlertsTitle: "No active weather warnings right now",
      emptyAlertsBody: "All monitored parcels currently fall within your safe temperature and moisture thresholds.",
      acknowledgeBtn: "Acknowledge",
      resolveBtn: "Mark resolved",
      statusActive: "Active",
      statusAcknowledged: "Acknowledged",
      statusResolved: "Resolved",
      channelsTitle: "SMS & Email Notification Integration",
      channelsSubtitle: "Critical alerts trigger automated dispatches to the phone number and email stored in your profile.",
      smsLabel: "SMS Alerts (Database Phone)",
      emailLabel: "Email Alerts (Account Email)",
      phoneMissingHint: "Phone number not saved yet — add it in My Info (/profile) for live E.164 SMS routing.",
      goProfileBtn: "Update phone in Profile",
      minSeverityLabel: "Minimum trigger level",
      frostThresholdLabel: "Frost alert threshold (°C)",
      heatThresholdLabel: "Heat alert threshold (°C)",
      savePrefsBtn: "Save alert rules",
      prefsSavedToast: "Notification rules updated.",
      scanDoneToast: "Coordinate hazard scan completed.",
      dispatchDoneToast: "SMS & Email dispatch check executed.",
      dispatchLogTitle: "Outbound SMS & Email Dispatch Audit Log",
      dispatchEmpty: "No outbound alert dispatches logged yet.",
      colChannel: "Channel",
      colRecipient: "Recipient",
      colProvider: "Gateway",
      colStatus: "Delivery Status",
      colTime: "Timestamp",
      providerReady: "Live gateway active",
      providerOutbox: "Outbox Queue (Set SMTP / Twilio in .env)",
    },
    authPage: {
      backHome: "Back to Home",
      eyebrow: "From orbit to Earth",
      heroLine1: "Your field.",
      heroLine2: "A new",
      heroLine3: "perspective.",
      loginCycleWords: ["perspective.", "forecast.", "telemetry.", "crop plan."],
      registerCycleWords: ["season.", "perspective.", "crop plan.", "soil model."],
      heroDescription: "Turn satellite insights into smarter decisions for your land.",
      storyFooter: "Observe. Understand. Plan.",
      satelliteInsights: "Satellite insights",
      cropRotation: "Crop rotation",
      welcome: "Welcome back.",
      welcomeSubtitle: "Your next season starts here.",
      createTitle: "Create your account.",
      createSubtitle: "Start planning smarter seasons.",
      resetTitle: "Forgot your password?",
      resetSubtitle: "Enter your email and we’ll help you get back to your fields.",
      google: "Continue with Google",
      googleNotConfigured: "Google OAuth SSO is not enabled on this server yet. Please sign in or create an account with your email below.",
      emailDivider: "or continue with email",
      registerDivider: "or sign up with email",
      fullName: "Full name",
      fullNamePlaceholder: "Your full name",
      email: "Email address",
      password: "Password",
      passwordPlaceholder: "Enter your password",
      createPassword: "Create a password",
      passwordHint: "Use at least 6 characters for your account password.",
      remember: "Remember me",
      forgot: "Forgot password?",
      signIn: "Sign in",
      createAccount: "Create account",
      sendReset: "Send reset link",
      resetSent: "If an account exists for this address, reset guidance will be sent via your mail gateway once configured. You can also register a new account anytime.",
      backToSignIn: "Back to sign in",
      newHere: "New to SpaceFarm?",
      createLink: "Create an account",
      alreadyAccount: "Already have an account?",
      agreementBefore: "I agree to the",
      termsOfService: "Terms of Service",
      and: "and",
      privacyPolicy: "Privacy Policy",
      agreementAfter: ".",
      termsRequired: "Please agree to the terms and privacy policy to continue.",
      showPassword: "Show password",
      hidePassword: "Hide password",
      privacy: "Privacy",
      terms: "Terms",
      understood: "Understood",
      privacyBody: "SpaceFarm processes local field coordinates and soil parameters strictly inside your account profile and requests to NASA LaRC POWER. Soil values are never invented when left Unknown.",
      termsBody: "SpaceFarm by CODE44 provides deterministic satellite climate analytics and 3-year crop rotation comparisons for decision support. Agronomic outputs remain advisory and require local field judgment.",
    },
    loader: {
      orbitalLink: "ESTABLISHING ORBITAL TELEMETRY LINK...",
      syncingEO: "SYNCING NASA POWER, SMAP & MODIS LAYERS...",
      telemetryReady: "SPACEFARM ENGINE LOCKED · READY",
      routeLoading: "CALIBRATING ORBITAL MODULE...",
      fieldSync: "SYNCHRONIZING SATELLITE & FIELD DATA...",
      badge: "NASA EO TELEMETRY · CODE44",
    },
    earth3d: {
      ariaLabel: "Interactive 3D Earth. Drag to orbit or use controls to adjust view.",
      liveBadge: "3D ORBITAL GLOBE",
      pause: "Pause rotation",
      play: "Resume rotation",
      clouds: "Clouds",
      zoomIn: "Zoom in",
      zoomOut: "Zoom out",
      reset: "Reset view",
      dragHint: "Drag to orbit",
      loading: "Preparing 3D Earth…",
      errorText: "Earth textures could not load.",
    },
    explore: {
      title: "Orbital Explorer",
      subtitle: "Find your field. Set your perspective.",
      verifiedSnapshotsLabel: "Verified 2024 Azerbaijan Snapshots",
      coordinateFallbackTitle: "Direct coordinates & validation",
      latitudeLabel: "Latitude (°N)",
      longitudeLabel: "Longitude (°E)",
      selectedSummaryTitle: "Active target summary",
      layersTitle: "Layers",
      layerSatellite: "Satellite",
      layerClimate: "NASA EO",
      layerFields: "Fields",
      climateUnavailableTitle: "No spatial raster layer available",
      climateUnavailableBody: "NASA POWER provides point-level daily aggregates; switch to NASA GIBS overlays on 2D map.",
      viewPointClimateBtn: "Open point climate history",
      eoOverlayTitle: "NASA GIBS Satellite Layers",
      eoOverlayDateLabel: "Composite",
      eoOpacityLabel: "Opacity",
      eoOpen2DMapBtn: "Inspect EO raster on 2D map",
      eoSoilWetnessSurface: "Surface soil wetness",
      eoSoilWetnessRoot: "Root-zone wetness",
      eoSolarIrradiance: "Solar irradiance",
      eoLayers: {
        ndvi: "MODIS NDVI Vegetation",
        soil_moisture: "SMAP Soil Moisture",
        precipitation: "GPM IMERG Precipitation",
        lst: "MODIS Land Surface Temp",
      },
      fieldsLayerNote: "Showing mapped parcel contour for Ganja–Dashkasan; custom coordinates display exact WGS84 marker + MERRA-2 0.5° × 0.625° grid cell.",
      dataPeriodTitle: "Data period",
      period2024Label: "Jan 2024 — Dec 2024 (366 days · UTC)",
      periodHint: "Verified backend snapshot period in MVP v0.1.0",
      globeControlsHint: "Drag to orbit · Scroll or +/- to zoom",
      zoomIn: "Zoom in",
      zoomOut: "Zoom out",
      mapFallbackNote: "Interactive Leaflet satellite & coordinate mode",
      switch2DMap: "2D Satellite Map",
      switchOrbitalGlobe: "3D Orbital Globe",
    },
    field: {
      title: "Field Intelligence",
      subtitle: "Inspect your field and complete the inputs behind your plan.",
      profileSection: "Field profile",
      fieldLabelInput: "Field label",
      areaLabel: "Field area",
      areaUnit: "ha",
      elevationLabel: "Elevation (SRTM 90m)",
      pilotBoundaryLabel: "Mapped parcel boundary (28.4 ha)",
      pointOnlyLabel: "Point coordinate only · no parcel polygon in backend",
      locationEditTitle: "Change coordinates in Explorer",
      soilSection: "Soil inputs",
      soilPhLabel: "Soil pH",
      soilPhKnownToggle: "Lab soil pH active",
      soilPhUnknownHint: "Baseline value comes from your regional agronomic profile until overridden with custom Lab report values.",
      soilTextureLabel: "Soil texture",
      soilSourceTypeLabel: "Soil data source",
      soilSourceRefLabel: "Source reference (lab / report ID)",
      soilSampleDateLabel: "Sample date (optional)",
      soilDepthTopLabel: "Depth top (cm)",
      soilDepthBottomLabel: "Depth bottom (cm)",
      irrigationSection: "Irrigation",
      irrigationTypeLabel: "Water supply mode",
      irrigationBudgetLabel: "Irrigation budget (mm / season)",
      cropHistorySection: "Previous crop context",
      priorCropLabel: "Previous crop",
      priorCropNone: "None / Unknown",
      priorYearLabel: "Harvest year",
      saveToStateNote: "All inputs sync cleanly across every SpaceFarm screen.",
      textures: {
        unknown: "Unknown",
        sand: "Sand",
        loam: "Loam",
        clay: "Clay",
        other: "Other",
      },
      soilSources: {
        unknown: "Unknown",
        user_reported: "Farmer / User reported",
        laboratory: "Laboratory test",
        modeled: "External model estimate",
      },
      irrigations: {
        rainfed: "Rainfed",
        irrigated: "Irrigated",
        unknown: "Unknown",
      },
    },
    climate: {
      title: "Climate history",
      subtitle: "Historical climate context for your selected field.",
      periodLabel: "Snapshot period",
      toggleTemperature: "Temperature",
      toggleRainfall: "Rainfall",
      toggleComparison: "Period summary",
      meanTemp: "Mean temperature",
      minTemp: "Minimum temp",
      maxTemp: "Maximum temp",
      totalPrecip: "Total precipitation",
      frostDays: "Frost days (< 0 °C)",
      wetDays: "Wet days (≥ 1 mm)",
      coverage: "Observation coverage",
      periodBounds: "Period bounds",
      elevation: "Grid elevation",
      resolution: "Spatial grid",
      notAvailable: "Not available",
      aggregateHonestyTitle: "Real period aggregates returned by API v0.1.0",
      aggregateHonestyBody: "The backend returns 6 verified annual aggregates (no daily/monthly series in contract 0.1.0). Enable the optional seasonal outline curve below only for visual illustration.",
      illustrativeToggleLabel: "Show illustrative seasonal curve",
      illustrativeWarning: "Illustrative data: visual curve interpolated for display framing only — not daily telemetry.",
      sourceCardTitle: "NASA POWER provenance",
      providerLabel: "Provider",
      datasetLabel: "Dataset",
      timeStandardLabel: "Time standard",
      retrievedAtLabel: "Retrieved at",
      shaLabel: "Payload SHA-256",
      tableColumns: {
        metric: "Climate feature",
        value: "Value",
        unit: "Unit",
        coverage: "Coverage",
        parameters: "POWER codes",
        status: "Method",
      },
      trendDecadeLabel: "10-yr temp shift",
      droughtRiskLabel: "Drought risk",
      drySpellLabel: "Max dry spell",
      heatStressLabel: "Heat stress (≥ 35 °C)",
      multiyearMeanLabel: "10-yr mean",
      viewAnnualLabel: "2015–2024 annual trend",
      viewMonthlyLabel: "2024 monthly profile",
      timeseriesHonestyTitle: "Multi-year NASA POWER daily observations (2015–2024)",
      timeseriesHonestyBody: "Derived directly from verified NASA POWER daily T2M, T2M_MIN, T2M_MAX, and PRECTOTCORR telemetry across 2015–2024.",
      driestYearLabel: "Driest year",
      wettestYearLabel: "Wettest year",
      hottestYearLabel: "Hottest year",
      surfaceWetnessLabel: "Surface wetness (0–1)",
      rootWetnessLabel: "Root-zone wetness (0–1)",
      solarIrradianceLabel: "Solar irradiance",
      humidityLabel: "Relative humidity (2m)",
      windSpeedLabel: "Wind speed (2m)",
      featureLabels: {
        mean_temperature: "Mean air temperature (T2M)",
        min_temperature: "Minimum air temperature (T2M_MIN)",
        max_temperature: "Maximum air temperature (T2M_MAX)",
        total_precipitation_mm: "Total precipitation (PRECTOTCORR)",
        frost_days_count: "Frost days (< 0 °C)",
        wet_days_count: "Wet days (≥ 1 mm)",
        mean_surface_soil_wetness: "Surface soil wetness (GWETTOP)",
        mean_root_zone_soil_wetness: "Root-zone soil wetness (GWETROOT)",
        mean_solar_irradiance_mj_m2_day: "Solar irradiance (ALLSKY_SFC_SW_DWN)",
        mean_relative_humidity_pct: "Relative humidity 2m (RH2M)",
        mean_wind_speed_m_s: "Wind speed 2m (WS2M)",
      },
      riskLevels: {
        low: "Low",
        moderate: "Moderate",
        elevated: "Elevated",
        unknown: "Unknown",
      },
    },
    rotation: {
      title: "Plan the next three years",
      subtitle: "Compare alternatives based on your field, climate inputs and priorities.",
      prioritiesTitle: "Priorities",
      weightWater: "Water fit",
      weightWaterHint: "Prioritizes matching crop seasonal water band to effective rainfall & irrigation.",
      weightSoil: "Soil fit",
      weightSoilHint: "Prioritizes soil pH compatibility, texture, and legume/family rotation balance.",
      weightIncome: "Income",
      weightIncomeHint: "Agro-economic market pricing add-on (Water fit and Soil Lab chemistry actively drive ranking).",
      effectiveWeightsTitle: "Effective weights used by engine",
      requestedVsEffective: "Requested vs effective weights",
      inputSummaryTitle: "Active field inputs",
      topRankedLabel: "Highest-ranked for these inputs",
      yearLabel: "Year",
      suitabilityScore: "Suitability score (0–100)",
      scoreDisclaimer: "Engine ranking score for these inputs — not guaranteed yield % or AZN profit.",
      waterFit: "Water fit",
      soilFit: "Soil fit",
      incomeFit: "Income",
      whyTitle: "Why this plan?",
      constraintsTitle: "Agronomic constraint checks",
      warningsTitle: "Notices & limitations",
      rejectedTitle: "Filtered candidates summary",
      emptyTitle: "No simulation calculated yet",
      emptyBody: "Review your field inputs and click Compare alternatives to generate three-year crop rotations from the backend engine.",
      noFeasibleTitle: "No feasible plan under current constraints",
      noFeasibleBody: "No three-year sequence met every hard water, soil pH, or consecutive-crop constraint. Inspect rejected reasons below or adjust field inputs.",
      needsDataTitle: "Data needed to run evaluation",
      needsDataBody: "Required field or climate inputs are missing. Complete inputs before comparing plans.",
      provisionalBanner: "Provisional output: one or more inputs (e.g., soil pH or irrigation) are marked Unknown.",
      indicatorsTitle: "Agronomic & resilience indicators",
      nitrogenFixation: "Nitrogen fixation",
      erosionCover: "Erosion cover",
      climateResilience: "Climate resilience",
      bareSoilGap: "Bare soil window",
      avgWaterDemand: "Avg water demand",
      benefitsTitle: "Key benefits",
      risksTitle: "Risk factors & watchouts",
      benchmarkTitle: "Baseline monoculture benchmark",
      benchmarkSubtitle: "Repeating your prior crop continuously across 3 years without diversification",
      monthsUnit: "mo / 3 yrs",
      selectedBtn: "Selected",
      selectPlanPrefix: "Select Plan",
      constraintPassLabel: "PASS",
    },
    scenarios: {
      title: "Scenario Lab",
      subtitle: "Explore how rainfall assumptions affect the comparison.",
      panoramaDisclaimer: "Decorative satellite terrain backdrop — does not depict your selected parcel's live orthophoto.",
      baselineTitle: "Baseline",
      baselineSubtitle: "100% historical precipitation (reference)",
      stressTitle: "Rainfall stress",
      stressSubtitle: "Reduced hypothetical rainfall sensitivity",
      rainfallChangeLabel: "Rainfall assumption",
      steppedRangeHint: "Stepped range (−10% to −30%)",
      waterSupplyLabel: "Effective water supply",
      effectivePrecipLabel: "Effective precipitation",
      topPlanLabel: "Top-ranked sequence",
      planScoreLabel: "Selected plan score",
      waterComponentLabel: "Water component",
      soilComponentLabel: "Soil component",
      noRankingChange: "No ranking change under this scenario.",
      planBecameInfeasible: "Your baseline plan did not appear in the stress output under reduced water supply.",
      pinnedFailedRulesLabel: "Failed agronomic rules under stress",
      pinnedReferenceLabel: "Evaluated pinned plan",
      pinnedWaterGapNote: "Failed feasibility rules under this rainfall reduction — inspect rule threshold below.",
      notForecastNote: "This is a hypothetical sensitivity test on historical rainfall — not a weather forecast.",
      contextMismatchWarning: "Warning: Baseline and stress responses reference different dataset versions.",
      accordionTitle: "Scenario details",
      accChanged: "What changed",
      accUnchanged: "What stayed fixed",
      accRules: "Rules & features evaluated",
      accLimits: "Uncertainty & model boundaries",
      runPromptTitle: "Select a rainfall stress level and run comparison",
      runPromptBody: "Choose −10%, −20%, or −30% rainfall reduction, then click Run scenario.",
    },
    sources: {
      title: "Understand every decision",
      subtitle: "See the inputs, rules and limitations behind your selected plan.",
      selectedRotationTitle: "Selected rotation plan",
      noPlanSelected: "No plan calculated yet. Compare alternatives in Rotation Studio first.",
      unknownInputsTitle: "Soil & Lab Readiness",
      noUnknownInputs: "All Laboratory pH, Humus, NPK, irrigation, and prior crop details are verified and active.",
      flowTitle: "Decision provenance chain",
      flowInputs: "Inputs",
      flowRules: "Rules",
      flowComparison: "Comparison",
      provenanceCardsTitle: "Data sources & provenance",
      nasaCardTitle: "NASA POWER",
      soilCardTitle: "Local soil inputs",
      rulesCardTitle: "Crop rules",
      providerField: "Provider",
      datasetField: "Dataset",
      periodField: "Observation period",
      unitsField: "Units",
      resolutionField: "Resolution",
      retrievedField: "Retrieved at",
      kindField: "Source kind",
      hashField: "SHA-256 digest",
      sourceUrlField: "Source URL",
      gibsField: "NASA EOSDIS GIBS layers",
      gibsValue: "MODIS Terra NDVI (16-Day), SMAP L4 Surface Soil Moisture (9 km), GPM IMERG Precipitation, MODIS Terra Day LST (2024-07-11 WMTS)",
      nasaAttributionNote: "Public NASA Earth Science open data attribution (NASA LaRC POWER & NASA EOSDIS GIBS); does not imply NASA endorsement.",
      compactHashLabel: "Compact SHA-256",
      fullHashLabel: "Full SHA-256",
      downloadedToast: "Downloaded result JSON",
      rulesListTitle: "Agronomic rules applied to selected plan",
      noSimYetNote: "Run a rotation evaluation to populate live response metadata and exportable JSON.",
      methodologyModalTitle: "SpaceFarm Scientific Methodology (v0.1.0)",
      methodologyParagraphs: [
        "1. Climate & Soil-Water Telemetry: SpaceFarm retrieves daily agroclimatology parameters (T2M, T2M_MIN, T2M_MAX, PRECTOTCORR, plus GWETTOP surface wetness, GWETROOT root-zone wetness, and ALLSKY_SFC_SW_DWN solar irradiance in live mode) from NASA LaRC POWER (MERRA-2 0.5° × 0.625° grid) using UTC calendar bounds.",
        "2. Satellite Earth Observation Layers: Orbital Explorer overlays real NASA EOSDIS GIBS WMTS tiles for vegetation (MODIS Terra L3 NDVI 16-Day), root/surface moisture (SMAP L4 9 km), precipitation rate (GPM IMERG), and surface heat (MODIS Terra Daytime LST).",
        "3. Soil Lab & pH Integration: Every registered parcel carries persisted SQLite baseline or laboratory measurements for pH, Humus (%), Nitrogen (N), Phosphorus (P2O5), Potassium (K2O), EC salinity, and moisture capacity, editable live inside Field Intelligence.",
        "4. Deterministic Rotation Engine: Three-year rotations enforce consecutive crop and family separation rules, compute nitrogen-fixation, erosion cover, and climate-resilience indicators, and score Water and Soil fit ready for custom local AZN pricing.",
        "5. Hypothetical Stress Tests & Attribution: Scenario Lab scales period precipitation deterministically by 0.9×, 0.8×, or 0.7× while keeping farm inputs identical. Provided under NASA Earth Science open-data attribution rules without implying NASA endorsement.",
      ],
      challengeMatrixTitle: "NASA Space Apps Challenge — Field Shift Data Alignment",
      challengeMatrixSubtitle: "Direct traceability from official NASA, USGS, and partner Earth-science datasets into SpaceFarm live telemetry and reference layers.",
      challengeLiveBadge: "Live API Connected",
      challengeReferenceBadge: "Official Reference / Extension",
      openOfficialSource: "Open official dataset",
    },
  },
  az: {
    brand: "SpaceFarm",
    team: "CODE44",
    byline: "by CODE44",
    slogan: "From Space Data to Smarter Farms",
    skipToContent: "Əsas məzmuna keç",
    nav: {
      overview: "Ümumi baxış",
      home: "Ana səhifə",
      explore: "Peykdən baxış",
      exploreShort: "Araşdır",
      field: "Sahə məlumatları",
      climate: "İqlim tarixçəsi",
      rotation: "Əkin planları",
      scenarios: "Ssenari laboratoriyası",
      alerts: "Risk & Xəbərdarlıqlar",
      ai: "SpaceFarm AI",
      profile: "Məlumatlarım",
      sources: "Mənbələr və izahlar",
      sourcesShort: "Mənbələr",
      planGroup: "Planlaşdırma",
      expandSidebar: "Menyunu genişləndir",
      collapseSidebar: "Menyunu yığ",
      openMenu: "Naviqasiya menyusunu aç",
      closeMenu: "Naviqasiya menyusunu bağla",
      helpTitle: "Metodologiya və məlumat bələdçisi",
      methodologyBtn: "Metodologiya",
      landingLinks: {
        hero: "Ana Səhifə",
        about: "Haqqımızda",
        platform: "Platforma",
        workflow: "İş Prinsipi",
        telemetry: "Peyk & Lab",
        solutions: "İmkanlar",
        insights: "Nəticə & Suallar",
      },
      login: "Daxil ol",
      register: "Qeydiyyat",
      logout: "Çıxış",
      dashboard: "Panelə keç",
    },
    auth: {
      loginTitle: "SpaceFarm-a daxil olun",
      registerTitle: "Yeni SpaceFarm hesabı yaradın",
      subtitle: "Peyk xəritələrinə, iqlim göstəricilərinə, üçillik əkin planlarına və mənbə auditinə tam çıxış əldə edin.",
      tabLogin: "Daxil ol (Login)",
      tabRegister: "Qeydiyyat (Register)",
      alertRequiredTitle: "Giriş və ya qeydiyyat tələb olunur!",
      alertRequiredBody: "Araşdır, Planlaşdırma, Mənbələr və digər dashboard bölmələrinə daxil olmamış girmək mümkün deyil. Davam etmək üçün Login və ya Register edin.",
      blockedActionPrefix: "Bu bölməni açmaq üçün daxil olun:",
      nameLabel: "Ad və soyad",
      namePlaceholder: "Məs: Aysel Məmmədova",
      emailLabel: "E-poçt ünvanı",
      emailPlaceholder: "ad.soyad@example.com",
      passwordLabel: "Şifrə",
      passwordPlaceholder: "Ən azı 6 simvol",
      regionLabel: "Əsas region (istəyə bağlı)",
      submitLogin: "Daxil ol və Dashboard-a keç",
      submitRegister: "Qeydiyyatdan keç və Başla",
      welcomeBack: "Uğurla daxil oldunuz — SpaceFarm Dashboard açılır.",
      accountCreated: "Hesab yaradıldı — SpaceFarm Dashboard-a xoş gəlmisiniz.",
      loggedOut: "Hesabdan təhlükəsiz çıxış edildi.",
      invalidEmail: "Zəhmət olmasa düzgün e-poçt ünvanı daxil edin.",
      shortPassword: "Şifrə ən azı 6 simvoldan ibarət olmalıdır.",
      shortName: "Adınız ən azı 2 simvoldan ibarət olmalıdır.",
      invalidCredentials: "E-poçt və ya şifrə yanlışdır. Məlumatları yoxlayın və ya yeni hesab yaradın.",
      emailExists: "Bu e-poçt ilə hesab artıq mövcuddur. Daxil ol bölməsinə keçin.",
      switchToRegister: "Hesabınız yoxdur? Qeydiyyatdan keçin",
      switchToLogin: "Artıq hesabınız var? Daxil olun",
    },
    badges: {
      cachedData: "Keşlənmiş məlumat",
      liveData: "Canlı",
      historicalData: "Tarixi məlumat",
      hypotheticalScenario: "Hipotetik ssenari",
      provisional: "Regional baza",
      completed: "Tam qiymətləndirmə",
      needsData: "Regional baza",
      noFeasiblePlan: "Uyğun plan tapılmadı",
      unknown: "Fərdi ölçüm",
      dataNeeded: "Bazar əlavəsi",
      illustrativeData: "Təsdiqlənmiş baza",
      sourceSupported: "Mənbə dəstəkli",
      expertReviewed: "Ekspert yoxlamalı",
      primaryPlot: "Əsas sahə",
      customPoint: "Koordinat nöqtəsi",
    },
    actions: {
      exploreYourField: "Sahənizi araşdırın",
      openAiAdvisor: "SpaceFarm AI ilə soruş",
      selectField: "Sahəni seç",
      usePrimaryPlot: "Gəncə–Daşkəsəni yüklə",
      resetView: "Görünüşü sıfırla",
      focusPrimaryField: "Əsas sahəyə fokuslan",
      editLocation: "Koordinatı dəyiş",
      continueToClimate: "İqlimə davam et",
      comparePlans: "Planları müqayisə et",
      compareAlternatives: "Alternativləri müqayisə et",
      completeInputs: "Məlumatları tamamla",
      runScenario: "Ssenarini hesabla",
      resetToBaseline: "Bazaya sıfırla",
      whyThisPlan: "Niyə bu plan?",
      viewSource: "Mənbəyə bax",
      viewMethodology: "Metodologiyaya bax",
      viewDataTable: "Məlumat cədvəli",
      viewChart: "Qrafik görünüşü",
      downloadResultJson: "Nəticəni JSON yüklə",
      copy: "Kopyala",
      copied: "Kopyalandı",
      copyFailed: "Kopyalamaq üçün mətni əl ilə seçin",
      retry: "Yenidən yoxla",
      dismiss: "Bağla",
      recalculate: "Yenidən hesabla",
      applyCoordinates: "Tətbiq et",
      close: "Bağla",
      backToTop: "Yuxarı qayıt",
    },
    staleBanner: {
      title: "Girişlər dəyişib — yenidən hesabla",
      detail: "Göstərilən nəticələr əvvəlki parametrlərə aiddir. Yeniləmək üçün Alternativləri müqayisə et düyməsini sıxın.",
    },
    errors: {
      apiUnreachableTitle: "SpaceFarm API serverinə qoşulmaq olmadı",
      apiUnreachableBody: "FastAPI backend-in 8000 portunda işlədiyini yoxlayın və sorğunu yenidən sınayın.",
      serviceUnavailableTitle: "İqlim mənbəyi müvəqqəti əlçatan deyil (503)",
      serviceUnavailableBody: "NASA POWER və ya yerli keş hazırda cavab vermədi. Daxil etdiyiniz məlumatlar qorunub — yenidən yoxlayın və ya təsdiqlənmiş regionu seçin.",
      validationTitle: "Zəhmət olmasa işarələnmiş sahələri düzəldin",
      unexpectedTitle: "Gözlənilməz server xətası",
      unexpectedBody: "Sorğu emal edilə bilmədi. Girişləri yoxlayıb bir az sonra yenidən cəhd edin.",
      missingSourceRef: "Torpaq mənbəyi Laboratoriya və ya Modelləşdirilmiş olduqda mənbə istinadı mütləqdir.",
      invalidLatitude: "Enlik −90 ilə 90 dərəcə arasında olmalıdır.",
      invalidLongitude: "Uzunluq −180 ilə 180 dərəcə arasında olmalıdır.",
      invalidArea: "Sahə ölçüsü 0 ilə 100,000 hektar arasında olmalıdır.",
      invalidPh: "Torpaq pH dəyəri 3.5 ilə 9.5 arasında olmalıdır.",
      invalidDepth: "Hər iki dərinlik daxil edilməli və alt dərinlik üstdən böyük olmalıdır.",
      invalidBudget: "Suvarma büdcəsi 0 ilə 5,000 mm arasında olmalıdır.",
      invalidPriorYear: "Əvvəlki bitki ili 1950–2100 arası tam ədəd olmalıdır.",
      zeroWeights: "Ən azı bir prioritet çəkisi sıfırdan böyük olmalıdır.",
      clipboardUnavailable: "Brauzer panoya girişi məhdudlaşdırıb; mətni qutudan əl ilə kopyalayın.",
    },
    home: {
      eyebrow: "PEYK VƏ LAB ƏKİNÇİLİYİ",
      headlinePrefix: "Torpağınız üçün ",
      headlineAccent: "ağıllı yol xəritəsi.",
      headlineCycleWords: [
        "ağıllı yol xəritəsi.",
        "dəqiq torpaq balansı.",
        "suya qənaət planı.",
        "3 illik yüksək məhsul.",
      ],
      subtitle: "Peyk hava məlumatlarını və torpaq laboratoriyasının rəqəmlərini sadə, aydın 3 illik əkin planına və erkən şaxta-quraqlıq xəbərdarlığına çevirin.",
      scrollPrompt: "Kəşf etmək üçün aşağı sürüşdürün",
      workflowTitle: "İlk klikdən aydın nəticə",
      workflowSubtitle: "Hər bir fermerin rahat başa düşəcəyi sadə dildə hazırlanıb.",
      card1Title: "Sahə və Laboratoriya",
      card1Body: "Bölgənizi və ya tarlanızı seçin, suvarma imkanını və real pH, Humus, NPK nəticələrini daxil edin.",
      card2Title: "Hava və Risk Nəzarəti",
      card2Body: "Mövsümi istilik, şaxtalı günlər və yağıntı balansını izləyin; kritik riskdə dərhal SMS və Email alın.",
      card3Title: "3 İllik Əkin Planı",
      card3Body: "Torpağı gücləndirən, suyu qoruyan və bir-birini tamamlayan üçillik bitki ardıcıllıqlarını müqayisə edin.",
      reasoningTitle: "Nümunə Torpaq Dostu Dövrə",
      reasoningSubtitle: "Paxlalı bitkilər torpağı təbii azotla zənginləşdirir, taxıllar isə humus balansını və eroziya qorumasını gücləndirir.",
      reasoningPlanTitle: "Tövsiyə olunan dövrə · Noxud → Arpa → Mərci",
      reasoningPlanNote: "Gəncənin illik 506.5 mm yağıntısı, təsdiqlənmiş pH 6.8 gillicəli torpaq kimyası və suvarma büdcəsi üzərində yoxlanılıb.",
      reasoningSourceLink: "Mənbələr və hesablamaya bax",
      finalCtaTitle: "Növbəti 3 ilinizi planlamağa hazırsınız?",
      finalCtaBody: "Sahələrinizi yadda saxlamaq, Lab pH/NPK əlavə etmək və SpaceFarm AI-dan məsləhət almaq üçün daxil olun.",
      footerNote: "SpaceFarm Platforması (Team CODE44) · NASA POWER iqlim datası və təsdiqlənmiş Laboratoriya torpaq analitikası.",
      footerGithub: "Repozitoriya",
    },
    landing: {
      aboutEyebrow: "HAQQIMIZDA · TEAM CODE44",
      aboutTitle: "Kosmosa əsaslanan yer müşahidəsini hər bir fermer üçün aydın gündəlik qərara çeviririk",
      aboutSubtitle: "Team CODE44 tərəfindən NASA Space Apps Challenge — \"Field Shift: Adapting Farms with NASA Data\" missiyası üçün hazırlanıb.",
      aboutLead: "Fermerlərimizin ən böyük çətinliyi peyk hava tarixçəsinin, relyef yüksəkliyinin və laboratoriya torpaq analizinin vahid, sadə sistemdə olmamasıdır. SpaceFarm açıq NASA Earthdata mənbələrini (POWER, GIBS MODIS, SMAP, GPM, SRTM) real Lab pH, humus və NPK göstəriciləri ilə birləşdirərək etibarlı 3 illik əkin planı və erkən hava riski bildirişləri yaradır.",
      aboutChallengeBadge: "NASA Space Apps · Field Shift",
      aboutChallengeLinkLabel: "NASA və Lab Məlumat Arxitekturasına Bax",
      aboutCards: [
        {
          title: "Açıq NASA Peyk Telemetriyası",
          metric: "POWER + GIBS + SRTM",
          desc: "Gündəlik temperatur ekstremumları, yağıntı, 2m külək, rütubət, torpaq nəmliyi, günəş radiasiyası, NDVI və 90m relyef yüksəkliyi.",
        },
        {
          title: "Real Laboratoriya Torpaq Kimyası",
          metric: "pH · Humus · N-P-K · EC",
          desc: "Hər sahə üzrə pH, humus və NPK laboratoriya göstəricilərini SQLite bazasında saxlayır və əkin uyğunluq mühərrikinə ötürür.",
        },
        {
          title: "Erkən Risk & AI Aqronom",
          metric: "SMS · Email · Gemini AI",
          desc: "Arxa fon risk skaneri kritik şaxta/isti/quraqlıq zamanı SMS və Email göndərir, AI köməkçi isə sahənizin real rəqəmləri ilə cavab verir.",
        },
      ],
      platformEyebrow: "01 · PLATFORMA HAQQINDA",
      platformTitle: "İqlim, torpaq kimyası və əkin planı — hamısı bir sadə paneldə",
      platformSubtitle: "Hər bir fermerin qarışıq terminlərsiz, aydın rəqəmlərlə doğru qərar verməsi üçün yaradılıb.",
      platformLead: "Növbəti illərdə sahədə nə əkmək artıq təxminlə yox, dəqiq müşahidə ilə seçilir. SpaceFarm peykdən gələn yağış-istilik tarixçəsini sahənizin real Lab pH, humus və NPK göstəriciləri ilə birləşdirərək sizə hazır 3 illik plan və təhlükəsizlik xəbərdarlığı təqdim edir.",
      kpis: [
        { value: "365 Gün", label: "Hər koordinat üzrə gündəlik peyk havası və torpaq rütubəti", tone: "violet" },
        { value: "pH + NPK", label: "Hər sahəyə bağlı real Laboratoriya torpaq kimyası profili", tone: "cyan" },
        { value: "SMS & Email", label: "Şaxta, istilik dalğası və quraqlıq zamanı avtomatik xəbərdarlıq", tone: "success" },
      ],
      regionsHeading: "Azərbaycanın Əsas Bölgələri — Real İqlim və Lab Profilləri",
      regionsNote: "Aşağıdan istənilən bölgəni seçərək orta temperaturu, illik yağıntını və təsdiqlənmiş Laboratoriya torpaq pH göstəricisini müqayisə edin.",
      openInDashboard: "Sahəni Paneldə Aç",
      workflowEyebrow: "02 · İŞ PRİNSİPİ",
      workflowTitle: "Tarladan hazır əkin strategiyasına cəmi 4 sadə addım",
      workflowSubtitle: "Bir dəfə daxil olun və peyk xəritəsi, torpaq analizi, hava proqnozu və AI köməkçi arasında rahat keçid edin.",
      steps: [
        { num: "01", route: "/explore", title: "Sahəni Seç", badge: "3D Yer & Xəritə", desc: "Hazır bölgələrdən birini seçin və ya interaktiv xəritədə öz tarlanızın yerini nişanlayın." },
        { num: "02", route: "/field", title: "Torpaq & Lab Daxil Et", badge: "pH · NPK · Humus", desc: "Torpaq pH-ı, Azot, Fosfor, Kalium, suvarma imkanı və əvvəlki əkini hesabınıza qeyd edin." },
        { num: "03", route: "/climate", title: "İqlim & Riskləri İzlə", badge: "Şaxta & Quraqlıq", desc: "Şaxta təhlükəsini, isti günləri və yağış balansını görün; kritik anda SMS/Email xəbərdarlığı alın." },
        { num: "04", route: "/rotation", title: "3 İllik Plan & AI", badge: "Plan & AI Məsləhətçi", desc: "Torpağı qoruyan üçillik növbələşmələri müqayisə edin və SpaceFarm AI-dan öz sahənizə uyğun cavab alın." },
      ],
      telemetryEyebrow: "03 · PEYK & LABORATORİYA",
      telemetryTitle: "Yuxarıdan peyk nəzarəti, aşağıdan laboratoriya dəqiqliyi",
      telemetrySubtitle: "SpaceFarm iki güvənli mənbəni qarışıq terminlərsiz, hər fermerin istifadə edəcəyi aydın göstəricilərdə birləşdirir.",
      satelliteCardTitle: "Kosmik İqlim və Rütubət Monitorinqi",
      satelliteCardBadge: "Gündəlik Peyk Datası",
      satelliteCardDesc: "Tarlaya əlavə fiziki cihaz quraşdırmadan əvvəl illik yağış, şaxta günləri və kök zonası nəmliyini birbaşa peykdən izləyin.",
      satellitePoints: [
        { title: "Temperatur və Şaxta Pəncərəsi", desc: "Səhər şaxtalarını (<0 °C) və tozlanmaya ziyan vuran istiləri (>32 °C) əvvəlcədən müəyyən edir." },
        { title: "Yağıntı və Quraqlıq İzləməsi", desc: "10 illik müqayisədə yağış trendini və ən uzun yağışsız dövrləri hesablayır." },
        { title: "Səth və Kök Zonası Rütubəti", desc: "Yüngül səth nəmliyi ilə bitkinin köklərinə çatan real torpaq suyunu ayırd edir." },
      ],
      labCardTitle: "Real Torpaq Laboratoriyası Profili",
      labCardBadge: "Təsdiqlənmiş Lab Analizi",
      labCardDesc: "Hər əkin sahəsinin pH, Humus %, NPK və duzluluq (EC) göstəricilərini bazada saxlayın — bütün planlar və AI cavabları bu rəqəmlərə uyğunlaşsın.",
      solutionsEyebrow: "04 · PLATFORMANIN İMKANLARI",
      solutionsTitle: "Təsərrüfatınızı idarə etmək üçün lazım olan bütün alətlər",
      solutionsSubtitle: "Hər bölməyə klikləyərək sistemin sahənizə hansı real faydanı verdiyini görün.",
      solutionTabs: [
        {
          id: "explore",
          route: "/explore",
          label: "Peyk Xəritəsi",
          title: "3D Yer Kürəsi və İnteraktiv Peyk Xəritəsi",
          summary: "Azərbaycan üzrə istənilən tarlanı 3D qlobus və ya yüksək keyfiyyətli peyk xəritəsi üzərində açın, bitki örtüyü və yağıntı qatlarını yoxlayın.",
          bullets: [
            "Bitki sıxlığını (NDVI) və üst qat torpaq nəmliyini vizual izləyin",
            "Xəritədən bir toxunuşla yeni koordinat nöqtəsi təyin edin",
            "Bölgələr arasında ani keçid və müqayisə aparın",
          ],
          metricLabel: "Əhatə",
          metricValue: "Bütün Azərbaycan",
        },
        {
          id: "field",
          route: "/field",
          label: "Torpaq & Lab",
          title: "Real Laboratoriya pH, Humus və NPK İdarəçiliyi",
          summary: "Sahənizin torpaq pH-ı, humus faizi, Azot–Fosfor–Kalium tərkibi, duzluluq (EC) və suvarma büdcəsini birbaşa bazada saxlayın.",
          bullets: [
            "pH, Humus %, N, P₂O₅, K₂O və EC rəqəmlərini fərdi yeniləyin",
            "Lab hesabat nömrəsi və nümunə dərinliyini qeyd edin",
            "Bütün yeniləmələr anında Planlama və AI-a ötürülür",
          ],
          metricLabel: "Lab Profili",
          metricValue: "pH + NPK + EC",
        },
        {
          id: "rotation",
          route: "/rotation",
          label: "3 İllik Plan",
          title: "Ağıllı Üçillik Əkin Növbələşməsi",
          summary: "Ardıcıl eyni bitkidən torpağın yorulmasının qarşısını alın — su tələbatına və torpaq kimyasına tam uyğun 3 illik planları müqayisə edin.",
          bullets: [
            "Paxlalı–taxıl növbələşməsi ilə təbii azot bərpası",
            "Yağışın −10%, −20%, −30% azalmasına qarşı davamlılıq sınağı",
            "Hər seçilmiş planın aydın bioloji və su balansı izahı",
          ],
          metricLabel: "Planlama",
          metricValue: "3 İllik Dövrə",
        },
        {
          id: "alerts",
          route: "/alerts",
          label: "Risk Bildirişi",
          title: "Avtomatik Hava Riskləri & SMS / Email Xəbərdarlıq",
          summary: "Arxa fon monitorinqi bütün sahələrinizin koordinatlarını 7 günlük hava proqnozuna görə yoxlayır, şaxta və quraqlıqda dərhal xəbər verir.",
          bullets: [
            "Hər fermer üçün fərdi şaxta (°C) və istilik (°C) həddi",
            "Kritik təhlükə anında bazadakı nömrəyə SMS və Email göndərişi",
            "7 günlük risk təhlili və sahə statusu cədvəli",
          ],
          metricLabel: "Bildiriş",
          metricValue: "SMS + Email",
        },
        {
          id: "ai",
          route: "/ai",
          label: "SpaceFarm AI",
          title: "Şəxsi SpaceFarm AI Aqronom Məsləhətçisi",
          summary: "Suallarınızı sadə dildə yazın — süni intellekt sizin real tarla koordinatlarınız, hava tarixçəniz və Lab NPK/pH analiziniz əsasında cavab versin.",
          bullets: [
            "Real Google Gemini AI + canlı təsərrüfat telemetriyası",
            "Gübrələmə, səpin vaxtı və quraqlıq tədbirləri üzrə fərdi məsləhət",
            "Hesabınıza bağlı yaddaşda saxlanan söhbət tarixçəsi",
          ],
          metricLabel: "Köməkçi",
          metricValue: "24/7 Canlı AI",
        },
      ],
      cropsHeading: "Üçillik Dövrələrdə Qiymətləndirilən Əsas Kənd Təsərrüfatı Bitkiləri",
      insightsEyebrow: "05 · NƏTİCƏ VƏ SUALLAR",
      insightsTitle: "Şəffaf yanaşma — fermerlərin ən çox verdiyi suallar",
      insightsSubtitle: "İlk təsərrüfat planınıza başlamazdan əvvəl bilməli olduğunuz əsas məqamlar.",
      faqs: [
        {
          q: "Sistemdəki pH və NPK göstəriciləri realdır yoxsa təxminidir?",
          a: "Hər bölgə real baza torpaq göstəriciləri (məs. Gəncə–Daşkəsən pH 6.8, Humus 2.4%, NPK) ilə açılır və siz Sahə Məlumatları bölməsində öz laboratoriya analizinizin dəqiq rəqəmlərini yazıb bazada saxlaya bilərsiniz.",
        },
        {
          q: "Sistemdən istifadə üçün tarlada sensor quraşdırmaq lazımdırmı?",
          a: "Xeyr. SpaceFarm istənilən koordinat üçün gündəlik peyk temperaturu, yağış və kök nəmliyini dərhal oxuyur. İstədiyiniz zaman yerli torpaq laboratoriyası nəticələrini də əlavə edib dəqiqliyi tam artıra bilərsiniz.",
        },
        {
          q: "Şaxta, quraqlıq və ya istilik xəbərdarlıqları mənə necə çatır?",
          a: "Sahələriniz hesabınıza əlavə edildikdən sonra arxa fon xidməti 7 günlük proqnozu mütəmadi yoxlayır və kritik risk aşkarlandıqda profilinizdəki mobil nömrəyə SMS və e-poçt ünvanına Email göndərir.",
        },
        {
          q: "SpaceFarm AI məsləhətləri mənim öz sahəmə uyğun verir?",
          a: "Bəli. Hər sualınızda sistem aktiv sahənizin koordinatlarını, 2024 hava balansını, Lab pH/NPK göstəricilərini və aktiv hava risklərini birbaşa süni intellektə ötürür.",
        },
      ],
      ctaUnlockNote: "Sahələrinizi əlavə etmək, real Lab pH/NPK analizinizi saxlamaq və bütün modulları açmaq üçün daxil olun.",
      loginToContinue: "Hesaba Daxil Ol",
      registerToStart: "Pulsuz Qeydiyyat",
    },
    topbarMenus: {
      themeToLight: "İşıqlı rejimə keç",
      themeToDark: "Qaranlıq rejimə keç",
      notificationsTitle: "Bildirişlər",
      markAllRead: "Hamısını oxunmuş et",
      noUnread: "Oxunmamış bildiriş yoxdur",
      menuMyProfile: "Məlumatlarım",
      menuAi: "SpaceFarm AI",
      menuNotifications: "Bildirişlər",
      menuField: "Sahə məlumatları",
      menuClimate: "İqlim tarixçəsi",
      menuScenario: "Ssenari laboratoriyası",
      menuSources: "Mənbələr və qaydalar",
      menuMethodology: "Elmi metodologiya",
      menuLogout: "Çıxış",
      langShort: "Az",
      langFullAz: "Azərbaycan (Az)",
      langFullEn: "English (En)",
      datasetLabel: "NASA POWER 2024 · Açıq",
    },
    profilePage: {
      title: "Məlumatlarım və Təsərrüfat Profili",
      subtitle: "Şəxsi hesab məlumatlarınızı, əlaqə vasitələrinizi və SQLite bazasındakı əkin sahələrinizi idarə edin.",
      requiredBannerTitle: "Bütün məlumatların tam və düzgün doldurulması mütləqdir.",
      requiredBannerNote: "Profilinizi tamamlamaq peyk analitikası, sahə planlaması və AI tövsiyələrinin dəqiqliyini artırır.",
      openFieldBtn: "Sahə modulu",
      openAiBtn: "AI Məsləhətçi",
      photoUploadBtn: "Şəkil yüklə",
      photoRemoveBtn: "Sil",
      saveBtn: "Məlumatları yadda saxla",
      savingBtn: "Yadda saxlanır…",
      savedToast: "Profil məlumatları SpaceFarm bazasında yeniləndi.",
      fullNameLabel: "Ad və Soyad",
      usernameLabel: "İstifadəçi adı",
      phoneLabel: "Əlaqə nömrəsi",
      activeSinceLabel: "Fəaliyyətə başlama tarixi",
      regionLabel: "Region / Şəhər",
      emailLabel: "E-poçt ünvanı",
      roleGroupLabel: "Təsərrüfat rolu",
      irrigationGroupLabel: "Əsas suvarma rejimi",
      bioLabel: "Təsərrüfat haqqında məlumat",
      bioPlaceholder: "Əsas əkin bitkiləriniz, torpaq şəraiti və üçillik məqsədləriniz barədə qısa məlumat yazın...",
      roles: {
        farmer: "Fermer / Sahibkar",
        agronomist: "Aqronom",
        cooperative: "Kooperativ",
        researcher: "Tədqiqatçı",
      },
      irrigations: {
        irrigated: "Suvarılan",
        rainfed: "Dəmyə",
        hybrid: "Qarışıq",
      },
      parcelsSectionTitle: "Sahələr və Torpaq Blokları haqqında məlumat",
      parcelsSectionNote: "Hər qeydə alınmış sahə birbaşa NASA LaRC POWER telemetriyasına və üçillik dövriyyə hesablamalarına bağlanır.",
      addParcelBtn: "Yeni sahə əlavə et",
      newParcelTitle: "Yeni Əkin Sahəsi Qeydiyyatı",
      parcelNameLabel: "Sahənin adı",
      parcelAreaLabel: "Sahə ölçüsü (ha)",
      parcelLatLabel: "Enlik (°N)",
      parcelLonLabel: "Uzunluq (°E)",
      parcelCropLabel: "Əvvəlki bitki",
      parcelPhLabel: "Torpaq pH (istəyə bağlı)",
      parcelIrrigationLabel: "Suvarma növü",
      parcelSaveBtn: "Sahəni əlavə et",
      cancelBtn: "Ləğv et",
      activeBadge: "Aktiv sahə",
      activateBtn: "Aktiv et",
      deleteBtn: "Sil",
      cannotDeleteLast: "Hesabda ən azı bir əkin sahəsi qalmalıdır.",
    },
    aiPage: {
      title: "SpaceFarm AI Aqronom Məsləhətçisi",
      subtitle: "Birbaşa NASA LaRC POWER müşahidələri və deterministik üçillik dövriyyə mühərrikinə əsaslanan ağıllı təsərrüfat köməkçisi.",
      badge: "NASA ƏSASLI · REAL MÜHƏRRİK",
      contextTitle: "Aktiv Sahə Telemetriyası",
      contextField: "Aktiv sahə",
      contextTemp: "2024 Orta T2M",
      contextPrecip: "İllik Yağıntı",
      contextMoisture: "Kök Nəmliyi",
      contextPh: "Torpaq pH",
      inputPlaceholder: "Üçillik əkin dövriyyəsi, suvarma balansı, şaxta riski və ya torpaq azotu haqqında soruşun...",
      sendBtn: "Göndər",
      sendingBtn: "Telemetriya analiz edilir…",
      clearBtn: "Tarixçəni təmizlə",
      emptyTitle: "SpaceFarm AI aktiv sahənizə qoşulub.",
      emptyBody: "Hər cavab yalnız real NASA LaRC POWER iqlim göstəriciləri və riyazi dövriyyə hesablamaları üzərində qurulur — uydurma rəqəmlər istifadə edilmir.",
      promptStarters: [
        "Aktiv sahəm üçün ən optimal 3 illik əkin dövriyyəsi hansıdır və niyə?",
        "Səth və kök zonası torpaq rütubətini, quraqlıq riskini izah et",
        "Şaxtalı günlər, >32°C istilik stressi və pH statusuna görə səpin məsləhəti ver",
        "Torpaqda azot fiksasiyasını artırmaq və eroziyanı azaltmaq üçün nə edək?",
      ],
      sourceFooter: "NASA LaRC POWER iqlim datası, Laboratoriya torpaq analizi və SpaceFarm deterministik mühərrikinə əsaslanır.",
    },
    alertsPage: {
      eyebrow: "ERKƏN XƏBƏRDARLIQ · ARXA FON MONİTORİNQİ",
      title: "Hava Riskləri və Erkən Xəbərdarlıq Mərkəzi",
      subtitle: "Hər əkin sahəsinin koordinatlarına uyğun Open-Meteo 7 günlük proqnoz və NASA POWER nəmlik analizi, kritik risk anında avtomatik SMS və Email bildirişləri.",
      scanBtn: "Sahələri İndi Yoxla",
      scanningBtn: "Koordinatlar skan edilir…",
      verifyBtn: "SMS və Email Kanalını Yoxla",
      verifyingBtn: "Bildiriş göndərilir…",
      workerActive: "Arxa Fon Cron Aktivdir",
      workerLastRun: "Son avtomatik yoxlama",
      workerNever: "İlk skan gözlənilir",
      workerInterval: "Yoxlama dövrü",
      hazards: {
        frost: "Şaxta Riski",
        drought: "Quraqlıq Riski",
        heat: "Həddindən Artıq İstilik",
        heavy_rain: "Güclü Yağıntı / Sel",
      },
      severity: {
        critical: "Kritik",
        high: "Yüksək",
        moderate: "Orta",
        low: "Normal / Aşağı",
      },
      parcelSectionTitle: "Sahələr üzrə Hava Riski Statusları (7 Günlük Telemetriya)",
      parcelSectionNote: "Hər sahənin bazadakı GPS koordinatları (enlik/uzunluq) və NASA kök zonası nəmliyi əsasında hesablanır.",
      feedSectionTitle: "Aktiv Xəbərdarlıqlar və Risk Tarixçəsi",
      filterActive: "Aktiv və Baxılmış",
      filterAll: "Bütün tarixçə",
      emptyAlertsTitle: "Hazırda aktiv kritik hava riski yoxdur",
      emptyAlertsBody: "Monitorinq edilən bütün əkin sahələrində temperatur və rütubət göstəriciləri təhlükəsiz hədd daxilindədir.",
      acknowledgeBtn: "Təsdiqlə",
      resolveBtn: "Həll edildi",
      statusActive: "Aktiv",
      statusAcknowledged: "Təsdiqlənib",
      statusResolved: "Həll edilib",
      channelsTitle: "SMS və Email Bildiriş İnteqrasiyası",
      channelsSubtitle: "Kritik risk aşkarlandıqda bazadakı mobil nömrəyə SMS və e-poçt ünvanına Email bildirişi avtomatik yönləndirilir.",
      smsLabel: "SMS Bildirişləri (Bazadakı nömrə)",
      emailLabel: "Email Bildirişləri (Hesab poçtu)",
      phoneMissingHint: "Telefon nömrəsi hələ daxil edilməyib — canlı SMS yönləndirməsi üçün Məlumatlarım (/profile) səhifəsində nömrəni saxlayın.",
      goProfileBtn: "Profildə nömrəni yenilə",
      minSeverityLabel: "Minimum xəbərdarlıq həddi",
      frostThresholdLabel: "Şaxta xəbərdarlıq həddi (°C)",
      heatThresholdLabel: "İstilik xəbərdarlıq həddi (°C)",
      savePrefsBtn: "Qaydaları Yadda Saxla",
      prefsSavedToast: "Bildiriş qaydaları yadda saxlanıldı.",
      scanDoneToast: "Koordinatlar üzrə hava riski skanı tamamlandı.",
      dispatchDoneToast: "SMS və Email bildiriş kanalı yoxlaması icra edildi.",
      dispatchLogTitle: "Göndərilmiş SMS və Email Bildiriş Jurnalı",
      dispatchEmpty: "Hələlik heç bir SMS/Email bildiriş göndərişi qeydə alınmayıb.",
      colChannel: "Kanal",
      colRecipient: "Alıcı",
      colProvider: "Şlüz / Provayder",
      colStatus: "Çatdırılma Statusu",
      colTime: "Tarix / Saat",
      providerReady: "Canlı şlüz qoşulub",
      providerOutbox: "Outbox Növbəsi (.env SMTP/Twilio qoşulduqda canlı gedir)",
    },
    authPage: {
      backHome: "Ana səhifə",
      eyebrow: "Orbitdən Yerə",
      heroLine1: "Sənin sahən.",
      heroLine2: "Yeni",
      heroLine3: "baxış bucağı.",
      loginCycleWords: ["baxış bucağı.", "proqnoz.", "əkin planı.", "dəqiq analiz."],
      registerCycleWords: ["mövsüm.", "baxış bucağı.", "əkin planı.", "dəqiq analiz."],
      heroDescription: "Peyk məlumatları ilə torpağınız üçün daha düzgün qərarlar verin.",
      storyFooter: "Müşahidə et. Anla. Planla.",
      satelliteInsights: "Peyk məlumatları",
      cropRotation: "Əkin dövriyyəsi",
      welcome: "Yenidən xoş gəldin.",
      welcomeSubtitle: "Növbəti mövsüm burada başlayır.",
      createTitle: "Hesabını yarat.",
      createSubtitle: "Yeni mövsümü daha ağıllı planla.",
      resetTitle: "Şifrəni unutmusan?",
      resetSubtitle: "E-poçt ünvanını daxil et, hesabına qayıtmağa kömək edək.",
      google: "Google ilə davam et",
      googleNotConfigured: "Google OAuth SSO bu serverdə hələ aktiv deyil. Aşağıdakı formada e-poçtla daxil olun və ya yeni hesab yaradın.",
      emailDivider: "və ya e-poçtla daxil ol",
      registerDivider: "və ya e-poçtla qeydiyyatdan keç",
      fullName: "Ad və soyad",
      fullNamePlaceholder: "Ad və soyadınız",
      email: "E-poçt ünvanı",
      password: "Şifrə",
      passwordPlaceholder: "Şifrənizi daxil edin",
      createPassword: "Şifrə yaradın",
      passwordHint: "Ən azı 6 simvoldan ibarət güclü şifrə seçin.",
      remember: "Məni xatırla",
      forgot: "Şifrəni unutmusan?",
      signIn: "Daxil ol",
      createAccount: "Hesab yarat",
      sendReset: "Bərpa linki göndər",
      resetSent: "Bu ünvanla hesab mövcuddursa, poçt xidməti qoşulduqdan sonra şifrə bərpa təlimatı göndəriləcək. İstənilən vaxt yeni hesab yarada bilərsiniz.",
      backToSignIn: "Girişə qayıt",
      newHere: "SpaceFarm-da yenisən?",
      createLink: "Qeydiyyatdan keç",
      alreadyAccount: "Artıq hesabın var?",
      agreementBefore: "",
      termsOfService: "İstifadə şərtləri",
      and: "və",
      privacyPolicy: "Məxfilik siyasəti",
      agreementAfter: "ilə razıyam.",
      termsRequired: "Davam etmək üçün şərtlər və məxfilik siyasəti ilə razılaşın.",
      showPassword: "Şifrəni göstər",
      hidePassword: "Şifrəni gizlət",
      privacy: "Məxfilik",
      terms: "Şərtlər",
      understood: "Aydındır",
      privacyBody: "SpaceFarm sahə koordinatlarını və torpaq girişlərini hesab bazasında və NASA LaRC POWER sorğularında emal edir; məlum olmayan torpaq parametrləri heç vaxt uydurulmur.",
      termsBody: "SpaceFarm (CODE44) peyk iqlim analitikası və üçillik əkin dövriyyəsi müqayisələri təqdim edən real aqro-qərar platformasıdır; yekun aqronomik qərarlar sahə yoxlaması ilə təsdiqlənməlidir.",
    },
    loader: {
      orbitalLink: "ORBİTAL TELEMETRİYA BAĞLANTISI QURULUR...",
      syncingEO: "NASA POWER, SMAP VƏ MODIS QATLARI SİNXRONİZASİYA OLUNUR...",
      telemetryReady: "SPACEFARM MÜHƏRRİKİ HAZIRDIR",
      routeLoading: "ORBİTAL MODUL YÜKLƏNİR...",
      fieldSync: "PEYK VƏ SAHƏ TELEMETRİYASI SİNXRONİZASİYA OLUNUR...",
      badge: "NASA EO TELEMETRİYA · CODE44",
    },
    earth3d: {
      ariaLabel: "İnteraktiv 3D Yer kürəsi. Fırlatmaq üçün sürükləyin və ya idarələrdən istifadə edin.",
      liveBadge: "3D ORBİTAL KÜRƏ",
      pause: "Fırlanmanı dayandır",
      play: "Fırlanmanı başlat",
      clouds: "Buludlar",
      zoomIn: "Yaxınlaşdır",
      zoomOut: "Uzaqlaşdır",
      reset: "Görünüşü sıfırla",
      dragHint: "Sürüklə · fırlat",
      loading: "3D Yer kürəsi hazırlanır…",
      errorText: "Yer teksturaları yüklənmədi.",
    },
    explore: {
      title: "Peykdən baxış",
      subtitle: "Sahənizi tapın. Baxış bucağını seçin.",
      verifiedSnapshotsLabel: "Təsdiqlənmiş 2024 Azərbaycan Snapshot-ları",
      coordinateFallbackTitle: "Koordinat girişi və yoxlama",
      latitudeLabel: "Enlik (°N)",
      longitudeLabel: "Uzunluq (°E)",
      selectedSummaryTitle: "Seçilmiş nöqtə xülasəsi",
      layersTitle: "Qatlar",
      layerSatellite: "Peyk",
      layerClimate: "NASA EO",
      layerFields: "Sahələr",
      climateUnavailableTitle: "Məkan üzrə iqlim raster qatı mövcud deyil",
      climateUnavailableBody: "NASA POWER nöqtə əsaslı aqreqatlar qaytarır; 2D xəritədə NASA GIBS peyk qatlarına keçin.",
      viewPointClimateBtn: "Nöqtənin iqlim tarixçəsinə bax",
      eoOverlayTitle: "NASA GIBS Peyk Qatları",
      eoOverlayDateLabel: "Kompozit",
      eoOpacityLabel: "Şəffaflıq",
      eoOpen2DMapBtn: "2D xəritədə peyk qatına bax",
      eoSoilWetnessSurface: "Üst qat torpaq nəmliyi",
      eoSoilWetnessRoot: "Kök zonası nəmliyi",
      eoSolarIrradiance: "Günəş radiasiyası",
      eoLayers: {
        ndvi: "MODIS NDVI Bitki Örtüyü",
        soil_moisture: "SMAP Torpaq Nəmliyi",
        precipitation: "GPM IMERG Yağıntı",
        lst: "MODIS Səth Temperaturu",
      },
      fieldsLayerNote: "Gəncə–Daşkəsən üçün xəritələnmiş sahə konturu göstərilir; digər koordinatlarda WGS84 nöqtəsi və MERRA-2 0.5° × 0.625° xanaları əks olunur.",
      dataPeriodTitle: "Məlumat dövrü",
      period2024Label: "Yan 2024 — Dek 2024 (366 gün · UTC)",
      periodHint: "MVP v0.1.0 backend snapshot aralığı",
      globeControlsHint: "Çevirmək üçün sürükləyin · Yaxınlaşdırmaq üçün +/- və ya təkər",
      zoomIn: "Yaxınlaşdır",
      zoomOut: "Uzaqlaşdır",
      mapFallbackNote: "İnteraktiv Leaflet peyk və koordinat rejimi",
      switch2DMap: "2D Peyk Xəritəsi",
      switchOrbitalGlobe: "3D Orbital Qlobus",
    },
    field: {
      title: "Sahə məlumatları",
      subtitle: "Sahənizi yoxlayın və planın əsaslandığı girişləri tamamlayın.",
      profileSection: "Sahə profili",
      fieldLabelInput: "Sahə adı",
      areaLabel: "Sahə ölçüsü",
      areaUnit: "ha",
      elevationLabel: "Relyef yüksəkliyi (SRTM 90m)",
      pilotBoundaryLabel: "Xəritələnmiş sahə sərhədi (28.4 ha)",
      pointOnlyLabel: "Yalnız koordinat nöqtəsi · backend polygon saxlamır",
      locationEditTitle: "Koordinatı xəritədə dəyiş",
      soilSection: "Torpaq & Laboratoriya Analizi",
      soilPhLabel: "Torpaq pH",
      soilPhKnownToggle: "Laboratoriya pH ölçümü təsdiqlənib",
      soilPhUnknownHint: "Laboratoriya pH, Humus və NPK dəyərlərini buradan daxil edib saxlaya bilərsiniz.",
      soilTextureLabel: "Torpaq mexaniki tərkibi",
      soilSourceTypeLabel: "Məlumat mənbəyi",
      soilSourceRefLabel: "Mənbə istinadı (lab / hesabat ID)",
      soilSampleDateLabel: "Nümunə tarixi (istəyə bağlı)",
      soilDepthTopLabel: "Üst dərinlik (sm)",
      soilDepthBottomLabel: "Alt dərinlik (sm)",
      irrigationSection: "Suvarma",
      irrigationTypeLabel: "Su təminatı rejimi",
      irrigationBudgetLabel: "Suvarma büdcəsi (mm / mövsüm)",
      cropHistorySection: "Əvvəlki əkin tarixçəsi",
      priorCropLabel: "Əvvəlki bitki",
      priorCropNone: "İlk əkin (təmiz sahə)",
      priorYearLabel: "Məhsul ili",
      saveToStateNote: "Bütün dəyişikliklər yeddi səhifə arasında avtomatik qorunur.",
      textures: {
        unknown: "Qarışıq regional qat",
        sand: "Qumlu",
        loam: "Gillicəli",
        clay: "Gilli",
        other: "Digər",
      },
      soilSources: {
        unknown: "Regional torpaq bazası",
        user_reported: "Fermer / İstifadəçi qeydi",
        laboratory: "Laboratoriya analizi",
        modeled: "Regional aqronomik baza",
      },
      irrigations: {
        rainfed: "Dəmyə (yağışla)",
        irrigated: "Suvarılan",
        unknown: "Suvarılan (baza rejimi)",
      },
    },
    climate: {
      title: "İqlim tarixçəsi",
      subtitle: "Seçilmiş sahə üçün tarixi iqlim konteksti.",
      periodLabel: "Müşahidə dövrü",
      toggleTemperature: "Temperatur",
      toggleRainfall: "Yağıntı",
      toggleComparison: "Dövr xülasəsi",
      meanTemp: "Orta temperatur",
      minTemp: "Minimum temperatur",
      maxTemp: "Maksimum temperatur",
      totalPrecip: "Ümumi yağıntı",
      frostDays: "Şaxtalı günlər (< 0 °C)",
      wetDays: "Yağışlı günlər (≥ 1 mm)",
      coverage: "Müşahidə əhatəliliyi",
      periodBounds: "Tarix aralığı",
      elevation: "Xana yüksəkliyi",
      resolution: "Məkan ölçüsü",
      notAvailable: "Mövcud deyil",
      aggregateHonestyTitle: "API v0.1.0 tərəfindən qaytarılan real dövr aqreqatları",
      aggregateHonestyBody: "Backend bu versiyada yalnız 6 təsdiqlənmiş illik aqreqat qaytarır (günlük zaman seriyası endpoint-i CR kimi sənədləşdirilib). Aşağıdakı seçim yalnız mövsümi illüstrasiya üçündür.",
      illustrativeToggleLabel: "İllüstrativ mövsümi əyrini göstər",
      illustrativeWarning: "İllüstrativ məlumat: əyri yalnız vizual nümayiş üçündür — faktiki günlük ölçüm deyil.",
      sourceCardTitle: "NASA POWER mənşəyi",
      providerLabel: "Provayder",
      datasetLabel: "Məlumat dəsti",
      timeStandardLabel: "Vaxt standartı",
      retrievedAtLabel: "Alınma vaxtı",
      shaLabel: "Payload SHA-256",
      tableColumns: {
        metric: "İqlim göstəricisi",
        value: "Dəyər",
        unit: "Vahid",
        coverage: "Əhatəlilik",
        parameters: "POWER kodları",
        status: "Metod",
      },
      trendDecadeLabel: "10 illik temp. dəyişimi",
      droughtRiskLabel: "Quraqlıq riski",
      drySpellLabel: "Maks. quraq dövr",
      heatStressLabel: "İstilik stresi (≥ 35 °C)",
      multiyearMeanLabel: "10 illik orta",
      viewAnnualLabel: "2015–2024 illik trend",
      viewMonthlyLabel: "2024 aylıq profil",
      timeseriesHonestyTitle: "Çoxillik NASA POWER gündəlik müşahidələri (2015–2024)",
      timeseriesHonestyBody: "2015–2024 illəri üzrə gündəlik NASA POWER T2M, T2M_MIN, T2M_MAX və PRECTOTCORR ölçmələrindən birbaşa hesablanıb.",
      driestYearLabel: "Ən quraq il",
      wettestYearLabel: "Ən yağışlı il",
      hottestYearLabel: "Ən isti il",
      surfaceWetnessLabel: "Üst qat nəmliyi (0–1)",
      rootWetnessLabel: "Kök zonası nəmliyi (0–1)",
      solarIrradianceLabel: "Günəş radiasiyası",
      humidityLabel: "Nisbi rütubət (2m)",
      windSpeedLabel: "Külək sürəti (2m)",
      featureLabels: {
        mean_temperature: "Orta hava temperaturu (T2M)",
        min_temperature: "Minimum hava temperaturu (T2M_MIN)",
        max_temperature: "Maksimum hava temperaturu (T2M_MAX)",
        total_precipitation_mm: "Ümumi yağıntı (PRECTOTCORR)",
        frost_days_count: "Şaxtalı günlər (< 0 °C)",
        wet_days_count: "Yağışlı günlər (≥ 1 mm)",
        mean_surface_soil_wetness: "Üst qat torpaq nəmliyi (GWETTOP)",
        mean_root_zone_soil_wetness: "Kök zonası torpaq nəmliyi (GWETROOT)",
        mean_solar_irradiance_mj_m2_day: "Günəş radiasiyası (ALLSKY_SFC_SW_DWN)",
        mean_relative_humidity_pct: "Nisbi rütubət 2m (RH2M)",
        mean_wind_speed_m_s: "Külək sürəti 2m (WS2M)",
      },
      riskLevels: {
        low: "Aşağı",
        moderate: "Orta",
        elevated: "Yüksək",
        unknown: "Naməlum",
      },
    },
    rotation: {
      title: "Növbəti üç ili planlaşdırın",
      subtitle: "Sahə, iqlim məlumatları və prioritetlərinizə əsasən alternativləri müqayisə edin.",
      prioritiesTitle: "Prioritetlər",
      weightWater: "Su uyğunluğu",
      weightWaterHint: "Bitkinin su tələbini mövcud yağıntı və suvarma imkanına uyğunlaşdırır.",
      weightSoil: "Torpaq uyğunluğu",
      weightSoilHint: "Torpaq pH uyğunluğunu və fəsilə növbələşməsini üstün tutur.",
      weightIncome: "Gəlir",
      weightIncomeHint: "Bazar qiymətləri və gəlir indeksini əlavə edən aqroiqtisadi bölmə (Su və Torpaq prioritetləri əsasdır).",
      effectiveWeightsTitle: "Mühərrikin tətbiq etdiyi çəkilər",
      requestedVsEffective: "İstənilən və tətbiq edilən çəkilər",
      inputSummaryTitle: "Aktiv sahə girişləri",
      topRankedLabel: "Bu girişlər üçün ən yüksək sıralanan",
      yearLabel: "İl",
      suitabilityScore: "Uyğunluq skoru (0–100)",
      scoreDisclaimer: "Yalnız bu girişlərə görə sıralama balıdır — məhsuldarlıq faizi və ya AZN qazanc deyil.",
      waterFit: "Su uyğunluğu",
      soilFit: "Torpaq uyğunluğu",
      incomeFit: "Gəlir",
      whyTitle: "Niyə bu plan?",
      constraintsTitle: "Aqronomik qayda yoxlamaları",
      warningsTitle: "Xəbərdarlıqlar və məhdudiyyətlər",
      rejectedTitle: "Kənarlaşdırılan kombinasiyalar",
      emptyTitle: "Hələ hesablama aparılmayıb",
      emptyBody: "Sahə girişlərini yoxlayıb Alternativləri müqayisə et düyməsini sıxın.",
      noFeasibleTitle: "Cari məhdudiyyətlərə uyğun plan tapılmadı",
      noFeasibleBody: "Üçillik ardıcıllıqlardan heç biri bütün su, pH və ya ardıcıllıq tələblərini ödəmədi. Səbəbləri yoxlayın və girişləri yeniləyin.",
      needsDataTitle: "Hesablama üçün məlumat tələb olunur",
      needsDataBody: "Zəruri sahə və ya iqlim məlumatı çatışmır. Müqayisədən əvvəl Məlumatları tamamla addımına keçin.",
      provisionalBanner: "Sahə bazası: bütün standart parametrlər aktivdir, fərdi lab ölçümü ilə yeniləyə bilərsiniz.",
      indicatorsTitle: "Aqronomik və davamlılıq göstəriciləri",
      nitrogenFixation: "Azot fiksasiyası",
      erosionCover: "Eroziya qoruması",
      climateResilience: "İqlim davamlılığı",
      bareSoilGap: "Çılpaq torpaq dövrü",
      avgWaterDemand: "Orta su tələbi",
      benefitsTitle: "Əsas üstünlüklər",
      risksTitle: "Risk amilləri və qeydlər",
      benchmarkTitle: "Təkbitkili baza müqayisəsi",
      benchmarkSubtitle: "Əvvəlki bitkinin 3 il ardıcıl növbələşməsiz təkrarlanması",
      monthsUnit: "ay / 3 il",
      selectedBtn: "Seçildi",
      selectPlanPrefix: "Planı seç:",
      constraintPassLabel: "KEÇDİ",
    },
    scenarios: {
      title: "Ssenari laboratoriyası",
      subtitle: "Yağıntı fərziyyələrinin plan müqayisəsinə təsirini araşdırın.",
      panoramaDisclaimer: "Dekorativ peyk relyef fonudur — seçilmiş sahənin real şəkli kimi təqdim edilmir.",
      baselineTitle: "Baza (Baseline)",
      baselineSubtitle: "100% tarixi yağıntı (istinad)",
      stressTitle: "Yağıntı stressi",
      stressSubtitle: "Azaldılmış hipotetik yağıntı sınağı",
      rainfallChangeLabel: "Yağıntı dəyişimi",
      steppedRangeHint: "Addımlı aralıq (−10% ilə −30% arası)",
      waterSupplyLabel: "Effektiv su təminatı",
      effectivePrecipLabel: "Effektiv yağıntı",
      topPlanLabel: "Ən yüksək sıralanan ardıcıllıq",
      planScoreLabel: "Seçilmiş plan skoru",
      waterComponentLabel: "Su komponenti",
      soilComponentLabel: "Torpaq komponenti",
      noRankingChange: "Bu ssenari altında sıralama dəyişməyib.",
      planBecameInfeasible: "Baza planınız azaldılmış su altında bu stress çıxışında mövcud deyil.",
      pinnedFailedRulesLabel: "Stress altında pozulan aqronomik qaydalar",
      pinnedReferenceLabel: "Qiymətləndirilən baza planı",
      pinnedWaterGapNote: "Bu yağıntı azalması altında uyğunsuz hesab edildi — pozulan qaydaya baxın.",
      notForecastNote: "Bu sınaq tarixi yağıntı üzərində hipotetik həssaslıq testidir — gələcək hava proqnozu deyil.",
      contextMismatchWarning: "Xəbərdarlıq: Baza və stress nəticələri fərqli dataset versiyalarına istinad edir.",
      accordionTitle: "Ssenari detalları",
      accChanged: "Hansı parametr dəyişdi?",
      accUnchanged: "Hansı girişlər sabit qaldı?",
      accRules: "Hansı qayda və göstərici təsir etdi?",
      accLimits: "Məhdudiyyətlər və qeyri-müəyyənlik",
      runPromptTitle: "Yağıntı azalma səviyyəsini seçin və hesablayın",
      runPromptBody: "−10%, −20% və ya −30% yağıntı fərziyyəsini seçib Ssenarini hesabla düyməsini sıxın.",
    },
    sources: {
      title: "Hər qərarı anlayın",
      subtitle: "Seçilmiş planın əsaslandığı girişləri, qaydaları və məhdudiyyətləri görün.",
      selectedRotationTitle: "Seçilmiş əkin planı",
      noPlanSelected: "Hələ seçilmiş plan yoxdur. Əvvəlcə Əkin planları səhifəsində hesablayın.",
      unknownInputsTitle: "Torpaq & Lab Hazırlıq Statusu",
      noUnknownInputs: "Sahənin bütün Lab pH, Humus, NPK, suvarma və əvvəlki əkin məlumatları təsdiqlənib və aktivdir.",
      flowTitle: "Qərar mənşə zənciri",
      flowInputs: "Girişlər",
      flowRules: "Qaydalar",
      flowComparison: "Müqayisə",
      provenanceCardsTitle: "Məlumat mənbələri və mənşə",
      nasaCardTitle: "NASA POWER",
      soilCardTitle: "Yerli torpaq girişləri",
      rulesCardTitle: "Bitki qaydaları",
      providerField: "Provayder",
      datasetField: "Məlumat dəsti",
      periodField: "Müşahidə dövrü",
      unitsField: "Vahidlər",
      resolutionField: "Məkan dəqiqliyi",
      retrievedField: "Alınma vaxtı",
      kindField: "Mənbə növü",
      hashField: "SHA-256 heşi",
      sourceUrlField: "Mənbə URL-i",
      gibsField: "NASA EOSDIS GIBS peyk qatları",
      gibsValue: "MODIS Terra NDVI (16 gün), SMAP L4 Üst Torpaq Nəmliyi (9 km), GPM IMERG Yağıntı, MODIS Terra Gündüz LST (2024-07-11 WMTS)",
      nasaAttributionNote: "Açıq NASA Yer Elmləri məlumat atribusiyası (NASA LaRC POWER & NASA EOSDIS GIBS); rəsmi NASA təsdiqi anlamına gəlmir.",
      compactHashLabel: "Qısa SHA-256",
      fullHashLabel: "Tam SHA-256",
      downloadedToast: "Nəticə JSON faylı endirildi",
      rulesListTitle: "Seçilmiş plana tətbiq olunan aqronomik qaydalar",
      noSimYetNote: "Real cavab metadata-sını və ixrac JSON-unu görmək üçün simulyasiya icra edin.",
      methodologyModalTitle: "SpaceFarm Elmi Metodologiyası (v0.1.0)",
      methodologyParagraphs: [
        "1. İqlim və Torpaq-Su Telemetriyası: SpaceFarm UTC təqvim sərhədləri ilə NASA LaRC POWER (MERRA-2 0.5° × 0.625°) gündəlik aqro-iqlim parametrlərini (T2M, T2M_MIN, T2M_MAX, PRECTOTCORR, canlı rejimdə isə əlavə GWETTOP, GWETROOT torpaq nəmliyi və ALLSKY_SFC_SW_DWN günəş radiasiyası) əldə edir.",
        "2. Peyk Yer Müşahidə Qatları: Orbital Explorer xəritəsində bitki örtüyü (MODIS Terra NDVI 16-Day), torpaq nəmliyi (SMAP L4 9 km), yağıntı intensivliyi (GPM IMERG) və səth temperaturu (MODIS Daytime LST) üzrə real NASA EOSDIS GIBS WMTS qatları göstərilir.",
        "3. Torpaq Lab & pH İnteqrasiyası: Hər qeydiyyatlı sahə profili pH, Humus (%), Azot (N), Fosfor (P2O5), Kalium (K2O), elektrik keçiriciliyi (EC) və nəmlik tutumu üzrə baza və ya laboratoriya göstəriciləri ilə SQLite bazasında saxlanılır və istifadəçi tərəfindən real lab nəticəsi ilə yenilənə bilər.",
        "4. Deterministik Dövriyyə Mühərriki: Üçillik planlar ardıcıl eyni bitki/fəsilə məhdudiyyətini, azot fiksasiyası, eroziya qoruması və iqlim davamlılığını hesablayır; Gəlir göstəricisi yerli bazar qiymətləri əlavə olunduqda fərdiləşdirilir.",
        "5. Hipotetik Stress Sınaqları və Atribusiya: Ssenari laboratoriyası digər bütün sahə girişlərini sabit saxlayaraq yağıntını 0.9×, 0.8× və ya 0.7× miqyaslayır. Məlumatlar rəsmi NASA təsdiqi iddiası olmadan NASA açıq məlumat atribusiyası altında təqdim olunur.",
      ],
      challengeMatrixTitle: "NASA Space Apps Challenge — Field Shift Data Uyğunluğu",
      challengeMatrixSubtitle: "Rəsmi NASA, USGS və tərəfdaş Yer elmləri məlumat dəstlərinin SpaceFarm canlı telemetriyası və istinad qatları ilə izlənilə bilən bağlantısı.",
      challengeLiveBadge: "Canlı API Qoşuludur",
      challengeReferenceBadge: "Rəsmi İstinad / Genişlənmə",
      openOfficialSource: "Rəsmi mənbəni aç",
    },
  },
};

export function formatLocaleNumber(
  value: number | null | undefined,
  locale: Locale,
  digits = 1,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat(locale === "az" ? "az-Latn-AZ" : "en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatLocaleDateTime(iso: string | null | undefined, locale: Locale): string {
  if (!iso) return "—";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  return new Intl.DateTimeFormat(locale === "az" ? "az-Latn-AZ" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(dt) + " UTC";
}

export function getModeLabel(
  mode: DataMode,
  _synthetic: boolean,
  t: TranslationDictionary,
): string {
  if (mode === "cached") return t.badges.cachedData;
  return t.badges.liveData;
}

export function getSimulationStatusLabel(
  status: SimulationStatus,
  t: TranslationDictionary,
): string {
  switch (status) {
    case "completed":
      return t.badges.completed;
    case "provisional":
      return t.badges.provisional;
    case "needs_data":
      return t.badges.needsData;
    case "no_feasible_plan":
      return t.badges.noFeasiblePlan;
  }
}

export function getValidationStatusLabel(
  status: ValidationStatus,
  t: TranslationDictionary,
): string {
  switch (status) {
    case "source_supported":
      return t.badges.sourceSupported;
    case "expert_reviewed":
      return t.badges.expertReviewed;
    case "provisional":
      return t.badges.provisional;
  }
}
