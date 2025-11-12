/**
 * Cosine Similarity Calculator
 * 
 * Computes similarity between two embedding vectors
 */

export function cosineSim(a, b) {
  if (!a || !b || a.length !== b.length) {
    return 0;
  }
  
  let dot = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }
  
  if (normA === 0 || normB === 0) {
    return 0;
  }
  
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}