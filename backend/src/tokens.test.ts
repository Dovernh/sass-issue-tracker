import { describe, expect, it } from 'vitest';
import { signSession, verifySession } from './tokens.js';

describe('tokens', () => {
  it('round-trips a signed session', async () => {
    const token = await signSession({ userId: 'user_1', orgId: 'org_1' });
    expect(await verifySession(token)).toEqual({ userId: 'user_1', orgId: 'org_1' });
  });

  it('rejects a tampered token', async () => {
    const token = await signSession({ userId: 'user_1', orgId: 'org_1' });
    expect(await verifySession(token + 'x')).toBeNull();
  });

  it('rejects a non-token string', async () => {
    expect(await verifySession('garbage')).toBeNull();
  });
});
