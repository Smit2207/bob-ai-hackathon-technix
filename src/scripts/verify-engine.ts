/**
 * Engine verification harness.
 * Runs the real pipeline over the demo records and over arbitrary unseen
 * records, then prints what was actually extracted.
 *
 * Run: npx tsx scripts/verify-engine.ts
 */

import { analyseDocuments, RawDocument } from '../shared/clinical/pipeline.js';
import { DEMO_PATIENTS } from '../shared/demo/records.js';
import { searchPatient, answerFromRecord } from '../shared/clinical/retrieval.js';
import { buildBrief } from '../shared/clinical/briefs.js';
import { formatDate } from '../shared/clinical/text.js';

function hr(title: string) {
  console.log('\n' + '='.repeat(78));
  console.log(title);
  console.log('='.repeat(78));
}

for (const dp of DEMO_PATIENTS) {
  const docs: RawDocument[] = dp.documents.map((d, i) => ({
    id: `${dp.id}-doc-${i}`,
    name: d.name,
    kind: d.kind,
    text: d.text,
    pages: d.pages,
  }));
  const { analysis, chunks } = analyseDocuments(docs);

  hr(`DEMO: ${dp.displayName}`);
  console.log(`Extracted name      : ${analysis.patient.name}`);
  console.log(`Patient ID          : ${analysis.patient.patientId}`);
  console.log(`Age / Sex           : ${analysis.patient.age} / ${analysis.patient.sex}`);
  console.log(`Record period       : ${analysis.patient.recordStart} -> ${analysis.patient.recordEnd}`);
  console.log(`Documents / chunks  : ${analysis.documents.length} / ${chunks.length}`);
  console.log(`Medications         : ${analysis.medications.length} -> ${Array.from(new Set(analysis.medications.map((m) => `${m.name} ${m.dose}`))).join(', ')}`);
  console.log(`Medication changes  : ${analysis.medicationChanges.map((c) => `${c.medicationName} ${c.kind} ${c.previousDose ?? '-'}->${c.newDose ?? '-'}`).join(' | ') || 'none'}`);
  console.log(`Investigations      : ${Array.from(new Set(analysis.investigations.map((i) => `${i.name}[${i.status}]`))).join(', ') || 'none'}`);
  console.log(`Results w/ values    : ${analysis.investigations.filter((i) => i.result).map((i) => `${i.name}=${i.result}`).join(' | ') || 'none'}`);
  console.log(`Labs                : ${analysis.labs.length} (${Array.from(new Set(analysis.labs.map((l) => l.test))).slice(0, 10).join(', ')})`);
  console.log(`Vitals              : ${Array.from(new Set(analysis.vitals.map((v) => `${v.type} ${v.value}`))).join(', ') || 'none'}`);
  console.log(`Referrals           : ${analysis.referrals.map((r) => `${r.specialty}${r.outcome ? ' (outcome)' : ' (no outcome)'}`).join(', ') || 'none'}`);
  console.log(`Events              : ${analysis.events.length}`);
  console.log(`Findings            : ${analysis.findings.length}`);
  console.log(`\nCareLoops:`);
  for (const l of analysis.careLoops) {
    console.log(`  [${l.status.padEnd(8)}] ${l.name}  (ordered ${l.orderedDate ?? 'n/d'}, last mention ${l.lastMention ?? 'n/d'})`);
    if (l.status !== 'RESOLVED') {
      for (const s of l.stages.filter((x) => !x.documented)) console.log(`       missing: ${s.note}`);
    }
  }
  console.log(`\nDocumentation conflicts:`);
  for (const c of analysis.conflicts) {
    console.log(`  ${c.field} / ${c.entity}: ${c.entries.map((e) => `${e.value}${e.date ? ` @${e.date}` : ''}`).join('  VS  ')}`);
  }
  console.log(`\nAttention (${analysis.attention.length}):`);
  for (const a of analysis.attention.slice(0, 12)) console.log(`  - ${a.kind}: ${a.title}`);
  console.log(`\nVerify list:`);
  for (const v of analysis.verifyNext.slice(0, 8)) console.log(`  - ${v}`);

  const brief = buildBrief(analysis, 'ward', null, chunks);
  console.log(`\nWard brief: ${brief.sections.length} sections, ${brief.evidenceIndex.length} evidence refs, ${brief.plainText.length} chars`);
  console.log(`  evidence sample: ${brief.evidenceIndex[0]?.documentName ?? 'none'} p${brief.evidenceIndex[0]?.page ?? '-'}`);
}

/* ---------------- Acceptance test: unseen record ---------------- */
hr('ACCEPTANCE: unseen synthetic record (not a demo patient)');

