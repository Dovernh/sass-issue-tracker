import type { RequestHandler } from 'express';

/**
 * Auth types and permission guards. Identity is attached to `req.auth` by the
 * provider middleware (`localAuth`, wired via `require-auth.ts`); the guards
 * below run after it to enforce org permissions on a route.
 */

export interface AuthUser {
  userId: string;
  orgId: string;
  orgRole: string;
  orgPermissions: string[];
  /** 'owner' for the platform operator (no org context); undefined otherwise. */
  platformRole?: string;
  has(permission: string): boolean;
}

const PERMS = {
  dashboardView: 'org:dashboard:view',
  view: 'org:tasks:view',
  create: 'org:tasks:create',
  delete: 'org:tasks:delete',
  edit: 'org:tasks:edit',
  membersView: 'org:members:view',
  membersManage: 'org:members:manage',
  settingsView: 'org:settings:view',
  settingsManage: 'org:settings:manage',
} as const;

/** Factory for the require_* guards. Run after the auth middleware. */
function requirePermission(permission: string, label: string): RequestHandler {
  return (req, res, next) => {
    if (!req.auth?.has(permission)) {
      res.status(403).json({ detail: `${label} permission required` });
      return;
    }
    next();
  };
}

export const requireDashboardView = requirePermission(PERMS.dashboardView, 'Dashboard view');
export const requireView = requirePermission(PERMS.view, 'View');
export const requireCreate = requirePermission(PERMS.create, 'Create');
export const requireDelete = requirePermission(PERMS.delete, 'Delete');
export const requireEdit = requirePermission(PERMS.edit, 'Edit');
export const requireMembersView = requirePermission(PERMS.membersView, 'Members view');
export const requireMembersManage = requirePermission(PERMS.membersManage, 'Members manage');
export const requireSettingsView = requirePermission(PERMS.settingsView, 'Settings view');
export const requireSettingsManage = requirePermission(PERMS.settingsManage, 'Settings manage');

/**
 * Platform-owner guard (control plane). The owner has `platformRole === 'owner'`
 * and no org context, so they pass here but FAIL every org permission guard —
 * which is exactly the "owner can never read tenant data" boundary.
 */
export const requirePlatformOwner: RequestHandler = (req, res, next) => {
  if (req.auth?.platformRole !== 'owner') {
    res.status(403).json({ detail: 'Platform owner only' });
    return;
  }
  next();
};
