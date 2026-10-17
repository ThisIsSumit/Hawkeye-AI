import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, Loader2, Shield, UserPlus } from 'lucide-react';
import { useAuth } from '../lib/AuthContext.tsx';
import './Auth.css';

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
    <main className="auth-page">
      <div className="auth-page__glow auth-page__glow--one" aria-hidden="true" />
      <div className="auth-page__glow auth-page__glow--two" aria-hidden="true" />
      <div className="auth-shell">
        <Link to="/" className="auth-brand" aria-label="HawkEye AI home">
          <span className="auth-brand__icon"><Shield size={17} strokeWidth={2.2} /></span>
          <span>HawkEye <em>AI</em></span>
        </Link>
        <section className="auth-card">
          <p className="auth-kicker">Workspace access / new operator</p>
          <h1 className="auth-title">Join the signal.</h1>
          <p className="auth-subtitle">Create your operator profile and start turning security events into clarity.</p>

          {error && <div className="auth-error"><AlertCircle size={15} /><span>{error}</span></div>}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="auth-field">
              <label className="auth-label" htmlFor="register-name">Full name</label>
              <input id="register-name" className="auth-input" type="text" value={name} onChange={e => setName(e.target.value)} required minLength={2} autoComplete="name" placeholder="Test User" />
            </div>
            <div className="auth-field">
              <label className="auth-label" htmlFor="register-email">Email address</label>
              <input id="register-email" className="auth-input" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" placeholder="newuser@example.com" />
            </div>
            <div className="auth-field">
              <label className="auth-label" htmlFor="register-password">Passphrase</label>
              <input id="register-password" className="auth-input" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} autoComplete="new-password" placeholder="Passw0rd!" />
            </div>
            <button type="submit" disabled={loading} className="auth-submit">
              {loading ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}
              {loading ? 'Creating profile...' : 'Create operator profile'}
            </button>
          </form>

          <div className="auth-divider" />
          <p className="auth-footer">Already have access? <Link to="/login">Sign in to workspace</Link></p>
        </section>
      </div>
    </main>
  );
}
