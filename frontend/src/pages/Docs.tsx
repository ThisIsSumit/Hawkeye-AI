import { Link } from 'react-router-dom';
import {
  Activity, ArrowRight, BookOpen, Check, ChevronRight, Copy,
  Database, KeyRound, LifeBuoy, Radar, Search, ShieldCheck,
} from 'lucide-react';
import { useState } from 'react';
import './Docs.css';

const ingestExample = `curl -X POST http://localhost:4000/api/ingest \\
  -H "Content-Type: application/json" \\
  -H "x-ingest-token: YOUR_INGEST_TOKEN" \\
  -d '{
    "source": "nginx",
    "ip": "185.234.219.47",
    "method": "POST",
    "path": "/api/users/login",
    "status": 403,
    "ua": "scanner/1.0",
    "message": "blocked UNION SELECT request"
  }'`;

const sections = [
  { id: 'quick-start', label: 'Quick start' },
  { id: 'send-events', label: 'Send events' },
  { id: 'read-dashboard', label: 'Read the dashboard' },
  { id: 'investigate', label: 'Investigate' },
  { id: 'settings', label: 'Settings & roles' },
  { id: 'troubleshooting', label: 'Troubleshooting' },
];

function CopyButton({ value }: Readonly<{ value: string }>) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <button type="button" className="docs-code__copy" onClick={copy}>
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function GuideStep({ number, title, children }: Readonly<{ number: string; title: string; children: React.ReactNode }>) {
  return (
    <div className="docs-step">
      <span className="docs-step__number">{number}</span>
      <div>
        <h3>{title}</h3>
        <div className="docs-step__body">{children}</div>
      </div>
    </div>
  );
}

