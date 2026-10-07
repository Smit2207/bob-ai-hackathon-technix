/**
 * Patient data store — unifies Demo Mode (client-side engine) and
 * Live Mode (server API) behind one interface so every page renders
 * from the same shape of data.
 */

import { create } from 'zustand';
import type { PatientAnalysis, Chunk } from '../../../shared/clinical/types.js';
import { loadDemoRecord } from '../demo/engine.js';
import { api } from '../utils/api.js';

export interface PatientBundle {
  id: string;
  name: string;
  demo: boolean;
  analysis: PatientAnalysis;
  chunks: Chunk[];
  documents: Array<{ id: string; name: string; pageCount: number; charCount: number; kind: 'pdf' | 'txt' }>;
}

interface PatientState {
  current: PatientBundle | null;
  loading: boolean;
  error: string | null;
  loadDemo: (patientId: string) => void;
  loadLive: (patientId: string) => Promise<void>;
  clear: () => void;
}

export const usePatientStore = create<PatientState>((set) => ({
  current: null,
  loading: false,
  error: null,

  loadDemo: (patientId) => {
    set({ loading: true, error: null });
    try {
      const rec = loadDemoRecord(patientId);
      set({
        current: {
          id: rec.id,
          name: rec.patient.displayName,
          demo: true,
          analysis: rec.analysis,
          chunks: rec.chunks,
          documents: rec.analysis.documents,
        },
        loading: false,
      });
    } catch (e: any) {
      set({ error: e.message ?? 'Failed to load demo record', loading: false });
    }
  },

  loadLive: async (patientId) => {
    set({ loading: true, error: null });
    try {
      const data = await api.patients.get(patientId);
      const analysis: PatientAnalysis | null = data.analysis ?? null;
      if (!analysis) {
        set({
          current: {
            id: data.patient.id,
            name: data.patient.name,
            demo: false,
            analysis: emptyAnalysis(data.patient.name),
            chunks: data.chunks ?? [],
            documents: (data.documents ?? []).map((d: any) => ({
              id: d.id, name: d.originalName, pageCount: d.pageCount, charCount: d.text?.length ?? 0, kind: d.mimeType === 'application/pdf' ? 'pdf' as const : 'txt' as const,
            })),
          },
          loading: false,
        });
        return;
      }
      set({
        current: {
          id: data.patient.id,
          name: data.patient.name,
          demo: false,
          analysis,
          chunks: data.chunks ?? [],
          documents: (data.documents ?? []).map((d: any) => ({
            id: d.id, name: d.originalName, pageCount: d.pageCount, charCount: d.text?.length ?? 0, kind: d.mimeType === 'application/pdf' ? 'pdf' as const : 'txt' as const,
          })),
        },
        loading: false,
      });
    } catch (e: any) {
      set({ error: e.message ?? 'Failed to load patient', loading: false });
    }
  },

  clear: () => set({ current: null, error: null }),
}));

function emptyAnalysis(name: string): PatientAnalysis {
  return {
    patient: { name, patientId: null, age: null, sex: null, dob: null, recordStart: null, recordEnd: null },
    documents: [],
    events: [],
    medications: [],
    medicationChanges: [],
    investigations: [],
    labs: [],
    vitals: [],
    referrals: [],
    followUps: [],
    findings: [],
    changeMap: [],
    careLoops: [],
    conflicts: [],
    attention: [],
    currentState: ['No documents have been uploaded for this patient yet.'],
    longitudinalStory: [],
    verifyNext: [],
    warnings: ['No documents have been uploaded for this patient yet.'],
  };
}
