import { analyseBridge, searchBridge, answerBridge, briefsBridge, byoaiBridge, compareBridge, analyticsBridge, diffBridge, dashboardBridge } from './sharedEngineBridge.js';
import { getProvider } from './aiProvider.js';

export interface PatientData {
  patient: any;
  documents: any[];
  events: any[];
  medications: any[];
  investigations: any[];
  labs: any[];
  vitals: any[];
  referrals: any[];
  followups: any[];
  findings: any[];
  careLoops: any[];
  conflicts: any[];
  briefs: any[];
  chunks: any[];
  analysis: any;
}

export async function buildPatientData(patient: any, documents: any[]): Promise<PatientData> {
  const docs = documents.map(d => ({
    id: d.id,
    name: d.originalName,
    kind: d.mimeType === 'application/pdf' ? 'pdf' as const : 'txt' as const,
    text: d.text,
  }));
  const { analysis, chunks } = analyseBridge(docs);
  return {
    patient,
    documents,
    events: analysis.events,
    medications: analysis.medications,
    investigations: analysis.investigations,
    labs: analysis.labs,
    vitals: analysis.vitals,
    referrals: analysis.referrals,
    followups: analysis.followUps,
    findings: analysis.findings,
    careLoops: analysis.careLoops,
    conflicts: analysis.conflicts,
    briefs: [],
    chunks,
    analysis,
  };
}

export async function searchRecord(data: PatientData, q: string) {
  return searchBridge(data.analysis, data.chunks, q);
}

export async function answerRecord(data: PatientData, q: string) {
  return answerBridge(data.analysis, data.chunks, q);
}

export async function generateBrief(data: PatientData, type: string, specialty?: string) {
  return briefsBridge(data.analysis, data.chunks, type as any, specialty);
}

export async function generateByoaiContext(data: PatientData) {
  return byoaiBridge(data.analysis, data.chunks);
}

export async function compareRecordsData(a: PatientData, b: PatientData) {
  return compareBridge(a.analysis, b.analysis);
}

export async function getAnalytics(data: PatientData) {
  return analyticsBridge(data.analysis);
}

export async function getDelta(previous: PatientData | null, current: PatientData) {
  return diffBridge(previous?.analysis ?? null, current.analysis);
}

export async function getDashboardSummary(data: PatientData) {
  return dashboardBridge(data.analysis, data.documents);
}

export async function generateAiText(prompt: string, context: string): Promise<string> {
  const provider = getProvider();
  return provider.generate(prompt, context);
}