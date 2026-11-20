# 🛡️ KAVACH AI: Deterministic Invariant Armor & Hybrid Semantic Shield
### Autonomous Enterprise Agent Governance & Sub-Millisecond Execution Kernel
**Event:** Google DeepMind × Google Cloud Startup Buildathon India 2026 (Bengaluru)  
**Track:** Open Innovation (Enterprise AI / FinTech Security)  
**Founding Entity:** Nexus LAB AI Systems (`nexuslabaisystems.com`)  
**Founder & Systems Architect:** Sourav Ray (`@Roy12233444`)

---

## 1. Executive Summary

Autonomous agents powered by Large Language Models (**Google Gemini 2.5 Flash**) possess extraordinary cognitive reasoning capabilities. However, enterprise institutions (banking, healthcare, government, and cloud infrastructure) **cannot safely grant autonomous agents unguarded access to production databases, OS shells, or cloud billing**.

A single obfuscated prompt injection, Hinglish override, or unverified hallucination can execute `rm -rf`, `DROP TABLE`, or leak sensitive sovereign PII (Aadhaar, PAN, API secrets) in milliseconds.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                            THE ENTERPRISE PARADOX                           │
│  "Google Gemini 2.5 Flash provides dynamic semantic reasoning.              │
│   KAVACH AI guarantees deterministic, sub-millisecond invariant survival."   │
└─────────────────────────────────────────────────────────────────────────────┘
```

**KAVACH AI** operates as a dual-engine, zero-trust execution kernel placed directly between AI agent planning and host/database/cloud side effects. Every candidate action passes through deterministic Vedic Invariant Envelopes (**Ṛta**) and a 4-layer Hybrid Semantic Shield before kernel or SQL dispatch.

---

## 2. Dual-Engine System Architecture

```text
                        ┌─────────────────────────────────────────┐
                        │        HUMAN DIRECTIVE / AGENT          │
                        └────────────────────┬────────────────────┘
                                             │
                                             ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ STAGE 1: DETERMINISTIC INVARIANT ENGINE (discus/guard.py — Fast-Path < 0.2 ms)             │
│    • R6 VARUṆA:    Permanent Stateful Session Burn Registry                                │
│    • R8 SARASVATĪ: Prompt Injection, Jailbreak & DAN Regex Matrix                           │
│    • R3 MITRA:     Sovereign PII & Secrets (Aadhaar, PAN, Phone, API Keys)                  │
│    • R10 INDRA:    Destructive OS & SQL Syscall Gate (`rm -rf`, `DROP TABLE`, `TRUNCATE`)   │
│    • R2 YAMA:      Agent Role Privilege & Scope Boundary Enforcement                        │
└────────────────────────────────────────────┬────────────────────────────────────────────────┘
                                             │
                                             ▼ (Clean Fast-Path → Semantic Shield)
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ STAGE 2: HYBRID SEMANTIC ADVERSARIAL SHIELD (kavach/safety/semantic_shield.py)              │
│    • Layer 0 (De-obfuscator): NFKC, Zero-Width Strip, Homoglyphs, Leetspeak, Base64 Decode │
│    • Layer 1 (Action-Graph):  Bilingual Hinglish/Typo Normalizer + Verb×Target Graph (< 2ms)│
│    • Layer 2 (Vector Guard):  2048-dim NumPy L2 Cosine Similarity + Margin Gate            │
│    • Layer 3 (Semantic Judge): Live Google `gemini-2.5-flash` JSON Judge (`GEMINI_API_KEY`) │
└────────────────────────────────────────────┬────────────────────────────────────────────────┘
                                             │
                    ┌────────────────────────┴────────────────────────┐
                    │                                                 │
           [Verdict: APPROVED]                               [Verdict: KILLED]
                    │                                                 │
                    ▼                                                 ▼
┌─────────────────────────────────────┐             ┌─────────────────────────────────────┐
│ KAVACH EXECUTION & PHYSICAL PROOF   │             │ STATEFUL SESSION BURN (R6 VARUṆA)   │
│  • `production_database.txt` (95 B) │             │  • Pre-execution halt (< 1–7 ms)    │
│  • `core_banking.db` (5 Accts,      │             │  • Session burned across follow-ups │
│    ₹90,050,000.50 INR)              │             │  • 0 Bytes altered on OS disk       │
│  • `HostIntegrityWatcher` (0.8s poll)│            │  • Real-time WebSocket & OS toast   │
└─────────────────────────────────────┘             └─────────────────────────────────────┘
```

---

## 3. Repository Modules

| Path | Responsibility |
| :--- | :--- |
| `discus/` | Immutable deterministic invariant engine (`DiscusGuard`, Vedic rule envelopes) |
| `kavach/safety/semantic_shield.py` | 4-Layer Hybrid Semantic Shield (De-obfuscator, Action-Graph, Cosine Guard, Gemini 2.5 Flash) |
| `kavach/runtime/host_watcher.py` | Async `0.8s` OS filesystem (`os.stat` + SHA-256) & SQLite integrity watcher |
| `kavach/hands/` & `kavach/intent/` | Sandboxed execution runtime (`executor.py`, `sandbox.py`) & Viveka intent classifier |
| `kavach_ui/server.py` | Cloud-ready FastAPI + WebSocket server, QR generator, SQLite auto-seeder |
| `kavach_ui/frontend/` | React 19 + TypeScript + Vite 6 + Tailwind v4 Mission Control UI (`kavach_ui/static/dist/`) |
| `enterprise_banking_guard.py` | CLI Core Banking Defense demo (`₹90,050,000.50 INR` SQLite ledger) |
| `test_side_effect.py` & `live_test.py` | Physical filesystem proof rig & 39-scenario ground-truth test suite |

---

## 4. Quickstart: Local Execution (Mission Control Web UI & CLI)

```powershell
# 1. Clone the repository
git clone https://github.com/Roy12233444/kavach-ai.git
cd kavach-ai

# 2. Initialize virtual environment (uv or standard Python 3.11+)
uv venv .venv --python 3.11
uv pip install -r requirements.txt

# 3. Configure optional Live Gemini 2.5 Flash Layer 3 Judge
# Create .env containing: GEMINI_API_KEY=your_google_ai_studio_key

# 4. Launch KAVACH AI Mission Control & Physical Proof UI (http://localhost:8080)
.\.venv\Scripts\python.exe -m kavach_ui.server
```

---

## 5. Zero-Docker Deployment on Google Cloud Run (`asia-south1`)

KAVACH AI ships with pre-compiled frontend static assets (`kavach_ui/static/dist/`), automatic SQLite ledger seeding (`ensure_core_banking_db`), dynamic proxy-aware Jury QR URL resolution (`resolve_jury_url`), `$PORT` binding, `.gcloudignore`, and a Google Cloud Buildpacks `Procfile` — requiring **zero local Docker**:

```bash
# Run directly in Google Cloud Shell (browser) or gcloud CLI:
gcloud run deploy kavach-ai \
  --source . \
  --region asia-south1 \
  --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY="YOUR_KEY"
```

- Auto-seeds `core_banking.db` (`5 Active Accounts · ₹90,050,000.50 INR`) and `production_database.txt` (`95 bytes`) on cold container startup.
- Automatically detects `X-Forwarded-Proto: https` & `Host` so **Jury QR** links encode `https://<cloud-run-service>.run.app/jury` for instant 5G smartphone evaluation.

---

**Buildathon Submission 2026** | **Nexus LAB AI Systems** | `sourav@nexuslabaisystems.com`
