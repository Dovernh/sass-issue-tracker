import { Router } from 'express';
import { requireAuth } from '../require-auth.js';
import { requireView, requireSettingsManage } from '../auth.js';
import { wrap } from '../middleware/async-handler.js';
import {
  listPriorities,
  createPriority,
  updatePriority,
  deletePriority,
} from '../priorities.repo.js';
import { NewPrioritySchema, PriorityPatchSchema } from '../schemas/options.schema.js';

/**
 * CRUD for the org's issue-priority option list. Read is gated by
 * org:tasks:view — these labels are reference data needed to render issues, so
 * any member who can view issues can read them; writes by org:settings:manage.
 * All org-scoped client data — every option is editable/removable.
 */

export const prioritiesRouter = Router();

prioritiesRouter.get(
  '/',
  requireAuth,
  requireView,
  wrap(async (req, res) => {
    res.json({ priorities: await listPriorities(req.auth!.orgId) });
  }),
);

prioritiesRouter.post(
  '/',
  requireAuth,
  requireSettingsManage,
  wrap(async (req, res) => {
    const parsed = NewPrioritySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ detail: parsed.error.issues[0]?.message ?? 'Invalid request' });
      return;
    }
    const item = await createPriority(req.auth!.orgId, parsed.data);
    res.status(201).json(item);
  }),
);

prioritiesRouter.patch(
  '/:id',
  requireAuth,
  requireSettingsManage,
  wrap(async (req, res) => {
    const parsed = PriorityPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ detail: parsed.error.issues[0]?.message ?? 'Invalid request' });
      return;
    }
    const item = await updatePriority(Number(req.params.id), req.auth!.orgId, parsed.data);
    if (!item) {
      res.status(404).json({ detail: 'Not found' });
      return;
    }
    res.json(item);
  }),
);

prioritiesRouter.delete(
  '/:id',
  requireAuth,
  requireSettingsManage,
  wrap(async (req, res) => {
    const removed = await deletePriority(Number(req.params.id), req.auth!.orgId);
    if (!removed) {
      res.status(404).json({ detail: 'Not found' });
      return;
    }
    res.status(204).end();
  }),
);
