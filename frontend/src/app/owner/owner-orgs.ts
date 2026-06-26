import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import type { ColDef } from 'ag-grid-community';
import { map } from 'rxjs';

import { listResource } from '../api/list-resource';
import { type OrgAdmin, type OrgSummary } from '../api/proxies/issueTrackerAPI.schemas';
import { PlatformService } from '../api/proxies/platform/platform.service';
import { LanguageService } from '../core/language.service';
import { NotificationService } from '../core/notification.service';
import { ConfirmService } from '../shared/components/confirm/confirm.service';
import { Grid, type GridAction, type GridActionEvent } from '../shared/components/grid/grid';
import { Modal } from '../shared/components/modal/modal';

interface CreateModel {
  orgName: string;
  adminEmail: string;
  adminName: string;
  adminPassword: string;
}

interface AddAdminModel {
  email: string;
  name: string;
  password: string;
}

/**
 * Platform owner control plane: list/create orgs, rename, enable/disable, soft
 * delete, and manage each org's admins. Talks only to /api/platform/* — never
 * tenant data.
 */
@Component({
  selector: 'app-owner-orgs',
  imports: [Grid, Modal],
  templateUrl: './owner-orgs.html',
  styleUrl: './owner-orgs.scss',
})
export class OwnerOrgs {
  readonly #platform = inject(PlatformService);
  readonly #notify = inject(NotificationService);
  readonly #confirm = inject(ConfirmService);
  readonly #destroyRef = inject(DestroyRef);
  readonly #translate = inject(TranslateService);
  readonly #locale = inject(LanguageService);

  protected readonly orgs = listResource(() =>
    this.#platform.getOrgs().pipe(map((res) => res.orgs)),
  );

  // Built reactively so headers/labels re-resolve when the language changes.
  protected readonly columns = computed<ColDef<OrgSummary>[]>(() => {
    this.#locale.translation();
    const t = (k: string) => this.#translate.instant(k);
    return [
      { field: 'name', headerName: t('owner.organization'), flex: 2, minWidth: 160 },
      { field: 'status', headerName: t('common.status'), flex: 1, minWidth: 100 },
      { field: 'memberCount', headerName: t('owner.members'), flex: 1, minWidth: 100 },
      {
        headerName: t('owner.admins'),
        flex: 3,
        minWidth: 200,
        valueGetter: (p) => (p.data?.admins ?? []).map((a) => a.email).join(', '),
      },
      {
        field: 'createdAt',
        headerName: t('common.created'),
        flex: 1,
        minWidth: 120,
        valueFormatter: (p) => (p.value ? new Date(p.value).toLocaleDateString() : ''),
      },
    ];
  });

  protected readonly actions = computed<GridAction[]>(() => {
    this.#locale.translation();
    const t = (k: string) => this.#translate.instant(k);
    return [
      { id: 'rename', label: t('common.rename'), icon: 'bi-pencil' },
      { id: 'admins', label: t('owner.admins'), icon: 'bi-people' },
      { id: 'toggle', label: t('common.enableDisable'), icon: 'bi-toggle-on' },
      { id: 'delete', label: t('common.delete'), icon: 'bi-trash3', styleClass: 'grid-action--danger' },
    ];
  });

  // ── Create org ──────────────────────────────────────────────────────────────
  protected readonly createOpen = signal(false);
  protected readonly createModel = signal<CreateModel>({
    orgName: '',
    adminEmail: '',
    adminName: '',
    adminPassword: '',
  });
  protected readonly createError = signal('');
  protected readonly createValid = computed(() => {
    const m = this.createModel();
    return m.orgName.trim().length > 0 && m.adminEmail.trim().length > 0 && m.adminPassword.length >= 8;
  });

  // ── Rename ──────────────────────────────────────────────────────────────────
  protected readonly renaming = signal<OrgSummary | null>(null);
  protected readonly renameValue = signal('');
  protected readonly renameError = signal('');

