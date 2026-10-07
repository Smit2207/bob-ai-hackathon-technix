import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { api } from '../utils/api';
import { listDemoPatients, DEMO_DISCLAIMER } from '../demo/engine.js';
import { Plus, FileText, Upload, Activity, ExternalLink, Trash2, Eye, ShieldAlert, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { Button, Card, Badge, Modal, Input, Spinner } from '../components/UI';

type UploadStage = 'idle' | 'uploading' | 'processing' | 'ready' | 'error';

export default function Dashboard({ demoMode }: { demoMode?: boolean }) {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [newPatientName, setNewPatientName] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Upload state
  const [uploadName, setUploadName] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadStage, setUploadStage] = useState<UploadStage>('idle');
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const demoPatients = listDemoPatients();

  const loadPatients = async () => {
    try {
      const data = await api.patients.list();
      setPatients(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (!demoMode) loadPatients();
    else setLoading(false);
  }, [demoMode]);

  const handleCreate = async () => {
    if (!newPatientName.trim()) return;
    setCreating(true);
    try {
      const p = await api.patients.create(newPatientName.trim());
      navigate(`/patients/${p.id}`);
    } catch (e: any) { alert(e.message); }
    finally { setCreating(false); setCreateOpen(false); setNewPatientName(''); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try { await api.patients.delete(deleteId); loadPatients(); } catch (e: any) { alert(e.message); }
    finally { setDeleteOpen(false); setDeleteId(null); }
  };

  const handleUpload = async () => {
    if (!uploadName.trim() || !uploadFile) return;
    setUploadStage('uploading');
    setUploadError('');
    try {
      // Step 1: Create the patient
      setUploadStage('uploading');
      const p = await api.patients.create(uploadName.trim());

      // Step 2: Upload the document
      setUploadStage('processing');
      await api.patients.upload(p.id, uploadFile);

      // Step 3: Done
      setUploadStage('ready');
      setTimeout(() => {
        setUploadOpen(false);
        setUploadStage('idle');
        setUploadName('');
        setUploadFile(null);
        navigate(`/patients/${p.id}`);
      }, 1200);
    } catch (e: any) {
      setUploadError(e.message || 'Upload failed. Please try again.');
      setUploadStage('error');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploadFile(f);
    if (!uploadName) {
      // Auto-fill name from filename
      setUploadName(f.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '));
    }
  };

  const closeUpload = () => {
    if (uploadStage === 'uploading' || uploadStage === 'processing') return;
    setUploadOpen(false);
    setUploadStage('idle');
    setUploadName('');
    setUploadFile(null);
    setUploadError('');
  };

  const stageLabel: Record<UploadStage, string> = {
    idle: '',
    uploading: 'Uploading…',
    processing: 'Analysing record…',
    ready: 'Ready',
    error: '',
  };

  if (demoMode) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Demo Mode</h1>
            <p className="text-slate-500">Select a synthetic patient to explore MedBrief AI — runs entirely in your browser.</p>
          </div>
          <Link to="/login">
            <Button variant="secondary" size="sm">Login for full access</Button>
          </Link>
        </div>

        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">{DEMO_DISCLAIMER}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {demoPatients.map(p => (
            <Card
              key={p.id}
              className="h-full hover:shadow-lg transition-shadow cursor-pointer"
            >
              <div className="p-5" onClick={() => navigate(`/patients/${p.id}?demo=1`)}>
                <div className="mb-3">
                  <h3 className="font-semibold text-slate-900">{p.displayName}</h3>
                  <p className="text-sm text-slate-500 mt-0.5">{p.summary}</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
                  <FileText className="w-3.5 h-3.5" />
                  <span>{p.documents.length} synthetic documents</span>
                </div>
                <div className="pt-4 border-t border-slate-100 text-sm text-brand-600 font-medium flex items-center gap-1">
                  <Eye className="w-4 h-4" /> View continuity
                </div>
              </div>
            </Card>
          ))}
        </div>

        <Card>
          <div className="card-body">
            <h2 className="font-semibold text-slate-900 mb-2">What to explore</h2>
            <ul className="space-y-1.5 text-sm text-slate-600">
              <li>• <strong>Arjun Mehta</strong> — atorvastatin documented at three doses, an echocardiogram with preserved LVEF, and a pulmonary function test ordered with no completion report.</li>
              <li>• <strong>Sarah Chen</strong> — progressive CKD, a renal ultrasound requested with no imaging report, and an allergy status that conflicts between documents.</li>
              <li>• <strong>Michael Okonkwo</strong> — repeated COPD exacerbations, serial spirometry with no results, and a smoking status recorded inconsistently.</li>
            </ul>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
          <p className="text-slate-500">Your patient records and recent activity</p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => setUploadOpen(true)}>
            <Upload className="w-4 h-4" /> Upload Medical Record
          </Button>
          <Button variant="secondary" onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4" /> New Patient
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1,2,3].map(i => <Card key={i} className="animate-pulse h-40">&nbsp;</Card>)}
        </div>
      ) : patients.length === 0 ? (
        <Card className="text-center py-16">
          <div className="card-body flex flex-col items-center">
            <FileText className="w-16 h-16 text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">No patients yet</h3>
            <p className="text-slate-500 mb-6">Upload a medical record to create a patient and begin analysis.</p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Button onClick={() => setUploadOpen(true)}>
                <Upload className="w-4 h-4" /> Upload Medical Record
              </Button>
              <Button variant="secondary" onClick={() => navigate('/demo')}>
                <Activity className="w-4 h-4" /> Try Demo
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {patients.map(p => (
            <Card key={p.id} className="h-full">
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-slate-900">{p.name}</h3>
                    <p className="text-sm text-slate-500">{p.patientId ? `MRN: ${p.patientId}` : 'No MRN documented'}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => navigate(`/patients/${p.id}`)} aria-label="View patient"><Eye className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => { setDeleteId(p.id); setDeleteOpen(true); }} aria-label="Delete patient"><Trash2 className="w-4 h-4 text-red-600" /></Button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 mb-4 text-center">
                  <div className="p-3 bg-slate-50 rounded-lg"><p className="text-2xl font-semibold text-brand-600">{p._counts?.docs ?? 0}</p><p className="text-xs text-slate-500">Documents</p></div>
                  <div className="p-3 bg-slate-50 rounded-lg"><p className="text-2xl font-semibold text-brand-600">{p._counts?.meds ?? 0}</p><p className="text-xs text-slate-500">Medications</p></div>
                  <div className="p-3 bg-slate-50 rounded-lg"><p className="text-2xl font-semibold text-brand-600">{p._counts?.investigations ?? 0}</p><p className="text-xs text-slate-500">Investigations</p></div>
                </div>
                <div className="flex flex-wrap gap-2 mb-4">
                  {(p._counts?.openLoops ?? 0) > 0 && <Badge variant="open">{p._counts.openLoops} Open Loops</Badge>}
                  {(p._counts?.conflicts ?? 0) > 0 && <Badge variant="conflict">{p._counts.conflicts} Conflicts</Badge>}
                  {(p._counts?.openLoops ?? 0) === 0 && (p._counts?.conflicts ?? 0) === 0 && <Badge variant="resolved">Up to date</Badge>}
                </div>
                <div className="pt-3 border-t border-slate-100">
                  <Link to={`/patients/${p.id}`} className="text-sm font-medium text-brand-600 hover:underline flex items-center gap-1">Open continuity <ExternalLink className="w-4 h-4" /></Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Upload Medical Record modal */}
      <Modal open={uploadOpen} onClose={closeUpload} title="Upload Medical Record">
        <div className="space-y-4">
          {uploadStage === 'idle' || uploadStage === 'error' ? (
            <>
              <Input
                label="Patient name"
                value={uploadName}
                onChange={e => setUploadName(e.target.value)}
                placeholder="e.g. Jane Smith"
                required
              />
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
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  {uploadFile ? (
                    <div className="flex items-center justify-center gap-2 text-brand-700">
                      <FileText className="w-5 h-5" />
                      <span className="font-medium text-sm">{uploadFile.name}</span>
                      <span className="text-xs text-slate-500">({(uploadFile.size / 1024).toFixed(0)} KB)</span>
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
              {uploadError && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  {uploadError}
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="secondary" onClick={closeUpload}>Cancel</Button>
                <Button
                  onClick={handleUpload}
                  disabled={!uploadName.trim() || !uploadFile}
                >
                  <Upload className="w-4 h-4" /> Upload & Analyse
                </Button>
              </div>
            </>
          ) : (
            <div className="py-8 flex flex-col items-center gap-4">
              {uploadStage === 'ready' ? (
                <CheckCircle className="w-12 h-12 text-green-500" />
              ) : (
                <Loader2 className="w-12 h-12 text-brand-600 animate-spin" />
              )}
              <p className="text-lg font-medium text-slate-900">{stageLabel[uploadStage]}</p>
              {uploadStage === 'processing' && (
                <p className="text-sm text-slate-500 text-center max-w-xs">
                  Extracting clinical entities, building ChangeMap, detecting care loops…
                </p>
              )}
              {uploadStage === 'ready' && (
                <p className="text-sm text-green-600">Opening patient record…</p>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* Create patient (name only) */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create Patient">
        <Input label="Patient Name" value={newPatientName} onChange={e => setNewPatientName(e.target.value)} placeholder="e.g. Jane Smith" />
        <div className="mt-4 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={creating}>{creating ? 'Creating...' : 'Create'}</Button>
        </div>
      </Modal>

      {/* Delete patient */}
      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete Patient">
        <p className="text-slate-600">This will permanently delete the patient record and all associated documents. This cannot be undone.</p>
        <div className="mt-4 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button variant="danger" onClick={handleDelete}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}
