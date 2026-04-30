// src/lib/validate-redirect.ts
//
// Whitelists the `redirect` query-param to internal relative paths so a
// crafted `/login?redirect=//evil.com` (or `https://evil.com`) cannot
// bounce a user off-site after authentication.
//
// Returns the path unchanged if it's a relative path, else null.
// Caller is responsible for falling back to "/" when this returns null.

export function validateRedirect(raw: string | null | undefined): string | null {
  if (!raw) return null
  if (!raw.startsWith("/")) return null
  if (raw.startsWith("//")) return null
  return raw
}
