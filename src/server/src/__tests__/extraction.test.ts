import { describe, it, expect, beforeEach } from 'vitest';
import { extractClinicalRecord, resetIdCounter } from '../shared/clinical/extract.js';
import { cleanText, findDates, formatDate, sentences, units } from '../shared/clinical/text.js';

describe('text utilities', () => {
  it('cleans PDF artefacts and collapses whitespace', () => {
    const raw = 'Line\u00ad one\u00a0  two\u2013three\u2014four\n\n\n\nfive';
    const cleaned = cleanText(raw);
    expect(cleaned).not.toContain('\u00ad');
    expect(cleaned).not.toContain('\u00a0');
    expect(cleaned).toContain('five');
    expect(cleaned).not.toMatch(/\n{3,}/);
  });

  it('parses day-first UK dates', () => {
    const hits = findDates('Seen on 12 Jan 2026 and 03/02/2026');
    const isos = hits.map(h => h.iso);
    expect(isos).toContain('2026-01-12');
    expect(isos).toContain('2026-02-03');
  });

  it('parses ISO dates', () => {
    const hits = findDates('Admitted 2026-01-20');
    expect(hits.map(h => h.iso)).toContain('2026-01-20');
  });

  it('formats ISO dates to a readable form', () => {
    expect(formatDate('2026-01-12')).toBe('12 Jan 2026');
    expect(formatDate(null)).toBe('Not documented');
  });

  it('splits sentences without breaking on decimals', () => {
    const sents = sentences('The dose was 5.0 mg. It was increased.');
    expect(sents.length).toBe(2);
    expect(sents[0].text).toContain('5.0 mg');
  });

  it('joins line-wrapped clinical prose into units', () => {
    const text = 'INVESTIGATIONS PERFORMED TODAY\nLung function testing has been\nrequested as a formal test.';
    const us = units(text);
    const joined = us.find(u => u.text.includes('Lung function'));
    expect(joined).toBeDefined();
    expect(joined!.text).toContain('requested');
  });
});

