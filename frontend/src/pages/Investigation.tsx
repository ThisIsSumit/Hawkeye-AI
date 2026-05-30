import { useParams, useNavigate } from 'react-router-dom';
import { Sparkles, Ban, CheckCircle2, AlertTriangle, Loader2, Shield } from 'lucide-react';
import { useThreat, useBlockIp, useResolveThreat, useAnalyzeAlert, useAnalysis } from '../hooks/useSecurityData.js';
import { SeverityBadge, StatusBadge, Skeleton, EmptyState } from '../components/ui/Badge.js';

const FLAG: Record<string, string> = {
  RU:'🇷🇺', CN:'🇨🇳', BR:'🇧🇷', NL:'🇳🇱', UA:'🇺🇦',
  IN:'🇮🇳', US:'🇺🇸', DE:'🇩🇪', KR:'🇰🇷', FR:'🇫🇷',
};

const ICON_COLOR: Record<string, string> = {
  red:   'bg-error shadow-glow-error',
  amber: 'bg-tertiary shadow-glow',
  blue:  'bg-primary shadow-glow-primary',
  green: 'bg-secondary shadow-glow-secondary',
};

/** Build timeline events dynamically from real threat data */
function buildTimeline(threat: { attackType: string; sourceIp: string; endpoint: string; attempts: number; severity: string; userAgent: string; timestamp: string }) {
  const ts = new Date(threat.timestamp);
  const fmt = (offset: number) => {
    const d = new Date(ts.getTime() + offset * 1000);
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };
  return [
    { icon: 'red',   t: fmt(0), title: `${threat.attackType} payload detected`,     detail: `Malicious pattern matched targeting ${threat.endpoint}` },
    { icon: 'red',   t: fmt(0), title: `Attack origin identified`,                 detail: `Source: ${threat.sourceIp} — User-Agent: ${threat.userAgent.split('/')[0]}` },
    { icon: 'amber', t: fmt(1), title: `Rate limit threshold breached`,            detail: `${threat.attempts} requests — limit is 10/min per IP` },
    { icon: 'amber', t: fmt(2), title: `WAF rule matched & fired`,                 detail: `Block rule applied for ${threat.attackType} signatures` },
    { icon: 'blue',  t: fmt(4), title: `Alert automatically created`,              detail: `Severity: ${threat.severity.toUpperCase()} — assigned to analyst` },
    { icon: 'blue',  t: fmt(5), title: `IP flagged on watchlist`,                  detail: `Entry created for ${threat.sourceIp}` },
    { icon: threat.attempts > 100 ? 'red' : 'amber', t: fmt(7), title: `Secondary payload attempt`, detail: `Schema enumeration detected — blocked after ${threat.attempts} total attempts` },
  ];
}

