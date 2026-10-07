import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { usePatientStore } from '../store/patient';
import { useAuthStore } from '../store/auth';
import { MedicationStatusBadge, DateLabel, EmptyState, EvidenceList, EvidenceDrawer, ChangeBadge } from '../components/Clinical';
import { Card, Spinner, Badge } from '../components/UI';
import { Pill, ArrowUpRight, ArrowDownRight, Minus, StopCircle, PlayCircle } from 'lucide-react';
import type { MedicationChange } from '../../../shared/clinical/types.js';

function ChangeIcon({ kind }: { kind: MedicationChange['kind'] }) {
  switch (kind) {
    case 'STARTED': return <PlayCircle className="w-4 h-4 text-blue-600" aria-hidden="true" />;
    case 'STOPPED': return <StopCircle className="w-4 h-4 text-slate-500" aria-hidden="true" />;
    case 'DOSE_INCREASED': return <ArrowUpRight className="w-4 h-4 text-amber-600" aria-hidden="true" />;
    case 'DOSE_DECREASED': return <ArrowDownRight className="w-4 h-4 text-amber-600" aria-hidden="true" />;
    default: return <Minus className="w-4 h-4 text-slate-400" aria-hidden="true" />;
  }
}

const CHANGE_LABEL: Record<MedicationChange['kind'], string> = {
  STARTED: 'Started',
  STOPPED: 'Stopped',
  DOSE_INCREASED: 'Dose increased',
  DOSE_DECREASED: 'Dose decreased',
  DOSE_UNCHANGED: 'Dose unchanged',
  FREQUENCY_CHANGED: 'Frequency changed',
  CONFLICTING: 'Conflicting',
};

