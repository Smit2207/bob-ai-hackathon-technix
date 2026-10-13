# Solution Overview â€” MedBrief AI

## Core Workflow

```
Upload Documents â†’ Extract Entities â†’ Longitudinal Analysis
       â†“                                       â†“
  (PDF/text)         (medications,         (ChangeMap,
                      investigations,       CareLoops,
                      referrals,            medication
                      follow-ups,           reconciliation,
                      vitals, labs,         conflicts,
                      findings)             handover items)
                                                â†“
                                   Generate Clinical Briefs
                                   (Ward Round, Referral,
                                    Discharge/Handoff,
                                    Discharge Summary)
                                                â†“
                                   Evidence Index + Handover Guard
                                   (review workspace, state tracking,
                                    source links, accountability fields)
```

## 1. Document Upload & Extraction

Clinicians upload one or more clinical documents (PDF or plain text). The
extraction pipeline:
- Extracts text from PDFs using `pdf-parse`
- Chunks text into overlapping segments for retrieval
- Applies heuristic/regex clinical entity extraction to identify:
  - Medications (name, dose, frequency, route, status)
  - Investigations (name, ordered/performed dates, status, result)
  - Lab results, vitals, referrals, follow-ups, clinical findings
  - Clinical events (diagnoses, admissions, procedures)

Every extracted entity is linked to its source document and page number.

## 2. Longitudinal Analysis

After extraction, the shared clinical engine (`src/shared/clinical/`) runs
cross-document analysis:

- **ChangeMap**: Detects changes in medication doses, investigation statuses,
  and clinical findings across documents sorted by date
- **CareLoop tracking**: Identifies open/closed care loops â€” tests ordered but
  not resulted, referrals made but not resolved
- **Medication reconciliation**: Categorises medications as Continued, Changed,
  Stopped, New, or Conflicting/Unclear based on cross-document comparison
- **Conflict detection**: Flags contradictory entries (e.g., different doses of
  the same medication in different documents)
- **Handover item synthesis**: Builds a structured list of items requiring
  clinical review before care transfer

## 3. Clinical Brief Generation

Four brief types are generated deterministically from the analysed record:

| Brief | Key Sections |
|-------|--------------|
| **Ward Round** | Current state, medications, active issues, Handover Guard items, plan |
| **Referral** | Reason, clinical history, medications, investigations, structured questions |
| **Discharge/Handoff** | Medication reconciliation categories, Handover Guard items, follow-ups |
| **Discharge Summary** | Comprehensive formal summary with all clinical domains |

Each brief includes a **numbered evidence index** linking every clinical
statement to its source document and page.

All briefs are editable inline (add/remove/reorder lines), downloadable as
Markdown, and include a clinician-review-required disclaimer.

## 4. Handover Guard

The Handover Guard is MedBrief AI's primary innovation for P3.

It provides a structured review workspace displaying five categories of items
requiring clinical attention before care transfer:
- Outstanding investigations (ordered but no result documented)
- Open referrals (made but no outcome documented)
- Pending follow-ups (planned but not completed)
- Medication changes (dose changes, stops, new starts)
- Documentation conflicts (contradictory entries across documents)

Each item displays:
- Type, title, and description
- Source document, page, and excerpt
- Relevant date and last documented status
- Whether the item is a documented fact or a conflict/discrepancy
- Review state: `Incomplete` â†’ `Ready for clinician review` â†’ `Clinician reviewed`
- Accountability fields: accountable service, person, planned follow-up date,
  disposition/notes

Review states persist in live mode (Prisma/SQLite database) or demo mode
(browser localStorage).

## 5. Evidence-Grounded Ask

Clinicians can ask natural-language questions about the patient record.
The system:
1. Retrieves relevant evidence chunks using keyword and structured field search
2. Builds a grounded context from the retrieved evidence
3. Optionally calls IBM watsonx.ai (Granite models) to generate an answer
4. Returns the answer with explicit DOCUMENTED/UNKNOWN provenance labels

If watsonx.ai is unavailable, the system falls back to the deterministic
engine and clearly indicates this with an "Deterministic" badge.

## 6. Demo Mode

Demo mode runs the full clinical engine in the browser without:
- Authentication (no login required)
- Backend server (no API calls to Express)
- Database (localStorage only)
- AI credentials (deterministic engine only)

Access by appending `?demo=1` to any patient URL, or visiting `/?demo=1`.
Three synthetic demo patients are pre-loaded with multi-document records.

## IBM watsonx.ai Integration

When `AI_PROVIDER=watsonx` is set, the backend uses WatsonxProvider:
- Exchanges IBM IAM API key for an access token (1-hour TTL, 60s buffer)
- Calls the watsonx.ai text generation endpoint with a clinical safety prompt
- Returns the generated text with model/provider/fallback metadata
- Automatically falls back to MockProvider on any error

Every response carries transparency metadata enabling the UI to show
"AI: ibm/granite-13b-chat-v2" or "Deterministic" badges.