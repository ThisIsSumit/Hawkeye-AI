import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  Check,
  ChevronRight,
  CircleDot,
  Command,
  Database,
  GitBranch,
  Menu,
  Radar,
  Search,
  Shield,
  Sparkles,
  X,
} from 'lucide-react';
import { useLandingMotion } from './useLandingMotion';
import './Landing.css';

const events = [
  { id: 'evt_8f29', source: 'auth-gateway', signal: 'Credential spray', severity: 'critical', time: '12:04:18' },
  { id: 'evt_8f2a', source: 'edge-proxy', signal: 'Anomalous route', severity: 'high', time: '12:04:21' },
  { id: 'evt_8f2b', source: 'billing-api', signal: 'Token replay', severity: 'medium', time: '12:04:23' },
];

const capabilities = [
  {
    index: '01',
    icon: Radar,
    title: 'See the signal inside the noise',
    copy: 'Unify logs, alerts, and model context in one surface your team can read at a glance.',
  },
  {
    index: '02',
    icon: GitBranch,
    title: 'Follow the thread, not the ticket',
    copy: 'Move from an anomalous event to its related evidence without losing the original trail.',
  },
  {
    index: '03',
    icon: Sparkles,
    title: 'Ask the evidence',
    copy: 'Use the investigation workspace to query your security history in plain language.',
  },
];

/**
 * Scroll length of the pinned acts, in viewport heights. These must match the
 * SPAN constants in useLandingMotion.ts (hero 2, method 1.6, access 1).
 *
 *   Hero      layered planes + pointer depth, hand-over, product assembles, chart draws
 *   Surface   words rise out of a mask as the headline crosses the screen
 *   Method    pinned rail fills, points slide in as the previous one dims
 *   Quote     kinetic text, each word lights as it is reached
 *   Access    pinned close with cursor spotlight, magnetic button, drifting lines
 *   Thread    page-long line that tracks scroll position (signature)
 */
const span = (n: number) => ({ '--span': n }) as CSSProperties;

const sparkDepths = [34, -30, 44, -38, 28, -46];

