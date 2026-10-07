import { describe, it, expect, beforeAll } from 'vitest';
import { DEMO_PATIENTS, DEMO_DISCLAIMER } from '../shared/demo/records.js';
import { analyseDocuments } from '../shared/clinical/pipeline.js';
import type { RawDocument } from '../shared/clinical/types.js';

function demoToRaw(patientId: string): RawDocument[] {
  const patient = DEMO_PATIENTS.find(p => p.id === patientId);
  if (!patient) throw new Error('unknown demo patient');
  return patient.documents.map((d, i) => ({
    id: `${patient.id}_doc_${i}`,
    name: d.name,
    kind: d.kind,
    text: d.text,
    pages: d.pages,
  }));
}

describe('demo mode', () => {
  it('contains at least three synthetic patients', () => {
    expect(DEMO_PATIENTS.length).toBeGreaterThanOrEqual(3);
  });

  it('labels all demo data as synthetic', () => {
    expect(DEMO_DISCLAIMER).toContain('SYNTHETIC DEMO DATA');
    expect(DEMO_DISCLAIMER).toContain('NOT FOR CLINICAL USE');
  });

  it('each demo patient has multiple documents', () => {
    for (const p of DEMO_PATIENTS) {
      expect(p.documents.length).toBeGreaterThanOrEqual(2);
    }
  });

  describe('Arjun Mehta (acceptance record)', () => {
    let result: ReturnType<typeof analyseDocuments>;

    beforeAll(() => {
      result = analyseDocuments(demoToRaw('demo-patient-1'));
    });

    it('extracts hypertension and hyperlipidaemia', () => {
      const text = [
        ...result.analysis.events.map(e => e.description),
        ...result.analysis.findings.map(f => f.finding),
      ].join(' ').toLowerCase();
      expect(text).toContain('hypertension');
      expect(text).toContain('hyperlipidaemia');
    });

    it('extracts amlodipine 5 mg', () => {
      const amlo = result.analysis.medications.find(m => m.name.toLowerCase() === 'amlodipine');
      expect(amlo).toBeDefined();
      expect(amlo!.dose).toBe('5 mg');
    });

    it('extracts atorvastatin 20 mg then 40 mg', () => {
      const ator = result.analysis.medications.filter(m => m.name.toLowerCase() === 'atorvastatin');
      expect(ator.length).toBeGreaterThanOrEqual(2);
      const doses = ator.map(m => m.dose);
      expect(doses).toContain('20 mg');
      expect(doses).toContain('40 mg');
    });

    it('detects the atorvastatin dose increase', () => {
      const change = result.analysis.medicationChanges.find(
        c => c.medicationName.toLowerCase() === 'atorvastatin' && c.kind === 'DOSE_INCREASED'
      );
      expect(change).toBeDefined();
      expect(change!.previousDose).toBe('20 mg');
      expect(change!.newDose).toBe('40 mg');
    });

    it('extracts the completed echocardiogram with LVEF 55%', () => {
      const echo = result.analysis.investigations.find(i => i.name === 'Echocardiogram');
      expect(echo).toBeDefined();
      expect(echo!.status).toBe('RESULT_AVAILABLE');
      expect(echo!.result).toContain('55%');
    });

    it('detects the pulmonary function test as ordered but not completed', () => {
      const pft = result.analysis.investigations.find(i => i.name === 'Pulmonary function test');
      expect(pft).toBeDefined();
      expect(['ORDERED', 'PENDING']).toContain(pft!.status);
    });

    it('creates an open care loop for the PFT', () => {
      const loop = result.analysis.careLoops.find(l => l.name === 'Pulmonary function test');
      expect(loop).toBeDefined();
      expect(loop!.status).toBe('OPEN');
    });

    it('detects changing symptoms (breathlessness)', () => {
      const text = result.analysis.events.map(e => e.description).join(' ').toLowerCase();
      expect(text).toContain('breathlessness');
    });

    it('derives the record period 12 Jan - 18 Mar 2026', () => {
      expect(result.analysis.patient.recordStart).toBe('2026-01-12');
      expect(result.analysis.patient.recordEnd).toBe('2026-03-18');
    });

    it('surfaces attention items', () => {
      expect(result.analysis.attention.length).toBeGreaterThan(0);
    });

    it('builds a verification list', () => {
      expect(result.analysis.verifyNext.length).toBeGreaterThan(0);
    });
  });

  describe('Sarah Chen', () => {
    let result: ReturnType<typeof analyseDocuments>;

    beforeAll(() => {
      result = analyseDocuments(demoToRaw('demo-patient-2'));
    });

    it('extracts type 2 diabetes and CKD', () => {
      const text = [
        ...result.analysis.events.map(e => e.description),
        ...result.analysis.findings.map(f => f.finding),
      ].join(' ').toLowerCase();
      expect(text).toContain('diabetes');
      expect(text).toContain('chronic kidney disease');
    });

    it('extracts metformin', () => {
      const met = result.analysis.medications.find(m => m.name.toLowerCase() === 'metformin');
      expect(met).toBeDefined();
      expect(met!.dose).toBe('1000 mg');
    });

    it('extracts HbA1c lab results', () => {
      const hba1c = result.analysis.labs.filter(l => l.test === 'HbA1c');
      expect(hba1c.length).toBeGreaterThan(0);
    });

    it('detects the renal ultrasound as an open loop', () => {
      const loop = result.analysis.careLoops.find(l => l.name === 'Renal ultrasound');
      expect(loop).toBeDefined();
      expect(loop!.status).toBe('OPEN');
    });

    it('detects the allergy conflict', () => {
      const conflict = result.analysis.conflicts.find(c => c.field === 'Allergy status');
      expect(conflict).toBeDefined();
    });

    it('detects the cardiology referral', () => {
      const ref = result.analysis.referrals.find(r => r.specialty === 'Cardiology');
      expect(ref).toBeDefined();
    });
  });

  describe('Michael Okonkwo', () => {
    let result: ReturnType<typeof analyseDocuments>;

    beforeAll(() => {
      result = analyseDocuments(demoToRaw('demo-patient-3'));
    });

    it('extracts COPD exacerbation', () => {
      const text = [
        ...result.analysis.events.map(e => e.description),
        ...result.analysis.findings.map(f => f.finding),
      ].join(' ').toLowerCase();
      expect(text).toContain('chronic obstructive pulmonary disease');
    });

    it('extracts prednisolone and amoxicillin as completed courses', () => {
      const pred = result.analysis.medications.find(m => m.name.toLowerCase() === 'prednisolone');
      expect(pred).toBeDefined();
      expect(pred!.status).toBe('COMPLETED');
      const amox = result.analysis.medications.find(m => m.name.toLowerCase() === 'amoxicillin');
      expect(amox).toBeDefined();
      expect(amox!.status).toBe('COMPLETED');
    });

    it('detects spirometry with no results', () => {
      // "Spirometry" is canonicalised to the same care loop as the
      // pulmonary function test, so the loop is tracked under one name.
      const loop = result.analysis.careLoops.find(l => l.name === 'Pulmonary function test');
      expect(loop).toBeDefined();
      expect(['OPEN', 'PARTIAL']).toContain(loop!.status);
    });

    it('detects the smoking status conflict', () => {
      const conflict = result.analysis.conflicts.find(c => c.field === 'Smoking status');
      expect(conflict).toBeDefined();
    });

    it('detects the home oxygen assessment as outstanding', () => {
      const text = result.analysis.careLoops.map(l => l.name).join(' ').toLowerCase();
      expect(text).toContain('oxygen');
    });
  });
});