import { describe, it, expect, beforeEach } from 'vitest';
import { analyseDocuments } from '../shared/clinical/pipeline.js';
import { diffSnapshots } from '../shared/clinical/temporal.js';
import type { RawDocument } from '../shared/clinical/types.js';

const arjunDocs: RawDocument[] = [
  {
    id: 'd1', name: 'GP_Consultation_12Jan2026.txt', kind: 'txt',
    text: `GP CONSULTATION
Patient Name: Arjun Mehta
Patient ID: NF-448120
Age: 64
Sex: Male
Date of Consultation: 12 Jan 2026

HISTORY: Hypertension diagnosed 2019. Hyperlipidaemia since 2021.

EXAMINATION: BP 152/88 mmHg, HR 76 bpm.

IMPRESSION: Hypertension - poorly controlled. Hyperlipidaemia.

PLAN:
Continue Amlodipine 5 mg once daily.
Continue Atorvastatin 20 mg nightly.
Bloods requested today.
ECG requested today.
Consider echocardiogram if symptoms persist.
Smoking status: never smoker.
Allergies: no known allergies.
Follow-up in 6 weeks.`,
  },
  {
    id: 'd2', name: 'Echocardiogram_Report_23Jan2026.txt', kind: 'txt',
    text: `ECHOCARDIOGRAM REPORT
Patient Name: Arjun Mehta
Patient ID: NF-448120
Date of Examination: 23 Jan 2026

FINDINGS: The study is technically adequate. LVEF 55% by biplane Simpson's method.

IMPRESSION: Normal left ventricular systolic function with preserved ejection fraction (LVEF 55%).`,
  },
  {
    id: 'd3', name: 'Cardiology_Clinic_Letter_03Feb2026.txt', kind: 'txt',
    text: `OUTPATIENT CLINIC LETTER
Patient Name: Arjun Mehta
Patient ID: NF-448120
Clinic Date: 03 Feb 2026

INVESTIGATIONS PERFORMED TODAY:
Lung function testing has been requested as a formal test and was not completed on the day of clinic.

IMPRESSION:
1. Breathlessness on exertion of uncertain cause.
2. Hypertension remains above target.

PLAN:
1. Atorvastatin 40 mg nightly has been increased from the previous 20 mg dose.
2. Pulmonary function test to be arranged and completed.
3. Refer to Respiratory for spirometry.
4. Follow-up in Cardiology in 6 weeks.`,
  },
  {
    id: 'd4', name: 'Respiratory_Clinic_Note_18Mar2026.txt', kind: 'txt',
    text: `CLINIC NOTE
Patient Name: Arjun Mehta
Patient ID: NF-448120
Date of Clinic: 18 Mar 2026

IMPRESSION:
1. Exertional breathlessness of unclear cause. Pulmonary function test ordered 05 Mar 2026 does not appear to have been completed at this hospital.

PLAN:
1. Spirometry to be booked and completed with bronchodilator reversibility.
2. Continue current medication unchanged pending spirometry results.
3. Follow-up in 4 weeks with peak flow readings.`,
  },
];

