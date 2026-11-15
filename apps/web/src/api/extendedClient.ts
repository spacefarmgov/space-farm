import {
  SpaceFarmApiError,
  getClimateFeatures,
  getCrops,
  getFriendlyErrorMessage,
  getHealth,
  isNetworkFailure,
  resilientFetch,
  runSimulation,
} from "./client";
import type {
  ClimateBundle,
  ClimateTimeseriesBundle,
  DataMode,
  ErrorEnvelope,
  ExtendedCropCatalog,
  HealthResponse,
  SimulationRequest,
  SimulationResponse,
} from "./uiTypes";

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";

async function requestJsonWithMode<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await resilientFetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const text = await response.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new SpaceFarmApiError(
        `Unexpected non-JSON response (${response.status})`,
        response.status,
      );
    }
  }

  if (!response.ok) {
    const maybeEnv = parsed as Partial<ErrorEnvelope> | null;
    if (maybeEnv && typeof maybeEnv === "object" && maybeEnv.error) {
      throw new SpaceFarmApiError(
        maybeEnv.error.message,
        response.status,
        maybeEnv as ErrorEnvelope,
      );
    }
    throw new SpaceFarmApiError(`Request failed (${response.status})`, response.status);
  }

  return parsed as T;
}

export { SpaceFarmApiError, getFriendlyErrorMessage, getHealth, isNetworkFailure };

function buildClimateQueryString(
  params: {
    latitude: number;
    longitude: number;
    start_date: string;
    end_date: string;
    time_standard?: "UTC";
  },
  mode?: DataMode,
): string {
  const search = new URLSearchParams({
    latitude: String(params.latitude),
    longitude: String(params.longitude),
    start_date: params.start_date,
    end_date: params.end_date,
    time_standard: params.time_standard ?? "UTC",
  });
  if (mode) {
    search.set("mode", mode);
  }
  return search.toString();
}

export async function fetchExtendedCrops(signal?: AbortSignal): Promise<ExtendedCropCatalog> {
  return (await getCrops(signal)) as ExtendedCropCatalog;
}

export async function fetchClimateFeaturesWithMode(
  params: {
    latitude: number;
    longitude: number;
    start_date: string;
    end_date: string;
    time_standard?: "UTC";
  },
  mode?: DataMode,
  signal?: AbortSignal,
): Promise<ClimateBundle> {
  if (!mode) {
    return getClimateFeatures(params, signal);
  }
  return requestJsonWithMode<ClimateBundle>(
    `/api/v1/climate/features?${buildClimateQueryString(params, mode)}`,
    {
      method: "GET",
      signal,
    },
  );
}

export async function fetchClimateTimeseriesWithMode(
  params: {
    latitude: number;
    longitude: number;
    start_date: string;
    end_date: string;
    time_standard?: "UTC";
  },
  mode?: DataMode,
  signal?: AbortSignal,
): Promise<ClimateTimeseriesBundle> {
  return requestJsonWithMode<ClimateTimeseriesBundle>(
    `/api/v1/climate/timeseries?${buildClimateQueryString(params, mode)}`,
    {
      method: "GET",
      signal,
    },
  );
}

export async function runSimulationWithMode(
  payload: SimulationRequest,
  mode?: DataMode,
  signal?: AbortSignal,
): Promise<SimulationResponse> {
  if (!mode) {
    return runSimulation(payload, signal);
  }
  const search = new URLSearchParams({ mode });
  return requestJsonWithMode<SimulationResponse>(`/api/v1/simulations?${search.toString()}`, {
    method: "POST",
    body: JSON.stringify(payload),
    signal,
  });
}

export async function fetchHealthSafe(signal?: AbortSignal): Promise<HealthResponse | null> {
  try {
    return await getHealth(signal);
  } catch {
    return null;
  }
}

