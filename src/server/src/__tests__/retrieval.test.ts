import { describe, it, expect, beforeEach } from 'vitest';
import { analyseDocuments } from '../shared/clinical/pipeline.js';
import { searchPatient, answerFromRecord } from '../shared/clinical/retrieval.js';
import { buildBrief } from '../shared/clinical/briefs.js';
import { buildByoaiContext, BYOAI_TARGETS } from '../shared/clinical/byoai.js';
import { compareRecords } from '../shared/clinical/compare.js';
import { computeAnalytics } from '../shared/clinical/analytics.js';
import type { RawDocument } from '../shared/clinical/types.js';

const docs: RawDocument[] = [
  {
    id: 'd1', name: 'GP_Note.txt', kind: 'txt',
    text: `GP CONSULTATION
Patient Name: Test Patient
Patient ID: TP-001
Age: 50
Sex: Male
Date: 12 Jan 2026

HISTORY: Hypertension diagnosed 2019.

MEDICATIONS:
Amlodipine 5 mg once daily.
Atorvastatin 20 mg nightly.

EXAMINATION: BP 152/88 mmHg, HR 76 bpm.

PLAN: Continue current medication. Follow-up in 6 weeks.`,
  },
  {
    id: 'd2', name: 'Echo_Report.txt', kind: 'txt',
    text: `ECHOCARDIOGRAM REPORT
Patient Name: Test Patient
Date of Examination: 23 Jan 2026

FINDINGS: LVEF 55% by biplane Simpson's method.

IMPRESSION: Normal left ventricular systolic function with preserved ejection fraction (LVEF 55%).`,
  },
];

describe('grounded retrieval', () => {
  let result: ReturnType<typeof analyseDocuments>;

  beforeEach(() => {
    result = analyseDocuments(docs);
  });

  it('finds a medication by name', () => {
    const r = searchPatient(result.analysis, result.chunks, 'amlodipine');
    expect(r.noMatch).toBe(false);
    expect(r.hits.length).toBeGreaterThan(0);
    expect(r.hits.some(h => h.kind === 'medication')).toBe(true);
  });

  it('finds an investigation result', () => {
    const r = searchPatient(result.analysis, result.chunks, 'echocardiogram');
    expect(r.noMatch).toBe(false);
    expect(r.hits.some(h => h.kind === 'investigation')).toBe(true);
  });

  it('finds source text chunks', () => {
    const r = searchPatient(result.analysis, result.chunks, 'hypertension');
    expect(r.noMatch).toBe(false);
    expect(r.hits.some(h => h.kind === 'chunk')).toBe(true);
  });

  it('returns an explicit no-match for absent information', () => {
    const r = searchPatient(result.analysis, result.chunks, 'blood group');
    expect(r.noMatch).toBe(true);
    expect(r.message).toContain("couldn't find");
  });

  it('answers a question from the record with DOCUMENTED provenance', () => {
    const r = answerFromRecord(result.analysis, result.chunks, 'What is the patient taking?');
    expect(r.provenance).toBe('DOCUMENTED');
    expect(r.answer).toContain('Amlodipine');
  });

  it('answers an absent question with UNKNOWN provenance', () => {
    const r = answerFromRecord(result.analysis, result.chunks, "What is the patient's blood group?");
    expect(r.provenance).toBe('UNKNOWN');
    expect(r.answer).toContain("couldn't find");
  });

  it('ranks phrase matches above token matches', () => {
    const phrase = searchPatient(result.analysis, result.chunks, 'left ventricular systolic function');
    const token = searchPatient(result.analysis, result.chunks, 'ventricular');
    expect(phrase.hits[0]?.score).toBeGreaterThanOrEqual(token.hits[0]?.score);
  });
});

