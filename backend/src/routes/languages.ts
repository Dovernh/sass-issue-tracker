import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../require-auth.js';
import { requireSettingsView, requireSettingsManage } from '../auth.js';
import { wrap } from '../middleware/async-handler.js';
import {
  listLanguages,
  listAllLanguages,
  createLanguage,
  updateLanguage,
  deleteLanguage,
  languageExists,
} from '../languages.repo.js';
import { NewLanguageSchema, LanguagePatchSchema } from '../schemas/languages.schema.js';

/**
 * An org's supported UI languages (tenant-scoped). The enabled list (`GET /`) is
 * authenticated but permission-less — any signed-in member needs it for the
 * switcher — and rate-limited. The admin views (`GET /all`, `PATCH /:code`) are
 * gated by org:settings:view / :manage.
 */

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { detail: 'Too many requests, try again later' },
});

export const languagesRouter = Router();

languagesRouter.get(
  '/',
  limiter,
  requireAuth,
  wrap(async (req, res) => {
    res.json({ languages: await listLanguages(req.auth!.orgId) });
  }),
);

languagesRouter.get(
  '/all',
  requireAuth,
  requireSettingsView,
  wrap(async (req, res) => {
    res.json({ languages: await listAllLanguages(req.auth!.orgId) });
  }),
);

languagesRouter.post(
  '/',
  requireAuth,
  requireSettingsManage,
  wrap(async (req, res) => {
    const parsed = NewLanguageSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ detail: parsed.error.issues[0]?.message ?? 'Invalid request' });
      return;
    }
    if (await languageExists(req.auth!.orgId, parsed.data.code)) {
      res.status(409).json({ detail: 'That language code already exists' });
      return;
    }
    const row = await createLanguage(req.auth!.orgId, parsed.data);
    res.status(201).json(row);
  }),
);

languagesRouter.patch(
  '/:code',
  requireAuth,
  requireSettingsManage,
  wrap(async (req, res) => {
    const parsed = LanguagePatchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ detail: parsed.error.issues[0]?.message ?? 'Invalid request' });
      return;
    }
    const row = await updateLanguage(req.auth!.orgId, req.params.code, parsed.data);
    if (!row) {
      res.status(404).json({ detail: 'Not found' });
      return;
    }
    res.json(row);
  }),
);

languagesRouter.delete(
  '/:code',
  requireAuth,
  requireSettingsManage,
  wrap(async (req, res) => {
    const removed = await deleteLanguage(req.auth!.orgId, req.params.code);
    if (!removed) {
      res.status(404).json({ detail: 'Not found' });
      return;
    }
    res.status(204).end();
  }),
);
