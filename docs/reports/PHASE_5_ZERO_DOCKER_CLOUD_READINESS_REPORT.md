# Phase 5 Forensic Verification Report: Zero-Docker Cloud Readiness & Buildpacks Deployment

**Date:** `2026-11-20` (`17:01 IST`)  
**Workspace:** `E:\KAVACH-AI`  
**Repository:** `https://github.com/Roy12233444/kavach-ai` (`branch: main`)  
**Target Platform:** **Google Cloud Run** (`asia-south1`, Mumbai) via **Google Cloud Buildpacks** *(Zero Local Docker)*  
**Architect / Developer:** Sourav Ray (`@Roy12233444`) — Nexus LAB AI Systems  
**Protocol Compliance:** Kill Critic & Architecture Enforcement Protocol · Completion Formula Verified

---

## 1. Executive Summary

Phase 5 prepared **KAVACH AI** for **24/7 public HTTPS deployment on Google Cloud Run** without installing or running Docker on the local developer laptop. Every identified cloud deployment trap was engineered, hardened, and empirically verified via 12 automated `TestClient` + filesystem + SQLite checks before pushing to GitHub.

### Three Cloud Deployment Traps Eliminated

| Cloud Trap | Root Cause Before Phase 5 | Phase 5 Engineering Fix | Verification Result |
| :--- | :--- | :--- | :--- |
| **Trap 1: Empty Cloud Banking Ledger (`₹0.00 INR`)** | `core_banking.db` is excluded by `.gitignore`; a fresh cloud container booted with `status: "database_not_found"` and `0` accounts. | Implemented `ensure_core_banking_db(force_baseline=False)` in `kavach_ui/server.py` using the canonical schema & 5 HNW accounts from `enterprise_banking_guard.py`, invoked on startup, `lifespan`, and `/api/proto/reset-demo`. | **[PASS]** Deleting `core_banking.db` and running `ensure_core_banking_db()` or `POST /api/proto/reset-demo` auto-seeds `5` accounts (`₹90,050,000.50 INR`, `status: "verified"`). |
| **Trap 2: Hardcoded LAN IP & Fixed Port `8080` Breaking 5G Jury QR** | `/api/proto/status` and `/api/proto/jury-qr.svg` returned `http://{get_lan_ip()}:8080/jury`, which fails behind Cloud Run HTTPS reverse proxies (`443`) and dynamic `$PORT`. | Added `SERVER_PORT = int(os.getenv("PORT", "8080"))` and `resolve_jury_url(request)` inspecting `PUBLIC_URL`, `X-Forwarded-Host` / `Host`, and `X-Forwarded-Proto`, falling back to `get_lan_ip()` locally. | **[PASS]** Local calls resolve `http://172.18.8.211:8080/jury`; Cloud Run proxy headers resolve `https://kavach-ai-prod.asia-south1.run.app/jury` and return `2018`-byte SVG QR codes. |
| **Trap 3: Zero-Docker Buildpacks + Clean Repo Hygiene** | No `Procfile`, no `.gcloudignore`, missing `numpy>=1.26.0` in `requirements.txt`, and leftover untracked `docs/kavach-ai-—-proto-1-mission-control/` folder. | Added 1-line `Procfile` (`web: uvicorn kavach_ui.server:app --host 0.0.0.0 --port $PORT`), `.gcloudignore`, `numpy>=1.26.0` in `requirements.txt`, rebuilt `kavach_ui/static/dist/`, updated `README.md`, and removed the unused export folder. | **[PASS]** Clean `npm run build` (`4.78s`, `0` `RTA-GUARD` hits), `0` modified files inside `discus/`, `config/`, or `profiles/`. |

---

## 2. Modified & Created Artifacts Inventory