describe('briefs', () => {
  let result: ReturnType<typeof analyseDocuments>;

  beforeEach(() => {
    result = analyseDocuments(docs);
  });

  it('builds a ward round brief with all sections', () => {
    const brief = buildBrief(result.analysis, 'ward', null, result.chunks);
    expect(brief.type).toBe('ward');
    const headings = brief.sections.map(s => s.heading);
    expect(headings).toContain('Patient overview');
    expect(headings).toContain('Current state');
    expect(headings).toContain('Current medications');
    expect(headings).toContain('Open care loops');
    expect(headings).toContain('Documentation conflicts');
    expect(headings).toContain('What the next clinician should verify');
  });

  it('builds a referral brief for a specialty', () => {
    const brief = buildBrief(result.analysis, 'referral', 'Cardiology', result.chunks);
    expect(brief.specialty).toBe('Cardiology');
    expect(brief.title).toContain('Cardiology');
  });

  it('builds a handoff brief', () => {
    const brief = buildBrief(result.analysis, 'handoff', null, result.chunks);
    expect(brief.type).toBe('handoff');
    const headings = brief.sections.map(s => s.heading);
    expect(headings).toContain('Admission context');
    expect(headings).toContain('Medication changes');
  });

  it('includes an evidence index', () => {
    const brief = buildBrief(result.analysis, 'ward', null, result.chunks);
    expect(brief.evidenceIndex.length).toBeGreaterThan(0);
    for (const e of brief.evidenceIndex) {
      expect(e.documentName.length).toBeGreaterThan(0);
      expect(e.text.length).toBeGreaterThan(0);
    }
  });

  it('includes a safety disclaimer', () => {
    const brief = buildBrief(result.analysis, 'ward', null, result.chunks);
    expect(brief.disclaimer).toContain('not a diagnostic or treatment system');
  });

  it('states when information is not documented', () => {
    const brief = buildBrief(result.analysis, 'ward', null, result.chunks);
    const text = brief.plainText;
    // No blood group is documented, so the brief must not invent one
    expect(text.toLowerCase()).not.toContain('blood group: a');
  });
});

describe('bring your own AI', () => {
  let result: ReturnType<typeof analyseDocuments>;

  beforeEach(() => {
    result = analyseDocuments(docs);
  });

  it('builds a context package with rules for the assistant', () => {
    const pkg = buildByoaiContext(result.analysis, { redactIdentifiers: true });
    expect(pkg.context).toContain('Use ONLY the facts in this context');
    expect(pkg.context).toContain('Do not recommend treatment');
  });

  it('redacts identifiers by default', () => {
    const pkg = buildByoaiContext(result.analysis, { redactIdentifiers: true });
    expect(pkg.context).not.toContain('Test Patient');
    expect(pkg.context).toContain('Patient A');
    expect(pkg.factsRedacted).toBe(true);
  });

  it('includes identifiers when requested', () => {
    const pkg = buildByoaiContext(result.analysis, { redactIdentifiers: false });
    expect(pkg.context).toContain('Test Patient');
    expect(pkg.factsRedacted).toBe(false);
  });

  it('includes open care loops and conflicts', () => {
    const pkg = buildByoaiContext(result.analysis, {});
    expect(pkg.context).toContain('OPEN CARE LOOPS');
    expect(pkg.context).toContain('DOCUMENTATION CONFLICTS');
  });

  it('provides an extensible provider registry', () => {
    expect(BYOAI_TARGETS.length).toBeGreaterThanOrEqual(3);
    const ids = BYOAI_TARGETS.map(t => t.id);
    expect(ids).toContain('chatgpt');
    expect(ids).toContain('claude');
    expect(ids).toContain('gemini');
  });

  it('warns that pasting sends data to the provider', () => {
    const pkg = buildByoaiContext(result.analysis, {});
    expect(pkg.warning).toContain('sends that data to that provider');
  });
});

describe('compare records', () => {
  it('reports only actual differences', () => {
    const early = analyseDocuments([docs[0]]);
    const late = analyseDocuments(docs);
    const { rows } = compareRecords(early.analysis, late.analysis);
    expect(rows.length).toBeGreaterThan(0);
    // The echocardiogram is new in the later record
    const echoRow = rows.find(r => r.subject === 'Echocardiogram');
    expect(echoRow).toBeDefined();
    expect(echoRow!.difference).toContain('added');
  });

  it('reports no differences for identical records', () => {
    const a = analyseDocuments([docs[0]]);
    const b = analyseDocuments([docs[0]]);
    const { rows } = compareRecords(a.analysis, b.analysis);
    expect(rows.length).toBe(0);
  });
});

describe('analytics', () => {
  it('computes totals from actual data', () => {
    const result = analyseDocuments(docs);
    const analytics = computeAnalytics(result.analysis);
    expect(analytics.totals.documents).toBe(2);
    expect(analytics.totals.medications).toBeGreaterThan(0);
    expect(analytics.totals.investigations).toBeGreaterThan(0);
  });

  it('groups events by month', () => {
    const result = analyseDocuments(docs);
    const analytics = computeAnalytics(result.analysis);
    expect(analytics.eventsByMonth.length).toBeGreaterThan(0);
    expect(analytics.eventsByMonth.some(m => m.month === '2026-01')).toBe(true);
  });

  it('builds a lab table with provenance', () => {
    const result = analyseDocuments(docs);
    const analytics = computeAnalytics(result.analysis);
    // No labs in these docs, so the table is empty — not fabricated
    expect(Array.isArray(analytics.labTable)).toBe(true);
  });
});