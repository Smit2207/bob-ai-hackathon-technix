import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { usePatientStore } from '../store/patient';
import { useAuthStore } from '../store/auth';
import { api } from '../utils/api';
import { EmptyState, SectionHeader } from '../components/Clinical';
import { Card, Spinner, Badge, Button } from '../components/UI';
import { GitCompare, ArrowRight } from 'lucide-react';
import { compareRecords } from '../../../shared/clinical/compare.js';
import type { ComparisonRow } from '../../../shared/clinical/compare.js';

export default function PatientCompare() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const isDemo = search.get('demo') === '1';
  const { current, loadDemo, loadLive } = usePatientStore();
  const [aId, setAId] = useState('');
  const [bId, setBId] = useState('');
  const [patients, setPatients] = useState<any[]>([]);
  const [result, setResult] = useState<{ rows: ComparisonRow[]; summary: Record<string, number> } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    api.patients.list().then(setPatients).catch(() => {});
  }, [user]);

  const compare = async () => {
    if (!aId || !bId) return;
    setLoading(true);
    setError(null);
    try {
      if (isDemo) {
        // Demo mode: compare two demo records client-side
        const { loadDemoRecord } = await import('../demo/engine.js');
        const ra = loadDemoRecord(aId);
        const rb = loadDemoRecord(bId);
        setResult(compareRecords(ra.analysis, rb.analysis));
      } else {
        const res = await api.patients.compare(aId, bId);
        setResult(res);
      }
    } catch (e: any) {
      setError(e.message ?? 'Comparison failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Compare records</h1>
        <p className="text-sm text-slate-500 mt-1">
          Clinical differences between two records. Only actual differences are reported.
        </p>
      </div>

      <Card>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="compare-a">Earlier record</label>
              <select id="compare-a" className="input" value={aId} onChange={e => setAId(e.target.value)}>
                <option value="">Select a record…</option>
                {isDemo ? (
                  <>
                    <option value="demo-patient-1">Arjun Mehta (demo)</option>
                    <option value="demo-patient-2">Sarah Chen (demo)</option>
                    <option value="demo-patient-3">Michael Okonkwo (demo)</option>
                  </>
                ) : (
                  patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)
                )}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="compare-b">Later record</label>
              <select id="compare-b" className="input" value={bId} onChange={e => setBId(e.target.value)}>
                <option value="">Select a record…</option>
                {isDemo ? (
                  <>
                    <option value="demo-patient-1">Arjun Mehta (demo)</option>
                    <option value="demo-patient-2">Sarah Chen (demo)</option>
                    <option value="demo-patient-3">Michael Okonkwo (demo)</option>
                  </>
                ) : (
                  patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)
                )}
              </select>
            </div>
          </div>
          <div className="mt-4">
            <Button onClick={compare} disabled={!aId || !bId || loading || aId === bId}>
              <GitCompare className="w-4 h-4" />
              {loading ? 'Comparing…' : 'Compare'}
            </Button>
            {aId === bId && aId && <p className="text-xs text-amber-600 mt-2">Select two different records to compare.</p>}
          </div>
        </div>
      </Card>

      {error && (
        <Card className="border-red-200"><div className="card-body"><p className="text-sm text-red-700">{error}</p></div></Card>
      )}

      {loading && <div className="flex justify-center py-12"><Spinner size="lg" /></div>}

      {result && !loading && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {Object.entries(result.summary).map(([cat, count]) => (
              <div key={cat} className="p-4 rounded-xl border border-slate-200 bg-white">
                <div className="text-2xl font-semibold text-slate-900">{count}</div>
                <div className="text-xs font-medium text-slate-500 mt-0.5">{cat}</div>
              </div>
            ))}
          </div>

          <Card>
            <div className="card-header">
              <SectionHeader title="Differences" subtitle={`${result.rows.length} difference${result.rows.length === 1 ? '' : 's'} found`} />
            </div>
            <div className="card-body">
              {result.rows.length === 0 ? (
                <EmptyState icon={GitCompare} title="No differences" message="The two records are equivalent across all compared categories." />
              ) : (
                <div className="space-y-3">
                  {result.rows.map((row, i) => (
                    <div key={i} className="p-4 border border-slate-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <Badge variant="default" className="bg-brand-50 text-brand-700 border border-brand-100">{row.category}</Badge>
                        <span className="font-medium text-sm text-slate-900">{row.subject}</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                        <div className="p-2.5 bg-slate-50 rounded">
                          <div className="text-xs text-slate-400 mb-0.5">Earlier</div>
                          <div className="text-slate-700">{row.earlier}</div>
                        </div>
                        <div className="flex items-center justify-center">
                          <ArrowRight className="w-4 h-4 text-slate-300" aria-hidden="true" />
                        </div>
                        <div className="p-2.5 bg-brand-50/50 rounded">
                          <div className="text-xs text-brand-600 mb-0.5">Later</div>
                          <div className="text-slate-700">{row.later}</div>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 mt-2">{row.difference}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}