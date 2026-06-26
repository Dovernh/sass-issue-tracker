import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { wrap } from '../middleware/async-handler.js';
import { requireAuth } from '../require-auth.js';
import { verifyPassword } from '../hash.js';
import { signSession } from '../tokens.js';
import {
  findOrganization,
  findUserByEmail,
  getMembership,
  getMembershipsForUser,
} from '../auth.repo.js';
import { effectivePermissions } from '../permissions.js';

/**
 * Auth endpoints: login + logout. Bearer JWT model. There is no public sign-up —
 * the platform owner provisions orgs+admins (see /api/platform), and admins
 * provision members (see /api/members). Login handles both the platform owner
 * (no org token) and org members.
 */

export const authRouter = Router();

/** Brute-force throttle on login: 10 attempts / 15 min per IP. */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { detail: 'Too many login attempts, try again later' },
});

const isNonEmptyString = (v: unknown): v is string =>
  typeof v === 'string' && v.trim().length > 0;

/** Shape returned to the client on successful auth. */
function publicUser(user: { id: string; email: string; name: string | null; imageUrl: string | null }) {
  return { id: user.id, email: user.email, name: user.name, imageUrl: user.imageUrl };
}

authRouter.post(
  '/login',
  loginLimiter,
  wrap(async (req, res) => {
    const { email, password } = req.body ?? {};
    if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
      res.status(400).json({ detail: 'Email and password are required' });
      return;
    }

    const user = await findUserByEmail(email);
    // Verify even when the user is missing? We skip to avoid a needless hash,
    // but return the SAME 401 either way so the response can't enumerate emails.
    const ok = user ? await verifyPassword(user.passwordHash, password) : false;
    if (!user || !ok) {
      res.status(401).json({ detail: 'Invalid email or password' });
      return;
    }

    // Platform owner: no org context; gets a platform token.
    if (user.platformRole === 'owner') {
      const token = await signSession({ userId: user.id });
      res.json({ token, user: publicUser(user), platformRole: 'owner' });
      return;
    }

    const memberships = await getMembershipsForUser(user.id);
    if (memberships.length === 0) {
      res.status(403).json({ detail: 'No organization for this user' });
      return;
    }
    // Default to the first org; the client can switch (see /api/auth/switch-org).
    const membership = memberships[0];
    const orgId = membership.orgId;
    const org = await findOrganization(orgId);

    const token = await signSession({ userId: user.id, orgId });
    res.json({
      token,
      user: publicUser(user),
      orgId,
      orgRole: membership.role,
      orgPermissions: effectivePermissions(membership.role, org?.memberPermissions ?? null),
    });
  }),
);

// Re-issue a token scoped to a different org the caller belongs to. Verifies
// membership (cross-org denial) and that the target org is available, then mints
// a new member token. The platform owner has no memberships, so this 403s.
authRouter.post(
  '/switch-org',
  requireAuth,
  wrap(async (req, res) => {
    const { orgId } = req.body ?? {};
    if (!isNonEmptyString(orgId)) {
      res.status(400).json({ detail: 'orgId is required' });
      return;
    }

    const membership = await getMembership(req.auth!.userId, orgId);
    if (!membership) {
      res.status(403).json({ detail: 'No access to this organization' });
      return;
    }

    const org = await findOrganization(orgId);
    if (!org || org.deletedAt || org.status === 'disabled') {
      res.status(403).json({ detail: 'Organization is unavailable' });
      return;
    }

    const token = await signSession({ userId: req.auth!.userId, orgId });
    res.json({
      token,
      orgId,
      orgRole: membership.role,
      orgPermissions: effectivePermissions(membership.role, org.memberPermissions),
    });
  }),
);

// Stateless JWT: nothing to revoke server-side, so logout just acknowledges and
// the client discards the token. Endpoint exists for a symmetric client API.
authRouter.post('/logout', (_req, res) => {
  res.status(204).end();
});
