import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import type { ColDef } from 'ag-grid-community';
import { map } from 'rxjs';

import { listResource } from '../../api/list-resource';
import { type Member,Role } from '../../api/proxies/issueTrackerAPI.schemas';
import { MemberService } from '../../api/proxies/member/member.service';
import { LanguageService } from '../../core/language.service';
import { NotificationService } from '../../core/notification.service';
import { ConfirmService } from '../../shared/components/confirm/confirm.service';
import { Grid, type GridAction, type GridActionEvent } from '../../shared/components/grid/grid';
import { Modal } from '../../shared/components/modal/modal';

@Component({
  selector: 'app-admin-permissions',
  imports: [Grid, Modal, TranslatePipe],
  templateUrl: './admin-permissions.html',
  styleUrl: './admin-permissions.scss',
})
export class AdminPermissions {
  readonly #members = inject(MemberService);
  readonly #notify = inject(NotificationService);
  readonly #confirm = inject(ConfirmService);
  readonly #destroyRef = inject(DestroyRef);
  readonly #translate = inject(TranslateService);
  readonly #locale = inject(LanguageService);

  protected readonly roles = Object.values(Role);
  protected readonly members = listResource(() =>
    this.#members.getMembers().pipe(map((res) => res.members)),
  );

  // Built reactively so headers/labels re-resolve when the language changes.
  protected readonly columns = computed<ColDef<Member>[]>(() => {
    this.#locale.translation();
    const t = (k: string) => this.#translate.instant(k);
    return [
      { field: 'name', headerName: t('common.name'), flex: 2, minWidth: 140, valueFormatter: (p) => p.value ?? '—' },
      { field: 'email', headerName: t('common.email'), flex: 3, minWidth: 200 },
      { field: 'role', headerName: t('common.role'), flex: 1, minWidth: 110 },
      {
        colId: 'permCount',
        headerName: t('admin.permissions'),
        flex: 1,
        minWidth: 120,
        valueGetter: (p) => p.data?.permissions.length ?? 0,
      },
    ];
  });

  protected readonly actions = computed<GridAction[]>(() => {
    this.#locale.translation();
    const t = (k: string) => this.#translate.instant(k);
    return [
      { id: 'view', label: t('common.view'), icon: 'bi-eye' },
      { id: 'edit', label: t('common.edit'), icon: 'bi-pencil', permission: 'org:members:manage' },
      { id: 'delete', label: t('common.delete'), icon: 'bi-trash3', styleClass: 'grid-action--danger', permission: 'org:members:manage' },
    ];
  });

  protected readonly viewing = signal<Member | null>(null);
  protected readonly editing = signal<Member | null>(null);
  protected readonly editRole = signal<Role>('member');

  protected onAction({ id, row }: GridActionEvent<Member>): void {
    if (id === 'view') {
      this.viewing.set(row);
    } else if (id === 'edit') {
      this.editRole.set(row.role as Role);
      this.editing.set(row);
    } else if (id === 'delete') {
      void this.remove(row);
    }
  }

  protected saveEdit(): void {
    const member = this.editing();
    if (!member) return;
    this.#members
      .updateMember(member.userId, { role: this.editRole() })
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: () => {
          this.#notify.info('Role updated.');
          this.editing.set(null);
          this.members.reload();
        },
        error: (err) => this.#notify.error(err?.error?.detail ?? 'Could not update role.'),
      });
  }

  async remove(member: Member): Promise<void> {
    const ok = await this.#confirm.confirm({
      title: 'Remove member',
      message: `Remove ${member.name || member.email} from this organization?`,
      confirmText: 'Remove',
      cancelText: 'Cancel',
      danger: true,
    });
    if (!ok) return;
    this.#members
      .deleteMember(member.userId)
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: () => {
          this.#notify.info('Member removed.');
          this.members.reload();
        },
        error: (err) => this.#notify.error(err?.error?.detail ?? 'Could not remove member.'),
      });
  }
}
