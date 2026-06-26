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
import { Grid, type GridAction, type GridActionEvent } from '../../shared/components/grid/grid';
import { Modal } from '../../shared/components/modal/modal';
import { Permissions } from '../../shared/directives/permissions';

interface CreateModel {
  email: string;
  name: string;
  role: Role;
  password: string;
}

@Component({
  selector: 'app-admin-users',
  imports: [Grid, Modal, TranslatePipe, Permissions],
  templateUrl: './admin-users.html',
  styleUrl: './admin-users.scss',
})
export class AdminUsers {
  readonly #members = inject(MemberService);
  readonly #notify = inject(NotificationService);
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
        field: 'createdAt',
        headerName: t('common.joined'),
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
      { id: 'edit', label: t('common.edit'), icon: 'bi-pencil', permission: 'org:members:manage' },
      { id: 'resetpw', label: t('common.resetPassword'), icon: 'bi-key', permission: 'org:members:manage' },
    ];
  });

  // ── Create ────────────────────────────────────────────────────────────────
  protected readonly createOpen = signal(false);
  protected readonly createModel = signal<CreateModel>({ email: '', name: '', role: 'member', password: '' });
  protected readonly createError = signal('');

  // ── Edit ──────────────────────────────────────────────────────────────────
  protected readonly editing = signal<Member | null>(null);
  protected readonly editModel = signal<{ name: string; role: Role }>({ name: '', role: 'member' });
  protected readonly editError = signal('');

  // ── Reset password ──────────────────────────────────────────────────────────
  protected readonly resetting = signal<Member | null>(null);
  protected readonly resetPassword = signal('');
  protected readonly resetError = signal('');

  protected readonly createValid = computed(() => {
    const m = this.createModel();
    return m.email.trim().length > 0 && m.password.length >= 8;
  });

  protected onAction({ id, row }: GridActionEvent<Member>): void {
    if (id === 'edit') {
      this.editing.set(row);
      this.editModel.set({ name: row.name ?? '', role: row.role as Role });
      this.editError.set('');
    } else if (id === 'resetpw') {
      this.resetting.set(row);
      this.resetPassword.set('');
      this.resetError.set('');
    }
  }

  // Plain controlled inputs (no template-driven forms): patch the signal models.
  protected patchCreate<K extends keyof CreateModel>(key: K, value: CreateModel[K]): void {
    this.createModel.update((m) => ({ ...m, [key]: value }));
  }
  protected patchEdit<K extends 'name' | 'role'>(key: K, value: string): void {
    this.editModel.update((m) => ({ ...m, [key]: value }));
  }

  protected openCreate(): void {
    this.createModel.set({ email: '', name: '', role: 'member', password: '' });
    this.createError.set('');
    this.createOpen.set(true);
  }

  protected submitCreate(): void {
    const m = this.createModel();
    this.createError.set('');
    this.#members
      .postMember({
        email: m.email.trim(),
        name: m.name.trim() || undefined,
        role: m.role,
        password: m.password,
      })
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: () => {
          this.#notify.info('User created.');
          this.createOpen.set(false);
          this.members.reload();
        },
        error: (err) => this.createError.set(err?.error?.detail ?? 'Could not create user.'),
      });
  }

  protected submitEdit(): void {
    const member = this.editing();
    if (!member) return;
    const m = this.editModel();
    this.editError.set('');
    this.#members
      .updateMember(member.userId, { name: m.name.trim() || undefined, role: m.role })
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: () => {
          this.#notify.info('User updated.');
          this.editing.set(null);
          this.members.reload();
        },
        error: (err) => this.editError.set(err?.error?.detail ?? 'Could not update user.'),
      });
  }

  protected submitReset(): void {
    const member = this.resetting();
    if (!member) return;
    const pw = this.resetPassword();
    if (pw.length < 8) {
      this.resetError.set('Password must be at least 8 characters.');
      return;
    }
    this.#members
      .resetMemberPassword(member.userId, { password: pw })
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: () => {
          this.#notify.info('Password reset.');
          this.resetting.set(null);
        },
        error: (err) => this.resetError.set(err?.error?.detail ?? 'Could not reset password.'),
      });
  }
}
