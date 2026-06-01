import { v4 as uuid } from 'uuid';
import { store } from './store.js';
import { db } from '../lib/db.js';

// Embedding model to use (can be made configurable)
const DEFAULT_EMBEDDING_MODEL = process.env.OPENROUTER_EMBEDDING_MODEL || 'openai/text-embedding-3-small';

// ─── RAG — Natural language log querying ─────────────────────────────────────
// Phase 5: Embed threat logs with Voyage AI, query via pgvector.
// When no DB/API key, falls back to keyword search over in-memory logs.

export interface RAGResult {
  answer:   string;
  sources:  RagSource[];
  mode:     'semantic' | 'keyword';
}

export interface RagSource {
  threatId:  string;
  sourceIp:  string;
  attackType: string;
  timestamp: string;
  relevance: number;
}

interface AttackCount {
  type: string;
  count: number;
}

function countAttackTypes(sources: RagSource[]): AttackCount[] {
  const attackCounts = new Map<string, number>();

  for (const source of sources) {
    attackCounts.set(source.attackType, (attackCounts.get(source.attackType) ?? 0) + 1);
  }

  return [...attackCounts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));
}

function mergeSources(primary: RagSource[], secondary: RagSource[], limit = 20): RagSource[] {
  const seen = new Set(primary.map((source) => source.threatId));
  const merged = [...primary];

  for (const source of secondary) {
    if (merged.length >= limit) break;
    if (seen.has(source.threatId)) continue;
    seen.add(source.threatId);
    merged.push(source);
  }

  return merged;
}

function buildEvidenceSummary(sources: RagSource[]): string {
  if (sources.length === 0) {
    return 'Retrieved evidence: none.';
  }

  const ipCounts = new Map<string, number>();
  for (const source of sources) {
    ipCounts.set(source.sourceIp, (ipCounts.get(source.sourceIp) ?? 0) + 1);
  }

  const sortedAttacks = countAttackTypes(sources);
  const sortedIps = [...ipCounts.entries()].sort((a, b) => b[1] - a[1]);

  const attackSummary = sortedAttacks
    .map(({ type, count }) => `${type}: ${count}`)
    .join(', ');
  const ipSummary = sortedIps
    .slice(0, 5)
    .map(([ip, count]) => `${ip}: ${count}`)
    .join(', ');

  return [
    `Retrieved evidence count: ${sources.length}`,
    `Attack type counts in retrieved evidence: ${attackSummary}`,
    `Top source IP counts in retrieved evidence: ${ipSummary}`,
  ].join('\n');
}

// ─── Keyword fallback search ──────────────────────────────────────────────────

// ─── Embedding via OpenRouter ────────────────────────────────────────────────
async function generateEmbedding(text: string, apiKey?: string | null): Promise<number[] | null> {
  const key = apiKey || process.env.OPENROUTER_API_KEY;
  if (!key) {
    console.error('[RAG] No OpenRouter API key provided for embedding.');
    return null;
  }
  try {
    const res = await fetch('https://openrouter.ai/api/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: DEFAULT_EMBEDDING_MODEL,
        input: text,
      }),
    });
    if (!res.ok) {
      console.error(`[RAG] OpenRouter embedding error: ${res.status}`);
      return null;
    }
    const data = await res.json();
    if (Array.isArray(data?.data?.[0]?.embedding)) {
      return data.data[0].embedding;
    }
    console.error('[RAG] Unexpected embedding response:', data);
    return null;
  } catch (err) {
    console.error('[RAG] Embedding fetch failed:', err);
    return null;
  }
}

function keywordSearch(query: string): RagSource[] {
  const q     = query.toLowerCase();
  const terms = q.split(/\s+/).filter(Boolean);
  const threats = store.getThreats(undefined, 1, 100).items;

  return threats
    .map(t => {
      const text = [t.sourceIp, t.attackType, t.endpoint, t.country, t.id, t.userAgent, t.severity].join(' ').toLowerCase();
      const score = terms.filter(term => text.includes(term)).length / terms.length;
      return { threatId: t.id, sourceIp: t.sourceIp, attackType: t.attackType, timestamp: t.timestamp, relevance: score };
    })
    .filter(r => r.relevance > 0)
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, 5);
}

