import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { usePatientStore } from '../store/patient';
import { useAuthStore } from '../store/auth';
import { Card, Badge, Button, Input, Textarea, Select, Modal } from '../components/UI';
import {
  FileText, Pill, Stethoscope, Activity, AlertTriangle, ClipboardList,
  UserCheck, Calendar, Flag, Eye, Save, Loader2, ShieldAlert, HelpCircle,
  ChevronDown, ChevronUp, MoreVertical, CheckCircle, AlertCircle, Info,
  ShieldCheck, User
} from 'lucide-react';
import { buildHandoverItems, buildHandoverSummary } from '../../../shared/clinical/temporal.js';
import type { HandoverItem, HandoverReviewDetail, HandoverReviewState, HandoverItemType } from '../../../shared/clinical/types.js';
import { api } from '../utils/api.js';

const TYPE_ICON: Record<HandoverItemType, React.ElementType> = {
  Investigation: Stethoscope,
  Referral: ClipboardList,
  'Follow-up': Calendar,
  'Medication Change': Pill,
  'Documentation Conflict': AlertTriangle,
};

type BadgeVariant = 'default' | 'new' | 'changed' | 'resolved' | 'open' | 'conflict' | 'repeated';

const REVIEW_STATE_BADGE: Record<HandoverReviewState, { variant: BadgeVariant; label: string }> = {
  Incomplete: { variant: 'open', label: 'Incomplete' },
  'Ready for clinician review': { variant: 'default', label: 'Ready for clinician review' },
  'Clinician reviewed': { variant: 'resolved', label: 'Clinician reviewed' },
};

const REVIEW_STATES: HandoverReviewState[] = ['Incomplete', 'Ready for clinician review', 'Clinician reviewed'];

const DISCLAIMER = 'Handover Guard completeness status is not a diagnosis, clinical risk score, or approval for clinical use. It reflects only what is documented in the available records. Clinician review is required before exporting or copying the brief.';

interface FormState {
  reviewState: HandoverReviewState;
  accountableService: string;
  accountablePerson: string;
  plannedFollowUpDate: string;
  disposition: string;
}

