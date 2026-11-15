"""Vercel Serverless Function ASGI entrypoint for the Space Farm FastAPI backend."""

from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SERVICE_ROOT = REPO_ROOT / "services" / "api"
if str(SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(SERVICE_ROOT))

from app.main import app  # noqa: E402, F401