// ─── Generate answer from sources via OpenRouter ─────────────────────────────

async function generateAnswer(
  query:   string,
  sources: RagSource[],
  apiKey:  string | null,
  history: Array<{ role: 'user' | 'assistant'; content: string }> = [],
  evidenceSummary = '',
): Promise<string> {
  if (!apiKey) {
    if (sources.length === 0) {
      return `No relevant security events were found for your request.\n\n**Tips:**\n- Try different keywords (e.g., IP, attack type, endpoint, country)\n- Expand your query or use more general terms\n- If you expect data, ensure the simulator is running or ingest logs\n\nYou can also wait for new threats to appear, or check system status.`;
    }
    const topAttack = countAttackTypes(sources)[0];
    const topSource = sources.find((source) => source.attackType === topAttack?.type) ?? sources[0];
    return `HawkEye Node (Offline Mode): I found ${sources.length} matching events. The strongest signal in the retrieved evidence points to ${topAttack?.type ?? topSource.attackType} with ${topAttack?.count ?? sources.length} hits. The primary origin is ${topSource.sourceIp}. Please configure an API key for deep cognitive analysis.`;
  }

  // Build the system instructions
  const systemPrompt = `You are the HawkEye AI Node, a premium cybersecurity intelligence interface.
Your personality is professional, precise, and mission-focused.

BEHAVIOR RULES:
1. GREETINGS: If the user says "hi", "hello", or "how are you", respond briefly and professionally. Example: "Greetings, Commander. System status nominal. How can I assist with your threat intelligence protocols today?"
2. SECURITY QUERIES: If the user asks about threats, IPs, or logs, use the provided DATA and EVIDENCE below.
3. DATA USAGE: If DATA is provided, be specific. Mention IPs, types, counts, and the strongest patterns in the evidence.
4. NO DATA: If DATA is empty, explain that no matching security events were found in the current log matrix.
5. EVIDENCE RULE: When the user asks which attack is most frequent or similar, answer from the evidence counts, not from a keyword match.
6. STYLE: Keep it to 2-4 sentences. No markdown (no bold, no italics, no bullet points). Use plain text.
`;

  const sanitizeAnswer = (raw: string): string => {
    let cleaned = raw;
    // Some models echo prompt labels like "Query:"; strip those from final user-visible text.
    cleaned = cleaned.replace(/(^|\n)\s*Query\s*:\s*.*(?=\n|$)/gi, '$1');
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();
    return cleaned;
  };

  const context = sources.length > 0
    ? `DATA (Current matched logs):\n${sources
        .map(s => `- [${s.threatId}] ${s.attackType} from ${s.sourceIp} at ${new Date(s.timestamp).toLocaleString()} (relevance: ${Math.round(s.relevance * 100)}%)`)
        .join('\n')}`
    : 'DATA: No matching security events found for this specific query.';

  const userPrompt = [
    `User question: ${query}`,
    evidenceSummary ? `EVIDENCE:\n${evidenceSummary}` : 'EVIDENCE: None.',
    context,
  ].join('\n\n');

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || "google/gemini-2.0-flash-lite-preview-02-05:free",
        messages: [
          { role: "system", content: systemPrompt },
          ...history,
          { role: "user", content: userPrompt }
        ]
      })
    });

    if (!res.ok) {
      console.error(`[RAG] OpenRouter error: ${res.status}`);
      return sources.length > 0 
        ? `Found ${sources.length} relevant threat(s): ${sources.map(s => `${s.attackType} from ${s.sourceIp}`).join(', ')}.`
        : "I encountered a communication error with the neural platform. Please try again.";
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    return content ? sanitizeAnswer(content) : "Signal lost. Please re-initialize.";
  } catch (err) {
    console.error('[RAG] OpenRouter call failed:', err);
    return "The HawkEye neural link is currently unstable. Falling back to local keyword processing.";
  }
}

// ─── RAG Service ─────────────────────────────────────────────────────────────

class RAGService {
  private embeddingsCompatibleWithDb = true;

  private get apiKey(): string | null {
    return process.env.OPENROUTER_API_KEY || null;
  }


