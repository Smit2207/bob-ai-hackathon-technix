# MedBrief AI â€” Clinical Handover & Brief Generation Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node](https://img.shields.io/badge/Node-20+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18+-61dafb.svg)](https://react.dev/)
[![Prisma](https://img.shields.io/badge/Prisma-5.x-2D3748.svg)](https://www.prisma.io/)

> **P3 Submission â€” IBM Bob AI Hackathon**  
> Track: AI | Problem Statement: P3 â€” Clinical Handover Safety

**MedBrief AI** is a clinician-focused platform for generating evidence-linked clinical briefs and managing handover continuity. It extracts structured clinical data from uploaded documents (PDF/text), builds a longitudinal patient timeline, and produces four types of briefs â€” Ward Round, Referral, Discharge/Handoff, and Discharge Summary â€” with full evidence traceability. The **Handover Guard** feature provides a patient-specific review workspace for unresolved investigations, referrals, follow-ups, medication changes, and documentation conflicts, with three-state review tracking and persistence.

An optional **IBM watsonx.ai** integration enables LLM-enhanced Ask and Brief generation using Granite models, with automatic fallback to the deterministic engine and explicit AI transparency indicators.

**Repository**: https://github.com/Smit2207/bob-ai-hackathon-technix  
**Live Demo**: NOT DEPLOYED  
**Demo Video**: *(see `demo/demo-video-link.txt`)*

---

## Key Features

### Handover Guard (P3 Core Innovation)
- **Patient-specific review workspace** for unresolved investigations, open referrals, pending follow-ups, medication changes, and documentation conflicts
- **Evidence linking** â€” every item references its source document, page, and excerpt
- **Three-state review workflow**: `Incomplete` â†’ `Ready for clinician review` â†’ `Clinician reviewed`
- **Persistence**: Live mode uses Prisma/SQLite; demo mode uses localStorage
- **Safety-first**: Never invents dates, owners, or decisions; shows "Not documented" when unknown

### Clinical Brief Generation (4 Types)
| Brief Type | Use Case |
|------------|----------|
| **Ward Round** | Daily ward rounds with current state, medication reconciliation, active issues, Handover Guard items, plan |
| **Referral** | Specialist referrals with reason, history, medications, investigations, structured questions |
| **Discharge / Handoff** | Transitions of care with medication reconciliation categories and outstanding items |
| **Discharge Summary** | Comprehensive formal discharge summary |

All briefs include editable draft sections, markdown download, and a numbered evidence index.

### Evidence-Grounded Search & Ask
- Keyword search over structured fields and source chunks with relevance scoring
- Natural-language Ask answered only from retrieved evidence â€” DOCUMENTED/UNKNOWN provenance, no hallucination
- IBM watsonx.ai (optional) enhances Ask/Brief generation with Granite models

### Multi-Document Longitudinal Analysis
- ChangeMap: detects changes across multiple clinical documents
- CareLoop tracking: open/closed care loops per investigation and referral
- Medication reconciliation: Continued / Changed / Stopped / New / Conflicting categories
- Documentation conflict detection across documents

### Demo Mode
Append `?demo=1` to any patient URL to run the full clinical engine without authentication, database, or AI credentials.

---

## Architecture

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                        MedBrief AI                              â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  Frontend (React 18 + TypeScript + Vite + Tailwind)            â”‚
â”‚  src/client/src/                                               â”‚
â”‚  â”œâ”€â”€ Pages: Dashboard, PatientContinuity, Timeline,            â”‚
â”‚  â”‚         Briefs, Handover, Evidence/Ask, Analytics, Compare  â”‚
â”‚  â”œâ”€â”€ State: Zustand (patient, auth stores)                     â”‚
â”‚  â””â”€â”€ API client with demo/live mode switching                  â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  Backend (Express + TypeScript + Prisma + SQLite)              â”‚
â”‚  src/server/src/                                               â”‚
â”‚  â”œâ”€â”€ REST API: /api/auth, /api/patients                        â”‚
â”‚  â”‚   â”œâ”€â”€ Clinical: /search, /ask, /briefs, /analytics         â”‚
â”‚  â”‚   â”œâ”€â”€ AI-enhanced: /ask-ai, /briefs-ai (watsonx optional)  â”‚
â”‚  â”‚   â””â”€â”€ Handover: /handover-reviews (CRUD)                   â”‚
â”‚  â””â”€â”€ Services: extractionPipeline, aiProvider, sharedEngineBridge
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  Shared Clinical Engine (TypeScript, zero-runtime deps)        â”‚
â”‚  src/shared/clinical/                                          â”‚
â”‚  â”œâ”€â”€ pipeline.ts â€” analyseDocuments() â†’ Analysis + Chunks     â”‚
â”‚  â”œâ”€â”€ extract.ts â€” clinical entity extraction (regex/heuristic) â”‚
â”‚  â”œâ”€â”€ temporal.ts â€” handover items, medication reconciliation   â”‚
â”‚  â”œâ”€â”€ briefs.ts â€” 4 brief types with evidence index             â”‚
â”‚  â””â”€â”€ retrieval.ts â€” searchPatient, answerFromRecord            â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  Database: SQLite via Prisma                                   â”‚
â”‚  src/server/prisma/schema.prisma                               â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

## Quick Start

### Prerequisites
- Node.js 20+
- npm 10+

### Demo Mode (No Database/Auth Required)

```bash
git clone https://github.com/Smit2207/bob-ai-hackathon-technix.git
cd bob-ai-hackathon-technix/src
npm install --prefix client
npm run dev --prefix client
# â†’ http://localhost:5173/?demo=1
```

### Full Live Mode Setup

```bash
# 1. Install dependencies
cd src
npm install --prefix client
npm install --prefix server

# 2. Configure server environment
cp server/.env.example server/.env
# Edit server/.env:
#   DATABASE_URL="file:./prisma/dev.db"   (SQLite default)
#   JWT_SECRET="<generate: openssl rand -base64 32>"

# 3. Initialize database
npm run prisma:migrate   # from src/

# 4. Start servers (two terminals)
npm run dev:server       # â†’ http://localhost:5000
npm run dev:client       # â†’ http://localhost:5173
```

### IBM watsonx.ai (Optional)

```bash
# In src/server/.env
AI_PROVIDER=watsonx
WATSONX_API_KEY=your-ibm-cloud-api-key
WATSONX_PROJECT_ID=your-watsonx-project-id
WATSONX_URL=https://us-south.ml.cloud.ibm.com
WATSONX_MODEL_ID=ibm/granite-13b-chat-v2
```

---

## Testing

```bash
cd src
npm test                     # runs server test suite
npm run typecheck:client     # TypeScript check on frontend
npm run build:client         # production build
```

**Test suite**: 9 test files. Run `npm test` from `src/` to see actual results.

---

## Repository Structure

```
bob-ai-hackathon-technix/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ client/                    # React frontend (Vite + Tailwind)
â”‚   â”‚   â”œâ”€â”€ src/
â”‚   â”‚   â”‚   â”œâ”€â”€ components/        # UI + Clinical components
â”‚   â”‚   â”‚   â”œâ”€â”€ pages/             # 20 route pages
â”‚   â”‚   â”‚   â”œâ”€â”€ store/             # Zustand stores (patient, auth)
â”‚   â”‚   â”‚   â””â”€â”€ utils/api.ts       # API client (demo/live)
â”‚   â”‚   â””â”€â”€ package.json
â”‚   â”œâ”€â”€ server/                    # Express backend
â”‚   â”‚   â”œâ”€â”€ src/
â”‚   â”‚   â”‚   â”œâ”€â”€ routes/            # auth.ts, patients.ts
â”‚   â”‚   â”‚   â”œâ”€â”€ services/          # extractionPipeline, aiProvider, sharedEngineBridge
â”‚   â”‚   â”‚   â”œâ”€â”€ middleware/        # auth.ts (JWT)
â”‚   â”‚   â”‚   â”œâ”€â”€ utils/             # prisma, jwt
â”‚   â”‚   â”‚   â””â”€â”€ __tests__/         # 9 test files
â”‚   â”‚   â”œâ”€â”€ prisma/
â”‚   â”‚   â”‚   â”œâ”€â”€ schema.prisma      # SQLite schema
â”‚   â”‚   â”‚   â””â”€â”€ migrations/
â”‚   â”‚   â””â”€â”€ package.json
â”‚   â”œâ”€â”€ shared/                    # Shared clinical engine (TypeScript)
â”‚   â”‚   â””â”€â”€ clinical/              # types, pipeline, extract, temporal, briefs, retrieval
â”‚   â”œâ”€â”€ scripts/
â”‚   â”‚   â””â”€â”€ verify-engine.ts
â”‚   â”œâ”€â”€ package.json               # Workspace scripts
â”‚   â””â”€â”€ .env.example
â”œâ”€â”€ docs/
â”‚   â”œâ”€â”€ problem-statement.md
â”‚   â”œâ”€â”€ solution-overview.md
â”‚   â”œâ”€â”€ architecture.md
â”‚   â”œâ”€â”€ setup-guide.md
â”‚   â””â”€â”€ ibm-bob-integration.md
â”œâ”€â”€ demo/
â”‚   â”œâ”€â”€ demo-video-link.txt        # UPDATE with real video URL before final submission
â”‚   â”œâ”€â”€ live-demo-url.txt          # NOT DEPLOYED
â”‚   â””â”€â”€ screenshots/               # Add 3+ screenshots before submission
â”œâ”€â”€ presentation/                  # Add slides.pdf before submission
â”œâ”€â”€ submission.yaml
â”œâ”€â”€ README.md
â””â”€â”€ CONTRIBUTING.md
```

---

## IBM watsonx.ai Integration

MedBrief AI integrates with IBM watsonx.ai (Granite models) for LLM-enhanced clinical Ask and Brief generation:

- **Provider**: `AI_PROVIDER=watsonx` enables `WatsonxProvider` in `src/server/src/services/aiProvider.ts`
- **Auth**: IBM IAM token exchange with 1-hour TTL cache and 60-second buffer
- **Resilience**: 60s timeout, 2 retries with exponential backoff, 401/429/5xx handling
- **Transparency**: Every response includes `fallback` (bool), `model`, `provider`, `error` metadata; UI shows "AI: model" or "Deterministic" badges
- **Fallback**: Any error automatically falls back to the deterministic MockProvider

See [`docs/ibm-bob-integration.md`](docs/ibm-bob-integration.md) for the IBM Bob IDE MCP integration roadmap.

---

## Known Limitations

| Area | Limitation |
|------|------------|
| Extraction | Heuristic/regex-based; not a validated clinical NLP pipeline |
| PDF | Text-only extraction; scanned/image PDFs require OCR (not implemented) |
| Medication matching | Exact name matching; no fuzzy or brand-generic mapping |
| AI | Single provider (watsonx); no streaming or function calling |
| Deployment | No production backend deployment; frontend only on Vercel |
| IBM Bob MCP | watsonx.ai REST integration implemented; Bob IDE MCP integration is a planned extension |

---

## Safety & Compliance

- **Not a medical device** â€” decision support only; clinician review required for all outputs
- **No PHI in logs** â€” source excerpts held in memory during processing only
- **AI transparency** â€” every AI response tagged with provider/model/fallback status
- **Audit trail** â€” HandoverReview records `reviewedAt`, `reviewedBy`

---

## Team

**Team**: FILL_IN_TEAM_NAME  
**Lead**: FILL_IN_LEAD_NAME  
**Track**: AI â€” P3 Medical Report Summarisation Assistant

---

## License

MIT License â€” see LICENSE for details.