import { createContext, type Context } from "react";
import type {
  AuthSessionResponse,
  WorkspaceLabMetrics,
  WorkspaceParcel,
  WorkspaceUserProfile,
} from "../api/extendedClient";
import type {
  ClimateBundle,
  ClimateTimeseriesBundle,
  ExtendedCropCatalog,
  HealthResponse,
  RotationPlan,
  SimulationResponse,
} from "../api/uiTypes";
import type {
  FieldDraft,
  PriorityWeights,
  VerifiedRegionPreset,
} from "../data/regions";
import type { Locale, TranslationDictionary } from "../locales/translations";

export interface ApiUiError {
  kind: "validation" | "unavailable_503" | "network" | "server_500";
  message: string;
  fieldErrors: Record<string, string>;
  retryable: boolean;
}

export type SourceDrawerSection = "nasa" | "soil" | "rules";
export type ThemeMode = "dark" | "light";

export interface SpaceFarmNotification {
  id: string;
  title: string;
  detail: string;
  route: string;
  tone: "violet" | "warning" | "cyan";
  read: boolean;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  region?: string;
}

export interface AuthActionResult {
  ok: boolean;
  error?: string;
}

export interface OrbitalSelectionInput {
  lat: number;
  lon: number;
  label: string;
  presetId: string | null;
  areaHa: number;
}

export interface SpaceFarmContextValue {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: TranslationDictionary;
  regions: VerifiedRegionPreset[];
  selectedRegion: VerifiedRegionPreset | null;
  draft: FieldDraft;
  updateDraft: (patch: Partial<FieldDraft>) => void;
  selectRegion: (regionId: string) => void;
  setCustomCoordinates: (lat: number, lon: number, label?: string) => void;
  applyOrbitalSelection: (selection: OrbitalSelectionInput, runPipeline?: boolean) => FieldDraft;
  requestedWeights: PriorityWeights;
  setRequestedWeights: (next: PriorityWeights) => void;
  fieldErrors: Record<string, string>;
  validateInputs: () => boolean;
  health: HealthResponse | null;
  cropCatalog: ExtendedCropCatalog | null;
  climate: ClimateBundle | null;
  climateLoading: boolean;
  climateError: ApiUiError | null;
  climateStale: boolean;
  loadClimateForField: (targetDraft?: FieldDraft) => Promise<void>;
  climateTimeseries: ClimateTimeseriesBundle | null;
  timeseriesLoading: boolean;
  timeseriesError: string | null;
  timeseriesStale: boolean;
  loadTimeseriesForField: (targetDraft?: FieldDraft) => Promise<void>;
  baselineSim: SimulationResponse | null;
  baselineLoading: boolean;
  baselineError: ApiUiError | null;
  isStale: boolean;
  previousSimFieldLabel: string | null;
  runBaselineSimulation: (targetDraft?: FieldDraft) => Promise<void>;
  rainfallMultiplier: 0.9 | 0.8 | 0.7;
  setRainfallMultiplier: (mult: 0.9 | 0.8 | 0.7) => void;
  stressSim: SimulationResponse | null;
  stressLoading: boolean;
  stressError: ApiUiError | null;
  runStressSimulation: (mult?: 0.9 | 0.8 | 0.7) => Promise<void>;
  resetStressComparison: () => void;
  selectedPlanId: string | null;
  setSelectedPlanId: (id: string | null) => void;
  selectedPlan: RotationPlan | null;
  sourceDrawerOpen: boolean;
  sourceDrawerSection: SourceDrawerSection;
  openSourceDrawer: (section?: SourceDrawerSection) => void;
  closeSourceDrawer: () => void;
  methodologyOpen: boolean;
  openMethodology: () => void;
  closeMethodology: () => void;
  toastMessage: string | null;
  showToast: (msg: string) => void;
  user: AuthUser | null;
  authModalOpen: boolean;
  authModalTab: "login" | "register";
  authAlertMessage: string | null;
  pendingRedirectPath: string | null;
  openAuthModal: (tab?: "login" | "register", alertMsg?: string | null, redirectTo?: string | null) => void;
  closeAuthModal: () => void;
  authToken: string | null;
  userProfile: WorkspaceUserProfile | null;
  parcels: WorkspaceParcel[];
  sidebarExpanded: boolean;
  toggleSidebarExpanded: () => void;
  updateProfile: (
    patch: Partial<{
      name: string;
      email: string;
      region: string;
      username: string;
      phone_code: string;
      phone: string;
      active_since: string;
      role_type: WorkspaceUserProfile["role_type"];
      irrigation_pref: WorkspaceUserProfile["irrigation_pref"];
      bio: string;
      avatar_data_url: string | null;
    }>,
  ) => Promise<{ ok: boolean; error?: string }>;
  addParcel: (payload: {
    label: string;
    region_id?: string;
    latitude: number;
    longitude: number;
    area_ha: number;
    irrigation_type: "rainfed" | "irrigated" | "unknown";
    irrigation_budget_mm: number | null;
    soil_ph: number | null;
    soil_texture: "unknown" | "sand" | "loam" | "clay" | "other";
    prior_crop_id: string;
    lab_metrics?: WorkspaceLabMetrics;
    is_primary: boolean;
  }) => Promise<{ ok: boolean; error?: string }>;
  saveActiveParcelInputs: (overrideDraft?: FieldDraft) => Promise<{ ok: boolean; error?: string }>;
  setActiveParcel: (parcelId: string) => Promise<{ ok: boolean; error?: string }>;
  removeParcel: (parcelId: string) => Promise<{ ok: boolean; error?: string }>;
  loginUser: (email: string, password: string) => Promise<AuthActionResult>;
  registerUser: (
    name: string,
    email: string,
    password: string,
    region?: string,
  ) => Promise<AuthActionResult>;
  establishAuthSession: (session: AuthSessionResponse, toastMessage?: string) => void;
  logoutUser: () => void;
  triggerAuthAlert: (targetPath?: string) => void;
  theme: ThemeMode;
  setTheme: (next: ThemeMode) => void;
  toggleTheme: () => void;
  notifications: SpaceFarmNotification[];
  unreadNotificationCount: number;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
}

// Keep a single Context identity on globalThis across Vite React Fast Refresh reloads
const GLOBAL_CTX_KEY = Symbol.for("spacefarm.react.context.v1");
type GlobalWithCtx = typeof globalThis & {
  [GLOBAL_CTX_KEY]?: Context<SpaceFarmContextValue | null>;
};

const g = globalThis as GlobalWithCtx;

export const SpaceFarmContext: Context<SpaceFarmContextValue | null> =
  g[GLOBAL_CTX_KEY] ?? (g[GLOBAL_CTX_KEY] = createContext<SpaceFarmContextValue | null>(null));
