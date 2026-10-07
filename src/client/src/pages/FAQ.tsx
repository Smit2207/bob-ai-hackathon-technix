import { useState } from 'react';
import { Link } from 'react-router-dom';
import { HelpCircle, ChevronDown, Search, Shield, FileText, Activity, ExternalLink } from 'lucide-react';

const FAQS = [
  {
    q: 'What is MedBrief AI?',
    a: 'MedBrief AI is Clinical Continuity Intelligence for longitudinal medical records. It turns fragmented records — GP notes, admissions, clinic letters, discharge summaries, labs — into a clear, evidence-linked patient story, highlighting what changed, what remains unresolved, what conflicts, and where the evidence is.',
  },
  {
    q: 'Is MedBrief a diagnostic or treatment system?',
    a: 'No. MedBrief is not a diagnostic or treatment system. It never diagnoses, prescribes, recommends treatment or medication changes, makes autonomous clinical decisions, or predicts outcomes. It reports only what is documented in the records you provide and explicitly states when information is not found.',
  },
  {
    q: 'What is ChangeMap?',
    a: 'ChangeMap classifies every meaningful longitudinal item as NEW, CHANGED, REPEATED, RESOLVED, OPEN or CONFLICTING. This prioritises meaningful change over repeated history, reducing information overload so a clinician can see what actually changed between encounters.',
  },
  {
    q: 'What is a CareLoop?',
    a: 'A CareLoop tracks a clinical workflow end-to-end: investigation ordered → completed → result → review; referral → appointment → outcome; procedure planned → performed → result → follow-up. When the chain is incomplete, MedBrief creates an Open Care Loop and reports that no completion report was found in the available record — without concluding that care was not delivered.',
  },
  {
    q: 'What is Documentation Drift?',
    a: 'Documentation Drift surfaces conflicting documentation — for example a medication documented at two different doses, or a smoking status recorded inconsistently between primary care and hospital. MedBrief presents both entries with full evidence and does not decide which is medically correct.',
  },
  {
    q: 'How is evidence preserved?',
    a: 'Every important statement retains provenance: the source document, page, chunk, extracted field, and verbatim source text. You can open the Evidence panel from any item to see exactly where a fact came from. MedBrief never fabricates page numbers or citations.',
  },
  {
    q: 'Does Demo Mode work offline?',
    a: 'Yes. Demo Mode runs entirely in your browser using the same clinical engine as the server. It needs no backend, no database, no credentials, and no internet. All demo patients are synthetic and clearly labelled.',
  },
  {
    q: 'What is Bring Your Own AI?',
    a: 'Bring Your Own AI prepares a grounded context package — patient context, current state, recent changes, open care loops, conflicts, and evidence — that you can paste into ChatGPT, Claude, or Gemini. Nothing is transmitted automatically; the copy and open actions are explicitly user-controlled, and identifiers are redacted by default.',
  },
  {
    q: 'What file formats are supported?',
    a: 'PDF and TXT are supported. The extraction architecture is designed so scanned-PDF OCR can be added later without destabilising the core intelligence.',
  },
  {
    q: 'Who can see my data?',
    a: 'Only you. Patient records are scoped to your account and access is verified on every request. MedBrief never trains on your data and never transmits it to third-party AI services automatically.',
  },
];

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  const [filter, setFilter] = useState('');

  const filtered = FAQS.filter(f =>
    f.q.toLowerCase().includes(filter.toLowerCase()) ||
    f.a.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <div className="mb-8 text-center">
          <Link to="/landing" className="text-sm text-brand-600 hover:underline">← Back</Link>
          <h1 className="text-3xl font-semibold text-slate-900 mt-4">Frequently asked questions</h1>
          <p className="text-slate-500 mt-2">How MedBrief works, safety, and your data.</p>
        </div>

        <div className="relative mb-8">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
          <input
            type="text"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Search FAQs…"
            className="input pl-9"
            aria-label="Search FAQs"
          />
        </div>

        <div className="space-y-3">
          {filtered.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <HelpCircle className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p>No questions matched "{filter}".</p>
            </div>
          )}
          {filtered.map((f, i) => {
            const idx = FAQS.indexOf(f);
            const isOpen = open === idx;
            return (
              <div key={idx} className="border border-slate-200 rounded-lg bg-white overflow-hidden">
                <button
                  onClick={() => setOpen(isOpen ? null : idx)}
                  className="w-full text-left px-5 py-4 flex items-center justify-between gap-4"
                  aria-expanded={isOpen}
                >
                  <span className="font-medium text-slate-900">{f.q}</span>
                  <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                </button>
                {isOpen && (
                  <div className="px-5 pb-4 text-sm text-slate-600 leading-relaxed animate-accordion">
                    {f.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-12 p-5 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
          <Shield className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            <strong>Safety reminder:</strong> MedBrief is not a diagnostic or treatment system. It never
            diagnoses, prescribes, or recommends treatment. All clinical decisions remain the
            responsibility of a qualified clinician.
          </p>
        </div>
      </div>
    </div>
  );
}