import { useState, useEffect } from 'react';
import { Key, Bell, Sliders, Users, CheckCircle2, Loader2 } from 'lucide-react';
import { useAuth } from '../lib/AuthContext.tsx';
import { hasRole } from '../lib/auth.ts';
import { api } from '../lib/api.ts';

interface UserRecord {
  id: string;
  email: string;
  name: string;
  role: string;
  active: boolean;
}

function UsersPanel() {
  const [users, setUsers]     = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    let cancelled = false;
    api.auth.users()
      .then(data => {
        if (!cancelled) setUsers(data as UserRecord[]);
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to fetch users');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="p-6">
      <h2 className="font-display font-semibold text-on-surface mb-1">Personnel Roster</h2>
      <p className="text-on-surface-variant text-[11px] font-mono tracking-wide uppercase mb-6">Manage access protocols</p>

      {loading && (
        <div className="flex items-center justify-center py-12 gap-3 text-primary font-mono text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading personnel…
        </div>
      )}

      {error && (
        <div className="bg-error/10 border border-error/30 rounded-lg px-4 py-3 text-[11px] font-mono text-error">
          {error}
        </div>
      )}

      {!loading && !error && (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-outline-variant/30 text-left text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
              <th className="pb-3 px-4">Identifier</th>
              <th className="pb-3 px-4">Contact</th>
              <th className="pb-3 px-4">Clearance</th>
              <th className="pb-3 px-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/10">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-surface-high/10 transition-colors">
                <td className="py-4 px-4 font-medium text-on-surface text-sm">{u.name}</td>
                <td className="py-4 px-4 text-on-surface-variant font-mono text-xs">{u.email}</td>
                <td className="py-4 px-4">
                  <span className={`text-[9px] font-bold font-mono px-2 py-0.5 rounded uppercase tracking-wider ${
                    u.role === 'ADMIN' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                    u.role === 'ANALYST' ? 'bg-primary/10 text-primary border border-primary/20' :
                    'bg-surface-lowest border border-outline-variant/30 text-on-surface-variant'
                  }`}>{u.role}</span>
                </td>
                <td className="py-4 px-4">
                  <span className={`text-[9px] font-bold font-mono px-2 py-0.5 rounded uppercase tracking-wider ${
                    u.active
                      ? 'bg-secondary/10 text-secondary shadow-glow-secondary'
                      : 'bg-error/10 text-error'
                  }`}>{u.active ? 'Active' : 'Inactive'}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const TABS = [
  { id: 'users',      label: 'Personnel Roster', icon: Users,    minRole: 'ADMIN'   as const },
  { id: 'api',        label: 'API Tokens',       icon: Key,      minRole: 'ADMIN'   as const },
  { id: 'thresholds', label: 'Thresholds',       icon: Sliders,  minRole: 'ANALYST' as const },
  { id: 'notif',      label: 'Telemetry Links',  icon: Bell,     minRole: 'ANALYST' as const },
];

function Toggle({ defaultOn = false }: { defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <button
      onClick={() => setOn(o => !o)}
      className={`w-9 h-5 rounded-full transition-colors flex-shrink-0 relative border ${on ? 'bg-primary border-primary shadow-glow' : 'bg-surface-lowest border-outline-variant/30'}`}
    >
      <span className={`absolute top-0.5 w-3.5 h-3.5 bg-background rounded-full shadow transition-transform ${on ? 'translate-x-4 border border-background/20' : 'translate-x-0.5 border border-outline-variant/50'}`} />
    </button>
  );
}

function RangeRow({ label, defaultValue }: { label: string; defaultValue: number }) {
  const [val, setVal] = useState(defaultValue);
  return (
    <div className="flex items-center gap-4 py-2.5">
      <span className="text-[11px] font-bold font-mono tracking-widest uppercase text-on-surface-variant w-48 flex-shrink-0">{label}</span>
      <input type="range" min={0} max={100} value={val} onChange={e => setVal(+e.target.value)}
        className="flex-1 accent-primary bg-surface-lowest h-1.5 rounded-full appearance-none cursor-pointer" />
      <span className="font-mono text-[11px] font-bold text-primary w-10 text-right">{val}%</span>
    </div>
  );
}

export function Settings() {
  const { user } = useAuth();
  const [tab, setTab] = useState('thresholds');
  const [saved, setSaved] = useState(false);

  function save() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const visibleTabs = TABS.filter(t => hasRole(user, t.minRole));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display text-on-surface tracking-tight">Configuration Matrix</h1>
        <p className="text-on-surface-variant text-sm mt-1 font-mono uppercase tracking-wider text-[11px]">System parameters & external connectivity</p>
      </div>

      <div className="grid grid-cols-[220px_1fr] gap-6 items-start">
        {/* Sidebar nav */}
        <div className="glass-panel rounded-xl overflow-hidden py-2 shrink-0">
          {visibleTabs.map(({ id, label, icon: Icon }) => {
            const active = tab === id;
            return (
              <button key={id} onClick={() => setTab(id)}
                className={`w-full flex items-center gap-3 px-5 py-3.5 text-[11px] font-bold font-mono tracking-widest uppercase text-left transition-colors relative ${
                  active 
                    ? 'text-primary bg-surface-high/30' 
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-high/10'
                }`}
              >
                {active && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary shadow-glow" />}
                <Icon className={`w-4 h-4 ${active ? 'text-primary' : 'text-on-surface-variant/70'}`} />
                {label}
              </button>
            );
          })}
        </div>

        {/* Panel */}
        <div className="glass-panel rounded-xl overflow-hidden min-h-[400px]">

          {/* Users */}
          {tab === 'users' && (
            <UsersPanel />
          )}

          {/* API Keys */}
          {tab === 'api' && (
            <div className="p-6">
              <h2 className="font-display font-semibold text-on-surface mb-1">API Tokens</h2>
              <p className="text-on-surface-variant text-[11px] font-mono tracking-wide uppercase mb-6">Manage autonomous interlinks</p>
              <div className="space-y-0">
                {[
                  { name: 'Production Interface', val: 'hk_prod_••••••••4f8a', active: true },
                  { name: 'Staging Sandbox',      val: 'hk_stag_••••••••9c2b', active: true },
                ].map(k => (
                  <div key={k.name} className="flex items-center gap-4 py-4 border-b border-outline-variant/20 last:border-0 hover:bg-surface-high/10 transition-colors px-2 rounded-lg -mx-2">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-on-surface">{k.name}</p>
                      <p className="font-mono text-xs text-on-surface-variant mt-1 bg-surface-lowest inline-block px-2 py-0.5 rounded border border-outline-variant/30">{k.val}</p>
                    </div>
                    <span className="text-[9px] font-bold font-mono bg-secondary/10 text-secondary px-2 py-0.5 rounded shadow-glow-secondary uppercase tracking-wider">Active</span>
                    <button className="text-[10px] font-bold font-mono text-primary hover:text-primary-container px-3 py-1.5 border border-primary/20 hover:border-primary/50 bg-primary/5 rounded transition-colors uppercase tracking-widest shadow-glow">Copy</button>
                    <button className="text-[10px] font-bold font-mono text-error hover:text-red-400 px-3 py-1.5 uppercase tracking-widest opacity-70 hover:opacity-100 transition-opacity">Revoke</button>
                  </div>
                ))}
              </div>
              <button className="mt-6 px-4 py-2.5 text-[11px] font-bold font-mono uppercase tracking-widest bg-primary text-background rounded peer hover:bg-primary-container transition-colors shadow-glow">
                Forge New Token
              </button>
            </div>
          )}

          {/* Thresholds */}
          {tab === 'thresholds' && (
            <div className="p-6">
              <h2 className="font-display font-semibold text-on-surface mb-1">Detection Thresholds</h2>
              <p className="text-on-surface-variant text-[11px] font-mono tracking-wide uppercase mb-6">Sensor calibration metrics</p>
              <div className="space-y-1">
                <RangeRow label="SQL Injection Sensitivity" defaultValue={75} />
                <RangeRow label="Brute Force Threshold"     defaultValue={50} />
                <RangeRow label="DDoS Detection"            defaultValue={85} />
                <RangeRow label="Anomaly Score Cutoff"      defaultValue={60} />
                <RangeRow label="XSS Detection"             defaultValue={70} />
              </div>
              <button onClick={save}
                className="mt-8 flex items-center justify-center gap-2 px-5 py-2.5 text-[11px] font-bold font-mono uppercase tracking-widest bg-primary text-background rounded hover:bg-primary-container transition-colors shadow-glow">
                {saved ? <><CheckCircle2 className="w-3.5 h-3.5" />Committed</> : 'Commit Matrix'}
              </button>
            </div>
          )}

          {/* Notifications */}
          {tab === 'notif' && (
            <div className="p-6">
              <h2 className="font-display font-semibold text-on-surface mb-1">Telemetry Links</h2>
              <p className="text-on-surface-variant text-[11px] font-mono tracking-wide uppercase mb-6">Dispatch parameters for critical alerts</p>
              <div className="divide-y divide-outline-variant/20 relative">
                {[
                  { label: 'Slack Protocol',        desc: 'Send critical intel to #security-alerts', on: true },
                  { label: 'SMTP Digest',           desc: 'Daily synthesis + immediate critical pings',  on: true },
                  { label: 'PagerDuty Escalate',    desc: 'On-call override for critical incidents', on: false },
                  { label: 'Webhook Terminus',      desc: 'POST to custom origin on new signatures',         on: true },
                ].map((n, i) => (
                  <div key={n.label} className="flex items-center justify-between py-4 hover:bg-surface-high/10 transition-colors px-2 -mx-2 rounded-lg">
                    <div className="flex gap-4 items-center">
                      <span className="text-outline-variant font-mono text-[10px] font-bold">0{i+1}</span>
                      <div>
                        <p className="text-sm font-semibold text-on-surface leading-none">{n.label}</p>
                        <p className="text-[11px] text-on-surface-variant font-mono mt-1.5 tracking-wide">{n.desc}</p>
                      </div>
                    </div>
                    <div className="pr-2">
                       <Toggle defaultOn={n.on} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
