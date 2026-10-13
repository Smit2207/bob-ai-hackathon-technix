import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { usePatientStore } from '../store/patient';
import { useAuthStore } from '../store/auth';
import { EmptyState, EvidenceDrawer } from '../components/Clinical';
import { Card, Spinner, Badge } from '../components/UI';
import { Search, FileText, Database, Pill, Stethoscope, Activity, AlertTriangle, ClipboardList, FlaskConical, BookOpen, Brain, Loader2 } from 'lucide-react';
import { searchPatient, answerFromRecord } from '../../../shared/clinical/retrieval.js';
import { api } from '../utils/api';
import type { SearchHit } from '../../../shared/clinical/types.js';

const KIND_ICON: Record<SearchHit['kind'], React.ElementType> = {
  chunk: FileText,
  medication: Pill,
  investigation: Stethoscope,
  event: Activity,
  finding: Database,
  lab: FlaskConical,
  conflict: AlertTriangle,
  careloop: ClipboardList,
  handover: BookOpen,
};

export default function PatientEvidence() {
  const { id } = useParams<{ id: string }>();
  const [search] = useSearchParams();
  const isDemo = search.get('demo') === '1';
  const { current, loading, error, loadDemo, loadLive } = usePatientStore();
  const { user } = useAuthStore();
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'search' | 'ask'>('search');
  const [useAI, setUseAI] = useState(false);
  const [result, setResult] = useState<{ hits: SearchHit[]; noMatch: boolean; message: string | null; answer?: string; provenance?: string; aiResult?: { fallback: boolean; model: string; provider: string; error?: string } } | null>(null);
  const [searched, setSearched] = useState(false);
  const [evidence, setEvidence] = useState<{ open: boolean; data: any; title: string }>({ open: false, data: null, title: 'Evidence' });
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    if (isDemo) loadDemo(id);
    else if (user) loadLive(id);
  }, [id, isDemo, user]);

  const chunks = useMemo(() => (current ? current.chunks : []), [current]);

  const runSearch = async () => {
    if (!current) return;
    setSearched(true);
    if (mode === 'search') {
      const r = searchPatient(current.analysis, chunks, query);
      setResult({ hits: r.hits, noMatch: r.noMatch, message: r.message });
    } else if (useAI) {
      setAiLoading(true);
      try {
        const res = await api.askAI(id!, query);
        setResult({
          hits: res.hits,
          noMatch: res.provenance === 'UNKNOWN',
          message: null,
          answer: res.answer,
          provenance: res.provenance,
          aiResult: res.aiResult,
        });
      } catch (err: any) {
        // Fallback to deterministic
        const r = answerFromRecord(current.analysis, chunks, query);
        setResult({
          hits: r.hits,
          noMatch: r.provenance === 'UNKNOWN',
          message: null,
          answer: r.answer,
          provenance: r.provenance,
          aiResult: { fallback: true, model: 'mock', provider: 'mock', error: err.message },
        });
      } finally {
        setAiLoading(false);
      }
    } else {
      const r = answerFromRecord(current.analysis, chunks, query);
      setResult({ hits: r.hits, noMatch: r.provenance === 'UNKNOWN', message: null, answer: r.answer, provenance: r.provenance });
    }
  };

  if (loading) return <div className="flex justify-center py-24"><Spinner size="lg" /></div>;
  if (error) return <Card className="max-w-xl mx-auto mt-10"><div className="empty-state"><Search className="w-12 h-12 text-amber-500" /><p>{error}</p></div></Card>;
  if (!current) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Evidence & search</h1>
        <p className="text-sm text-slate-500 mt-1">
          Grounded retrieval over the extracted record and source text. No match returns an explicit "not found" — never a guess.
        </p>
      </div>

      {/* Search box */}
      <Card>
        <div className="card-body">
          <div className="flex items-center gap-2 mb-4">
            {(['search', 'ask'] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  mode === m ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'
                }`}
                aria-pressed={mode === m}
              >
                {m === 'search' ? 'Search record' : 'Ask a question'}
              </button>
            ))}
          </div>
          
          {mode === 'ask' && (
            <div className="flex items-center gap-2 mb-4">
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={useAI}
                  onChange={e => setUseAI(e.target.checked)}
                  className="rounded border-slate-300"
                  disabled={isDemo}
                />
                <Brain className="w-4 h-4" aria-hidden="true" />
                <span>AI-enhanced (watsonx)</span>
                {isDemo && <span className="text-xs text-slate-400">(demo mode: uses fallback)</span>}
              </label>
              {useAI && (
                <Brain className="w-5 h-5 text-brand-600" />
              )}
            </div>
          )}
          
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') runSearch(); }}
                placeholder={mode === 'search' ? 'e.g. atorvastatin, echocardiogram, smoking…' : "e.g. What is the patient's blood group?"}
                className="input pl-9"
                aria-label={mode === 'search' ? 'Search query' : 'Clinical question'}
              />
            </div>
            <button onClick={runSearch} className="btn-primary px-4 py-2" disabled={aiLoading}>
              {aiLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                  AI thinking…
                </>
              ) : 'Search'}
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            {mode === 'search'
              ? 'Matches structured fields, source chunks, dates and clinical entities with relevance scores.'
              : 'Answers are assembled only from retrieved evidence and labelled DOCUMENTED or UNKNOWN.'}
          </p>
        </div>
      </Card>

      {/* Results */}
      {searched && result && (
        <Card>
          <div className="card-header">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                {mode === 'ask' ? 'Answer' : 'Results'}
              </h2>
              <div className="flex items-center gap-2">
                {result.aiResult && (
                  <div className="flex items-center gap-1">
                    <Badge variant={result.aiResult.fallback ? 'open' : 'resolved'} className="text-xs">
                      {result.aiResult.fallback ? 'Deterministic' : `AI: ${result.aiResult.model}`}
                    </Badge>
                    {result.aiResult.error && (
                      <span className="text-xs text-amber-600" title={result.aiResult.error}>
                        ⚠ Fallback
                      </span>
                    )}
                  </div>
                )}
                {result.provenance && (
                  <Badge variant={result.provenance === 'DOCUMENTED' ? 'resolved' : 'open'}>{result.provenance}</Badge>
                )}
              </div>
            </div>
          </div>
          <div className="card-body">
            {mode === 'ask' && result.answer && (
              <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{result.answer}</p>
              </div>
            )}

            {result.noMatch && (
              <EmptyState
                icon={Search}
                title="Not found in the available record"
                message={result.message ?? "I couldn't find that information in the available record."}
              />
            )}

            {!result.noMatch && result.hits.length > 0 && (
              <div className="space-y-3">
                {result.hits.map((hit, i) => {
                  const Icon = KIND_ICON[hit.kind] ?? FileText;
                  return (
                    <div key={i} className="p-4 border border-slate-200 rounded-lg hover:border-brand-300 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0">
                            <Icon className="w-5 h-5 text-brand-600" aria-hidden="true" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm text-slate-900">{hit.label}</span>
                              <Badge variant="default" className="bg-slate-100 text-slate-600">{hit.kind}</Badge>
                            </div>
                            <p className="text-sm text-slate-600 mt-1">{hit.text}</p>
                            <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                              <span className="flex items-center gap-1"><FileText className="w-3 h-3" />{hit.documentName}{hit.page != null ? `, page ${hit.page}` : ''}</span>
                              <span>Field: {hit.field}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-sm font-semibold text-brand-600">{hit.score.toFixed(1)}</div>
                          <div className="text-[10px] text-slate-400 uppercase tracking-wide">relevance</div>
                        </div>
                      </div>
                      {hit.kind === 'chunk' && (
                        <button
                          onClick={() => setEvidence({ open: true, data: [{ documentId: '', documentName: hit.documentName, page: hit.page ?? 0, chunkIndex: 0, field: 'Source text', text: hit.text }], title: `Source: ${hit.documentName}` })}
                          className="mt-2 text-xs font-medium text-brand-600 hover:underline"
                        >
                          View source text
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Evidence chain summary */}
      <Card>
        <div className="card-header">
          <h2 className="text-lg font-semibold text-slate-900">Evidence chain</h2>
          <p className="text-sm text-slate-500">Every retained evidence reference across the record</p>
        </div>
        <div className="card-body">
          {current.chunks.length === 0 ? (
            <EmptyState icon={FileText} title="No source chunks" message="No source text chunks were retained for this record." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {current.chunks.slice(0, 20).map((c) => (
                <button
                  key={c.id}
                  onClick={() => setEvidence({ open: true, data: [{ documentId: c.documentId, documentName: c.documentName, page: c.page, chunkIndex: c.index, field: 'Source chunk', text: c.text }], title: `Chunk ${c.index} — ${c.documentName}` })}
                  className="text-left p-3 border border-slate-200 rounded-lg hover:border-brand-300 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-medium text-brand-700">{c.documentName}</span>
                    <span className="text-xs text-slate-400">p.{c.page} · chunk {c.index}</span>
                  </div>
                  <p className="text-xs text-slate-600 line-clamp-2 font-mono">{c.text}</p>
                </button>
              ))}
            </div>
          )}
          {current.chunks.length > 20 && (
            <p className="text-xs text-slate-400 mt-3">Showing 20 of {current.chunks.length} chunks. Use search to find specific content.</p>
          )}
        </div>
      </Card>

      <EvidenceDrawer
        open={evidence.open}
        onClose={() => setEvidence({ open: false, data: null, title: 'Evidence' })}
        evidence={evidence.data}
        title={evidence.title}
      />
    </div>
  );
}