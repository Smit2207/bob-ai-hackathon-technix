# Problem Statement â€” P3: Medical Report Summarisation Assistant

## The Problem

Clinicians preparing ward-round notes, specialist referrals, and discharge
documentation must review large volumes of clinical records spanning multiple
departments, specialties, and time periods. A typical patient may have:

- GP consultation letters
- Cardiology and radiology reports
- Emergency department notes
- Nursing assessments
- Lab result printouts
- Medication reconciliation forms

These documents arrive in different formats, at different times, and are often
stored in separate systems. There is no guaranteed mechanism for important
clinical findings to be surfaced during handover.

## The Clinical Safety Gap

Research consistently identifies handover failures as a leading cause of
preventable adverse events in hospital settings. Specific risks include:

- **Missing outstanding investigations** â€” test ordered but result not followed up
- **Lost referrals** â€” specialist referral made but outcome not tracked
- **Medication discrepancies** â€” dose changed in one document, old dose referenced in another
- **Unresolved follow-ups** â€” planned review not completed or documented
- **Documentation conflicts** â€” contradictory findings across documents not reconciled

Preparing a safe, complete handover brief currently requires the clinician to:
1. Locate and read all relevant documents manually
2. Identify changes and outstanding items by memory
3. Cross-reference findings across documents for contradictions
4. Compile a structured brief from unstructured source material

This process is time-consuming, error-prone, and scales poorly with patient
complexity or department workload.

## Who Experiences This Problem

- **Ward clinicians** preparing morning ward-round notes for multiple patients
- **Registrars and house officers** taking over care at shift handover
- **Specialist teams** receiving referrals without full clinical context
- **Discharge coordinators** ensuring all outstanding items are documented before transfer

## Why Existing Tools Fall Short

- EMR/EPR systems display individual documents but do not aggregate structured
  clinical items across documents
- Existing summarisation tools (where available) produce free-text summaries
  without evidence traceability
- No widely available tool provides structured handover review tracking with
  three-state workflow (Incomplete / Ready / Reviewed) and source evidence

## What Good Looks Like

A solution that effectively addresses this problem would:
1. Extract structured clinical entities from uploaded documents automatically
2. Build a longitudinal view of the patient's clinical course
3. Detect outstanding items, changes, and conflicts across documents
4. Generate evidence-linked briefs for ward round, referral, and discharge
5. Provide a structured review workspace where each outstanding item can be
   explicitly marked as reviewed with accountability fields
6. Work without requiring integration into existing hospital IT systems

MedBrief AI is built to meet these requirements.