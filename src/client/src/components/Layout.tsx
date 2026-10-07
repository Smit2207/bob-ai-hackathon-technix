import { Outlet, NavLink, useLocation, Link } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { api } from '../utils/api';
import {
  Layout as LayoutIcons, Home, Users, Activity, Settings, LogOut,
  ChevronLeft, ChevronRight, Bell, HelpCircle, Menu, X, User,
  AlertTriangle, FileText, History, ClipboardList, Pill, Stethoscope,
  Search, Calendar, GitCompare,
} from 'lucide-react';
import { useState } from 'react';
import { IconButton } from './UI';

const nav = [
  { href: '/dashboard', label: 'Dashboard', icon: Home },
  { href: '/compare', label: 'Compare', icon: GitCompare },
];

const patientNav = [
  { key: '', label: 'Continuity', icon: FileText },
  { key: 'timeline', label: 'Timeline', icon: History },
  { key: 'changemap', label: 'ChangeMap', icon: Activity },
  { key: 'careloop', label: 'CareLoop', icon: ClipboardList },
  { key: 'medications', label: 'Medications', icon: Pill },
  { key: 'investigations', label: 'Investigations', icon: Stethoscope },
  { key: 'evidence', label: 'Evidence', icon: Search },
  { key: 'briefs', label: 'Briefs', icon: Calendar },
  { key: 'analytics', label: 'Analytics', icon: Activity },
];