export function Docs() {
  return (
    <main className="docs-page">
      <header className="docs-nav">
        <Link to="/" className="docs-brand" aria-label="HawkEye AI home">
          <span className="docs-brand__icon"><ShieldCheck size={17} /></span>
          <span>HawkEye <em>AI</em></span>
        </Link>
        <div className="docs-nav__actions">
          <Link to="/" className="docs-nav__home">Back to overview</Link>
          <Link to="/login" className="docs-nav__cta">Sign in <ArrowRight size={14} /></Link>
        </div>
      </header>

      <div className="docs-layout">
        <aside className="docs-sidebar">
          <p className="docs-sidebar__label"><BookOpen size={13} /> Operator guide</p>
          <nav aria-label="Documentation sections">
            {sections.map(section => (
              <a key={section.id} href={`#${section.id}`}><ChevronRight size={13} />{section.label}</a>
            ))}
          </nav>
          <div className="docs-sidebar__note">
            <span><LifeBuoy size={14} /> New to HawkEye?</span>
            <p>Start with Quick start, then send one sample event before connecting a real log source.</p>
          </div>
        </aside>

        <article className="docs-content">
          <section className="docs-hero">
            <p className="docs-eyebrow"><Activity size={13} /> Documentation / operator guide</p>
            <h1>From first signal<br /><span>to clear action.</span></h1>
            <p className="docs-hero__lede">
              A practical guide to using HawkEye AI. Connect your security events,
              watch the signal arrive, and move from an alert to an evidence-backed decision.
            </p>
            <div className="docs-hero__actions">
              <a href="#quick-start" className="docs-button">Start the guide <ArrowRight size={15} /></a>
              <Link to="/register" className="docs-text-link">Create a workspace <ArrowRight size={14} /></Link>
            </div>
          </section>

          <section id="quick-start" className="docs-section">
            <div className="docs-section__heading">
              <span>01 / First run</span>
              <h2>Quick start</h2>
              <p>Get a working view of your security data in a few minutes.</p>
            </div>
            <div className="docs-steps">
              <GuideStep number="01" title="Create an operator profile">
                <p>Choose <strong>Create a workspace</strong> above, or use the demo account on the sign-in screen.</p>
                <div className="docs-credentials"><span>Demo access</span><code>admin@hawkeye.ai</code><code>admin123</code></div>
              </GuideStep>
              <GuideStep number="02" title="Open the command center">
                <p>The dashboard is your live starting point. KPI cards summarize events, active threats, critical alerts, and blocked IPs.</p>
              </GuideStep>
              <GuideStep number="03" title="Send one test event">
                <p>Use the example in <a href="#send-events">Send events</a>. The event appears in the Threat Feed and, when its severity is high or critical, in Alerts.</p>
              </GuideStep>
            </div>
          </section>

          <section id="send-events" className="docs-section docs-section--split">
            <div className="docs-section__heading">
              <span>02 / Connect data</span>
              <h2>Send events</h2>
              <p>HawkEye accepts normalized JSON events from Nginx, WAFs, auth logs, firewalls, and custom services.</p>
            </div>
            <div className="docs-panel">
              <div className="docs-panel__head"><span><Database size={14} /> POST /api/ingest</span><span className="docs-live-dot">Token protected</span></div>
              <div className="docs-code">
                <CopyButton value={ingestExample} />
                <pre><code>{ingestExample}</code></pre>
              </div>
              <p className="docs-panel__hint">Replace <code>YOUR_INGEST_TOKEN</code> with the <code>INGEST_API_TOKEN</code> configured on your backend.</p>
            </div>
            <div className="docs-field-grid">
              {[
                ['ip', 'Required', 'Source IP of the event.'],
                ['source', 'Optional', 'nginx, auth, waf, firewall, or custom source.'],
                ['path', 'Optional', 'Targeted endpoint or request path.'],
                ['status', 'Optional', 'HTTP response status such as 401 or 403.'],
                ['message', 'Optional', 'Raw message or payload clue for classification.'],
                ['timestamp', 'Optional', 'ISO timestamp; current time is used by default.'],
              ].map(([name, requirement, description]) => (
                <div key={name} className="docs-field"><code>{name}</code><span>{requirement}</span><p>{description}</p></div>
              ))}
            </div>
            <p className="docs-callout"><Radar size={15} /><span><strong>What happens next?</strong> The parser classifies the event, stores it, broadcasts it to connected dashboards, indexes it for Log Intelligence, and queues AI analysis.</span></p>
          </section>

          <section id="read-dashboard" className="docs-section">
            <div className="docs-section__heading">
              <span>03 / Understand the surface</span>
              <h2>Read the dashboard</h2>
              <p>Use the workspace as a sequence: orient, prioritize, then inspect.</p>
            </div>
            <div className="docs-card-grid">
              {[
                [Activity, 'Command center', 'The KPI row is the current 24-hour picture. Change labels compare the current period with the previous 24 hours.'],
                [Radar, 'Threat Feed', 'Filter incoming threats by severity and attack type. Open an item when you need its full context.'],
                [Search, 'Event Stream', 'Watch new events arrive in real time. A live signal does not replace investigation; it tells you where to look next.'],
                [ShieldCheck, 'Alerts', 'High and critical events become triage items. Analyze an alert to create an AI-assisted investigation.'],
              ].map(([Icon, title, description]) => {
                const CardIcon = Icon as typeof Activity;
                return <div key={title as string} className="docs-card"><CardIcon size={18} /><h3>{title as string}</h3><p>{description as string}</p></div>;
              })}
            </div>
          </section>

          <section id="investigate" className="docs-section docs-section--dark">
            <div className="docs-section__heading">
              <span>04 / Move from signal to decision</span>
              <h2>Investigate an event</h2>
              <p>Use the evidence trail instead of guessing from a single alert.</p>
            </div>
            <div className="docs-investigation">
              <div className="docs-investigation__rail"><span>01</span><i /><span>02</span><i /><span>03</span><i /><span>04</span></div>
              <div className="docs-investigation__items">
                <div><strong>Open the threat</strong><p>Start from Threat Feed, Alerts, or the Dashboard recent alerts table.</p></div>
                <div><strong>Read the context</strong><p>Review source IP, endpoint, country, attack type, severity, timestamp, and request details.</p></div>
                <div><strong>Run analysis</strong><p>Analysts can request AI analysis for an explanation, mitigation steps, confidence, and a suggested firewall rule.</p></div>
                <div><strong>Take action</strong><p>Block a source IP or resolve the threat when your operating procedure supports it. The update is reflected across the workspace.</p></div>
              </div>
            </div>
          </section>

          <section id="settings" className="docs-section">
            <div className="docs-section__heading">
              <span>05 / Configure responsibly</span>
              <h2>Settings & roles</h2>
              <p>Access to sensitive operations is controlled by role.</p>
            </div>
            <div className="docs-role-table">
              <div><span>VIEWER</span><p>Read dashboard data, threats, alerts, and reports.</p></div>
              <div><span>ANALYST</span><p>Everything above, plus investigations, log intelligence, thresholds, and telemetry controls.</p></div>
              <div><span>ADMIN</span><p>Everything above, plus user roster and API token management.</p></div>
            </div>
            <p className="docs-callout"><KeyRound size={15} /><span>Keep ingest tokens and API tokens on the server side. Never place them in frontend code, browser storage, screenshots, or public repositories.</span></p>
          </section>

          <section id="troubleshooting" className="docs-section docs-section--last">
            <div className="docs-section__heading">
              <span>06 / When something is quiet</span>
              <h2>Troubleshooting</h2>
              <p>Use these checks before changing application settings.</p>
            </div>
            <div className="docs-faq">
              <details open><summary>My event returns 204 and nothing appears</summary><p>204 means the parser treated the payload as noise. Include a meaningful <code>message</code>, an attack clue in the path/body, or repeated authentication failures from the same IP.</p></details>
              <details><summary>I receive 401 from /api/ingest</summary><p>Check that the <code>x-ingest-token</code> exactly matches <code>INGEST_API_TOKEN</code> in the backend environment, then restart the backend.</p></details>
              <details><summary>The dashboard does not update live</summary><p>Confirm the backend is running, Redis/worker are available for analysis, and the browser is connected to the correct frontend API URL. Refreshing the page should still show persisted events.</p></details>
              <details><summary>AI analysis is queued but not completed</summary><p>Start the worker with <code>npm run worker</code>. Check Redis connectivity and the backend logs for queue or provider errors.</p></details>
            </div>
            <div className="docs-footer-cta">
              <div><p className="docs-eyebrow">Ready to read the signal?</p><h2>Open the workspace.</h2></div>
              <Link to="/login" className="docs-button">Sign in <ArrowRight size={15} /></Link>
            </div>
          </section>
        </article>
      </div>
    </main>
  );
}
