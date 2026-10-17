import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, Loader2, Shield } from 'lucide-react';
import { useAuth } from '../lib/AuthContext.tsx';
import './Auth.css';

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@hawkeye.ai');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
    <main className="auth-page">
      <div className="auth-page__glow auth-page__glow--one" aria-hidden="true" />
      <div className="auth-page__glow auth-page__glow--two" aria-hidden="true" />
      <div className="auth-shell">
        <Link to="/" className="auth-brand" aria-label="HawkEye AI home">
          <span className="auth-brand__icon"><Shield size={17} strokeWidth={2.2} /></span>
          <span>HawkEye <em>AI</em></span>
        </Link>
        <section className="auth-card">
          <p className="auth-kicker">Secure access / operator portal</p>
          <h1 className="auth-title">Welcome back.</h1>
          <p className="auth-subtitle">Continue to the workspace where security signals become decisions.</p>

          {error && <div className="auth-error"><AlertCircle size={15} /><span>{error}</span></div>}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="auth-field">
              <label className="auth-label" htmlFor="login-email">Email address</label>
              <input id="login-email" className="auth-input" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" placeholder="you@hawkeye.ai" />
            </div>
            <div className="auth-field">
              <label className="auth-label" htmlFor="login-password">Passphrase</label>
              <input id="login-password" className="auth-input" type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
            </div>
            <button type="submit" disabled={loading} className="auth-submit">
              {loading && <Loader2 size={15} className="animate-spin" />}
              {loading ? 'Authenticating...' : 'Access workspace'}
            </button>
          </form>

          <div className="auth-divider" />
          <div className="auth-demo">
            <p className="auth-demo__title">Simulation profiles</p>
            {[
              { email: 'admin@hawkeye.ai', pw: 'admin123', role: 'Admin' },
              { email: 'analyst@hawkeye.ai', pw: 'analyst123', role: 'Analyst' },
              { email: 'viewer@hawkeye.ai', pw: 'viewer123', role: 'Viewer' },
            ].map(profile => (
              <button key={profile.email} type="button" className="auth-demo__item" onClick={() => { setEmail(profile.email); setPassword(profile.pw); }}>
                <span>{profile.email}</span><span className="auth-demo__role">{profile.role}</span>
              </button>
            ))}
          </div>
          <p className="auth-footer">Need an account? <Link to="/register">Create an operator profile</Link></p>
        </section>
      </div>
    </main>
  );
}