1. **[kavach_ui/server.py](file:///E:/KAVACH-AI/kavach_ui/server.py)**
   - Added `SERVER_PORT = int(os.getenv("PORT", "8080"))` and `html` escaping for SVG fallback text.
   - Added `SEED_BANKING_ACCOUNTS` (`ACC-IND-10091` through `ACC-IND-10095`, totaling `₹90,050,000.50 INR`) and `ensure_core_banking_db(force_baseline: bool = False)` creating `accounts` and `audit_ledger` tables whenever `core_banking.db` is absent, empty, or out of baseline when forced.
   - Added `resolve_jury_url(request: Optional[Request] = None)`:
     - Priority 1: `PUBLIC_URL` environment variable (`f"{public_url.rstrip('/')}/jury"`).
     - Priority 2: `X-Forwarded-Host` (or `Host`) + `X-Forwarded-Proto` (or `request.url.scheme`) when non-local (`not in {"localhost", "127.0.0.1", "0.0.0.0", "", "testserver"}`).
     - Fallback: `f"http://{get_lan_ip()}:{SERVER_PORT}/jury"` for local laptop/LAN testing.
   - Updated `GET /api/proto/status` to accept `Request`, include `"cloud_ready": True`, `"port": SERVER_PORT`, and dynamic `"jury_url"`.
   - Updated `GET /api/proto/jury-qr.svg` to accept `Request` and optional `url: Optional[str] = None` (validated for `http://` / `https://` prefix).
   - Wired `ensure_core_banking_db()` into module startup, FastAPI `lifespan` before `host_watcher.sync_baseline()`, and `POST /api/proto/reset-demo`.
2. **[kavach_ui/frontend/src/components/QrModal.tsx](file:///E:/KAVACH-AI/kavach_ui/frontend/src/components/QrModal.tsx)** & compiled **[kavach_ui/static/dist/](file:///E:/KAVACH-AI/kavach_ui/static/dist/index.html)**
   - Updated modal copy to cover both 5G Cloud Run mobile scanning and local Wi-Fi scanning.
   - Passed `url=${encodeURIComponent(juryUrl)}` to `/api/proto/jury-qr.svg` so the rendered QR SVG stays strictly synchronized with the active URL pill.
   - Rebuilt production assets via `tsc --noEmit && vite build` (`index.html` `0.52 kB`, `index-BHuzPrl9.css` `34.41 kB`, `index-DV-CukIE.js` `293.94 kB`).
3. **[Procfile](file:///E:/KAVACH-AI/Procfile)**
   - Single-line Cloud Buildpacks entrypoint: `web: uvicorn kavach_ui.server:app --host 0.0.0.0 --port $PORT`.
4. **[.gcloudignore](file:///E:/KAVACH-AI/.gcloudignore)**
   - Excludes `.git/`, `.venv/`, `venv/`, `ENV/`, `node_modules/`, `kavach_ui/frontend/node_modules/`, `__pycache__/`, `*.py[cod]`, `.env`, `.env.local`, `core_banking.db`, logs, and non-runtime editor/doc folders from Google Cloud Buildpacks source uploads.
5. **[requirements.txt](file:///E:/KAVACH-AI/requirements.txt)**
   - Verified every third-party import across `discus/`, `kavach/`, and `kavach_ui/` against `.venv` and added `numpy>=1.26.0` (required by `kavach/safety/semantic_shield.py` Layer 2 Cosine Similarity Engine).
6. **[README.md](file:///E:/KAVACH-AI/README.md)**
   - Updated architecture diagrams, canonical `kavach/` directory references, Hybrid Semantic + Gemini 2.5 Flash documentation, and Zero-Docker Google Cloud Run quickstart command.
7. **Workspace Cleanup**
   - Removed unused Google AI Studio raw export folder `docs/kavach-ai-—-proto-1-mission-control/` so GitHub contains only canonical code, compiled static assets, architecture plans, and verification reports.

---

## 3. Empirical Test & Audit Evidence (Executed `2026-11-20 17:00–17:01 IST`)

All 12 verification checks executed directly against `E:\KAVACH-AI\.venv\Scripts\python.exe` after final code edits passed with exit code `0`:

| Check ID | Verification Scope | Observed Result |
| :---: | :--- | :--- |
| **1** | `CORE_BANKING_DB.unlink()` → `ensure_core_banking_db()` | `[PASS]` Recreated `core_banking.db`: `total_accounts=5`, `total_balance_inr=90050000.5`, `formatted_balance="₹90,050,000.50 INR"`, `status="verified"`. |
| **2** | `GET /` and `GET /jury` via `TestClient` | `[PASS]` Both routes returned HTTP `200` with `Cache-Control: no-store`. |
| **3** | `GET /api/proto/status` (Localhost request) | `[PASS]` `"cloud_ready": true`, `"jury_url": "http://172.18.8.211:8080/jury"`. |
| **4** | `GET /api/proto/status` (`X-Forwarded-Proto: https`, `X-Forwarded-Host: kavach-ai-prod.asia-south1.run.app`) | `[PASS]` `"jury_url": "https://kavach-ai-prod.asia-south1.run.app/jury"`, `banking.total_balance_inr=90050000.5`. |
| **5** | `GET /api/proto/jury-qr.svg` with Cloud Run headers | `[PASS]` Returned HTTP `200`, `Content-Type: image/svg+xml`, `2018` SVG bytes containing `<svg`. |
| **6** | `WS /ws/telemetry` snapshot handshake | `[PASS]` Connected and received `type="snapshot"` (`lsn=100`, `banking.total_accounts=5`, `banking.total_balance_inr=90050000.5`). |
| **7** | Compiled bundle brand purity scan (`kavach_ui/static/dist/`) | `[PASS]` `0` occurrences of `RTA-GUARD` or `RTA_GUARD` in built assets. |
| **8** | `PUBLIC_URL="https://kavach-custom.run.app/"` env override | `[PASS]` `resolve_jury_url(None)` returned `"https://kavach-custom.run.app/jury"`. |
| **9** | `POST /api/proto/check` destructive attack (`rm -rf production_database.txt`) | `[PASS]` `verdict="KILL"`, `rule="R10_INDRA"`, latency `7.352 ms`. |
| **10** | `POST /api/proto/check` benign query (`Show active account count in core banking ledger`) | `[PASS]` `verdict="PASS"` via live Gemini 2.5 Flash pipeline (`1450.453 ms`). |
| **11** | `POST /api/proto/proof-compare` (`rm -rf production_database.txt && DROP TABLE users`) | `[PASS]` `unguarded.status="DESTROYED"` (`0` bytes), `guarded.status="PROTECTED"` (`95` bytes intact). |
| **12** | `CORE_BANKING_DB.unlink()` → `POST /api/proto/reset-demo` | `[PASS]` Auto-reseeded `5` accounts (`₹90,050,000.50 INR`) and verified `95`-byte canary. |
| **Anti-Contamination** | `git status --short discus/ config/ profiles/` | **[PASS]** Empty output — zero modifications to `discus/`, `config/`, or `profiles/`. |

---

## 4. Next Action: Phase 6 — Live Deployment on Google Cloud Run (`asia-south1`)

Zero Docker is required on the laptop. Once pushed to `Roy12233444/kavach-ai`, deploy via either:

1. **Google Cloud Run Web Console (Browser Point-and-Click):**  
   Create Service → **Continuously deploy from a repository (Source)** → `Roy12233444/kavach-ai` (`main`, Buildpacks) → Region `asia-south1` → **Allow unauthenticated invocations** → Set env var `GEMINI_API_KEY` → Deploy.
2. **Google Cloud Shell (Browser Terminal — 2 Commands):**
   ```bash
   git clone https://github.com/Roy12233444/kavach-ai.git && cd kavach-ai
   gcloud run deploy kavach-ai --source . --region asia-south1 --allow-unauthenticated --set-env-vars GEMINI_API_KEY="YOUR_KEY"
   ```
