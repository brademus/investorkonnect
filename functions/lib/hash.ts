/**
 * SHA-256 Hashing Utility
 * 
 * Creates hash of profile text to detect changes
 */

export async function sha256(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text || "");
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = Array.from(new Uint8Array(digest));
  return bytes.map(b => b.toString(16).padStart(2, "0")).join("");
}