/**
 * Bring Your Own AI — builds a grounded, portable context package that the user
 * can paste into an external assistant. Nothing is transmitted automatically.
 */

import { PatientAnalysis } from './types.js';
import { formatDate } from './text.js';

export interface ByoaiTarget {
  id: string;
  label: string;
  url: string;
  pasteUrl: string;
  note: string;
}

/**
 * Registry is intentionally open: adding a provider is one entry.
 * `url` is the provider home page opened in a new tab — no patient data is sent
 * by MedBrief. The user pastes the context themselves.
 */
export const BYOAI_TARGETS: ByoaiTarget[] = [
  {
    id: 'chatgpt',
    label: 'ChatGPT',
    url: 'https://chat.openai.com/',
    pasteUrl: 'https://chat.openai.com/',
    note: 'Open ChatGPT, start a new chat, paste the context, then send your question.',
  },
  {
    id: 'claude',
    label: 'Claude',
    url: 'https://claude.ai/new',
    pasteUrl: 'https://claude.ai/new',
    note: 'Open Claude, start a new conversation, paste the context, then send your question.',
  },
  {
    id: 'gemini',
    label: 'Gemini',
    url: 'https://gemini.google.com/app',
    pasteUrl: 'https://gemini.google.com/app',
    note: 'Open Gemini, start a new chat, paste the context, then send your question.',
  },
];

export interface ByoaiPackage {
  context: string;
  warning: string;
  evidenceExcerpts: Array<{ documentName: string; page: number | null; text: string }>;
  factsRedacted: boolean;
  generatedAt: string;
}

