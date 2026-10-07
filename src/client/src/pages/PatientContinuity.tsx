import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { usePatientStore } from '../store/patient';
import { useAuthStore } from '../store/auth';
import {
  ChangeBadge, LoopBadge, EvidenceList, EvidenceDrawer, DateLabel,
  EmptyState, SectionHeader,
} from '../components/Clinical';
import { Button, Card, Badge, Spinner, Modal } from '../components/UI';
import {
  AlertTriangle, Activity, History, CheckCircle2, FileText, Stethoscope,
  Pill, Search, ClipboardList, ArrowRight, ShieldAlert, CircleDot,
  Upload, Loader2, CheckCircle,
} from 'lucide-react';
import { formatDate } from '../../../shared/clinical/text.js';
import { DEMO_DISCLAIMER } from '../../../shared/demo/records.js';
import { api } from '../utils/api.js';

export default function PatientContinuity() {
  const { id } = useParams<{ id: string }>();
  const [search] = useSearchParams();
  const isDemo = search.get('demo') === '1';
  const { current, loading, error, loadDemo, loadLive } = usePatientStore();
  const { user } = useAuthStore();
  const [evidence, setEvidence] = useState<{ open: boolean; data: any; title: string }>({ open: false, data: null, title: 'Evidence' });

  // Upload state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const [uploadErr, setUploadErr] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!id) return;
    if (isDemo) loadDemo(id);
    else if (user) loadLive(id);
  }, [id, isDemo, user]);

  const handleUpload = async () => {
    if (!id || !uploadFile) return;
    setUploading(true);
    setUploadErr('');
    try {
      await api.patients.upload(id, uploadFile);
      setUploadDone(true);
      setTimeout(() => {
        setUploadOpen(false);
        setUploadDone(false);
        setUploadFile(null);
        loadLive(id);
      }, 1000);
    } catch (e: any) {
      setUploadErr(e.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Spinner size="lg" />
        <p className="text-sm text-slate-500">Analysing clinical record…</p>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="max-w-xl mx-auto mt-10">
        <div className="empty-state">
          <AlertTriangle className="w-12 h-12 text-amber-500" />
          <h3 className="text-lg font-medium text-slate-900 mt-2">Could not load record</h3>
          <p className="text-sm text-slate-500 mt-1">{error}</p>
          <Button variant="secondary" className="mt-4" onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </Card>
    );
  }

  if (!current) return null;
  const a = current.analysis;
  const openLoops = a.careLoops.filter(l => l.status === 'OPEN');
  const resolvedLoops = a.careLoops.filter(l => l.status === 'RESOLVED');
  const changedItems = a.changeMap.filter(c => c.classification === 'CHANGED');
  const newItems = a.changeMap.filter(c => c.classification === 'NEW');
  const recentlyResolved = a.changeMap.filter(c => c.classification === 'RESOLVED');
  const conflicts = a.conflicts;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-900">{a.patient.name ?? 'Patient name not documented'}</h1>
            {current.demo && <Badge variant="default" className="bg-amber-50 text-amber-700 border border-amber-200">SYNTHETIC DEMO</Badge>}
          </div>
          <p className="text-sm text-slate-500 mt-1">
            {a.patient.age ? `Age ${a.patient.age}` : 'Age not documented'}
            {a.patient.sex ? ` · ${a.patient.sex}` : ''}
            {a.patient.patientId ? ` · MRN ${a.patient.patientId}` : ''}
            {a.patient.recordStart && a.patient.recordEnd ? ` · Record ${formatDate(a.patient.recordStart)} – ${formatDate(a.patient.recordEnd)}` : ''}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {a.documents.length} document{a.documents.length === 1 ? '' : 's'} analysed
            {a.documents.length > 0 && `: ${a.documents.map(d => d.name).join(', ')}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {!isDemo && (
            <Button variant="secondary" size="sm" onClick={() => setUploadOpen(true)}>
              <Upload className="w-4 h-4" /> Add Document
            </Button>
          )}
          <Link to={`/patients/${current.id}/briefs${isDemo ? '?demo=1' : ''}`}>
            <Button variant="secondary" size="sm"><FileText className="w-4 h-4" /> Briefs</Button>
          </Link>
          <Link to={`/patients/${current.id}/evidence${isDemo ? '?demo=1' : ''}`}>
            <Button variant="secondary" size="sm"><Search className="w-4 h-4" /> Evidence</Button>
          </Link>
        </div>
      </div>

      {current.demo && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">{DEMO_DISCLAIMER}</p>
        </div>
      )}

      {/* Warnings */}
      {a.warnings.length > 0 && (
        <div className="space-y-2">
          {a.warnings.map((w, i) => (
            <div key={i} className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 flex items-start gap-2">
              <CircleDot className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
              {w}
            </div>
          ))}
        </div>
      )}

      {/* Current state */}
      <Card>
        <div className="card-header">
          <SectionHeader title="Current state" subtitle="Derived only from what is documented in the available record" />
        </div>
        <div className="card-body">
          <ul className="space-y-2.5">
            {a.currentState.map((line, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700">
                <CheckCircle2 className="w-4 h-4 text-brand-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      </Card>

      {/* Attention required */}
      <Card>
        <div className="card-header flex items-center justify-between">
          <SectionHeader title="Attention required" subtitle={`${a.attention.length} item${a.attention.length === 1 ? '' : 's'} prioritised for review`} />
          <Badge variant="open">{a.attention.length}</Badge>
        </div>
        <div className="card-body">
          {a.attention.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="Nothing requires attention" message="No open care loops, documentation conflicts or significant changes were detected in the available record." />
          ) : (
            <div className="space-y-3">
              {a.attention.slice(0, 8).map((item) => (
                <button
                  key={item.id}
                  onClick={() => setEvidence({ open: true, data: item.evidence, title: `Why surfaced: ${item.title}` })}
                  className="w-full text-left p-4 border border-slate-200 rounded-lg hover:border-brand-300 hover:bg-brand-50/40 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        item.kind === 'Open Care Loop' ? 'bg-red-50 text-red-600' :
                        item.kind === 'Documentation Conflict' ? 'bg-red-50 text-red-600' :
                        item.kind === 'Medication Change' ? 'bg-amber-50 text-amber-600' :
                        item.kind === 'Recently Resolved' ? 'bg-green-50 text-green-600' :
                        'bg-blue-50 text-blue-600'
                      }`}>
                        {item.kind === 'Open Care Loop' ? <ClipboardList className="w-5 h-5" /> :
                         item.kind === 'Documentation Conflict' ? <AlertTriangle className="w-5 h-5" /> :
                         item.kind === 'Medication Change' ? <Pill className="w-5 h-5" /> :
                         item.kind === 'Recently Resolved' ? <CheckCircle2 className="w-5 h-5" /> :
                         <Activity className="w-5 h-5" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-slate-900">{item.title}</span>
                          <Badge variant={item.kind === 'Documentation Conflict' ? 'conflict' : item.kind === 'Open Care Loop' ? 'open' : item.kind === 'Recently Resolved' ? 'resolved' : item.kind === 'Medication Change' ? 'changed' : 'new'}>
                            {item.kind}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-600 mt-1">{item.whySurfaced}</p>
                        {item.dates.length > 0 && (
                          <p className="text-xs text-slate-400 mt-1.5">
                            Dates: {item.dates.map(d => formatDate(d)).join(', ')}
                          </p>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-brand-500 flex-shrink-0 mt-1 transition-colors" aria-hidden="true" />
                  </div>
                  <div className="mt-3">
                    <EvidenceList evidence={item.evidence} limit={3} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* What changed */}
        <Card>
          <div className="card-header">
            <SectionHeader title="What changed" subtitle="Meaningful longitudinal change — not repeated history" />
          </div>
          <div className="card-body">
            {changedItems.length === 0 && newItems.length === 0 ? (
              <EmptyState icon={Activity} title="No changes detected" message="No medication changes, new results or status transitions were found in the available record." />
            ) : (
              <div className="space-y-3">
                {[...changedItems, ...newItems].slice(0, 6).map((item) => (
                  <div key={item.id} className="p-3 border border-slate-200 rounded-lg">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="font-medium text-sm text-slate-900">{item.entity}</span>
                      <ChangeBadge value={item.classification} />
                    </div>
                    <p className="text-sm text-slate-600">{item.summary}</p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <DateLabel date={item.date} />
                      <button onClick={() => setEvidence({ open: true, data: item.evidence, title: `Evidence: ${item.entity}` })} className="text-xs text-brand-600 hover:underline">
                        View evidence
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Recently resolved */}
        <Card>
          <div className="card-header">
            <SectionHeader title="Recently resolved" subtitle="Items that now have completion evidence" />
          </div>
          <div className="card-body">
            {recentlyResolved.length === 0 ? (
              <EmptyState icon={CheckCircle2} title="Nothing recently resolved" message="No previously outstanding items gained completion evidence in the available record." />
            ) : (
              <div className="space-y-3">
                {recentlyResolved.slice(0, 6).map((item) => (
                  <div key={item.id} className="p-3 border border-green-200 bg-green-50/40 rounded-lg">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="font-medium text-sm text-slate-900">{item.entity}</span>
                      <ChangeBadge value="RESOLVED" />
                    </div>
                    <p className="text-sm text-slate-600">{item.summary}</p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <DateLabel date={item.date} />
                      <button onClick={() => setEvidence({ open: true, data: item.evidence, title: `Evidence: ${item.entity}` })} className="text-xs text-brand-600 hover:underline">
                        View evidence
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Open care loops summary */}
        <Card>
          <div className="card-header">
            <SectionHeader title="Open care loops" subtitle={`${openLoops.length} workflow${openLoops.length === 1 ? '' : 's'} with an incomplete chain`} />
          </div>
          <div className="card-body">
            {openLoops.length === 0 ? (
              <EmptyState icon={CheckCircle2} title="No open care loops" message="Every detected workflow has a complete documented chain in the available record." />
            ) : (
              <div className="space-y-3">
                {openLoops.slice(0, 5).map((loop) => (
                  <Link
                    key={loop.id}
                    to={`/patients/${current.id}/careloop${isDemo ? '?demo=1' : ''}`}
                    className="block p-3 border border-red-200 bg-red-50/40 rounded-lg hover:border-red-300 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="font-medium text-sm text-slate-900">{loop.name}</span>
                      <LoopBadge status="OPEN" />
                    </div>
                    <p className="text-xs text-slate-600">
                      Missing: {loop.stages.filter(s => !s.documented).map(s => s.stage).join(', ') || 'none'}
                    </p>
                    <div className="mt-2"><DateLabel date={loop.orderedDate} /></div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Documentation conflicts summary */}
        <Card>
          <div className="card-header">
            <SectionHeader title="Documentation drift" subtitle={`${conflicts.length} conflict${conflicts.length === 1 ? '' : 's'} requiring review`} />
          </div>
          <div className="card-body">
            {conflicts.length === 0 ? (
              <EmptyState icon={CheckCircle2} title="No documentation conflicts" message="No contradictory documentation was detected across the available record." />
            ) : (
              <div className="space-y-3">
                {conflicts.slice(0, 5).map((c) => (
                  <div key={c.id} className="p-3 border border-red-200 rounded-lg">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="font-medium text-sm text-slate-900">{c.entity}</span>
                      <Badge variant="conflict">Requires review</Badge>
                    </div>
                    <p className="text-xs text-slate-500 mb-1.5">{c.field}</p>
                    <p className="text-sm text-slate-600">{c.interpretation}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {c.entries.slice(0, 3).map((e, i) => (
                        <span key={i} className="text-xs bg-slate-100 text-slate-700 rounded px-1.5 py-0.5">
                          {e.value}{e.date ? ` (${formatDate(e.date)})` : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Longitudinal story */}
      <Card>
        <div className="card-header">
          <SectionHeader
            title="Longitudinal story"
            subtitle="Chronological clinical narrative across all documents"
            action={<Link to={`/patients/${current.id}/timeline${isDemo ? '?demo=1' : ''}`} className="text-sm font-medium text-brand-600 hover:underline">Full timeline</Link>}
          />
        </div>
        <div className="card-body">
          {a.longitudinalStory.length === 0 ? (
            <EmptyState icon={History} title="No dated events" message="No dated clinical events could be extracted from the available record." />
          ) : (
            <ol className="relative border-l border-slate-200 ml-3 space-y-5">
              {a.longitudinalStory.slice(-10).map((e) => (
                <li key={e.id} className="ml-6 relative">
                  <span className="absolute -left-[31px] w-3 h-3 rounded-full bg-brand-500 ring-4 ring-brand-100" aria-hidden="true" />
                  <div className="flex items-center gap-2 flex-wrap">
                    <DateLabel date={e.date} />
                    <Badge variant="default" className="bg-slate-100 text-slate-600">{e.type}</Badge>
                  </div>
                  <p className="font-medium text-sm text-slate-900 mt-0.5">{e.title}</p>
                  <p className="text-sm text-slate-600 mt-0.5 line-clamp-2">{e.description}</p>
                  <div className="mt-1.5"><EvidenceList evidence={[e.evidence]} limit={1} /></div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </Card>

      {/* Next clinician verification list */}
      <Card>
        <div className="card-header">
          <SectionHeader title="What the next clinician should verify" subtitle="Outstanding verification items derived from the record" />
        </div>
        <div className="card-body">
          {a.verifyNext.length === 0 ? (
            <EmptyState icon={Stethoscope} title="No verification items" message="No outstanding verification items were derived from the available record." />
          ) : (
            <ul className="space-y-2.5">
              {a.verifyNext.map((v, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700">
                  <Stethoscope className="w-4 h-4 text-brand-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{v}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      {/* Evidence drawer */}
      <EvidenceDrawer
        open={evidence.open}
        onClose={() => setEvidence({ open: false, data: null, title: 'Evidence' })}
        evidence={evidence.data}
        title={evidence.title}
      />

      {/* Add document modal */}
      <Modal open={uploadOpen} onClose={() => { if (!uploading) { setUploadOpen(false); setUploadFile(null); setUploadErr(''); } }} title="Add Document">
        <div className="space-y-4">
          {uploading || uploadDone ? (
            <div className="py-8 flex flex-col items-center gap-4">
              {uploadDone
                ? <CheckCircle className="w-12 h-12 text-green-500" />
                : <Loader2 className="w-12 h-12 text-brand-600 animate-spin" />
              }
              <p className="text-lg font-medium text-slate-900">{uploadDone ? 'Ready' : 'Analysing record…'}</p>
            </div>
          ) : (
            <>
              <div>
                <label className="label">Document (PDF or TXT)</label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={`mt-1 border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                    uploadFile ? 'border-brand-400 bg-brand-50' : 'border-slate-300 hover:border-brand-400'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.txt,application/pdf,text/plain"
                    onChange={e => { const f = e.target.files?.[0]; if (f) setUploadFile(f); }}
                    className="hidden"
                  />
                  {uploadFile ? (
                    <div className="flex items-center justify-center gap-2 text-brand-700">
                      <FileText className="w-5 h-5" />
                      <span className="font-medium text-sm">{uploadFile.name}</span>
                    </div>
                  ) : (
                    <div>
                      <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                      <p className="text-sm text-slate-600">Click to select a PDF or TXT file</p>
                      <p className="text-xs text-slate-400 mt-1">Max 15 MB</p>
                    </div>
                  )}
                </div>
              </div>
              {uploadErr && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{uploadErr}</div>
              )}
              <div className="flex justify-end gap-3">
                <Button variant="secondary" onClick={() => { setUploadOpen(false); setUploadFile(null); setUploadErr(''); }}>Cancel</Button>
                <Button onClick={handleUpload} disabled={!uploadFile}>
                  <Upload className="w-4 h-4" /> Upload & Analyse
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}