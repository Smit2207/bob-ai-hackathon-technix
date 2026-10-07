import { useState } from 'react';
import { X, FileText, ChevronRight, ExternalLink, Copy, Check } from 'lucide-react';
import type { Evidence, ChangeClass, LoopStatus, InvestigationStatus, MedicationStatus } from '../../../shared/clinical/types.js';
import { formatDate } from '../../../shared/clinical/text.js';
import { IconButton } from './UI';

/* ---------------- Classification badges ---------------- */

const CLASS_STYLE: Record<ChangeClass, string> = {
  NEW: 'badge-new',
  CHANGED: 'badge-changed',
  REPEATED: 'badge-repeated',
  RESOLVED: 'badge-resolved',
  OPEN: 'badge-open',
  CONFLICTING: 'badge-conflict',
};

export function ChangeBadge({ value }: { value: ChangeClass }) {
  return <span className={CLASS_STYLE[value] ?? 'badge'}>{value}</span>;
}

export function LoopBadge({ status }: { status: LoopStatus }) {
  const cls = status === 'RESOLVED' ? 'badge-resolved' : status === 'OPEN' ? 'badge-open' : 'badge-changed';
  return <span className={cls}>{status}</span>;
}

export function InvestigationBadge({ status }: { status: InvestigationStatus }) {
  const map: Record<InvestigationStatus, string> = {
    ORDERED: 'badge-open',
    PENDING: 'badge-open',
    COMPLETED: 'badge-resolved',
    RESULT_AVAILABLE: 'badge-resolved',
    RESULT_MISSING: 'badge-changed',
    FOLLOW_UP_REQUIRED: 'badge-changed',
  };
  return <span className={map[status] ?? 'badge'}>{status.replace(/_/g, ' ')}</span>;
}

export function MedicationStatusBadge({ status }: { status: MedicationStatus }) {
  const cls = status === 'ACTIVE' ? 'badge-new' : status === 'STOPPED' ? 'badge-changed' : 'badge-resolved';
  return <span className={cls}>{status}</span>;
}

/* ---------------- Evidence ---------------- */

export function EvidenceChip({ evidence }: { evidence: Evidence }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5">
      <FileText className="w-3 h-3" aria-hidden="true" />
      <span className="truncate max-w-[180px]">{evidence.documentName}</span>
      {evidence.page > 0 && <span className="text-slate-400">p.{evidence.page}</span>}
    </span>
  );
}

export function EvidenceList({ evidence, limit = 4 }: { evidence: Evidence[]; limit?: number }) {
  const shown = evidence.slice(0, limit);
  return (
    <div className="flex flex-wrap gap-1.5">
      {shown.map((e, i) => <EvidenceChip key={i} evidence={e} />)}
      {evidence.length > limit && <span className="text-xs text-slate-400 self-center">+{evidence.length - limit} more</span>}
    </div>
  );
}

/* ---------------- Evidence drawer ---------------- */

export function EvidenceDrawer({ open, onClose, evidence, title = 'Evidence' }: {
  open: boolean;
  onClose: () => void;
  evidence: Evidence | Evidence[] | null;
  title?: string;
}) {
  const [copied, setCopied] = useState(false);
  if (!open) return null;
  const list = Array.isArray(evidence ?? []) ? (evidence as Evidence[]) : evidence ? [evidence as Evidence] : [];

  const copyAll = async () => {
    const text = list.map((e, i) => `[${i + 1}] ${e.documentName}, page ${e.page}, field "${e.field}":\n"${e.text}"`).join('\n\n');
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard unavailable */ }
  };

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-lg bg-white shadow-drawer animate-slide-up flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <div className="flex items-center gap-2">
            <IconButton variant="ghost" size="sm" onClick={copyAll} aria-label="Copy evidence">
              {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
            </IconButton>
            <IconButton variant="ghost" size="sm" onClick={onClose} aria-label="Close evidence panel">
              <X className="w-5 h-5" />
            </IconButton>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-thin">
          {list.length === 0 && (
            <div className="empty-state">
              <FileText className="w-12 h-12" />
              <p>No evidence was retained for this item.</p>
            </div>
          )}
          {list.map((e, i) => (
            <div key={i} className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-4 h-4 text-brand-600 flex-shrink-0" aria-hidden="true" />
                  <span className="text-sm font-medium text-slate-900 truncate">{e.documentName}</span>
                </div>
                <span className="text-xs text-slate-500 flex-shrink-0">Page {e.page} · Chunk {e.chunkIndex}</span>
              </div>
              <div className="px-4 py-3">
                <div className="text-xs font-medium text-brand-700 mb-1.5">Extracted field: {e.field}</div>
                <p className="text-sm text-slate-700 leading-relaxed font-mono text-[13px]">"{e.text}"</p>
              </div>
            </div>
          ))}
        </div>
        <div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-500">
          Evidence is retained verbatim from the source document. MedBrief never fabricates citations or page numbers.
        </div>
      </div>
    </div>
  );
}

/* ---------------- Timeline event row ---------------- */

export function DateLabel({ date }: { date: string | null }) {
  return <span className="text-xs font-medium text-slate-500">{date ? formatDate(date) : 'Date not documented'}</span>;
}

export function EmptyState({ icon: Icon, title, message, action }: {
  icon: React.ElementType;
  title: string;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <Icon className="w-12 h-12" aria-hidden="true" />
      <h3 className="text-lg font-medium text-slate-900 mt-2">{title}</h3>
      <p className="text-sm text-slate-500 mt-1 max-w-sm">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function SectionHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function ChevronLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <a href={to} className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700 hover:underline">
      {children}
      <ChevronRight className="w-4 h-4" aria-hidden="true" />
    </a>
  );
}

export function ExternalLinkButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700 hover:underline">
      {children}
      <ExternalLink className="w-4 h-4" aria-hidden="true" />
    </a>
  );
}
