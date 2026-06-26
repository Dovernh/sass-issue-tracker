import { Router } from 'express';
import { requireAuth } from '../require-auth.js';
import { requireView, requireSettingsManage } from '../auth.js';
import { wrap } from '../middleware/async-handler.js';
import {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../categories.repo.js';
import { NewCategorySchema, CategoryPatchSchema } from '../schemas/options.schema.js';

/**
 * CRUD for the org's issue-category option list. Read is gated by
 * org:tasks:view — these labels are reference data needed to render issues, so
 * any member who can view issues can read them; writes by org:settings:manage.
 * All org-scoped client data — every option is editable/removable.
 */

export const categoriesRouter = Router();

categoriesRouter.get(
  '/',
  requireAuth,
  requireView,
  wrap(async (req, res) => {
    res.json({ categories: await listCategories(req.auth!.orgId) });
  }),
);

categoriesRouter.post(
  '/',
  requireAuth,
  requireSettingsManage,
  wrap(async (req, res) => {
    const parsed = NewCategorySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ detail: parsed.error.issues[0]?.message ?? 'Invalid request' });
      return;
    }
    const item = await createCategory(req.auth!.orgId, parsed.data);
    res.status(201).json(item);
  }),
);

categoriesRouter.patch(
  '/:id',
  requireAuth,
  requireSettingsManage,
  wrap(async (req, res) => {
    const parsed = CategoryPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ detail: parsed.error.issues[0]?.message ?? 'Invalid request' });
      return;
    }
    const item = await updateCategory(Number(req.params.id), req.auth!.orgId, parsed.data);
    if (!item) {
      res.status(404).json({ detail: 'Not found' });
      return;
    }
    res.json(item);
  }),
);

categoriesRouter.delete(
  '/:id',
  requireAuth,
  requireSettingsManage,
  wrap(async (req, res) => {
    const removed = await deleteCategory(Number(req.params.id), req.auth!.orgId);
    if (!removed) {
      res.status(404).json({ detail: 'Not found' });
      return;
    }
    res.status(204).end();
  }),
);
