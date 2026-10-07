/**
 * Temporal engine: medication change detection, ChangeMap, CareLoop,
 * Documentation Drift and the Attention layer.
 *
 * All engines are pure functions over extracted records so they can run in the
 * browser (Demo Mode) or on the server (Live Mode) with identical results.
 */

import {
  AttentionItem,
  CareLoop,
  ChangeMapItem,
  ClinicalEvent,
  ClinicalFinding,
  ConflictEntry,
  DeltaSummary,
  DocumentationConflict,
  Evidence,
  FollowUp,
  Investigation,
  Medication,
  MedicationChange,
  PatientAnalysis,
  Referral,
  SourceDocument,
} from './types.js';
import { dateSortKey, formatDate, sentences } from './text.js';

/* ------------------------------------------------------------------ *
 * Medication changes
 * ------------------------------------------------------------------ */

function doseNumber(dose: string | null): number | null {
  if (!dose) return null;
  const m = dose.match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
}

function normaliseMedName(name: string): string {
  return name.toLowerCase().replace(/[^a-z]/g, '');
}

export function buildMedicationChanges(medications: Medication[]): MedicationChange[] {
  const groups = new Map<string, Medication[]>();
  for (const m of medications) {
    const k = normaliseMedName(m.name);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(m);
  }

  const changes: MedicationChange[] = [];

  for (const [key, list] of groups) {
    const sorted = [...list].sort((a, b) => dateSortKey(a.startDate) - dateSortKey(b.startDate));
    const displayName = sorted[0].name;

    /* Build a dose timeline keyed on the FIRST date each distinct dose appears,
       so a later repeat of an older dose cannot invert the direction of change.
       Entries without a dose (e.g. a documented stop) are excluded here. */
    const firstSeen = new Map<string, { dose: string; frequency: string | null; med: Medication; at: number }>();
    for (const m of sorted) {
      if (!m.dose) continue;
      const dk = m.dose;
      if (!firstSeen.has(dk)) {
        firstSeen.set(dk, { dose: dk, frequency: m.frequency, med: m, at: dateSortKey(m.startDate) });
      }
    }
    const timeline = Array.from(firstSeen.values())
      .filter((d) => Number.isFinite(d.at))
      .sort((a, b) => a.at - b.at);

    if (timeline.length > 1) {
      for (let i = 1; i < timeline.length; i++) {
        const prev = timeline[i - 1];
        const curr = timeline[i];
        const prevNum = doseNumber(prev.dose);
        const currNum = doseNumber(curr.dose);
        if (prevNum === null && currNum === null) continue;
        const freqChanged = (prev.frequency ?? '') !== (curr.frequency ?? '');
        let kind: MedicationChange['kind'];
        if (freqChanged && prevNum === currNum) kind = 'FREQUENCY_CHANGED';
        else if (currNum !== null && prevNum !== null && currNum > prevNum) kind = 'DOSE_INCREASED';
        else kind = 'DOSE_DECREASED';
        changes.push({
          id: `chg_${key}_${i}`,
          medicationName: displayName,
          kind,
          previousDose: prev.dose || null,
          newDose: curr.dose || null,
          previousFrequency: prev.frequency,
          newFrequency: curr.frequency,
          date: curr.med.startDate,
          documentedReason: curr.med.documentedReason,
          evidence: [prev.med.evidence, curr.med.evidence],
        });
      }
    }

    /* Status transitions */
    const stopped = sorted.filter((m) => m.status !== 'ACTIVE');
    if (stopped.length && timeline.length) {
      const lastStop = stopped[stopped.length - 1];
      changes.push({
        id: `chg_${key}_stop`,
        medicationName: displayName,
        kind: 'STOPPED',
        previousDose: lastStop.dose,
        newDose: null,
        previousFrequency: lastStop.frequency,
        newFrequency: null,
        date: lastStop.stopDate ?? lastStop.startDate,
        documentedReason: lastStop.documentedReason,
        evidence: [lastStop.evidence],
      });
    }

    const first = sorted[0];
    // A STARTED entry is emitted unless something else already tells the story.
    // Re-prescribing the same dose in a later letter is documentation, not a
    // change, so only a dose timeline or a stop suppresses it.
    if (!stopped.length && timeline.length <= 1) {
      changes.push({
        id: `chg_${key}_start`,
        medicationName: displayName,
        kind: 'STARTED',
        previousDose: null,
        newDose: first.dose,
        previousFrequency: null,
        newFrequency: first.frequency,
        date: first.startDate,
        documentedReason: first.documentedReason,
        evidence: [first.evidence],
      });
    }
  }

  return changes.sort((a, b) => dateSortKey(b.date) - dateSortKey(a.date));
}

/* ------------------------------------------------------------------ *
 * CareLoop engine
 * ------------------------------------------------------------------ */

function latestBy<T extends { evidence: Evidence[] }>(items: T[]): Evidence | null {
  if (!items.length) return null;
  return items[items.length - 1].evidence[0] ?? null;
}

