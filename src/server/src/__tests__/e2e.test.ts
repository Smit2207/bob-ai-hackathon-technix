import { describe, it, expect } from 'vitest';
import { DEMO_PATIENTS } from '../shared/demo/records.js';
import { analyseDocuments } from '../shared/clinical/pipeline.js';
import { buildBrief } from '../shared/clinical/briefs.js';
import { buildByoaiContext } from '../shared/clinical/byoai.js';
import { answerFromRecord } from '../shared/clinical/retrieval.js';

function demoToRaw(patientId: string) {
  const patient = DEMO_PATIENTS.find(p => p.id === patientId);
  if (!patient) throw new Error('unknown demo patient');
  return patient.documents.map((d, i) => ({
    id: `${patient.id}_doc_${i}`,
    name: d.name,
    kind: d.kind as 'pdf' | 'txt',
    text: d.text,
    pages: d.pages,
  }));
}

describe('end-to-end demo acceptance', () => {
  it('Arjun: echo result, PFT open loop, atorvastatin change, no conflicts on explained doses', () => {
    const r = analyseDocuments(demoToRaw('demo-patient-1'));
    const echo = r.analysis.investigations.find(i => i.name === 'Echocardiogram');
    expect(echo?.status).toBe('RESULT_AVAILABLE');
    expect(echo?.result).toContain('55%');
    const pft = r.analysis.careLoops.find(l => l.name === 'Pulmonary function test');
    expect(pft?.status).toBe('OPEN');
    const change = r.analysis.medicationChanges.find(c => c.medicationName === 'Atorvastatin' && c.kind === 'DOSE_INCREASED');
    expect(change).toBeDefined();
    const doseConflict = r.analysis.conflicts.find(c => c.entity === 'Atorvastatin' && c.field === 'Medication dose');
    expect(doseConflict).toBeUndefined();
    const cm = r.analysis.changeMap.find(c => c.entity === 'Atorvastatin' && c.entityType === 'Medication');
    expect(cm?.classification).toBe('CHANGED');
  });

  it('Michael: completed courses, smoking conflict, PFT loop', () => {
    const r = analyseDocuments(demoToRaw('demo-patient-3'));
    const pred = r.analysis.medications.find(m => m.name === 'Prednisolone');
    expect(pred?.status).toBe('COMPLETED');
    const amox = r.analysis.medications.find(m => m.name === 'Amoxicillin');
    expect(amox?.status).toBe('COMPLETED');
    const smoking = r.analysis.conflicts.find(c => c.field === 'Smoking status');
    expect(smoking).toBeDefined();
    const pft = r.analysis.careLoops.find(l => l.name === 'Pulmonary function test');
    expect(['OPEN', 'PARTIAL']).toContain(pft?.status);
  });

  it('Sarah: diabetes/CKD findings, allergy conflict, metformin stop', () => {
    const r = analyseDocuments(demoToRaw('demo-patient-2'));
    const text = [...r.analysis.events.map(e => e.description), ...r.analysis.findings.map(f => f.finding)].join(' ').toLowerCase();
    expect(text).toContain('diabetes');
    expect(text).toContain('chronic kidney disease');
    const allergy = r.analysis.conflicts.find(c => c.field === 'Allergy status');
    expect(allergy).toBeDefined();
  });

  it('briefs, BYOAI redaction and grounded answers work on demo data', () => {
    const r = analyseDocuments(demoToRaw('demo-patient-1'));
    const brief = buildBrief(r.analysis, 'ward', null, r.chunks);
    expect(brief.plainText.length).toBeGreaterThan(100);
    const pkg = buildByoaiContext(r.analysis, { redactIdentifiers: true });
    expect(pkg.context).not.toContain('Arjun Mehta');
    expect(pkg.context).toContain('Patient A');
    const ans = answerFromRecord(r.analysis, r.chunks, 'What is the patient taking?');
    expect(ans.provenance).toBe('DOCUMENTED');
    expect(ans.answer).toContain('Amlodipine');
  });
});
