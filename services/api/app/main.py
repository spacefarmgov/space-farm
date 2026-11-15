"""FastAPI application entrypoint, CORS, request tracing, and ErrorEnvelope handlers."""

from __future__ import annotations

import logging
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import CONTRACT_VERSION, REPO_ROOT, ensure_runtime_dirs, get_settings
from app.data_adapters.exceptions import DataQualityError, DataUnavailable, InvalidDataQuery
from app.routes.api import router as v1_router
from app.routes.orbital import router as orbital_router
from app.routes.workspace_api import router as workspace_router
from app.schemas.models import ErrorBody, ErrorDetail, ErrorEnvelope
from app.workers.risk_monitor import risk_worker

logger = logging.getLogger("space_farm.api")


@asynccontextmanager
async def lifespan(_: FastAPI):
    ensure_runtime_dirs(get_settings())
    risk_worker.start()
    try:
        yield
    finally:
        await risk_worker.stop()


def _request_id_for(request: Request) -> str:
    rid = getattr(request.state, "request_id", None)
    if isinstance(rid, str) and rid:
        return rid
    return str(uuid.uuid4())


def _envelope_response(
    *,
    status_code: int,
    code: str,
    message: str,
    details: list[ErrorDetail],
    retryable: bool,
    request_id: str,
) -> JSONResponse:
    envelope = ErrorEnvelope(
        error=ErrorBody(
            code=code,
            message=message,
            details=details,
            retryable=retryable,
            request_id=request_id,
        )
    )
    return JSONResponse(
        status_code=status_code,
        content=envelope.model_dump(mode="json"),
        headers={"X-Request-ID": request_id},
    )


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="Space Farm API",
        description=(
            "Team CODE44 — Explainable 3-year crop rotation decision-support API "
            "powered by NASA LaRC POWER daily historical observations and provisional FAO rules."
        ),
        version=CONTRACT_VERSION,
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def attach_request_id(request: Request, call_next):
        incoming = request.headers.get("X-Request-ID", "").strip()
        request.state.request_id = incoming[:64] if incoming else str(uuid.uuid4())
        response = await call_next(request)
        response.headers["X-Request-ID"] = request.state.request_id
        return response

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        details: list[ErrorDetail] = []
        messages: list[str] = []
        for err in exc.errors():
            loc = [str(part) for part in err.get("loc", []) if part != "body"]
            field_path = ".".join(loc) if loc else "request"
            msg = str(err.get("msg", "validation error"))
            reason = "sum_mismatch" if "sum to 1" in msg else str(err.get("type", "validation_error"))
            details.append(ErrorDetail(field=field_path, reason=reason))
            messages.append(msg)
        return _envelope_response(
            status_code=422,
            code="VALIDATION_ERROR",
            message="; ".join(messages) if messages else "Request validation failed",
            details=details,
            retryable=False,
            request_id=_request_id_for(request),
        )

    @app.exception_handler(InvalidDataQuery)
    async def invalid_data_query_handler(request: Request, exc: InvalidDataQuery) -> JSONResponse:
        return _envelope_response(
            status_code=422,
            code="VALIDATION_ERROR",
            message=str(exc),
            details=[ErrorDetail(field=exc.field, reason=exc.reason)],
            retryable=False,
            request_id=_request_id_for(request),
        )

    @app.exception_handler(DataUnavailable)
    async def data_unavailable_handler(request: Request, exc: DataUnavailable) -> JSONResponse:
        return _envelope_response(
            status_code=503,
            code="DATA_UNAVAILABLE",
            message=str(exc),
            details=[ErrorDetail(field="climate", reason=exc.reason)],
            retryable=exc.retryable,
            request_id=_request_id_for(request),
        )

    @app.exception_handler(DataQualityError)
    async def data_quality_handler(request: Request, exc: DataQualityError) -> JSONResponse:
        return _envelope_response(
            status_code=503,
            code="DATA_QUALITY_ERROR",
            message=str(exc),
            details=[ErrorDetail(field="climate", reason=exc.reason)],
            retryable=False,
            request_id=_request_id_for(request),
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        return _envelope_response(
            status_code=exc.status_code,
            code=f"HTTP_{exc.status_code}",
            message=str(exc.detail),
            details=[],
            retryable=exc.status_code >= 500,
            request_id=_request_id_for(request),
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        rid = _request_id_for(request)
        logger.exception("Unhandled exception for request_id=%s", rid, exc_info=exc)
        return _envelope_response(
            status_code=500,
            code="INTERNAL_ERROR",
            message="An unexpected internal server error occurred.",
            details=[],
            retryable=False,
            request_id=rid,
        )

    app.include_router(v1_router)
    app.include_router(orbital_router)
    app.include_router(workspace_router)
    _mount_frontend_dist(app)
    return app


def _mount_frontend_dist(app: FastAPI) -> None:
    """Serve built Vite SPA assets and client routes when `apps/web/dist` exists."""
    dist_dir = (REPO_ROOT / "apps" / "web" / "dist").resolve()
    index_html = dist_dir / "index.html"
    if not index_html.is_file():
        return

    for sub in ("assets", "earth-3d"):
        sub_dir = dist_dir / sub
        if sub_dir.is_dir():
            app.mount(f"/{sub}", StaticFiles(directory=str(sub_dir)), name=f"spa-{sub}")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        clean_path = full_path.lstrip("/")
        if clean_path == "api" or clean_path.startswith("api/"):
            raise StarletteHTTPException(status_code=404, detail="Not Found")
        if clean_path:
            candidate = (dist_dir / clean_path).resolve()
            if candidate.is_relative_to(dist_dir) and candidate.is_file():
                return FileResponse(candidate)
        return FileResponse(index_html)


app = create_app()
