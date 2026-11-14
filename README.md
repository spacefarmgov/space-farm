# Space Farm

**From Space Data to Smarter Farms**  
*Built by Team **CODE44** for the **2026 NASA Space Apps Challenge** — [Field Shift: Adapting Farms with NASA Data](https://www.spaceappschallenge.org/2026/challenges/field-shift-adapting-farms-with-nasa-data/)*

> **Repository Status (Blueprint & Architecture Ready — Implementation In Progress):**  
> This public repository currently contains the complete **Space Farm** technical specification, `v0.1.0` API contract draft, NASA data integrity rules, 24-point acceptance test matrix, UI design brief, Git workflow, and multi-agent execution kit. Application source code (`apps/web/`, `services/api/`) and verified live NASA data snapshots are scheduled for the `B-01` / `C-01` implementation milestones and are not falsely marked as built.

---

## 1. Overview

**Space Farm** is an explainable agricultural decision-support prototype designed to help farmers compare **3-year crop rotation alternatives** by combining NASA historical climate observations, local soil inputs, crop suitability rules, and user priorities (water conservation, soil health, and income).

Rather than outputting opaque single-crop predictions or unverified yield promises, Space Farm computes up to three feasible multi-year rotation plans, explicitly surfaces missing/unknown soil data (`unknown` stays `unknown`), lets users test hypothetical rainfall-stress scenarios, and distinguishes **NASA climate inputs**, **user inputs**, and **Team CODE44's deterministic scoring logic**.

---

## 2. Problem, Target Users & Solution

### The Problem
Farmers face increasing climate volatility, irregular precipitation, and soil degradation. Choosing multi-year crop sequences involves difficult trade-offs across water demand, soil nutrient balance, and economic viability—while existing enterprise platforms often act as black boxes or assume complete laboratory soil data that smallholders do not have.

### Target Users
* **Primary Pilot User:** Small-to-medium farm owners and regional agricultural advisors (starting with a clearly labeled **Ganja, Azerbaijan** demo field at `40.68° N, 46.36° E`).
* **Secondary Evaluators:** Agronomists and hackathon judges reviewing transparent, reproducible decision logic.

### Proposed Solution
1. **Field & Soil Input (with Explicit Uncertainty):** Users select a demo field or coordinates, enter known soil properties (`pH`, `texture`, `source_type`) or leave them `unknown`, and set priority weights (`water`, `soil`, `income`).
2. **Verified NASA Climate Features:** The backend fetches daily historical temperature and precipitation for the selected coordinates via the **NASA POWER Daily Point API**, recording full provenance (`source_url`, `request_url`, `retrieved_at`, `payload_sha256`, `coverage_ratio`).
3. **Rule-Based 3-Year Rotation Engine:** Hard agronomic constraints filter invalid sequences first; soft multi-objective scoring ranks up to **3 distinct plans** deterministically (no fabricated plans if fewer than 3 are feasible).
4. **Hypothetical Stress Testing:** Users can re-run the evaluation under hypothetical rainfall multipliers (`0.9`, `0.8`, `0.7`) without mutating historical NASA datasets or presenting scenarios as weather forecasts.
5. **Source & Uncertainty Drawer:** Every score component links back to its exact `SourceRecord` and `rule_id` (marking non-expert-reviewed agronomic rules transparently as `provisional`).

---

## 3. NASA Space Apps Challenge Alignment & NASA Data Usage

**Challenge:** [Field Shift: Adapting Farms with NASA Data](https://www.spaceappschallenge.org/2026/challenges/field-shift-adapting-farms-with-nasa-data/) (NASA Space Apps Challenge 2026).

### How Space Farm Uses NASA Data
| Stage | NASA / Earth Data Source | Purpose in Space Farm | Current Status |
|---|---|---|---|
| **MVP** | **NASA POWER Daily Point API** (`AG` community, `UTC`) | Historical daily temperature (`T2M`, `T2M_MIN`, `T2M_MAX`) and verified precipitation parameter for feature aggregation and stress sensitivity | Specification & test plan ready (`C-00`/`C-01` pending live fetch) |
| **MVP Offline Fallback** | Verified local JSON snapshot + SHA-256 manifest (`data/raw/`, `data/processed/`) | Reproducible judge demo if upstream API connectivity drops (`data_mode=cached` only for matching queries) | Schema & manifest rules defined (`C-01` pending) |
| **Post-MVP (V1/V2)** | **SMAP**, **HLS** (Landsat/Sentinel vegetation indices), **SoilGrids** | Soil moisture context, high-resolution vegetation indices, and modeled soil baselines | Explicitly out of MVP scope |

### Scientific Integrity Commitments
* Missing precipitation values are **never** converted to `0` (`quality_flags` and `coverage_ratio` are preserved).
* `unknown` soil values are **never** silently replaced with defaults like `pH = 7`.
* Synthetic test fixtures (`data_mode=demo_fixture`) are strictly isolated from live/cached NASA observations.
* No unverified yield percentages, financial returns, or implied NASA endorsements/insignias are displayed.

---

## 4. Implementation Status (Planned vs. In Progress vs. Ready)

| Layer / Capability | Status | Details |
|---|---|---|
| **Project Identity, Governance & Team Kit** | **Ready** | Unified under **Space Farm** (`space-farm`), Team **CODE44** roles, file ownership matrix, Git workflow, PR template, MIT `LICENSE`, `.env.example`, `.gitignore` |
| **API Contract (`v0.1.0` DRAFT)** | **Ready (Spec)** | Endpoints, Pydantic/JSON schemas, validation rules, error envelope, `ClimateBundle` & `SimulationResponse` defined in [docs/API_CONTRACT.md](docs/API_CONTRACT.md) |
| **Data Integrity & Acceptance Test Matrix** | **Ready (Spec)** | 24 mandatory acceptance tests (`T01`–`T24`), manifest rules, and source registry defined in [docs/DATA_RULES.md](docs/DATA_RULES.md) & [docs/ACCEPTANCE_TESTS.md](docs/ACCEPTANCE_TESTS.md) |
| **UI Design Exploration (`A-00`)** | **Planned / Next** | 3 comparable desktop layout concepts defined in [prompts/01_DESIGN_EXPLORATION.md](prompts/01_DESIGN_EXPLORATION.md); design selection pending |
| **Backend Skeleton & Frozen `v0.1.0` Contract (`B-01`)** | **Planned / Next** | FastAPI app, OpenAPI schema, synthetic fixtures, health route, and rotation engine (`B-01`–`B-04`) |
| **Live NASA POWER Adapter & Crop Catalog (`C-00`–`C-04`)** | **Planned / Next** | Live API verification, SHA-256 snapshot/manifest, normalization, and 5–6 candidate crop rules |
| **Frontend Web App (`A-01`–`A-05`)** | **Planned / Next** | React + TypeScript + Vite UI, rotation comparison cards, stress control, provenance drawer |
| **V1 / V2 Extensions** | **Out of MVP Scope** | Polygon editor, SoilGrids, SMAP, HLS, multi-farm auth, ML training, automated agronomist chat |

---

## 5. Technical Architecture & Repository Structure

### Planned Architecture (MVP)
```text
React + TypeScript + Vite (apps/web)
        │  HTTP JSON (/api/v1)
        ▼
FastAPI + Pydantic Routes & Validation (services/api/app/routes, schemas)
        ├──► NASA Data Adapter & Cache (services/api/app/data_adapters) ──► NASA POWER API
        └──► Deterministic Rotation & Scoring Engine (services/api/app/engine)
```

### Current Repository Contents
```text
space-farm/
├── README.md                        # Judge-facing overview & architecture guide (this file)
├── LICENSE                          # MIT License for CODE44 source code & docs
├── .gitignore                       # Blocks secrets (.env), caches, and large raw binaries
├── .env.example                     # Safe, secret-free environment configuration template
├── AGENTS.md                        # Shared AI/developer execution rules & path boundaries
├── PROJECT_BRIEF.md                 # Product scope, Ganja demo story, MVP limits (AZ)
├── PROJECT_PLAN.md                  # Stack defaults, folder ownership matrix, engine rules (AZ)
├── PROJECT_STATE.md                 # Live integration status, blockers, next steps (AZ)
├── ROADMAP.md                       # Milestones M0–M4 & task board A-00..R-03 (AZ)
├── TEAM_RULES.md                    # Role boundaries, commit/PR rules, status vocabulary (AZ)
├── .agents/rules/00-code44.md       # Workspace rule entry point for Antigravity
├── .github/pull_request_template.md # PR checklist enforcing ownership & test evidence
├── docs/
│   ├── API_CONTRACT.md              # v0.1.0 DRAFT HTTP & Python provider contract
│   ├── DATA_RULES.md                # NASA POWER semantics, cache, manifest & provenance rules
│   ├── DESIGN_BRIEF.md              # UI/UX requirements, states, and design token template
│   ├── GIT_WORKFLOW.md              # Branching, PR queue, merge commits & conflict resolution
│   ├── ACCEPTANCE_TESTS.md          # T01–T24 verification matrix & 2-minute demo script
│   ├── DECISIONS.md                 # Architecture Decision Records (ADR-001..ADR-010)
│   ├── SOURCES.md                   # Research dossier reference, challenge & NASA links
│   ├── TEAM_PLAYBOOK.md             # Team onboarding checklist & file guide (AZ)
│   └── status/                      # Per-role live work logs (frontend.md, backend.md, data.md)
└── prompts/                         # Structured role & workflow prompts (00..06)
```

### Planned Code Directories (Created at Bootstrap `B-01`)
* `apps/web/` — React + TypeScript + Vite frontend (owned by **Role A**)
* `services/api/app/routes/`, `schemas/`, `engine/`, `main.py` — FastAPI API & engine (owned by **Role B**)
* `services/api/app/data_adapters/`, `services/api/tests/data/` — NASA POWER client, cache & tests (owned by **Role C**)
* `data/raw/`, `data/processed/`, `data/catalog/`, `tools/data/` — Verified small demo snapshot, manifests, crop rules & CLI (owned by **Role C**)
* `contracts/`, `tests/e2e/`, `infra/` — OpenAPI schema, synthetic fixtures & deployment configs (owned by **Role B**)

---

## 6. Team CODE44 Roles & Parallel Git Workflow

| Role | Responsibility | Branch | Primary Owned Paths |
|---|---|---|---|
| **A — Frontend / UI** | UI shell, forms, 3-year rotation cards, stress controls, source drawer, responsive/a11y | `feat/frontend-ui` | `apps/web/`, `docs/design/`, `docs/DESIGN_BRIEF.md`, `docs/status/frontend.md` |
| **B — Backend & Integration** | Repo structure, FastAPI routes/schemas, rotation engine, CI/deploy, PR merge coordinator | `feat/backend-core` | `services/api/app/{routes,schemas,engine,main.py}`, `contracts/`, root configs & shared docs |
| **C — External API & Data** | NASA POWER client, caching, SHA-256 manifests, unit/missing-day checks, crop rules | `feat/data-api` | `services/api/app/data_adapters/`, `services/api/tests/data/`, `data/`, `tools/data/`, `docs/DATA_RULES.md`, `docs/status/data.md` |

### Collaboration & Conflict-Prevention Rules
* **Protected Branches:** No direct commits or force-pushes to `main` or `develop`.
* **Sequential Integration Queue:** All roles commit/push independently to their role branches and open small PRs targeting `develop`. **Role B** coordinates sequential reviews and merges using **Create a merge commit** (preserving branch ancestry).
* **Integration Sequence:** `B-01` (foundation & frozen `v0.1.0` contract) → `C` (real NASA provider & catalog) / `A` (UI on contract fixtures) → `B` (engine + routes wiring) → `A` (live API integration) → `B` (E2E & `develop → main` demo release).
* **Contract Changes:** Schema, enum, endpoint, or unit changes require a Change Request (`CR-A/B/C-###`) reviewed before merging.

---

## 7. Security, Environment & Planned Setup

### Security & Public Repository Hygiene
* This repository is **public** so Space Apps Challenge judges can review all code, architecture, and documentation without special access.
* Write and admin permissions are restricted strictly to verified **Team CODE44** collaborators.
* `.env`, API keys, tokens, personal data, and large raw geospatial files are excluded via [`.gitignore`](.gitignore). Never commit real credentials.

### Configuration
```bash
git clone https://github.com/spacefarmgov/space-farm.git
cd space-farm
cp .env.example .env
```
*(No NASA API key is required for the MVP **NASA POWER Daily Point API**; keep `NASA_API_KEY` and `EARTHDATA_TOKEN` empty unless configuring optional future modules.)*

### Planned Local Development Commands *(Pending `B-01` Bootstrap)*
The planned stack targets **Python 3.11 / 3.12** (FastAPI + Pydantic) in `services/api/` and **Node LTS** (React + TypeScript + Vite) in `apps/web/`. Exact `install`, `dev`, and `test` commands will be documented and verified here once `B-01` creates the application skeletons.

---

## 8. License & NASA Data Terms (Separated)

1. **Software Code & Project Documentation — MIT License**  
   Original source code, architecture documents, and repository materials authored by **Team CODE44** are licensed under the [MIT License](LICENSE). Planned core stack dependencies (React, Vite, FastAPI, Pydantic under MIT; TypeScript under Apache-2.0) are permissively licensed and compatible with MIT.

2. **NASA Open Data & Attribution Terms — Separate from MIT**  
   NASA Earth Science observations and datasets accessed by Space Farm (including the **NASA LaRC POWER Project**) are **not** covered by Team CODE44's MIT code license. NASA Earth Science data is provided under NASA's Open Data Policy (generally **CC0** / public domain for EOSDIS data and open terms such as **CC BY 4.0** / attribution guidelines for POWER). Any use or redistribution of NASA data must:
   * Acknowledge **NASA** and the specific data provider/archive (e.g., *NASA Langley Research Center (LaRC) Prediction of Worldwide Energy Resource (POWER) Project*), including dataset parameters, source URL, and retrieval timestamp.
   * **Not** imply official NASA endorsement, sponsorship, or certification, and **not** misuse official NASA logos/insignias.

3. **Agronomic & Third-Party References**  
   External agronomic references (e.g., FAO or peer-reviewed rotation literature) remain subject to their respective publishers' citation and licensing terms and are tracked separately in `data/catalog/` and [docs/SOURCES.md](docs/SOURCES.md).

---

## Key Project Documents
* [PROJECT_BRIEF.md](PROJECT_BRIEF.md) — Product vision, Ganja pilot story, MVP vs. out-of-scope boundaries
* [PROJECT_PLAN.md](PROJECT_PLAN.md) — Target architecture, exact path ownership matrix, engine design
* [PROJECT_STATE.md](PROJECT_STATE.md) — Current implementation status, blockers, integration log
* [ROADMAP.md](ROADMAP.md) — Milestones (`M0`–`M4`) and task board (`A-00`–`R-03`)
* [docs/API_CONTRACT.md](docs/API_CONTRACT.md) — `v0.1.0 DRAFT` HTTP API & Python provider contract
* [docs/DATA_RULES.md](docs/DATA_RULES.md) — NASA POWER query, manifest, cache & scientific integrity rules
* [docs/ACCEPTANCE_TESTS.md](docs/ACCEPTANCE_TESTS.md) — Mandatory test suite (`T01`–`T24`) & 2-minute demo script
* [docs/GIT_WORKFLOW.md](docs/GIT_WORKFLOW.md) — Parallel branch, PR, sequential merge & conflict guide
* [docs/TEAM_PLAYBOOK.md](docs/TEAM_PLAYBOOK.md) — Azerbaijani onboarding guide for Team CODE44
