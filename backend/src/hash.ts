import argon2 from 'argon2';

/**
 * Password hashing for self-owned auth. argon2id is the OWASP-recommended
 * default: resistant to both GPU and side-channel attacks. The salt is generated
 * embedded in the encoded hash by argon2, so `verify` needs only the stored
 * string + the candidate password.
 */

const HASH_OPTIONS: argon2.Options = { type: argon2.argon2id };

/** Hash a plaintext password. Store the returned encoded string verbatim. */
export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, HASH_OPTIONS);
}

/**
 * Verify a candidate password against a stored hash. Returns false (rather than
 * throwing) on a malformed hash so callers can treat it as an auth failure.
 */
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}
