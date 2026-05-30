/**
 * Voyage AI Embedding Utility
 * Phase 5 RAG Integration
 */

export async function generateEmbedding(text: string): Promise<number[] | null> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) {
    console.warn('[Voyage] No VOYAGE_API_KEY found. Semantic search disabled.');
    return null;
  }

  try {
    const response = await fetch('https://api.voyageai.com/v1/embeddings', {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        input: [text.replace(/\n/g, ' ')], // sanitize input
        model: 'voyage-large-2-instruct',
      }),
    });

    if (!response.ok) {
      console.error(`[Voyage] API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data.data?.[0]?.embedding || null;
  } catch (err) {
    console.error('[Voyage] Call failed:', err);
    return null;
  }
}
