import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { usePatientStore } from '../store/patient';
import { useAuthStore } from '../store/auth';
import { DateLabel, EmptyState, EvidenceList, EvidenceDrawer } from '../components/Clinical';
import { Card, Badge, Spinner, Button } from '../components/UI';
import { History, Filter, ChevronDown, ChevronRight, FileText } from 'lucide-react';
import type { ClinicalEvent } from '../../../shared/clinical/types.js';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'Encounter', label: 'Visits' },
  { key: 'Admission', label: 'Admissions' },
  { key: 'Medication', label: 'Medications' },
  { key: 'Investigation', label: 'Investigations' },
  { key: 'Procedure', label: 'Procedures' },
  { key: 'Referral', label: 'Referrals' },
  { key: 'Follow-up', label: 'Follow-ups' },
  { key: 'Finding', label: 'Findings' },
] as const;

export default function PatientTimeline() {
  const { id } = useParams<{ id: string }>();
  const [search] = useSearchParams();
  const isDemo = search.get('demo') === '1';
  const { current, loading, error, loadDemo, loadLive } = usePatientStore();
  const { user } = useAuthStore();
  const [filter, setFilter] = useState<string>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [evidence, setEvidence] = useState<{ open: boolean; data: any; title: string }>({ open: false, data: null, title: 'Evidence' });

  useEffect(() => {
    if (!id) return;
    if (isDemo) loadDemo(id);
    else if (user) loadLive(id);
  }, [id, isDemo, user]);

  const events = useMemo(() => {
    if (!current) return [];
    const sorted = [...current.analysis.events].sort((a, b) => {
      const ka = a.date ? new Date(`${a.date}T00:00:00Z`).getTime() : -Infinity;
      const kb = b.date ? new Date(`${b.date}T00:00:00Z`).getTime() : -Infinity;
      return kb - ka;
    });
    if (filter === 'all') return sorted;
    return sorted.filter(e => e.type === filter);
  }, [current, filter]);

  if (loading) return <div className="flex justify-center py-24"><Spinner size="lg" /></div>;
  if (error) return <Card className="max-w-xl mx-auto mt-10"><div className="empty-state"><History className="w-12 h-12 text-amber-500" /><p>{error}</p></div></Card>;
  if (!current) return null;

  const toggle = (eid: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(eid)) next.delete(eid); else next.add(eid);
      return next;
    });
  };

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of current.analysis.events) m.set(e.type, (m.get(e.type) ?? 0) + 1);
    return m;
  }, [current]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Clinical timeline</h1>
        <p className="text-sm text-slate-500 mt-1">
          {current.analysis.events.length} events across {current.analysis.documents.length} document{current.analysis.documents.length === 1 ? '' : 's'}
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-4 h-4 text-slate-400" aria-hidden="true" />
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === f.key
                ? 'bg-brand-600 text-white'
                : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'
            }`}
            aria-pressed={filter === f.key}
          >
            {f.label}
            {f.key !== 'all' && counts.get(f.key) ? <span className="ml-1.5 opacity-70">{counts.get(f.key)}</span> : null}
          </button>
        ))}
      </div>

      <Card>
        <div className="card-body">
          {events.length === 0 ? (
            <EmptyState icon={History} title="No events" message={filter === 'all' ? 'No clinical events could be extracted from the available record.' : `No ${FILTERS.find(f => f.key === filter)?.label.toLowerCase()} events were found in the available record.`} />
          ) : (
            <ol className="relative border-l border-slate-200 ml-3 space-y-2">
              {events.map((e) => {
                const isOpen = expanded.has(e.id);
                return (
                  <li key={e.id} className="ml-6 relative">
                    <span className="absolute -left-[31px] w-3 h-3 rounded-full bg-brand-500 ring-4 ring-brand-100" aria-hidden="true" />
                    <div className="border border-slate-200 rounded-lg overflow-hidden transition-colors hover:border-slate-300">
                      <button
                        onClick={() => toggle(e.id)}
                        className="w-full text-left px-4 py-3 flex items-start gap-3"
                        aria-expanded={isOpen}
                      >
                        <span className="mt-1 text-slate-400 flex-shrink-0">
                          {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <DateLabel date={e.date} />
                            <Badge variant="default" className="bg-slate-100 text-slate-600">{e.type}</Badge>
                          </div>
                          <p className="font-medium text-sm text-slate-900 mt-0.5">{e.title}</p>
                        </div>
                      </button>
                      {isOpen && (
                        <div className="px-4 pb-4 pt-0 ml-7 border-t border-slate-100 animate-accordion">
                          <p className="text-sm text-slate-600 mt-3 leading-relaxed">{e.description}</p>
                          <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
                            <EvidenceList evidence={[e.evidence]} limit={2} />
                            <button
                              onClick={() => setEvidence({ open: true, data: e.evidence, title: `Evidence: ${e.title}` })}
                              className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
                            >
                              <FileText className="w-3.5 h-3.5" /> View evidence
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
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