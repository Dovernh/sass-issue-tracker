import { Router } from 'express';
import { requireAuth } from '../require-auth.js';
import { requirePlatformOwner } from '../auth.js';
import { wrap } from '../middleware/async-handler.js';
import { hashPassword } from '../hash.js';
import {
  countOrgManagers,
  createMember,
  deleteMember,
  findOrganization,
  findUserByEmail,
  getMemberView,
} from '../auth.repo.js';
import {
  createOrgWithAdmin,
  listOrgsForPlatform,
  renameOrg,
  setOrgStatus,
  softDeleteOrg,
} from '../platform.repo.js';

/**
 * Platform (control plane) endpoints for the SaaS owner: org lifecycle + admin
 * assignment. Every route requires the platform owner and returns org metadata
 * + admins only — never issues or full member rosters. The owner has no org
 * permissions, so they can't reach /api/issues or /api/members.
 */

export const platformRouter = Router();
platformRouter.use(requireAuth, requirePlatformOwner);

const isNonEmptyString = (v: unknown): v is string =>
  typeof v === 'string' && v.trim().length > 0;

platformRouter.get(
  '/orgs',
  wrap(async (_req, res) => {
    res.json({ orgs: await listOrgsForPlatform() });
  }),
);

platformRouter.post(
  '/orgs',
  wrap(async (req, res) => {
    const { orgName, adminEmail, adminName, adminPassword } = req.body ?? {};
    if (!isNonEmptyString(orgName) || !isNonEmptyString(adminEmail) || !isNonEmptyString(adminPassword)) {
      res.status(400).json({ detail: 'orgName, adminEmail, and adminPassword are required' });
      return;
    }
    if (adminPassword.length < 8) {
      res.status(400).json({ detail: 'Password must be at least 8 characters' });
      return;
    }
    if (await findUserByEmail(adminEmail)) {
      res.status(409).json({ detail: 'An account with this email already exists' });
      return;
    }
    const org = await createOrgWithAdmin({
      orgName,
      adminEmail,
      adminName: isNonEmptyString(adminName) ? adminName : null,
      adminPasswordHash: await hashPassword(adminPassword),
    });
    res.status(201).json(org);
  }),
);

platformRouter.patch(
  '/orgs/:id',
  wrap(async (req, res) => {
    const { name, status } = req.body ?? {};
    if (status !== undefined && status !== 'active' && status !== 'disabled') {
      res.status(400).json({ detail: 'status must be "active" or "disabled"' });
      return;
    }
    let org = await findOrganization(req.params.id);
    if (!org || org.deletedAt) {
      res.status(404).json({ detail: 'Organization not found' });
      return;
    }
    if (isNonEmptyString(name)) org = (await renameOrg(req.params.id, name)) ?? org;
    if (status !== undefined) org = (await setOrgStatus(req.params.id, status)) ?? org;
    res.json(org);
  }),
);

platformRouter.delete(
  '/orgs/:id',
  wrap(async (req, res) => {
    const ok = await softDeleteOrg(req.params.id);
    if (!ok) {
      res.status(404).json({ detail: 'Organization not found' });
      return;
    }
    res.status(204).end();
  }),
);

platformRouter.post(
  '/orgs/:id/admins',
  wrap(async (req, res) => {
    const { email, name, password } = req.body ?? {};
    if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
      res.status(400).json({ detail: 'email and password are required' });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ detail: 'Password must be at least 8 characters' });
      return;
    }
    const org = await findOrganization(req.params.id);
    if (!org || org.deletedAt) {
      res.status(404).json({ detail: 'Organization not found' });
      return;
    }
    if (await findUserByEmail(email)) {
      res.status(409).json({ detail: 'An account with this email already exists' });
      return;
    }
    const admin = await createMember(req.params.id, {
      email,
      passwordHash: await hashPassword(password),
      name: isNonEmptyString(name) ? name : null,
      role: 'admin',
    });
    res.status(201).json(admin);
  }),
);

platformRouter.delete(
  '/orgs/:id/admins/:userId',
  wrap(async (req, res) => {
    const target = await getMemberView(req.params.id, req.params.userId);
    if (!target) {
      res.status(404).json({ detail: 'Admin not found' });
      return;
    }
    if ((await countOrgManagers(req.params.id)) <= 1) {
      res.status(409).json({ detail: 'Cannot remove the last admin' });
      return;
    }
    await deleteMember(req.params.id, req.params.userId);
    res.status(204).end();
  }),
);
