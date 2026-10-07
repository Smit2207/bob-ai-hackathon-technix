import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { usePatientStore } from '../store/patient';
import { useAuthStore } from '../store/auth';
import { InvestigationBadge, DateLabel, EmptyState, EvidenceList, EvidenceDrawer } from '../components/Clinical';
import { Card, Spinner, Badge } from '../components/UI';
import { Stethoscope, AlertTriangle } from 'lucide-react';
import type { Investigation, InvestigationStatus } from '../../../shared/clinical/types.js';

const STATUS_FILTERS: Array<{ key: InvestigationStatus | 'all'; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'ORDERED', label: 'Ordered' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'RESULT_AVAILABLE', label: 'Result available' },
];

export default function PatientInvestigations() {
  const { id } = useParams<{ id: string }>();
  const [search] = useSearchParams();
  const isDemo = search.get('demo') === '1';
  const { current, loading, error, loadDemo, loadLive } = usePatientStore();
  const { user } = useAuthStore();
  const [filter, setFilter] = useState<InvestigationStatus | 'all'>('all');
  const [evidence, setEvidence] = useState<{ open: boolean; data: any; title: string }>({ open: false, data: null, title: 'Evidence' });

  useEffect(() => {
    if (!id) return;
    if (isDemo) loadDemo(id);
    else if (user) loadLive(id);
  }, [id, isDemo, user]);

  const investigations = useMemo(() => {
    if (!current) return [];
    if (filter === 'all') return current.analysis.investigations;
    return current.analysis.investigations.filter(i => i.status === filter);
  }, [current, filter]);

  const outstanding = useMemo(() => (current ? current.analysis.investigations.filter(i => i.status === 'ORDERED' || i.status === 'PENDING' || i.status === 'RESULT_MISSING') : []), [current]);

  if (loading) return <div className="flex justify-center py-24"><Spinner size="lg" /></div>;
  if (error) return <Card className="max-w-xl mx-auto mt-10"><div className="empty-state"><Stethoscope className="w-12 h-12 text-amber-500" /><p>{error}</p></div></Card>;
  if (!current) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Investigation intelligence</h1>
        <p className="text-sm text-slate-500 mt-1">
          {current.analysis.investigations.length} investigations · {outstanding.length} outstanding
        </p>
      </div>

      {/* Outstanding investigations — prominent */}
      {outstanding.length > 0 && (
        <Card className="border-red-200">
          <div className="card-header bg-red-50/50">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" aria-hidden="true" />
              <h2 className="text-lg font-semibold text-slate-900">Outstanding investigations</h2>
              <Badge variant="open">{outstanding.length}</Badge>
            </div>
            <p className="text-sm text-slate-500">Ordered or pending with no completion report in the available record</p>
          </div>
          <div className="card-body">
            <div className="space-y-3">
              {outstanding.map((inv) => (
                <div key={inv.id} className="p-4 border border-red-200 bg-red-50/40 rounded-lg">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-slate-900">{inv.name}</span>
                        <InvestigationBadge status={inv.status} />
                      </div>
                      <p className="text-sm text-slate-600 mt-1">
                        Ordered: {inv.orderedDate ? new Date(`${inv.orderedDate}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'date not documented'}
                      </p>
                    </div>
                    <DateLabel date={inv.orderedDate} />
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
                    <EvidenceList evidence={inv.evidence} limit={2} />
                    <button onClick={() => setEvidence({ open: true, data: inv.evidence, title: `Evidence: ${inv.name}` })} className="text-xs font-medium text-brand-600 hover:underline">
                      View evidence
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Filters */}
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

      <Card>
        <div className="card-body">
          {investigations.length === 0 ? (
            <EmptyState icon={Stethoscope} title="No investigations" message={filter === 'all' ? 'No investigations could be extracted from the available record.' : `No ${filter.toLowerCase().replace(/_/g, ' ')} investigations were found.`} />
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Investigation</th>
                    <th>Status</th>
                    <th>Ordered</th>
                    <th>Performed</th>
                    <th>Result</th>
                    <th>Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {investigations.map((inv) => (
                    <tr key={inv.id}>
                      <td className="font-medium text-slate-900">{inv.name}</td>
                      <td><InvestigationBadge status={inv.status} /></td>
                      <td><DateLabel date={inv.orderedDate} /></td>
                      <td><DateLabel date={inv.performedDate} /></td>
                      <td className="text-slate-600 max-w-xs">{inv.result ?? '—'}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <EvidenceList evidence={inv.evidence} limit={1} />
                          <button onClick={() => setEvidence({ open: true, data: inv.evidence, title: `Evidence: ${inv.name}` })} className="text-xs text-brand-600 hover:underline">Details</button>
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