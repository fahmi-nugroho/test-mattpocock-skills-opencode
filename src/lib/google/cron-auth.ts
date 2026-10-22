import { timingSafeEqual } from "node:crypto";

/**
 * Shared-secret authentication for the only scheduled Google mirror entry
 * point (ticket 03).
 *
 * Vercel Cron invokes a route with no admin session, so the route must prove
 * the caller knows a server-only secret. Vercel automatically sends
 * `Authorization: Bearer $CRON_SECRET`; a plain `x-cron-secret` header is also
 * accepted for manual runs. A missing secret on either side is a rejection.
 */
export function readCronSecret(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): string {
  return (
    (env.GOOGLE_CALENDAR_CRON_SECRET ?? "").trim() ||
    (env.CRON_SECRET ?? "").trim()
  );
}

function presentedSecret(headers: Headers): string {
  const direct = (headers.get("x-cron-secret") ?? "").trim();
  if (direct) return direct;
  const match = /^Bearer\s+(.+)$/i.exec(headers.get("authorization") ?? "");
  return match?.[1]?.trim() ?? "";
}

/** Constant-time comparison once both values have the same length. */
export function isCronSecretValid(
  presented: string,
  expected: string,
): boolean {
  if (!presented || !expected) return false;
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function isCronAuthorized(
  request: Pick<Request, "headers">,
  expected: string,
): boolean {
  return isCronSecretValid(presentedSecret(request.headers), expected);
}