export default function PatientMedications() {
  const { id } = useParams<{ id: string }>();
  const [search] = useSearchParams();
  const isDemo = search.get('demo') === '1';
  const { current, loading, error, loadDemo, loadLive } = usePatientStore();
  const { user } = useAuthStore();
  const [view, setView] = useState<'current' | 'history' | 'changes'>('current');
  const [evidence, setEvidence] = useState<{ open: boolean; data: any; title: string }>({ open: false, data: null, title: 'Evidence' });

  useEffect(() => {
    if (!id) return;
    if (isDemo) loadDemo(id);
    else if (user) loadLive(id);
  }, [id, isDemo, user]);

  const meds = useMemo(() => {
    if (!current) return [];
    return current.analysis.medications;
  }, [current]);

  const activeMeds = meds.filter(m => m.status === 'ACTIVE');
  const stoppedMeds = meds.filter(m => m.status !== 'ACTIVE');
  const changes = useMemo(() => (current ? current.analysis.medicationChanges : []), [current]);

  if (loading) return <div className="flex justify-center py-24"><Spinner size="lg" /></div>;
  if (error) return <Card className="max-w-xl mx-auto mt-10"><div className="empty-state"><Pill className="w-12 h-12 text-amber-500" /><p>{error}</p></div></Card>;
  if (!current) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Medication intelligence</h1>
          <p className="text-sm text-slate-500 mt-1">
            {activeMeds.length} active · {stoppedMeds.length} stopped/completed · {changes.length} documented changes
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(['current', 'history', 'changes'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                view === v ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'
              }`}
              aria-pressed={view === v}
            >
              {v === 'current' ? 'Current' : v === 'history' ? 'History' : 'Changes'}
            </button>
          ))}
        </div>
      </div>

      {view === 'current' && (
        <div className="space-y-6">
          <Card>
            <div className="card-header">
              <h2 className="text-lg font-semibold text-slate-900">Active medications</h2>
              <p className="text-sm text-slate-500">Documented as active in the available record</p>
            </div>
            <div className="card-body">
              {activeMeds.length === 0 ? (
                <EmptyState icon={Pill} title="No active medications" message="No medications are documented as active in the available record." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Medication</th>
                        <th>Dose</th>
                        <th>Frequency</th>
                        <th>Route</th>
                        <th>Documented</th>
                        <th>Reason</th>
                        <th>Evidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeMeds.map((m) => (
                        <tr key={m.id}>
                          <td className="font-medium text-slate-900">{m.name}</td>
                          <td className="text-slate-700">{m.dose ?? '—'}</td>
                          <td className="text-slate-700">{m.frequency ?? '—'}</td>
                          <td className="text-slate-700">{m.route ?? '—'}</td>
                          <td><DateLabel date={m.startDate} /></td>
                          <td className="text-slate-600 max-w-xs">{m.documentedReason ?? '—'}</td>
                          <td>
                            <div className="flex items-center gap-2">
                              <EvidenceList evidence={[m.evidence]} limit={1} />
                              <button onClick={() => setEvidence({ open: true, data: m.evidence, title: `Evidence: ${m.name}` })} className="text-xs text-brand-600 hover:underline">Details</button>
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

          <Card>
            <div className="card-header">
              <h2 className="text-lg font-semibold text-slate-900">Stopped / completed</h2>
              <p className="text-sm text-slate-500">No longer documented as active</p>
            </div>
            <div className="card-body">
              {stoppedMeds.length === 0 ? (
                <EmptyState icon={Pill} title="None" message="No stopped or completed medications were found in the available record." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr><th>Medication</th><th>Dose</th><th>Status</th><th>Started</th><th>Stopped</th><th>Evidence</th></tr>
                    </thead>
                    <tbody>
                      {stoppedMeds.map((m) => (
                        <tr key={m.id}>
                          <td className="font-medium text-slate-900">{m.name}</td>
                          <td className="text-slate-700">{m.dose ?? '—'}</td>
                          <td><MedicationStatusBadge status={m.status} /></td>
                          <td><DateLabel date={m.startDate} /></td>
                          <td><DateLabel date={m.stopDate} /></td>
                          <td>
                            <div className="flex items-center gap-2">
                              <EvidenceList evidence={[m.evidence]} limit={1} />
                              <button onClick={() => setEvidence({ open: true, data: m.evidence, title: `Evidence: ${m.name}` })} className="text-xs text-brand-600 hover:underline">Details</button>
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
        </div>
      )}

      {view === 'history' && (
        <Card>
          <div className="card-header">
            <h2 className="text-lg font-semibold text-slate-900">Full medication history</h2>
            <p className="text-sm text-slate-500">Every documented medication entry with provenance</p>
          </div>
          <div className="card-body">
            {meds.length === 0 ? (
              <EmptyState icon={Pill} title="No medications" message="No medications could be extracted from the available record." />
            ) : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr><th>Medication</th><th>Dose</th><th>Frequency</th><th>Route</th><th>Status</th><th>Start</th><th>Stop</th><th>Source</th></tr>
                  </thead>
                  <tbody>
                    {meds.map((m) => (
                      <tr key={m.id}>
                        <td className="font-medium text-slate-900">{m.name}</td>
                        <td className="text-slate-700">{m.dose ?? '—'}</td>
                        <td className="text-slate-700">{m.frequency ?? '—'}</td>
                        <td className="text-slate-700">{m.route ?? '—'}</td>
                        <td><MedicationStatusBadge status={m.status} /></td>
                        <td><DateLabel date={m.startDate} /></td>
                        <td><DateLabel date={m.stopDate} /></td>
                        <td>
                          <div className="flex items-center gap-2">
                            <EvidenceList evidence={[m.evidence]} limit={1} />
                            <button onClick={() => setEvidence({ open: true, data: m.evidence, title: `Evidence: ${m.name}` })} className="text-xs text-brand-600 hover:underline">Details</button>
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
      )}

      {view === 'changes' && (
        <Card>
          <div className="card-header">
            <h2 className="text-lg font-semibold text-slate-900">Medication changes</h2>
            <p className="text-sm text-slate-500">Dose and frequency transitions detected across the record</p>
          </div>
          <div className="card-body">
            {changes.length === 0 ? (
              <EmptyState icon={Pill} title="No changes detected" message="No medication changes were detected in the available record." />
            ) : (
              <div className="space-y-3">
                {changes.map((c) => (
                  <div key={c.id} className="p-4 border border-slate-200 rounded-lg">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5"><ChangeIcon kind={c.kind} /></div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-slate-900">{c.medicationName}</span>
                            <Badge variant="default" className="bg-slate-100 text-slate-600">{CHANGE_LABEL[c.kind]}</Badge>
                          </div>
                          <p className="text-sm text-slate-600 mt-1">
                            {c.previousDose ?? 'dose not documented'}
                            {c.previousFrequency ? ` ${c.previousFrequency}` : ''}
                            {' → '}
                            {c.newDose ?? 'dose not documented'}
                            {c.newFrequency ? ` ${c.newFrequency}` : ''}
                          </p>
                          {c.documentedReason && (
                            <p className="text-xs text-slate-500 mt-1">Documented reason: {c.documentedReason}</p>
                          )}
                        </div>
                      </div>
                      <DateLabel date={c.date} />
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
                      <EvidenceList evidence={c.evidence} limit={2} />
                      <button onClick={() => setEvidence({ open: true, data: c.evidence, title: `Evidence: ${c.medicationName} change` })} className="text-xs font-medium text-brand-600 hover:underline">
                        View all evidence
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
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