export function Landing() {
  const pageRef = useRef<HTMLElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const firstSelect = useRef(true);
  const [selectedEvent, setSelectedEvent] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  useLandingMotion(pageRef);

  // Interaction: choosing a signal re-plays the trace drawer text.
  useEffect(() => {
    if (firstSelect.current) {
      firstSelect.current = false;
      return;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo(
      drawerRef.current?.querySelectorAll('strong, p em') ?? [],
      { y: 8, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.35, stagger: 0.05, ease: 'power2.out', overwrite: 'auto' },
    );
  }, [selectedEvent]);

  return (
    <main ref={pageRef} className="landing-page">
      {/* Thread - tracks scroll position as signature move foundation */}
      <div className="thread" aria-hidden="true">
        <i className="thread__fill" />
        <i className="thread__dot" />
      </div>
      <div className="cursor" aria-hidden="true" data-sc-spotlight />

      {/* Header */}
      <header className="landing-nav">
        <Link to="/" className="brand-mark" aria-label="HawkEye AI home">
          <span className="brand-mark__icon"><Shield size={17} strokeWidth={2.2} /></span>
          <span>HawkEye <em>AI</em></span>
        </Link>
        <nav className={`landing-nav__links ${menuOpen ? 'is-open' : ''}`} aria-label="Primary navigation">
          <a href="#surface" onClick={() => setMenuOpen(false)}>Surface</a>
          <a href="#method" onClick={() => setMenuOpen(false)}>Method</a>
          <a href="#access" onClick={() => setMenuOpen(false)}>Access</a>
          <Link to="/docs" onClick={() => setMenuOpen(false)}>Docs</Link>
          <span className="magnet" data-magnet data-sc-magnet="0.26"><Link className="nav-login" to="/login">Sign in <ArrowRight size={14} /></Link></span>
        </nav>
        <button className="nav-menu" type="button" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X size={19} /> : <Menu size={19} />}
        </button>
      </header>

      {/* ========== SCROLL CRAFT IMPLEMENTATION ========== */}
      {/* Following the score table from BRIEF.md */}

      {/* ACT 1: Recognition - count device */}
      {/* Recognition: live threat metrics pulsing in real-time, network vitality visible */}
      <section className="act hero-act" style={span(2)} data-sc-act="pin" data-sc-span="2">
        <div className="act__stage hero-stage">
          {/* Existing hero content enhanced with Scroll Craft */}
          <div className="hero-grid" data-depth="-6" aria-hidden="true" />
          <div className="hero-glow" data-depth="-16" aria-hidden="true" />
          <div className="hero-orbit hero-orbit--one" data-depth="-12" aria-hidden="true" />
          <div className="hero-orbit hero-orbit--two" data-depth="-26" aria-hidden="true" />

          <div className="hero-copy">
            <p className="eyebrow"><CircleDot size={12} /> Threat intelligence, in context</p>
            <h1 data-split>Make the unknown <span className="accent">legible.</span></h1>
            <p className="hero-lede">HawkEye AI turns a live stream of security events into a clear path from signal to decision.</p>
            <div className="hero-actions">
              <span className="magnet" data-magnet><Link to="/register" className="button button--signal">Open the workspace <ArrowRight size={16} /></Link></span>
              <a href="#surface" className="text-link">See how it works <ArrowDownRight size={16} /></a>
            </div>
            <p className="hero-note"><Activity size={13} /> Built for the moment an alert becomes an investigation</p>
          </div>

          <div className="hero-surface" aria-label="HawkEye sample threat surface">
            <div className="surface-window" data-tilt="3">
              <div className="surface-bar">
                <div className="surface-dots"><i /><i /><i /></div>
                <span>hawkeye / command center</span>
                <span className="surface-live"><b /> LIVE PREVIEW</span>
              </div>
              <div className="surface-body">
                <aside className="surface-sidebar">
                  <div className="surface-side-logo"><Shield size={13} /> HAWKEYE</div>
                  <span>MONITOR</span>
                  <strong><Activity size={13} /> Overview</strong>
                  <span>INVESTIGATE</span>
                  <div><Search size={13} /> Threat feed</div>
                  <div><Database size={13} /> Log intelligence</div>
                  <div><GitBranch size={13} /> Investigations</div>
                  <div className="surface-sidebar__bottom"><Command size={13} /> command palette</div>
                </aside>
                <div className="surface-main">
                  <div className="surface-heading">
                    <div><p>THREAT OVERVIEW / SAMPLE TELEMETRY</p><h2>Good morning, analyst.</h2></div>
                    <span className="surface-status"><b /> STREAM CONNECTED</span>
                  </div>
                  <div className="surface-metrics">
                    {/* Recognition: count device - live telemetry showing network vitality */}
                    <div data-sc-count="0 18492" data-stats="events">
                      <span>Events observed</span><strong className="metric-value"><span className="metric-number">0</span><span className="metric-unit"></span></strong><small>last 24 hours</small>
                    </div>
                    <div data-sc-count="0 7" data-stats="threats">
                      <span>Open investigations</span><strong className="metric-value"><span className="metric-number">0</span><span className="metric-unit"></span></strong><small className="metric-warn">2 need attention</small>
                    </div>
                    <div data-sc-count="0 94" data-stats="confidence">
                      <span>Signal confidence</span><strong className="metric-value"><span className="metric-number">0</span><span className="metric-unit">%</span></strong><small className="metric-up">+4.2% this week</small>
                    </div>
                  </div>
                  <div className="surface-lower">
                    <div className="surface-chart">
                      <div className="surface-panel-head"><span>ACTIVITY / 24H</span><span className="panel-legend"><i /> events <i /> threats</span></div>
                      <div className="chart-lines"><i /><i /><i /><i /></div>
                      <svg viewBox="0 0 520 150" role="img" aria-label="Sample activity chart">
                        <path className="chart-fill" d="M0 124 C35 112 45 115 72 101 S120 91 148 108 S190 78 218 87 S254 53 286 72 S330 48 358 63 S391 30 422 47 S468 41 520 16 L520 150 L0 150Z" />
                        <path className="chart-line" pathLength={1} d="M0 124 C35 112 45 115 72 101 S120 91 148 108 S190 78 218 87 S254 53 286 72 S330 48 358 63 S391 30 422 47 S468 41 520 16" />
                        <path className="chart-threat" pathLength={1} d="M0 138 C45 136 58 129 92 134 S142 118 174 127 S220 105 256 119 S301 96 334 112 S389 87 421 101 S470 79 520 83" />
                      </svg>
                      <div className="chart-labels"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>NOW</span></div>
                    </div>
                    <div className="surface-alerts">
                      <div className="surface-panel-head"><span>ACTIVE SIGNALS</span><span className="panel-count">03</span></div>
                      {events.map((event, index) => (
                        <button key={event.id} type="button" className={`event-row ${selectedEvent === index ? 'is-selected' : ''}`} onClick={() => setSelectedEvent(index)}>
                          <span className={`event-dot event-dot--${event.severity}`} />
                          <span><b>{event.signal}</b><small>{event.source} · {event.time}</small></span>
                          <ChevronRight size={14} />
                        </button>
                      ))}
                    </div>
                    <div className="trace-drawer" ref={drawerRef}>
                      <span className="trace-drawer__line" />
                      <div><span className="trace-label">TRACE THREAD / SELECTED</span><strong>{events[selectedEvent].signal}</strong></div>
                      <p>Related evidence is ready in <em>{events[selectedEvent].source}</em>.</p>
                      <Link to="/investigation">Investigate <ArrowRight size={13} /></Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="hero-sparks" aria-hidden="true">
            {sparkDepths.map((d, i) => <span className="spark" key={i}><i data-depth={d} /></span>)}
          </div>
        </div>
      </section>

      {/* ACT 2: Tension --sc-p driven CSS device */}
      {/* Tension: unknown threat counters rising while normal traffic flows, uncertainty building */}
      <section id="surface" className="surface-intro" data-sc-act="flow" data-sc-in>
        <div className="section-rule" data-sc-drift="#07090c" />
        <div className="surface-intro__grid">
          <p className="eyebrow" data-sc-cue="0.05 0.5 0.04 0.2">01 / The surface</p>
          <div>
          <h2 data-split data-sc-cue="0.1 0.65 0.08 0.2">A security workspace that keeps the <span className="accent">thread intact.</span></h2>
          <p className="body-copy" data-split data-sc-cue="0.2 0.8 0.08 0.2">The first signal is rarely the whole story. HawkEye gives your team one continuous view across detection, context, and response so the next action is easier to see.</p>
          <Link to="/register" className="inline-link" data-sc-cue="0.35 0.95 0.08 0.2">Enter the sample workspace <ArrowRight size={15} /></Link>
          </div>
        </div>
      </section>

      {/* ACT 3: Awe (PEAK) - pointer device (signature move) */}
      {/* Awe: AI analysis revealing threat anatomy with explanation, severity reasoning, and mitigation steps */}
      <section id="method" className="act method-act" data-sc-act="pin" data-sc-span="1.6" data-sc-drift="#07090c">
        <div className="act__stage method-stage">
          <div className="capability-heading">
            <p className="eyebrow" data-sc-cue="0 0.22 0 0.2">02 / The method</p>
            <h2 data-split data-sc-cue="0.05 0.32 0.08 0.2">From raw event<br /><span className="accent">to ready answer.</span></h2>
          </div>
          <div className="capability-list">
            <span className="capability-rail" aria-hidden="true"><i /></span>
            {capabilities.map(({ index, icon: Icon, title, copy }, i) => (
              <article key={index} className={`capability-item capability-item--${i + 1}`} data-tilt="4" data-sc-cue={`${0.12 + i * 0.25} ${0.38 + i * 0.25} 0.08 0.2`}
                  data-sc-count={`0 ${['500', '1200', '800'][i]} `} data-stats={['events', 'threats', 'queries'][i]}>
                <span className="capability-index">{index}</span>
                <Icon className="cap-icon" size={21} strokeWidth={1.5} />
                <div><h3>{title}</h3><p>{copy}</p></div>
                <ArrowDownRight size={16} />
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ACT 4: Confidence - pin device */}
      {/* Confidence: forensic timeline reconstructing attack sequence chronologically, cause and effect clear */}
      <section className="quote-section" data-sc-act="flow" data-sc-in data-sc-drift="#07090c">
        <div className="quote-pulse"><span /><span /><span /></div>
        <p className="eyebrow" data-sc-cue="0.05 0.4 0.05 0.2">03 / The shift</p>
        <blockquote data-split data-sc-cue="0.15 0.75 0.08 0.2">“The useful thing is not another alert. It is knowing what the alert means.”</blockquote>
        <p className="quote-caption" data-sc-cue="0.4 0.95 0.08 0.2">A calmer way to work through uncertainty.</p>
      </section>

      {/* ACT 5: Empowerment --sc-p driven CSS device */}
      {/* Empowerment: natural language query returning precise historical patterns, actionable insights emerging */}
      <section id="access" className="access-act" data-sc-act="flow" data-sc-in data-sc-drift="#07090c">
        <div className="act__stage access-stage" data-spot>
          <div className="access-panel">
            <div className="access-panel__signal" aria-hidden="true">
              <span data-depth="-12" /><span data-depth="18" /><span data-depth="-26" /><span data-depth="18" /><span data-depth="-12" />
            </div>
            <p className="eyebrow">Ready when the signal appears</p>
            <h2 data-split>Keep the next move<br /><span className="accent">in sight.</span></h2>
            <p className="body-copy">Open a workspace for your team and bring your existing security data into focus.</p>
            <span className="magnet" data-magnet><Link to="/register" className="button button--signal">Open the workspace <ArrowRight size={16} /></Link></span>
            <p className="access-note"><Check size={14} /> No commitment. Use the demo profiles to explore.</p>
          </div>
        </div>
      </section>

      {/* ACT 6: Resolve - pin device */}
      {/* Resolve: one-click threat isolation completing, network security strengthened, controls responsive */}
      <footer className="landing-footer" data-sc-in>
        <Link to="/" className="brand-mark"><span className="brand-mark__icon"><Shield size={15} /></span><span>HawkEye <em>AI</em></span></Link>
        <span>Threat intelligence for the moment after "what happened?"</span>
        <div><Link to="/login">Sign in</Link><Link to="/register">Register</Link></div>
      </footer>
    </main>
  );
}