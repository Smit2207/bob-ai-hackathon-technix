import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { api } from '../utils/api';
import { Layout as LayoutIcon, Mail, Lock, User, AlertCircle, Loader2 } from 'lucide-react';
import { Button, Input, Card } from '../components/UI';

export default function Signup() {
  const navigate = useNavigate();
  const setAuth = useAuthStore(s => s.setAuth);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) return setError('Passwords do not match');
    if (password.length < 6) return setError('Password must be at least 6 characters');
    setLoading(true);
    try {
      const res = await api.auth.signup({ name, email, password });
      setAuth(res.user, res.token);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-brand-600 flex items-center justify-center mx-auto mb-4">
            <LayoutIcon className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">Create account</h1>
          <p className="text-slate-500 mt-1">Start using MedBrief AI</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</div>}
          <Input label="Name" id="name" value={name} onChange={e=>setName(e.target.value)} placeholder="Dr. Jane Smith" required />
          <Input label="Email" type="email" id="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@hospital.nhs.uk" required />
          <Input label="Password" type="password" id="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" required />
          <Input label="Confirm Password" type="password" id="confirm" value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="••••••••" required />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create account'}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500">
          Have an account? <Link to="/login" className="text-brand-600 hover:underline font-medium">Sign in</Link>
        </p>
        <p className="mt-4 text-center text-xs text-slate-400">Demo: <Link to="/demo" className="text-brand-600 hover:underline">Try without account</Link></p>
      </Card>
    </div>
  );
}