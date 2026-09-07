// R2 object keys → public URLs. No URL construction existed anywhere before
// this phase (R2 bucket itself is still pending per PROGRESS.md), so this is
// the established pattern: a public base URL env var + object key.
// Key format assumed: plain object keys like "turf/photo-1.jpg" (no leading slash).
export function r2Url(key: string): string | null {
  const base = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
  if (!base) return null; // Bucket/domain not configured yet — callers show a fallback.
  return `${base.replace(/\/$/, "")}/${key.replace(/^\//, "")}`;
}
