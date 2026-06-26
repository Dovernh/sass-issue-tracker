import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { RoleService } from '../../api/proxies/role/role.service';
import { NotificationService } from '../../core/notification.service';
import { Permissions } from '../../shared/directives/permissions';

/**
 * Admin → Roles. Edits the org's `member` role permission template. admin (full
 * access) and viewer (read-only) are fixed in code, so only the member role is
 * customizable here. Changes apply to every member on their next request.
 */
@Component({
  selector: 'app-admin-roles',
  imports: [TranslatePipe, Permissions],
  templateUrl: './admin-roles.html',
  styleUrl: './admin-roles.scss',
})
export class AdminRoles {
  readonly #roles = inject(RoleService);
  readonly #notify = inject(NotificationService);
  readonly #translate = inject(TranslateService);
  readonly #destroyRef = inject(DestroyRef);

  /** Permission strings an admin may toggle for the member role. */
  protected readonly available = signal<string[]>([]);
  /** Currently-granted permissions for the member role (working copy). */
  protected readonly granted = signal<Set<string>>(new Set());
  /** Last loaded/saved state, used to revert on Cancel + detect changes. */
  readonly #initial = signal<Set<string>>(new Set());
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal(false);

  /** True when the working copy differs from the last loaded/saved state. */
  protected readonly dirty = computed(() => {
    const a = this.granted();
    const b = this.#initial();
    return a.size !== b.size || [...a].some((p) => !b.has(p));
  });

  // Permission string → i18n label key (defined in the i18n files under `roles`).
  readonly #labelKeys: Record<string, string> = {
    'org:dashboard:view': 'roles.permDashboardView',
    'org:tasks:view': 'roles.permTasksView',
    'org:tasks:create': 'roles.permTasksCreate',
    'org:tasks:edit': 'roles.permTasksEdit',
    'org:tasks:delete': 'roles.permTasksDelete',
    'org:members:view': 'roles.permMembersView',
    'org:settings:view': 'roles.permSettingsView',
  };

  constructor() {
    this.#roles
      .getMemberRole()
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: (r) => {
          this.available.set(r.available);
          this.granted.set(new Set(r.permissions));
          this.#initial.set(new Set(r.permissions));
          this.loading.set(false);
        },
        error: () => {
          this.error.set(true);
          this.loading.set(false);
        },
      });
  }

  protected labelKey(permission: string): string {
    return this.#labelKeys[permission] ?? permission;
  }

  protected isGranted(permission: string): boolean {
    return this.granted().has(permission);
  }

  protected toggle(permission: string, checked: boolean): void {
    this.granted.update((set) => {
      const next = new Set(set);
      if (checked) next.add(permission);
      else next.delete(permission);
      return next;
    });
  }

  /** Discard unsaved edits, reverting to the last loaded/saved state. */
  protected cancel(): void {
    this.granted.set(new Set(this.#initial()));
  }

  protected save(): void {
    this.saving.set(true);
    this.#roles
      .updateMemberRole({ permissions: [...this.granted()] })
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: (r) => {
          this.granted.set(new Set(r.permissions));
          this.#initial.set(new Set(r.permissions));
          this.saving.set(false);
          this.#notify.success(this.#translate.instant('roles.saved'));
        },
        error: () => {
          this.saving.set(false);
          this.#notify.error(this.#translate.instant('roles.saveError'));
        },
      });
  }
}
