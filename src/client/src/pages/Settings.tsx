import { useState } from 'react';
import { useAuthStore } from '../store/auth';
import { Card, Button, Input, Badge } from '../components/UI';
import { Settings as SettingsIcon, Shield, Key, Database, Bell, Check } from 'lucide-react';

export default function Settings() {
  const { user, clear } = useAuthStore();
  const [saved, setSaved] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Account, privacy and display preferences.</p>
      </div>

      <Card>
        <div className="card-header">
          <h2 className="text-lg font-semibold text-slate-900">Account</h2>
        </div>
        <div className="card-body space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center">
              <span className="font-semibold text-brand-700">{(user?.name ?? 'U').slice(0, 1).toUpperCase()}</span>
            </div>
            <div>
              <p className="font-medium text-slate-900">{user?.name}</p>
              <p className="text-sm text-slate-500">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Shield className="w-4 h-4 text-green-600" />
            Passwords are hashed with bcrypt. Sessions use httpOnly cookies.
          </div>
        </div>
      </Card>

      <Card>
        <div className="card-header">
          <h2 className="text-lg font-semibold text-slate-900">Privacy & data</h2>
        </div>
        <div className="card-body space-y-4">
          <div className="flex items-start gap-3">
            <Database className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-slate-900">Your data stays yours</p>
              <p className="text-sm text-slate-500">
                Uploaded documents are stored in your own workspace and are only accessible to your account.
                MedBrief never trains on your data and never transmits it to third-party AI services automatically.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Key className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-slate-900">Bring Your Own AI is opt-in</p>
              <p className="text-sm text-slate-500">
                Context packages for ChatGPT, Claude and Gemini are only created when you explicitly copy or open them.
                Identifiers are redacted by default.
              </p>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="card-header">
          <h2 className="text-lg font-semibold text-slate-900">Preferences</h2>
        </div>
        <div className="card-body space-y-4">
          <label className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-900">Notifications</p>
              <p className="text-xs text-slate-500">Show attention reminders in the top bar</p>
            </div>
            <input
              type="checkbox"
              checked={notifications}
              onChange={e => setNotifications(e.target.checked)}
              className="rounded border-slate-300"
            />
          </label>
          <label className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-900">Reduce motion</p>
              <p className="text-xs text-slate-500">Minimise animations (also follows your OS setting)</p>
            </div>
            <input
              type="checkbox"
              checked={reducedMotion}
              onChange={e => setReducedMotion(e.target.checked)}
              className="rounded border-slate-300"
            />
          </label>
          <div className="pt-2">
            <Button onClick={handleSave}>
              {saved ? <Check className="w-4 h-4 text-green-600" /> : null}
              {saved ? 'Saved' : 'Save preferences'}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="border-red-200">
        <div className="card-header">
          <h2 className="text-lg font-semibold text-slate-900">Danger zone</h2>
        </div>
        <div className="card-body">
          <p className="text-sm text-slate-600 mb-4">
            Sign out of this workspace. Your data remains stored and is accessible when you sign back in.
          </p>
          <Button variant="danger" onClick={() => { clear(); window.location.href = '/login'; }}>
            Sign out
          </Button>
        </div>
      </Card>
    </div>
  );
}