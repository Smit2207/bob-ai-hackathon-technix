import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { usePatientStore } from '../store/patient';
import { useAuthStore } from '../store/auth';
import { EmptyState, SectionHeader } from '../components/Clinical';
import { Card, Spinner, Badge } from '../components/UI';
import { Activity } from 'lucide-react';
import { computeAnalytics } from '../../../shared/clinical/analytics.js';

export default function PatientAnalytics() {
  const { id } = useParams<{ id: string }>();
  const [search] = useSearchParams();
  const isDemo = search.get('demo') === '1';
  const { current, loading, error, loadDemo, loadLive } = usePatientStore();
  const { user } = useAuthStore();

  useEffect(() => {
    if (!id) return;
    if (isDemo) loadDemo(id);
    else if (user) loadLive(id);
  }, [id, isDemo, user]);

  const analytics = useMemo(() => (current ? computeAnalytics(current.analysis) : null), [current]);

  if (loading) return <div className="flex justify-center py-24"><Spinner size="lg" /></div>;
  if (error) return <Card className="max-w-xl mx-auto mt-10"><div className="empty-state"><Activity className="w-12 h-12 text-amber-500" /><p>{error}</p></div></Card>;
  if (!current || !analytics) return null;

  const maxMonth = Math.max(1, ...analytics.eventsByMonth.map(m => m.value));
  const maxType = Math.max(1, ...analytics.eventsByType.map(m => m.value));

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Record analytics</h1>
        <p className="text-sm text-slate-500 mt-1">
          Patient-level analytics derived only from the actual extracted record.
        </p>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        {[
          { label: 'Documents', value: analytics.totals.documents },
          { label: 'Events', value: analytics.totals.events },
          { label: 'Medications', value: analytics.totals.medications },
          { label: 'Med changes', value: analytics.totals.medicationChanges },
          { label: 'Investigations', value: analytics.totals.investigations },
          { label: 'Evidence refs', value: analytics.totals.evidenceReferences },
        ].map(t => (
          <div key={t.label} className="p-4 rounded-xl border border-slate-200 bg-white">
            <div className="text-2xl font-semibold text-slate-900">{t.value}</div>
            <div className="text-xs font-medium text-slate-500 mt-0.5">{t.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Events by month */}
        <Card>
          <div className="card-header">
            <SectionHeader title="Events by month" subtitle="Documented clinical activity over time" />
          </div>
          <div className="card-body">
            {analytics.eventsByMonth.length === 0 ? (
              <EmptyState icon={Activity} title="No dated events" message="No dated events were found in the available record." />
            ) : (
              <div className="space-y-3">
                {analytics.eventsByMonth.map(m => (
                  <div key={m.month}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-slate-600">{m.label}</span>
                      <span className="text-slate-400">{m.value}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand-500 rounded-full transition-all duration-300"
                        style={{ width: `${(m.value / maxMonth) * 100}%` }}
                        role="img"
                        aria-label={`${m.label}: ${m.value} events`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Events by type */}
        <Card>
          <div className="card-header">
            <SectionHeader title="Events by type" subtitle="Distribution of clinical event types" />
          </div>
          <div className="card-body">
            {analytics.eventsByType.length === 0 ? (
              <EmptyState icon={Activity} title="No events" message="No clinical events were found in the available record." />
            ) : (
              <div className="space-y-3">
                {analytics.eventsByType.map(t => (
                  <div key={t.label} className="flex items-center gap-3">
                    <span className="text-sm text-slate-600 w-28 flex-shrink-0">{t.label}</span>
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-teal-500 rounded-full transition-all duration-300"
                        style={{ width: `${(t.value / maxType) * 100}%` }}
                        role="img"
                        aria-label={`${t.label}: ${t.value}`}
                      />
                    </div>
                    <span className="text-sm font-medium text-slate-700 w-8 text-right">{t.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Care loops by status */}
        <Card>
          <div className="card-header">
            <SectionHeader title="Care loops by status" subtitle="Workflow completion state" />
          </div>
          <div className="card-body">
            <div className="grid grid-cols-3 gap-3">
              {analytics.careLoopsByStatus.map(s => (
                <div key={s.label} className={`p-4 rounded-xl border text-center ${
                  s.label === 'OPEN' ? 'border-red-200 bg-red-50/50' :
                  s.label === 'RESOLVED' ? 'border-green-200 bg-green-50/50' :
                  'border-amber-200 bg-amber-50/50'
                }`}>
                  <div className="text-2xl font-semibold text-slate-900">{s.value}</div>
                  <div className="text-xs font-medium text-slate-500 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Attention breakdown */}
        <Card>
          <div className="card-header">
            <SectionHeader title="Attention breakdown" subtitle="What was prioritised for review" />
          </div>
          <div className="card-body">
            {analytics.attentionBreakdown.length === 0 ? (
              <EmptyState icon={Activity} title="No attention items" message="No items were prioritised for review." />
            ) : (
              <div className="space-y-2">
                {analytics.attentionBreakdown.map(a => (
                  <div key={a.label} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg">
                    <span className="text-sm text-slate-700">{a.label}</span>
                    <span className="text-sm font-semibold text-slate-900">{a.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Lab table */}
      <Card>
        <div className="card-header">
          <SectionHeader title="Laboratory results" subtitle="Latest value per test, with provenance" />
        </div>
        <div className="card-body">
          {analytics.labTable.length === 0 ? (
            <EmptyState icon={Activity} title="No laboratory results" message="No laboratory results were extracted from the available record." />
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Test</th>
                    <th>Latest value</th>
                    <th>Reference</th>
                    <th>Date</th>
                    <th>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.labTable.map(l => (
                    <tr key={l.test}>
                      <td className="font-medium text-slate-900">{l.test}</td>
                      <td className="text-slate-700">{l.latest}</td>
                      <td className="text-slate-500">{l.referenceRange ?? '—'}</td>
                      <td className="text-slate-500">{l.date ? new Date(`${l.date}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td>
                      <td className="text-slate-500 text-xs">{l.documentName}{l.page > 0 ? `, p.${l.page}` : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      {/* Recent activity */}
      <Card>
        <div className="card-header">
          <SectionHeader title="Recent activity" subtitle="Most recent documented items across all categories" />
        </div>
        <div className="card-body">
          {analytics.recentActivity.length === 0 ? (
            <EmptyState icon={Activity} title="No activity" message="No dated activity was found in the available record." />
          ) : (
            <div className="space-y-2">
              {analytics.recentActivity.map((r, i) => (
                <div key={i} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg">
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge variant="default" className="bg-slate-100 text-slate-600 flex-shrink-0">{r.kind}</Badge>
                    <span className="text-sm text-slate-700 truncate">{r.label}</span>
                  </div>
                  <span className="text-xs text-slate-400 flex-shrink-0">{r.date ?? 'undated'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}