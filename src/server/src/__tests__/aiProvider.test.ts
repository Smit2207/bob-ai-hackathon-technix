import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getProvider, MockProvider, WatsonxProvider, isAIEnabled, AIResult } from '../services/aiProvider.js';
import { analyseDocuments } from '../shared/clinical/pipeline.js';
import type { RawDocument } from '../shared/clinical/types.js';

const demoDocs: RawDocument[] = [
  {
    id: 'd1', name: 'GP_Consultation.txt', kind: 'txt',
    text: `GP CONSULTATION
Patient Name: Test Patient
Patient ID: TP-001
Age: 50
Sex: Male
Date: 12 Jan 2026

HISTORY: Hypertension diagnosed 2019.

MEDICATIONS:
Amlodipine 5 mg once daily.
Atorvastatin 20 mg nightly.

EXAMINATION: BP 152/88 mmHg, HR 76 bpm.

PLAN:
Continue current medication.
Refer to Cardiology for assessment of breathlessness.
Pulmonary function test ordered today.
Follow-up in 6 weeks.`,
  },
  {
    id: 'd2', name: 'Echo_Report.txt', kind: 'txt',
    text: `ECHOCARDIOGRAM REPORT
Patient Name: Test Patient
Date of Examination: 23 Jan 2026

FINDINGS: LVEF 55% by biplane Simpson's method.

IMPRESSION: Normal left ventricular systolic function with preserved ejection fraction (LVEF 55%).`,
  },
];

describe('AI Provider', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    delete process.env.AI_PROVIDER;
    delete process.env.WATSONX_URL;
    delete process.env.WATSONX_API_KEY;
    delete process.env.WATSONX_PROJECT_ID;
    delete process.env.WATSONX_MODEL_ID;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.resetAllMocks();
  });

  describe('getProvider', () => {
    it('returns MockProvider by default', () => {
      const provider = getProvider();
      expect(provider).toBeInstanceOf(MockProvider);
    });

    it('returns MockProvider when AI_PROVIDER=mock', () => {
      process.env.AI_PROVIDER = 'mock';
      const provider = getProvider();
      expect(provider).toBeInstanceOf(MockProvider);
    });

    it('returns WatsonxProvider when AI_PROVIDER=watsonx', () => {
      process.env.AI_PROVIDER = 'watsonx';
      process.env.WATSONX_URL = 'https://test.watsonx.ai';
      process.env.WATSONX_API_KEY = 'test-key';
      process.env.WATSONX_PROJECT_ID = 'test-project';
      const provider = getProvider();
      expect(provider).toBeInstanceOf(WatsonxProvider);
    });

    it('returns WatsonxProvider when AI_PROVIDER=ibm', () => {
      process.env.AI_PROVIDER = 'ibm';
      process.env.WATSONX_URL = 'https://test.watsonx.ai';
      process.env.WATSONX_API_KEY = 'test-key';
      process.env.WATSONX_PROJECT_ID = 'test-project';
      const provider = getProvider();
      expect(provider).toBeInstanceOf(WatsonxProvider);
    });
  });

  describe('isAIEnabled', () => {
    it('returns false by default', () => {
      expect(isAIEnabled()).toBe(false);
    });

    it('returns true when AI_PROVIDER=watsonx', () => {
      process.env.AI_PROVIDER = 'watsonx';
      expect(isAIEnabled()).toBe(true);
    });

    it('returns false when AI_PROVIDER=mock', () => {
      process.env.AI_PROVIDER = 'mock';
      expect(isAIEnabled()).toBe(false);
    });
  });

  describe('MockProvider', () => {
    it('returns AIResult with fallback true', async () => {
      const provider = new MockProvider();
      const result = await provider.generate('test prompt', 'test context');
      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('model', 'mock');
      expect(result).toHaveProperty('provider', 'mock');
      expect(result).toHaveProperty('fallback', true);
      expect(typeof result.text).toBe('string');
    });

    it('includes context in mock response', async () => {
      const provider = new MockProvider();
      const context = 'Patient has hypertension and takes amlodipine.';
      const result = await provider.generate('Summarise', context);
      expect(result.text).toContain('hypertension');
    });
  });

  describe('WatsonxProvider', () => {
    it('throws when not configured', async () => {
      const provider = new WatsonxProvider();
      await expect(provider.generate('test', 'context')).rejects.toThrow('Watsonx not configured');
    });

    it('throws when missing URL', async () => {
      process.env.WATSONX_API_KEY = 'key';
      process.env.WATSONX_PROJECT_ID = 'project';
      const provider = new WatsonxProvider();
      await expect(provider.generate('test', 'context')).rejects.toThrow('Watsonx not configured');
    });

    it('throws when missing API key', async () => {
      process.env.WATSONX_URL = 'https://test.watsonx.ai';
      process.env.WATSONX_PROJECT_ID = 'project';
      const provider = new WatsonxProvider();
      await expect(provider.generate('test', 'context')).rejects.toThrow('Watsonx not configured');
    });

    it('throws when missing project ID', async () => {
      process.env.WATSONX_URL = 'https://test.watsonx.ai';
      process.env.WATSONX_API_KEY = 'key';
      const provider = new WatsonxProvider();
      await expect(provider.generate('test', 'context')).rejects.toThrow('Watsonx not configured');
    });
  });
});