  // ── Manage admins ───────────────────────────────────────────────────────────
  // Keyed by id (not snapshot) so the dialog reflects the reloaded list.
  readonly #managingId = signal<string | null>(null);
  protected readonly managing = computed(
    () => this.orgs.value().find((o) => o.id === this.#managingId()) ?? null,
  );
  protected readonly addAdmin = signal<AddAdminModel>({ email: '', name: '', password: '' });
  protected readonly addAdminError = signal('');
  protected readonly addAdminValid = computed(() => {
    const m = this.addAdmin();
    return m.email.trim().length > 0 && m.password.length >= 8;
  });

  protected onAction({ id, row }: GridActionEvent<OrgSummary>): void {
    if (id === 'rename') {
      this.renaming.set(row);
      this.renameValue.set(row.name);
      this.renameError.set('');
    } else if (id === 'admins') {
      this.addAdmin.set({ email: '', name: '', password: '' });
      this.addAdminError.set('');
      this.#managingId.set(row.id);
    } else if (id === 'toggle') {
      void this.toggleStatus(row);
    } else if (id === 'delete') {
      void this.confirmDelete(row);
    }
  }

  protected patchCreate<K extends keyof CreateModel>(key: K, value: CreateModel[K]): void {
    this.createModel.update((m) => ({ ...m, [key]: value }));
  }

  protected patchAdmin<K extends keyof AddAdminModel>(key: K, value: AddAdminModel[K]): void {
    this.addAdmin.update((m) => ({ ...m, [key]: value }));
  }

  protected closeManaging(): void {
    this.#managingId.set(null);
  }

  protected openCreate(): void {
    this.createModel.set({ orgName: '', adminEmail: '', adminName: '', adminPassword: '' });
    this.createError.set('');
    this.createOpen.set(true);
  }

  protected submitCreate(): void {
    const m = this.createModel();
    this.createError.set('');
    this.#platform
      .postOrg({
        orgName: m.orgName.trim(),
        adminEmail: m.adminEmail.trim(),
        adminName: m.adminName.trim() || undefined,
        adminPassword: m.adminPassword,
      })
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: () => {
          this.#notify.info('Organization created.');
          this.createOpen.set(false);
          this.orgs.reload();
        },
        error: (err) => this.createError.set(err?.error?.detail ?? 'Could not create organization.'),
      });
  }

  protected submitRename(): void {
    const org = this.renaming();
    if (!org) return;
    const name = this.renameValue().trim();
    if (!name) {
      this.renameError.set('Name is required.');
      return;
    }
    this.#platform
      .updateOrg(org.id, { name })
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: () => {
          this.#notify.info('Organization renamed.');
          this.renaming.set(null);
          this.orgs.reload();
        },
        error: (err) => this.renameError.set(err?.error?.detail ?? 'Could not rename organization.'),
      });
  }

  protected async toggleStatus(org: OrgSummary): Promise<void> {
    const disabling = org.status === 'active';
    const ok = await this.#confirm.confirm({
      title: disabling ? 'Disable organization' : 'Enable organization',
      message: disabling
        ? `Disable ${org.name}? Its members lose access immediately.`
        : `Enable ${org.name}? Its members regain access.`,
      confirmText: disabling ? 'Disable' : 'Enable',
      cancelText: 'Cancel',
      danger: disabling,
    });
    if (!ok) return;
    this.#platform
      .updateOrg(org.id, { status: disabling ? 'disabled' : 'active' })
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: () => {
          this.#notify.info(disabling ? 'Organization disabled.' : 'Organization enabled.');
          this.orgs.reload();
        },
        error: (err) => this.#notify.error(err?.error?.detail ?? 'Could not update status.'),
      });
  }

  protected async confirmDelete(org: OrgSummary): Promise<void> {
    const ok = await this.#confirm.confirm({
      title: 'Delete organization',
      message: `Delete ${org.name}? This revokes access for all its members.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      danger: true,
    });
    if (!ok) return;
    this.#platform
      .deleteOrg(org.id)
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: () => {
          this.#notify.info('Organization deleted.');
          this.orgs.reload();
        },
        error: (err) => this.#notify.error(err?.error?.detail ?? 'Could not delete organization.'),
      });
  }

  protected submitAddAdmin(): void {
    const org = this.managing();
    if (!org) return;
    const m = this.addAdmin();
    this.addAdminError.set('');
    this.#platform
      .postOrgAdmin(org.id, {
        email: m.email.trim(),
        name: m.name.trim() || undefined,
        password: m.password,
      })
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: () => {
          this.#notify.info('Admin added.');
          this.addAdmin.set({ email: '', name: '', password: '' });
          this.orgs.reload();
        },
        error: (err) => this.addAdminError.set(err?.error?.detail ?? 'Could not add admin.'),
      });
  }

  protected async removeAdmin(admin: OrgAdmin): Promise<void> {
    const org = this.managing();
    if (!org) return;
    const ok = await this.#confirm.confirm({
      title: 'Remove admin',
      message: `Remove ${admin.email} as an admin of ${org.name}?`,
      confirmText: 'Remove',
      cancelText: 'Cancel',
      danger: true,
    });
    if (!ok) return;
    this.#platform
      .deleteOrgAdmin(org.id, admin.userId)
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: () => {
          this.#notify.info('Admin removed.');
          this.orgs.reload();
        },
        error: (err) => this.#notify.error(err?.error?.detail ?? 'Could not remove admin.'),
      });
  }
}
