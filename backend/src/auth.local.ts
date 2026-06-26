import type { RequestHandler } from 'express';
import type { AuthUser } from './auth.js';
import { findOrganization, findUserById, getMembership } from './auth.repo.js';
import { effectivePermissions } from './permissions.js';
import { verifySession } from './tokens.js';

/**
 * Self-owned auth middleware: verifies the session JWT and attaches `req.auth`.
 * Wired into routes via `require-auth.ts`.
 *
 * Two token shapes:
 * - **Platform owner** (no `orgId` claim): authorized if the user's
 *   `platform_role === 'owner'`. Gets no org permissions, so org guards reject it.
 * - **Member** (`orgId` claim): load the membership for that org; reject if the
 *   org is disabled/deleted. Permissions are re-read each request, so role/status
 *   changes take effect immediately without re-login.
 */

/** Extract the token from an `Authorization: Bearer <jwt>` header. */
function bearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}

export const localAuth: RequestHandler = async (req, res, next) => {
  try {
    const token = bearerToken(req.get('authorization'));
    if (!token) {
      res.status(401).json({ detail: 'Not authenticated' });
      return;
    }

    const claims = await verifySession(token);
    if (!claims) {
      res.status(401).json({ detail: 'Not authenticated' });
      return;
    }

    // Platform-owner token: no org context, no org permissions.
    if (!claims.orgId) {
      const user = await findUserById(claims.userId);
      if (!user || user.platformRole !== 'owner') {
        res.status(401).json({ detail: 'Not authenticated' });
        return;
      }
      req.auth = {
        userId: user.id,
        orgId: '',
        orgRole: '',
        orgPermissions: [],
        platformRole: 'owner',
        has: () => false,
      };
      next();
      return;
    }

    // Member token: the membership authorizes the user for this org (cross-org
    // denial: no row → 403) and supplies the current permission set.
    const membership = await getMembership(claims.userId, claims.orgId);
    if (!membership) {
      res.status(403).json({ detail: 'No access to this organization' });
      return;
    }

    // Block access to a disabled or deleted org (takes effect immediately).
    const org = await findOrganization(claims.orgId);
    if (!org || org.deletedAt || org.status === 'disabled') {
      res.status(403).json({ detail: 'Organization is unavailable' });
      return;
    }

    // Resolve effective permissions by role (admin→all, viewer→fixed, member→the
    // org's editable template). Re-read each request, so template/role edits apply
    // immediately without re-login.
    const orgPermissions = effectivePermissions(membership.role, org.memberPermissions);
    const auth: AuthUser = {
      userId: claims.userId,
      orgId: claims.orgId,
      orgRole: membership.role,
      orgPermissions,
      has: (permission) => orgPermissions.includes(permission),
    };
    req.auth = auth;
    next();
  } catch (err) {
    console.error('[auth.local] verification error:', err);
    res.status(401).json({ detail: 'Not authenticated' });
  }
};
