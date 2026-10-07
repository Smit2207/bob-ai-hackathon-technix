import { Link } from 'react-router-dom';
import { FileQuestion, Home, Search } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-2xl bg-brand-50 flex items-center justify-center mx-auto mb-6">
          <FileQuestion className="w-8 h-8 text-brand-600" aria-hidden="true" />
        </div>
        <p className="text-sm font-medium text-brand-600 uppercase tracking-wider mb-2">404</p>
        <h1 className="text-3xl font-semibold text-slate-900 mb-3">Page not found</h1>
        <p className="text-slate-500 mb-8">
          The page you are looking for does not exist or has been moved.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link to="/" className="btn-primary px-4 py-2">
            <Home className="w-4 h-4" />
            Dashboard
          </Link>
          <Link to="/landing" className="btn-secondary px-4 py-2">
            <Search className="w-4 h-4" />
            Landing page
          </Link>
        </div>
      </div>
    </div>
  );
}