export default function Layout({ children, demoMode }: { children?: React.ReactNode; demoMode?: boolean }) {
  const { user, clear } = useAuthStore();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isPatientRoute = location.pathname.startsWith('/patients/');
  const patientId = isPatientRoute ? location.pathname.split('/')[2] : null;
  const activePatientTab = isPatientRoute ? (location.pathname.split('/')[3] || '') : null;
  const isDemo = demoMode || location.search.includes('demo=1');

  const title = isPatientRoute
    ? 'Patient Record'
    : location.pathname === '/dashboard'
    ? 'Dashboard'
    : location.pathname === '/compare'
    ? 'Compare records'
    : location.pathname === '/settings'
    ? 'Settings'
    : 'MedBrief AI';

  return (
    <div className="min-h-screen bg-slate-50">
      {mobileOpen && <div className="fixed inset-0 z-40 bg-black/20 lg:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 bg-white border-r border-slate-200 transition-all duration-200 flex flex-col ${
          collapsed ? 'w-16' : 'w-64'
        } lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
        aria-label="Main navigation"
      >
        <div className="flex items-center h-16 px-2 border-b border-slate-100">
          {!collapsed ? (
            <>
              <div className="flex items-center gap-2 flex-1 min-w-0 px-2">
                <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center flex-shrink-0">
                  <LayoutIcons className="w-5 h-5 text-white" aria-hidden="true" />
                </div>
                <span className="font-semibold text-slate-900 truncate">MedBrief AI</span>
              </div>
              <IconButton
                variant="ghost"
                size="sm"
                onClick={() => setCollapsed(true)}
                aria-label="Collapse sidebar"
              >
                <ChevronLeft className="w-5 h-5" />
              </IconButton>
            </>
          ) : (
            <div className="flex flex-col items-center w-full gap-2 py-1">
              <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
                <LayoutIcons className="w-5 h-5 text-white" aria-hidden="true" />
              </div>
              <IconButton
                variant="ghost"
                size="sm"
                onClick={() => setCollapsed(false)}
                aria-label="Expand sidebar"
              >
                <ChevronRight className="w-5 h-5" />
              </IconButton>
            </div>
          )}
        </div>

        <nav className="flex-1 py-4 px-3 overflow-y-auto" aria-label="Primary">
          <ul className="space-y-1" role="list">
            {nav.map(item => (
              <li key={item.href}>
                <NavLink
                  to={item.href}
                  className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''} ${collapsed ? 'justify-center px-2' : ''}`}
                  aria-current={undefined}
                  onClick={() => setMobileOpen(false)}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                  {!collapsed && <span>{item.label}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {isPatientRoute && patientId && !collapsed && (
          <div className="border-t border-slate-100 px-3 py-3">
            <h3 className="section-title">Patient record</h3>
            <ul className="space-y-1" role="list">
              {patientNav.map(item => {
                const href = `/patients/${patientId}${item.key ? `/${item.key}` : ''}${isDemo ? '?demo=1' : ''}`;
                const isActive = activePatientTab === item.key || (item.key === '' && !activePatientTab);
                return (
                  <li key={item.key || 'overview'}>
                    <NavLink
                      to={href}
                      className={({ isActive: navActive }) => `sidebar-link ${navActive || isActive ? 'active' : ''}`}
                      onClick={() => setMobileOpen(false)}
                    >
                      <item.icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                      <span>{item.label}</span>
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {isDemo && !collapsed && (
          <div className="mx-3 mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center gap-2 text-xs text-amber-800">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
              <span>SYNTHETIC DEMO DATA — NOT FOR CLINICAL USE</span>
            </div>
          </div>
        )}

        <div className={`p-3 border-t border-slate-100 ${collapsed ? 'flex flex-col items-center gap-2' : ''}`}>
          {!collapsed && user && (
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5 text-brand-600" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{user?.name}</p>
                <p className="text-xs text-slate-500 truncate">{user?.email}</p>
              </div>
            </div>
          )}
          {!collapsed && (
            <div className="space-y-1">
              <NavLink to="/settings" className="sidebar-link">
                <Settings className="w-5 h-5" aria-hidden="true" />
                <span>Settings</span>
              </NavLink>
              <button
                onClick={() => { clear(); api.auth.logout().catch(() => {}); window.location.href = '/login'; }}
                className="sidebar-link w-full text-red-600 hover:bg-red-50"
              >
                <LogOut className="w-5 h-5" aria-hidden="true" />
                <span>Sign out</span>
              </button>
            </div>
          )}
          {collapsed && (
            <>
              <IconButton variant="ghost" size="sm" onClick={() => {}} aria-label="Settings">
                <Link to="/settings"><Settings className="w-5 h-5" aria-hidden="true" /></Link>
              </IconButton>
              <IconButton
                variant="ghost"
                size="sm"
                onClick={() => { clear(); api.auth.logout().catch(() => {}); window.location.href = '/login'; }}
                aria-label="Sign out"
              >
                <LogOut className="w-5 h-5 text-red-600" aria-hidden="true" />
              </IconButton>
            </>
          )}
        </div>
      </aside>

      {/* Top bar */}
      <header
        className={`lg:ml-64 transition-all duration-200 ${collapsed ? 'lg:ml-16' : ''} sticky top-0 z-30 bg-white/80 backdrop-blur-sm border-b border-slate-100`}
      >
        <div className="flex items-center justify-between h-16 px-4 lg:px-6">
          <div className="flex items-center gap-4">
            <IconButton variant="ghost" size="md" onClick={() => setMobileOpen(true)} aria-label="Open menu" className="lg:hidden">
              <Menu className="w-6 h-6" aria-hidden="true" />
            </IconButton>
            <h1 className="text-xl font-semibold text-slate-900 hidden sm:block">{title}</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <IconButton variant="ghost" size="md" aria-label="Notifications">
                <Bell className="w-5 h-5" aria-hidden="true" />
              </IconButton>
            </div>
            <NavLink to="/faq" aria-label="Help">
              <IconButton variant="ghost" size="md" aria-label="Help">
                <HelpCircle className="w-5 h-5" aria-hidden="true" />
              </IconButton>
            </NavLink>
          </div>
        </div>
      </header>

      <main className={`lg:ml-64 transition-all duration-200 min-h-[calc(100vh-4rem)] ${collapsed ? 'lg:ml-16' : ''}`}>
        <div className="p-4 lg:p-6">
          {children}
          <Outlet />
        </div>
      </main>
    </div>
  );
}