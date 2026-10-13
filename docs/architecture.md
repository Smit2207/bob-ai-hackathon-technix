# Architecture â€” MedBrief AI

## System Architecture

```mermaid
graph TB
    subgraph Browser
        UI[React 18 Frontend<br>Vite + Tailwind + Zustand]
    end

    subgraph src/client/src
        API[API Client<br>utils/api.ts<br>demo/live switching]
        STORE[Zustand Stores<br>patient.ts / auth.ts]
        PAGES[20 Route Pages<br>Dashboard, Timeline, Briefs,<br>Handover, Evidence, Compare]
    end

    subgraph src/server/src
        EXPRESS[Express 4.18<br>Node.js 20+]
        AUTH_ROUTE[/api/auth<br>register / login / logout]
        PATIENT_ROUTE[/api/patients<br>CRUD + clinical endpoints]
        EXTRACT[extractionPipeline.ts<br>PDF + text â†’ entities]
        BRIDGE[sharedEngineBridge.ts<br>calls shared engine]
        AI_SVC[aiProvider.ts<br>MockProvider / WatsonxProvider]
        PAT_SVC[patientService.ts<br>Prisma persistence]
        JWT_MW[auth middleware<br>JWT cookie + Bearer]
    end

    subgraph src/shared/clinical
        PIPELINE[pipeline.ts<br>analyseDocuments]
        EXTRACT_SH[extract.ts<br>entity extraction]
        TEMPORAL[temporal.ts<br>handover items<br>medication reconciliation]
        BRIEFS[briefs.ts<br>4 brief types<br>evidence index]
        RETRIEVAL[retrieval.ts<br>search + Ask]
        ANALYTICS[analytics.ts<br>per-patient aggregation]
    end

    subgraph Database
        SQLITE[(SQLite<br>via Prisma 5.10<br>src/server/prisma/)]
    end

    subgraph IBM Cloud
        WATSONX[IBM watsonx.ai<br>Granite models<br>optional]
        IAM[IBM IAM<br>token exchange]
    end

    UI --> API
    API --> EXPRESS
    EXPRESS --> AUTH_ROUTE
    EXPRESS --> PATIENT_ROUTE
    PATIENT_ROUTE --> EXTRACT
    PATIENT_ROUTE --> BRIDGE
    PATIENT_ROUTE --> AI_SVC
    PATIENT_ROUTE --> PAT_SVC
    BRIDGE --> PIPELINE
    PIPELINE --> EXTRACT_SH
    PIPELINE --> TEMPORAL
    PIPELINE --> BRIEFS
    PIPELINE --> RETRIEVAL
    PIPELINE --> ANALYTICS
    PAT_SVC --> SQLITE
    AI_SVC -->|AI_PROVIDER=watsonx| WATSONX
    AI_SVC -->|token exchange| IAM
    WATSONX --> IAM
```

## Component Breakdown

### Frontend (`src/client/`)

**Technology**: React 18 + TypeScript + Vite 5 + Tailwind CSS 3.4 + Zustand 4.5 + React Router 6

| Directory | Contents |
|-----------|----------|
| `src/components/` | Layout, Navigation, clinical UI components |
| `src/pages/` | 20 route pages: Dashboard, PatientTimeline, PatientContinuity, ChangeMap, CareLoop, Medications, Investigations, PatientEvidence, PatientBriefs, PatientHandover, PatientAnalytics, PatientCompare, etc. |
| `src/store/patient.ts` | Zustand patient store (demo + live mode) |
| `src/store/auth.ts` | Zustand auth store (JWT, user state) |
| `src/utils/api.ts` | API client with demo/live mode switching |

**Demo mode**: When `?demo=1` is in the URL, the API client is bypassed and the shared clinical engine runs directly in the browser using localStorage for persistence.

### Backend (`src/server/`)

**Technology**: Node.js 20+ + Express 4.18 + TypeScript + Prisma 5.10 + SQLite

| Module | Responsibility |
|--------|---------------|
| `src/index.ts` | Express app setup, CORS, middleware, routes, health check |
| `routes/auth.ts` | POST /register, POST /login, POST /logout |
| `routes/patients.ts` | Full patient CRUD + document upload + all clinical endpoints |
| `services/extractionPipeline.ts` | PDF/text â†’ entity extraction â†’ Prisma persistence |
| `services/sharedEngineBridge.ts` | Calls shared engine on persisted patient data |
| `services/aiProvider.ts` | MockProvider (deterministic) + WatsonxProvider (IBM watsonx.ai) |
| `services/patientService.ts` | Prisma-based patient data access layer |
| `middleware/auth.ts` | JWT verification (cookie + Bearer token) |
| `utils/jwt.ts` | Sign/verify JWT; production secret enforcement |
| `utils/prisma.ts` | Prisma client singleton |

