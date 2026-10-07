/**
 * Client-side demo engine.
 *
 * Runs the SAME shared clinical engine used by the server, entirely in the
 * browser, so Demo Mode works with no backend, no database and no network.
 * Demo records are pushed through `analyseDocuments` at runtime — every
 * figure shown is computed from the synthetic document text, never
 * hard-coded.
 */

import { analyseDocuments } from '../../../shared/clinical/pipeline.js';
import type { RawDocument } from '../../../shared/clinical/pipeline.js';
import type { PatientAnalysis, Chunk } from '../../../shared/clinical/types.js';
import { DEMO_PATIENTS, type DemoPatient } from '../../../shared/demo/records.js';

export interface DemoRecord {
  id: string;
  patient: DemoPatient;
  analysis: PatientAnalysis;
  chunks: Chunk[];
}

const cache = new Map<string, DemoRecord>();

function demoToRaw(patient: DemoPatient): RawDocument[] {
  return patient.documents.map((d, i) => ({
    id: `${patient.id}_doc_${i}`,
    name: d.name,
    kind: d.kind,
    text: d.text,
    pages: d.pages,
  }));
}

export function loadDemoRecord(patientId: string): DemoRecord {
  const cached = cache.get(patientId);
  if (cached) return cached;
  const patient = DEMO_PATIENTS.find(p => p.id === patientId);
  if (!patient) throw new Error('Unknown demo patient');
  const raw = demoToRaw(patient);
  const { analysis, chunks } = analyseDocuments(raw);
  const record: DemoRecord = { id: patientId, patient, analysis, chunks };
  cache.set(patientId, record);
  return record;
}

export function listDemoPatients(): DemoPatient[] {
  return DEMO_PATIENTS;
}

export { DEMO_DISCLAIMER } from '../../../shared/demo/records.js';
export type { PatientAnalysis, Chunk };
