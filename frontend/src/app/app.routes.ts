import { Routes } from '@angular/router';

import { orgContextGuard,ownerGuard } from './auth/owner.guard';
import { permGuard } from './auth/perm.guard';

/**
 * App routes. The router outlet is only rendered when signed in (see app.html),
 * so these are the authenticated views. Org-scoped views redirect the platform
 * owner to their control-plane area; admin is additionally permission-gated.
 * Feature views are lazy-loaded.
 */
export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'dashboard',
    canActivate: [orgContextGuard, permGuard('org:dashboard:view', '/issues')],
    loadComponent: () => import('./dashboard/dashboard').then((m) => m.Dashboard),
  },
  {
    path: 'issues',
    canActivate: [orgContextGuard],
    loadComponent: () => import('./issues/issues').then((m) => m.Issues),
  },
  {
    path: 'owner',
    canActivate: [ownerGuard],
    loadComponent: () => import('./owner/owner-orgs').then((m) => m.OwnerOrgs),
  },
  {
    path: 'admin',
    canActivate: [orgContextGuard, permGuard('org:members:view')],
    loadComponent: () => import('./admin/admin').then((m) => m.Admin),
    children: [
      { path: '', redirectTo: 'users', pathMatch: 'full' },
      {
        path: 'users',
        loadComponent: () => import('./admin/users/admin-users').then((m) => m.AdminUsers),
      },
      {
        path: 'permissions',
        loadComponent: () =>
          import('./admin/permissions/admin-permissions').then((m) => m.AdminPermissions),
      },
      {
        path: 'priority',
        loadComponent: () => import('./admin/priority/admin-priority').then((m) => m.AdminPriority),
      },
      {
        path: 'category',
        loadComponent: () => import('./admin/category/admin-category').then((m) => m.AdminCategory),
      },
      {
        path: 'language',
        loadComponent: () => import('./admin/language/admin-language').then((m) => m.AdminLanguage),
      },
      {
        path: 'roles',
        loadComponent: () => import('./admin/roles/admin-roles').then((m) => m.AdminRoles),
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
