import { Router } from 'express';
import { requireAuth } from '../require-auth.js';
import { wrap } from '../middleware/async-handler.js';
import { getOrgsForUser, updateUserImage } from '../auth.repo.js';

export const meRouter = Router();

// Returns the verified identity — confirms end-to-end auth.
meRouter.get('/', requireAuth, (req, res) => {
  const auth = req.auth!;
  res.json({
    userId: auth.userId,
    orgId: auth.orgId,
    orgRole: auth.orgRole,
    orgPermissions: auth.orgPermissions,
    platformRole: auth.platformRole ?? null,
  });
});

// Orgs the caller belongs to (for the org switcher). The platform owner has no
// memberships, so this returns an empty list for them.
meRouter.get(
  '/orgs',
  requireAuth,
  wrap(async (req, res) => {
    res.json({ orgs: await getOrgsForUser(req.auth!.userId) });
  }),
);

/** Cap an avatar payload at ~1.5MB of data-URL text (well under the body limit). */
const MAX_IMAGE_LEN = 1_500_000;
const isImageRef = (v: unknown): v is string =>
  typeof v === 'string' && (v.startsWith('data:image/') || /^https?:\/\//.test(v));

// Update the signed-in user's avatar: stores the data URL verbatim in
// users.image_url and echoes it back.
meRouter.put(
  '/avatar',
  requireAuth,
  wrap(async (req, res) => {
    const { imageUrl } = req.body ?? {};
    if (!isImageRef(imageUrl)) {
      res.status(400).json({ detail: 'imageUrl must be a data: or http(s) image URL' });
      return;
    }
    if (imageUrl.length > MAX_IMAGE_LEN) {
      res.status(413).json({ detail: 'Image is too large' });
      return;
    }
    const user = await updateUserImage(req.auth!.userId, imageUrl);
    if (!user) {
      res.status(404).json({ detail: 'User not found' });
      return;
    }
    res.json({ imageUrl: user.imageUrl });
  }),
);
