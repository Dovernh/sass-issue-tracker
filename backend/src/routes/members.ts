import { Router } from 'express';
import { requireAuth } from '../require-auth.js';
import { requireMembersView, requireMembersManage } from '../auth.js';
import { wrap } from '../middleware/async-handler.js';
import { hashPassword } from '../hash.js';
import {
  countOrgManagers,
  createMember,
  deleteMember,
  findUserByEmail,
  getMemberView,
  listMembers,
  setMemberPassword,
  updateMember,
} from '../auth.repo.js';
import {
  NewMemberSchema,
  MemberPatchSchema,
  PasswordResetSchema,
} from '../schemas/members.schema.js';

/**
 * Admin member management (org-scoped). Gated by org:members:* permissions.
 * Assignable roles are admin/member/viewer (the platform owner is separate).
 * The org's last manager (admin, or a legacy owner) can't be removed or demoted.
 */

export const membersRouter = Router();

const isNonEmptyString = (v: unknown): v is string =>
  typeof v === 'string' && v.trim().length > 0;

const isManagerRole = (role: string): boolean => role === 'owner' || role === 'admin';

membersRouter.get(
  '/',
  requireAuth,
  requireMembersView,
  wrap(async (req, res) => {
    res.json({ members: await listMembers(req.auth!.orgId) });
  }),
);

membersRouter.post(
  '/',
  requireAuth,
  requireMembersManage,
  wrap(async (req, res) => {
    const parsed = NewMemberSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ detail: parsed.error.issues[0]?.message ?? 'Invalid request' });
      return;
    }
    const { email, name, role, password } = parsed.data;
    if (await findUserByEmail(email)) {
      res.status(409).json({ detail: 'An account with this email already exists' });
      return;
    }

    const member = await createMember(req.auth!.orgId, {
      email,
      passwordHash: await hashPassword(password),
      name: isNonEmptyString(name) ? name : null,
      role,
    });
    res.status(201).json(member);
  }),
);

membersRouter.patch(
  '/:userId',
  requireAuth,
  requireMembersManage,
  wrap(async (req, res) => {
    const parsed = MemberPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ detail: parsed.error.issues[0]?.message ?? 'Invalid request' });
      return;
    }
    const { name, role } = parsed.data;

    const target = await getMemberView(req.auth!.orgId, req.params.userId);
    if (!target) {
      res.status(404).json({ detail: 'Member not found' });
      return;
    }
    // Don't allow demoting the org's last manager.
    if (
      isManagerRole(target.role) &&
      role !== undefined &&
      !isManagerRole(role) &&
      (await countOrgManagers(req.auth!.orgId)) <= 1
    ) {
      res.status(409).json({ detail: 'Cannot demote the last admin' });
      return;
    }

    const updated = await updateMember(req.auth!.orgId, req.params.userId, {
      ...(name !== undefined ? { name: isNonEmptyString(name) ? name : null } : {}),
      ...(role !== undefined ? { role } : {}),
    });
    res.json(updated);
  }),
);

membersRouter.post(
  '/:userId/password',
  requireAuth,
  requireMembersManage,
  wrap(async (req, res) => {
    const parsed = PasswordResetSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ detail: parsed.error.issues[0]?.message ?? 'Invalid request' });
      return;
    }
    const target = await getMemberView(req.auth!.orgId, req.params.userId);
    if (!target) {
      res.status(404).json({ detail: 'Member not found' });
      return;
    }
    await setMemberPassword(
      req.auth!.orgId,
      req.params.userId,
      await hashPassword(parsed.data.password),
    );
    res.status(204).end();
  }),
);

membersRouter.delete(
  '/:userId',
  requireAuth,
  requireMembersManage,
  wrap(async (req, res) => {
    if (req.params.userId === req.auth!.userId) {
      res.status(403).json({ detail: 'You cannot remove yourself' });
      return;
    }
    const target = await getMemberView(req.auth!.orgId, req.params.userId);
    if (!target) {
      res.status(404).json({ detail: 'Member not found' });
      return;
    }
    // Don't allow removing the org's last manager.
    if (isManagerRole(target.role) && (await countOrgManagers(req.auth!.orgId)) <= 1) {
      res.status(409).json({ detail: 'Cannot remove the last admin' });
      return;
    }
    await deleteMember(req.auth!.orgId, req.params.userId);
    res.status(204).end();
  }),
);
