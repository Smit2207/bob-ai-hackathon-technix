import { Link } from 'react-router-dom';
import { Shield, Lock, Database, Eye, Trash2 } from 'lucide-react';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <div className="mb-8">
          <Link to="/landing" className="text-sm text-brand-600 hover:underline">← Back</Link>
          <h1 className="text-3xl font-semibold text-slate-900 mt-4">Privacy Policy</h1>
          <p className="text-slate-500 mt-2">Last updated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>

        <div className="space-y-8 text-slate-700 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Shield className="w-5 h-5 text-brand-600" /> Overview
            </h2>
            <p>
              MedBrief AI is a clinical continuity intelligence tool. It analyses medical documents you upload
              to reconstruct a longitudinal patient story. This policy explains what data we collect, how it is
              used, and how it is protected.
            </p>
            <p className="mt-3">
              <strong>MedBrief is not a diagnostic or treatment system.</strong> It does not provide medical
              advice, diagnoses, or treatment recommendations. It is not a substitute for professional clinical
              judgement.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Database className="w-5 h-5 text-brand-600" /> Data we collect
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Account data:</strong> your name, email address, and a bcrypt-hashed password.</li>
              <li><strong>Uploaded documents:</strong> the medical records you upload, their extracted text, and the clinical structures derived from them.</li>
              <li><strong>Derived analysis:</strong> events, medications, investigations, care loops, and conflicts computed from your documents.</li>
            </ul>
            <p className="mt-3">
              We do not collect data you do not provide. Demo Mode runs entirely in your browser and transmits
              nothing to any server.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Lock className="w-5 h-5 text-brand-600" /> How we protect data
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Passwords are hashed with bcrypt and never stored in plain text.</li>
              <li>Sessions use httpOnly, sameSite cookies.</li>
              <li>Every patient record is scoped to the owning account. Record access is verified on every request.</li>
              <li>Bring Your Own AI context packages are generated only on explicit user action and are never transmitted automatically.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Eye className="w-5 h-5 text-brand-600" /> Third-party AI
            </h2>
            <p>
              MedBrief can prepare a context package for external assistants (ChatGPT, Claude, Gemini).
              This is entirely opt-in: you must explicitly copy the context or open the provider.
              When you paste context into a third-party service, that service's own privacy policy applies.
              MedBrief redacts patient identifiers by default.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-brand-600" /> Your rights
            </h2>
            <p>
              You can delete your account and all associated patient records at any time from the dashboard.
              Deletion removes the records and their derived analysis.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">Synthetic demo data</h2>
            <p>
              All demo patients are synthetic and clearly labelled. They contain no real patient information.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">Regulatory status</h2>
            <p>
              MedBrief is a software tool for document analysis. It is not a certified medical device and makes
              no claim of HIPAA, GDPR, NHS, or other regulatory validation. You are responsible for ensuring
              your use complies with applicable law and clinical governance.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}