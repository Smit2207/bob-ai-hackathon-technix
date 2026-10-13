# IBM Bob Integration â€” MedBrief AI

## Status

MedBrief AI integrates with **IBM watsonx.ai** (Granite models) via REST API
for LLM-enhanced clinical Ask and Brief generation.

A direct integration with **IBM Bob IDE** (via the Model Context Protocol / MCP)
is documented below as a planned extension. The MCP server scaffold and tool
definitions are provided in this file as a roadmap, but have not been deployed
or tested in a live Bob IDE environment due to credential and environment
constraints in the hackathon setting.

---

## Implemented: IBM watsonx.ai REST Integration

**File**: `src/server/src/services/aiProvider.ts` â€” `WatsonxProvider` class

### How It Works

1. **Activation**: Set `AI_PROVIDER=watsonx` in `src/server/.env`
2. **IAM Authentication**: The provider exchanges an IBM Cloud API key for an
   IAM access token via `POST https://iam.cloud.ibm.com/identity/token`
   - Token is cached with a 1-hour TTL and 60-second buffer
   - Cache is cleared on 401 responses
3. **Text Generation**: Calls `{WATSONX_URL}/ml/v1/text/generation?version=2023-05-29`
   with a clinical safety prompt and the patient's grounded evidence context
4. **Resilience**: 60-second timeout (AbortController), 2 retries with
   exponential backoff, explicit handling of 401/429/5xx status codes
5. **Response Extraction**: Handles multiple response shapes:
   `results[0].generated_text`, `generated_text`, `output.generated_text`
6. **Fallback**: Any error falls back to `MockProvider` (deterministic engine)
   with `fallback:true` and the error message in `AIResult.error`

### Configuration

```bash
# src/server/.env
AI_PROVIDER=watsonx
WATSONX_API_KEY=your-ibm-cloud-api-key
WATSONX_PROJECT_ID=your-watsonx-project-id
WATSONX_URL=https://us-south.ml.cloud.ibm.com
WATSONX_MODEL_ID=ibm/granite-13b-chat-v2
```

### Endpoints Using watsonx.ai

| Endpoint | Description |
|----------|-------------|
| `POST /api/patients/:id/ask-ai` | Answer a clinical question from grounded patient context |
| `POST /api/patients/:id/briefs-ai` | Generate an AI-enhanced clinical brief |

### Clinical Safety Prompt

The system prompt enforces evidence-grounded responses:
```
You are MedBrief AI, a clinical documentation assistant.
CRITICAL RULES:
1. Use ONLY the supplied clinical context. Do NOT invent facts, diagnoses, lab
   values, medications, dates, or causal explanations.
2. If information is absent from the context, explicitly state "Not documented
   in the available record."
3. Distinguish DOCUMENTED facts (with evidence references) from INFERRED or
   UNKNOWN information.
4. Preserve evidence references [E1], [E2], etc. when citing facts.
5. Do NOT provide treatment recommendations, diagnoses, or clinical advice.
6. Do NOT hallucinate. If uncertain, say so.
7. Be concise and clinically precise.
```

---

## Planned Extension: IBM Bob MCP Integration

The Model Context Protocol (MCP) provides a standardised way for IBM Bob IDE
to invoke MedBrief AI tools directly from the assistant interface. The
integration design below has not been deployed but represents the intended
extension path.

### Intended MCP Tools

If implemented, the MedBrief AI MCP server would expose:

| Tool | Description |
|------|-------------|
| `get_handover_items` | Returns outstanding Handover Guard items for a patient ID |
| `get_patient_brief` | Generates a clinical brief (ward_round/referral/discharge) |
| `search_patient_record` | Searches the patient record and returns evidence chunks |
| `get_medication_reconciliation` | Returns medication reconciliation categories |

### Intended Setup (MCP)

If built, the MCP server would be a separate Express/HTTP endpoint or stdio
process registered in Bob IDE's MCP configuration:

```json
{
  "mcpServers": {
    "medbrief": {
      "transport": "http",
      "url": "http://localhost:5001/mcp",
      "description": "MedBrief AI clinical tools"
    }
  }
}
```

### Blocker

The Bob IDE MCP integration cannot be completed in this submission because:
1. The Bob IDE MCP client requires a running Bob IDE instance with MCP enabled
2. There is no available test environment with Bob IDE connected to the
   MedBrief backend
3. The MCP server scaffold would require additional testing to verify tool
   invocation and response handling in the Bob IDE context

### Honest Assessment

The claim that IBM Bob is integrated into MedBrief AI applies only to the
**IBM watsonx.ai REST integration**. The IBM Bob IDE MCP integration is
a planned extension that is not yet implemented or verified.

---

## Verification

### Verify watsonx.ai Integration

```bash
# Start server with watsonx credentials set
cd src
npm run dev:server

# Test the ask-ai endpoint (requires a patient ID from a prior upload)
curl -X POST http://localhost:5000/api/patients/PATIENT_ID/ask-ai \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"question": "What medications is the patient currently taking?"}'

# Expected response shape:
# {
#   "answer": { "answer": "...", "hits": [...], "provenance": "DOCUMENTED" },
#   "ai": { "text": "...", "model": "ibm/granite-13b-chat-v2",
#            "provider": "watsonx", "fallback": false }
# }
```

### Without watsonx.ai Credentials

```bash
# With AI_PROVIDER=mock (default), the response will include:
# "ai": { "provider": "mock", "fallback": true }
# The deterministic answer is returned normally.
```