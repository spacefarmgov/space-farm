import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  SpaceFarmApiError,
  activateFarmParcel,
  createFarmParcel,
  deleteFarmParcel,
  fetchAlertsOverview,
  fetchClimateFeaturesWithMode,
  fetchClimateTimeseriesWithMode,
  fetchExtendedCrops,
  fetchHealthSafe,
  fetchUserProfile,
  loginAccount,
  registerAccount,
  runSimulationWithMode,
  saveUserProfile,
  updateFarmParcel,
  type AuthSessionResponse,
  type WeatherAlertRecord,
  type WorkspaceLabMetrics,
  type WorkspaceParcel,
  type WorkspaceUserProfile,
} from "../api/extendedClient";
import type {
  ClimateBundle,
  ClimateTimeseriesBundle,
  ExtendedCropCatalog,
  HealthResponse,
  SimulationResponse,
} from "../api/uiTypes";
import {
  DEFAULT_CLIMATE_PERIOD,
  VERIFIED_AZ_REGIONS,
  createDraftFromRegion,
  toSimulationRequest,
  validateDraftForSimulation,
  type FieldDraft,
  type PriorityWeights,
} from "../data/regions";
import { TRANSLATIONS, type Locale, type TranslationDictionary } from "../locales/translations";
import {
  SpaceFarmContext,
  type ApiUiError,
  type AuthActionResult,
  type AuthUser,
  type OrbitalSelectionInput,
  type SourceDrawerSection,
  type SpaceFarmContextValue,
  type SpaceFarmNotification,
  type ThemeMode,
} from "./spaceFarmContextObj";

export type {
  ApiUiError,
  AuthActionResult,
  AuthUser,
  OrbitalSelectionInput,
  SourceDrawerSection,
  SpaceFarmNotification,
  ThemeMode,
} from "./spaceFarmContextObj";
import {
  createDraftFromAzDistrict,
  findAzDistrict,
  resolveRegionPresetOrDistrict,
} from "../data/azDistricts";

const LOCALE_STORAGE_KEY = "spacefarm_ui_locale";
const THEME_STORAGE_KEY = "spacefarm_ui_theme";
const NOTIF_READ_KEY = "spacefarm_read_notifications";
const AUTH_USER_KEY = "spacefarm_auth_user";
const AUTH_TOKEN_KEY = "spacefarm_auth_token";
const SIDEBAR_EXPANDED_KEY = "spacefarm_sidebar_expanded";

function mapParcelToDraftPatch(parcel: WorkspaceParcel): Partial<FieldDraft> {
  const matchedRegion = resolveRegionPresetOrDistrict(parcel.region_id);
  const fallbackLab = matchedRegion?.labMetrics ?? VERIFIED_AZ_REGIONS[0].labMetrics;
  const rawLab = parcel.lab_metrics ?? {};
  const soilPh = parcel.soil_ph ?? matchedRegion?.ph ?? 6.8;
  const irrig = parcel.irrigation_type !== "unknown" ? parcel.irrigation_type : matchedRegion?.irrigationType ?? "irrigated";
  const texture = parcel.soil_texture !== "unknown" ? parcel.soil_texture : matchedRegion?.texture ?? "loam";
  return {
    regionPresetId: matchedRegion ? matchedRegion.id : null,
    farmId: parcel.id,
    label: parcel.label,
    hasBoundary: Boolean(matchedRegion?.hasBoundary),
    latitude: parcel.latitude,
    longitude: parcel.longitude,
    areaHa: parcel.area_ha,
    irrigationType: irrig,
    irrigationBudgetMm: parcel.irrigation_budget_mm ?? matchedRegion?.irrigationBudgetMm ?? 240,
    soilPhKnown: true,
    soilPh,
    soilTexture: texture,
    soilSourceType: rawLab.soil_source_type === "laboratory" || !rawLab.soil_source_type ? "laboratory" : "user_reported",
    soilSourceRef: rawLab.lab_report_id || matchedRegion?.soilSourceRef || "LAB-AZ-2025",
    soilSampleDate: rawLab.sample_date || matchedRegion?.soilSampleDate || "2025-03-14",
    soilDepthTopCm: String(rawLab.depth_top_cm ?? matchedRegion?.soilDepthTopCm ?? "0"),
    soilDepthBottomCm: String(rawLab.depth_bottom_cm ?? matchedRegion?.soilDepthBottomCm ?? "30"),
    labMetrics: {
      organicMatterPct: rawLab.organic_matter_pct ?? fallbackLab.organicMatterPct,
      nitrogenMgKg: rawLab.nitrogen_mg_kg ?? fallbackLab.nitrogenMgKg,
      phosphorusMgKg: rawLab.phosphorus_mg_kg ?? fallbackLab.phosphorusMgKg,
      potassiumMgKg: rawLab.potassium_mg_kg ?? fallbackLab.potassiumMgKg,
      ecDsM: rawLab.ec_ds_m ?? fallbackLab.ecDsM,
      moistureCapacityPct: rawLab.moisture_capacity_pct ?? fallbackLab.moistureCapacityPct,
    },
    priorCropId: parcel.prior_crop_id || "wheat",
  };
}