export interface WorkspaceUserProfile {
  id: string;
  name: string;
  email: string;
  region: string;
  username: string;
  phone_code: string;
  phone: string;
  active_since: string;
  role_type: "farmer" | "agronomist" | "cooperative" | "researcher";
  irrigation_pref: "irrigated" | "rainfed" | "hybrid";
  bio: string;
  avatar_data_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceLabMetrics {
  organic_matter_pct?: number;
  nitrogen_mg_kg?: number;
  phosphorus_mg_kg?: number;
  potassium_mg_kg?: number;
  ec_ds_m?: number;
  moisture_capacity_pct?: number;
  depth_top_cm?: number;
  depth_bottom_cm?: number;
  sample_date?: string;
  lab_report_id?: string;
  soil_source_type?: "laboratory" | "extension_service" | "field_probe" | "user_reported";
}

export interface WorkspaceParcel {
  id: string;
  label: string;
  region_id: string;
  latitude: number;
  longitude: number;
  area_ha: number;
  irrigation_type: "rainfed" | "irrigated" | "unknown";
  irrigation_budget_mm: number | null;
  soil_ph: number | null;
  soil_texture: "unknown" | "sand" | "loam" | "clay" | "other";
  prior_crop_id: string;
  lab_metrics?: WorkspaceLabMetrics;
  boundary_polygon?: Array<[number, number]> | null;
  is_primary: boolean;
  created_at: string;
}

export interface AuthSessionResponse {
  token: string;
  user: WorkspaceUserProfile;
  parcels: WorkspaceParcel[];
}

export interface ProfileBundleResponse {
  user: WorkspaceUserProfile;
  parcels: WorkspaceParcel[];
}

export interface AiMetricPill {
  label: string;
  value: string;
}

export interface AiActionLink {
  label: string;
  route: string;
}

export interface AiChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  meta: {
    engine?: string;
    data_mode?: string;
    synthetic?: boolean;
    metrics?: AiMetricPill[];
    followups?: string[];
    actions?: AiActionLink[];
    field_label?: string;
  };
  created_at: string;
}

export interface AiAssistResponse {
  user_message: AiChatMessage;
  assistant_message: AiChatMessage;
  answer: string;
  engine: string;
  data_mode: string;
  synthetic: boolean;
  metrics: AiMetricPill[];
  followups: string[];
  actions: AiActionLink[];
}

let onUnauthorizedCallback: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorizedCallback = handler;
}

async function requestWorkspaceJson<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string> | undefined) ?? {}),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const resp = await resilientFetch(`${API_BASE.replace(/\/$/, "")}${path}`, {
    ...options,
    headers,
  });
  const text = await resp.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }
  if (!resp.ok) {
    if (resp.status === 401 && token && onUnauthorizedCallback) {
      onUnauthorizedCallback();
    }
    const env = parsed as Partial<ErrorEnvelope> | null;
    const msg =
      env?.error?.message ||
      (parsed as { detail?: string } | null)?.detail ||
      `HTTP ${resp.status} error`;
    throw new SpaceFarmApiError(
      msg,
      resp.status,
      env?.error ? (env as ErrorEnvelope) : undefined,
    );
  }
  return parsed as T;
}

