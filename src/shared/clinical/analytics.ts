/** Patient-level analytics derived only from the actual extracted record. */

import { PatientAnalysis } from './types.js';
import { formatDate } from './text.js';

export interface RecordAnalytics {
  totals: {
    documents: number;
    events: number;
    medications: number;
    medicationChanges: number;
    investigations: number;
    labs: number;
    vitals: number;
    referrals: number;
    followUps: number;
    findings: number;
    evidenceReferences: number;
  };
  eventsByType: Array<{ label: string; value: number }>;
  investigationsByStatus: Array<{ label: string; value: number }>;
  careLoopsByStatus: Array<{ label: string; value: number }>;
  eventsByMonth: Array<{ month: string; label: string; value: number }>;
  medicationTimeline: Array<{ medication: string; changes: number }>;
  labTable: Array<{ test: string; latest: string; date: string | null; unit: string | null; referenceRange: string | null; documentName: string; page: number }>;
  recentActivity: Array<{ date: string | null; label: string; kind: string }>;
  attentionBreakdown: Array<{ label: string; value: number }>;
}

export function computeAnalytics(analysis: PatientAnalysis): RecordAnalytics {
  const countBy = <T extends string>(values: T[]): Array<{ label: string; value: number }> => {
    const m = new Map<string, number>();
    for (const v of values) m.set(v, (m.get(v) ?? 0) + 1);
    return Array.from(m.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  };

  /* events per month */
  const monthMap = new Map<string, number>();
  for (const e of analysis.events) {
    if (!e.date) continue;
    const month = e.date.slice(0, 7);
    monthMap.set(month, (monthMap.get(month) ?? 0) + 1);
  }
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const eventsByMonth = Array.from(monthMap.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([month, value]) => {
      const [y, m] = month.split('-');
      return { month, label: `${monthNames[parseInt(m, 10) - 1]} ${y}`, value };
    });

  /* latest value per lab test */
  const labMap = new Map<string, PatientAnalysis['labs'][number]>();
  for (const l of analysis.labs) {
    const existing = labMap.get(l.test);
    if (!existing || (l.date ?? '') > (existing.date ?? '')) labMap.set(l.test, l);
  }

  const medChanges = new Map<string, number>();
  for (const c of analysis.medicationChanges) {
    medChanges.set(c.medicationName, (medChanges.get(c.medicationName) ?? 0) + 1);
  }

  const evidenceRefs = new Set<string>();
  for (const e of analysis.events) evidenceRefs.add(`${e.evidence.documentId}|${e.evidence.page}|${e.evidence.chunkIndex}`);
  for (const m of analysis.medications) evidenceRefs.add(`${m.evidence.documentId}|${m.evidence.page}|${m.evidence.chunkIndex}`);
  for (const i of analysis.investigations) for (const ev of i.evidence) evidenceRefs.add(`${ev.documentId}|${ev.page}|${ev.chunkIndex}`);

  const recentActivity = [
    ...analysis.events.map((e) => ({ date: e.date, label: e.title, kind: e.type })),
    ...analysis.medicationChanges.map((c) => ({ date: c.date, label: `${c.medicationName} ${c.kind.toLowerCase().replace(/_/g, ' ')}`, kind: 'Medication change' })),
    ...analysis.careLoops.map((l) => ({ date: l.lastMention, label: `${l.name} — ${l.status}`, kind: 'CareLoop' })),
    ...analysis.conflicts.map((c) => ({ date: c.entries.find((e) => e.date)?.date ?? null, label: `${c.entity} (${c.field})`, kind: 'Conflict' })),
  ]
    .sort((a, b) => ((b.date ?? '') > (a.date ?? '') ? 1 : -1))
    .slice(0, 12);

  return {
    totals: {
      documents: analysis.documents.length,
      events: analysis.events.length,
      medications: analysis.medications.length,
      medicationChanges: analysis.medicationChanges.length,
      investigations: analysis.investigations.length,
      labs: analysis.labs.length,
      vitals: analysis.vitals.length,
      referrals: analysis.referrals.length,
      followUps: analysis.followUps.length,
      findings: analysis.findings.length,
      evidenceReferences: evidenceRefs.size,
    },
    eventsByType: countBy(analysis.events.map((e) => e.type)),
    investigationsByStatus: countBy(analysis.investigations.map((i) => i.status.replace(/_/g, ' ').toLowerCase())),
    careLoopsByStatus: countBy(analysis.careLoops.map((l) => l.status)),
    eventsByMonth,
    medicationTimeline: Array.from(medChanges.entries())
      .map(([medication, changes]) => ({ medication, changes }))
      .sort((a, b) => b.changes - a.changes),
    labTable: Array.from(labMap.values()).map((l) => ({
      test: l.test,
      latest: `${l.value}${l.unit ? ` ${l.unit}` : ''}`,
      date: l.date,
      unit: l.unit,
      referenceRange: l.referenceRange,
      documentName: l.evidence.documentName,
      page: l.evidence.page,
    })),
    recentActivity: recentActivity.map((r) => ({ ...r, date: r.date ? formatDate(r.date) : null })),
    attentionBreakdown: countBy(analysis.attention.map((a) => a.kind)),
  };
}