  // No queueing logic for OpenRouter; if you want to rate-limit, add here
  private async generateEmbedding(text: string): Promise<number[] | null> {
    return generateEmbedding(text, this.apiKey);
  }

  private isVectorDimensionMismatch(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return /expected\s+\d+\s+dimensions,\s+not\s+\d+/i.test(message);
  }

  private async semanticSearch(query: string): Promise<RagSource[]> {
    const embedding = await this.generateEmbedding(query);
    if (!embedding || !db) return [];

    try {
      const vectorStr = `[${embedding.join(',')}]`;
      // We use $queryRawUnsafe because $queryRaw handles parameters differently for custom types like ::vector
      const results = await db.$queryRawUnsafe(`
        SELECT 
          tl."threatId", 
          t."sourceIp", 
          t."attackType", 
          tl.timestamp::text as timestamp,
          1 - (tl.embedding <=> $1::vector) as relevance
        FROM threat_logs tl
        JOIN threats t ON tl."threatId" = t.id
        WHERE tl.embedding IS NOT NULL
        ORDER BY tl.embedding <=> $1::vector
        LIMIT 20
      `, vectorStr);

      return (results as any[]).map(r => ({
        threatId:   r.threatId,
        sourceIp:   r.sourceIp,
        attackType: r.attackType,
        timestamp:  r.timestamp,
        relevance:  Number(r.relevance)
      }));
    } catch (err) {
      console.error('[RAG] Semantic search failed:', err);
      return [];
    }
  }

  private expandWithRecentThreats(sources: RagSource[], limit = 20): RagSource[] {
    if (sources.length >= 5) {
      return sources.slice(0, limit);
    }

    const recentThreats = store.getRecentThreats(limit * 2).map((threat) => ({
      threatId: threat.id,
      sourceIp: threat.sourceIp,
      attackType: threat.attackType,
      timestamp: threat.timestamp,
      relevance: 0.25,
    } satisfies RagSource));

    return mergeSources(sources, recentThreats, limit);
  }

  async indexLog(threatId: string, message: string): Promise<void> {
    if (!db) return;

    try {
      const embedding = await this.generateEmbedding(message);
      const vectorStr = embedding ? `[${embedding.join(',')}]` : null;

      const insertWithoutEmbedding = async (): Promise<void> => {
        await db.$executeRawUnsafe(`
          INSERT INTO threat_logs (id, "threatId", level, message, timestamp)
          VALUES ($1, $2, $3, $4, NOW())
        `, uuid(), threatId, 'info', message);
      };

      if (vectorStr && this.embeddingsCompatibleWithDb) {
        try {
          await db.$executeRawUnsafe(`
            INSERT INTO threat_logs (id, "threatId", level, message, timestamp, embedding)
            VALUES ($1, $2, $3, $4, NOW(), $5::vector)
            ON CONFLICT (id) DO UPDATE SET embedding = $5::vector
          `, uuid(), threatId, 'info', message, vectorStr);
        } catch (error) {
          if (!this.isVectorDimensionMismatch(error)) {
            throw error;
          }

          this.embeddingsCompatibleWithDb = false;
          console.warn('[RAG] Embedding dimension mismatch detected; storing log without embedding for keyword fallback.');
          await insertWithoutEmbedding();
        }
      } else {
        // Fallback for keyword search if embedding generation fails
        await insertWithoutEmbedding();
      }
    } catch (err) {
      console.error('[RAG] Indexing failed:', err);
    }
  }

  async query(question: string, history: Array<{ role: 'user' | 'assistant'; content: string }> = []): Promise<RAGResult> {
    const key = this.apiKey;
    
    // Try semantic search first if we have a Voyage key
    let sources = await this.semanticSearch(question);
    const semanticSucceeded = sources.length > 0;

    // Fallback to keyword if semantic failed or found nothing
    if (!semanticSucceeded) {
      sources = keywordSearch(question);
    }

    sources = this.expandWithRecentThreats(sources);

    const evidenceSummary = buildEvidenceSummary(sources);
    const answer = await generateAnswer(question, sources, key, history, evidenceSummary);

    return {
      answer,
      sources,
      mode: semanticSucceeded ? 'semantic' : 'keyword',
    };
  }
}

export const ragService = new RAGService();
