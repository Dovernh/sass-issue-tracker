import { SignJWT, jwtVerify, errors } from 'jose';
import { config } from './config.js';

/**
 * Self-issued session tokens for local auth. Bearer JWTs: the client stores the
 * token and sends `Authorization: Bearer <jwt>`. Tokens are HMAC-signed with
 * AUTH_SECRET (HS256).
 *
 * The token carries identity only (userId + active orgId). Permissions are NOT
 * baked in — `localAuth` re-reads them from the membership row on every request,
 * so role changes take effect without forcing a re-login.
 */

const ALG = 'HS256';
const ISSUER = 'saas-issue-tracker';
/** Short-lived per the security checklist; the frontend handles idle logout. */
const TTL = '7d';

export interface SessionClaims {
  userId: string;
  /** Active org. Omitted for the platform owner (no org context). */
  orgId?: string;
}

/** Lazily resolve + validate the signing secret so config errors surface clearly. */
function secret(): Uint8Array {
  if (!config.AUTH_SECRET) {
    throw new Error('AUTH_SECRET is required to issue/verify local auth tokens');
  }
  return new TextEncoder().encode(config.AUTH_SECRET);
}

/** Issue a signed session token for the given identity. */
export function signSession(claims: SessionClaims): Promise<string> {
  return new SignJWT(claims.orgId ? { orgId: claims.orgId } : {})
    .setProtectedHeader({ alg: ALG })
    .setSubject(claims.userId)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(TTL)
    .sign(secret());
}

/**
 * Verify a session token. Returns the claims, or null if the token is missing,
 * malformed, tampered, or expired (callers map null → 401).
 */
export async function verifySession(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), { issuer: ISSUER });
    const userId = payload.sub;
    if (typeof userId !== 'string') return null;
    const orgId = typeof payload.orgId === 'string' ? payload.orgId : undefined;
    return { userId, orgId };
  } catch (err) {
    // Expired / invalid signature / malformed → treat as unauthenticated.
    if (err instanceof errors.JOSEError) return null;
    throw err;
  }
}