const unseen: RawDocument = {
  id: 'unseen-1',
  name: 'Ward_Note_Unseen.txt',
  kind: 'txt',
  text: `ST BARTHOLOMEW'S HOSPITAL
WARD ROUND NOTE

Patient Name: Fatima Okonjo
Patient ID: SB-990213
Age: 51
Sex: Female
Date of Birth: 02/02/1975

Date: 06 Apr 2026
Ward: 12, Cardiology

HISTORY OF PRESENTING PROBLEM
Presented with central chest pain radiating to the left arm, started abruptly
while walking uphill, lasting ninety minutes. Associated diaphoresis and
nausea. The pain settled after sublingual Glyceryl trinitrate was administered
in the emergency department. No recurrence since admission.

ECG on arrival demonstrated ST segment changes in leads II, III and aVF.
Troponin I was 480 ng/L (reference <26 ng/L) at three hours, falling to 210 ng/L
on the following morning.

PRIOR HISTORY
Hypertension diagnosed 2016. Hyperlipidaemia. Rheumatoid arthritis.
Smoker of 30 cigarettes a day for 25 years. Currently works as a secondary
school teacher.

MEDICATIONS
Aspirin 300 mg once daily
Atorvastatin 80 mg nightly
Bisoprolol 2.5 mg once daily
Ramipril 10 mg once daily
Gliclazide 80 mg twice daily
Hydroxychloroquine 200 mg twice daily
Glyceryl trinitrate 5 mg sublingually as needed

MANAGEMENT
Coronary angiography has been ordered for this admission.
Cardiac catheterisation is planned. Troponin has continued to fall.
Capillary glucose was 14.2 mmol/L on admission, has settled to 7.8 mmol/L.
Chest X-ray on 06 Apr 2026 shows no consolidation.
SpO2 98% on air, BP 132/78 mmHg, HR 68 bpm regular, Temperature 36.6 C.

ASSESSMENT
Type 2 myocardial infarction, inferior territory. Hypertension. Diabetes
mellitus type 2. Rheumatoid arthritis. Current smoker.

PLAN
Cardiology to review for angiography. Medical regimen commenced as above.
Endocrinology review requested for the diabetes and HbA1c of 71 mmol/mol.
Chest X-ray reported as normal - no acute pulmonary abnormality.
Coronary angiography booked for 20 Apr 2026.
Smoking cessation referral offered and accepted.`,
};

const unseenResult = analyseDocuments([unseen]);
const ua = unseenResult.analysis;
console.log(`name        : ${ua.patient.name}`);
console.log(`id          : ${ua.patient.patientId}`);
console.log(`age / sex   : ${ua.patient.age} / ${ua.patient.sex}`);
console.log(`record      : ${ua.patient.recordStart} -> ${ua.patient.recordEnd}`);
console.log(`meds        : ${Array.from(new Set(ua.medications.map((m) => `${m.name} ${m.dose}`))).join(', ')}`);
console.log(`labs        : ${ua.labs.filter((l) => l.test === 'Troponin').map((l) => `${l.test}=${l.value}${l.unit ? ' ' + l.unit : ''}`).join(', ')}`);
console.log(`invs        : ${Array.from(new Set(ua.investigations.map((i) => `${i.name}[${i.status}]`))).join(', ')}`);
console.log(`open loops  : ${ua.careLoops.filter((l) => l.status === 'OPEN').map((l) => l.name).join(', ') || 'none'}`);
console.log(`resolved    : ${ua.careLoops.filter((l) => l.status === 'RESOLVED').map((l) => l.name).join(', ') || 'none'}`);
console.log(`conflicts   : ${ua.conflicts.map((c) => `${c.entity}/${c.field}`).join(', ') || 'none'}`);

if (process.env.CARELOOP_DEBUG) {
  console.log('--- care loop detail ---');
  for (const l of ua.careLoops) {
    console.log(`[${l.status}] ${l.name}`);
    console.log(`   desc    : ${l.description}`);
    console.log(`   evidence: ${l.evidence.map((e) => `${e.documentName} p${e.page} :: ${e.text}`).join(' || ')}`);
  }
}

console.log('\n--- ACCEPTANCE TEST 3: ask for absent information ---');
const absent = answerFromRecord(ua, unseenResult.chunks, "What is the patient's blood group?");
console.log(`provenance: ${absent.provenance}`);
console.log(absent.answer);

console.log('\n--- Same question against demo patient 1 (also absent) ---');
const d1 = analyseDocuments(
  DEMO_PATIENTS[0].documents.map((d, i) => ({ id: `d1-${i}`, name: d.name, kind: d.kind, text: d.text }))
);
const absent2 = answerFromRecord(d1.analysis, d1.chunks, "What is the patient's blood group?");
console.log(`provenance: ${absent2.provenance}`);
console.log(absent2.answer);

console.log('\n--- Grounded answer that IS present ---');
const present = answerFromRecord(ua, unseenResult.chunks, 'What was the troponin result?');
console.log(`provenance: ${present.provenance}`);
console.log(present.answer);

console.log('\n--- Retrieval: no match returns no-match ---');
const nm = searchPatient(ua, unseenResult.chunks, 'zebra spacecraft');
console.log(`noMatch=${nm.noMatch} hits=${nm.hits.length}`);
console.log(nm.message);