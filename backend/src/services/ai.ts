import type { Threat } from '../types/index.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AIAnalysis {
  explanation:      string;
  severityReasoning: string;
  mitigationSteps:  string[];
  firewallRule:     string;
  autoResolved:     boolean;
  confidence:       number;
  resolvedReason?:  string;
}

// ─── OpenRouter API analysis ──────────────────────────────────────────────────

async function buildOpenRouterAnalysis(threat: Threat, apiKey: string, model: string): Promise<AIAnalysis> {
  const prompt = `You are HawkEye AI, a cybersecurity threat analysis engine.

Analyze this security threat and respond with ONLY valid JSON matching this exact schema:
{
  "explanation": "string — technical explanation of the attack vector",
  "severityReasoning": "string — why this severity rating is correct",
  "mitigationSteps": ["string", "string", "string", "string"],
  "firewallRule": "string — iptables/WAF rule to block this threat",
  "autoResolved": boolean,
  "confidence": number,
  "resolvedReason": "string or null"
}

Set autoResolved=true only if severity is low or medium AND the attack pattern is well-known.
Set confidence between 85-99.
Make sure you respond ONLY with JSON containing the required keys.

THREAT DATA:
${JSON.stringify(threat, null, 2)}`;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "user", content: prompt }
      ]
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenRouter API error: ${res.status} ${errText}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || '{}';

  // strip markdown fences if present
  const clean = text.replaceAll(/```json\n?/g, '').replaceAll(/```\n?/g, '').trim();
  return JSON.parse(clean) as AIAnalysis;
}

// ─── Local Analysis (Deterministic fallback when API is offline) ─────────────

function buildLocalAnalysis(threat: Threat): AIAnalysis {
  const autoResolved = threat.severity === 'low' || threat.severity === 'medium';
  const mitigationSteps = [
    `Apply WAF/block rule for source ${threat.sourceIp}.`,
    `Review endpoint hardening for ${threat.endpoint}.`,
    `Correlate additional events from ${threat.sourceIp} in SIEM.`,
    'Validate auth/rate-limit controls and alert thresholds.',
  ];

  return {
    explanation: `Observed ${threat.attackType} activity from ${threat.sourceIp} targeting ${threat.endpoint}. Event was parsed from live ingestion and queued for investigation.`,
    severityReasoning: `Severity ${threat.severity} is derived from attack signature type and request behavior (attempts=${threat.attempts}).`,
    mitigationSteps,
    firewallRule: `iptables -A INPUT -s ${threat.sourceIp} -j DROP`,
    autoResolved,
    confidence: 90,
    resolvedReason: autoResolved ? 'Auto-remediated by policy for low/medium severity.' : undefined,
  };
}

// ─── Service ─────────────────────────────────────────────────────────────────

class AIService {
  private get config() {
    return {
      apiKey: process.env.OPENROUTER_API_KEY || '',
      model:  process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-lite-preview-02-05:free',
    };
  }

  async analyzeThreat(threat: Threat): Promise<AIAnalysis> {
    const { apiKey, model } = this.config;
    
    if (!apiKey) {
      console.log(`[AI] No API key — using local deterministic analysis for ${threat.id} (${threat.attackType})`);
      return buildLocalAnalysis(threat);
    }
    
    return buildOpenRouterAnalysis(threat, apiKey, model);
  }

  get isLive(): boolean {
    return !!process.env.OPENROUTER_API_KEY;
  }
}

export const aiService = new AIService();
