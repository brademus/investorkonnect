/**
 * OpenAI Embeddings Client
 * 
 * Generates vector embeddings for profile matching
 */

export async function embedText({ text, model, apiKey }) {
  const _model = model || Deno.env.get("MATCH_EMBED_MODEL") || "text-embedding-3-small";
  const key = apiKey || Deno.env.get("OPENAI_API_KEY");
  
  if (!key) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  
  console.log('[OpenAI] Generating embedding with model:', _model);
  
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ 
      input: text, 
      model: _model 
    }),
  });
  
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[OpenAI] Embedding failed: ${res.status} ${body}`);
  }
  
  const json = await res.json();
  const vector = json?.data?.[0]?.embedding;
  
  if (!Array.isArray(vector)) {
    throw new Error("No embedding returned from OpenAI");
  }
  
  console.log('[OpenAI] Generated embedding with', vector.length, 'dimensions');
  
  return { model: _model, vector };
}