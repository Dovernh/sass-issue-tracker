import { Router } from 'express';
import { requireAuth } from '../require-auth.js';
import { requireMembersView, requireMembersManage } from '../auth.js';
import { wrap } from '../middleware/async-handler.js';
import { MemberRolePatchSchema } from '../schemas/roles.schema.js';
import {
  getMemberPermissions,
  grantableMemberPermissions,
  setMemberPermissions,
} from '../roles.repo.js';

/**
 * The org's editable `member` role permission template. admin (all) and viewer
 * (read-only) are fixed in code — only the member role is customizable. Read is
 * gated by org:members:view; writes by org:members:manage. Changes take effect on
 * each member's next request (permissions are resolved per request).
 */

export const rolesRouter = Router();

rolesRouter.get(
  '/member',
  requireAuth,
  requireMembersView,
  wrap(async (req, res) => {
    res.json({
      permissions: await getMemberPermissions(req.auth!.orgId),
      available: grantableMemberPermissions(),
    });
  }),
);

rolesRouter.put(
  '/member',
  requireAuth,
  requireMembersManage,
  wrap(async (req, res) => {
    const parsed = MemberRolePatchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ detail: parsed.error.issues[0]?.message ?? 'Invalid request' });
      return;
    }
    const permissions = await setMemberPermissions(req.auth!.orgId, parsed.data.permissions);
    res.json({ permissions, available: grantableMemberPermissions() });
  }),
);