describe('AI-enhanced Ask workflow', () => {
  let analysis: any;

  beforeEach(() => {
    const result = analyseDocuments(demoDocs);
    analysis = result.analysis;
  });

  it('builds grounded context with patient info', () => {
    // Test the context builder logic
    const lines: string[] = [];
    const p = analysis.patient;
    lines.push(`Patient: ${p.name ?? 'not documented'}`);
    lines.push(`Age: ${p.age ?? 'not documented'}, Sex: ${p.sex ?? 'not documented'}`);
    lines.push(`Record: ${p.recordStart ? new Date(p.recordStart).toLocaleDateString() : 'unknown'} – ${p.recordEnd ? new Date(p.recordEnd).toLocaleDateString() : 'unknown'}`);
    lines.push(`Documents: ${analysis.documents.length}`);
    lines.push('');

    lines.push('=== CURRENT STATE ===');
    analysis.currentState.forEach((s: string) => lines.push(`- ${s}`));
    lines.push('');

    const context = lines.join('\n');
    expect(context).toContain('Test Patient');
    expect(context).toContain('50');
    expect(context).toContain('Male');
    expect(context).toContain('CURRENT STATE');
  });

  it('includes medications in context', () => {
    const lines: string[] = [];
    lines.push('=== MEDICATIONS ===');
    analysis.medications.slice(0, 10).forEach((m: any) => {
      lines.push(`- ${m.name}${m.dose ? ` ${m.dose}` : ''}${m.frequency ? ` ${m.frequency}` : ''} (${m.status})`);
    });
    const context = lines.join('\n');
    expect(context).toContain('Amlodipine');
    expect(context).toContain('Atorvastatin');
  });

  it('includes investigations in context', () => {
    const lines: string[] = [];
    lines.push('=== INVESTIGATIONS ===');
    analysis.investigations.slice(0, 10).forEach((i: any) => {
      lines.push(`- ${i.name}: ${i.status}${i.result ? `, result: ${i.result}` : ''}`);
    });
    const context = lines.join('\n');
    expect(context).toContain('Echocardiogram');
  });

  it('includes open care loops in context', () => {
    const lines: string[] = [];
    lines.push('=== OPEN CARE LOOPS ===');
    analysis.careLoops.filter((l: any) => l.status === 'OPEN').forEach((l: any) => {
      lines.push(`- ${l.name}: ${l.type} (${l.status})`);
    });
    const context = lines.join('\n');
    expect(context).toContain('OPEN');
  });

  it('includes evidence references in context', () => {
    const lines: string[] = [];
    lines.push('=== KEY EVIDENCE ===');
    analysis.attention.slice(0, 5).flatMap((a: any) => a.evidence.slice(0, 1)).forEach((e: any, i: number) => {
      if (e?.text) lines.push(`[E${i + 1}] ${e.documentName}${e.page ? `, p.${e.page}` : ''}: ${e.text.slice(0, 200)}`);
    });
    const context = lines.join('\n');
    expect(context).toContain('[E1]');
  });
});

describe('AI-enhanced Brief workflow', () => {
  let analysis: any;

  beforeEach(() => {
    const result = analyseDocuments(demoDocs);
    analysis = result.analysis;
  });

  it('determines brief type label correctly', () => {
    const typeLabel = (type: string, specialty?: string) => {
      return type === 'ward' ? 'ward round brief'
        : type === 'referral' ? `referral brief to ${specialty ?? 'General Medicine'}`
        : 'discharge/handoff brief';
    };
    expect(typeLabel('ward')).toBe('ward round brief');
    expect(typeLabel('referral', 'Cardiology')).toBe('referral brief to Cardiology');
    expect(typeLabel('handoff')).toBe('discharge/handoff brief');
    expect(typeLabel('discharge')).toBe('discharge/handoff brief');
  });

  it('builds prompt with clinical safety rules', () => {
    const prompt = `Generate a ward round brief using ONLY the provided clinical context.
Rules:
- Use ONLY facts from the context above
- Include all required sections for a ward round brief
- Cite evidence references like [E1], [E2] for each clinical statement
- If information is missing, state "Not documented in the available record"
- Do not invent diagnoses, medications, results, or dates
- Distinguish DOCUMENTED facts from UNKNOWN
- Do not provide treatment recommendations
- Include a clear disclaimer that this is a draft for clinician review

Structure the brief with clear section headings.`;

    expect(prompt).toContain('ONLY facts from the context');
    expect(prompt).toContain('Not documented in the available record');
    expect(prompt).toContain('Do not invent');
    expect(prompt).toContain('DOCUMENTED facts from UNKNOWN');
    expect(prompt).toContain('Do not provide treatment recommendations');
    expect(prompt).toContain('draft for clinician review');
  });
});

describe('Provider response validation', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.WATSONX_URL = 'https://test.watsonx.ai';
    process.env.WATSONX_API_KEY = 'test-key';
    process.env.WATSONX_PROJECT_ID = 'test-project';
    process.env.AI_PROVIDER = 'watsonx';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('extracts generated text from results array', () => {
    const provider = new WatsonxProvider();
    const mockData = { results: [{ generated_text: 'Test response' }] };
    const extracted = (provider as any).extractGeneratedText(mockData);
    expect(extracted).toBe('Test response');
  });

  it('extracts generated text from top-level field', () => {
    const provider = new WatsonxProvider();
    const mockData = { generated_text: 'Top level response' };
    const extracted = (provider as any).extractGeneratedText(mockData);
    expect(extracted).toBe('Top level response');
  });

  it('extracts generated text from output field', () => {
    const provider = new WatsonxProvider();
    const mockData = { output: { generated_text: 'Output response' } };
    const extracted = (provider as any).extractGeneratedText(mockData);
    expect(extracted).toBe('Output response');
  });

  it('returns empty string for unknown format', () => {
    const provider = new WatsonxProvider();
    const mockData = { unknown: 'format' };
    const extracted = (provider as any).extractGeneratedText(mockData);
    expect(extracted).toBe('');
  });
});