export function buildByoaiContext(
  analysis: PatientAnalysis,
  opts: { redactIdentifiers?: boolean } = {}
): ByoaiPackage {
  const redact = opts.redactIdentifiers ?? true;
  const p = analysis.patient;
  const label = redact ? 'Patient A' : p.name ?? 'Patient name not documented';

  const lines: string[] = [];
  lines.push('=== MEDBRIEF AI — GROUNDED CLINICAL CONTEXT ===');
  lines.push('This context was assembled from uploaded medical documents by MedBrief AI.');
  lines.push('It is NOT a diagnosis and NOT a treatment recommendation.');
  lines.push('');
  lines.push('RULES FOR THE ASSISTANT YOU ARE ABOUT TO USE:');
  lines.push('1. Use ONLY the facts in this context. Do not invent facts, values, medications, diagnoses or results.');
  lines.push('2. Do not infer a diagnosis that is not explicitly documented.');
  lines.push('3. Do not invent causal explanations.');
  lines.push('4. If something is not in this context, say that it is not documented.');
  lines.push('5. Distinguish DOCUMENTED statements from INFERENCE.');
  lines.push('6. Cite the evidence reference (E1, E2, …) when you use a fact.');
  lines.push('7. Do not recommend treatment or medication changes.');
  lines.push('');
  lines.push('=== PATIENT CONTEXT ===');
  lines.push(`Patient: ${label}`);
  if (!redact) {
    if (p.patientId) lines.push(`Patient ID: ${p.patientId}`);
    if (p.dob) lines.push(`Date of birth: ${formatDate(p.dob)}`);
  } else {
    lines.push('(Identifiers have been withheld. Enable "include identifiers" to include them.)');
  }
  lines.push(`Age: ${p.age ?? 'not documented'}`);
  lines.push(`Sex: ${p.sex ?? 'not documented'}`);
  lines.push(`Record period: ${p.recordStart ? formatDate(p.recordStart) : 'not documented'} – ${p.recordEnd ? formatDate(p.recordEnd) : 'not documented'}`);
  lines.push(`Source documents: ${analysis.documents.map((d) => d.name).join(', ')}`);
  lines.push('');

  lines.push('=== CURRENT STATE (derived from documentation) ===');
  for (const l of analysis.currentState) lines.push(`- ${l}`);
  lines.push('');

  lines.push('=== RECENT CHANGES ===');
  if (analysis.medicationChanges.length === 0) lines.push('- No medication changes were detected.');
  for (const c of analysis.medicationChanges.slice(0, 12)) {
    lines.push(
      `- ${c.date ? formatDate(c.date) : 'date not documented'} — ${c.medicationName}: ${c.previousDose ?? 'not documented'} → ${c.newDose ?? c.kind}${c.documentedReason ? ` (documented reason: ${c.documentedReason})` : ''}`
    );
  }
  lines.push('');

  lines.push('=== OPEN CARE LOOPS (documented as started, no completion found) ===');
  const openLoops = analysis.careLoops.filter((l) => l.status === 'OPEN');
  if (openLoops.length === 0) lines.push('- No open care loops were found.');
  for (const l of openLoops) {
    lines.push(
      `- ${l.name}: ordered ${l.orderedDate ? formatDate(l.orderedDate) : 'date not documented'}. ${l.stages.filter((s) => !s.documented).map((s) => s.note).join(' ')}`
    );
  }
  lines.push('');

  lines.push('=== DOCUMENTATION CONFLICTS (requires review) ===');
  if (analysis.conflicts.length === 0) lines.push('- No documentation conflicts were detected.');
  for (const c of analysis.conflicts) {
    lines.push(`- ${c.entity} (${c.field}): ${c.entries.map((e) => `${e.value}${e.date ? ` on ${formatDate(e.date)}` : ''}`).join(' vs ')}.`);
  }
  lines.push('');

  lines.push('=== INVESTIGATIONS ===');
  if (analysis.investigations.length === 0) lines.push('- No investigations were documented.');
  for (const i of analysis.investigations) {
    lines.push(
      `- ${i.name}: ${i.status.replace(/_/g, ' ').toLowerCase()}${i.orderedDate ? `, ordered ${formatDate(i.orderedDate)}` : ''}${i.performedDate ? `, performed ${formatDate(i.performedDate)}` : ''}${i.result ? `, result: ${i.result}` : ''}`
    );
  }
  lines.push('');

  lines.push('=== LABORATORY RESULTS ===');
  if (analysis.labs.length === 0) lines.push('- No laboratory results were extracted.');
  for (const l of analysis.labs.slice(0, 40)) {
    lines.push(`- ${l.test}: ${l.value}${l.unit ? ` ${l.unit}` : ''}${l.referenceRange ? ` (reference ${l.referenceRange})` : ''}${l.date ? ` — ${formatDate(l.date)}` : ''}`);
  }
  lines.push('');

  lines.push('=== VITAL SIGNS ===');
  if (analysis.vitals.length === 0) lines.push('- No vital signs were extracted.');
  for (const v of analysis.vitals.slice(0, 30)) {
    lines.push(`- ${v.type}: ${v.value}${v.unit ? ` ${v.unit}` : ''}${v.date ? ` (${formatDate(v.date)})` : ''}`);
  }
  lines.push('');

  lines.push('=== NEXT CLINICIAN SHOULD VERIFY ===');
  if (analysis.verifyNext.length === 0) lines.push('- No verification items were derived.');
  for (const v of analysis.verifyNext) lines.push(`- ${v}`);
  lines.push('');

  lines.push('=== LONGITUDINAL STORY (chronological) ===');
  if (analysis.longitudinalStory.length === 0) lines.push('- No dated clinical events were extracted.');
  for (const e of analysis.longitudinalStory) {
    lines.push(`- ${e.date ? formatDate(e.date) : 'date not documented'} — ${e.type}: ${e.title}`);
  }
  lines.push('');

  const evidenceExcerpts = analysis.attention
    .slice(0, 12)
    .flatMap((a) => a.evidence.slice(0, 1))
    .filter((e) => e && e.text)
    .map((e) => ({
      documentName: e.documentName,
      page: e.page,
      /* Verbatim excerpts can contain the patient name, so the name
         is redacted from the excerpt text just like the header. */
      text: redact && p.name ? e.text.split(p.name).join('Patient A') : e.text,
    }));

  lines.push('=== SOURCE EXCERPTS (verbatim from the uploaded documents) ===');
  if (evidenceExcerpts.length === 0) lines.push('- No source excerpts were available.');
  evidenceExcerpts.forEach((e, i) => {
    lines.push(`[E${i + 1}] ${e.documentName}${e.page ? `, page ${e.page}` : ''}: "${e.text.replace(/\s+/g, ' ').trim()}"`);
  });
  lines.push('');
  lines.push('=== END OF CONTEXT ===');
  lines.push('Reminder: absence of information here means it was not found in the documents provided — not that it does not exist.');

  return {
    context: lines.join('\n'),
    warning:
      'This package contains clinical information. Pasting it into a third-party AI service sends that data to that provider. MedBrief never transmits it automatically — the copy and open actions below are user-controlled.',
    evidenceExcerpts,
    factsRedacted: redact,
    generatedAt: new Date().toISOString(),
  };
}