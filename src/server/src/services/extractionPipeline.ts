import { analyseDocuments } from '../../../shared/clinical/pipeline.js';
import type { RawDocument } from '../../../shared/clinical/pipeline.js';
import type { PatientAnalysis, Chunk } from '../../../shared/clinical/types.js';

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

export async function processText(fullText: string, pages: Array<{ page: number; text: string }>) {
  const docs: RawDocument[] = [{
    id: 'combined',
    name: 'combined',
    kind: 'txt',
    text: fullText,
  }];

  const result = analyseDocuments(docs);
  const { analysis } = result;

  const changeMap = analysis.changeMap;
  const careLoops = analysis.careLoops;
  const conflicts = analysis.conflicts;
  const attention = analysis.attention;

  return {
    extracted: {
      patient: analysis.patient,
      events: analysis.events,
      medications: analysis.medications,
      investigations: analysis.investigations,
      labs: analysis.labs,
      vitals: analysis.vitals,
      referrals: analysis.referrals,
      followups: analysis.followUps,
      findings: analysis.findings,
    },
    changeMap,
    careLoops,
    conflicts,
    attention,
  };
}

export function chunkText(text: string, page: number): Array<{ page: number; index: number; text: string }> {
  const chunks: Array<{ page: number; index: number; text: string }> = [];
  const size = 800;
  for (let i = 0, idx = 0; i < text.length; i += size, idx++) {
    chunks.push({ page, index: idx, text: text.slice(i, i + size) });
  }
  return chunks.length ? chunks : [{ page, index: 0, text }];
}

export { analyseBridge, searchBridge, answerBridge, briefsBridge, byoaiBridge, compareBridge, analyticsBridge, diffBridge, dashboardBridge } from './sharedEngineBridge.js';
export { getProvider } from './aiProvider.js';