### Shared Clinical Engine (`src/shared/`)

Pure TypeScript â€” zero runtime dependencies. Runs in both Node.js (server) and browser (demo mode).

| Module | Responsibility |
|--------|---------------|
| `clinical/types.ts` | All shared TypeScript types |
| `clinical/pipeline.ts` | `analyseDocuments()` â€” main entry point |
| `clinical/extract.ts` | Regex/heuristic entity extraction |
| `clinical/temporal.ts` | `buildHandoverItems()`, `buildMedicationReconciliation()` |
| `clinical/briefs.ts` | `buildBrief()` â€” 4 brief types + evidence index |
| `clinical/retrieval.ts` | `searchPatient()`, `answerFromRecord()` |
| `clinical/byoai.ts` | `buildByoaiContext()` â€” grounded context for external AI |
| `clinical/compare.ts` | Patient comparison diff |
| `clinical/analytics.ts` | Per-patient analytics aggregation |
| `demo/records.ts` | 3 synthetic demo patients |

### Database (`src/server/prisma/`)

**Provider**: SQLite (via Prisma 5.10)  
**File**: `src/server/prisma/dev.db` (local, gitignored)

Key models: `User`, `PatientRecord`, `Document`, `DocumentChunk`, `ClinicalEvent`, `Medication`, `MedicationChange`, `Investigation`, `LabResult`, `Vital`, `Referral`, `FollowUp`, `ClinicalFinding`, `CareLoop`, `DocumentationConflict`, `GeneratedBrief`, `HandoverReview`

`HandoverReview` has a unique constraint on `(patientId, linkedEntityId, linkedEntityType)` preventing duplicate review entries.

## End-to-End Data Flow

```
1. User uploads document (PDF/txt)
         â†“
2. extractionPipeline: text extraction â†’ chunking â†’ entity extraction
         â†“
3. Prisma persistence: Document, DocumentChunk, Medication, Investigation,
   Referral, FollowUp, ClinicalFinding, ClinicalEvent, LabResult, Vital
         â†“
4. sharedEngineBridge: loads all patient data from DB â†’
   analyseDocuments() â†’ ChangeMap, CareLoops, MedChanges, Conflicts, HandoverItems
         â†“
5. Prisma persistence: analysis results saved to PatientRecord.analysisJson
         â†“
6. Client requests (e.g., GET /api/patients/:id/briefs):
   â†’ bridge re-runs analysis â†’ buildBrief() â†’ returns brief with evidence index
         â†“
7. Client requests (e.g., POST /api/patients/:id/ask-ai):
   â†’ builds grounded context â†’ WatsonxProvider (or MockProvider) â†’ AIResult
         â†“
8. Handover review update (PUT /api/patients/:id/handover-reviews/:entityId):
   â†’ upsert HandoverReview record â†’ reviewState + accountability fields
```

## Authentication Flow

- Registration: POST /api/auth/register â†’ bcrypt hash â†’ DB User â†’ JWT cookie + response
- Login: POST /api/auth/login â†’ bcrypt compare â†’ JWT cookie (httpOnly) + Bearer support
- Protected routes: `requireAuth` middleware reads JWT from cookie or Authorization header
- Demo mode: bypasses authentication entirely

## IBM watsonx.ai Integration Detail

```
POST /api/patients/:id/ask-ai (or /briefs-ai)
         â†“
aiProvider.getProvider() checks AI_PROVIDER env var
         â†“ (if "watsonx")
WatsonxProvider.generate(prompt, context)
         â†“
IAM token exchange: POST https://iam.cloud.ibm.com/identity/token
(cached 1hr TTL with 60s buffer)
         â†“
watsonx.ai text generation: POST {WATSONX_URL}/ml/v1/text/generation?version=2023-05-29
(60s timeout, 2 retries with exponential backoff)
         â†“
Response validation: results[0].generated_text || generated_text || output.generated_text
         â†“
Returns AIResult { text, model, provider:"watsonx", fallback:false }
         â†“ (on any error)
Falls back to MockProvider, sets fallback:true, includes error message
```