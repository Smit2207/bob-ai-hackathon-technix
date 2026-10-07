import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { usePatientStore } from '../store/patient';
import { useAuthStore } from '../store/auth';
import { LoopBadge, DateLabel, EmptyState, EvidenceList, EvidenceDrawer } from '../components/Clinical';
import { Card, Spinner, Badge } from '../components/UI';
import { ClipboardList, CheckCircle2, Circle, AlertCircle } from 'lucide-react';
import type { CareLoop, LoopStatus } from '../../../shared/clinical/types.js';

const STATUS_FILTERS: Array<{ key: LoopStatus | 'all'; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'OPEN', label: 'Open' },
  { key: 'PARTIAL', label: 'Partial' },
  { key: 'RESOLVED', label: 'Resolved' },
];

function StageIcon({ documented }: { documented: boolean }) {
  if (documented) return <CheckCircle2 className="w-5 h-5 text-green-600" aria-hidden="true" />;
  return <Circle className="w-5 h-5 text-slate-300" aria-hidden="true" />;
}

export default function PatientCareLoop() {
  const { id } = useParams<{ id: string }>();
  const [search] = useSearchParams();
  const isDemo = search.get('demo') === '1';
  const { current, loading, error, loadDemo, loadLive } = usePatientStore();
  const { user } = useAuthStore();
  const [filter, setFilter] = useState<LoopStatus | 'all'>('all');
  const [evidence, setEvidence] = useState<{ open: boolean; data: any; title: string }>({ open: false, data: null, title: 'Evidence' });

  useEffect(() => {
    if (!id) return;
    if (isDemo) loadDemo(id);
    else if (user) loadLive(id);
  }, [id, isDemo, user]);

  const loops = useMemo(() => {
    if (!current) return [];
    if (filter === 'all') return current.analysis.careLoops;
    return current.analysis.careLoops.filter(l => l.status === filter);
  }, [current, filter]);

  const counts = useMemo(() => {
    const m = new Map<LoopStatus, number>();
    if (!current) return m;
    for (const l of current.analysis.careLoops) m.set(l.status, (m.get(l.status) ?? 0) + 1);
    return m;
  }, [current]);

  if (loading) return <div className="flex justify-center py-24"><Spinner size="lg" /></div>;
  if (error) return <Card className="max-w-xl mx-auto mt-10"><div className="empty-state"><ClipboardList className="w-12 h-12 text-amber-500" /><p>{error}</p></div></Card>;
  if (!current) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">CareLoop</h1>
        <p className="text-sm text-slate-500 mt-1">
          Clinical workflows tracked end-to-end: ordered → completed → result → review. An incomplete chain creates an open loop.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {STATUS_FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`p-4 rounded-xl border text-left transition-colors ${
              filter === f.key ? 'border-brand-500 bg-brand-50' : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
            aria-pressed={filter === f.key}
          >
            <div className="text-2xl font-semibold text-slate-900">{f.key === 'all' ? current.analysis.careLoops.length : (counts.get(f.key as LoopStatus) ?? 0)}</div>
            <div className="text-xs font-medium text-slate-500 mt-0.5">{f.label}</div>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {STATUS_FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === f.key ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'
            }`}
            aria-pressed={filter === f.key}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loops.length === 0 ? (
        <Card><div className="card-body">
          <EmptyState icon={ClipboardList} title="No care loops" message={filter === 'all' ? 'No clinical workflows were detected in the available record.' : `No ${filter.toLowerCase()} care loops were found.`} />
        </div></Card>
      ) : (
        <div className="space-y-4">
          {loops.map((loop) => {
            const missing = loop.stages.filter(s => !s.documented);
            return (
              <Card key={loop.id}>
                <div className="card-header">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-slate-900">{loop.name}</h3>
                        <Badge variant="default" className="bg-slate-100 text-slate-600">{loop.type}</Badge>
                        <LoopBadge status={loop.status} />
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Ordered: {loop.orderedDate ? new Date(`${loop.orderedDate}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'not documented'}
                        {loop.completedDate ? ` · Completed: ${new Date(`${loop.completedDate}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
                        {loop.lastMention ? ` · Last mention: ${new Date(`${loop.lastMention}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="card-body">
                  {/* Stage chain */}
                  <div className="flex items-center gap-0 overflow-x-auto pb-2">
                    {loop.stages.map((stage, i) => (
                      <div key={i} className="flex items-center flex-shrink-0">
                        <div className="flex flex-col items-center gap-1.5 min-w-[110px]">
                          <StageIcon documented={stage.documented} />
                          <div className="text-center">
                            <div className="text-xs font-medium text-slate-700">{stage.stage}</div>
                            <div className="text-[11px] text-slate-400">{stage.date ? new Date(`${stage.date}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}</div>
                          </div>
                        </div>
                        {i < loop.stages.length - 1 && (
                          <div className={`w-8 h-0.5 mx-1 mb-6 ${stage.documented ? 'bg-green-400' : 'bg-slate-200'}`} aria-hidden="true" />
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Stage notes */}
                  <div className="mt-4 space-y-2">
                    {loop.stages.map((stage, i) => (
                      <div key={i} className={`flex items-start gap-2.5 text-sm ${stage.documented ? 'text-slate-700' : 'text-amber-700'}`}>
                        {stage.documented ? (
                          <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
                        )}
                        <span>
                          <span className="font-medium">{stage.stage}:</span> {stage.note}
                        </span>
                      </div>
                    ))}
                  </div>

                  {loop.result && (
                    <div className="mt-4 p-3 bg-green-50/60 border border-green-200 rounded-lg">
                      <div className="text-xs font-medium text-green-700 mb-1">Documented result</div>
                      <p className="text-sm text-slate-700">{loop.result}</p>
                    </div>
                  )}

                  <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
                    <EvidenceList evidence={loop.evidence} limit={3} />
                    <button
                      onClick={() => setEvidence({ open: true, data: loop.evidence, title: `Evidence: ${loop.name}` })}
                      className="text-xs font-medium text-brand-600 hover:underline"
                    >
                      View all evidence
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <EvidenceDrawer
        open={evidence.open}
        onClose={() => setEvidence({ open: false, data: null, title: 'Evidence' })}
        evidence={evidence.data}
        title={evidence.title}
      />
    </div>
  );
}