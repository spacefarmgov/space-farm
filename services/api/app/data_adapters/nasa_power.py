"""Async NASA LaRC POWER Daily Point API client with bounded retries."""

from __future__ import annotations

import asyncio
import json
import time
from datetime import datetime, timezone
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import httpx

from app.config import Settings
from app.data_adapters.exceptions import DataQualityError, DataUnavailable, InvalidDataQuery
from app.schemas.models import ClimateQuery, ClimateTimeseriesQuery

NASA_POWER_PARAMETERS: tuple[str, ...] = ("T2M", "T2M_MIN", "T2M_MAX", "PRECTOTCORR")
NASA_POWER_EXTENDED_PARAMETERS: tuple[str, ...] = (
    "GWETTOP",
    "GWETROOT",
    "ALLSKY_SFC_SW_DWN",
    "RH2M",
    "WS2M",
)
NASA_POWER_ALL_PARAMETERS: tuple[str, ...] = NASA_POWER_PARAMETERS + NASA_POWER_EXTENDED_PARAMETERS
NASA_POWER_DOCS_URL = "https://power.larc.nasa.gov/docs/services/api/temporal/daily/"
_SENSITIVE_QUERY_KEYS = {"api_key", "apikey", "token", "key", "secret", "password"}


def sanitize_url(raw_url: str) -> str:
    """Remove any accidental credential query parameters from recorded URLs."""
    parts = urlsplit(raw_url)
    filtered = [
        (k, v)
        for k, v in parse_qsl(parts.query, keep_blank_values=True)
        if k.lower() not in _SENSITIVE_QUERY_KEYS
    ]
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(filtered), parts.fragment))


def build_power_query_params(
    query: ClimateQuery | ClimateTimeseriesQuery,
    *,
    community: str = "AG",
    parameters: tuple[str, ...] = NASA_POWER_PARAMETERS,
) -> dict[str, str | float]:
    """Build exact NASA POWER Daily Point query parameters."""
    if query.time_standard != "UTC":
        raise InvalidDataQuery(
            "Only time_standard='UTC' is supported for NASA POWER queries in v0.1.0",
            field="time_standard",
            reason="unsupported_time_standard",
        )
    return {
        "parameters": ",".join(parameters),
        "community": community,
        "longitude": round(query.longitude, 4),
        "latitude": round(query.latitude, 4),
        "start": query.start_date.strftime("%Y%m%d"),
        "end": query.end_date.strftime("%Y%m%d"),
        "format": "JSON",
        "time-standard": "UTC",
    }


def _parse_retry_after(header_val: str | None) -> float | None:
    if not header_val:
        return None
    try:
        seconds = float(header_val.strip())
        return max(0.0, seconds)
    except ValueError:
        return None


def _validate_power_json_structure(payload: object) -> dict:
    if not isinstance(payload, dict):
        raise DataQualityError("NASA POWER response is not a JSON object", reason="invalid_json_root")
    props = payload.get("properties")
    if not isinstance(props, dict) or not isinstance(props.get("parameter"), dict):
        messages = payload.get("messages")
        raise DataQualityError(
            f"NASA POWER response missing properties.parameter (messages={messages})",
            reason="missing_parameter_payload",
        )
    param_map = props["parameter"]
    missing_params = [p for p in NASA_POWER_PARAMETERS if not isinstance(param_map.get(p), dict)]
    if missing_params:
        raise DataQualityError(
            f"NASA POWER response missing expected parameter series: {missing_params}",
            reason="incomplete_parameter_series",
        )
    return payload


async def _wait_for_retry(attempt: int, deadline: float, retry_after: float | None = None) -> bool:
    """Sleep up to remaining retry budget; return False only when budget is exhausted."""
    remaining = deadline - time.monotonic()
    if remaining <= 0:
        return False
    backoff = retry_after if retry_after is not None else 0.5 * (2**attempt)
    delay = min(max(0.0, backoff), remaining)
    if delay > 0:
        await asyncio.sleep(delay)
    return (deadline - time.monotonic()) > 0


async def fetch_power_daily_raw(
    query: ClimateQuery | ClimateTimeseriesQuery,
    settings: Settings,
    *,
    parameters: tuple[str, ...] = NASA_POWER_PARAMETERS,
    transport: httpx.AsyncBaseTransport | None = None,
) -> tuple[dict, str, bytes, datetime]:
    """Fetch daily point JSON from NASA POWER with bounded retry budget and no 422 retry."""
    params = build_power_query_params(
        query,
        community=settings.nasa_power_community,
        parameters=parameters,
    )
    budget_seconds = max(0.5, float(settings.nasa_power_retry_budget_seconds))
    max_retries = max(0, int(settings.nasa_power_max_retries))
    deadline = time.monotonic() + budget_seconds

    client_kwargs: dict = {
        "timeout": httpx.Timeout(float(settings.nasa_power_timeout_seconds)),
        "headers": {"User-Agent": "SpaceFarm-CODE44/0.1.0 (+https://github.com/spacefarmgov/space-farm)"},
        "follow_redirects": True,
    }
    if transport is not None:
        client_kwargs["transport"] = transport

    last_error: Exception | None = None

    async with httpx.AsyncClient(**client_kwargs) as client:
        for attempt in range(max_retries + 1):
            if (deadline - time.monotonic()) <= 0:
                break
            try:
                response = await client.get(settings.nasa_power_base_url, params=params)
            except (httpx.TimeoutException, httpx.RequestError) as exc:
                last_error = exc
                if attempt >= max_retries or not await _wait_for_retry(attempt, deadline):
                    break
                continue

            if response.status_code in (400, 404, 422):
                # Never waste retries on client validation / invalid query errors (T04)
                raise InvalidDataQuery(
                    f"NASA POWER rejected query with HTTP {response.status_code}",
                    field="query",
                    reason=f"upstream_http_{response.status_code}",
                )

            if response.status_code == 429 or response.status_code >= 500:
                last_error = DataUnavailable(
                    f"NASA POWER transient HTTP {response.status_code}",
                    retryable=True,
                    reason=f"upstream_http_{response.status_code}",
                )
                retry_after = _parse_retry_after(response.headers.get("Retry-After"))
                if attempt >= max_retries or not await _wait_for_retry(attempt, deadline, retry_after):
                    break
                continue

            if response.status_code != 200:
                raise DataUnavailable(
                    f"NASA POWER returned unexpected HTTP {response.status_code}",
                    retryable=False,
                    reason=f"upstream_http_{response.status_code}",
                )

            raw_bytes = response.content
            try:
                decoded = json.loads(raw_bytes.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError) as exc:
                raise DataQualityError(
                    f"NASA POWER returned invalid JSON: {exc}",
                    reason="invalid_json",
                ) from exc

            payload = _validate_power_json_structure(decoded)
            retrieved_at = datetime.now(timezone.utc)
            return payload, sanitize_url(str(response.url)), raw_bytes, retrieved_at

    raise DataUnavailable(
        f"Failed to retrieve NASA POWER data after bounded retries: {last_error}",
        retryable=True,
        reason="upstream_retries_exhausted",
    )
