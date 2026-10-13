/**
 * Brief generation. Briefs are assembled deterministically from the extracted
 * record so that every statement is documented and evidence-linked. When an
 * AI provider is configured it may rephrase, but it is given only the context
 * built here and is instructed never to invent.
 *
 * No brief contains treatment advice, diagnoses MedBrief made, or predictions.
 */

import { PatientAnalysis, HandoverItem } from './types.js';
import { formatDate } from './text.js';
import { Chunk } from './types.js';

export type BriefType = 'ward' | 'referral' | 'handoff' | 'discharge';

export interface BriefSection {
  heading: string;
  lines: string[];
  evidence: Array<{ documentName: string; page: number | null; text: string }>;
}

export interface Brief {
  type: BriefType;
  specialty: string | null;
  title: string;
  generatedAt: string;
  sections: BriefSection[];
  plainText: string;
  evidenceIndex: Array<{ ref: string; documentName: string; page: number | null; text: string }>;
  disclaimer: string;
}

const DISCLAIMER =
  'MedBrief AI is not a diagnostic or treatment system. This brief contains only information documented in the uploaded record. Absence of information does not mean absence of care. Not for clinical use.';

function uniqueMeds(analysis: PatientAnalysis) {
  const seen = new Set<string>();
  const out: PatientAnalysis['medications'] = [];
  for (const m of analysis.medications) {
    const k = `${m.name.toLowerCase()}|${m.dose}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(m);
  }
  return out;
}

function formatHandoverItem(item: HandoverItem, addEvidence: (doc: string, page: number | null, text: string) => string): string {
  const statusIcon = item.reviewState === 'Clinician reviewed' ? '✓' : item.reviewState === 'Ready for clinician review' ? '⏳' : '○';
  const evidenceRef = item.evidence.length > 0 ? addEvidence(item.evidence[0].documentName, item.evidence[0].page, item.evidence[0].text) : '';
  const reviewDetail = item.reviewDetail
    ? ` (Service: ${item.reviewDetail.accountableService ?? 'not entered'}, Person: ${item.reviewDetail.accountablePerson ?? 'not entered'}, Follow-up: ${item.reviewDetail.plannedFollowUpDate ?? 'not entered'}, Disposition: ${item.reviewDetail.disposition ?? 'not entered'})`
    : '';
  const missingInfo = item.isMissingInfo ? ' [Missing: outcome/result not documented]' : '';
  const conflicting = item.isConflicting ? ' [Conflicting documentation]' : '';
  const userEntered = item.isUserEntered ? ' [Clinician-entered]' : '';
  const documentedFact = item.isDocumentedFact ? ' [Documented]' : '';
  return `${statusIcon} ${item.type}: ${item.title} — ${item.lastDocumentedStatus}${missingInfo}${conflicting}${userEntered}${documentedFact}${reviewDetail} ${evidenceRef}`;
}

function evRef(analysis: PatientAnalysis, ev: { documentName: string; page: number; text: string }, index: number) {
  return `[E${index}] ${ev.documentName}, page ${ev.page}`;
}

export function buildBrief(
  analysis: PatientAnalysis,
  type: BriefType,
  specialty: string | null = null,
  chunks: Chunk[] = []
): Brief {
  const evidenceIndex: Brief['evidenceIndex'] = [];
  const addEvidence = (documentName: string, page: number | null, text: string): string => {
    const key = `${documentName}|${page}|${text.slice(0, 60)}`;
    const existing = evidenceIndex.findIndex((e) => `${e.documentName}|${e.page}|${e.text.slice(0, 60)}` === key);
    if (existing >= 0) return `[E${existing + 1}]`;
    evidenceIndex.push({ ref: `E${evidenceIndex.length + 1}`, documentName, page, text });
    return `[E${evidenceIndex.length}]`;
  };

  const sections: BriefSection[] = [];
  const p = analysis.patient;
  void evRef;

  /* ------------------------------ Header ------------------------------ */
  const headerBits = [
    p.name ?? 'Patient name not documented',
    p.age ? `Age ${p.age}` : 'Age not documented',
    p.sex ?? 'Sex not documented',
    p.patientId ? `ID ${p.patientId}` : 'Patient ID not documented',
    p.recordStart && p.recordEnd ? `Record ${formatDate(p.recordStart)} – ${formatDate(p.recordEnd)}` : 'Record period not documented',
    `${analysis.documents.length} document(s) analysed`,
  ];
  sections.push({
    heading: 'Patient overview',
    lines: headerBits,
    evidence: [],
  });

  if (type === 'ward') {
    /* ---------------------- WARD ROUND BRIEF ---------------------- */
    sections.push({
      heading: 'Current state',
      lines: analysis.currentState,
      evidence: [],
    });

    const recent = [...analysis.longitudinalStory].reverse().slice(0, 8);
    sections.push({
      heading: 'Recent clinical events',
      lines: recent.length
        ? recent.map((e) => `${e.date ? formatDate(e.date) : 'Date not documented'} — ${e.title}. ${trim(e.description)} ${addEvidence(e.evidence.documentName, e.evidence.page, e.evidence.text)}`)
        : ['No clinical events were extracted from the available record.'],
      evidence: recent.map((e) => ({ documentName: e.evidence.documentName, page: e.evidence.page, text: e.evidence.text })),
    });

    const changes = analysis.medicationChanges.slice(0, 8);
    sections.push({
      heading: 'What changed',
      lines: changes.length
        ? changes.map((c) => {
            const detail =
              c.kind === 'STARTED'
                ? `${c.medicationName} started at ${c.newDose ?? 'dose not documented'}`
                : c.kind === 'STOPPED'
                ? `${c.medicationName} stopped (previously ${c.previousDose ?? 'dose not documented'})`
                : `${c.medicationName} changed ${c.previousDose ?? 'not documented'} → ${c.newDose ?? 'not documented'}`;
            return `${c.date ? formatDate(c.date) : 'Date not documented'} — ${detail}${c.documentedReason ? ` (documented reason: ${c.documentedReason})` : ''} ${addEvidence(c.evidence[c.evidence.length - 1].documentName, c.evidence[c.evidence.length - 1].page, c.evidence[c.evidence.length - 1].text)}`;
          })
        : ['No medication changes were detected in the available record.'],
      evidence: changes.flatMap((c) => [{ documentName: c.evidence[0].documentName, page: c.evidence[0].page, text: c.evidence[0].text }]),
    });

    // Medication reconciliation categories
    if (analysis.handoverSummary) {
      const recon = analysis.handoverSummary.medicationReconciliation;
      const reconLines: string[] = [];
      for (const cat of recon) {
        if (cat.medications.length === 0) continue;
        reconLines.push(`**${cat.category}:**`);
        for (const m of cat.medications) {
          reconLines.push(
            `  - ${m.name}${m.dose ? ` ${m.dose}` : ''}${m.frequency ? ` ${m.frequency}` : ''} — ${m.note} ${addEvidence(m.evidence[0].documentName, m.evidence[0].page, m.evidence[0].text)}`
          );
        }
      }
      sections.push({
        heading: 'Medication reconciliation',
        lines: reconLines.length
          ? reconLines
          : ['No medications were documented in the available record.'],
        evidence: recon.flatMap((c) => c.medications.flatMap((m) => ({ documentName: m.evidence[0].documentName, page: m.evidence[0].page, text: m.evidence[0].text }))),
      });
    } else {
      const meds = uniqueMeds(analysis).filter((m) => m.status === 'ACTIVE');
      sections.push({
        heading: 'Current medications',
        lines: meds.length
          ? meds.map((m) => `${m.name}${m.dose ? ` ${m.dose}` : ''}${m.frequency ? ` ${m.frequency}` : ''}${m.route ? ` ${m.route}` : ''}${m.startDate ? ` (documented ${formatDate(m.startDate)})` : ''} ${addEvidence(m.evidence.documentName, m.evidence.page, m.evidence.text)}`)
          : ['No medications are documented as active in the available record.'],
        evidence: meds.map((m) => ({ documentName: m.evidence.documentName, page: m.evidence.page, text: m.evidence.text })),
      });
    }

    const invs = analysis.investigations.slice(0, 10);
    sections.push({
      heading: 'Recent investigations',
      lines: invs.length
        ? invs.map((i) => `${i.name} — ${i.status.replace(/_/g, ' ').toLowerCase()}${i.orderedDate ? `, ordered ${formatDate(i.orderedDate)}` : ''}${i.performedDate ? `, performed ${formatDate(i.performedDate)}` : ''}${i.result ? `, result: ${i.result}` : ''} ${addEvidence(i.evidence[0].documentName, i.evidence[0].page, i.evidence[0].text)}`)
        : ['No investigations were extracted from the available record.'],
      evidence: invs.map((i) => ({ documentName: i.evidence[0].documentName, page: i.evidence[0].page, text: i.evidence[0].text })),
    });

    const open = analysis.careLoops.filter((l) => l.status === 'OPEN');
    sections.push({
      heading: 'Open care loops',
      lines: open.length
        ? open.map((l) => {
            const missing = l.stages.filter((s) => !s.documented).map((s) => `${s.stage}: ${s.note}`);
            return `${l.name} — ${l.orderedDate ? `ordered ${formatDate(l.orderedDate)}` : 'order date not documented'}; ${l.lastMention ? `last mention ${formatDate(l.lastMention)}` : 'no dated mention'}. ${missing.join(' ')}`;
          })
        : ['No open care loops were found in the available record.'],
      evidence: open.flatMap((l) => l.evidence.slice(0, 1).map((e) => ({ documentName: e.documentName, page: e.page, text: e.text }))),
    });

    sections.push({
      heading: 'Documentation conflicts',
      lines: analysis.conflicts.length
        ? analysis.conflicts.map((c) => `${c.entity} (${c.field}): ${c.entries.map((e) => `${e.value}${e.date ? ` on ${formatDate(e.date)}` : ''}`).join(' / ')}. Status: requires review. ${c.interpretation}`)
        : ['No documentation conflicts were detected.'],
      evidence: analysis.conflicts.flatMap((c) => c.entries.filter((e) => e.page > 0).map((e) => ({ documentName: e.documentName, page: e.page, text: e.text }))),
    });

    // Handover Guard items
    if (analysis.handoverItems && analysis.handoverItems.length > 0) {
      sections.push({
        heading: 'Handover Guard — Outstanding items',
        lines: analysis.handoverItems.map((h) => formatHandoverItem(h, addEvidence)),
        evidence: analysis.handoverItems.flatMap((h) => h.evidence.slice(0, 1).map((e) => ({ documentName: e.documentName, page: e.page, text: e.text }))),
      });
    }

    sections.push({
      heading: 'What the next clinician should verify',
      lines: analysis.verifyNext.length
        ? analysis.verifyNext
        : ['No outstanding verification items were derived from the available record.'],
      evidence: [],
    });
  }

  if (type === 'referral') {
    const target = specialty ?? 'General Medicine';
    const related = analysis.referrals.filter((r) => r.specialty.toLowerCase() === target.toLowerCase());
    const documentedReason = related.map((r) => r.reason).find(Boolean);

    sections.push({
      heading: 'Reason for referral',
      lines: [
        documentedReason
          ? trim(documentedReason)
          : 'Reason for referral was not explicitly documented in the available record.',
        related.length
          ? `A referral to ${target} is documented${related[0].date ? ` on ${formatDate(related[0].date)}` : ''}.`
          : `No referral to ${target} was found in the available record; this brief was requested for that specialty.`,
      ],
      evidence: related.map((r) => ({ documentName: r.evidence[0].documentName, page: r.evidence[0].page, text: r.evidence[0].text })),
    });

    const history = analysis.events.slice(0, 14);
    sections.push({
      heading: 'Relevant history',
      lines: history.length
        ? history.map((e) => `${e.date ? formatDate(e.date) : 'Date not documented'} — ${e.type}: ${trim(e.description)} ${addEvidence(e.evidence.documentName, e.evidence.page, e.evidence.text)}`)
        : ['No clinical history was extracted from the available record.'],
      evidence: history.slice(0, 6).map((e) => ({ documentName: e.evidence.documentName, page: e.evidence.page, text: e.evidence.text })),
    });

    sections.push({
      heading: 'Recent medication changes',
      lines: analysis.medicationChanges.length
        ? analysis.medicationChanges.map((c) => `${c.date ? formatDate(c.date) : 'Date not documented'} — ${c.medicationName}: ${c.previousDose ?? 'not documented'} → ${c.newDose ?? c.kind}${c.documentedReason ? ` (documented reason: ${c.documentedReason})` : ''} ${addEvidence(c.evidence[c.evidence.length - 1].documentName, c.evidence[c.evidence.length - 1].page, c.evidence[c.evidence.length - 1].text)}`)
        : ['No medication changes were detected.'],
      evidence: analysis.medicationChanges.slice(0, 4).map((c) => ({ documentName: c.evidence[0].documentName, page: c.evidence[0].page, text: c.evidence[0].text })),
    });

    const meds = uniqueMeds(analysis);
    sections.push({
      heading: 'Current documented medications',
      lines: meds.length
        ? meds.map((m) => `${m.name}${m.dose ? ` ${m.dose}` : ''}${m.frequency ? ` ${m.frequency}` : ''} (${m.status})${m.startDate ? `, documented ${formatDate(m.startDate)}` : ''} ${addEvidence(m.evidence.documentName, m.evidence.page, m.evidence.text)}`)
        : ['No medications are documented in the available record.'],
      evidence: meds.slice(0, 6).map((m) => ({ documentName: m.evidence.documentName, page: m.evidence.page, text: m.evidence.text })),
    });

    const invs = analysis.investigations.slice(0, 12);
    sections.push({
      heading: 'Relevant investigations',
      lines: invs.length
        ? invs.map((i) => `${i.name} — ${i.status.replace(/_/g, ' ').toLowerCase()}${i.orderedDate ? `, ordered ${formatDate(i.orderedDate)}` : ''}${i.performedDate ? `, performed ${formatDate(i.performedDate)}` : ''}${i.result ? `; result: ${i.result}` : ''} ${addEvidence(i.evidence[0].documentName, i.evidence[0].page, i.evidence[0].text)}`)
        : ['No investigations were documented in the available record.'],
      evidence: invs.slice(0, 6).map((i) => ({ documentName: i.evidence[0].documentName, page: i.evidence[0].page, text: i.evidence[0].text })),
    });

    const fnd = analysis.findings.slice(-6);
    sections.push({
      heading: 'Available findings',
      lines: fnd.length
        ? fnd.map((f) => `${f.date ? formatDate(f.date) : 'Date not documented'} — ${trim(f.finding)} ${addEvidence(f.evidence.documentName, f.evidence.page, f.evidence.text)}`)
        : ['No findings section was found in the available record.'],
      evidence: fnd.map((f) => ({ documentName: f.evidence.documentName, page: f.evidence.page, text: f.evidence.text })),
    });

    sections.push({
      heading: 'Outstanding items',
      lines: analysis.careLoops.filter((l) => l.status === 'OPEN').length
        ? analysis.careLoops
            .filter((l) => l.status === 'OPEN')
            .map((l) => `${l.name} — ${l.stages.filter((s) => !s.documented).map((s) => s.note).join(' ')}`)
        : ['No outstanding items were derived from the available record.'],
      evidence: [],
    });

    // Handover Guard items
    if (analysis.handoverItems && analysis.handoverItems.length > 0) {
      sections.push({
        heading: 'Handover Guard — Outstanding items',
        lines: analysis.handoverItems.map((h) => formatHandoverItem(h, addEvidence)),
        evidence: analysis.handoverItems.flatMap((h) => h.evidence.slice(0, 1).map((e) => ({ documentName: e.documentName, page: e.page, text: e.text }))),
      });
    }

    // Documentation conflicts
    if (analysis.conflicts.length > 0) {
      sections.push({
        heading: 'Documentation conflicts requiring review',
        lines: analysis.conflicts.map((c) => `${c.entity} (${c.field}): ${c.entries.map((e) => `${e.value}${e.date ? ` on ${formatDate(e.date)}` : ''}`).join(' / ')}. Requires review. ${c.interpretation}`),
        evidence: analysis.conflicts.flatMap((c) => c.entries.filter((e) => e.page > 0).map((e) => ({ documentName: e.documentName, page: e.page, text: e.text }))),
      });
    }

    sections.push({
      heading: 'Questions for receiving clinician',
      lines: [
        ...analysis.verifyNext,
        ...(analysis.conflicts.length ? ['Please confirm which documentation is current where the record conflicts.'] : []),
        ...(analysis.handoverItems && analysis.handoverItems.some((h) => h.isMissingInfo)
          ? ['Please advise on the outcome/result of outstanding items where the record does not document completion.']
          : []),
      ],
      evidence: [],
    });
  }

  if (type === 'handoff') {
    const admissions = analysis.events.filter((e) => e.type === 'Admission' || e.type === 'Encounter');
    sections.push({
      heading: 'Admission context',
      lines: admissions.length
        ? admissions.slice(0, 6).map((e) => `${e.date ? formatDate(e.date) : 'Date not documented'} — ${trim(e.description)} ${addEvidence(e.evidence.documentName, e.evidence.page, e.evidence.text)}`)
        : ['No admission or encounter context was found in the available record.'],
      evidence: admissions.slice(0, 4).map((e) => ({ documentName: e.evidence.documentName, page: e.evidence.page, text: e.evidence.text })),
    });

    const major = analysis.events.filter((e) => e.type !== 'Procedure').slice(0, 10);
    sections.push({
      heading: 'Clinical course — major events',
      lines: major.length
        ? major.map((e) => `${e.date ? formatDate(e.date) : 'Date not documented'} — ${e.title}. ${trim(e.description)} ${addEvidence(e.evidence.documentName, e.evidence.page, e.evidence.text)}`)
        : ['No major events were extracted.'],
      evidence: major.slice(0, 5).map((e) => ({ documentName: e.evidence.documentName, page: e.evidence.page, text: e.evidence.text })),
    });

    const procs = analysis.events.filter((e) => e.type === 'Procedure');
    sections.push({
      heading: 'Procedures',
      lines: procs.length
        ? procs.map((p2) => `${p2.date ? formatDate(p2.date) : 'Date not documented'} — ${trim(p2.description)} ${addEvidence(p2.evidence.documentName, p2.evidence.page, p2.evidence.text)}`)
        : ['No procedures were documented in the available record.'],
      evidence: procs.map((p2) => ({ documentName: p2.evidence.documentName, page: p2.evidence.page, text: p2.evidence.text })),
    });

    /* ---- Medication reconciliation ---- */
    if (analysis.handoverSummary) {
      const recon = analysis.handoverSummary.medicationReconciliation;
      const reconLines: string[] = [];
      for (const cat of recon) {
        if (cat.medications.length === 0) continue;
        reconLines.push(`**${cat.category}:**`);
        for (const m of cat.medications) {
          reconLines.push(
            `  - ${m.name}${m.dose ? ` ${m.dose}` : ''}${m.frequency ? ` ${m.frequency}` : ''} — ${m.note} ${addEvidence(m.evidence[0].documentName, m.evidence[0].page, m.evidence[0].text)}`
          );
        }
      }
      sections.push({
        heading: 'Documented medication changes (reconciliation)',
        lines: reconLines.length
          ? reconLines
          : ['No medications were documented in the available record.'],
        evidence: recon.flatMap((c) => c.medications.flatMap((m) => ({ documentName: m.evidence[0].documentName, page: m.evidence[0].page, text: m.evidence[0].text }))),
      });
    } else {
      sections.push({
        heading: 'Documented medication changes (reconciliation)',
        lines: ['Medication reconciliation data not available. Run full analysis to generate reconciliation categories.'],
        evidence: [],
      });
    }

    const results = analysis.investigations.filter((i) => i.status === 'RESULT_AVAILABLE' || i.result);
    sections.push({
      heading: 'Investigation results',
      lines: results.length
        ? results.map((i) => `${i.name}${i.result ? ` — ${i.result}` : ''}${i.performedDate ? ` (${formatDate(i.performedDate)})` : ''} ${addEvidence(i.evidence[0].documentName, i.evidence[0].page, i.evidence[0].text)}`)
        : ['No investigation results were found in the available record.'],
      evidence: results.slice(0, 6).map((i) => ({ documentName: i.evidence[0].documentName, page: i.evidence[0].page, text: i.evidence[0].text })),
    });

    const openInv = analysis.careLoops.filter((l) => l.status === 'OPEN' && l.type === 'Investigation');
    sections.push({
      heading: 'Outstanding investigations',
      lines: openInv.length
        ? openInv.map((l) => `${l.name} — ${l.orderedDate ? `ordered ${formatDate(l.orderedDate)}` : 'order date not documented'}. ${l.stages.filter((s) => !s.documented).map((s) => s.note).join(' ')}`)
        : ['No outstanding investigations were found in the available record.'],
      evidence: openInv.flatMap((l) => l.evidence.slice(0, 1).map((e) => ({ documentName: e.documentName, page: e.page, text: e.text }))),
    });

    sections.push({
      heading: 'Follow-ups',
      lines: analysis.followUps.length
        ? analysis.followUps.map((f) => `${f.actualDate ? `Completed ${formatDate(f.actualDate)}` : 'Not documented as completed'} — ${trim(f.description)} ${addEvidence(f.evidence[0].documentName, f.evidence[0].page, f.evidence[0].text)}`)
        : ['No follow-up items were documented in the available record.'],
      evidence: analysis.followUps.slice(0, 4).map((f) => ({ documentName: f.evidence[0].documentName, page: f.evidence[0].page, text: f.evidence[0].text })),
    });

    // Handover Guard items
    if (analysis.handoverItems && analysis.handoverItems.length > 0) {
      sections.push({
        heading: 'Handover Guard — Outstanding items',
        lines: analysis.handoverItems.map((h) => formatHandoverItem(h, addEvidence)),
        evidence: analysis.handoverItems.flatMap((h) => h.evidence.slice(0, 1).map((e) => ({ documentName: e.documentName, page: e.page, text: e.text }))),
      });
    }

    sections.push({
      heading: 'Documentation conflicts requiring review',
      lines: analysis.conflicts.length
        ? analysis.conflicts.map((c) => `${c.entity} (${c.field}): ${c.entries.map((e) => `${e.value}${e.date ? ` on ${formatDate(e.date)}` : ''}`).join(' / ')}. Requires review. ${c.interpretation}`)
        : ['No documentation conflicts were detected.'],
      evidence: analysis.conflicts.flatMap((c) => c.entries.filter((e) => e.page > 0).map((e) => ({ documentName: e.documentName, page: e.page, text: e.text }))),
    });

    sections.push({
      heading: 'What the next clinician should verify',
      lines: analysis.verifyNext.length
        ? analysis.verifyNext
        : ['No outstanding verification items were derived from the available record.'],
      evidence: [],
    });
  }

  if (type === 'discharge') {
    const admissions = analysis.events.filter((e) => e.type === 'Admission' || e.type === 'Encounter');
    sections.push({
      heading: 'Admission context',
      lines: admissions.length
        ? admissions.slice(0, 6).map((e) => `${e.date ? formatDate(e.date) : 'Date not documented'} — ${trim(e.description)} ${addEvidence(e.evidence.documentName, e.evidence.page, e.evidence.text)}`)
        : ['No admission or encounter context was found in the available record.'],
      evidence: admissions.slice(0, 4).map((e) => ({ documentName: e.evidence.documentName, page: e.evidence.page, text: e.evidence.text })),
    });

    const major = analysis.events.filter((e) => e.type !== 'Procedure').slice(0, 10);
    sections.push({
      heading: 'Major clinical events',
      lines: major.length
        ? major.map((e) => `${e.date ? formatDate(e.date) : 'Date not documented'} — ${e.title}. ${trim(e.description)} ${addEvidence(e.evidence.documentName, e.evidence.page, e.evidence.text)}`)
        : ['No major events were extracted.'],
      evidence: major.slice(0, 5).map((e) => ({ documentName: e.evidence.documentName, page: e.evidence.page, text: e.evidence.text })),
    });

    const procs = analysis.events.filter((e) => e.type === 'Procedure');
    sections.push({
      heading: 'Procedures performed',
      lines: procs.length
        ? procs.map((p2) => `${p2.date ? formatDate(p2.date) : 'Date not documented'} — ${trim(p2.description)} ${addEvidence(p2.evidence.documentName, p2.evidence.page, p2.evidence.text)}`)
        : ['No procedures were documented in the available record.'],
      evidence: procs.map((p2) => ({ documentName: p2.evidence.documentName, page: p2.evidence.page, text: p2.evidence.text })),
    });

    /* ---- Medication reconciliation ---- */
    if (analysis.handoverSummary) {
      const recon = analysis.handoverSummary.medicationReconciliation;
      const reconLines: string[] = [];
      for (const cat of recon) {
        if (cat.medications.length === 0) continue;
        reconLines.push(`**${cat.category}:**`);
        for (const m of cat.medications) {
          reconLines.push(
            `  - ${m.name}${m.dose ? ` ${m.dose}` : ''}${m.frequency ? ` ${m.frequency}` : ''} — ${m.note} ${addEvidence(m.evidence[0].documentName, m.evidence[0].page, m.evidence[0].text)}`
          );
        }
      }
      sections.push({
        heading: 'Medication reconciliation',
        lines: reconLines.length
          ? reconLines
          : ['No medications were documented in the available record.'],
        evidence: recon.flatMap((c) => c.medications.flatMap((m) => ({ documentName: m.evidence[0].documentName, page: m.evidence[0].page, text: m.evidence[0].text }))),
      });
    } else {
      sections.push({
        heading: 'Medication reconciliation',
        lines: ['Medication reconciliation data not available. Run full analysis to generate reconciliation categories.'],
        evidence: [],
      });
    }

    const results = analysis.investigations.filter((i) => i.status === 'RESULT_AVAILABLE' || i.result);
    sections.push({
      heading: 'Investigation results',
      lines: results.length
        ? results.map((i) => `${i.name}${i.result ? ` — ${i.result}` : ''}${i.performedDate ? ` (${formatDate(i.performedDate)})` : ''} ${addEvidence(i.evidence[0].documentName, i.evidence[0].page, i.evidence[0].text)}`)
        : ['No investigation results were found in the available record.'],
      evidence: results.slice(0, 6).map((i) => ({ documentName: i.evidence[0].documentName, page: i.evidence[0].page, text: i.evidence[0].text })),
    });

    const openInv = analysis.careLoops.filter((l) => l.status === 'OPEN' && l.type === 'Investigation');
    sections.push({
      heading: 'Outstanding investigations carried forward',
      lines: openInv.length
        ? openInv.map((l) => `${l.name} — ${l.orderedDate ? `ordered ${formatDate(l.orderedDate)}` : 'order date not documented'}. ${l.stages.filter((s) => !s.documented).map((s) => s.note).join(' ')} ${addEvidence(l.evidence[0]?.documentName ?? '—', l.evidence[0]?.page ?? null, l.evidence[0]?.text ?? '')}`)
        : ['No outstanding investigations were found in the available record.'],
      evidence: openInv.flatMap((l) => l.evidence.slice(0, 1).map((e) => ({ documentName: e.documentName, page: e.page, text: e.text }))),
    });

    sections.push({
      heading: 'Outstanding referrals and follow-ups',
      lines: [
        ...analysis.careLoops
          .filter((l) => (l.type === 'Referral' || l.type === 'Follow-up') && l.status === 'OPEN')
          .map((l) => `${l.name} — ${l.stages.filter((s) => !s.documented).map((s) => s.note).join(' ')} ${addEvidence(l.evidence[0]?.documentName ?? '—', l.evidence[0]?.page ?? null, l.evidence[0]?.text ?? '')}`),
        ...analysis.handoverItems
          .filter((h) => h.type === 'Referral' || h.type === 'Follow-up')
          .map((h) => `${h.title} — ${h.description} ${addEvidence(h.sourceDocument, h.page, h.sourceExcerpt)}`),
      ].length
        ? [
            ...analysis.careLoops
              .filter((l) => (l.type === 'Referral' || l.type === 'Follow-up') && l.status === 'OPEN')
              .map((l) => `${l.name} — ${l.stages.filter((s) => !s.documented).map((s) => s.note).join(' ')} ${addEvidence(l.evidence[0]?.documentName ?? '—', l.evidence[0]?.page ?? null, l.evidence[0]?.text ?? '')}`),
            ...analysis.handoverItems
              .filter((h) => h.type === 'Referral' || h.type === 'Follow-up')
              .map((h) => `${h.title} — ${h.description} ${addEvidence(h.sourceDocument, h.page, h.sourceExcerpt)}`),
          ]
        : ['No outstanding referrals or follow-ups were found in the available record.'],
      evidence: [
        ...analysis.careLoops
          .filter((l) => (l.type === 'Referral' || l.type === 'Follow-up') && l.status === 'OPEN')
          .flatMap((l) => l.evidence.slice(0, 1).map((e) => ({ documentName: e.documentName, page: e.page, text: e.text }))),
        ...analysis.handoverItems
          .filter((h) => h.type === 'Referral' || h.type === 'Follow-up')
          .map((h) => ({ documentName: h.sourceDocument, page: h.page, text: h.sourceExcerpt })),
      ],
    });

    sections.push({
      heading: 'Documentation conflicts requiring review',
      lines: analysis.conflicts.length
        ? analysis.conflicts.map((c) => `${c.entity} (${c.field}): ${c.entries.map((e) => `${e.value}${e.date ? ` on ${formatDate(e.date)}` : ''}`).join(' / ')}. Requires review. ${addEvidence(c.entries[0]?.documentName ?? '—', c.entries[0]?.page ?? null, c.entries[0]?.text ?? '')}`)
        : ['No documentation conflicts were detected.'],
      evidence: analysis.conflicts.flatMap((c) => c.entries.filter((e) => e.page > 0).map((e) => ({ documentName: e.documentName, page: e.page, text: e.text }))),
    });

    sections.push({
      heading: 'Handover completeness checklist',
      lines: analysis.handoverSummary
        ? [
            `Overall review state: ${analysis.handoverSummary.overallReviewState}`,
            ...analysis.handoverItems.map((h) => {
              const status = h.reviewState === 'Clinician reviewed' ? '✓' : h.reviewState === 'Ready for clinician review' ? '⏳' : '○';
              return `${status} ${h.type}: ${h.title} — ${h.lastDocumentedStatus}${h.reviewDetail ? ` (Service: ${h.reviewDetail.accountableService ?? 'not entered'}, Follow-up: ${h.reviewDetail.plannedFollowUpDate ?? 'not entered'})` : ''}`;
            }),
          ]
        : ['Handover summary not available.'],
      evidence: [],
    });

    sections.push({
      heading: 'Information for receiving team',
      lines: [
        ...analysis.verifyNext,
        ...(analysis.conflicts.length ? ['Please confirm which documentation is current where the record conflicts.'] : []),
        'All outstanding items above should be verified before assuming care.',
      ],
      evidence: [],
    });
  }

  const plainText = renderPlainText(type, specialty, p.name, sections, evidenceIndex, analysis);

  return {
    type,
    specialty,
    title:
      type === 'ward' ? 'Ward round brief'
      : type === 'referral' ? `Referral brief — ${specialty ?? 'General Medicine'}`
      : type === 'discharge' ? 'Discharge summary with handover guard'
      : 'Discharge / handoff brief',
    generatedAt: new Date().toISOString(),
    sections,
    plainText,
    evidenceIndex,
    disclaimer: DISCLAIMER,
  };
}

function trim(s: string): string {
  const t = (s ?? '').replace(/…/g, '').replace(/\s+/g, ' ').trim();
  return t.length > 300 ? t.slice(0, 300) + '…' : t;
}

function renderPlainText(
  type: BriefType,
  specialty: string | null,
  name: string | null,
  sections: BriefSection[],
  evidenceIndex: Brief['evidenceIndex'],
  analysis: PatientAnalysis
): string {
  const head =
    type === 'ward' ? 'WARD ROUND BRIEF'
    : type === 'referral' ? `REFERRAL BRIEF — ${(specialty ?? 'General Medicine').toUpperCase()}`
    : type === 'discharge' ? 'DISCHARGE SUMMARY WITH HANDOVER GUARD'
    : 'DISCHARGE / HANDOFF BRIEF';
  const lines: string[] = [
    head,
    '='.repeat(head.length),
    `Patient: ${name ?? 'not documented'}`,
    `Documents analysed: ${analysis.documents.length} (${analysis.documents.map((d) => d.name).join(', ')})`,
    '',
  ];
  for (const s of sections) {
    lines.push(s.heading.toUpperCase());
    for (const l of s.lines) lines.push(`  ${l}`);
    lines.push('');
  }
  if (evidenceIndex.length) {
    lines.push('EVIDENCE INDEX');
    for (const e of evidenceIndex) {
      lines.push(`  ${e.ref} ${e.documentName}${e.page ? `, page ${e.page}` : ''}: "${e.text.replace(/\s+/g, ' ').trim().slice(0, 220)}"`);
    }
    lines.push('');
  }
  lines.push(DISCLAIMER);
  return lines.join('\n');
}

export function briefToMarkdown(brief: Brief): string {
  const out: string[] = [`# ${brief.title}`, ''];
  out.push(`_Generated ${new Date(brief.generatedAt).toLocaleString()} — grounded in ${brief.evidenceIndex.length} evidence reference(s)._`);
  out.push('');
  for (const s of brief.sections) {
    out.push(`## ${s.heading}`);
    for (const l of s.lines) out.push(`- ${l}`);
    out.push('');
  }
  if (brief.evidenceIndex.length) {
    out.push('## Evidence index');
    for (const e of brief.evidenceIndex) {
      out.push(`- **${e.ref}** ${e.documentName}${e.page ? `, page ${e.page}` : ''} — "${e.text.replace(/\s+/g, ' ').trim().slice(0, 200)}"`);
    }
    out.push('');
  }
  out.push(`> ${brief.disclaimer}`);
  return out.join('\n');
}