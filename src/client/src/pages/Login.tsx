import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { api } from '../utils/api';
import { Layout as LayoutIcon, Mail, Lock, AlertCircle, Loader2 } from 'lucide-react';
import { Button, Input, Card } from '../components/UI';

export default function Login() {
  const navigate = useNavigate();
  const setAuth = useAuthStore(s => s.setAuth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.auth.login({ email, password });
      setAuth(res.user, res.token);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Login failed');
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
          <h1 className="text-2xl font-semibold text-slate-900">Welcome back</h1>
          <p className="text-slate-500 mt-1">Sign in to MedBrief AI</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</div>}
          <Input label="Email" type="email" id="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@hospital.nhs.uk" required />
          <Input label="Password" type="password" id="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" required />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sign in'}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500">
          No account? <Link to="/signup" className="text-brand-600 hover:underline font-medium">Sign up</Link>
        </p>
        <p className="mt-4 text-center text-xs text-slate-400">Demo: <Link to="/demo" className="text-brand-600 hover:underline">Try without account</Link></p>
      </Card>
    </div>
  );
}