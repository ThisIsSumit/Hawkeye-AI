import { v4 as uuid } from 'uuid';
import { store } from './store.js';
import { db } from '../lib/db.js';
import { generateEmbedding } from '../lib/voyage.js';

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

// ─── Keyword fallback search ──────────────────────────────────────────────────

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
): Promise<string> {
  if (!apiKey) {
    if (sources.length === 0) return `I am currently operating in limited keyword mode. I found no immediate matches for "${query}" in the active threat logs.`;
    return `HawkEye Node (Offline Mode): I found ${sources.length} matching events. The primary origin is ${sources[0].sourceIp} involving ${sources[0].attackType}. Please configure an API key for deep cognitive analysis.`;
  }

  // Build the system instructions
  const systemPrompt = `You are the HawkEye AI Node, a premium cybersecurity intelligence interface.
Your personality is professional, precise, and mission-focused.

BEHAVIOR RULES:
1. GREETINGS: If the user says "hi", "hello", or "how are you", respond briefly and professionally. Example: "Greetings, Commander. System status nominal. How can I assist with your threat intelligence protocols today?"
2. SECURITY QUERIES: If the user asks about threats, IPs, or logs, use the provided DATA below. 
3. DATA USAGE: If DATA is provided, be specific. Mention IPs, types, and counts.
4. NO DATA: If DATA is empty and the query is about specific threats, explain that no matches were found in the current log matrix.
5. STYLE: Keep it to 2-4 sentences. No markdown (no bold, no italics, no bullet points). Use plain text.
`;

  const context = sources.length > 0
    ? `DATA (Current matched logs):\n${sources
        .map(s => `- [${s.threatId}] ${s.attackType} from ${s.sourceIp} at ${new Date(s.timestamp).toLocaleString()} (relevance: ${Math.round(s.relevance * 100)}%)`)
        .join('\n')}`
    : "DATA: No matching security events found for this specific query.";

  const userPrompt = `Query: ${query}\n\n${context}`;

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
    return data.choices?.[0]?.message?.content || "Signal lost. Please re-initialize.";
  } catch (err) {
    console.error('[RAG] OpenRouter call failed:', err);
    return "The HawkEye neural link is currently unstable. Falling back to local keyword processing.";
  }
}

// ─── RAG Service ─────────────────────────────────────────────────────────────

class RAGService {
  private get apiKey(): string | null {
    return process.env.OPENROUTER_API_KEY || null;
  }

  private embeddingQueue: Promise<any> = Promise.resolve();

  private async queuedGenerateEmbedding(text: string): Promise<number[] | null> {
    const next = this.embeddingQueue.then(async () => {
      const start = Date.now();
      const result = await generateEmbedding(text);
      // Ensure at least 30s gap for free tier stability
      const elapsed = Date.now() - start;
      const delay = Math.max(0, 30000 - elapsed);
      if (delay > 0) {
        console.log(`[Voyage] Rate limit safety: waiting ${Math.round(delay/1000)}s...`);
        await new Promise(r => setTimeout(r, delay));
      }
      return result;
    });
    this.embeddingQueue = next.catch(() => {}); // Prevent queue crash
    return next;
  }

  private async semanticSearch(query: string): Promise<RagSource[]> {
    const embedding = await this.queuedGenerateEmbedding(query);
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
        LIMIT 5
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

  async indexLog(threatId: string, message: string): Promise<void> {
    if (!db) return;

    try {
      const embedding = await this.queuedGenerateEmbedding(message);
      const vectorStr = embedding ? `[${embedding.join(',')}]` : null;

      if (vectorStr) {
        await db.$executeRawUnsafe(`
          INSERT INTO threat_logs (id, "threatId", level, message, timestamp, embedding)
          VALUES ($1, $2, $3, $4, NOW(), $5::vector)
          ON CONFLICT (id) DO UPDATE SET embedding = $5::vector
        `, uuid(), threatId, 'info', message, vectorStr);
      } else {
        // Fallback for keyword search if embedding generation fails
        // USE RAW SQL to avoid Prisma vector deserialization crash (P2023)
        await db.$executeRawUnsafe(`
          INSERT INTO threat_logs (id, "threatId", level, message, timestamp)
          VALUES ($1, $2, $3, $4, NOW())
        `, uuid(), threatId, 'info', message);
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

    const answer = await generateAnswer(question, sources, key, history);

    return {
      answer,
      sources,
      mode: semanticSucceeded ? 'semantic' : 'keyword',
    };
  }
}

export const ragService = new RAGService();
