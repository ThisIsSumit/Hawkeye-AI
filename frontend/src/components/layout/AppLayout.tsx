import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard, AlertTriangle, Bell,
  Search, FileText, Settings, Shield,
  Database, LogOut,
} from 'lucide-react';
import { StreamStatus } from '../ui/StreamStatus.tsx';
import { useLiveStream } from '../../lib/StreamContext.tsx';
import { useAuth }       from '../../lib/AuthContext.tsx';
import { hasRole }       from '../../lib/auth.ts';

const NAV = [
  { to: '/dashboard',     icon: LayoutDashboard, label: 'Dashboard',     section: 'Monitor',      minRole: 'VIEWER'  as const },
  { to: '/threats',       icon: AlertTriangle,   label: 'Threat Feed',   section: 'Monitor',      minRole: 'VIEWER'  as const },
  { to: '/alerts',        icon: Bell,            label: 'Alerts',        section: 'Monitor',      minRole: 'VIEWER'  as const },
  { to: '/investigation', icon: Search,          label: 'Investigations',section: 'Investigate',  minRole: 'ANALYST' as const },
  { to: '/logs',          icon: Database,        label: 'Log Intelligence',section:'Investigate',  minRole: 'ANALYST' as const },
  { to: '/reports',       icon: FileText,        label: 'Reports',       section: 'Investigate',  minRole: 'VIEWER'  as const },
  { to: '/settings',      icon: Settings,        label: 'Settings',      section: 'Admin',        minRole: 'ANALYST' as const },
];

const SECTIONS = ['Monitor', 'Investigate', 'Admin'];

const ROLE_BADGE: Record<string, string> = {
  ADMIN:   'bg-purple-500/20 text-purple-400 border-purple-500/30',
  ANALYST: 'bg-primary/20 text-primary border-primary/30',
  VIEWER:  'bg-surface-high text-on-surface-variant border-outline-variant/30',
};

export function AppLayout() {
  const { newAlerts, liveEvents } = useLiveStream();
  const { user, logout }          = useAuth();
  const criticalCount = liveEvents.filter(e => e.severity === 'critical').length;

  const visibleNav = NAV.filter(n => hasRole(user, n.minRole));

  return (
    <div className="flex h-screen overflow-hidden bg-background text-on-surface font-sans selection:bg-primary/20 selection:text-primary">

      {/* Sidebar - Sovereign Command Deep Layer */}
      <aside className="w-[220px] min-w-[220px] bg-surface-lowest flex flex-col h-screen border-r border-outline-variant/20 relative z-20">
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-outline-variant/20">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-primary to-primary-container shadow-glow">
            <Shield className="w-4 h-4 text-surface-lowest" />
          </div>
          <div>
            <p className="text-on-surface text-sm font-display font-bold tracking-tight">HawkEye AI</p>
            <p className="text-primary text-[10px] font-mono tracking-widest uppercase mt-0.5 opacity-80">Threat Intel</p>
          </div>
        </div>

        <nav className="flex-1 px-2.5 py-3 overflow-y-auto">
          {SECTIONS.map(section => {
            const items = visibleNav.filter(n => n.section === section);
            if (items.length === 0) return null;
            return (
              <div key={section} className="mb-2">
                <p className="text-on-surface-variant/50 text-[10px] font-bold tracking-[0.2em] uppercase px-2.5 py-2">
                  {section}
                </p>
                {items.map(({ to, icon: Icon, label }) => (
                  <NavLink key={to} to={to} className={({ isActive }) =>
                    `flex items-center gap-2.5 px-2.5 py-2 rounded object-cover text-[13px] mb-0.5 transition-all select-none border border-transparent ${
                      isActive 
                        ? 'bg-primary/10 text-primary border-primary/20' 
                        : 'text-on-surface-variant hover:bg-surface-low hover:text-on-surface'
                    }`
                  }>
                    {({ isActive }) => (<>
                      <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-primary' : 'text-on-surface-variant/70'}`} />
                      <span className="font-medium">{label}</span>
                      {label === 'Threat Feed' && criticalCount > 0 && (
                        <span className="ml-auto bg-error/20 border border-error/30 text-error text-[10px] font-mono px-1.5 py-0.5 rounded shadow-[0_0_8px_rgba(255,180,171,0.2)]">{criticalCount}</span>
                      )}
                      {label === 'Alerts' && newAlerts.length > 0 && (
                        <span className="ml-auto bg-tertiary/20 border border-tertiary/30 text-tertiary text-[10px] font-mono px-1.5 py-0.5 rounded">{newAlerts.length}</span>
                      )}
                    </>)}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>

        {/* User + logout */}
        <div className="px-2.5 py-3 border-t border-outline-variant/20 space-y-1 bg-surface-lowest">
          <div className="flex items-center gap-2.5 px-2.5 py-2">
            <div className="w-8 h-8 rounded-full bg-surface-highest border border-outline-variant/30 flex items-center justify-center text-primary text-[11px] font-bold font-mono flex-shrink-0">
              {user?.name.slice(0, 2).toUpperCase() ?? 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-on-surface text-xs font-semibold truncate">{user?.name}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <span className={`text-[9px] font-bold font-mono px-1.5 py-0.5 rounded border ${ROLE_BADGE[user?.role ?? 'VIEWER']}`}>
                  {user?.role}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-on-surface-variant/70 hover:text-error hover:bg-error/10 transition-colors text-xs font-medium"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        </div>
      </aside>

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Glow Effects in background */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none -z-10" />
        <div className="absolute bottom-1/4 right-0 w-96 h-96 bg-secondary/5 rounded-full blur-3xl pointer-events-none -z-10" />

        {/* Header - Glassmorphic */}
        <header className="h-14 glass-header flex items-center px-6 gap-4 flex-shrink-0 z-10 relative">
          <div className="flex-1 max-w-sm relative group">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-on-surface-variant group-focus-within:text-primary transition-colors" />
            <input type="text" placeholder="Search parameters, arrays, endpoints…"
              className="w-full pl-8 pr-3 py-1.5 text-[13px] bg-surface-lowest/50 border border-outline-variant/30 rounded font-mono text-on-surface outline-none focus:border-primary/50 focus:bg-surface-low transition-all focus:shadow-glow placeholder-on-surface-variant/50" />
          </div>
          <div className="ml-auto flex items-center gap-3">
            <StreamStatus />
            <button className="relative w-8 h-8 border border-outline-variant/30 rounded flex items-center justify-center hover:bg-surface-high transition-colors text-on-surface-variant hover:text-on-surface bg-surface-low/50">
              <Bell className="w-4 h-4" />
              {newAlerts.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-error rounded-full shadow-[0_0_8px_rgba(255,180,171,0.8)]" />
              )}
            </button>
            <div className="w-8 h-8 rounded border border-outline-variant/30 bg-surface-highest flex items-center justify-center text-primary text-xs font-bold font-mono">
              {user?.name.slice(0, 2).toUpperCase() ?? 'U'}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 z-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