function allEvidence<T extends { evidence: Evidence[] }>(items: T[]): Evidence[] {
  return items.flatMap((i) => i.evidence);
}

export function buildCareLoops(
  investigations: Investigation[],
  referrals: Referral[],
  followUps: FollowUp[],
  events: ClinicalEvent[]
): CareLoop[] {
  const loops: CareLoop[] = [];

  /* ---- Investigations: ORDERED -> COMPLETED -> RESULT -> REVIEW ---- */
  const invGroups = new Map<string, Investigation[]>();
  for (const inv of investigations) {
    if (!invGroups.has(inv.name)) invGroups.set(inv.name, []);
    invGroups.get(inv.name)!.push(inv);
  }

  for (const [name, list] of invGroups) {
    const sorted = [...list].sort((a, b) => dateSortKey(a.orderedDate ?? a.performedDate) - dateSortKey(b.orderedDate ?? b.performedDate));
    const hasResult = sorted.some((i) => i.status === 'RESULT_AVAILABLE' || (i.result && i.result.length > 3));
    const hasCompletion = sorted.some((i) => i.status === 'COMPLETED' || i.status === 'RESULT_AVAILABLE' || i.performedDate);
    const ordered = sorted.find((i) => i.orderedDate) ?? sorted[0];
    const resultEntry = [...sorted].reverse().find((i) => i.result);
    const completion = [...sorted].reverse().find((i) => i.performedDate);

    const reviewEvent = events.find(
      (e) => e.type === 'Finding' && new RegExp(name.split(' ')[0], 'i').test(e.description)
    );
    const documentedReview = sorted.some((i) => i.finding) || !!reviewEvent;

    const orderedDate = ordered?.orderedDate ?? sorted[0].orderedDate ?? null;
    const completedDate = completion?.performedDate ?? null;
    const lastMention = [...sorted]
      .map((i) => i.orderedDate ?? i.performedDate)
      .filter(Boolean)
      .sort()
      .pop() ?? null;

    let status: CareLoop['status'];
    if (hasResult) status = 'RESOLVED';
    else if (hasCompletion) status = 'PARTIAL';
    else status = 'OPEN';

    const evidence = allEvidence(sorted);

    loops.push({
      id: `loop_inv_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
      type: 'Investigation',
      name,
      status,
      orderedDate,
      completedDate,
      result: resultEntry?.result ?? null,
      lastMention,
      stages: [
        { stage: 'Ordered', documented: !!orderedDate, date: orderedDate, note: orderedDate ? `Ordered ${formatDate(orderedDate)}` : 'No order documented' },
        { stage: 'Completed', documented: hasCompletion, date: completedDate, note: hasCompletion ? `Completion documented ${formatDate(completedDate)}` : 'No completion report was found in the available record.' },
        { stage: 'Result', documented: hasResult, date: resultEntry?.performedDate ?? null, note: hasResult ? (resultEntry?.result ?? 'Result documented') : 'Not found in the available record.' },
        { stage: 'Review', documented: documentedReview, date: null, note: documentedReview ? 'Review or finding documented' : 'No review documented in the available record.' },
      ],
      evidence,
    });
  }

  /* ---- Referrals: REFERRAL -> APPOINTMENT -> OUTCOME ---- */
  const refGroups = new Map<string, Referral[]>();
  for (const r of referrals) {
    if (!refGroups.has(r.specialty)) refGroups.set(r.specialty, []);
    refGroups.get(r.specialty)!.push(r);
  }
  for (const [specialty, list] of refGroups) {
    const sorted = [...list].sort((a, b) => dateSortKey(a.date) - dateSortKey(b.date));
    const hasOutcome = sorted.some((r) => r.outcome);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    loops.push({
      id: `loop_ref_${specialty.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
      type: 'Referral',
      name: `Referral to ${specialty}`,
      status: hasOutcome ? 'RESOLVED' : 'OPEN',
      orderedDate: first.date,
      completedDate: hasOutcome ? last.date : null,
      result: hasOutcome ? (sorted.find((r) => r.outcome)?.outcome ?? null) : null,
      lastMention: last.date,
      stages: [
        { stage: 'Referral made', documented: !!first.date, date: first.date, note: first.date ? `Referral documented ${formatDate(first.date)}` : 'Referral date not documented' },
        { stage: 'Appointment', documented: sorted.some((r) => /appointment|attended|seen/i.test(r.outcome ?? '')), date: null, note: sorted.some((r) => /appointment|attended|seen/i.test(r.outcome ?? '')) ? 'Appointment activity documented' : 'No appointment documentation found in the available record.' },
        { stage: 'Specialist outcome', documented: hasOutcome, date: hasOutcome ? last.date : null, note: hasOutcome ? (sorted.find((r) => r.outcome)?.outcome ?? '') : 'No specialist outcome was found in the available record.' },
      ],
      evidence: allEvidence(sorted),
    });
  }

  /* ---- Follow-ups: RECOMMENDED -> FOLLOW-UP DOCUMENTED ---- */
  for (const fu of followUps) {
    loops.push({
      id: `loop_fu_${fu.id}`,
      type: 'Follow-up',
      name: fu.description.slice(0, 80),
      status: fu.actualDate ? 'RESOLVED' : 'OPEN',
      orderedDate: fu.recommendedDate,
      completedDate: fu.actualDate,
      result: fu.outcome,
      lastMention: fu.actualDate ?? fu.recommendedDate,
      stages: [
        { stage: 'Recommended', documented: true, date: fu.recommendedDate, note: fu.recommendedDate ? `Recommended for ${formatDate(fu.recommendedDate)}` : 'Recommendation documented without a date' },
        { stage: 'Follow-up documented', documented: !!fu.actualDate, date: fu.actualDate, note: fu.actualDate ? `Follow-up documented ${formatDate(fu.actualDate)}` : 'No follow-up documentation was found in the available record.' },
      ],
      evidence: fu.evidence,
    });
  }

  /* ---- Procedures: PLANNED -> PERFORMED -> RESULT -> FOLLOW-UP ---- */
  const procedureEvents = events.filter((e) => e.type === 'Procedure');
  const procSeen = new Set<string>();
  for (const pe of procedureEvents) {
    const desc = pe.description ?? '';
    const performed = /\b(performed|underwent|carried out|completed|inserted|implanted|done|repeat(?:ed)? \w+ (?:on|at))\b/i.test(desc);
    const planned = /\b(plan(?:ned)?|proposed|listed|due|booked|arranged|intended|recommend(?:ed)?|offered|to be (?:performed|undertaken)|request(?:ed)?)\b/i.test(desc);
    if (!performed && !planned) continue;
    const name = pe.title.replace(/^Procedure:\s*/i, '').slice(0, 80);
    const key = name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (procSeen.has(key)) continue;
    // A procedure already tracked as an investigation must not open a second,
    // redundant loop: "Catheterisation" is the same task as "Cardiac catheterisation".
    const redundant = loops.some((l) => {
      const other = l.name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      return other.includes(key) || key.includes(other);
    });
    if (redundant) continue;
    procSeen.add(key);
    const resultEv = events.find(
      (e) => e.type === 'Finding' && e.description.toLowerCase().includes(key.split(' ')[0] ?? '###')
    );
    loops.push({
      id: `loop_proc_${pe.id}`,
      type: 'Procedure',
      name,
      status: resultEv ? 'RESOLVED' : performed ? 'PARTIAL' : 'OPEN',
      orderedDate: pe.date,
      completedDate: performed ? pe.date : null,
      result: resultEv ? resultEv.description.slice(0, 160) : null,
      lastMention: pe.date,
      stages: [
        { stage: 'Planned / documented', documented: true, date: pe.date, note: pe.date ? `Documented ${formatDate(pe.date)}` : 'Date not documented' },
        { stage: 'Performed', documented: performed, date: performed ? pe.date : null, note: performed ? 'Performance documented' : 'No completion report was found in the available record.' },
        { stage: 'Result', documented: !!resultEv, date: resultEv?.date ?? null, note: resultEv ? resultEv.description.slice(0, 140) : 'Not found in the available record.' },
      ],
      evidence: [pe.evidence, ...(resultEv ? [resultEv.evidence] : [])],
    });
  }

  return loops;
}

/* ------------------------------------------------------------------ *
 * Documentation Drift
 * ------------------------------------------------------------------ */

/**
 * Language that documents a dose change as intentional. A dose
 * difference the record itself explains ("increased from the
 * previous 20 mg dose") is a change, not documentation drift.
 */
const CHANGE_DOCUMENTED =
  /\b(?:increased|decreased|reduced|changed|titrated|uptitrated|downtitrated|switched|restarted|resumed|recommenced|previous dose|from the previous)\b/i;

export function buildConflicts(
  medications: Medication[],
  fullText: string,
  vitals: Array<{ type: string; value: string; date: string | null; evidence: Evidence }>,
  events: ClinicalEvent[]
): DocumentationConflict[] {
  const conflicts: DocumentationConflict[] = [];

  /* ---- Medication dose / frequency drift ---- */
  const medGroups = new Map<string, Medication[]>();
  for (const m of medications) {
    const k = normaliseMedName(m.name);
    if (!medGroups.has(k)) medGroups.set(k, []);
    medGroups.get(k)!.push(m);
  }
  for (const [key, list] of medGroups) {
    const doses = new Set(list.map((m) => m.dose).filter(Boolean) as string[]);
    const freqs = new Set(list.map((m) => m.frequency).filter(Boolean) as string[]);
    if (doses.size > 1) {
      const sorted = list
        .slice()
        .sort((a, b) => dateSortKey(a.startDate) - dateSortKey(b.startDate));
      /* Drift is only flagged when at least one transition between
         doses carries no documented explanation in the entry that
         records the new dose. */
      const unexplained = sorted.some((m, i) => i > 0 && !CHANGE_DOCUMENTED.test(m.evidence.text));
      if (unexplained) {
        const entries: ConflictEntry[] = sorted.map((m) => ({
          value: `${m.dose ?? 'Dose not documented'}${m.frequency ? ` — ${m.frequency}` : ''}`,
          date: m.startDate,
          documentName: m.evidence.documentName,
          page: m.evidence.page,
          text: m.evidence.text,
        }));
        conflicts.push({
          id: `drift_med_${key}`,
          field: 'Medication dose',
          entity: list[0].name,
          status: 'Requires review',
          entries,
          interpretation: `${list[0].name} is documented with ${doses.size} different doses across the available record. MedBrief does not decide which is clinically correct.`,
        });
      }
    } else if (freqs.size > 1) {
      const entries: ConflictEntry[] = list.map((m) => ({
        value: m.frequency ?? 'Frequency not documented',
        date: m.startDate,
        documentName: m.evidence.documentName,
        page: m.evidence.page,
        text: m.evidence.text,
      }));
      conflicts.push({
        id: `drift_medfreq_${key}`,
        field: 'Medication frequency',
        entity: list[0].name,
        status: 'Requires review',
        entries,
        interpretation: `${list[0].name} is documented with ${freqs.size} different frequencies.`,
      });
    }
  }

  /* ---- Allergy drift ---- */
  const noAllergy = fullText.match(/\bno\s+known\s+allergies\b|\bno\s+known\s+drug\s+allergies\b|\bNKDA\b|\ballergies?\s*[:\-]\s*(?:nil|none|unknown)\b/gi);
  const someAllergy = [
    ...fullText.matchAll(/\ballergic\s+to\s+([A-Za-z][A-Za-z\s-]{2,40})/gi),
    ...fullText.matchAll(/\ballerg(?:y|ies)\s*[:\-]\s*(?!nil\b|none\b|unknown\b|unclear\b)([A-Za-z][A-Za-z\s-]{2,40})/gi),
  ].filter((m) => !/^(?:nil|none|unknown|unclear|and|or|to|of|status|not known|no)\b/i.test(m[1].trim()));
  if (noAllergy && someAllergy.length) {
    const agents = Array.from(new Set(someAllergy.map((m) => cleanAgent(m[1]))));
    const entries: ConflictEntry[] = [];
    entries.push({
      value: 'No known allergies',
      date: null,
      documentName: '—',
      page: 0,
      text: noAllergy[0],
    });
    for (const a of someAllergy) {
      entries.push({
        value: `Allergy to ${cleanAgent(a[1])}`,
        date: null,
        documentName: '—',
        page: 0,
        text: a[0],
      });
    }
    conflicts.push({
      id: 'drift_allergy',
      field: 'Allergy status',
      entity: 'Allergies',
      status: 'Requires review',
      entries,
      interpretation: `The record both states no known allergies and documents an allergy (${agents.join(', ')}). This requires clinical verification.`,
    });
  } else if (someAllergy.length) {
    const agents = Array.from(new Set(someAllergy.map((m) => cleanAgent(m[1]))));
    if (agents.length > 1) {
      conflicts.push({
        id: 'drift_allergy_multi',
        field: 'Allergy status',
        entity: 'Allergies',
        status: 'Requires review',
        entries: agents.map((a) => ({ value: `Allergy to ${a}`, date: null, documentName: '—', page: 0, text: `Allergy to ${a}` })),
        interpretation: `Multiple different allergies are documented: ${agents.join(', ')}.`,
      });
    }
  }

  /* ---- Smoking status drift ---- */
  const smoking = [...fullText.matchAll(/\b(smok(?:e|es|ed|ing|er|ers)|non-smoker|non smoker|ex-smoker|ex smoker|former smoker|current smoker|never smoked|never-smoker)\b/gi)];
  /* Each mention is classified from the sentence that contains it,
     so a status documented in one document cannot colour a mention
     in another document that happens to sit nearby in the text. */
  const smokingSentences = sentences(fullText);
  const statuses = new Map<string, RegExpMatchArray>();
  for (const m of smoking) {
    const sent = smokingSentences.find((s) => m.index !== undefined && m.index >= s.start && m.index <= s.end);
    const ctx = (sent ? sent.text : fullText.slice(Math.max(0, m.index ?? 0), (m.index ?? 0) + 80)).toLowerCase();
    let label: string | null = null;
    if (/\bnever smok|\bnever-smok|non-smoker|non smoker|does not smoke|lifelong non|never smoked\b/.test(ctx)) label = 'Never smoker';
    else if (/\bex-smoker|ex smoker|former smoker|previously smoked|gave up|stopped smoking|cessation|quit smoking\b/.test(ctx)) label = 'Ex-smoker';
    else if (/\bcurrent(?:ly)? smok|\bsmoker\b|\bsmokes\b|\bsmoke\b|pack-year|pack year|cigarettes?\s*(?:per|a)\s*(?:day|week)/.test(ctx)) label = 'Current smoker';
    if (label) statuses.set(label, m);
  }
  if (statuses.size > 1) {
    conflicts.push({
      id: 'drift_smoking',
      field: 'Smoking status',
      entity: 'Smoking status',
      status: 'Requires review',
      entries: Array.from(statuses.entries())
        .sort((a, b) => (a[1].index ?? 0) - (b[1].index ?? 0))
        .map(([label, m]) => ({ value: label, date: null, documentName: '—', page: 0, text: m[0] })),
      interpretation: 'Smoking status is documented inconsistently across the available record.',
    });
  }

  /* ---- Documented diagnosis drift ---- */
  const dxEvents = events.filter((e) => e.type === 'Diagnosis');
  const dxMap = new Map<string, RegExpMatchArray>();
  for (const m of fullText.matchAll(/\b(diagnos(?:is|ed)\s+(?:of|with)\s+)([a-z][a-z\s\-,\(\)]{3,60})/gi)) {
    const body = m[2].trim().replace(/[.,;]$/, '').toLowerCase();
    if (body.length < 4) continue;
    if (!dxMap.has(body)) dxMap.set(body, m);
  }
  const distinctDx = Array.from(dxMap.entries());
  if (distinctDx.length > 1) {
    const sameFamily = distinctDx.filter(([body]) => /hypertension|diabet|copd|asthma|heart failure|renal|ckd|atrial fibrillation|af\b/.test(body));
    const drifting = sameFamily.length > 1 ? sameFamily : distinctDx;
    if (drifting.length > 1) {
      conflicts.push({
        id: 'drift_diagnosis',
        field: 'Documented diagnosis',
        entity: 'Diagnoses',
        status: 'Requires review',
        entries: drifting.map(([body, m]) => ({ value: body.replace(/\b\w/g, (c) => c.toUpperCase()), date: null, documentName: '—', page: 0, text: m[0] })),
        interpretation: 'Different diagnoses are documented across the record. This may reflect genuine change, or documentation inconsistency — it requires review.',
      });
    }
  }
  void dxEvents;

  /* ---- Vital / measurement drift on the same test ---- */
  const vitalGroups = new Map<string, typeof vitals>();
  for (const v of vitals) {
    if (!vitalGroups.has(v.type)) vitalGroups.set(v.type, []);
    vitalGroups.get(v.type)!.push(v);
  }
  for (const [type, list] of vitalGroups) {
    if (type !== 'Blood pressure' && type !== 'Weight') continue;
    const values = new Set(list.map((v) => v.value));
    if (values.size > 1 && list.length >= 2) {
      const sorted = [...list].sort((a, b) => dateSortKey(a.date) - dateSortKey(b.date));
      // Weight and BP legitimately vary; only flag a documented contradiction.
      const contradiction = sorted.some((v) => {
        if (type === 'Weight') return false;
        const [sys] = v.value.split('/');
        return parseInt(sys, 10) < 70;
      });
      if (!contradiction) continue;
      conflicts.push({
        id: `drift_vital_${type.toLowerCase().replace(/\s+/g, '_')}`,
        field: type,
        entity: type,
        status: 'Requires review',
        entries: sorted.map((v) => ({ value: v.value, date: v.date, documentName: v.evidence.documentName, page: v.evidence.page, text: v.evidence.text })),
        interpretation: `${type} values documented in the record may be inconsistent.`,
      });
    }
  }

  return conflicts;
}

/* ------------------------------------------------------------------ *
 * ChangeMap
 * ------------------------------------------------------------------ */

export function buildChangeMap(
  medicationChanges: MedicationChange[],
  investigations: Investigation[],
  events: ClinicalEvent[],
  findings: ClinicalFinding[],
  careLoops: CareLoop[],
  conflicts: DocumentationConflict[]
): ChangeMapItem[] {
  const items: ChangeMapItem[] = [];

  for (const c of medicationChanges) {
    let classification: ChangeMapItem['classification'] = 'CHANGED';
    if (c.kind === 'STARTED') classification = 'NEW';
    else if (c.kind === 'STOPPED') classification = 'RESOLVED';
    const conflict = conflicts.find((d) => d.entity.toLowerCase() === c.medicationName.toLowerCase());
    if (conflict) classification = 'CONFLICTING';
    const summary =
      c.kind === 'DOSE_INCREASED' || c.kind === 'DOSE_DECREASED' || c.kind === 'FREQUENCY_CHANGED'
        ? `${c.medicationName} ${c.previousDose ?? 'dose not documented'} → ${c.newDose ?? 'dose not documented'}${
            c.newFrequency ? ` (${c.newFrequency})` : ''
          }`
        : c.kind === 'STARTED'
        ? `${c.medicationName} started at ${c.newDose ?? 'dose not documented'}`
        : c.kind === 'STOPPED'
        ? `${c.medicationName} stopped (was ${c.previousDose ?? 'dose not documented'})`
        : `${c.medicationName} ${c.kind.toLowerCase().replace(/_/g, ' ')}`;
    items.push({
      id: `cm_${c.id}`,
      entity: c.medicationName,
      entityType: 'Medication',
      classification,
      summary,
      date: c.date,
      evidence: c.evidence,
    });
  }

  const invGroups = new Map<string, Investigation[]>();
  for (const inv of investigations) {
    if (!invGroups.has(inv.name)) invGroups.set(inv.name, []);
    invGroups.get(inv.name)!.push(inv);
  }
  for (const [name, list] of invGroups) {
    const loop = careLoops.find((l) => l.type === 'Investigation' && l.name === name);
    const sorted = [...list].sort((a, b) => dateSortKey(a.orderedDate ?? a.performedDate) - dateSortKey(b.orderedDate ?? b.performedDate));
    const first = sorted[0];
    let classification: ChangeMapItem['classification'];
    let summary: string;
    if (loop?.status === 'RESOLVED') {
      classification = 'RESOLVED';
      summary = `${name}: result documented${loop.result ? ` — ${loop.result}` : ''}`;
    } else if (loop?.status === 'OPEN') {
      classification = 'OPEN';
      summary = `${name}: ordered, no completion report found in the available record`;
    } else if (list.length > 1) {
      classification = 'CHANGED';
      summary = `${name}: ${sorted[0].status.replace(/_/g, ' ').toLowerCase()} → ${sorted[sorted.length - 1].status.replace(/_/g, ' ').toLowerCase()}`;
    } else {
      classification = first.status === 'ORDERED' || first.status === 'PENDING' ? 'OPEN' : 'NEW';
      summary = `${name}: ${first.status.replace(/_/g, ' ').toLowerCase()}`;
    }
    items.push({
      id: `cm_inv_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
      entity: name,
      entityType: 'Investigation',
      classification,
      summary,
      date: loop?.lastMention ?? first.orderedDate ?? first.performedDate,
      evidence: list.flatMap((i) => i.evidence),
    });
  }

  const seenEventTitles = new Set<string>();
  for (const e of events) {
    const key = e.title.toLowerCase();
    if (seenEventTitles.has(key)) continue;
    seenEventTitles.add(key);
    if (/Medication/i.test(e.title)) continue;
    items.push({
      id: `cm_evt_${e.id}`,
      entity: e.title.slice(0, 70),
      entityType: 'Event',
      classification: 'NEW',
      summary: e.description.slice(0, 200),
      date: e.date,
      evidence: [e.evidence],
    });
  }

  for (const f of findings) {
    items.push({
      id: `cm_fnd_${f.id}`,
      entity: f.finding.slice(0, 70),
      entityType: 'Finding',
      classification: 'NEW',
      summary: f.finding,
      date: f.date,
      evidence: [f.evidence],
    });
  }

  for (const l of careLoops.filter((x) => x.type === 'Referral' || x.type === 'Follow-up')) {
    items.push({
      id: `cm_loop_${l.id}`,
      entity: l.name.slice(0, 70),
      entityType: l.type === 'Referral' ? 'Referral' : 'Follow-up',
      classification: l.status === 'OPEN' ? 'OPEN' : l.status === 'RESOLVED' ? 'RESOLVED' : 'CHANGED',
      summary: `${l.name}: ${l.status.toLowerCase()}`,
      date: l.lastMention,
      evidence: l.evidence,
    });
  }

  return items.sort((a, b) => dateSortKey(b.date) - dateSortKey(a.date));
}

/* ------------------------------------------------------------------ *
 * Attention Engine
 * ------------------------------------------------------------------ */

export function buildAttention(
  changeMap: ChangeMapItem[],
  careLoops: CareLoop[],
  conflicts: DocumentationConflict[],
  investigations: Investigation[]
): AttentionItem[] {
  const items: AttentionItem[] = [];

  for (const l of careLoops.filter((c) => c.status === 'OPEN')) {
    const missing = l.stages.filter((s) => !s.documented).map((s) => s.stage);
    items.push({
      id: `att_${l.id}`,
      kind: 'Open Care Loop',
      title: l.name,
      whySurfaced: `A ${l.type.toLowerCase()} workflow began in the record but the chain appears incomplete. ${
        missing.length ? `No documentation was found for: ${missing.join(', ')}.` : 'The chain is incomplete.'
      } MedBrief reports only that documentation was not found — it does not conclude that care was not delivered.`,
      dates: [l.orderedDate, l.completedDate, l.lastMention].filter(Boolean) as string[],
      evidence: l.evidence,
      target: { view: 'careloop', id: l.id },
    });
  }

  for (const c of conflicts) {
    items.push({
      id: `att_${c.id}`,
      kind: 'Documentation Conflict',
      title: `${c.entity} — ${c.field}`,
      whySurfaced: c.interpretation,
      dates: Array.from(new Set(c.entries.map((e) => e.date).filter(Boolean) as string[])),
      evidence: c.entries
        .filter((e) => e.page > 0)
        .map((e) => ({
          documentId: '',
          documentName: e.documentName,
          page: e.page,
          chunkIndex: 0,
          field: c.field,
          text: e.text,
        })),
      target: { view: 'drift', id: c.id },
    });
  }

  for (const m of changeMap.filter((c) => c.classification === 'CHANGED' && c.entityType === 'Medication')) {
    items.push({
      id: `att_${m.id}`,
      kind: 'Medication Change',
      title: m.entity,
      whySurfaced: `Documented dose or frequency change: ${m.summary}`,
      dates: m.date ? [m.date] : [],
      evidence: m.evidence,
      target: { view: 'changemap', id: m.id },
    });
  }

  const resultNames = new Set(
    investigations.filter((i) => i.status === 'RESULT_AVAILABLE').map((i) => i.name)
  );
  for (const m of changeMap.filter((c) => c.classification === 'RESOLVED' && c.entityType === 'Investigation' && resultNames.has(c.entity))) {
    items.push({
      id: `att_${m.id}`,
      kind: 'New Result',
      title: m.entity,
      whySurfaced: `A result that was previously outstanding is now documented: ${m.summary}`,
      dates: m.date ? [m.date] : [],
      evidence: m.evidence,
      target: { view: 'changemap', id: m.id },
    });
  }

  for (const m of changeMap.filter((c) => c.classification === 'NEW' && c.entityType === 'Event')) {
    items.push({
      id: `att_${m.id}`,
      kind: 'New Event',
      title: m.entity,
      whySurfaced: 'Newly documented clinical event in the available record.',
      dates: m.date ? [m.date] : [],
      evidence: m.evidence,
      target: { view: 'timeline', id: m.id },
    });
  }

  for (const m of changeMap.filter((c) => c.classification === 'RESOLVED')) {
    if (items.some((i) => i.id === `att_${m.id}`)) continue;
    items.push({
      id: `att_${m.id}`,
      kind: 'Recently Resolved',
      title: m.entity,
      whySurfaced: `Previously outstanding item now has completion evidence: ${m.summary}`,
      dates: m.date ? [m.date] : [],
      evidence: m.evidence,
      target: { view: 'changemap', id: m.id },
    });
  }

  return items;
}

/* ------------------------------------------------------------------ *
 * Current state + verification list
 * ------------------------------------------------------------------ */

export function buildCurrentState(a: {
  medications: Medication[];
  careLoops: CareLoop[];
  conflicts: DocumentationConflict[];
  events: ClinicalEvent[];
  findings: ClinicalFinding[];
}): string[] {
  const lines: string[] = [];

  /* The latest documented status of each drug and dose decides
     whether it is currently active: a course completed last week
     is not active today, even though an earlier document listed
     it as active. */
  const latestByDrugDose = new Map<string, Medication>();
  for (const m of a.medications) {
    const k = `${normaliseMedName(m.name)}|${(m.dose ?? '').toLowerCase()}`;
    const prev = latestByDrugDose.get(k);
    if (!prev || dateSortKey(m.startDate) >= dateSortKey(prev.startDate)) {
      latestByDrugDose.set(k, m);
    }
  }
  const currentMeds = Array.from(latestByDrugDose.values());

  const activeMeds = dedupeByName(currentMeds.filter((m) => m.status === 'ACTIVE'));
  if (activeMeds.length) {
    lines.push(
      `Medications documented as active: ${activeMeds
        .map((m) => `${m.name}${m.dose ? ` ${m.dose}` : ''}${m.frequency ? ` ${m.frequency}` : ''}`)
        .join(', ')}.`
    );
  } else {
    lines.push('No medications are documented as active in the available record.');
  }

  const stopped = dedupeByName(currentMeds.filter((m) => m.status !== 'ACTIVE'));
  if (stopped.length) {
    lines.push(
      `Medications documented as stopped or completed: ${stopped.map((m) => `${m.name}${m.dose ? ` ${m.dose}` : ''}`).join(', ')}.`
    );
  }

  const openLoops = a.careLoops.filter((l) => l.status === 'OPEN');
  if (openLoops.length) {
    lines.push(
      `${openLoops.length} care ${openLoops.length === 1 ? 'loop appears' : 'loops appear'} incomplete: ${openLoops
        .map((l) => l.name)
        .join(', ')}. No completion report was found in the available record for these.`
    );
  } else {
    lines.push('No incomplete care loops were detected in the available record.');
  }

  if (a.conflicts.length) {
    lines.push(
      `${a.conflicts.length} documentation ${a.conflicts.length === 1 ? 'conflict requires' : 'conflicts require'} review: ${a.conflicts
        .map((c) => `${c.entity} (${c.field})`)
        .join(', ')}.`
    );
  }

  const recent = [...a.events].sort((x, y) => dateSortKey(y.date) - dateSortKey(x.date)).slice(0, 4);
  if (recent.length) {
    lines.push(
      `Most recent documented activity: ${recent
        .map((e) => `${e.title} (${e.date ? formatDate(e.date) : 'date not documented'})`)
        .join('; ')}.`
    );
  }

  if (a.findings.length) {
    lines.push(`Most recent documented finding: ${a.findings[a.findings.length - 1].finding.slice(0, 200)}.`);
  }

  return lines;
}

/** Trims an allergy agent string to the substance name. */
function cleanAgent(raw: string): string {
  return raw
    .split(/[—–;,]| - |\s+and\s+|\s+or\s+|\s+rash\b|\s+reaction\b|\s+hx\b|\s+history\b/i)[0]
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 40);
}

function dedupeByName(list: Medication[]): Medication[] {
  const seen = new Set<string>();
  const out: Medication[] = [];
  for (const m of list) {
    const k = `${normaliseMedName(m.name)}|${m.dose}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(m);
  }
  return out;
}

export function buildVerifyList(loops: CareLoop[], conflicts: DocumentationConflict[]): string[] {
  const out: string[] = [];
  for (const l of loops.filter((x) => x.status === 'OPEN')) {
    const missing = l.stages.filter((s) => !s.documented).map((s) => s.stage.toLowerCase());
    out.push(
      `Confirm whether ${l.name} was ${missing[0] ?? 'completed'} — ${l.orderedDate ? `ordered ${formatDate(l.orderedDate)}` : 'order date not documented'}; no documentation was found in the available record.`
    );
  }
  for (const c of conflicts) {
    out.push(`Clarify ${c.field.toLowerCase()} for ${c.entity}: ${c.entries.map((e) => `${e.value}${e.date ? ` (${formatDate(e.date)})` : ''}`).join(' vs ')}.`);
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Since last review (delta between snapshots)
 * ------------------------------------------------------------------ */

export function diffSnapshots(previous: PatientAnalysis | null, current: PatientAnalysis): DeltaSummary {
  if (!previous) {
    return {
      newEvents: current.events.length,
      medicationChanges: current.medicationChanges.length,
      newResults: current.investigations.filter((i) => i.status === 'RESULT_AVAILABLE').length,
      resolvedLoops: current.careLoops.filter((l) => l.status === 'RESOLVED').length,
      newlyOpenLoops: current.careLoops.filter((l) => l.status === 'OPEN').length,
      newConflicts: current.conflicts.length,
      details: [],
    };
  }

  const prevEventKeys = new Set(previous.events.map((e) => `${e.date}|${e.title}`));
  const newEvents = current.events.filter((e) => !prevEventKeys.has(`${e.date}|${e.title}`));
  const prevChangeKeys = new Set(previous.medicationChanges.map((c) => `${c.medicationName}|${c.kind}|${c.newDose}`));
  const newMedChanges = current.medicationChanges.filter((c) => !prevChangeKeys.has(`${c.medicationName}|${c.kind}|${c.newDose}`));
  const prevResults = new Set(previous.investigations.filter((i) => i.status === 'RESULT_AVAILABLE').map((i) => i.name));
  const newResults = current.investigations.filter((i) => i.status === 'RESULT_AVAILABLE' && !prevResults.has(i.name));
  const prevLoops = new Map(previous.careLoops.map((l) => [l.id, l.status]));
  const resolved = current.careLoops.filter((l) => l.status === 'RESOLVED' && prevLoops.get(l.id) === 'OPEN');
  const newlyOpen = current.careLoops.filter((l) => l.status === 'OPEN' && prevLoops.get(l.id) === 'RESOLVED');
  const prevConflictKeys = new Set(previous.conflicts.map((c) => c.id));
  const newConflicts = current.conflicts.filter((c) => !prevConflictKeys.has(c.id));

  const details: Array<{ kind: string; title: string }> = [
    ...newEvents.slice(0, 8).map((e) => ({ kind: 'New event', title: e.title })),
    ...newMedChanges.map((c) => ({ kind: 'Medication change', title: `${c.medicationName} → ${c.newDose ?? c.kind}` })),
    ...newResults.map((i) => ({ kind: 'New result', title: i.name })),
    ...resolved.map((l) => ({ kind: 'Resolved care loop', title: l.name })),
    ...newlyOpen.map((l) => ({ kind: 'Newly open care loop', title: l.name })),
    ...newConflicts.map((c) => ({ kind: 'New documentation conflict', title: `${c.entity} (${c.field})` })),
  ];

  return {
    newEvents: newEvents.length,
    medicationChanges: newMedChanges.length,
    newResults: newResults.length,
    resolvedLoops: resolved.length,
    newlyOpenLoops: newlyOpen.length,
    newConflicts: newConflicts.length,
    details,
  };
}

export function summariseForDashboard(analysis: PatientAnalysis, documents: SourceDocument[]) {
  return {
    documentCount: documents.length,
    eventCount: analysis.events.length,
    openLoops: analysis.careLoops.filter((l) => l.status === 'OPEN').length,
    resolvedLoops: analysis.careLoops.filter((l) => l.status === 'RESOLVED').length,
    conflicts: analysis.conflicts.length,
    medicationChanges: analysis.medicationChanges.length,
    attentionCount: analysis.attention.length,
  };
}
