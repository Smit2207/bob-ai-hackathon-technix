import { describe, it, expect, beforeEach, vi } from 'vitest';
import { analyseDocuments } from '../shared/clinical/pipeline.js';
import { buildHandoverItems, buildHandoverSummary, buildMedicationReconciliation } from '../shared/clinical/temporal.js';
import type { RawDocument, PatientAnalysis, HandoverItem, HandoverReviewState } from '../shared/clinical/types.js';

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

describe('Handover Guard', () => {
  let analysis: PatientAnalysis;

  beforeEach(() => {
    const result = analyseDocuments(demoDocs);
    analysis = result.analysis;
  });

  describe('buildHandoverItems', () => {
    it('creates handover items for open investigations', () => {
      const items = buildHandoverItems(
        analysis.careLoops,
        analysis.medicationChanges,
        analysis.conflicts,
        analysis.investigations,
        analysis.referrals,
        analysis.followUps,
        analysis.medications
      );

      const pftItems = items.filter(i => i.type === 'Investigation' && i.title === 'Pulmonary function test');
      expect(pftItems.length).toBeGreaterThan(0);
      
      const pftItem = pftItems[0];
      expect(pftItem.reviewState).toBe('Incomplete');
      expect(pftItem.isDocumentedFact).toBe(true);
      expect(pftItem.isMissingInfo).toBe(true); // No result documented
      expect(pftItem.linkedEntityType).toBe('Investigation');
      expect(pftItem.evidence.length).toBeGreaterThan(0);
      expect(pftItem.sourceDocument).toBeTruthy();
      expect(pftItem.page).toBeTruthy();
      expect(pftItem.sourceExcerpt).toBeTruthy();
    });

    it('creates handover items for open referrals', () => {
      const items = buildHandoverItems(
        analysis.careLoops,
        analysis.medicationChanges,
        analysis.conflicts,
        analysis.investigations,
        analysis.referrals,
        analysis.followUps,
        analysis.medications
      );

      const referralItems = items.filter(i => i.type === 'Referral');
      expect(referralItems.length).toBeGreaterThan(0);
      
      const referralItem = referralItems[0];
      expect(referralItem.reviewState).toBe('Incomplete');
      expect(referralItem.isDocumentedFact).toBe(true);
      expect(referralItem.isMissingInfo).toBe(true); // No outcome documented
      expect(referralItem.linkedEntityType).toBe('Referral');
    });

    it('creates handover items for open follow-ups', () => {
      const items = buildHandoverItems(
        analysis.careLoops,
        analysis.medicationChanges,
        analysis.conflicts,
        analysis.investigations,
        analysis.referrals,
        analysis.followUps,
        analysis.medications
      );

      const followUpItems = items.filter(i => i.type === 'Follow-up');
      expect(followUpItems.length).toBeGreaterThan(0);
      
      const followUpItem = followUpItems[0];
      expect(followUpItem.reviewState).toBe('Incomplete');
      expect(followUpItem.isDocumentedFact).toBe(true);
      expect(followUpItem.linkedEntityType).toBe('FollowUp');
    });

    it('creates handover items for medication changes', () => {
      const items = buildHandoverItems(
        analysis.careLoops,
        analysis.medicationChanges,
        analysis.conflicts,
        analysis.investigations,
        analysis.referrals,
        analysis.followUps,
        analysis.medications
      );

      const medChangeItems = items.filter(i => i.type === 'Medication Change');
      expect(medChangeItems.length).toBeGreaterThan(0);
      
      const atorvastatinChange = medChangeItems.find(i => i.title === 'Atorvastatin');
      expect(atorvastatinChange).toBeDefined();
      expect(atorvastatinChange!.reviewState).toBe('Incomplete');
      expect(atorvastatinChange!.isDocumentedFact).toBe(true);
      expect(atorvastatinChange!.description).toContain('dose increased');
      expect(atorvastatinChange!.description).toContain('20 mg');
      expect(atorvastatinChange!.description).toContain('40 mg');
      expect(atorvastatinChange!.linkedEntityType).toBe('MedicationChange');
    });

    it('creates handover items for documentation conflicts', () => {
      const conflictDocs: RawDocument[] = [
        {
          id: 'a', name: 'A.txt', kind: 'txt',
          text: `Patient Name: Test Patient\nDate: 01 Jan 2026\n\nAtorvastatin 20 mg nightly.`,
        },
        {
          id: 'b', name: 'B.txt', kind: 'txt',
          text: `Patient Name: Test Patient\nDate: 01 Feb 2026\n\nAtorvastatin 40 mg nightly.`,
        },
      ];
      const conflictResult = analyseDocuments(conflictDocs);
      
      const items = buildHandoverItems(
        conflictResult.analysis.careLoops,
        conflictResult.analysis.medicationChanges,
        conflictResult.analysis.conflicts,
        conflictResult.analysis.investigations,
        conflictResult.analysis.referrals,
        conflictResult.analysis.followUps,
        conflictResult.analysis.medications
      );

      const conflictItems = items.filter(i => i.type === 'Documentation Conflict');
      expect(conflictItems.length).toBeGreaterThan(0);
      
      const conflictItem = conflictItems[0];
      expect(conflictItem.reviewState).toBe('Incomplete');
      expect(conflictItem.isDocumentedFact).toBe(false);
      expect(conflictItem.isConflicting).toBe(true);
      expect(conflictItem.isMissingInfo).toBe(true);
      expect(conflictItem.linkedEntityType).toBe('DocumentationConflict');
    });
  });

  describe('buildHandoverSummary', () => {
    it('computes overall review state as Incomplete when items are incomplete', () => {
      const items = buildHandoverItems(
        analysis.careLoops,
        analysis.medicationChanges,
        analysis.conflicts,
        analysis.investigations,
        analysis.referrals,
        analysis.followUps,
        analysis.medications
      );

      const summary = buildHandoverSummary(items, []);
      expect(summary.overallReviewState).toBe('Incomplete');
    });

    it('computes overall review state as Ready for clinician review when no items are incomplete and some are ready', () => {
      const items = buildHandoverItems(
        analysis.careLoops,
        analysis.medicationChanges,
        analysis.conflicts,
        analysis.investigations,
        analysis.referrals,
        analysis.followUps,
        analysis.medications
      );

      // Mark ALL items as ready for review (none incomplete)
      items.forEach(item => {
        item.reviewState = 'Ready for clinician review';
      });

      const summary = buildHandoverSummary(items, []);
      expect(summary.overallReviewState).toBe('Ready for clinician review');
    });

    it('computes overall review state as Clinician reviewed when all items reviewed', () => {
      const items = buildHandoverItems(
        analysis.careLoops,
        analysis.medicationChanges,
        analysis.conflicts,
        analysis.investigations,
        analysis.referrals,
        analysis.followUps,
        analysis.medications
      );

      // Mark all items as reviewed
      items.forEach(item => {
        item.reviewState = 'Clinician reviewed';
      });

      const summary = buildHandoverSummary(items, []);
      expect(summary.overallReviewState).toBe('Clinician reviewed');
    });

    it('includes medication reconciliation categories', () => {
      const items = buildHandoverItems(
        analysis.careLoops,
        analysis.medicationChanges,
        analysis.conflicts,
        analysis.investigations,
        analysis.referrals,
        analysis.followUps,
        analysis.medications
      );

      const summary = buildHandoverSummary(items, []);
      expect(summary.medicationReconciliation).toBeDefined();
      expect(Array.isArray(summary.medicationReconciliation)).toBe(true);
    });
  });

  describe('buildMedicationReconciliation', () => {
    it('categorizes medications correctly', () => {
      const recon = buildMedicationReconciliation(
        analysis.medications,
        analysis.medicationChanges,
        analysis.conflicts
      );

      const categories = recon.map(c => c.category).sort();
      expect(categories).toContain('Continued');
      expect(categories).toContain('Started');
      expect(categories).toContain('Stopped');
      expect(categories).toContain('Changed');
      expect(categories).toContain('Conflicting/Unclear');
    });

    it('includes evidence for each medication', () => {
      const recon = buildMedicationReconciliation(
        analysis.medications,
        analysis.medicationChanges,
        analysis.conflicts
      );

      recon.forEach(category => {
        category.medications.forEach(med => {
          expect(med.evidence).toBeDefined();
          expect(med.evidence.length).toBeGreaterThan(0);
          expect(med.evidence[0].documentName).toBeTruthy();
        });
      });
    });
  });

  describe('Duplicate detection', () => {
    it('uses linkedEntityId and linkedEntityType as unique key', () => {
      const items = buildHandoverItems(
        analysis.careLoops,
        analysis.medicationChanges,
        analysis.conflicts,
        analysis.investigations,
        analysis.referrals,
        analysis.followUps,
        analysis.medications
      );

      // Each item should have a unique linkedEntityId + linkedEntityType combination
      const keys = new Set(items.map(i => `${i.linkedEntityId}|${i.linkedEntityType}`));
      expect(keys.size).toBe(items.length);
    });

    it('does not create duplicate items when re-analyzing same documents', () => {
      // Run analysis twice
      const result1 = analyseDocuments(demoDocs);
      const result2 = analyseDocuments(demoDocs);

      const items1 = buildHandoverItems(
        result1.analysis.careLoops,
        result1.analysis.medicationChanges,
        result1.analysis.conflicts,
        result1.analysis.investigations,
        result1.analysis.referrals,
        result1.analysis.followUps,
        result1.analysis.medications
      );

      const items2 = buildHandoverItems(
        result2.analysis.careLoops,
        result2.analysis.medicationChanges,
        result2.analysis.conflicts,
        result2.analysis.investigations,
        result2.analysis.referrals,
        result2.analysis.followUps,
        result2.analysis.medications
      );

      // Items should have same linkedEntityIds (stable IDs)
      const ids1 = items1.map(i => i.linkedEntityId).sort();
      const ids2 = items2.map(i => i.linkedEntityId).sort();
      expect(ids1).toEqual(ids2);
    });
  });

  describe('Safety and transparency', () => {
    it('marks extracted facts as isDocumentedFact=true', () => {
      const items = buildHandoverItems(
        analysis.careLoops,
        analysis.medicationChanges,
        analysis.conflicts,
        analysis.investigations,
        analysis.referrals,
        analysis.followUps,
        analysis.medications
      );

      items.forEach(item => {
        if (item.type !== 'Documentation Conflict') {
          expect(item.isDocumentedFact).toBe(true);
        }
      });
    });

    it('marks conflicts as isDocumentedFact=false and isConflicting=true', () => {
      const conflictDocs: RawDocument[] = [
        {
          id: 'a', name: 'A.txt', kind: 'txt',
          text: `Patient Name: Test Patient\nDate: 01 Jan 2026\n\nAtorvastatin 20 mg nightly.`,
        },
        {
          id: 'b', name: 'B.txt', kind: 'txt',
          text: `Patient Name: Test Patient\nDate: 01 Feb 2026\n\nAtorvastatin 40 mg nightly.`,
        },
      ];
      const conflictResult = analyseDocuments(conflictDocs);
      
      const items = buildHandoverItems(
        conflictResult.analysis.careLoops,
        conflictResult.analysis.medicationChanges,
        conflictResult.analysis.conflicts,
        conflictResult.analysis.investigations,
        conflictResult.analysis.referrals,
        conflictResult.analysis.followUps,
        conflictResult.analysis.medications
      );

      const conflictItems = items.filter(i => i.type === 'Documentation Conflict');
      conflictItems.forEach(item => {
        expect(item.isDocumentedFact).toBe(false);
        expect(item.isConflicting).toBe(true);
        expect(item.isMissingInfo).toBe(true);
      });
    });

    it('shows investigation status for missing results', () => {
      const items = buildHandoverItems(
        analysis.careLoops,
        analysis.medicationChanges,
        analysis.conflicts,
        analysis.investigations,
        analysis.referrals,
        analysis.followUps,
        analysis.medications
      );

      const pftItems = items.filter(i => i.type === 'Investigation' && i.title === 'Pulmonary function test');
      expect(pftItems.length).toBeGreaterThan(0);
      
      const pftItem = pftItems[0];
      // The relevantDate should be the ordered date
      expect(pftItem.relevantDate).toBeTruthy();
      // The lastDocumentedStatus should indicate the investigation status (ordered, etc.)
      expect(pftItem.lastDocumentedStatus).toBeTruthy();
      // isMissingInfo should be true since no result is documented
      expect(pftItem.isMissingInfo).toBe(true);
    });
  });
});