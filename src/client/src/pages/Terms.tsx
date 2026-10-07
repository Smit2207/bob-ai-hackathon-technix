import { Link } from 'react-router-dom';

export default function Terms() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <div className="mb-8">
          <Link to="/landing" className="text-sm text-brand-600 hover:underline">← Back</Link>
          <h1 className="text-3xl font-semibold text-slate-900 mt-4">Terms of Use</h1>
          <p className="text-slate-500 mt-2">Last updated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>

        <div className="space-y-8 text-slate-700 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">1. Acceptance</h2>
            <p>
              By accessing or using MedBrief AI, you accept these terms. If you do not accept them,
              do not use the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">2. Description of the service</h2>
            <p>
              MedBrief AI analyses medical documents you upload and reconstructs a longitudinal patient
              story, highlighting changes, open care loops, documentation conflicts, and evidence.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">3. Not a medical device</h2>
            <p>
              <strong>MedBrief is not a diagnostic or treatment system.</strong> It never diagnoses,
              prescribes, recommends treatment or medication changes, makes autonomous clinical decisions,
              or predicts outcomes. It reports only what is documented in the records you provide and
              explicitly states when information is not found. Absence of information does not mean
              absence of care.
            </p>
            <p className="mt-3">
              You must not rely on MedBrief as a substitute for professional clinical judgement.
              All clinical decisions remain the responsibility of a qualified clinician.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">4. Your responsibilities</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>You are responsible for the lawfulness of the documents you upload.</li>
              <li>You must have appropriate authority to upload patient information.</li>
              <li>You must keep your account credentials confidential.</li>
              <li>You must verify any MedBrief output before acting on it.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">5. Demo data</h2>
            <p>
              Demo Mode contains synthetic data only, clearly labelled "SYNTHETIC DEMO DATA — NOT FOR
              CLINICAL USE". No real patient data is present in the demo.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">6. Bring Your Own AI</h2>
            <p>
              Context packages for external assistants are generated only on explicit user action.
              MedBrief never transmits your data to third-party AI services automatically. When you
              choose to paste context into a third-party service, you do so at your own discretion and
              that service's terms apply.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">7. Availability and liability</h2>
            <p>
              MedBrief is provided "as is" without warranties of any kind. To the maximum extent
              permitted by law, MedBrief is not liable for any clinical decisions made using its output.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}