export function registerAccount(payload: {
  name: string;
  email: string;
  password: string;
  region: string;
}): Promise<AuthSessionResponse> {
  return requestWorkspaceJson<AuthSessionResponse>("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function loginAccount(payload: {
  email: string;
  password: string;
}): Promise<AuthSessionResponse> {
  return requestWorkspaceJson<AuthSessionResponse>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function demoLoginAccount(region?: string): Promise<AuthSessionResponse> {
  return requestWorkspaceJson<AuthSessionResponse>("/api/v1/auth/demo", {
    method: "POST",
    body: JSON.stringify(region ? { region } : {}),
  });
}

export function fetchUserProfile(token: string): Promise<ProfileBundleResponse> {
  return requestWorkspaceJson<ProfileBundleResponse>("/api/v1/profile", { method: "GET" }, token);
}

export function saveUserProfile(
  token: string,
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
): Promise<ProfileBundleResponse> {
  return requestWorkspaceJson<ProfileBundleResponse>(
    "/api/v1/profile",
    {
      method: "PUT",
      body: JSON.stringify(patch),
    },
    token,
  );
}

export function createFarmParcel(
  token: string,
  payload: {
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
    boundary_polygon?: Array<[number, number]> | null;
    is_primary: boolean;
  },
): Promise<{ parcels: WorkspaceParcel[] }> {
  return requestWorkspaceJson<{ parcels: WorkspaceParcel[] }>(
    "/api/v1/parcels",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    token,
  );
}

export function updateFarmParcel(
  token: string,
  parcelId: string,
  patch: Partial<{
    label: string;
    region_id: string;
    latitude: number;
    longitude: number;
    area_ha: number;
    irrigation_type: "rainfed" | "irrigated";
    irrigation_budget_mm: number | null;
    soil_ph: number;
    soil_texture: "sand" | "loam" | "clay" | "other";
    prior_crop_id: string;
    lab_metrics: WorkspaceLabMetrics;
    boundary_polygon: Array<[number, number]> | null;
  }>,
): Promise<{ parcels: WorkspaceParcel[] }> {
  return requestWorkspaceJson<{ parcels: WorkspaceParcel[] }>(
    `/api/v1/parcels/${encodeURIComponent(parcelId)}`,
    {
      method: "PUT",
      body: JSON.stringify(patch),
    },
    token,
  );
}

export function activateFarmParcel(
  token: string,
  parcelId: string,
): Promise<{ parcels: WorkspaceParcel[] }> {
  return requestWorkspaceJson<{ parcels: WorkspaceParcel[] }>(
    `/api/v1/parcels/${encodeURIComponent(parcelId)}/activate`,
    { method: "POST" },
    token,
  );
}

export function deleteFarmParcel(
  token: string,
  parcelId: string,
): Promise<{ parcels: WorkspaceParcel[] }> {
  return requestWorkspaceJson<{ parcels: WorkspaceParcel[] }>(
    `/api/v1/parcels/${encodeURIComponent(parcelId)}`,
    { method: "DELETE" },
    token,
  );
}

export function fetchAiHistory(token: string): Promise<{ messages: AiChatMessage[] }> {
  return requestWorkspaceJson<{ messages: AiChatMessage[] }>(
    "/api/v1/ai/history",
    { method: "GET" },
    token,
  );
}

export function clearAiHistory(token: string): Promise<{ ok: boolean }> {
  return requestWorkspaceJson<{ ok: boolean }>(
    "/api/v1/ai/history",
    { method: "DELETE" },
    token,
  );
}

export function askSpaceFarmAi(
  token: string,
  payload: {
    question: string;
    locale: "az" | "en";
    farm?: SimulationRequest["farm"];
    preferences?: SimulationRequest["preferences"];
    scenario?: SimulationRequest["scenario"];
  },
): Promise<AiAssistResponse> {
  return requestWorkspaceJson<AiAssistResponse>(
    "/api/v1/ai/assist",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    token,
  );
}

export type RiskSeverity = "low" | "moderate" | "high" | "critical";
export type RiskHazardType = "frost" | "drought" | "heat" | "heavy_rain" | "channel_check";

export interface DailyForecastPoint {
  date: string;
  tmax_c: number | null;
  tmin_c: number | null;
  precip_mm: number | null;
  et0_mm: number | null;
  wind_kmh: number | null;
}

export interface ParcelRiskSnapshot {
  parcel_id: string;
  parcel_label: string;
  latitude: number;
  longitude: number;
  is_primary?: boolean;
  area_ha?: number;
  irrigation_type?: string;
  prior_crop_id?: string;
  overall_severity: RiskSeverity;
  frost_risk: RiskSeverity;
  drought_risk: RiskSeverity;
  heat_risk: RiskSeverity;
  rain_risk: RiskSeverity;
  forecast_tmin_c: number | null;
  forecast_tmax_c: number | null;
  forecast_precip_7d_mm: number | null;
  forecast_et0_7d_mm: number | null;
  water_balance_mm: number | null;
  nasa_root_wetness: number | null;
  summary_az: string;
  summary_en: string;
  daily_forecast: DailyForecastPoint[];
  last_scanned_at: string;
}

export interface WeatherAlertRecord {
  id: string;
  parcel_id: string;
  parcel_label: string;
  latitude: number;
  longitude: number;
  risk_type: RiskHazardType;
  severity: RiskSeverity;
  status: "active" | "acknowledged" | "resolved";
  title_az: string;
  title_en: string;
  message_az: string;
  message_en: string;
  trigger_metric: string;
  metrics: Record<string, number | string | null>;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface NotificationDispatchRecord {
  id: string;
  alert_id: string | null;
  channel: "sms" | "email";
  recipient: string;
  subject: string;
  body: string;
  provider: string;
  status: "sent" | "queued_awaiting_credentials" | "skipped_no_phone" | "skipped_no_email" | "failed";
  error_detail: string | null;
  created_at: string;
}

export interface NotificationPreferences {
  sms_enabled: boolean;
  email_enabled: boolean;
  min_severity: "critical" | "high" | "moderate";
  custom_frost_c: number;
  custom_heat_c: number;
  updated_at: string;
}

export interface RiskWorkerStatus {
  enabled: boolean;
  running: boolean;
  interval_seconds: number;
  cooldown_hours: number;
  last_run_at: string | null;
  last_error: string | null;
  runs_completed: number;
  total_alerts_created: number;
  total_dispatches_created: number;
}

export interface AlertsOverviewResponse {
  snapshots: ParcelRiskSnapshot[];
  alerts: WeatherAlertRecord[];
  dispatches: NotificationDispatchRecord[];
  preferences: NotificationPreferences;
  worker: RiskWorkerStatus;
  contacts: {
    email: string;
    phone_e164: string;
    smtp_configured: boolean;
    sms_configured: boolean;
  };
  scan_summary?: {
    scanned_parcels: number;
    new_alerts: number;
    new_dispatches: number;
  };
  triggered?: NotificationDispatchRecord[];
}

export function fetchAlertsOverview(token: string): Promise<AlertsOverviewResponse> {
  return requestWorkspaceJson<AlertsOverviewResponse>("/api/v1/alerts/overview", { method: "GET" }, token);
}

export function scanAlertsNow(token: string): Promise<AlertsOverviewResponse> {
  return requestWorkspaceJson<AlertsOverviewResponse>("/api/v1/alerts/scan", { method: "POST" }, token);
}

export function updateAlertPreferences(
  token: string,
  patch: Partial<{
    sms_enabled: boolean;
    email_enabled: boolean;
    min_severity: "critical" | "high" | "moderate";
    custom_frost_c: number;
    custom_heat_c: number;
  }>,
): Promise<AlertsOverviewResponse> {
  return requestWorkspaceJson<AlertsOverviewResponse>(
    "/api/v1/alerts/preferences",
    {
      method: "PATCH",
      body: JSON.stringify(patch),
    },
    token,
  );
}

export function setWeatherAlertStatus(
  token: string,
  alertId: string,
  status: "active" | "acknowledged" | "resolved",
): Promise<{ alert: WeatherAlertRecord }> {
  return requestWorkspaceJson<{ alert: WeatherAlertRecord }>(
    `/api/v1/alerts/${encodeURIComponent(alertId)}/status`,
    {
      method: "POST",
      body: JSON.stringify({ status }),
    },
    token,
  );
}

export function verifyAlertDispatchChannels(token: string): Promise<AlertsOverviewResponse> {
  return requestWorkspaceJson<AlertsOverviewResponse>(
    "/api/v1/alerts/verify-dispatch",
    { method: "POST" },
    token,
  );
}

export interface ForgotPasswordResponse {
  ok: boolean;
  delivery_status: string;
  smtp_configured: boolean;
  code_dispatched?: boolean;
  reset_token?: string;
  message?: string;
}

export interface AuthProvidersResponse {
  google_enabled: boolean;
  google_client_id: string;
  smtp_configured: boolean;
}

export interface RequestRegisterOtpResponse {
  ok: boolean;
  email: string;
  expires_in_seconds: number;
  delivery_status: string;
  otp_token?: string;
}

export function fetchAuthProviders(signal?: AbortSignal): Promise<AuthProvidersResponse> {
  return requestWorkspaceJson<AuthProvidersResponse>("/api/v1/auth/providers", {
    method: "GET",
    signal,
  });
}

export function requestRegistrationOtp(payload: {
  name: string;
  email: string;
  password: string;
  region: string;
}): Promise<RequestRegisterOtpResponse> {
  return requestWorkspaceJson<RequestRegisterOtpResponse>("/api/v1/auth/register/request-otp", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function verifyRegistrationOtp(payload: {
  email: string;
  code: string;
  otp_token?: string;
}): Promise<AuthSessionResponse> {
  return requestWorkspaceJson<AuthSessionResponse>("/api/v1/auth/register/verify-otp", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function loginWithGoogleToken(payload: {
  credential?: string;
  access_token?: string;
  region?: string;
}): Promise<AuthSessionResponse> {
  return requestWorkspaceJson<AuthSessionResponse>("/api/v1/auth/google", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function requestPasswordReset(email: string): Promise<ForgotPasswordResponse> {
  return requestWorkspaceJson<ForgotPasswordResponse>("/api/v1/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function resetPasswordWithCode(payload: {
  email: string;
  code: string;
  new_password: string;
  reset_token?: string;
}): Promise<{ ok: boolean }> {
  return requestWorkspaceJson<{ ok: boolean }>("/api/v1/auth/reset-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface OrbitalElevationResponse {
  latitude: number;
  longitude: number;
  elevation_m: number | null;
  unit: string;
  dataset: string;
  source: string;
  fetched_at: string;
}

export function fetchOrbitalElevation(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<OrbitalElevationResponse> {
  const query = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
  });
  return requestJsonWithMode<OrbitalElevationResponse>(`/api/orbital/elevation?${query.toString()}`, {
    method: "GET",
    signal,
  });
}
