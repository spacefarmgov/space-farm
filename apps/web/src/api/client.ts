import type {
  ClimateBundle,
  CropCatalog,
  DataMode,
  ErrorEnvelope,
  HealthResponse,
  SimulationRequest,
  SimulationResponse,
} from "./types";

const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

export class SpaceFarmApiError extends Error {
  readonly status: number;
  readonly envelope?: ErrorEnvelope;

  constructor(message: string, status: number, envelope?: ErrorEnvelope) {
    super(message);
    this.name = "SpaceFarmApiError";
    this.status = status;
    this.envelope = envelope;
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let envelope: ErrorEnvelope | undefined;
    try {
      envelope = (await response.json()) as ErrorEnvelope;
    } catch {
      envelope = undefined;
    }
    const msg = envelope?.error?.message ?? `HTTP ${response.status} error`;
    throw new SpaceFarmApiError(msg, response.status, envelope);
  }

  return (await response.json()) as T;
}

export function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  return requestJson<HealthResponse>("/api/v1/health", { method: "GET", signal });
}

export function getCrops(signal?: AbortSignal): Promise<CropCatalog> {
  return requestJson<CropCatalog>("/api/v1/crops", { method: "GET", signal });
}

export function getClimateFeatures(
  params: {
    latitude: number;
    longitude: number;
    start_date: string;
    end_date: string;
    time_standard?: "UTC";
    mode?: DataMode;
  },
  signal?: AbortSignal
): Promise<ClimateBundle> {
  const qs = new URLSearchParams({
    latitude: String(params.latitude),
    longitude: String(params.longitude),
    start_date: params.start_date,
    end_date: params.end_date,
    time_standard: params.time_standard ?? "UTC",
  });
  if (params.mode) {
    qs.set("mode", params.mode);
  }
  return requestJson<ClimateBundle>(`/api/v1/climate/features?${qs.toString()}`, {
    method: "GET",
    signal,
  });
}

export function runSimulation(
  payload: SimulationRequest,
  signal?: AbortSignal,
  mode?: DataMode
): Promise<SimulationResponse> {
  const qs = mode ? `?mode=${encodeURIComponent(mode)}` : "";
  return requestJson<SimulationResponse>(`/api/v1/simulations${qs}`, {
    method: "POST",
    body: JSON.stringify(payload),
    signal,
  });
}
