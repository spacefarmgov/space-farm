# Space Farm Infrastructure & Deployment Guide (B-05)

## Local Container Run (Backend API)
```bash
docker compose -f infra/docker-compose.yml up --build
```
Verify: `http://127.0.0.1:8000/api/v1/health`

## Production Cloud Deployment Checklist (Render / Railway / Fly.io)
1. Build context: repository root (`.`), Dockerfile: `infra/Dockerfile.api`.
2. Required environment variables:
   - `APP_ENV=production` *(blocks `demo_fixture` mode automatically)*
   - `DATA_MODE=live` *(queries NASA POWER live with verified Ganja 2024 snapshot fallback on exact match)*
   - `CORS_ORIGINS=https://<your-deployed-frontend-domain>`
   - `API_HOST=0.0.0.0`
   - `API_PORT=8000` *(or platform `$PORT`)*
3. Healthcheck path: `/api/v1/health`.
4. GitHub Actions CI template: copy `infra/ci/github-actions-ci.yml` to `.github/workflows/ci.yml` using a token with `workflow` scope (or GitHub Web UI).
