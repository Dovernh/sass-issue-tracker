import { Router } from 'express';
import {
  requireView,
  requireCreate,
  requireEdit,
  requireDelete,
} from '../auth.js';
import { requireAuth } from '../require-auth.js';
import { wrap } from '../middleware/async-handler.js';
import {
  listIssues,
  createIssue,
  updateIssue,
  softDeleteIssue,
  type UpdateIssueInput,
} from '../issues.repo.js';
import type { Issue } from '../db/schema.js';
import { priorityExists } from '../priorities.repo.js';
import { categoryExists } from '../categories.repo.js';
import { NewIssueSchema, IssuePatchSchema } from '../schemas/issues.schema.js';

// Priority/category are validated against each org's configurable option lists
// (the DB source of truth), not a hardcoded enum — so custom options are usable.
// `undefined` is allowed: create falls back to the column default.
const validPriority = async (orgId: string, value: unknown): Promise<boolean> =>
  value === undefined || (typeof value === 'string' && (await priorityExists(orgId, value)));
const validCategory = async (orgId: string, value: unknown): Promise<boolean> =>
  value === undefined || (typeof value === 'string' && (await categoryExists(orgId, value)));

export const issuesRouter = Router();

// Org-scoped, soft-deleted, gated by org permissions.
issuesRouter.get(
  '/',
  requireAuth,
  requireView,
  wrap(async (req, res) => {
    res.json({ issues: await listIssues(req.auth!.orgId) });
  }),
);

issuesRouter.post(
  '/',
  requireAuth,
  requireCreate,
  wrap(async (req, res) => {
    // Shape/type validation from the DTO; .detail is the first zod message.
    const parsed = NewIssueSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ detail: parsed.error.issues[0]?.message ?? 'Invalid request' });
      return;
    }
    const { description, assignedUser, priority, category, screenshotPath } = parsed.data;
    if (!(await validPriority(req.auth!.orgId, priority))) {
      res.status(400).json({ detail: 'Invalid priority' });
      return;
    }
    if (!(await validCategory(req.auth!.orgId, category))) {
      res.status(400).json({ detail: 'Invalid category' });
      return;
    }
    const issue = await createIssue(req.auth!.orgId, {
      description,
      assignedUser,
      // Validated above against the org's option lists (the DB is the source of
      // truth); the static enum types here are just the stored column shape.
      priority: priority as Issue['priority'] | undefined,
      category: category as Issue['category'] | undefined,
      screenshotPath,
      createdBy: req.auth!.userId,
    });
    res.status(201).json(issue);
  }),
);

issuesRouter.patch(
  '/:id',
  requireAuth,
  requireEdit,
  wrap(async (req, res) => {
    // Shape/type validation (incl. status enum) from the DTO.
    const parsed = IssuePatchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ detail: parsed.error.issues[0]?.message ?? 'Invalid request' });
      return;
    }
    const { priority, category } = parsed.data;
    if (!(await validPriority(req.auth!.orgId, priority))) {
      res.status(400).json({ detail: 'Invalid priority' });
      return;
    }
    if (!(await validCategory(req.auth!.orgId, category))) {
      res.status(400).json({ detail: 'Invalid category' });
      return;
    }
    const issue = await updateIssue(
      Number(req.params.id),
      req.auth!.orgId,
      parsed.data as UpdateIssueInput,
    );
    if (!issue) {
      res.status(404).json({ detail: 'Issue not found' });
      return;
    }
    res.json(issue);
  }),
);

issuesRouter.delete(
  '/:id',
  requireAuth,
  requireDelete,
  wrap(async (req, res) => {
    const deleted = await softDeleteIssue(Number(req.params.id), req.auth!.orgId);
    if (!deleted) {
      res.status(404).json({ detail: 'Issue not found' });
      return;
    }
    res.status(204).end();
  }),
);
