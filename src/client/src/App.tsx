import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './store/auth';
import { useEffect, Suspense, lazy, useState, type ReactNode } from 'react';
import { api } from './utils/api';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import PatientContinuity from './pages/PatientContinuity';
import PatientTimeline from './pages/PatientTimeline';
import PatientChangeMap from './pages/PatientChangeMap';
import PatientCareLoop from './pages/PatientCareLoop';
import PatientMedications from './pages/PatientMedications';
import PatientInvestigations from './pages/PatientInvestigations';
import PatientEvidence from './pages/PatientEvidence';
import PatientBriefs from './pages/PatientBriefs';
import PatientCompare from './pages/PatientCompare';
import PatientAnalytics from './pages/PatientAnalytics';
import Settings from './pages/Settings';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import FAQ from './pages/FAQ';
import NotFound from './pages/NotFound';
import { Spinner } from './components/UI';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, token } = useAuthStore();
  const [checked, setChecked] = useState(false);
  const location = useLocation();
  // Allow demo mode to bypass authentication
  const isDemo = new URLSearchParams(location.search).get('demo') === '1';

  useEffect(() => {
    if (isDemo) { setChecked(true); return; }
    if (token && !user) {
      api.auth.me()
        .then(r => { useAuthStore.setState({ user: r.user }); })
        .catch(() => { useAuthStore.getState().clear(); });
    }
    setChecked(true);
  }, [token, user, isDemo]);
  if (!checked) return <div className="min-h-screen flex items-center justify-center"><Spinner size="lg" /></div>;
  if (isDemo) return <>{children}</>;
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

function PublicRoute({ children }: { children: ReactNode }) {
  const { user } = useAuthStore();
  return user ? <Navigate to="/dashboard" replace /> : <>{children}</>;
}

function RootRedirect() {
  const { user } = useAuthStore();
  return user ? <Navigate to="/dashboard" replace /> : <Landing />;
}

function DemoRoute({ children }: { children: ReactNode }) {
  // Demo mode doesn't require authentication
  return <>{children}</>;
}

function App() {
  return (
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/landing" element={<Landing />} />
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
        <Route path="/demo" element={<DemoRoute><Layout demoMode><Dashboard demoMode /></Layout></DemoRoute>} />
        <Route path="/patients/:id" element={<ProtectedRoute><Layout><PatientContinuity /></Layout></ProtectedRoute>} />
      <Route path="/patients/:id/timeline" element={<ProtectedRoute><Layout><PatientTimeline /></Layout></ProtectedRoute>} />
      <Route path="/patients/:id/changemap" element={<ProtectedRoute><Layout><PatientChangeMap /></Layout></ProtectedRoute>} />
      <Route path="/patients/:id/careloop" element={<ProtectedRoute><Layout><PatientCareLoop /></Layout></ProtectedRoute>} />
      <Route path="/patients/:id/medications" element={<ProtectedRoute><Layout><PatientMedications /></Layout></ProtectedRoute>} />
      <Route path="/patients/:id/investigations" element={<ProtectedRoute><Layout><PatientInvestigations /></Layout></ProtectedRoute>} />
      <Route path="/patients/:id/evidence" element={<ProtectedRoute><Layout><PatientEvidence /></Layout></ProtectedRoute>} />
      <Route path="/patients/:id/briefs" element={<ProtectedRoute><Layout><PatientBriefs /></Layout></ProtectedRoute>} />
      <Route path="/patients/:id/analytics" element={<ProtectedRoute><Layout><PatientAnalytics /></Layout></ProtectedRoute>} />
      <Route path="/compare" element={<ProtectedRoute><Layout><PatientCompare /></Layout></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Layout><Settings /></Layout></ProtectedRoute>} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/faq" element={<FAQ />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;