describe('longitudinal pipeline (Arjun Mehta)', () => {
  let result: ReturnType<typeof analyseDocuments>;

  beforeEach(() => {
    result = analyseDocuments(arjunDocs);
  });

  it('extracts patient demographics', () => {
    expect(result.analysis.patient.name).toBe('Arjun Mehta');
    expect(result.analysis.patient.patientId).toBe('NF-448120');
    expect(result.analysis.patient.age).toBe(64);
    expect(result.analysis.patient.sex).toBe('Male');
  });

  it('derives the record period from content', () => {
    expect(result.analysis.patient.recordStart).toBe('2026-01-12');
    expect(result.analysis.patient.recordEnd).toBe('2026-03-18');
  });

  it('detects the atorvastatin dose change 20mg -> 40mg', () => {
    const change = result.analysis.medicationChanges.find(
      c => c.medicationName.toLowerCase() === 'atorvastatin' && (c.kind === 'DOSE_INCREASED' || c.kind === 'DOSE_DECREASED')
    );
    expect(change).toBeDefined();
    expect(change!.previousDose).toBe('20 mg');
    expect(change!.newDose).toBe('40 mg');
  });

  it('classifies the atorvastatin change as CHANGED in the ChangeMap', () => {
    const item = result.analysis.changeMap.find(
      c => c.entity.toLowerCase() === 'atorvastatin' && c.entityType === 'Medication'
    );
    expect(item).toBeDefined();
    expect(item!.classification).toBe('CHANGED');
  });

  it('detects the completed echocardiogram with LVEF 55%', () => {
    const echo = result.analysis.investigations.find(i => i.name === 'Echocardiogram');
    expect(echo).toBeDefined();
    expect(echo!.status).toBe('RESULT_AVAILABLE');
    expect(echo!.result).toContain('55%');
  });

  it('detects the pulmonary function test as an open care loop', () => {
    const pftLoop = result.analysis.careLoops.find(l => l.name === 'Pulmonary function test');
    expect(pftLoop).toBeDefined();
    expect(pftLoop!.status).toBe('OPEN');
    const missing = pftLoop!.stages.filter(s => !s.documented).map(s => s.stage);
    expect(missing.length).toBeGreaterThan(0);
  });

  it('uses careful language for the open loop', () => {
    const pftLoop = result.analysis.careLoops.find(l => l.name === 'Pulmonary function test');
    const completionStage = pftLoop!.stages.find(s => s.stage === 'Completed');
    expect(completionStage!.note).toContain('No completion report was found in the available record');
  });

  it('surfaces the open PFT loop in the attention engine', () => {
    const att = result.analysis.attention.find(a => a.kind === 'Open Care Loop' && a.title === 'Pulmonary function test');
    expect(att).toBeDefined();
    expect(att!.whySurfaced.length).toBeGreaterThan(0);
  });

  it('detects the respiratory referral', () => {
    const ref = result.analysis.referrals.find(r => r.specialty === 'Respiratory');
    expect(ref).toBeDefined();
  });

  it('creates a referral care loop', () => {
    const loop = result.analysis.careLoops.find(l => l.type === 'Referral' && l.name === 'Referral to Respiratory');
    expect(loop).toBeDefined();
  });

  it('retains evidence for the atorvastatin change', () => {
    const change = result.analysis.medicationChanges.find(
      c => c.medicationName.toLowerCase() === 'atorvastatin' && c.kind === 'DOSE_INCREASED'
    );
    expect(change).toBeDefined();
    expect(change!.evidence.length).toBeGreaterThan(0);
    for (const ev of change!.evidence) {
      expect(ev.documentName.length).toBeGreaterThan(0);
      expect(ev.page).toBeGreaterThan(0);
      expect(ev.text.length).toBeGreaterThan(0);
    }
  });

  it('builds a current state that mentions active medications', () => {
    const state = result.analysis.currentState.join(' ');
    expect(state).toContain('Amlodipine');
    expect(state).toContain('Atorvastatin');
  });

  it('builds a verification list', () => {
    expect(result.analysis.verifyNext.length).toBeGreaterThan(0);
  });

  it('produces a chronological longitudinal story', () => {
    expect(result.analysis.longitudinalStory.length).toBeGreaterThan(0);
    const dates = result.analysis.longitudinalStory.map(e => e.date).filter(Boolean) as string[];
    const sorted = [...dates].sort();
    expect(dates).toEqual(sorted);
  });
});

describe('documentation drift', () => {
  it('detects conflicting medication doses across documents', () => {
    const docs: RawDocument[] = [
      {
        id: 'a', name: 'A.txt', kind: 'txt',
        text: `Patient Name: Test Patient\nDate: 01 Jan 2026\n\nAtorvastatin 20 mg nightly.`,
      },
      {
        id: 'b', name: 'B.txt', kind: 'txt',
        text: `Patient Name: Test Patient\nDate: 01 Feb 2026\n\nAtorvastatin 40 mg nightly.`,
      },
    ];
    const result = analyseDocuments(docs);
    const conflict = result.analysis.conflicts.find(c => c.entity.toLowerCase() === 'atorvastatin');
    expect(conflict).toBeDefined();
    expect(conflict!.field).toBe('Medication dose');
    expect(conflict!.status).toBe('Requires review');
    expect(conflict!.entries.length).toBe(2);
  });

  it('detects allergy status conflict', () => {
    const docs: RawDocument[] = [
      {
        id: 'a', name: 'A.txt', kind: 'txt',
        text: `Patient Name: Test Patient\nDate: 01 Jan 2026\n\nAllergies: no known allergies.`,
      },
      {
        id: 'b', name: 'B.txt', kind: 'txt',
        text: `Patient Name: Test Patient\nDate: 01 Feb 2026\n\nAllergies: Penicillin — generalised rash in childhood.`,
      },
    ];
    const result = analyseDocuments(docs);
    const conflict = result.analysis.conflicts.find(c => c.field === 'Allergy status');
    expect(conflict).toBeDefined();
    expect(conflict!.entries.some(e => e.value.toLowerCase().includes('penicillin'))).toBe(true);
    expect(conflict!.entries.some(e => e.value.toLowerCase().includes('no known allergies'))).toBe(true);
  });

  it('detects smoking status drift', () => {
    const docs: RawDocument[] = [
      {
        id: 'a', name: 'A.txt', kind: 'txt',
        text: `Patient Name: Test Patient\nDate: 01 Jan 2026\n\nSmoking status: never smoker.`,
      },
      {
        id: 'b', name: 'B.txt', kind: 'txt',
        text: `Patient Name: Test Patient\nDate: 01 Feb 2026\n\nHe smokes 20 cigarettes per day, 45 pack-year history.`,
      },
    ];
    const result = analyseDocuments(docs);
    const conflict = result.analysis.conflicts.find(c => c.field === 'Smoking status');
    expect(conflict).toBeDefined();
  });
});

describe('since last review (delta)', () => {
  it('computes a delta between two snapshots', () => {
    const early = analyseDocuments([arjunDocs[0], arjunDocs[1]]);
    const late = analyseDocuments(arjunDocs);
    const delta = diffSnapshots(early.analysis, late.analysis);
    expect(delta.newEvents).toBeGreaterThan(0);
    expect(delta.medicationChanges).toBeGreaterThan(0);
  });
});