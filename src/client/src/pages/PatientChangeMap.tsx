import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { usePatientStore } from '../store/patient';
import { useAuthStore } from '../store/auth';
import { ChangeBadge, DateLabel, EmptyState, EvidenceList, EvidenceDrawer } from '../components/Clinical';
import { Card, Spinner } from '../components/UI';
import { Activity, Filter } from 'lucide-react';
import type { ChangeClass, ChangeMapItem } from '../../../shared/clinical/types.js';

const CLASS_FILTERS: Array<{ key: ChangeClass | 'all'; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'NEW', label: 'New' },
  { key: 'CHANGED', label: 'Changed' },
  { key: 'REPEATED', label: 'Repeated' },
  { key: 'RESOLVED', label: 'Resolved' },
  { key: 'OPEN', label: 'Open' },
  { key: 'CONFLICTING', label: 'Conflicting' },
];

export default function PatientChangeMap() {
  const { id } = useParams<{ id: string }>();
  const [search] = useSearchParams();
  const isDemo = search.get('demo') === '1';
  const { current, loading, error, loadDemo, loadLive } = usePatientStore();
  const { user } = useAuthStore();
  const [filter, setFilter] = useState<ChangeClass | 'all'>('all');
  const [evidence, setEvidence] = useState<{ open: boolean; data: any; title: string }>({ open: false, data: null, title: 'Evidence' });

  useEffect(() => {
    if (!id) return;
    if (isDemo) loadDemo(id);
    else if (user) loadLive(id);
  }, [id, isDemo, user]);

  const items = useMemo(() => {
    if (!current) return [];
    if (filter === 'all') return current.analysis.changeMap;
    return current.analysis.changeMap.filter(c => c.classification === filter);
  }, [current, filter]);

  const counts = useMemo(() => {
    const m = new Map<ChangeClass, number>();
    if (!current) return m;
    for (const c of current.analysis.changeMap) m.set(c.classification, (m.get(c.classification) ?? 0) + 1);
    return m;
  }, [current]);

  if (loading) return <div className="flex justify-center py-24"><Spinner size="lg" /></div>;
  if (error) return <Card className="max-w-xl mx-auto mt-10"><div className="empty-state"><Activity className="w-12 h-12 text-amber-500" /><p>{error}</p></div></Card>;
  if (!current) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">ChangeMap</h1>
        <p className="text-sm text-slate-500 mt-1">
          Every meaningful longitudinal item classified — prioritising meaningful change over repeated history.
        </p>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {CLASS_FILTERS.filter(f => f.key !== 'all').map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`p-4 rounded-xl border text-left transition-colors ${
              filter === f.key ? 'border-brand-500 bg-brand-50' : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
            aria-pressed={filter === f.key}
          >
            <div className="text-2xl font-semibold text-slate-900">{counts.get(f.key as ChangeClass) ?? 0}</div>
            <div className="text-xs font-medium text-slate-500 mt-0.5">{f.label}</div>
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-4 h-4 text-slate-400" aria-hidden="true" />
        {CLASS_FILTERS.map(f => (
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

      <Card>
        <div className="card-body">
          {items.length === 0 ? (
            <EmptyState icon={Activity} title="No items" message={filter === 'all' ? 'No longitudinal items were classified in the available record.' : `No ${filter.toLowerCase()} items were found.`} />
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Classification</th>
                    <th>Entity</th>
                    <th>Type</th>
                    <th>Summary</th>
                    <th>Date</th>
                    <th>Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td><ChangeBadge value={item.classification} /></td>
                      <td className="font-medium text-slate-900">{item.entity}</td>
                      <td className="text-slate-600">{item.entityType}</td>
                      <td className="text-slate-600 max-w-xs">{item.summary}</td>
                      <td><DateLabel date={item.date} /></td>
                      <td>
                        <div className="flex items-center gap-2">
                          <EvidenceList evidence={item.evidence} limit={1} />
                          <button
                            onClick={() => setEvidence({ open: true, data: item.evidence, title: `Evidence: ${item.entity}` })}
                            className="text-xs text-brand-600 hover:underline"
                          >
                            Details
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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