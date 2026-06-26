import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './hash.js';

describe('hash', () => {
  it('verifies a correct password against its hash', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash).not.toContain('correct horse'); // never the plaintext
    expect(await verifyPassword(hash, 'correct horse battery staple')).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('s3cret-password');
    expect(await verifyPassword(hash, 'wrong-password')).toBe(false);
  });

  it('returns false (not throws) for a malformed hash', async () => {
    expect(await verifyPassword('not-a-real-hash', 'whatever')).toBe(false);
  });
});