function readInitialTheme(): ThemeMode {
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    return saved === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

function readNotificationIds(): string[] {
  try {
    const raw = window.localStorage.getItem(NOTIF_READ_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function readInitialAuthUser(): AuthUser | null {
  try {
    const raw = window.localStorage.getItem(AUTH_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AuthUser>;
    if (parsed && typeof parsed.email === "string" && typeof parsed.name === "string") {
      return {
        id: typeof parsed.id === "string" ? parsed.id : "user-local",
        name: parsed.name,
        email: parsed.email,
        region: typeof parsed.region === "string" ? parsed.region : undefined,
      };
    }
    return null;
  } catch {
    return null;
  }
}

function readInitialLocale(): Locale {
  try {
    const saved = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return saved === "az" ? "az" : "en";
  } catch {
    return "en";
  }
}

function draftFingerprint(draft: FieldDraft, weights: PriorityWeights): string {
  return JSON.stringify({
    lat: Number(draft.latitude.toFixed(4)),
    lon: Number(draft.longitude.toFixed(4)),
    area: draft.areaHa,
    irr: draft.irrigationType,
    bud: draft.irrigationType === "irrigated" ? draft.irrigationBudgetMm : null,
    phKnown: draft.soilPhKnown,
    ph: draft.soilPhKnown ? draft.soilPh : null,
    tex: draft.soilTexture,
    st: draft.soilSourceType,
    sr: draft.soilSourceRef,
    sd: draft.soilSampleDate,
    dt: draft.soilDepthTopCm,
    db: draft.soilDepthBottomCm,
    prev: draft.priorCropId,
    prevY: draft.priorCropYear,
    w: Number(weights.water.toFixed(3)),
    s: Number(weights.soil.toFixed(3)),
    i: Number(weights.income.toFixed(3)),
  });
}

function climateKey(draft: FieldDraft): string {
  return `${draft.latitude.toFixed(4)}:${draft.longitude.toFixed(4)}:${DEFAULT_CLIMATE_PERIOD.start_date}`;
}

function mapApiError(err: unknown, t: TranslationDictionary): ApiUiError {
  if (err instanceof SpaceFarmApiError) {
    const details = err.envelope?.error.details ?? [];
    const fieldErrors: Record<string, string> = {};
    for (const d of details) {
      const f = d.field.toLowerCase();
      if (f.includes("latitude")) fieldErrors.latitude = d.reason;
      else if (f.includes("longitude")) fieldErrors.longitude = d.reason;
      else if (f.includes("area")) fieldErrors.areaHa = d.reason;
      else if (f.includes("ph")) fieldErrors.soilPh = d.reason;
      else if (f.includes("source_ref")) fieldErrors.soilSourceRef = d.reason;
      else if (f.includes("budget")) fieldErrors.irrigationBudget = d.reason;
      else fieldErrors[d.field] = d.reason;
    }
    if (err.status === 422 || err.status === 400) {
      return {
        kind: "validation",
        message: err.envelope?.error.message ?? t.errors.validationTitle,
        fieldErrors,
        retryable: false,
      };
    }
    if (err.status === 503) {
      return {
        kind: "unavailable_503",
        message: err.envelope?.error.message ?? t.errors.serviceUnavailableBody,
        fieldErrors,
        retryable: true,
      };
    }
    return {
      kind: "server_500",
      message: t.errors.unexpectedBody,
      fieldErrors,
      retryable: true,
    };
  }
  return {
    kind: "network",
    message: t.errors.apiUnreachableBody,
    fieldErrors: {},
    retryable: true,
  };
}

export function SpaceFarmProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [locale, setLocaleState] = useState<Locale>(readInitialLocale);
  const t = TRANSLATIONS[locale];

  const [draft, setDraft] = useState<FieldDraft>(() => createDraftFromRegion(VERIFIED_AZ_REGIONS[0]));
  const [requestedWeights, setRequestedWeightsState] = useState<PriorityWeights>({
    water: 0.5,
    soil: 0.3,
    income: 0.2,
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [authToken, setAuthToken] = useState<string | null>(() => {
    try {
      return window.localStorage.getItem("spacefarm_auth_token");
    } catch {
      return null;
    }
  });
  const [userProfile, setUserProfile] = useState<WorkspaceUserProfile | null>(null);
  const [parcels, setParcels] = useState<WorkspaceParcel[]>([]);
  const [activeAlerts, setActiveAlerts] = useState<WeatherAlertRecord[]>([]);
  const [sidebarExpanded, setSidebarExpanded] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem("spacefarm_sidebar_expanded") === "1";
    } catch {
      return false;
    }
  });
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [cropCatalog, setCropCatalog] = useState<ExtendedCropCatalog | null>(null);

  const [climate, setClimate] = useState<ClimateBundle | null>(null);
  const [climateLoadedKey, setClimateLoadedKey] = useState<string | null>(null);
  const [climateLoading, setClimateLoading] = useState<boolean>(false);
  const [climateError, setClimateError] = useState<ApiUiError | null>(null);

  const [climateTimeseries, setClimateTimeseries] = useState<ClimateTimeseriesBundle | null>(null);
  const [timeseriesLoadedKey, setTimeseriesLoadedKey] = useState<string | null>(null);
  const [timeseriesLoading, setTimeseriesLoading] = useState<boolean>(false);
  const [timeseriesError, setTimeseriesError] = useState<string | null>(null);

  const [baselineSim, setBaselineSim] = useState<SimulationResponse | null>(null);
  const [baselineSimFingerprint, setBaselineSimFingerprint] = useState<string | null>(null);
  const [previousSimFieldLabel, setPreviousSimFieldLabel] = useState<string | null>(null);
  const [baselineLoading, setBaselineLoading] = useState<boolean>(false);
  const [baselineError, setBaselineError] = useState<ApiUiError | null>(null);

  const [rainfallMultiplier, setRainfallMultiplier] = useState<0.9 | 0.8 | 0.7>(0.8);
  const [stressSim, setStressSim] = useState<SimulationResponse | null>(null);
  const [stressLoading, setStressLoading] = useState<boolean>(false);
  const [stressError, setStressError] = useState<ApiUiError | null>(null);

  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [sourceDrawerOpen, setSourceDrawerOpen] = useState<boolean>(false);
  const [sourceDrawerSection, setSourceDrawerSection] = useState<SourceDrawerSection>("nasa");
  const [methodologyOpen, setMethodologyOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [user, setUser] = useState<AuthUser | null>(readInitialAuthUser);
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [authModalTab, setAuthModalTab] = useState<"login" | "register">("login");
  const [authAlertMessage, setAuthAlertMessage] = useState<string | null>(null);
  const [pendingRedirectPath, setPendingRedirectPath] = useState<string | null>(null);
  const [theme, setThemeState] = useState<ThemeMode>(readInitialTheme);
  const [readNotifIds, setReadNotifIds] = useState<string[]>(readNotificationIds);

  const climateAbortRef = useRef<AbortController | null>(null);
  const climateSeqRef = useRef(0);
  const tsAbortRef = useRef<AbortController | null>(null);
  const tsSeqRef = useRef(0);
  const simAbortRef = useRef<AbortController | null>(null);
  const simSeqRef = useRef(0);
  const stressAbortRef = useRef<AbortController | null>(null);
  const stressSeqRef = useRef(0);
  const toastTimerRef = useRef<number | null>(null);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // ignore storage errors
    }
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // ignore storage errors
    }
  }, [theme]);

  const setTheme = useCallback((next: ThemeMode) => {
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToastMessage(null), 3200);
  }, []);

  const persistSessionUser = useCallback((nextUser: AuthUser | null) => {
    setUser(nextUser);
    try {
      if (nextUser) {
        window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(nextUser));
      } else {
        window.localStorage.removeItem(AUTH_USER_KEY);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  const openAuthModal = useCallback(
    (
      tab: "login" | "register" = "login",
      alertMsg: string | null = null,
      redirectTo: string | null = "/explore",
    ) => {
      setAuthModalTab(tab);
      setAuthAlertMessage(alertMsg);
      setPendingRedirectPath(redirectTo ?? "/explore");
      setAuthModalOpen(false);
      navigate(tab === "register" ? "/register" : "/login", {
        state: {
          alertMessage: alertMsg,
          redirectTo: redirectTo ?? "/explore",
        },
      });
    },
    [navigate],
  );

  const closeAuthModal = useCallback(() => {
    setAuthModalOpen(false);
    setAuthAlertMessage(null);
  }, []);

  const triggerAuthAlert = useCallback(
    (targetPath = "/explore") => {
      const msg = TRANSLATIONS[locale].auth.alertRequiredBody;
      showToast(TRANSLATIONS[locale].auth.alertRequiredTitle);
      openAuthModal("login", msg, targetPath);
    },
    [locale, openAuthModal, showToast],
  );

  const applyAuthSession = useCallback(
    (token: string, profile: WorkspaceUserProfile, nextParcels: WorkspaceParcel[]) => {
      setAuthToken(token);
      setUserProfile(profile);
      setParcels(nextParcels);
      try {
        window.localStorage.setItem(AUTH_TOKEN_KEY, token);
      } catch {
        // ignore storage errors
      }
      persistSessionUser({
        id: profile.id,
        name: profile.name,
        email: profile.email,
        region: profile.region,
      });
      if (nextParcels.length > 0) {
        const primary = nextParcels.find((p) => p.is_primary) ?? nextParcels[0];
        setDraft((prev) => ({ ...prev, ...mapParcelToDraftPatch(primary) }));
      }
    },
    [persistSessionUser],
  );

  const toggleSidebarExpanded = useCallback(() => {
    setSidebarExpanded((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_EXPANDED_KEY, next ? "1" : "0");
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }, []);

  // Hydrate full SQLite user profile & linked parcels whenever auth token is active
  useEffect(() => {
    if (!authToken) {
      setActiveAlerts([]);
      return;
    }
    let cancelled = false;
    fetchUserProfile(authToken)
      .then((bundle) => {
        if (cancelled) return;
        setUserProfile(bundle.user);
        setParcels(bundle.parcels);
        if (bundle.parcels.length > 0) {
          const primary = bundle.parcels.find((p) => p.is_primary) ?? bundle.parcels[0];
          setDraft((prev) => ({ ...prev, ...mapParcelToDraftPatch(primary) }));
        }
        persistSessionUser({
          id: bundle.user.id,
          name: bundle.user.name,
          email: bundle.user.email,
          region: bundle.user.region,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof SpaceFarmApiError && err.status === 401) {
          setAuthToken(null);
          setUserProfile(null);
          setParcels([]);
          setActiveAlerts([]);
          persistSessionUser(null);
          try {
            window.localStorage.removeItem(AUTH_TOKEN_KEY);
          } catch {
            // ignore storage errors
          }
        }
      });
    fetchAlertsOverview(authToken)
      .then((overview) => {
        if (cancelled) return;
        setActiveAlerts(overview.alerts.filter((a) => a.status === "active"));
      })
      .catch(() => {
        // Non-fatal if background alerts are still initializing
      });
    return () => {
      cancelled = true;
    };
  }, [authToken, persistSessionUser]);

  const loginUser = useCallback(
    async (rawEmail: string, password: string): Promise<AuthActionResult> => {
      const dict = TRANSLATIONS[locale].auth;
      const email = rawEmail.trim().toLowerCase();
      if (!email || !email.includes("@")) {
        return { ok: false, error: dict.invalidEmail };
      }
      if (password.length < 6) {
        return { ok: false, error: dict.shortPassword };
      }
      try {
        const res = await loginAccount({ email, password });
        applyAuthSession(res.token, res.user, res.parcels);
        setAuthModalOpen(false);
        setAuthAlertMessage(null);
        showToast(dict.welcomeBack);
        return { ok: true };
      } catch (err) {
        if (err instanceof SpaceFarmApiError && err.status === 401) {
          return { ok: false, error: dict.invalidCredentials };
        }
        return {
          ok: false,
          error: err instanceof Error ? err.message : dict.invalidCredentials,
        };
      }
    },
    [applyAuthSession, locale, showToast],
  );

  const registerUser = useCallback(
    async (
      rawName: string,
      rawEmail: string,
      password: string,
      region?: string,
    ): Promise<AuthActionResult> => {
      const dict = TRANSLATIONS[locale].auth;
      const name = rawName.trim();
      const email = rawEmail.trim().toLowerCase();

      if (name.length < 2) {
        return { ok: false, error: dict.shortName };
      }
      if (!email || !email.includes("@")) {
        return { ok: false, error: dict.invalidEmail };
      }
      if (password.length < 6) {
        return { ok: false, error: dict.shortPassword };
      }

      try {
        const res = await registerAccount({
          name,
          email,
          password,
          region: region?.trim() || "Ganja-Dashkasan",
        });
        applyAuthSession(res.token, res.user, res.parcels);
        setAuthModalOpen(false);
        setAuthAlertMessage(null);
        showToast(dict.accountCreated);
        return { ok: true };
      } catch (err) {
        if (err instanceof SpaceFarmApiError && err.status === 409) {
          return { ok: false, error: dict.emailExists };
        }
        return {
          ok: false,
          error:
            err instanceof Error
              ? err.message
              : TRANSLATIONS[locale].errors.unexpectedTitle,
        };
      }
    },
    [applyAuthSession, locale, showToast],
  );

  const establishAuthSession = useCallback(
    (session: AuthSessionResponse, toastText?: string) => {
      applyAuthSession(session.token, session.user, session.parcels);
      setAuthModalOpen(false);
      setAuthAlertMessage(null);
      if (toastText) {
        showToast(toastText);
      }
    },
    [applyAuthSession, showToast],
  );

  const logoutUser = useCallback(() => {
    setAuthToken(null);
    setUserProfile(null);
    setParcels([]);
    try {
      window.localStorage.removeItem(AUTH_TOKEN_KEY);
    } catch {
      // ignore storage errors
    }
    persistSessionUser(null);
    setPendingRedirectPath(null);
    showToast(TRANSLATIONS[locale].auth.loggedOut);
  }, [locale, persistSessionUser, showToast]);

  const updateProfile = useCallback(
    async (patch: Parameters<SpaceFarmContextValue["updateProfile"]>[0]) => {
      if (!authToken) return { ok: false, error: "Not authenticated" };
      try {
        const res = await saveUserProfile(authToken, patch);
        setUserProfile(res.user);
        setParcels(res.parcels);
        persistSessionUser({
          id: res.user.id,
          name: res.user.name,
          email: res.user.email,
          region: res.user.region,
        });
        showToast(TRANSLATIONS[locale].profilePage.savedToast);
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Failed to save profile" };
      }
    },
    [authToken, locale, persistSessionUser, showToast],
  );

  const addParcel = useCallback(
    async (payload: Parameters<SpaceFarmContextValue["addParcel"]>[0]) => {
      if (!authToken) return { ok: false, error: "Not authenticated" };
      try {
        const res = await createFarmParcel(authToken, payload);
        setParcels(res.parcels);
        const primary = res.parcels.find((p) => p.is_primary) ?? res.parcels[0];
        if (primary) {
          setDraft((prev) => ({ ...prev, ...mapParcelToDraftPatch(primary) }));
        }
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Failed to add parcel" };
      }
    },
    [authToken],
  );

  const setActiveParcel = useCallback(
    async (parcelId: string) => {
      if (!authToken) return { ok: false, error: "Not authenticated" };
      try {
        const res = await activateFarmParcel(authToken, parcelId);
        setParcels(res.parcels);
        const primary = res.parcels.find((p) => p.is_primary) ?? res.parcels[0];
        if (primary) {
          setDraft((prev) => ({ ...prev, ...mapParcelToDraftPatch(primary) }));
        }
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Failed to activate parcel" };
      }
    },
    [authToken],
  );

  const removeParcel = useCallback(
    async (parcelId: string) => {
      if (!authToken) return { ok: false, error: "Not authenticated" };
      try {
        const res = await deleteFarmParcel(authToken, parcelId);
        setParcels(res.parcels);
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Failed to delete parcel" };
      }
    },
    [authToken],
  );

  const saveActiveParcelInputs = useCallback(
    async (overrideDraft?: FieldDraft) => {
      if (!authToken) return { ok: false, error: "Not authenticated" };
      const target = overrideDraft ?? draft;
      const primary = parcels.find((p) => p.is_primary) ?? parcels[0];
      if (!primary) return { ok: false, error: "No active parcel found" };
      try {
        const labPayload: WorkspaceLabMetrics = {
          organic_matter_pct: Number(target.labMetrics.organicMatterPct),
          nitrogen_mg_kg: Number(target.labMetrics.nitrogenMgKg),
          phosphorus_mg_kg: Number(target.labMetrics.phosphorusMgKg),
          potassium_mg_kg: Number(target.labMetrics.potassiumMgKg),
          ec_ds_m: Number(target.labMetrics.ecDsM),
          moisture_capacity_pct: Number(target.labMetrics.moistureCapacityPct),
          depth_top_cm: Number(target.soilDepthTopCm || 0),
          depth_bottom_cm: Number(target.soilDepthBottomCm || 30),
          sample_date: target.soilSampleDate || "2025-03-14",
          lab_report_id: target.soilSourceRef || "LAB-AZ-2025",
          soil_source_type: target.soilSourceType === "laboratory" ? "laboratory" : "user_reported",
        };
        const irrigType: "rainfed" | "irrigated" =
          target.irrigationType === "rainfed" ? "rainfed" : "irrigated";
        const texType: "sand" | "loam" | "clay" | "other" =
          target.soilTexture === "sand" ||
          target.soilTexture === "clay" ||
          target.soilTexture === "other"
            ? target.soilTexture
            : "loam";
        const res = await updateFarmParcel(authToken, primary.id, {
          label: target.label,
          region_id: target.regionPresetId ?? primary.region_id,
          latitude: Number(target.latitude.toFixed(4)),
          longitude: Number(target.longitude.toFixed(4)),
          area_ha: Number(target.areaHa),
          irrigation_type: irrigType,
          irrigation_budget_mm: irrigType === "irrigated" ? Number(target.irrigationBudgetMm) : null,
          soil_ph: Number(target.soilPh.toFixed(1)),
          soil_texture: texType,
          prior_crop_id: target.priorCropId || "wheat",
          lab_metrics: labPayload,
        });
        setParcels(res.parcels);
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Failed to save parcel lab inputs" };
      }
    },
    [authToken, draft, parcels],
  );

  // Load API health & crop catalog on boot without inventing synthetic fallback
  useEffect(() => {
    let cancelled = false;
    fetchHealthSafe().then((h) => {
      if (!cancelled && h) setHealth(h);
    });
    fetchExtendedCrops()
      .then((cat) => {
        if (!cancelled) setCropCatalog(cat);
      })
      .catch(() => {
        // Handled cleanly at page level when needed
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Cleanup active request controllers on unmount
  useEffect(() => {
    return () => {
      climateAbortRef.current?.abort();
      tsAbortRef.current?.abort();
      simAbortRef.current?.abort();
      stressAbortRef.current?.abort();
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  const selectedRegion = useMemo(
    () => resolveRegionPresetOrDistrict(draft.regionPresetId),
    [draft.regionPresetId],
  );

  const currentFingerprint = useMemo(
    () => draftFingerprint(draft, requestedWeights),
    [draft, requestedWeights],
  );

  const isStale = Boolean(baselineSim && baselineSimFingerprint !== currentFingerprint);
  const climateStale = Boolean(climate && climateLoadedKey !== climateKey(draft));
  const timeseriesStale = Boolean(climateTimeseries && timeseriesLoadedKey !== climateKey(draft));

  const updateDraft = useCallback((patch: Partial<FieldDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
    setFieldErrors({});
  }, []);

  const selectRegion = useCallback((regionId: string) => {
    const primary = VERIFIED_AZ_REGIONS.find((r) => r.id === regionId) ?? null;
    const district = primary ? null : findAzDistrict(regionId);
    if (!primary && !district) return;
    climateAbortRef.current?.abort();
    tsAbortRef.current?.abort();
    simAbortRef.current?.abort();
    stressAbortRef.current?.abort();
    if (baselineSim) {
      setPreviousSimFieldLabel(draft.label);
    }
    setDraft(primary ? createDraftFromRegion(primary) : createDraftFromAzDistrict(district!, locale));
    setClimateLoading(false);
    setTimeseriesLoading(false);
    setBaselineLoading(false);
    setStressLoading(false);
    setFieldErrors({});
    setClimateError(null);
    setTimeseriesError(null);
    setBaselineError(null);
    setStressError(null);
  }, [baselineSim, draft.label, locale]);

  const setCustomCoordinates = useCallback(
    (lat: number, lon: number, label?: string) => {
      climateAbortRef.current?.abort();
      tsAbortRef.current?.abort();
      simAbortRef.current?.abort();
      stressAbortRef.current?.abort();
      if (baselineSim) {
        setPreviousSimFieldLabel(draft.label);
      }
      setDraft((prev) => ({
        ...prev,
        regionPresetId: null,
        farmId: `custom-${lat.toFixed(2)}-${lon.toFixed(2)}`,
        label: label ?? `Custom Field (${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E)`,
        hasBoundary: false,
        latitude: Number(lat.toFixed(4)),
        longitude: Number(lon.toFixed(4)),
      }));
      setClimateLoading(false);
      setTimeseriesLoading(false);
      setTimeseriesError(null);
      setBaselineLoading(false);
      setStressLoading(false);
      setFieldErrors({});
    },
    [baselineSim, draft.label],
  );

  const setRequestedWeights = useCallback((next: PriorityWeights) => {
    setRequestedWeightsState(next);
    setFieldErrors({});
  }, []);

  const validateInputs = useCallback(() => {
    const errs = validateDraftForSimulation(draft, requestedWeights);
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }, [draft, requestedWeights]);

  const loadTimeseriesForField = useCallback(
    async (targetDraft?: FieldDraft) => {
      const active = targetDraft ?? draft;

      tsAbortRef.current?.abort();
      const controller = new AbortController();
      tsAbortRef.current = controller;
      const seq = ++tsSeqRef.current;

      setTimeseriesLoading(true);
      setTimeseriesError(null);
      try {
        const res = await fetchClimateTimeseriesWithMode(
          {
            latitude: Number(active.latitude.toFixed(4)),
            longitude: Number(active.longitude.toFixed(4)),
            start_date: "2015-01-01",
            end_date: "2024-12-31",
            time_standard: "UTC",
          },
          undefined,
          controller.signal,
        );
        if (seq !== tsSeqRef.current) return;
        setClimateTimeseries(res);
        setTimeseriesLoadedKey(climateKey(active));
      } catch (err) {
        if (controller.signal.aborted || seq !== tsSeqRef.current) return;
        setTimeseriesError(mapApiError(err, t).message);
      } finally {
        if (seq === tsSeqRef.current) {
          setTimeseriesLoading(false);
        }
      }
    },
    [draft, t],
  );

  const loadClimateForField = useCallback(
    async (targetDraft?: FieldDraft) => {
      const active = targetDraft ?? draft;

      climateAbortRef.current?.abort();
      const controller = new AbortController();
      climateAbortRef.current = controller;
      const seq = ++climateSeqRef.current;

      void loadTimeseriesForField(active);

      setClimateLoading(true);
      setClimateError(null);
      try {
        const res = await fetchClimateFeaturesWithMode(
          {
            latitude: Number(active.latitude.toFixed(4)),
            longitude: Number(active.longitude.toFixed(4)),
            start_date: DEFAULT_CLIMATE_PERIOD.start_date,
            end_date: DEFAULT_CLIMATE_PERIOD.end_date,
            time_standard: "UTC",
          },
          undefined,
          controller.signal,
        );
        if (seq !== climateSeqRef.current) return;
        setClimate(res);
        setClimateLoadedKey(climateKey(active));
      } catch (err) {
        if (controller.signal.aborted || seq !== climateSeqRef.current) return;
        setClimateError(mapApiError(err, t));
      } finally {
        if (seq === climateSeqRef.current) {
          setClimateLoading(false);
        }
      }
    },
    [draft, loadTimeseriesForField, t],
  );

  const runBaselineSimulation = useCallback(
    async (targetDraft?: FieldDraft) => {
      const active = targetDraft ?? draft;
      const errs = validateDraftForSimulation(active, requestedWeights);
      if (Object.keys(errs).length > 0) {
        setFieldErrors(errs);
        setBaselineError({
          kind: "validation",
          message: t.errors.validationTitle,
          fieldErrors: errs,
          retryable: false,
        });
        return;
      }

      simAbortRef.current?.abort();
      const controller = new AbortController();
      simAbortRef.current = controller;
      const seq = ++simSeqRef.current;

      setBaselineLoading(true);
      setBaselineError(null);
      try {
        const payload = toSimulationRequest(active, requestedWeights, 1.0);
        const res = await runSimulationWithMode(payload, undefined, controller.signal);
        if (seq !== simSeqRef.current) return;
        setBaselineSim(res);
        setBaselineSimFingerprint(draftFingerprint(active, requestedWeights));
        setPreviousSimFieldLabel(null);
        setClimate(res.climate);
        setClimateLoadedKey(climateKey(active));
        setSelectedPlanId((prevId) => {
          if (prevId && res.plans.some((p) => p.plan_id === prevId)) return prevId;
          return res.plans[0]?.plan_id ?? null;
        });
        setStressSim(null);
      } catch (err) {
        if (controller.signal.aborted || seq !== simSeqRef.current) return;
        const mapped = mapApiError(err, t);
        if (Object.keys(mapped.fieldErrors).length > 0) {
          setFieldErrors((prev) => ({ ...prev, ...mapped.fieldErrors }));
        }
        setBaselineError(mapped);
      } finally {
        if (seq === simSeqRef.current) {
          setBaselineLoading(false);
        }
      }
    },
    [draft, requestedWeights, t],
  );

  const applyOrbitalSelection = useCallback(
    (selection: OrbitalSelectionInput, runPipeline = false): FieldDraft => {
      climateAbortRef.current?.abort();
      tsAbortRef.current?.abort();
      simAbortRef.current?.abort();
      stressAbortRef.current?.abort();
      if (baselineSim) {
        setPreviousSimFieldLabel(draft.label);
      }

      const mappedRegionId =
        selection.presetId === "ganja" ? "ganja-dashkasan" : selection.presetId;
      const matchedPreset = mappedRegionId
        ? VERIFIED_AZ_REGIONS.find((r) => r.id === mappedRegionId) ?? null
        : null;
      const matchedDistrict =
        !matchedPreset && mappedRegionId ? findAzDistrict(mappedRegionId) : null;

      const cleanLat = Number(selection.lat.toFixed(4));
      const cleanLon = Number(selection.lon.toFixed(4));
      const cleanAreaHa = Number(Math.max(0.5, selection.areaHa).toFixed(1));

      const nextDraft: FieldDraft = matchedPreset
        ? {
            ...createDraftFromRegion(matchedPreset),
            latitude: cleanLat,
            longitude: cleanLon,
            label: selection.label || matchedPreset.nameEn,
            areaHa: cleanAreaHa,
          }
        : matchedDistrict
          ? {
              ...createDraftFromAzDistrict(matchedDistrict, locale),
              areaHa: cleanAreaHa,
            }
          : {
              ...draft,
              regionPresetId: null,
              farmId: `orbital-${cleanLat.toFixed(2)}-${cleanLon.toFixed(2)}`,
              label:
                selection.label ||
                `Orbital Sector (${cleanLat.toFixed(2)}°N, ${cleanLon.toFixed(2)}°E)`,
              hasBoundary: false,
              latitude: cleanLat,
              longitude: cleanLon,
              areaHa: cleanAreaHa,
            };

      setDraft(nextDraft);
      setClimateLoading(false);
      setTimeseriesLoading(false);
      setBaselineLoading(false);
      setStressLoading(false);
      setFieldErrors({});
      setClimateError(null);
      setTimeseriesError(null);
      setBaselineError(null);
      setStressError(null);

      if (runPipeline) {
        void loadClimateForField(nextDraft);
        void runBaselineSimulation(nextDraft);
      }
      return nextDraft;
    },
    [baselineSim, draft, loadClimateForField, locale, runBaselineSimulation],
  );

  const runStressSimulation = useCallback(
    async (mult?: 0.9 | 0.8 | 0.7) => {
      const m = mult ?? rainfallMultiplier;
      const errs = validateDraftForSimulation(draft, requestedWeights);
      if (Object.keys(errs).length > 0) {
        setFieldErrors(errs);
        setStressError({
          kind: "validation",
          message: t.errors.validationTitle,
          fieldErrors: errs,
          retryable: false,
        });
        return;
      }

      stressAbortRef.current?.abort();
      const controller = new AbortController();
      stressAbortRef.current = controller;
      const seq = ++stressSeqRef.current;

      setStressLoading(true);
      setStressError(null);
      try {
        // Keep baseline and stress locked to the exact same request parameters except scenario
        let activePinnedId = selectedPlanId;
        if (!baselineSim || isStale) {
          const basePayload = toSimulationRequest(draft, requestedWeights, 1.0);
          const baseRes = await runSimulationWithMode(basePayload, undefined, controller.signal);
          if (seq !== stressSeqRef.current) return;
          setBaselineSim(baseRes);
          setBaselineSimFingerprint(currentFingerprint);
          setPreviousSimFieldLabel(null);
          setClimate(baseRes.climate);
          setClimateLoadedKey(climateKey(draft));
          const resolvedId =
            selectedPlanId && baseRes.plans.some((p) => p.plan_id === selectedPlanId)
              ? selectedPlanId
              : (baseRes.plans[0]?.plan_id ?? null);
          activePinnedId = resolvedId;
          setSelectedPlanId(resolvedId);
        } else if (!activePinnedId || !baselineSim.plans.some((p) => p.plan_id === activePinnedId)) {
          activePinnedId = baselineSim.plans[0]?.plan_id ?? null;
        }

        const stressPayload = toSimulationRequest(draft, requestedWeights, m, activePinnedId);
        const stressRes = await runSimulationWithMode(stressPayload, undefined, controller.signal);
        if (seq !== stressSeqRef.current) return;
        setStressSim(stressRes);
      } catch (err) {
        if (controller.signal.aborted || seq !== stressSeqRef.current) return;
        setStressError(mapApiError(err, t));
      } finally {
        if (seq === stressSeqRef.current) {
          setStressLoading(false);
        }
      }
    },
    [baselineSim, currentFingerprint, draft, isStale, rainfallMultiplier, requestedWeights, selectedPlanId, t],
  );

  const resetStressComparison = useCallback(() => {
    stressAbortRef.current?.abort();
    setStressSim(null);
    setStressError(null);
  }, []);

  const openSourceDrawer = useCallback((section: SourceDrawerSection = "nasa") => {
    setSourceDrawerSection(section);
    setSourceDrawerOpen(true);
  }, []);

  const closeSourceDrawer = useCallback(() => {
    setSourceDrawerOpen(false);
  }, []);

  const openMethodology = useCallback(() => setMethodologyOpen(true), []);
  const closeMethodology = useCallback(() => setMethodologyOpen(false), []);

  const selectedPlan = useMemo(() => {
    if (!baselineSim?.plans?.length) return null;
    return (
      baselineSim.plans.find((p) => p.plan_id === selectedPlanId) ?? baselineSim.plans[0] ?? null
    );
  }, [baselineSim, selectedPlanId]);

  const notifications = useMemo<SpaceFarmNotification[]>(() => {
    const isAz = locale === "az";
    const items: Omit<SpaceFarmNotification, "read">[] = [
      {
        id: `notif-snapshot-${selectedRegion?.id ?? "custom"}`,
        title: isAz
          ? `NASA POWER 2024 Snapshot hazırdır`
          : `NASA POWER 2024 Snapshot Ready`,
        detail: isAz
          ? `${draft.label} (${draft.latitude.toFixed(2)}°N, ${draft.longitude.toFixed(2)}°E) üzrə 366/366 gün iqlim seriyası aktivdir.`
          : `366/366 daily climate telemetry active for ${draft.label} (${draft.latitude.toFixed(2)}°N, ${draft.longitude.toFixed(2)}°E).`,
        route: "/climate",
        tone: "cyan",
      },
      {
        id: `notif-soil-lab-${draft.soilPh}-${draft.labMetrics.organicMatterPct}`,
        title: isAz
          ? `Lab pH (${draft.soilPh.toFixed(1)}) & Torpaq Profili Aktivdir`
          : `Lab pH (${draft.soilPh.toFixed(1)}) & Soil Chemistry Active`,
        detail: isAz
          ? `Humus ${draft.labMetrics.organicMatterPct.toFixed(1)}%, NPK (${draft.labMetrics.nitrogenMgKg}/${draft.labMetrics.phosphorusMgKg}/${draft.labMetrics.potassiumMgKg} mq/kq) və EC ${draft.labMetrics.ecDsM.toFixed(2)} dS/m tam hesablamaya qoşulub.`
          : `Humus ${draft.labMetrics.organicMatterPct.toFixed(1)}%, NPK (${draft.labMetrics.nitrogenMgKg}/${draft.labMetrics.phosphorusMgKg}/${draft.labMetrics.potassiumMgKg} mg/kg) and EC ${draft.labMetrics.ecDsM.toFixed(2)} dS/m verified in suitability scoring.`,
        route: "/field",
        tone: "violet",
      },
      {
        id: `notif-drought-stress`,
        title: isAz
          ? `Quraqlıq ssenari testi (−20% yağıntı)`
          : `Drought Scenario Ready (−20% Rainfall)`,
        detail: isAz
          ? `Seçilmiş planın yağıntı azalmasına davamlılığını Ssenari laboratoriyasında yoxlayın.`
          : `Compare baseline crop strategy resilience under reduced rainfall in Scenario Lab.`,
        route: "/scenarios",
        tone: "violet",
      },
    ];

    if (climate && !climateStale) {
      const frost = climate.features.find((f) => f.feature_id === "frost_days_count")?.value;
      const focusRow =
        climateTimeseries && !timeseriesStale
          ? climateTimeseries.annual_series.find((r) => r.year === climateTimeseries.focus_year)
          : null;
      const heat = focusRow ? focusRow.heat_stress_days : undefined;
      items.unshift({
        id: `notif-telemetry-${climate.query.latitude}-${climate.query.longitude}-${climate.query.end_date}`,
        title: isAz
          ? `İqlim risk xülasəsi yeniləndi`
          : `Climate Risk Summary Updated`,
        detail: isAz
          ? `Şaxta günləri (<0°C): ${frost ?? "—"} · İsti stressi (≥35°C): ${heat ?? "—"} gün.`
          : `Frost days (<0°C): ${frost ?? "—"} · Heat stress (≥35°C): ${heat ?? "—"} days.`,
        route: "/climate",
        tone: "cyan",
      });
    }

    for (const alert of activeAlerts.slice(0, 3)) {
      items.unshift({
        id: `notif-alert-${alert.id}`,
        title: isAz ? alert.title_az : alert.title_en,
        detail: `${alert.parcel_label} · ${isAz ? alert.message_az : alert.message_en}`,
        route: "/alerts",
        tone: alert.severity === "critical" || alert.severity === "high" ? "warning" : "cyan",
      });
    }

    return items.map((item) => ({
      ...item,
      read: readNotifIds.includes(item.id),
    }));
  }, [
    activeAlerts,
    climate,
    climateStale,
    climateTimeseries,
    draft.label,
    draft.labMetrics.organicMatterPct,
    draft.latitude,
    draft.longitude,
    draft.soilPh,
    locale,
    readNotifIds,
    selectedRegion?.id,
    timeseriesStale,
  ]);

  const unreadNotificationCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );

  const markNotificationRead = useCallback((id: string) => {
    setReadNotifIds((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      try {
        window.localStorage.setItem(NOTIF_READ_KEY, JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setReadNotifIds((prev) => {
      const all = Array.from(new Set([...prev, ...notifications.map((n) => n.id)]));
      try {
        window.localStorage.setItem(NOTIF_READ_KEY, JSON.stringify(all));
      } catch {
        // ignore storage errors
      }
      return all;
    });
  }, [notifications]);

  const value: SpaceFarmContextValue = {
    locale,
    setLocale,
    t,
    regions: VERIFIED_AZ_REGIONS,
    selectedRegion,
    draft,
    updateDraft,
    selectRegion,
    setCustomCoordinates,
    applyOrbitalSelection,
    requestedWeights,
    setRequestedWeights,
    fieldErrors,
    validateInputs,
    health,
    cropCatalog,
    climate,
    climateLoading,
    climateError,
    climateStale,
    loadClimateForField,
    climateTimeseries,
    timeseriesLoading,
    timeseriesError,
    timeseriesStale,
    loadTimeseriesForField,
    baselineSim,
    baselineLoading,
    baselineError,
    isStale,
    previousSimFieldLabel,
    runBaselineSimulation,
    rainfallMultiplier,
    setRainfallMultiplier,
    stressSim,
    stressLoading,
    stressError,
    runStressSimulation,
    resetStressComparison,
    selectedPlanId: selectedPlan?.plan_id ?? null,
    setSelectedPlanId,
    selectedPlan,
    sourceDrawerOpen,
    sourceDrawerSection,
    openSourceDrawer,
    closeSourceDrawer,
    methodologyOpen,
    openMethodology,
    closeMethodology,
    toastMessage,
    showToast,
    user,
    authToken,
    userProfile,
    parcels,
    sidebarExpanded,
    toggleSidebarExpanded,
    updateProfile,
    addParcel,
    saveActiveParcelInputs,
    setActiveParcel,
    removeParcel,
    authModalOpen,
    authModalTab,
    authAlertMessage,
    pendingRedirectPath,
    openAuthModal,
    closeAuthModal,
    loginUser,
    registerUser,
    establishAuthSession,
    logoutUser,
    triggerAuthAlert,
    theme,
    setTheme,
    toggleTheme,
    notifications,
    unreadNotificationCount,
    markNotificationRead,
    markAllNotificationsRead,
  };

  return <SpaceFarmContext.Provider value={value}>{children}</SpaceFarmContext.Provider>;
}

export function useSpaceFarm() {
  const ctx = useContext(SpaceFarmContext);
  if (!ctx) throw new Error("useSpaceFarm must be used inside SpaceFarmProvider");
  return ctx;
}