export default function PatientHandover() {
  const { id } = useParams<{ id: string }>();
  const [search] = useSearchParams();
  const isDemo = search.get('demo') === '1';
  const { current, loading, error, loadDemo, loadLive } = usePatientStore();
  const { user } = useAuthStore();
  const [reviews, setReviews] = useState<Record<string, { reviewDetail: HandoverReviewDetail | null; reviewState: HandoverReviewState }>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<HandoverItem | null>(null);
  const [showDisclaimer, setShowDisclaimer] = useState(true);
  const [formState, setFormState] = useState<FormState>({
    reviewState: 'Incomplete',
    accountableService: '',
    accountablePerson: '',
    plannedFollowUpDate: '',
    disposition: '',
  });

  useEffect(() => {
    if (!id) return;
    if (isDemo) loadDemo(id);
    else if (user) loadLive(id);
  }, [id, isDemo, user]);

  useEffect(() => {
    if (!current) return;
    const initialReviews: Record<string, { reviewDetail: HandoverReviewDetail | null; reviewState: HandoverReviewState }> = {};
    current.analysis.handoverItems.forEach(item => {
      if (item.reviewDetail) {
        initialReviews[item.linkedEntityId ?? item.id] = {
          reviewDetail: item.reviewDetail,
          reviewState: item.reviewState,
        };
      }
    });
    if (isDemo) {
      const stored = localStorage.getItem(`handover-reviews-${id}`);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          Object.keys(parsed).forEach(key => {
            initialReviews[key] = parsed[key];
          });
        } catch {}
      }
    } else if (id) {
      api.patients.getHandoverReviews(id).then((data: any[]) => {
        data.forEach((r: any) => {
          initialReviews[r.linkedEntityId] = {
            reviewDetail: {
              accountableService: r.accountableService,
              accountablePerson: r.accountablePerson,
              plannedFollowUpDate: r.plannedFollowUpDate,
              disposition: r.disposition,
              reviewedAt: r.reviewedAt,
              reviewedBy: r.reviewedBy,
            },
            reviewState: r.reviewState,
          };
        });
        setReviews({ ...initialReviews });
      }).catch(() => {});
    }
    setReviews(initialReviews);
  }, [current, isDemo, id]);

  const handoverItems = useMemo(() => {
    if (!current) return [] as HandoverItem[];
    const baseItems = buildHandoverItems(
      current.analysis.careLoops,
      current.analysis.medicationChanges,
      current.analysis.conflicts,
      current.analysis.investigations,
      current.analysis.referrals,
      current.analysis.followUps,
      current.analysis.medications
    );
    return baseItems.map(item => {
      const key = item.linkedEntityId ?? item.id;
      const saved = reviews[key];
      if (saved) {
        return {
          ...item,
          reviewState: saved.reviewState,
          reviewDetail: saved.reviewDetail,
        };
      }
      return item;
    });
  }, [current, reviews]);

  const summary = useMemo(() => {
    if (!current) return null;
    return buildHandoverSummary(handoverItems, current.analysis.handoverSummary?.medicationReconciliation ?? []);
  }, [current, handoverItems]);

  const saveReview = async (item: HandoverItem, detail: HandoverReviewDetail | null, newState: HandoverReviewState) => {
    if (!id) return;
    const key = item.linkedEntityId ?? item.id;
    const updatedReviews = {
      ...reviews,
      [key]: { reviewDetail: detail, reviewState: newState },
    };
    setReviews(updatedReviews);

    if (isDemo) {
      localStorage.setItem(`handover-reviews-${id}`, JSON.stringify(updatedReviews));
    } else {
      setSaving(key);
      try {
        await api.patients.saveHandoverReview(id, {
          linkedEntityId: item.linkedEntityId ?? item.id,
          linkedEntityType: item.linkedEntityType,
          accountableService: detail?.accountableService ?? null,
          accountablePerson: detail?.accountablePerson ?? null,
          plannedFollowUpDate: detail?.plannedFollowUpDate ?? null,
          disposition: detail?.disposition ?? null,
          reviewState: newState,
        });
      } catch (e) {
        console.error('Failed to save review', e);
      } finally {
        setSaving(null);
      }
    }
  };

  const handleEdit = (item: HandoverItem) => {
    const key = item.linkedEntityId ?? item.id;
    const saved = reviews[key];
    if (saved && saved.reviewDetail) {
      setFormState({
        reviewState: saved.reviewState,
        accountableService: saved.reviewDetail.accountableService ?? '',
        accountablePerson: saved.reviewDetail.accountablePerson ?? '',
        plannedFollowUpDate: saved.reviewDetail.plannedFollowUpDate ?? '',
        disposition: saved.reviewDetail.disposition ?? '',
      });
    } else {
      setFormState({
        reviewState: item.reviewState,
        accountableService: '',
        accountablePerson: '',
        plannedFollowUpDate: '',
        disposition: '',
      });
    }
    setEditingItem(item);
  };

  const handleSaveEdit = () => {
    if (editingItem) {
      const detail: HandoverReviewDetail = {
        accountableService: formState.accountableService || null,
        accountablePerson: formState.accountablePerson || null,
        plannedFollowUpDate: formState.plannedFollowUpDate || null,
        disposition: formState.disposition || null,
        reviewedAt: new Date().toISOString(),
        reviewedBy: user?.name ?? null,
      };
      saveReview(editingItem, detail, formState.reviewState);
      setEditingItem(null);
    }
  };

  const openItems = handoverItems.filter(i => i.reviewState === 'Incomplete');
  const readyItems = handoverItems.filter(i => i.reviewState === 'Ready for clinician review');
  const reviewedItems = handoverItems.filter(i => i.reviewState === 'Clinician reviewed');

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-brand-600" /></div>;
  if (error) return <Card className="max-w-xl mx-auto mt-10"><div className="p-6 text-center text-red-600">{error}</div></Card>;
  if (!current) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-brand-600" aria-hidden="true" />
          Handover Guard
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Review unresolved items, document decisions, and track accountability. Every item links to its source evidence.
        </p>
      </div>

      {/* Overall status banner */}
      <Card className={`border-l-4 ${summary?.overallReviewState === 'Clinician reviewed' ? 'border-green-500' : summary?.overallReviewState === 'Ready for clinician review' ? 'border-amber-500' : 'border-red-500'}`}>
        <div className="card-body">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Handover completeness</h2>
              <p className="text-sm text-slate-500 mt-1">
                {summary?.overallReviewState === 'Clinician reviewed'
                  ? 'All items have been reviewed by a clinician.'
                  : summary?.overallReviewState === 'Ready for clinician review'
                  ? 'Some items are ready for clinician review; others remain incomplete.'
                  : `${openItems.length} item${openItems.length === 1 ? '' : 's'} require review before handover.`}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={summary?.overallReviewState === 'Clinician reviewed' ? 'resolved' : summary?.overallReviewState === 'Ready for clinician review' ? 'default' : 'open'}>
                {summary?.overallReviewState ?? 'Incomplete'}
              </Badge>
              <button onClick={() => setShowDisclaimer(!showDisclaimer)} className="text-xs text-brand-600 hover:underline flex items-center gap-1">
                <Info className="w-3 h-3" />
                Safety note
              </button>
            </div>
          </div>
        </div>
      </Card>

      {showDisclaimer && (
        <Card className="border-amber-200 bg-amber-50">
          <div className="card-body">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-sm text-amber-800">{DISCLAIMER}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Summary counts */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-red-500">
          <div className="card-body p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{openItems.length}</p>
                <p className="text-xs text-slate-500">Open / Incomplete</p>
              </div>
            </div>
          </div>
        </Card>
        <Card className="border-l-4 border-amber-500">
          <div className="card-body p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
                <UserCheck className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{readyItems.length}</p>
                <p className="text-xs text-slate-500">Ready for review</p>
              </div>
            </div>
          </div>
        </Card>
        <Card className="border-l-4 border-green-500">
          <div className="card-body p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{reviewedItems.length}</p>
                <p className="text-xs text-slate-500">Clinician reviewed</p>
              </div>
            </div>
          </div>
        </Card>
        <Card className="border-l-4 border-blue-500">
          <div className="card-body p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                <Flag className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{handoverItems.length}</p>
                <p className="text-xs text-slate-500">Total items</p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Items grouped by type */}
      {(['Investigation', 'Referral', 'Follow-up', 'Medication Change', 'Documentation Conflict'] as const).map((type) => {
        const typedType = type as HandoverItemType;
        const itemsOfType = handoverItems.filter(i => i.type === typedType);
        if (itemsOfType.length === 0) return null;
        const Icon = TYPE_ICON[typedType];
        return (
          <Card key={type} className="overflow-hidden">
            <div className="card-header bg-slate-50 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Icon className="w-5 h-5 text-brand-600" aria-hidden="true" />
                {type}{type !== 'Documentation Conflict' ? 's' : ''} ({itemsOfType.length})
              </h2>
            </div>
            <div className="card-body p-0">
              <div className="divide-y divide-slate-100">
                {itemsOfType.map((item, idx) => (
                  <div key={item.id} className="p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <span className="font-medium text-sm text-slate-900">{item.title}</span>
                          <Badge variant={REVIEW_STATE_BADGE[item.reviewState].variant}>
                            {REVIEW_STATE_BADGE[item.reviewState].label}
                          </Badge>
                          {item.isConflicting && (
                            <Badge variant="open" className="bg-red-50 text-red-700 border-red-200">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              Conflicting
                            </Badge>
                          )}
                          {item.isMissingInfo && (
                            <Badge variant="default" className="bg-amber-50 text-amber-700 border-amber-200">
                              <Info className="w-3 h-3 mr-1" />
                              Missing info
                            </Badge>
                          )}
                          {!item.isDocumentedFact && item.isUserEntered && (
                            <Badge variant="default" className="bg-blue-50 text-blue-700 border-blue-200">
                              <UserCheck className="w-3 h-3 mr-1" />
                              Clinician-entered
                            </Badge>
                          )}
                          {item.isDocumentedFact && !item.isUserEntered && (
                            <Badge variant="default" className="bg-green-50 text-green-700 border-green-200">
                              <FileText className="w-3 h-3 mr-1" />
                              Documented
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-slate-600 mb-2">{item.description}</p>
                        <div className="flex items-center gap-4 text-xs text-slate-400 flex-wrap">
                          <span className="flex items-center gap-1">
                            <FileText className="w-3 h-3" /> {item.sourceDocument}{item.page ? `, p.${item.page}` : ''}
                          </span>
                          {item.relevantDate && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" /> {new Date(item.relevantDate).toLocaleDateString()}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Eye className="w-3 h-3" /> Source: "{item.sourceExcerpt.slice(0, 80)}..."
                          </span>
                        </div>
                        {item.evidence.length > 0 && (
                          <details className="mt-2">
                            <summary className="text-xs font-medium text-brand-600 hover:underline cursor-pointer">
                              View all {item.evidence.length} evidence reference(s)
                            </summary>
                            <div className="mt-2 space-y-1 text-xs">
                              {item.evidence.map((ev, ei) => (
                                <div key={ei} className="p-2 bg-slate-50 rounded text-slate-600 font-mono">
                                  {ev.documentName}{ev.page ? `, p.${ev.page}` : ''}: "{ev.text.slice(0, 120)}..."
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleEdit(item)}
                          disabled={saving === (item.linkedEntityId ?? item.id)}
                        >
                          {saving === (item.linkedEntityId ?? item.id) ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Save className="w-4 h-4" />
                          )}
                          Review
                        </Button>
                      </div>
                    </div>
                    {/* Review detail display when saved */}
                    {item.reviewDetail && (
                      <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                          {item.reviewDetail.accountableService && (
                            <div className="flex items-center gap-2 text-slate-700">
                              <UserCheck className="w-4 h-4 text-brand-600" />
                              <span><strong>Service:</strong> {item.reviewDetail.accountableService}</span>
                            </div>
                          )}
                          {item.reviewDetail.accountablePerson && (
                            <div className="flex items-center gap-2 text-slate-700">
                              <User className="w-4 h-4 text-brand-600" />
                              <span><strong>Person:</strong> {item.reviewDetail.accountablePerson}</span>
                            </div>
                          )}
                          {item.reviewDetail.plannedFollowUpDate && (
                            <div className="flex items-center gap-2 text-slate-700">
                              <Calendar className="w-4 h-4 text-brand-600" />
                              <span><strong>Follow-up:</strong> {new Date(item.reviewDetail.plannedFollowUpDate).toLocaleDateString()}</span>
                            </div>
                          )}
                          {item.reviewDetail.disposition && (
                            <div className="flex items-center gap-2 text-slate-700">
                              <Flag className="w-4 h-4 text-brand-600" />
                              <span><strong>Disposition:</strong> {item.reviewDetail.disposition}</span>
                            </div>
                          )}
                          {item.reviewDetail.reviewedAt && (
                            <div className="flex items-center gap-2 text-slate-700">
                              <Calendar className="w-4 h-4 text-brand-600" />
                              <span><strong>Reviewed:</strong> {new Date(item.reviewDetail.reviewedAt).toLocaleString()}</span>
                            </div>
                          )}
                          {item.reviewDetail.reviewedBy && (
                            <div className="flex items-center gap-2 text-slate-700">
                              <User className="w-4 h-4 text-brand-600" />
                              <span><strong>By:</strong> {item.reviewDetail.reviewedBy}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </Card>
        );
      })}

      {/* Edit Modal */}
      {editingItem && (
        <Modal open onClose={() => setEditingItem(null)} title={`Review: ${editingItem.title}`} size="lg">
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              {editingItem.description}
            </p>
            <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-600">
              <strong>Source:</strong> {editingItem.sourceDocument}{editingItem.page ? `, page ${editingItem.page}` : ''}
              {editingItem.relevantDate && <span className="ml-3"><strong>Date:</strong> {new Date(editingItem.relevantDate).toLocaleDateString()}</span>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Review State</label>
              <Select
                value={formState.reviewState}
                onChange={(e) => setFormState({ ...formState, reviewState: e.target.value as HandoverReviewState })}
                options={REVIEW_STATES.map(s => ({ value: s, label: s }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Accountable Service</label>
              <Input
                placeholder="e.g., Respiratory Medicine, Cardiology"
                value={formState.accountableService}
                onChange={(e) => setFormState({ ...formState, accountableService: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Accountable Person</label>
              <Input
                placeholder="e.g., Dr. Smith, Nurse Practitioner Jones"
                value={formState.accountablePerson}
                onChange={(e) => setFormState({ ...formState, accountablePerson: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Planned Follow-up Date</label>
              <Input
                type="date"
                value={formState.plannedFollowUpDate}
                onChange={(e) => setFormState({ ...formState, plannedFollowUpDate: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Disposition / Notes</label>
              <Textarea
                placeholder="e.g., Awaiting spirometry results; patient to contact clinic if symptoms worsen"
                value={formState.disposition}
                onChange={(e) => setFormState({ ...formState, disposition: e.target.value })}
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
              <Button variant="secondary" onClick={() => setEditingItem(null)}>Cancel</Button>
              <Button onClick={handleSaveEdit} disabled={saving === (editingItem.linkedEntityId ?? editingItem.id)}>
                {saving === (editingItem.linkedEntityId ?? editingItem.id) ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save Review
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}