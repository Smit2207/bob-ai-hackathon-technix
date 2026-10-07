/**
 * Record comparison — earlier snapshot vs later snapshot of the same patient.
 * Only actual differences are reported.
 */

import { PatientAnalysis } from './types.js';
import { formatDate } from './text.js';

export interface ComparisonRow {
  category: 'Clinical events' | 'Medications' | 'Medication changes' | 'Investigations' | 'Findings' | 'Open care loops' | 'Documentation conflicts';
  subject: string;
  earlier: string;
  later: string;
  difference: string;
  changed: boolean;
}

function key(v: string): string {
  return v.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function compareRecords(earlier: PatientAnalysis, later: PatientAnalysis): {
  rows: ComparisonRow[];
  summary: Record<ComparisonRow['category'], number>;
} {
  const rows: ComparisonRow[] = [];
  const push = (r: Omit<ComparisonRow, 'changed'>) => rows.push({ ...r, changed: true });

  /* Clinical events */
  const evMap = new Map<string, string[]>();
  for (const e of earlier.events) {
    const k = key(e.title);
    if (!evMap.has(k)) evMap.set(k, []);
    evMap.get(k)!.push(`${e.date ? formatDate(e.date) : 'undated'} — ${e.type}`);
  }
  for (const e of later.events) {
    const k = key(e.title);
    const before = evMap.get(k) ?? [];
    const label = `${e.date ? formatDate(e.date) : 'undated'} — ${e.type}`;
    if (!before.length) {
      push({
        category: 'Clinical events',
        subject: e.title,
        earlier: 'Not present',
        later: label,
        difference: 'New event in the later record',
      });
    } else if (!before.includes(label)) {
      push({
        category: 'Clinical events',
        subject: e.title,
        earlier: before.join('; '),
        later: label,
        difference: 'Additional dated occurrence',
      });
    }
    before.splice(before.indexOf(label), 1);
  }
  for (const [k, left] of evMap) {
    if (left.length) {
      const name = earlier.events.find((e) => key(e.title) === k)?.title ?? k;
      push({
        category: 'Clinical events',
        subject: name,
        earlier: left.join('; '),
        later: 'Not present',
        difference: 'Event present only in the earlier record',
      });
    }
  }

  /* Medications */
  const medMap = new Map<string, { earlier: string[]; later: string[] }>();
  const ensure = (name: string) => {
    const k = key(name);
    if (!medMap.has(k)) medMap.set(k, { earlier: [], later: [] });
    return medMap.get(k)!;
  };
  const describeMed = (m: PatientAnalysis['medications'][number]) =>
    `${m.dose ?? 'dose not documented'}${m.frequency ? ` ${m.frequency}` : ''}${m.route ? ` ${m.route}` : ''} — ${m.status.toLowerCase()}${m.startDate ? ` from ${formatDate(m.startDate)}` : ''}`;

  for (const m of earlier.medications) ensure(m.name).earlier.push(describeMed(m));
  for (const m of later.medications) ensure(m.name).later.push(describeMed(m));
  for (const [k, v] of medMap) {
    const a = Array.from(new Set(v.earlier)).join('; ') || 'Not present';
    const b = Array.from(new Set(v.later)).join('; ') || 'Not present';
    if (a === b) continue;
    const name = later.medications.find((m) => key(m.name) === k)?.name ?? earlier.medications.find((m) => key(m.name) === k)?.name ?? k;
    push({
      category: 'Medications',
      subject: name,
      earlier: a,
      later: b,
      difference: a === 'Not present' ? 'Medication added' : b === 'Not present' ? 'Medication no longer documented' : 'Medication record differs',
    });
  }

  /* Medication changes */
  const chgMap = new Map<string, string[]>();
  for (const c of [...earlier.medicationChanges, ...later.medicationChanges]) {
    const k = `${key(c.medicationName)}|${c.kind}|${c.newDose ?? ''}`;
    if (!chgMap.has(k)) chgMap.set(k, []);
    chgMap.get(k)!.push(c.date ? formatDate(c.date) : 'undated');
  }
  const earlierChgKeys = new Set(earlier.medicationChanges.map((c) => `${key(c.medicationName)}|${c.kind}|${c.newDose ?? ''}`));
  const laterChgKeys = new Set(later.medicationChanges.map((c) => `${key(c.medicationName)}|${c.kind}|${c.newDose ?? ''}`));
  for (const [k, dates] of chgMap) {
    const inEarlier = earlierChgKeys.has(k);
    const inLater = laterChgKeys.has(k);
    if (inEarlier && inLater) continue;
    const parts = k.split('|');
    const c = [...later.medicationChanges, ...earlier.medicationChanges].find(
      (x) => `${key(x.medicationName)}|${x.kind}|${x.newDose ?? ''}` === k
    );
    push({
      category: 'Medication changes',
      subject: c?.medicationName ?? parts[0],
      earlier: inEarlier ? dates.join('; ') : 'Not present',
      later: inLater ? dates.join('; ') : 'Not present',
      difference: inLater ? 'New medication change in the later record' : 'Change present only in the earlier record',
    });
  }

  /* Investigations */
  const invMap = new Map<string, { earlier: string[]; later: string[] }>();
  const ensureInv = (n: string) => {
    const k = key(n);
    if (!invMap.has(k)) invMap.set(k, { earlier: [], later: [] });
    return invMap.get(k)!;
  };
  const describeInv = (i: PatientAnalysis['investigations'][number]) =>
    `${i.status.replace(/_/g, ' ').toLowerCase()}${i.orderedDate ? `, ordered ${formatDate(i.orderedDate)}` : ''}${i.performedDate ? `, performed ${formatDate(i.performedDate)}` : ''}${i.result ? `, result: ${i.result}` : ''}`;

  for (const i of earlier.investigations) ensureInv(i.name).earlier.push(describeInv(i));
  for (const i of later.investigations) ensureInv(i.name).later.push(describeInv(i));
  for (const [k, v] of invMap) {
    const a = Array.from(new Set(v.earlier)).join('; ') || 'Not present';
    const b = Array.from(new Set(v.later)).join('; ') || 'Not present';
    if (a === b) continue;
    const name = later.investigations.find((i) => key(i.name) === k)?.name ?? earlier.investigations.find((i) => key(i.name) === k)?.name ?? k;
    push({
      category: 'Investigations',
      subject: name,
      earlier: a,
      later: b,
      difference: a === 'Not present' ? 'Investigation added' : b === 'Not present' ? 'Investigation no longer documented' : 'Investigation status or result differs',
    });
  }

  /* Findings */
  const fndEarlier = new Set(earlier.findings.map((f) => key(f.finding)));
  for (const f of later.findings) {
    if (!fndEarlier.has(key(f.finding))) {
      push({
        category: 'Findings',
        subject: f.finding.slice(0, 90),
        earlier: 'Not present',
        later: f.date ? formatDate(f.date) : 'undated',
        difference: 'New documented finding',
      });
    }
  }
  const fndLater = new Set(later.findings.map((f) => key(f.finding)));
  for (const f of earlier.findings) {
    if (!fndLater.has(key(f.finding))) {
      push({
        category: 'Findings',
        subject: f.finding.slice(0, 90),
        earlier: f.date ? formatDate(f.date) : 'undated',
        later: 'Not present',
        difference: 'Finding present only in the earlier record',
      });
    }
  }

  /* Care loops */
  const loopMap = new Map<string, { earlier: string[]; later: string[] }>();
  const ensureLoop = (n: string) => {
    const k = key(n);
    if (!loopMap.has(k)) loopMap.set(k, { earlier: [], later: [] });
    return loopMap.get(k)!;
  };
  for (const l of earlier.careLoops) ensureLoop(l.name).earlier.push(l.status);
  for (const l of later.careLoops) ensureLoop(l.name).later.push(l.status);
  for (const [k, v] of loopMap) {
    const a = Array.from(new Set(v.earlier)).join('; ') || 'Not present';
    const b = Array.from(new Set(v.later)).join('; ') || 'Not present';
    if (a === b) continue;
    const name = later.careLoops.find((l) => key(l.name) === k)?.name ?? earlier.careLoops.find((l) => key(l.name) === k)?.name ?? k;
    const becameResolved = a.toLowerCase().includes('open') && b.toLowerCase().includes('resolved');
    push({
      category: 'Open care loops',
      subject: name,
      earlier: a,
      later: b,
      difference: becameResolved
        ? 'Care loop moved toward RESOLVED'
        : a === 'Not present'
        ? 'Care loop appeared in the later record'
        : b === 'Not present'
        ? 'Care loop no longer detected'
        : 'Care loop status differs',
    });
  }

  /* Conflicts */
  const confEarlier = new Map(earlier.conflicts.map((c) => [`${key(c.entity)}|${key(c.field)}`, c]));
  const confLater = new Map(later.conflicts.map((c) => [`${key(c.entity)}|${key(c.field)}`, c]));
  for (const [k, c] of confLater) {
    if (!confEarlier.has(k)) {
      push({
        category: 'Documentation conflicts',
        subject: `${c.entity} (${c.field})`,
        earlier: 'Not present',
        later: c.entries.map((e) => e.value).join(' vs '),
        difference: 'New documentation conflict',
      });
    }
  }
  for (const [k, c] of confEarlier) {
    if (!confLater.has(k)) {
      push({
        category: 'Documentation conflicts',
        subject: `${c.entity} (${c.field})`,
        earlier: c.entries.map((e) => e.value).join(' vs '),
        later: 'Not present',
        difference: 'Conflict no longer detected',
      });
    }
  }

  const summary: Record<ComparisonRow['category'], number> = {
    'Clinical events': 0,
    Medications: 0,
    'Medication changes': 0,
    Investigations: 0,
    Findings: 0,
    'Open care loops': 0,
    'Documentation conflicts': 0,
  };
  for (const r of rows) summary[r.category] += 1;

  return { rows, summary };
}