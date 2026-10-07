import { Link } from 'react-router-dom';
import { Layout as LayoutIcon, Users, Activity, Search, FileText, Upload, ArrowRight, CheckCircle, Shield, Clock, Brain, GitCompare, ExternalLink, AlertTriangle, History, ClipboardList, Pill, Stethoscope } from 'lucide-react';
import { Button, Card, Badge } from '../components/UI';

export default function Landing() {
  const features = [
    { icon: Brain, title: 'ChangeMap', desc: 'Classify every longitudinal item as NEW, CHANGED, REPEATED, RESOLVED, OPEN or CONFLICTING — prioritising meaningful change over repeated history to reduce information overload.' },
    { icon: GitCompare, title: 'CareLoop', desc: 'Detect clinical workflows — investigation ordered → completed → result → review, referral → appointment → outcome — and surface an Open Care Loop when the chain is incomplete.' },
    { icon: AlertTriangle, title: 'Documentation Drift', desc: 'Surface conflicting documentation for medication doses, allergies, diagnoses, smoking status and demographics — with full evidence, without deciding which is medically correct.' },
    { icon: Search, title: 'Attention Engine', desc: 'Prioritise OPEN, CONFLICTING, CHANGED, NEW and recently resolved items. Every item is clickable with why it was surfaced, dates, evidence, source document and page.' },
    { icon: FileText, title: 'Evidence Chain', desc: 'Every important statement retains provenance: document, page, chunk, source text, extracted field and event date. Open the View Evidence panel — never a fabricated citation.' },
    { icon: ExternalLink, title: 'Bring Your Own AI', desc: 'Prepare a grounded context package for ChatGPT, Claude or Gemini. Explicit, user-controlled handoff. No automatic transmission of identifiable data.' },
  ];

  const howItWorks = [
    { step: 1, title: 'Documents', desc: 'Upload PDF or TXT records. Page-preserving extraction, text cleaning and chunking.' },
    { step: 2, title: 'Clinical knowledge', desc: 'Structured extraction of medications, investigations, labs, vitals, referrals and findings — sentence-scoped and negation-aware.' },
    { step: 3, title: 'Longitudinal state', desc: 'Merge GP notes, admissions, clinic letters and discharge summaries into one patient state with provenance.' },
    { step: 4, title: 'Intelligence', desc: 'ChangeMap, CareLoop, Documentation Drift and the Attention Engine — all evidence-linked.' },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top nav */}
      <nav className="bg-white border-b border-slate-100 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
              <LayoutIcon className="w-5 h-5 text-white" aria-hidden="true" />
            </div>
            <span className="font-semibold text-slate-900 text-lg">MedBrief AI</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/demo">
              <Button variant="secondary" size="sm">Try Demo</Button>
            </Link>
            <Link to="/login">
              <Button size="sm">Login</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative bg-white border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold text-slate-900 tracking-tight mb-6">
              See what changed.<br />
              <span className="text-brand-600">Find what remains unresolved.</span>
            </h1>
            <p className="text-xl sm:text-2xl text-slate-600 mb-4 max-w-2xl mx-auto">
              MedBrief AI — Clinical Continuity Intelligence<br className="hidden sm:block" />
              for Longitudinal Medical Records.
            </p>
            <p className="text-lg text-slate-500 mb-10 max-w-2xl mx-auto">
              Turn fragmented medical records into a clear, evidence-linked patient story —
              what happened, what changed, what was supposed to happen next, whether it happened,
              what conflicts, what requires attention, and where the evidence is.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/demo">
                <Button size="lg">
                  TRY DEMO <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
              <Link to="/login">
                <Button variant="secondary" size="lg">
                  LOGIN
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Problem */}
      <section id="problem" className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-3xl font-semibold text-slate-900 mb-4">The problem</h2>
            <p className="text-lg text-slate-600">
              Clinicians spend hours reconstructing patient history from 50–200 pages of unstructured records.
              Referral letters are written from memory. Key events, medication changes and outstanding
              investigations are buried in unstructured notes — and gaps cause avoidable readmissions
              and repeated investigations.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: Clock, title: 'Hours lost', desc: 'Reconstructing a longitudinal story from fragmented records takes hours per patient.' },
              { icon: FileText, title: 'Unstructured notes', desc: 'GP notes, admissions, clinic letters and discharge summaries each tell part of the story.' },
              { icon: AlertTriangle, title: 'Gaps go unnoticed', desc: 'Ordered tests with no result, referrals with no outcome, and conflicting documentation are easy to miss.' },
            ].map((f, i) => (
              <Card key={i} className="h-full">
                <div className="p-6">
                  <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center mb-4">
                    <f.icon className="w-5 h-5 text-brand-600" aria-hidden="true" />
                  </div>
                  <h3 className="font-semibold text-slate-900 mb-2">{f.title}</h3>
                  <p className="text-sm text-slate-600">{f.desc}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-semibold text-slate-900 mb-4">How it works</h2>
            <p className="text-lg text-slate-600">From documents to clinical knowledge to a longitudinal patient story</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {howItWorks.map(s => (
              <Card key={s.step} className="relative">
                <div className="p-6">
                  <div className="absolute -top-3 left-6 w-8 h-8 rounded-full bg-brand-600 text-white flex items-center justify-center font-bold text-lg">{s.step}</div>
                  <div className="pt-8">
                    <h3 className="text-lg font-semibold mb-2">{s.title}</h3>
                    <p className="text-slate-600 text-sm">{s.desc}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Core innovations */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-semibold text-slate-900 mb-4">Core intelligence</h2>
            <p className="text-lg text-slate-600">Five primary concepts that differentiate MedBrief from a generic summariser</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <Card key={i} className="h-full">
                <div className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0">
                      <f.icon className="w-5 h-5 text-brand-600" aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 mb-1">{f.title}</h3>
                      <p className="text-sm text-slate-600">{f.desc}</p>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Continuity */}
      <section className="py-20 bg-white border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-semibold text-slate-900 mb-4">Continuity, not just a summary</h2>
              <p className="text-lg text-slate-600 mb-6">
                A summary tells you what a document says. MedBrief tells you what changed between
                documents — and what was supposed to happen next but never did.
              </p>
              <ul className="space-y-3">
                {[
                  'Since Last Review: what is new since the last document was added',
                  'Chronological timeline with filters for visits, admissions, medications, investigations, procedures, referrals, follow-ups and findings',
                  'Medication intelligence with dose history and change tracking',
                  'Investigation intelligence with a prominent outstanding-investigations section',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-slate-700">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <Card className="p-6">
              <h3 className="font-semibold text-slate-900 mb-4">The continuity flow</h3>
              <ol className="space-y-3">
                {[
                  'Documents', 'Clinical knowledge', 'Longitudinal patient state', 'Changes',
                  'Care loops', 'Documentation conflicts', 'Attention required', 'Evidence-linked clinical briefs',
                ].map((step, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-xs font-semibold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                    <span className="text-sm text-slate-700">{step}</span>
                  </li>
                ))}
              </ol>
            </Card>
          </div>
        </div>
      </section>

      {/* Demo patients */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-semibold text-slate-900 mb-4">Demo patients</h2>
            <p className="text-lg text-slate-600">Three complex synthetic records demonstrating full longitudinal analysis</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { name: 'Arjun Mehta', period: '12 Jan – 18 Mar 2026', complexity: 'Hypertension and hyperlipidaemia. Atorvastatin documented at three doses, an echocardiogram with preserved LVEF, and a pulmonary function test ordered with no completion report.' },
              { name: 'Sarah Chen', period: '03 Feb – 22 Apr 2026', complexity: 'Type 2 diabetes and progressive CKD. A renal ultrasound requested with no imaging report, metformin continuing past the eGFR threshold, and an allergy status that conflicts between documents.' },
              { name: 'Michael Okonkwo', period: '20 Jan – 15 Mar 2026', complexity: 'Repeated COPD exacerbations. Completed steroid and antibiotic courses, serial spirometry with no results, a home oxygen assessment still outstanding, and a smoking status recorded inconsistently.' },
            ].map((p, i) => (
              <Card key={i} className="h-full">
                <div className="p-6">
                  <div className="mb-4">
                    <h3 className="font-semibold text-slate-900">{p.name}</h3>
                    <p className="text-sm text-slate-500">{p.period}</p>
                  </div>
                  <p className="text-sm text-slate-600 mb-4">{p.complexity}</p>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Badge variant="conflict">Documentation conflict</Badge>
                    <Badge variant="open">Open care loops</Badge>
                    <Badge variant="changed">Med changes</Badge>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Briefs */}
      <section className="py-20 bg-white border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <Card className="p-6">
              <h3 className="font-semibold text-slate-900 mb-4">Evidence-linked briefs</h3>
              <div className="space-y-3">
                {[
                  { name: 'Ward round brief', desc: 'Current state, recent events, what changed, medications, investigations, open loops, conflicts and verification questions.' },
                  { name: 'Referral brief', desc: 'Specialty-selected for Cardiology, Respiratory, Neurology, General Medicine and Other — with questions for the receiving clinician.' },
                  { name: 'Discharge / handoff brief', desc: 'Admission context, major events, procedures, medication changes, results and outstanding items.' },
                ].map((b, i) => (
                  <div key={i} className="p-4 border border-slate-200 rounded-lg">
                    <div className="font-medium text-slate-900 mb-1">{b.name}</div>
                    <p className="text-sm text-slate-600">{b.desc}</p>
                  </div>
                ))}
              </div>
            </Card>
            <div>
              <h2 className="text-3xl font-semibold text-slate-900 mb-4">Briefs that state what is not documented</h2>
              <p className="text-lg text-slate-600 mb-6">
                Every brief is assembled deterministically from the extracted record. When information
                is absent, the brief says so — it never invents a value, a result or a causal explanation.
                Each statement carries an evidence reference you can open and verify.
              </p>
              <Link to="/demo">
                <Button>
                  See a brief <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* BYOAI */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-semibold text-slate-900 mb-4">Bring Your Own AI</h2>
              <p className="text-lg text-slate-600 mb-6">
                MedBrief is a grounded context handoff, not a generic chatbot. It prepares a structured
                package — patient context, current state, recent changes, open care loops, conflicts and
                evidence — that you control explicitly.
              </p>
              <ul className="space-y-3">
                {[
                  'Copy Context or open in ChatGPT, Claude or Gemini — your choice, your action',
                  'Patient identifiers redacted by default',
                  'No automatic transmission of identifiable data',
                  'No API keys exposed in the frontend',
                  'Extensible provider design',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-slate-700">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <Card className="p-6">
              <h3 className="font-semibold text-slate-900 mb-4">The context package contains</h3>
              <ol className="space-y-2.5">
                {[
                  'Patient context and demographics',
                  'Current state derived from documentation',
                  'Recent changes with dates and reasons',
                  'Open care loops with missing stages',
                  'Documentation conflicts requiring review',
                  'Investigations, labs and vitals',
                  'Source excerpts, verbatim, with evidence references',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700">
                    <span className="text-brand-500 mt-1.5 flex-shrink-0">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ol>
            </Card>
          </div>
        </div>
      </section>

      {/* Safety */}
      <section className="py-20 bg-slate-50 border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-3xl font-semibold text-slate-900 mb-4">Medical safety</h2>
            <p className="text-lg text-slate-600">MedBrief is NOT a diagnostic or treatment system</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {[
              'Never diagnoses, prescribes, or recommends treatment or medication changes',
              'Never makes autonomous clinical decisions or predicts outcomes or readmission',
              'Never invents medical facts, labs, medications, diagnoses, results or causal explanations',
              'Distinguishes DOCUMENTED, INFERRED and UNKNOWN / NOT FOUND',
              'States when information is not found — never guesses',
              'No risk scores, no severity claims — only "Requires review"',
              'No claim of HIPAA, GDPR, NHS or regulatory validation',
              'Synthetic demo data clearly labelled',
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 text-left">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <p className="text-slate-700 text-sm">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-brand-900">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-semibold text-white mb-4">Ready to see it work?</h2>
          <p className="text-brand-200 mb-8">Open the demo — no backend, no credentials, no setup required.</p>
          <Link to="/demo">
            <Button size="lg" variant="secondary" className="bg-transparent border-brand-300 text-white hover:bg-brand-800">
              Try the demo <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 bg-white border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-slate-500">MedBrief AI — Clinical Continuity Intelligence. Not a diagnostic or treatment system.</p>
          <div className="flex items-center gap-6 text-sm">
            <Link to="/privacy" className="text-slate-500 hover:text-slate-700">Privacy</Link>
            <Link to="/terms" className="text-slate-500 hover:text-slate-700">Terms</Link>
            <Link to="/faq" className="text-slate-500 hover:text-slate-700">FAQ</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}