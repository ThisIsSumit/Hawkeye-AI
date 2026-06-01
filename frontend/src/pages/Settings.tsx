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

interface ApiTokenRecord {
  id: string;
  name: string;
  valueMasked?: string;
  active: boolean;
  createdAt: string;
}

function roleBadgeClass(role: string): string {
  if (role === 'ADMIN') return 'bg-purple-500/10 text-purple-400 border border-purple-500/20';
  if (role === 'ANALYST') return 'bg-primary/10 text-primary border border-primary/20';
  return 'bg-surface-lowest border border-outline-variant/30 text-on-surface-variant';
}

function normalizeTokenList(data: unknown): ApiTokenRecord[] {
  if (Array.isArray(data)) return data as ApiTokenRecord[];
  if (data && typeof data === 'object' && 'tokens' in data) {
    const tokens = (data as { tokens?: unknown }).tokens;
    if (Array.isArray(tokens)) return tokens as ApiTokenRecord[];
  }
  return [];
}

function normalizeChannelList(data: unknown): Array<{ id: string; label: string; desc: string; enabled: boolean; config?: unknown }> {
  if (Array.isArray(data)) return data as Array<{ id: string; label: string; desc: string; enabled: boolean; config?: unknown }>;
  if (data && typeof data === 'object' && 'channels' in data) {
    const channels = (data as { channels?: unknown }).channels;
    if (Array.isArray(channels)) return channels as Array<{ id: string; label: string; desc: string; enabled: boolean; config?: unknown }>;
  }
  return [];
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
                  <span className={`text-[9px] font-bold font-mono px-2 py-0.5 rounded uppercase tracking-wider ${roleBadgeClass(u.role)}`}>{u.role}</span>
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

function Toggle({ defaultOn = false, onChange }: Readonly<{ defaultOn?: boolean; onChange?: (v: boolean) => void }>) {
  const [on, setOn] = useState(defaultOn);
  function toggle() {
    setOn(o => {
      const next = !o;
      if (onChange) onChange(next);
      return next;
    });
  }
  return (
    <button
      onClick={toggle}
      className={`w-9 h-5 rounded-full transition-colors flex-shrink-0 relative border ${on ? 'bg-primary border-primary shadow-glow' : 'bg-surface-lowest border-outline-variant/30'}`}
    >
      <span className={`absolute top-0.5 w-3.5 h-3.5 bg-background rounded-full shadow transition-transform ${on ? 'translate-x-4 border border-background/20' : 'translate-x-0.5 border border-outline-variant/50'}`} />
    </button>
  );
}

function RangeRow({ label, value, onChange }: Readonly<{ label: string; value: number; onChange: (v: number) => void }>) {
  return (
    <div className="flex items-center gap-4 py-2.5">
      <span className="text-[11px] font-bold font-mono tracking-widest uppercase text-on-surface-variant w-48 flex-shrink-0">{label}</span>
      <input type="range" min={0} max={100} value={value} onChange={e => onChange(+e.target.value)}
        className="flex-1 accent-primary bg-surface-lowest h-1.5 rounded-full appearance-none cursor-pointer" />
      <span className="font-mono text-[11px] font-bold text-primary w-10 text-right">{value}%</span>
    </div>
  );
}

export function Settings() {
  const { user } = useAuth();
  const [tab, setTab] = useState('thresholds');
  const [saved, setSaved] = useState(false);

  // Tokens state
  const [tokens, setTokens] = useState<ApiTokenRecord[]>([]);
  const [tokensLoading, setTokensLoading] = useState(false);
  const [tokensError, setTokensError] = useState('');
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [tokenName, setTokenName] = useState('');
  const [tokenEnv, setTokenEnv] = useState<'production'|'staging'>('production');
  const [creatingToken, setCreatingToken] = useState(false);
  const [createdTokenValue, setCreatedTokenValue] = useState<string | null>(null);
  const [createdCopied, setCreatedCopied] = useState(false);
  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<ApiTokenRecord | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [revokeError, setRevokeError] = useState('');

  // Thresholds state (keys match backend keys)
  const [thresholds, setThresholds] = useState<Record<string, number>>({
    sql_injection: 75,
    brute_force: 50,
    ddos: 85,
    anomaly_cutoff: 60,
    xss: 70,
  });
  const [thresholdsLoading, setThresholdsLoading] = useState(false);
  const [thresholdsError, setThresholdsError] = useState('');

  // Telemetry channels
  const [channels, setChannels] = useState<Array<{ id: string; label: string; desc: string; enabled: boolean; config?: unknown }>>([]);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [channelsError, setChannelsError] = useState('');

  function save() {
    // Commit thresholds to API
    setSaved(true);
    api.settings.thresholds.update(thresholds)
      .then(() => {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      })
      .catch(err => {
        setThresholdsError(err instanceof Error ? err.message : 'Failed to save thresholds');
        setSaved(false);
      });
  }

  // Load tokens when API tab selected
  useEffect(() => {
    if (tab !== 'api') return;
    let cancelled = false;
    setTokensLoading(true);
    setTokensError('');
    api.tokens.list()
      .then(data => {
        if (cancelled) return;
        setTokens(normalizeTokenList(data));
      })
      .catch(err => { if (!cancelled) setTokensError(err instanceof Error ? err.message : 'Failed to load tokens'); })
      .finally(() => { if (!cancelled) setTokensLoading(false); });
    return () => { cancelled = true; };
  }, [tab]);

  // Load thresholds when thresholds tab active
  useEffect(() => {
    if (tab !== 'thresholds') return;
    let cancelled = false;
    setThresholdsLoading(true);
    setThresholdsError('');
    api.settings.thresholds.get()
      .then(data => {
        if (!cancelled && data) setThresholds(prev => ({ ...prev, ...data }));
      })
      .catch(err => { if (!cancelled) setThresholdsError(err instanceof Error ? err.message : 'Failed to load thresholds'); })
      .finally(() => { if (!cancelled) setThresholdsLoading(false); });
    return () => { cancelled = true; };
  }, [tab]);

  // Load telemetry channels when notif tab active
  useEffect(() => {
    if (tab !== 'notif') return;
    let cancelled = false;
    setChannelsLoading(true);
    setChannelsError('');
    api.settings.telemetry.list()
      .then(data => {
        if (cancelled) return;
        setChannels(normalizeChannelList(data));
      })
      .catch(err => { if (!cancelled) setChannelsError(err instanceof Error ? err.message : 'Failed to load channels'); })
      .finally(() => { if (!cancelled) setChannelsLoading(false); });
    return () => { cancelled = true; };
  }, [tab]);

  function refreshTokens() {
    setTokensLoading(true);
    setTokensError('');
    return api.tokens.list()
      .then(data => {
        setTokens(normalizeTokenList(data));
      })
      .catch(err => setTokensError(err instanceof Error ? err.message : 'Failed to load tokens'))
      .finally(() => setTokensLoading(false));
  }

  function replaceChannelEnabled(channelId: string, enabled: boolean) {
    setChannels(prev => {
      const next = [...prev];
      for (let index = 0; index < next.length; index += 1) {
        if (next[index].id === channelId) {
          next[index] = { ...next[index], enabled };
          break;
        }
      }
      return next;
    });
  }

  function updateTelemetryChannel(channelId: string, enabled: boolean) {
    const previousEnabled = channels.find(channel => channel.id === channelId)?.enabled ?? false;
    replaceChannelEnabled(channelId, enabled);
    api.settings.telemetry.update(channelId, { enabled }).catch(err => {
      alert(err instanceof Error ? err.message : 'Failed to update channel');
      replaceChannelEnabled(channelId, previousEnabled);
    });
  }

  function handleForgeToken() {
    setTokenName('');
    setTokenEnv('production');
    setCreatedTokenValue(null);
    setCreatedCopied(false);
    setTokensError('');
    setShowTokenModal(true);
  }

  function handleRevokeToken(token: ApiTokenRecord) {
    setRevokeTarget(token);
    setRevokeError('');
    setShowRevokeModal(true);
  }

  function createToken() {
    if (!tokenName.trim()) {
      setTokensError('Token name is required');
      return;
    }
    setCreatingToken(true);
    setTokensError('');
    api.tokens.create({ name: tokenName.trim(), environment: tokenEnv })
      .then(res => {
        setCreatedTokenValue(res.token);
        setTokenName('');
        setTokenEnv('production');
        refreshTokens();
      })
      .catch(err => setTokensError(err instanceof Error ? err.message : 'Failed to create token'))
      .finally(() => setCreatingToken(false));
  }

  function confirmRevoke() {
    if (!revokeTarget) return;
    setRevoking(true);
    setRevokeError('');
    api.tokens.revoke(revokeTarget.id)
      .then(() => {
        setShowRevokeModal(false);
        setRevokeTarget(null);
        refreshTokens();
      })
      .catch(err => setRevokeError(err instanceof Error ? err.message : 'Failed to revoke token'))
      .finally(() => setRevoking(false));
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
                {tokensLoading && (
                  <div className="flex items-center justify-center py-12 gap-3 text-primary font-mono text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading tokens…
                  </div>
                )}

                {tokensError && (
                  <div className="bg-error/10 border border-error/30 rounded-lg px-4 py-3 text-[11px] font-mono text-error">
                    {tokensError}
                  </div>
                )}

                {!tokensLoading && !tokensError && tokens.map(t => (
                  <div key={t.id} className="flex items-center gap-4 py-4 border-b border-outline-variant/20 last:border-0 hover:bg-surface-high/10 transition-colors px-2 rounded-lg -mx-2">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-on-surface">{t.name}</p>
                      <p className="font-mono text-xs text-on-surface-variant mt-1 bg-surface-lowest inline-block px-2 py-0.5 rounded border border-outline-variant/30">{t.valueMasked ?? '••••••••'}</p>
                    </div>
                    <span className="text-[9px] font-bold font-mono bg-secondary/10 text-secondary px-2 py-0.5 rounded shadow-glow-secondary uppercase tracking-wider">{t.active ? 'Active' : 'Inactive'}</span>
                    <button type="button" onClick={() => handleRevokeToken(t)} className="text-[10px] font-bold font-mono text-error hover:text-red-400 px-3 py-1.5 uppercase tracking-widest opacity-70 hover:opacity-100 transition-opacity">Revoke</button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={handleForgeToken} className="mt-6 px-4 py-2.5 text-[11px] font-bold font-mono uppercase tracking-widest bg-primary text-background rounded peer hover:bg-primary-container transition-colors shadow-glow">
                Forge New Token
              </button>
              {/* Token creation modal */}
              {showTokenModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                  <div className="bg-background rounded-lg p-6 w-[520px] shadow-2xl border border-outline-variant/20">
                    <h3 className="font-semibold text-lg mb-1">Forge New API Token</h3>
                    <p className="text-[11px] font-mono uppercase tracking-wider text-on-surface-variant mb-4">The raw token is shown once after creation.</p>
                    {createdTokenValue ? (
                      <div className="relative">
                        <div className="absolute right-0 top-0">
                          <button type="button" onClick={() => {
                            setCreatedTokenValue(null);
                            setCreatedCopied(false);
                            setTokenName('');
                            setTokensError('');
                            setShowTokenModal(false);
                          }} aria-label="Close token" className="text-on-surface-variant hover:text-on-surface p-1">✕</button>
                        </div>
                        <div className="mt-2 p-3 bg-surface-lowest rounded border border-outline-variant/20">
                          <p className="font-mono text-xs text-on-surface-variant">Copy this token now — it will not be shown again:</p>
                          <div className="mt-2 flex items-center justify-between gap-3">
                            <div className="font-mono text-sm break-all max-w-[380px]">{createdTokenValue}</div>
                            <button type="button" onClick={() => {
                              navigator.clipboard?.writeText(createdTokenValue || '');
                              setCreatedCopied(true);
                              setTimeout(() => setCreatedCopied(false), 1500);
                            }} className="px-2 py-1 bg-primary text-background rounded">{createdCopied ? 'Copied' : 'Copy'}</button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <form onSubmit={e => { e.preventDefault(); createToken(); }}>
                        <label htmlFor="token-name-input" className="block text-sm font-mono text-on-surface-variant mb-1">Token name</label>
                        <input
                          id="token-name-input"
                          autoFocus
                          value={tokenName}
                          onChange={e => setTokenName(e.target.value)}
                          placeholder="Production Interface"
                          className="w-full p-3 rounded-lg border border-outline-variant/20 mb-4 bg-surface-lowest text-on-surface placeholder:text-on-surface-variant/50 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                        />
                        <label htmlFor="token-env-input" className="block text-sm font-mono text-on-surface-variant mb-1">Environment</label>
                        <select
                          id="token-env-input"
                          value={tokenEnv}
                          onChange={e => setTokenEnv(e.target.value as 'production' | 'staging')}
                          className="w-full p-3 rounded-lg border border-outline-variant/20 mb-4 bg-surface-lowest text-on-surface outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                        >
                          <option value="production">Production</option>
                          <option value="staging">Staging</option>
                        </select>
                        <div className="flex gap-2 justify-end">
                          <button type="button" onClick={() => setShowTokenModal(false)} className="px-4 py-2 rounded border border-outline-variant/30 text-on-surface-variant hover:text-on-surface hover:border-outline-variant/50">Cancel</button>
                          <button type="submit" disabled={creatingToken || !tokenName.trim()} className="px-4 py-2 rounded bg-primary text-background disabled:opacity-60 disabled:cursor-not-allowed">{creatingToken ? 'Creating…' : 'Create Token'}</button>
                        </div>
                      </form>
                    )}
                    {tokensError && <div className="mt-3 text-error font-mono text-sm">{tokensError}</div>}
                  </div>
                </div>
              )}

              {/* Revoke confirmation modal */}
              {showRevokeModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                  <div className="bg-background rounded-lg p-6 w-[420px] shadow-2xl border border-outline-variant/20">
                    <h3 className="font-semibold text-lg mb-3">Revoke Token</h3>
                    <p className="text-sm text-on-surface-variant mb-2">Revoking will immediately invalidate this token.</p>
                    <div className="mb-4 rounded border border-outline-variant/20 bg-surface-lowest px-3 py-2">
                      <p className="text-xs font-mono uppercase tracking-wider text-on-surface-variant">Selected token</p>
                      <p className="text-sm font-semibold text-on-surface mt-1">{revokeTarget?.name ?? 'Unknown token'}</p>
                    </div>
                    {revokeError && <div className="mb-3 text-error font-mono text-sm">{revokeError}</div>}
                    <div className="flex gap-2 justify-end">
                      <button type="button" onClick={() => { setShowRevokeModal(false); setRevokeTarget(null); }} disabled={revoking} className="px-4 py-2 rounded border border-outline-variant/30 text-on-surface-variant hover:text-on-surface hover:border-outline-variant/50">Cancel</button>
                      <button type="button" onClick={confirmRevoke} disabled={revoking} className="px-4 py-2 rounded bg-error text-background disabled:opacity-60">{revoking ? 'Revoking…' : 'Revoke Token'}</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Thresholds */}
          {tab === 'thresholds' && (
            <div className="p-6">
              <h2 className="font-display font-semibold text-on-surface mb-1">Detection Thresholds</h2>
              <p className="text-on-surface-variant text-[11px] font-mono tracking-wide uppercase mb-6">Sensor calibration metrics</p>
              {thresholdsLoading && (
                <div className="flex items-center justify-center py-12 gap-3 text-primary font-mono text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading thresholds…
                </div>
              )}
              {thresholdsError && (
                <div className="bg-error/10 border border-error/30 rounded-lg px-4 py-3 text-[11px] font-mono text-error">
                  {thresholdsError}
                </div>
              )}
              {!thresholdsLoading && !thresholdsError && (
                <div className="space-y-1">
                  {[
                    { key: 'sql_injection', label: 'SQL Injection Sensitivity' },
                    { key: 'brute_force',    label: 'Brute Force Threshold' },
                    { key: 'ddos',           label: 'DDoS Detection' },
                    { key: 'anomaly_cutoff', label: 'Anomaly Score Cutoff' },
                    { key: 'xss',            label: 'XSS Detection' },
                  ].map(item => (
                    <RangeRow key={item.key} label={item.label} value={thresholds[item.key] ?? 0} onChange={v => setThresholds(prev => ({ ...prev, [item.key]: v }))} />
                  ))}
                </div>
              )}
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
                {channelsLoading && (
                  <div className="flex items-center justify-center py-12 gap-3 text-primary font-mono text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading channels…
                  </div>
                )}
                {channelsError && (
                  <div className="bg-error/10 border border-error/30 rounded-lg px-4 py-3 text-[11px] font-mono text-error">
                    {channelsError}
                  </div>
                )}
                {!channelsLoading && !channelsError && channels.map((n, i) => (
                  <div key={n.id} className="flex items-center justify-between py-4 hover:bg-surface-high/10 transition-colors px-2 -mx-2 rounded-lg">
                    <div className="flex gap-4 items-center">
                      <span className="text-outline-variant font-mono text-[10px] font-bold">0{i+1}</span>
                      <div>
                        <p className="text-sm font-semibold text-on-surface leading-none">{n.label}</p>
                        <p className="text-[11px] text-on-surface-variant font-mono mt-1.5 tracking-wide">{n.desc}</p>
                      </div>
                    </div>
                    <div className="pr-2">
                       <Toggle defaultOn={n.enabled} onChange={(v) => updateTelemetryChannel(n.id, v)} />
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
