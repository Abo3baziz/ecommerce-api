/**
 * Request URLs are logged without their query string.
 *
 * Email links embed single-use credentials (`/verify-email?token=…`,
 * `/reset-password?token=…`) and some flows pass OTPs or secrets as query
 * parameters. Stripping the entire query string keeps every such value
 * (token, otp, password, …) out of persistent logs — there is no allowlist
 * to maintain, because no query data is ever persisted.
 *
 * The request path alone retains everything needed to correlate a log entry
 * with a route; request bodies are never logged verbatim either.
 */
export function stripUrlQuery(rawUrl: string): string {
  const queryStart = rawUrl.indexOf("?");
  return queryStart === -1 ? rawUrl : rawUrl.slice(0, queryStart);
}
