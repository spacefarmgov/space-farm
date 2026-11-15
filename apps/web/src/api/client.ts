import type {
  ClimateBundle,
  CropCatalog,
  ErrorEnvelope,
  HealthResponse,
  SimulationRequest,
  SimulationResponse,
} from "./types";

const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

const RETRY_DELAY_MS = 350;

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

export function isNetworkFailure(err: unknown): boolean {
  if (err instanceof SpaceFarmApiError && err.status === 0) {
    return true;
  }
  if (err instanceof TypeError) {
    return true;
  }
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return (
      msg === "failed to fetch" ||
      msg === "network_unreachable" ||
      msg.includes("load failed") ||
      msg.includes("networkerror")
    );
  }
  return false;
}

export function getFriendlyErrorMessage(
  err: unknown,
  networkErrorMessage: string,
  fallback: string,
): string {
  if (isNetworkFailure(err)) {
    return networkErrorMessage;
  }
  if (err instanceof Error && err.message.trim()) {
    return err.message;
  }
  return fallback;
}

export async function resilientFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const reqInit: RequestInit = {
    credentials: init?.credentials ?? "same-origin",
    ...init,
  };
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await fetch(input, reqInit);
    } catch (err) {
      if (init?.signal?.aborted) {
        throw err;
      }
      lastError = err;
      if (attempt === 0 && isNetworkFailure(err)) {
        await new Promise((resolve) => globalThis.setTimeout(resolve, RETRY_DELAY_MS));
        continue;
      }
      break;
    }
  }
  if (isNetworkFailure(lastError)) {
    throw new SpaceFarmApiError("NETWORK_UNREACHABLE", 0);
  }
  throw lastError;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await resilientFetch(`${BASE_URL}${path}`, {
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
  return requestJson<ClimateBundle>(`/api/v1/climate/features?${qs.toString()}`, {
    method: "GET",
    signal,
  });
}

export function runSimulation(
  payload: SimulationRequest,
  signal?: AbortSignal
): Promise<SimulationResponse> {
  return requestJson<SimulationResponse>("/api/v1/simulations", {
    method: "POST",
    body: JSON.stringify(payload),
    signal,
  });
}
