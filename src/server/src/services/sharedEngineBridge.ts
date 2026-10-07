import { analyseDocuments } from '../../../shared/clinical/pipeline.js';
import type { RawDocument } from '../../../shared/clinical/pipeline.js';
import type { PatientAnalysis, Chunk, SearchHit } from '../../../shared/clinical/types.js';
import { searchPatient, answerFromRecord } from '../../../shared/clinical/retrieval.js';
import { buildBrief } from '../../../shared/clinical/briefs.js';
import { buildByoaiContext } from '../../../shared/clinical/byoai.js';
import { compareRecords } from '../../../shared/clinical/compare.js';
import { computeAnalytics } from '../../../shared/clinical/analytics.js';
import { diffSnapshots, summariseForDashboard } from '../../../shared/clinical/temporal.js';

export interface BridgeDocument {
  id: string;
  name: string;
  kind: 'pdf' | 'txt';
  text: string;
}

export interface BridgeResult {
  analysis: PatientAnalysis;
  chunks: Chunk[];
}

export function documentsToRaw(documents: BridgeDocument[]): RawDocument[] {
  return documents.map(d => ({
    id: d.id,
    name: d.name,
    kind: d.kind,
    text: d.text,
  }));
}

export function analyseBridge(documents: BridgeDocument[]): BridgeResult {
  const raw = documentsToRaw(documents);
  const result = analyseDocuments(raw);
  return {
    analysis: result.analysis,
    chunks: result.chunks,
  };
}

export function searchBridge(analysis: PatientAnalysis, chunks: Chunk[], question: string) {
  return searchPatient(analysis, chunks, question);
}

export function answerBridge(analysis: PatientAnalysis, chunks: Chunk[], question: string) {
  return answerFromRecord(analysis, chunks, question);
}

export function briefsBridge(analysis: PatientAnalysis, chunks: Chunk[], type: 'ward' | 'referral' | 'handoff', specialty?: string) {
  return buildBrief(analysis, type, specialty ?? null, chunks);
}

export function byoaiBridge(analysis: PatientAnalysis, chunks: Chunk[]) {
  return buildByoaiContext(analysis, {});
}

export function compareBridge(analysisA: PatientAnalysis, analysisB: PatientAnalysis) {
  return compareRecords(analysisA, analysisB);
}

export function analyticsBridge(analysis: PatientAnalysis) {
  return computeAnalytics(analysis);
}

export function diffBridge(previous: PatientAnalysis | null, current: PatientAnalysis) {
  return diffSnapshots(previous, current);
}

export function dashboardBridge(analysis: PatientAnalysis, documents: { name: string }[]) {
  return summariseForDashboard(analysis, documents.map(d => ({ id: '', name: d.name, pageCount: 0, charCount: 0, kind: 'txt' as const })));
}