describe('clinical extraction', () => {
  const baseDoc = {
    documentId: 'doc1',
    documentName: 'GP_Note.txt',
    page: 1,
    text: `PATIENT CONSULTATION
Patient Name: Test Patient
Patient ID: TP-001
Age: 50
Sex: Male
Date: 12 Jan 2026

HISTORY: Hypertension diagnosed 2019.

MEDICATIONS:
Amlodipine 5 mg once daily.
Atorvastatin 20 mg nightly.

EXAMINATION:
BP 152/88 mmHg, HR 76 bpm, SpO2 97%.

PLAN:
Continue current medication.
Follow-up in 6 weeks.`,
  };

  beforeEach(() => resetIdCounter());

  it('extracts patient demographics from content', () => {
    const result = extractClinicalRecord([baseDoc]);
    expect(result.patient.name).toBe('Test Patient');
    expect(result.patient.patientId).toBe('TP-001');
    expect(result.patient.age).toBe(50);
    expect(result.patient.sex).toBe('Male');
  });

  it('extracts medications with dose and frequency', () => {
    const result = extractClinicalRecord([baseDoc]);
    const names = result.medications.map(m => m.name.toLowerCase());
    expect(names).toContain('amlodipine');
    expect(names).toContain('atorvastatin');
    const amlo = result.medications.find(m => m.name.toLowerCase() === 'amlodipine');
    expect(amlo?.dose).toBe('5 mg');
    expect(amlo?.frequency).toBe('Once daily');
  });

  it('extracts vitals', () => {
    const result = extractClinicalRecord([baseDoc]);
    const bp = result.vitals.find(v => v.type === 'Blood pressure');
    expect(bp?.value).toBe('152/88');
    const hr = result.vitals.find(v => v.type === 'Pulse');
    expect(hr?.value).toBe('76');
  });

  it('extracts a follow-up', () => {
    const result = extractClinicalRecord([baseDoc]);
    expect(result.followUps.length).toBeGreaterThan(0);
  });

  it('extracts a hypertension diagnosis event', () => {
    const result = extractClinicalRecord([baseDoc]);
    const dx = result.events.find(e => e.type === 'Diagnosis');
    expect(dx).toBeDefined();
    expect(dx!.description.toLowerCase()).toContain('hypertension');
  });

  it('retains evidence with document, page and source text', () => {
    const result = extractClinicalRecord([baseDoc]);
    for (const m of result.medications) {
      expect(m.evidence.documentName).toBe('GP_Note.txt');
      expect(m.evidence.page).toBe(1);
      expect(m.evidence.text.length).toBeGreaterThan(0);
    }
  });

  it('does not treat negated mentions as facts', () => {
    const doc = {
      ...baseDoc,
      text: `Patient Name: Test Patient\nDate: 12 Jan 2026\n\nNo CT scan was performed. The patient denies chest pain. No echocardiogram was completed.`,
    };
    const result = extractClinicalRecord([doc]);
    const ct = result.investigations.find(i => i.name === 'CT scan');
    expect(ct).toBeUndefined();
    const echo = result.investigations.find(i => i.name === 'Echocardiogram');
    expect(echo).toBeUndefined();
  });

  it('detects an ordered-but-not-completed investigation', () => {
    const doc = {
      ...baseDoc,
      text: `Patient Name: Test Patient\nDate: 12 Jan 2026\n\nPulmonary function test ordered today. Spirometry to be arranged.`,
    };
    const result = extractClinicalRecord([doc]);
    const pft = result.investigations.find(i => i.name === 'Pulmonary function test');
    expect(pft).toBeDefined();
    expect(pft!.status).toBe('ORDERED');
  });

  it('detects a completed investigation with a result', () => {
    const doc = {
      ...baseDoc,
      text: `ECHOCARDIOGRAM REPORT\nPatient Name: Test Patient\nDate of Examination: 23 Jan 2026\n\nFINDINGS\nThe study is technically adequate. LVEF 55% by biplane Simpson's method.\n\nIMPRESSION\nNormal left ventricular systolic function with preserved ejection fraction (LVEF 55%).`,
    };
    const result = extractClinicalRecord([doc]);
    const echo = result.investigations.find(i => i.name === 'Echocardiogram');
    expect(echo).toBeDefined();
    expect(echo!.status).toBe('RESULT_AVAILABLE');
    expect(echo!.result).toContain('55%');
  });

  it('extracts laboratory results with units and reference ranges', () => {
    const doc = {
      ...baseDoc,
      text: `Patient Name: Test Patient\nDate: 03 Feb 2026\n\nBLOOD RESULTS\nHbA1c: 62 mmol/mol (reference 20-42)\nCreatinine: 132 umol/L (reference 60-110)`,
    };
    const result = extractClinicalRecord([doc]);
    const hba1c = result.labs.find(l => l.test === 'HbA1c');
    expect(hba1c?.value).toBe('62');
    expect(hba1c?.unit).toBe('mmol/mol');
    expect(hba1c?.referenceRange).toBe('20-42');
    const cr = result.labs.find(l => l.test === 'Creatinine');
    expect(cr?.value).toBe('132');
  });

  it('extracts referrals with specialty', () => {
    const doc = {
      ...baseDoc,
      text: `Patient Name: Test Patient\nDate: 12 Jan 2026\n\nRefer to Cardiology for assessment of breathlessness.`,
    };
    const result = extractClinicalRecord([doc]);
    const ref = result.referrals.find(r => r.specialty === 'Cardiology');
    expect(ref).toBeDefined();
    expect(ref!.reason).toContain('breathlessness');
  });

  it('warns when the text does not look like a clinical record', () => {
    const doc = { ...baseDoc, text: 'The quick brown fox jumps over the lazy dog.' };
    const result = extractClinicalRecord([doc]);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.isClinicalRecord).toBe(false);
  });
});

describe('content-driven behaviour', () => {
  beforeEach(() => resetIdCounter());

  it('produces different results for different content', () => {
    const docA = {
      documentId: 'a', documentName: 'A.txt', page: 1,
      text: `Patient Name: Alpha One\nDate: 12 Jan 2026\n\nAmlodipine 5 mg once daily.`,
    };
    const docB = {
      documentId: 'b', documentName: 'B.txt', page: 1,
      text: `Patient Name: Beta Two\nDate: 15 Mar 2026\n\nMetformin 1000 mg twice daily. HbA1c: 64 mmol/mol.`,
    };
    const a = extractClinicalRecord([docA]);
    const b = extractClinicalRecord([docB]);
    expect(a.patient.name).toBe('Alpha One');
    expect(b.patient.name).toBe('Beta Two');
    expect(a.medications[0]?.name).toBe('Amlodipine');
    expect(b.medications[0]?.name).toBe('Metformin');
    expect(b.labs.length).toBeGreaterThan(0);
    expect(a.labs.length).toBe(0);
  });

  it('does not branch on filename or patient name', () => {
    // Same clinical content under different filenames and names yields the same extraction
    const content = (name: string) => `Patient Name: ${name}\nDate: 12 Jan 2026\n\nAtorvastatin 20 mg nightly.`;
    const docA = { documentId: 'x', documentName: 'TotallyDifferentFile.pdf', page: 1, text: content('Zed Zed') };
    const docB = { documentId: 'y', documentName: 'AnotherFile.txt', page: 1, text: content('Qwerty Qwerty') };
    const a = extractClinicalRecord([docA]);
    const b = extractClinicalRecord([docB]);
    expect(a.medications[0]?.name).toBe(b.medications[0]?.name);
    expect(a.medications[0]?.dose).toBe(b.medications[0]?.dose);
  });
});