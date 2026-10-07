/** Analysis pipeline: documents in, complete patient analysis out. */

import { PageInput, extractClinicalRecord, resetIdCounter } from './extract.js';
import { cleanText } from './text.js';
import {
  buildAttention,
  buildCareLoops,
  buildChangeMap,
  buildConflicts,
  buildCurrentState,
  buildMedicationChanges,
  buildVerifyList,
} from './temporal.js';
import { PatientAnalysis, SourceDocument } from './types.js';

export interface RawDocument {
  id: string;
  name: string;
  kind: 'pdf' | 'txt';
  /** Full text for txt, or pre-extracted per-page text for pdf. */
  text?: string;
  pages?: Array<{ page: number; text: string }>;
}

export interface IngestResult {
  analysis: PatientAnalysis;
  documents: SourceDocument[];
  chunks: PatientAnalysis['events'] extends never ? never : ReturnType<typeof extractClinicalRecord>['chunks'];
}

function toPages(doc: RawDocument): PageInput[] {
  if (doc.pages && doc.pages.length) {
    return doc.pages.map((p) => ({
      documentId: doc.id,
      documentName: doc.name,
      page: p.page,
      text: cleanText(p.text),
    }));
  }
  const text = cleanText(doc.text ?? '');
  if (!text) return [];
  // Text documents are chunked into logical pages so evidence can cite a location.
  const approxCharsPerPage = 3000;
  const pageCount = Math.max(1, Math.ceil(text.length / approxCharsPerPage));
  return Array.from({ length: pageCount }, (_, i) => ({
    documentId: doc.id,
    documentName: doc.name,
    page: i + 1,
    text: text.slice(i * approxCharsPerPage, (i + 1) * approxCharsPerPage),
  }));
}

export function analyseDocuments(docs: RawDocument[]): IngestResult {
  resetIdCounter();
  const pages: PageInput[] = [];
  const sourceDocs: SourceDocument[] = [];

  for (const doc of docs) {
    const docPages = toPages(doc);
    const charCount = docPages.reduce((a, p) => a + p.text.length, 0);
    sourceDocs.push({
      id: doc.id,
      name: doc.name,
      pageCount: Math.max(1, docPages.length),
      charCount,
      kind: doc.kind,
    });
    pages.push(...docPages);
  }

  const ex = extractClinicalRecord(pages);

  const medicationChanges = buildMedicationChanges(ex.medications);
  const careLoops = buildCareLoops(ex.investigations, ex.referrals, ex.followUps, ex.events);
  const conflicts = buildConflicts(ex.medications, pages.map((p) => p.text).join('\n'), ex.vitals, ex.events);
  const changeMap = buildChangeMap(medicationChanges, ex.investigations, ex.events, ex.findings, careLoops, conflicts);
  const attention = buildAttention(changeMap, careLoops, conflicts, ex.investigations);

  const longitudinalStory = [...ex.events].sort((a, b) => dateSortKeySafe(a.date) - dateSortKeySafe(b.date));
  const events = [...ex.events].sort((a, b) => dateSortKeySafe(b.date) - dateSortKeySafe(a.date));

  const currentState = buildCurrentState({
    medications: ex.medications,
    careLoops,
    conflicts,
    events: ex.events,
    findings: ex.findings,
  });
  const verifyNext = buildVerifyList(careLoops, conflicts);

  const warnings = [...ex.warnings];
  if (careLoops.length === 0) warnings.push('No care loops were detected in the available record.');
  if (conflicts.length === 0) warnings.push('No documentation conflicts were detected.');
  if (ex.medications.length === 0) warnings.push('No medications were extracted from the available record.');
  if (ex.investigations.length === 0) warnings.push('No investigations were extracted from the available record.');

  const analysis: PatientAnalysis = {
    patient: ex.patient,
    documents: sourceDocs,
    events,
    medications: ex.medications,
    medicationChanges,
    investigations: ex.investigations,
    labs: ex.labs,
    vitals: ex.vitals,
    referrals: ex.referrals,
    followUps: ex.followUps,
    findings: ex.findings,
    changeMap,
    careLoops,
    conflicts,
    attention,
    currentState,
    longitudinalStory,
    verifyNext,
    warnings,
  };

  return { analysis, documents: sourceDocs, chunks: ex.chunks };
}

function dateSortKeySafe(d: string | null): number {
  if (!d) return -Infinity;
  const t = Date.parse(`${d}T00:00:00Z`);
  return Number.isNaN(t) ? -Infinity : t;
}

export { chunkPage } from './text.js';
export type { PageInput } from './extract.js';
