import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { usePatientStore } from '../store/patient';
import { useAuthStore } from '../store/auth';
import { EmptyState, EvidenceList } from '../components/Clinical';
import { Card, Spinner, Button, Badge } from '../components/UI';
import { FileText, Copy, Check, ExternalLink, ShieldAlert, Stethoscope, Calendar, ArrowRight } from 'lucide-react';
import { buildBrief, briefToMarkdown } from '../../../shared/clinical/briefs.js';
import { buildByoaiContext, BYOAI_TARGETS } from '../../../shared/clinical/byoai.js';
import type { BriefType } from '../../../shared/clinical/briefs.js';

const SPECIALTIES = ['Cardiology', 'Respiratory', 'Neurology', 'General Medicine', 'Other'];

export default function PatientBriefs() {
  const { id } = useParams<{ id: string }>();
  const [search] = useSearchParams();
  const isDemo = search.get('demo') === '1';
  const { current, loading, error, loadDemo, loadLive } = usePatientStore();
  const { user } = useAuthStore();
  const [briefType, setBriefType] = useState<BriefType>('ward');
  const [specialty, setSpecialty] = useState('Cardiology');
  const [copied, setCopied] = useState(false);
  const [byoaiOpen, setByoaiOpen] = useState(false);
  const [includeIdentifiers, setIncludeIdentifiers] = useState(false);
  const [byoaiCopied, setByoaiCopied] = useState(false);

  useEffect(() => {
    if (!id) return;
    if (isDemo) loadDemo(id);
    else if (user) loadLive(id);
  }, [id, isDemo, user]);

  const brief = useMemo(() => {
    if (!current) return null;
    return buildBrief(current.analysis, briefType, briefType === 'referral' ? specialty : null, current.chunks);
  }, [current, briefType, specialty]);

  const byoai = useMemo(() => {
    if (!current) return null;
    return buildByoaiContext(current.analysis, { redactIdentifiers: !includeIdentifiers });
  }, [current, includeIdentifiers]);

  if (loading) return <div className="flex justify-center py-24"><Spinner size="lg" /></div>;
  if (error) return <Card className="max-w-xl mx-auto mt-10"><div className="empty-state"><FileText className="w-12 h-12 text-amber-500" /><p>{error}</p></div></Card>;
  if (!current) return null;

  const copyBrief = async () => {
    if (!brief) return;
    try { await navigator.clipboard.writeText(briefToMarkdown(brief)); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard unavailable */ }
  };

  const copyByoai = async () => {
    if (!byoai) return;
    try { await navigator.clipboard.writeText(byoai.context); setByoaiCopied(true); setTimeout(() => setByoaiCopied(false), 1500); } catch { /* clipboard unavailable */ }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Clinical briefs</h1>
        <p className="text-sm text-slate-500 mt-1">
          Concise, evidence-linked briefs generated from the record. No treatment recommendations.
        </p>
      </div>

      {/* Brief type selector */}
      <div className="flex items-center gap-2 flex-wrap">
        {([
          { key: 'ward', label: 'Ward round brief', icon: Stethoscope },
          { key: 'referral', label: 'Referral brief', icon: Calendar },
          { key: 'handoff', label: 'Discharge / handoff brief', icon: ArrowRight },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setBriefType(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              briefType === t.key ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'
            }`}
            aria-pressed={briefType === t.key}
          >
            <t.icon className="w-4 h-4" aria-hidden="true" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Specialty selector for referral briefs */}
      {briefType === 'referral' && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-slate-500">Specialty:</span>
          {SPECIALTIES.map(s => (
            <button
              key={s}
              onClick={() => setSpecialty(s)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                specialty === s ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'
              }`}
              aria-pressed={specialty === s}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Brief */}
      {brief && (
        <Card>
          <div className="card-header flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{brief.title}</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {current.analysis.documents.length} document{current.analysis.documents.length === 1 ? '' : 's'} · {brief.evidenceIndex.length} evidence reference{brief.evidenceIndex.length === 1 ? '' : 's'}
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={copyBrief}>
              {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied' : 'Copy brief'}
            </Button>
          </div>
          <div className="card-body space-y-6">
            {brief.sections.map((section, i) => (
              <div key={i}>
                <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-2">{section.heading}</h3>
                <ul className="space-y-1.5">
                  {section.lines.map((line, j) => (
                    <li key={j} className="text-sm text-slate-700 leading-relaxed flex items-start gap-2">
                      <span className="text-brand-500 mt-1.5 flex-shrink-0">•</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {/* Evidence index */}
            {brief.evidenceIndex.length > 0 && (
              <div className="border-t border-slate-100 pt-4">
                <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-2">Evidence index</h3>
                <div className="space-y-1.5">
                  {brief.evidenceIndex.map((e) => (
                    <div key={e.ref} className="text-xs text-slate-600 flex items-start gap-2">
                      <span className="font-mono font-medium text-brand-700 flex-shrink-0">{e.ref}</span>
                      <span>{e.documentName}{e.page != null ? `, page ${e.page}` : ''}: <span className="font-mono">"{e.text.slice(0, 160)}{e.text.length > 160 ? '…' : ''}"</span></span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs text-amber-800">{brief.disclaimer}</p>
            </div>
          </div>
        </Card>
      )}

      {/* BYOAI */}
      <Card>
        <div className="card-header">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Bring Your Own AI</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Prepare a grounded context package for an external assistant. Nothing is transmitted automatically.
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setByoaiOpen(!byoaiOpen)}>
              {byoaiOpen ? 'Hide' : 'Configure'}
            </Button>
          </div>
        </div>
        <div className="card-body">
          {byoaiOpen && (
            <div className="mb-5 space-y-4">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={includeIdentifiers}
                  onChange={e => setIncludeIdentifiers(e.target.checked)}
                  className="rounded border-slate-300"
                />
                Include patient identifiers in the context package
              </label>
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-700">{byoai?.warning}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {BYOAI_TARGETS.map(target => (
              <div key={target.id} className="p-4 border border-slate-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-slate-900">{target.label}</h3>
                  <ExternalLink className="w-4 h-4 text-slate-400" aria-hidden="true" />
                </div>
                <p className="text-xs text-slate-500 mb-3">{target.note}</p>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={copyByoai} className="flex-1">
                    {byoaiCopied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                    Copy context
                  </Button>
                  <a href={target.url} target="_blank" rel="noopener noreferrer">
                    <Button variant="primary" size="sm">Open</Button>
                  </a>
                </div>
              </div>
            ))}
          </div>

          {byoai && byoaiOpen && (
            <details className="mt-5">
              <summary className="text-sm font-medium text-slate-700 cursor-pointer hover:text-slate-900">
                Preview context package ({byoai.context.length} characters)
              </summary>
              <pre className="mt-3 p-4 bg-slate-900 text-slate-100 rounded-lg text-xs font-mono overflow-x-auto max-h-96 whitespace-pre-wrap">
                {byoai.context}
              </pre>
            </details>
          )}
        </div>
      </Card>
    </div>
  );
}