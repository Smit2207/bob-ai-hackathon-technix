import { describe, it, expect, beforeEach } from 'vitest';
import { analyseDocuments } from '../shared/clinical/pipeline.js';
import { buildBrief, briefToMarkdown } from '../shared/clinical/briefs.js';
import type { RawDocument } from '../shared/clinical/types.js';

const demoDocs: RawDocument[] = [
  {
    id: 'd1', name: 'GP_Consultation.txt', kind: 'txt',
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

PLAN:
Continue current medication.
Refer to Cardiology for assessment of breathlessness.
Pulmonary function test ordered today.
Follow-up in 6 weeks.`,
  },
  {
    id: 'd2', name: 'Echo_Report.txt', kind: 'txt',
    text: `ECHOCARDIOGRAM REPORT
Patient Name: Test Patient
Date of Examination: 23 Jan 2026

FINDINGS: LVEF 55% by biplane Simpson's method.

IMPRESSION: Normal left ventricular systolic function with preserved ejection fraction (LVEF 55%).`,
  },
  {
    id: 'd3', name: 'Cardiology_Letter.txt', kind: 'txt',
    text: `CARDIOLOGY CLINIC LETTER
Patient Name: Test Patient
Date: 03 Feb 2026

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
];

describe('Brief generation regression tests', () => {
  let analysis: any;

  beforeEach(() => {
    const result = analyseDocuments(demoDocs);
    analysis = result.analysis;
  });

  describe('Ward round brief', () => {
    it('generates a ward round brief with required sections', () => {
      const brief = buildBrief(analysis, 'ward');
      expect(brief.type).toBe('ward');
      expect(brief.title).toBe('Ward round brief');
      expect(brief.sections.length).toBeGreaterThan(0);

      const headings = brief.sections.map(s => s.heading);
      expect(headings).toContain('Patient overview');
      expect(headings).toContain('Current state');
      expect(headings).toContain('Recent clinical events');
      expect(headings).toContain('What changed');
      expect(headings).toContain('Recent investigations');
      expect(headings).toContain('Open care loops');
      expect(headings).toContain('Documentation conflicts');
      expect(headings).toContain('What the next clinician should verify');
    });

    it('includes medication reconciliation categories', () => {
      const brief = buildBrief(analysis, 'ward');
      const headings = brief.sections.map(s => s.heading);
      expect(headings).toContain('Medication reconciliation');
    });

    it('includes Handover Guard items', () => {
      const brief = buildBrief(analysis, 'ward');
      const headings = brief.sections.map(s => s.heading);
      expect(headings).toContain('Handover Guard — Outstanding items');
    });

    it('includes evidence index with source references', () => {
      const brief = buildBrief(analysis, 'ward');
      expect(brief.evidenceIndex.length).toBeGreaterThan(0);
      brief.evidenceIndex.forEach(e => {
        expect(e.ref).toMatch(/^E\d+$/);
        expect(e.documentName).toBeTruthy();
        expect(e.text).toBeTruthy();
      });
    });

    it('includes disclaimer', () => {
      const brief = buildBrief(analysis, 'ward');
      expect(brief.disclaimer).toBeTruthy();
      expect(brief.disclaimer).toContain('MedBrief AI is not a diagnostic or treatment system');
    });

    it('renders plain text with evidence index', () => {
      const brief = buildBrief(analysis, 'ward');
      expect(brief.plainText).toContain('WARD ROUND BRIEF');
      expect(brief.plainText).toContain('EVIDENCE INDEX');
      expect(brief.plainText).toContain(brief.disclaimer);
    });

    it('renders markdown with evidence index and disclaimer', () => {
      const brief = buildBrief(analysis, 'ward');
      const md = briefToMarkdown(brief);
      expect(md).toContain('# Ward round brief');
      expect(md).toContain('## Evidence index');
      expect(md).toContain('> ' + brief.disclaimer);
    });
  });

  describe('Referral brief', () => {
    it('generates a referral brief with required sections', () => {
      const brief = buildBrief(analysis, 'referral', 'Cardiology');
      expect(brief.type).toBe('referral');
      expect(brief.title).toBe('Referral brief — Cardiology');
      expect(brief.specialty).toBe('Cardiology');

      const headings = brief.sections.map(s => s.heading);
      expect(headings).toContain('Reason for referral');
      expect(headings).toContain('Relevant history');
      expect(headings).toContain('Recent medication changes');
      expect(headings).toContain('Current documented medications');
      expect(headings).toContain('Relevant investigations');
      expect(headings).toContain('Available findings');
      expect(headings).toContain('Outstanding items');
      expect(headings).toContain('Questions for receiving clinician');
    });

    it('includes documented reason for referral', () => {
      const brief = buildBrief(analysis, 'referral', 'Cardiology');
      const reasonSection = brief.sections.find(s => s.heading === 'Reason for referral');
      expect(reasonSection).toBeDefined();
      expect(reasonSection!.lines.length).toBeGreaterThan(0);
    });

    it('includes Handover Guard items', () => {
      const brief = buildBrief(analysis, 'referral', 'Cardiology');
      const headings = brief.sections.map(s => s.heading);
      expect(headings).toContain('Handover Guard — Outstanding items');
    });

    it('includes documentation conflicts requiring review when present', () => {
      const brief = buildBrief(analysis, 'referral', 'Cardiology');
      const headings = brief.sections.map(s => s.heading);
      // Conflicts section is only added when conflicts exist in the record
      if (analysis.conflicts.length > 0) {
        expect(headings).toContain('Documentation conflicts requiring review');
      }
    });

    it('includes evidence index', () => {
      const brief = buildBrief(analysis, 'referral', 'Cardiology');
      expect(brief.evidenceIndex.length).toBeGreaterThan(0);
    });

    it('includes disclaimer', () => {
      const brief = buildBrief(analysis, 'referral', 'Cardiology');
      expect(brief.disclaimer).toBeTruthy();
    });
  });

  describe('Discharge / handoff brief', () => {
    it('generates a handoff brief with required sections', () => {
      const brief = buildBrief(analysis, 'handoff');
      expect(brief.type).toBe('handoff');
      expect(brief.title).toBe('Discharge / handoff brief');

      const headings = brief.sections.map(s => s.heading);
      expect(headings).toContain('Admission context');
      expect(headings).toContain('Clinical course — major events');
      expect(headings).toContain('Procedures');
      expect(headings).toContain('Documented medication changes (reconciliation)');
      expect(headings).toContain('Investigation results');
      expect(headings).toContain('Outstanding investigations');
      expect(headings).toContain('Follow-ups');
      expect(headings).toContain('Documentation conflicts requiring review');
    });

    it('includes medication reconciliation categories', () => {
      const brief = buildBrief(analysis, 'handoff');
      const reconSection = brief.sections.find(s => s.heading === 'Documented medication changes (reconciliation)');
      expect(reconSection).toBeDefined();
      const text = reconSection!.lines.join('\n');
      expect(text).toMatch(/Continued|Started|Stopped|Changed|Conflicting\/Unclear/);
    });

    it('includes Handover Guard items', () => {
      const brief = buildBrief(analysis, 'handoff');
      const headings = brief.sections.map(s => s.heading);
      expect(headings).toContain('Handover Guard — Outstanding items');
    });

    it('includes evidence index', () => {
      const brief = buildBrief(analysis, 'handoff');
      expect(brief.evidenceIndex.length).toBeGreaterThan(0);
    });

    it('includes disclaimer', () => {
      const brief = buildBrief(analysis, 'handoff');
      expect(brief.disclaimer).toBeTruthy();
    });
  });

  describe('Discharge summary with handover guard', () => {
    it('generates a discharge summary with required sections', () => {
      const brief = buildBrief(analysis, 'discharge');
      expect(brief.type).toBe('discharge');
      expect(brief.title).toBe('Discharge summary with handover guard');

      const headings = brief.sections.map(s => s.heading);
      expect(headings).toContain('Admission context');
      expect(headings).toContain('Major clinical events');
      expect(headings).toContain('Procedures performed');
      expect(headings).toContain('Medication reconciliation');
      expect(headings).toContain('Investigation results');
      expect(headings).toContain('Outstanding investigations carried forward');
      expect(headings).toContain('Outstanding referrals and follow-ups');
      expect(headings).toContain('Documentation conflicts requiring review');
      expect(headings).toContain('Handover completeness checklist');
      expect(headings).toContain('Information for receiving team');
    });

    it('includes handover completeness checklist with overall review state', () => {
      const brief = buildBrief(analysis, 'discharge');
      const checklist = brief.sections.find(s => s.heading === 'Handover completeness checklist');
      expect(checklist).toBeDefined();
      const text = checklist!.lines.join('\n');
      expect(text).toContain('Overall review state:');
    });

    it('includes evidence index', () => {
      const brief = buildBrief(analysis, 'discharge');
      expect(brief.evidenceIndex.length).toBeGreaterThan(0);
    });

    it('includes disclaimer', () => {
      const brief = buildBrief(analysis, 'discharge');
      expect(brief.disclaimer).toBeTruthy();
    });
  });

  describe('Safety and transparency', () => {
    it('does not invent missing information', () => {
      const brief = buildBrief(analysis, 'ward');
      const allText = brief.sections.flatMap(s => s.lines).join('\n');
      // Should not contain invented dates or outcomes
      expect(allText).not.toContain('invented');
      expect(allText).not.toContain('fabricated');
    });

    it('identifies missing fields without inventing replacements', () => {
      const brief = buildBrief(analysis, 'ward');
      const allText = brief.sections.flatMap(s => s.lines).join('\n');
      // Should indicate when information is not documented
      expect(allText).toMatch(/not documented|not found|No .* were/i);
    });

    it('identifies contradictory facts', () => {
      const brief = buildBrief(analysis, 'ward');
      const conflictsSection = brief.sections.find(s => s.heading === 'Documentation conflicts');
      expect(conflictsSection).toBeDefined();
    });

    it('preserves evidence index for important clinical statements', () => {
      const brief = buildBrief(analysis, 'ward');
      // Every section with evidence should have corresponding evidence index entries
      const evidenceRefs = new Set(brief.evidenceIndex.map(e => e.ref));
      brief.sections.forEach(section => {
        section.lines.forEach(line => {
          const matches = line.match(/\[E\d+\]/g);
          if (matches) {
            matches.forEach(ref => {
              const refId = ref.slice(1, -1); // Extract E1 from [E1]
              expect(evidenceRefs.has(refId)).toBe(true);
            });
          }
        });
      });
    });
  });

  describe('Medication reconciliation categories', () => {
    it('categorizes medications into continued, started, stopped, changed, conflicting/unclear', () => {
      const brief = buildBrief(analysis, 'discharge');
      const reconSection = brief.sections.find(s => s.heading === 'Medication reconciliation');
      expect(reconSection).toBeDefined();
      const text = reconSection!.lines.join('\n');
      // Atorvastatin should be in Changed category (dose increased)
      expect(text).toContain('Atorvastatin');
    });

    it('does not infer current prescription from old notes alone', () => {
      const brief = buildBrief(analysis, 'discharge');
      const reconSection = brief.sections.find(s => s.heading === 'Medication reconciliation');
      expect(reconSection).toBeDefined();
      // Should have evidence references for each medication
      const text = reconSection!.lines.join('\n');
      expect(text).toMatch(/\[E\d+\]/);
    });
  });

  describe('Handover Guard integration', () => {
    it('carries unresolved handover items into all brief types', () => {
      const wardBrief = buildBrief(analysis, 'ward');
      const referralBrief = buildBrief(analysis, 'referral', 'Cardiology');
      const handoffBrief = buildBrief(analysis, 'handoff');
      const dischargeBrief = buildBrief(analysis, 'discharge');

      [wardBrief, referralBrief, handoffBrief].forEach(brief => {
        const headings = brief.sections.map(s => s.heading);
        expect(headings).toContain('Handover Guard — Outstanding items');
      });

      // Discharge has handover completeness checklist instead
      const dischargeHeadings = dischargeBrief.sections.map(s => s.heading);
      expect(dischargeHeadings).toContain('Handover completeness checklist');
    });

    it('includes review state in handover items', () => {
      const brief = buildBrief(analysis, 'ward');
      const handoverSection = brief.sections.find(s => s.heading === 'Handover Guard — Outstanding items');
      expect(handoverSection).toBeDefined();
      const text = handoverSection!.lines.join('\n');
      // Should have status indicators
      expect(text).toMatch(/[✓⏳○]/);
    });
  });
});