export function Investigation() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate    = useNavigate();

  const { data: threat, isLoading, isError } = useThreat(id);
  const blockMutation   = useBlockIp();
  const resolveMutation = useResolveThreat();
  const analyzeMutation = useAnalyzeAlert();

  // Polling for AI analysis — starts automatically if threat exists
  const { data: analysis, isLoading: analysisLoading, isError: analysisNotReady } = useAnalysis(id, !!id);

  if (!id) {
    return (
      <EmptyState
        title="No subject specified"
        description="Select a threat signature from the Threat Feed to begin neural analysis."
      />
    );
  }

  if (isLoading) return <Skeleton className="h-[600px] rounded-xl glass-panel" />;

  if (isError || !threat) {
    return (
      <EmptyState
        title="Telemetry Sync Failed"
        description={`Signature ID "${id}" could not be retrieved from the intelligence databank.`}
      />
    );
  }

  const timelineEvents = buildTimeline(threat);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[10px] text-on-surface-variant font-mono uppercase tracking-widest">
        <button onClick={() => navigate('/threats')} className="text-primary hover:text-primary-container transition-colors">
          Threat Feed
        </button>
        <span className="text-outline-variant">/</span>
        <span>Investigation</span>
        <span className="text-outline-variant">/</span>
        <span className="font-mono text-on-surface bg-surface-lowest px-1.5 py-0.5 rounded border border-outline-variant/30">{threat.id}</span>
      </div>

      {/* Header banner */}
      <div className="glass-panel border-l-4 border-l-error rounded-xl p-6 flex items-start justify-between gap-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-error/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10">
          <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1 font-mono">
            Signature Match • {threat.id}
          </p>
          <h1 className="text-2xl font-bold font-display text-on-surface mb-1.5 tracking-tight">{threat.attackType} Protocol</h1>
          <p className="text-xs text-on-surface-variant/70 flex items-center gap-2 font-mono">
            <span className="text-error font-medium">{threat.sourceIp}</span>
            <span className="text-outline-variant">•</span>
            <span>{threat.endpoint}</span>
            <span className="text-outline-variant">•</span>
            <span>{new Date(threat.timestamp).toLocaleString()}</span>
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 relative z-10">
          <SeverityBadge severity={threat.severity} />
          <StatusBadge status={threat.status} />
        </div>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-4 gap-px bg-outline-variant/30 border border-outline-variant/30 rounded-xl overflow-hidden glass-panel">
        {[
          { label: 'Source IP',  value: threat.sourceIp,    cls: 'text-error font-mono' },
          { label: 'Origin',     value: `${FLAG[threat.countryCode] ?? ''} ${threat.country}`, cls: 'text-on-surface' },
          { label: 'Attempts',   value: threat.attempts.toLocaleString(), cls: 'text-error font-mono' },
          { label: 'Target Node',value: threat.endpoint,    cls: 'text-primary font-mono text-[11px]' },
        ].map(({ label, value, cls }) => (
          <div key={label} className="bg-surface-lowest/70 backdrop-blur-md px-5 py-4 hover:bg-surface-high/30 transition-colors">
            <p className="text-[9px] font-bold text-on-surface-variant uppercase tracking-widest mb-1.5">{label}</p>
            <p className={`text-[13px] font-medium truncate ${cls}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Split grid */}
      <div className="grid grid-cols-2 gap-6">

        {/* LEFT — Timeline + Payload */}
        <div className="space-y-6">
          <div className="glass-panel flex flex-col rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/20 bg-surface-lowest/40 backdrop-blur-sm">
              <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">Chronological Sequence</p>
              <span className="text-[10px] text-on-surface-variant font-mono bg-surface-lowest/50 px-2 py-0.5 rounded border border-outline-variant/30">{timelineEvents.length} cycles</span>
            </div>
            <ul className="relative py-2">
              <div className="absolute left-[34px] top-4 bottom-4 w-px bg-outline-variant/20" />
              {timelineEvents.map((e, i) => (
                <li key={i} className="flex gap-2 hover:bg-surface-high/20 transition-colors group">
                  <div className="w-[68px] flex justify-center pt-3.5 flex-shrink-0">
                    <div className={`w-[14px] h-[14px] rounded-full ${ICON_COLOR[e.icon]} relative z-10 flex-shrink-0 border-2 border-background ring-4 ring-background/50`} />
                  </div>
                  <div className="flex-1 py-3.5 pr-5 border-b border-outline-variant/10 group-last:border-0 relative">
                    <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-surface-lowest/0 to-transparent pointer-events-none" />
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <p className="text-xs font-semibold text-on-surface">{e.title}</p>
                      <span className="font-mono text-[10px] text-primary/70 flex-shrink-0">{e.t}</span>
                    </div>
                    <p className="text-[11px] text-on-surface-variant/80 font-mono leading-relaxed">{e.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="glass-panel flex flex-col rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/20 bg-surface-lowest/40 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">Raw Payload Hexdump</p>
                <span className="font-mono text-[9px] font-bold bg-error/10 text-error border border-error/30 px-1.5 py-0.5 rounded shadow-glow-error">
                  {threat.attackType.split(' ')[0].toUpperCase()}
                </span>
              </div>
            </div>
            <pre className="bg-surface-lowest/80 text-on-surface-variant/80 text-[10px] font-mono p-5 leading-loose overflow-x-auto relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl pointer-events-none" />
<span className="text-primary font-bold">POST</span> <span className="text-on-surface">{threat.endpoint}</span> <span className="text-outline-variant">HTTP/1.1</span>{'\n'}
<span className="text-outline-variant">Host:</span> <span className="text-on-surface">api.acme.com</span>{'\n'}
<span className="text-outline-variant">X-Forwarded-For:</span> <span className="text-error shadow-glow-error bg-error/10 px-1 rounded">{threat.sourceIp}</span>{'\n'}
<span className="text-outline-variant">User-Agent:</span> <span className="text-on-surface-variant">{threat.userAgent}</span>{'\n\n'}
{`{\n  `}<span className="text-secondary">"username"</span>{`: `}<span className="text-error">"admin' OR '1'='1' --"</span>{`,\n  `}
<span className="text-secondary">"password"</span>{`: `}<span className="text-on-surface-variant/50">"anything"</span>{`\n}`}
            </pre>
          </div>
        </div>

        {/* RIGHT — AI Analysis + Metadata */}
        <div className="space-y-6">
          <div className="glass-panel flex flex-col rounded-xl overflow-hidden border-primary/20 relative">
            <div className="absolute top-0 left-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
            
            {/* AI card header */}
            <div className="flex items-center justify-between px-5 py-4 bg-primary/10 border-b border-primary/20 relative z-10 backdrop-blur-md">
              <div className="flex items-center gap-2 text-primary text-[10px] font-bold uppercase tracking-widest shadow-glow">
                <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                HawkEye Neuromimetic Analysis
              </div>
              {analysis ? (
                <span className="font-mono text-[10px] text-primary/80 bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                  CONFIDENCE: {analysis.confidence}%
                </span>
              ) : analysisLoading ? (
                <span className="font-mono text-[10px] text-primary/60 bg-primary/10 px-2 py-0.5 rounded border border-primary/20 flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  ANALYZING…
                </span>
              ) : (
                <span className="font-mono text-[10px] text-on-surface-variant bg-surface-lowest px-2 py-0.5 rounded border border-outline-variant/30">
                  AWAITING ANALYSIS
                </span>
              )}
            </div>

            <div className="p-5 space-y-6 relative z-10">
              {/* Show loading state when analysis is being fetched */}
              {analysisLoading && !analysis && (
                <div className="flex flex-col items-center justify-center py-10 gap-4">
                  <div className="relative">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    <div className="absolute inset-0 w-8 h-8 rounded-full bg-primary/20 blur-lg animate-pulse" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-display text-on-surface font-semibold">Neural Analysis in Progress</p>
                    <p className="text-[11px] text-on-surface-variant font-mono mt-1">Threat signature being processed by AI engine…</p>
                  </div>
                </div>
              )}

              {/* Show prompt to start analysis when no data and not loading */}
              {!analysis && !analysisLoading && analysisNotReady && (
                <div className="flex flex-col items-center justify-center py-10 gap-4">
                  <Shield className="w-8 h-8 text-on-surface-variant/50" />
                  <div className="text-center">
                    <p className="text-sm font-display text-on-surface font-semibold">No Analysis Available</p>
                    <p className="text-[11px] text-on-surface-variant font-mono mt-1">Click "Analyze" below to initiate AI threat assessment</p>
                  </div>
                </div>
              )}

              {/* Real AI Analysis content */}
              {analysis && (
                <>
                  {/* Explanation */}
                  <div>
                    <p className="text-[9px] font-bold text-on-surface-variant uppercase tracking-widest mb-2 flex items-center gap-2">
                      <span className="w-1 h-3 bg-primary rounded-full inline-block shadow-glow" />
                      Vector Trajectory
                    </p>
                    <p className="text-xs text-on-surface-variant leading-relaxed">
                      {analysis.explanation}
                    </p>
                  </div>

                  {/* Severity reasoning */}
                  <div>
                    <p className="text-[9px] font-bold text-on-surface-variant uppercase tracking-widest mb-2 flex items-center gap-2">
                      <span className="w-1 h-3 bg-error rounded-full inline-block shadow-glow-error" />
                      Threat Assessment
                    </p>
                    <p className="text-xs text-on-surface-variant leading-relaxed">
                      {analysis.severityReasoning}
                    </p>
                  </div>

                  {/* Auto-resolved notice */}
                  {analysis.autoResolved && analysis.resolvedReason && (
                    <div className="bg-secondary/10 border border-secondary/30 rounded-lg px-4 py-3">
                      <p className="text-[9px] font-bold text-secondary uppercase tracking-widest mb-1 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3 h-3" />AUTO-RESOLVED
                      </p>
                      <p className="text-xs text-on-surface-variant font-mono">{analysis.resolvedReason}</p>
                    </div>
                  )}

                  {/* Mitigations */}
                  <div>
                    <p className="text-[9px] font-bold text-on-surface-variant uppercase tracking-widest mb-3 flex items-center gap-2">
                      <span className="w-1 h-3 bg-secondary rounded-full inline-block shadow-glow-secondary" />
                      Recommended Protocols
                    </p>
                    <ul className="space-y-2">
                      {analysis.mitigationSteps.map((step, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-xs text-on-surface-variant">
                          <span className="flex-shrink-0 w-4 h-4 rounded-full bg-secondary/10 border border-secondary/30 text-secondary text-[8px] font-bold flex items-center justify-center mt-0.5 font-mono shadow-glow-secondary">
                            0{i + 1}
                          </span>
                          {step}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Firewall rule */}
                  <div>
                    <p className="text-[9px] font-bold text-on-surface-variant uppercase tracking-widest mb-2 flex items-center gap-2">
                      <span className="w-1 h-3 bg-tertiary rounded-full inline-block shadow-glow" />
                      Mitigation Script
                    </p>
                    <pre className="bg-surface-lowest/80 border border-outline-variant/30 text-[10px] font-mono p-4 rounded-lg leading-loose text-on-surface-variant overflow-x-auto whitespace-pre-wrap">
                      {analysis.firewallRule}
                    </pre>
                  </div>
                </>
              )}
            </div>

            {/* Action bar */}
            <div className="flex items-center justify-between gap-2 flex-wrap px-5 py-4 border-t border-outline-variant/20 bg-surface-lowest/40 backdrop-blur-sm relative z-10">
              <button
                onClick={() => analyzeMutation.mutate(threat.id)}
                disabled={analyzeMutation.isPending}
                className="flex items-center justify-center gap-2 px-3 py-2 bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 hover:border-primary/50 text-[10px] font-bold font-mono tracking-widest uppercase rounded disabled:opacity-50 transition-colors shadow-glow"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {analyzeMutation.isPending ? 'Processing…' : analysis ? 'Re-analyze' : 'Analyze'}
              </button>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => blockMutation.mutate(threat.id)}
                  disabled={blockMutation.isPending || threat.status === 'blocked'}
                  className="flex items-center gap-2 px-3 py-2 bg-error/10 border border-error/30 text-error hover:bg-error/20 hover:border-error/50 text-[10px] font-bold font-mono tracking-widest uppercase rounded disabled:opacity-50 transition-colors shadow-glow-error"
                >
                  <Ban className="w-3.5 h-3.5" />
                  {blockMutation.isPending ? 'Blacklisting…' : 'Isolate IP'}
                </button>
                <button
                  onClick={() => resolveMutation.mutate(threat.id)}
                  disabled={resolveMutation.isPending || threat.status === 'resolved'}
                  className="flex items-center gap-2 px-3 py-2 bg-secondary/10 border border-secondary/30 text-secondary hover:bg-secondary/20 hover:border-secondary/50 text-[10px] font-bold font-mono tracking-widest uppercase rounded disabled:opacity-50 transition-colors shadow-glow-secondary"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {resolveMutation.isPending ? 'Closing…' : 'Mark Safe'}
                </button>
              </div>
            </div>

            {(blockMutation.isSuccess || resolveMutation.isSuccess || analyzeMutation.isSuccess) && (
              <div className="mx-5 mb-5 px-4 py-3 bg-secondary/10 border border-secondary/30 rounded text-[11px] font-mono text-secondary shadow-glow-secondary relative z-10">
                &gt; Sequence completed successfully. Output preserved.
              </div>
            )}
            {(blockMutation.isError || resolveMutation.isError) && (
              <div className="mx-5 mb-5 flex items-center gap-2 px-4 py-3 bg-error/10 border border-error/30 rounded text-[11px] font-mono text-error shadow-glow-error relative z-10">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 animate-pulse" />
                FATAL: Execution failed. Neural link severed.
              </div>
            )}
          </div>

          {/* Metadata */}
          <div className="glass-panel flex flex-col rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-outline-variant/20 bg-surface-lowest/40 backdrop-blur-sm">
              <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">Metadata Registry</p>
            </div>
            <div className="p-5 grid grid-cols-2 gap-3 relative">
              <div className="absolute inset-0 bg-gradient-ghost pointer-events-none opacity-20" />
              {[
                { label: 'Origin IP Allocation', value: threat.sourceIp,   cls:'text-error' },
                { label: 'Autonomous System',    value: threat.asn,        cls:'text-on-surface' },
                { label: 'Geographic Zone',      value: threat.country,    cls:'text-on-surface' },
                { label: 'Vector Profile',       value: threat.attackType, cls:'text-on-surface' },
                { label: 'Terminus Status',      value: threat.status === 'blocked' ? '403 Forbidden' : threat.status === 'resolved' ? 'Resolved' : 'Active', cls:'text-primary' },
                { label: 'WAF Interdict',        value: threat.status === 'blocked' ? 'Blocked' : 'Pending', cls: threat.status === 'blocked' ? 'text-secondary' : 'text-tertiary' },
              ].map(({ label, value, cls }) => (
                <div key={label} className="bg-surface-lowest/70 border border-outline-variant/30 rounded-lg p-3 relative z-10 hover:border-outline-variant transition-colors">
                  <p className="text-[9px] font-bold text-on-surface-variant uppercase tracking-widest mb-1.5">{label}</p>
                  <p className={`text-xs font-medium font-mono truncate ${cls}`}>{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
