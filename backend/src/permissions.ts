/**
 * Org permission strings and role presets for self-owned auth.
 *
 * These are the strings the guards in auth.ts (`requireView/Create/Edit/Delete`,
 * etc.) check: a membership stores a subset of them, and `req.auth.has()`
 * resolves a route against that subset.
 */
export const PERMS = {
  // Read-only access to the dashboard (charts/aggregates).
  dashboardView: 'org:dashboard:view',
  view: 'org:tasks:view',
  create: 'org:tasks:create',
  edit: 'org:tasks:edit',
  delete: 'org:tasks:delete',
  // Admin: member management (users + their roles/permissions).
  membersView: 'org:members:view',
  membersManage: 'org:members:manage',
  // Admin: org settings (priority / category option lists).
  settingsView: 'org:settings:view',
  settingsManage: 'org:settings:manage',
} as const;

export type Permission = (typeof PERMS)[keyof typeof PERMS];

export const ALL_PERMISSIONS: Permission[] = Object.values(PERMS);

/**
 * Permissions an admin may grant the org's `member` role via the editable
 * member-role template (organizations.member_permissions). The two `*:manage`
 * permissions are intentionally excluded — they're admin-tier, and granting one
 * is equivalent to making someone an admin (assign the admin role instead).
 */
export const MEMBER_TEMPLATE_PERMISSIONS: Permission[] = [
  PERMS.dashboardView,
  PERMS.view,
  PERMS.create,
  PERMS.edit,
  PERMS.delete,
  PERMS.membersView,
  PERMS.settingsView,
];

/** Default permission set for a freshly-seeded org's `member` role template. */
export const DEFAULT_MEMBER_PERMISSIONS: Permission[] = [
  PERMS.dashboardView,
  PERMS.view,
  PERMS.create,
  PERMS.edit,
];

/**
 * Platform-plane permissions (SaaS control plane). Held only by the platform
 * owner (users.platform_role = 'owner'), never by org memberships. The owner
 * manages orgs/admins via these and can never reach tenant data (org:* perms).
 */
export const PLATFORM_PERMS = {
  orgsView: 'platform:orgs:view',
  orgsManage: 'platform:orgs:manage',
} as const;

export type PlatformPermission = (typeof PLATFORM_PERMS)[keyof typeof PLATFORM_PERMS];

export const ALL_PLATFORM_PERMISSIONS: PlatformPermission[] = Object.values(PLATFORM_PERMS);

/**
 * Org-assignable roles. `admin` is the top org role; the platform `owner` lives
 * on the platform plane (users.platform_role), not as an org membership, so it's
 * not assignable here. (Legacy `owner` memberships still map in ROLE_PERMISSIONS.)
 */
export const ROLES = ['admin', 'member', 'viewer'] as const;
export type Role = (typeof ROLES)[number];

/**
 * Permission sets per membership role. `admin` (and the legacy `owner` alias) get
 * everything; `viewer` is a fixed read-only role. `member` is special: its
 * permissions are NOT fixed here — they come from the org's editable member-role
 * template (see effectivePermissions). The `member` entry below is only the seed
 * default used when an org is first created.
 */
export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  owner: ALL_PERMISSIONS,
  admin: ALL_PERMISSIONS,
  member: DEFAULT_MEMBER_PERMISSIONS,
  viewer: [PERMS.dashboardView, PERMS.view],
};

/** Seed permissions for a role, falling back to the most restrictive set. */
export function permissionsForRole(role: string): Permission[] {
  return ROLE_PERMISSIONS[role] ?? ROLE_PERMISSIONS.viewer;
}

/**
 * Effective permissions for a membership. admin/owner → everything; viewer → the
 * fixed read-only set; member → the org's member-role template (or the default
 * if the org hasn't customized it). This is the single source of truth for what
 * a membership can do, resolved per request so template edits apply immediately.
 */
export function effectivePermissions(
  role: string,
  memberTemplate: string[] | null | undefined,
): string[] {
  if (role === 'owner' || role === 'admin') return ALL_PERMISSIONS;
  if (role === 'viewer') return ROLE_PERMISSIONS.viewer;
  return memberTemplate ?? DEFAULT_MEMBER_PERMISSIONS;
}

/** Keep only valid, admin-grantable member-template permissions (dedup'd). */
export function sanitizeMemberTemplate(permissions: unknown): Permission[] {
  if (!Array.isArray(permissions)) return [];
  const allowed = new Set<string>(MEMBER_TEMPLATE_PERMISSIONS);
  return MEMBER_TEMPLATE_PERMISSIONS.filter((p) => permissions.includes(p) && allowed.has(p));
}
