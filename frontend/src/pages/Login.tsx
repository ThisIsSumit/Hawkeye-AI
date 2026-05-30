import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../lib/AuthContext.tsx';

export function Login() {
  const { login }   = useAuth();
  const navigate    = useNavigate();

  const [email,    setEmail]    = useState('admin@hawkeye.ai');
  const [password, setPassword] = useState('admin123');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/5 rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="w-full max-w-sm relative z-10">

        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary-container rounded-xl flex items-center justify-center shadow-glow">
            <Shield className="w-5 h-5 text-surface-lowest" />
          </div>
          <div>
            <p className="text-on-surface font-display font-bold text-lg tracking-tight">HawkEye AI</p>
            <p className="text-primary text-[10px] font-mono tracking-widest uppercase">Threat Intelligence</p>
          </div>
        </div>

        {/* Card */}
        <div className="glass-panel rounded-2xl p-7 relative overflow-hidden">
          {/* Subtle top edge highlight */}
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
          
          <h1 className="text-on-surface font-display font-semibold text-xl mb-1">Authorization</h1>
          <p className="text-on-surface-variant/70 font-mono text-xs uppercase tracking-wider mb-6">Enter protocol credentials</p>

          {error && (
            <div className="flex items-center gap-2 bg-error/10 border border-error/30 rounded-lg px-3 py-2.5 mb-4 shadow-glow-error">
              <AlertCircle className="w-4 h-4 text-error flex-shrink-0" />
              <p className="text-error text-sm font-mono">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-on-surface-variant text-[10px] font-bold font-mono uppercase tracking-widest block mb-1.5">
                Identity Sequence (Email)
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full bg-surface-lowest/50 border border-outline-variant/30 rounded-lg px-3 py-2.5 text-on-surface font-mono text-sm outline-none focus:border-primary/50 transition-colors placeholder-on-surface-variant/30 focus:shadow-glow"
                placeholder="you@hawkeye.ai"
              />
            </div>
            <div>
              <label className="text-on-surface-variant text-[10px] font-bold font-mono uppercase tracking-widest block mb-1.5">
                Passphrase
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full bg-surface-lowest/50 border border-outline-variant/30 rounded-lg px-3 py-2.5 text-on-surface font-mono text-sm outline-none focus:border-primary/50 transition-colors focus:shadow-glow"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary-container disabled:opacity-60 text-background font-bold font-mono uppercase tracking-widest rounded-lg py-2.5 text-xs transition-colors flex items-center justify-center gap-2 mt-4 shadow-glow"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Authenticating…' : 'Access System'}
            </button>
          </form>

          {/* Demo credentials */}
          <div className="mt-6 pt-5 border-t border-outline-variant/20">
            <p className="text-on-surface-variant/50 text-[10px] font-bold font-mono uppercase tracking-[0.2em] mb-3">Simulation Profiles</p>
            <div className="space-y-2">
              {[
                { email: 'admin@hawkeye.ai',   pw: 'admin123',   role: 'Admin',   badge: 'bg-purple-500/20 text-purple-400 border border-purple-500/30' },
                { email: 'analyst@hawkeye.ai', pw: 'analyst123', role: 'Analyst', badge: 'bg-primary/20 text-primary border border-primary/30' },
                { email: 'viewer@hawkeye.ai',  pw: 'viewer123',  role: 'Viewer',  badge: 'bg-surface-highest/50 text-on-surface-variant border border-outline-variant/30' },
              ].map(({ email: e, pw, role, badge }) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => { setEmail(e); setPassword(pw); }}
                  className="w-full flex items-center justify-between px-3 py-2 bg-surface-lowest/30 border border-transparent hover:border-outline-variant/20 hover:bg-surface-high/30 rounded-lg transition-colors group"
                >
                  <span className="text-on-surface-variant text-xs font-mono group-hover:text-primary transition-colors">{e}</span>
                  <span className={`text-[9px] font-bold font-mono px-1.5 py-0.5 rounded ${badge}`}>{role}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 text-center">
            <p className="text-on-surface-variant text-xs font-mono">
              Need an account?{' '}
              <Link to="/register" className="text-primary hover:text-primary-container font-semibold uppercase tracking-wider">
                Register
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
