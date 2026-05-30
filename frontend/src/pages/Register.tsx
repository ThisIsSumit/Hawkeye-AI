import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, AlertCircle, Loader2, UserPlus } from 'lucide-react';
import { useAuth } from '../lib/AuthContext.tsx';

export function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await register(name.trim(), email.trim(), password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/5 rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="w-full max-w-sm relative z-10">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary-container rounded-xl flex items-center justify-center shadow-glow">
            <Shield className="w-5 h-5 text-surface-lowest" />
          </div>
          <div>
            <p className="text-on-surface font-display font-bold text-lg tracking-tight">HawkEye AI</p>
            <p className="text-primary text-[10px] font-mono tracking-widest uppercase">Threat Intelligence</p>
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-7 relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

          <h1 className="text-on-surface font-display font-semibold text-xl mb-1">Create Account</h1>
          <p className="text-on-surface-variant/70 font-mono text-xs uppercase tracking-wider mb-6">Register a new operator profile</p>

          {error && (
            <div className="flex items-center gap-2 bg-error/10 border border-error/30 rounded-lg px-3 py-2.5 mb-4 shadow-glow-error">
              <AlertCircle className="w-4 h-4 text-error flex-shrink-0" />
              <p className="text-error text-sm font-mono">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-on-surface-variant text-[10px] font-bold font-mono uppercase tracking-widest block mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
                autoComplete="name"
                className="w-full bg-surface-lowest/50 border border-outline-variant/30 rounded-lg px-3 py-2.5 text-on-surface font-mono text-sm outline-none focus:border-primary/50 transition-colors focus:shadow-glow"
                placeholder="Test User"
              />
            </div>

            <div>
              <label className="text-on-surface-variant text-[10px] font-bold font-mono uppercase tracking-widest block mb-1.5">
                Identity Sequence (Email)
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full bg-surface-lowest/50 border border-outline-variant/30 rounded-lg px-3 py-2.5 text-on-surface font-mono text-sm outline-none focus:border-primary/50 transition-colors placeholder-on-surface-variant/30 focus:shadow-glow"
                placeholder="newuser@example.com"
              />
            </div>

            <div>
              <label className="text-on-surface-variant text-[10px] font-bold font-mono uppercase tracking-widest block mb-1.5">
                Passphrase
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                className="w-full bg-surface-lowest/50 border border-outline-variant/30 rounded-lg px-3 py-2.5 text-on-surface font-mono text-sm outline-none focus:border-primary/50 transition-colors focus:shadow-glow"
                placeholder="Passw0rd!"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary-container disabled:opacity-60 text-background font-bold font-mono uppercase tracking-widest rounded-lg py-2.5 text-xs transition-colors flex items-center justify-center gap-2 mt-4 shadow-glow"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              {loading ? 'Registering...' : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-outline-variant/20 text-center">
            <p className="text-on-surface-variant text-xs font-mono">
              Already have an account?{' '}
              <Link to="/login" className="text-primary hover:text-primary-container font-semibold uppercase tracking-wider">
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
