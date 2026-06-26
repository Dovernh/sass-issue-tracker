import { Component, inject } from '@angular/core';

import { Modal } from '../../components/modal/modal';
import { ConfirmService } from './confirm.service';

/**
 * Renders the active confirmation prompt from ConfirmService. Mount once in the
 * app shell. Two-button when `cancelText` is set; single OK-style button
 * otherwise. Escape/backdrop cancel only when a cancel action exists.
 */
@Component({
  selector: 'app-confirm-dialog',
  imports: [Modal],
  template: `
    @if (confirm.request(); as req) {
      <app-modal
        [open]="true"
        size="sm"
        [dismissable]="!!req.cancelText"
        [label]="req.title ?? 'Confirm'"
        (closed)="respond(false)"
      >
        <div class="confirm">
          @if (req.title) {
            <h2 class="confirm__title">{{ req.title }}</h2>
          }
          <p class="confirm__message">{{ req.message }}</p>
          <div class="confirm__actions">
            @if (req.cancelText) {
              <button type="button" class="btn btn--ghost" (click)="respond(false)">
                {{ req.cancelText }}
              </button>
            }
            <button
              type="button"
              class="btn"
              [class.btn--danger]="req.danger"
              [class.btn--primary]="!req.danger"
              (click)="respond(true)"
            >
              {{ req.confirmText ?? 'OK' }}
            </button>
          </div>
        </div>
      </app-modal>
    }
  `,
  styles: `
    .confirm {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .confirm__title {
      margin: 0;
      font-size: 1.2rem;
    }
    .confirm__message {
      margin: 0;
      color: var(--app-text);
    }
    .confirm__actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.6rem;
      margin-top: 0.25rem;
    }
    .btn--danger {
      background: var(--app-danger);
      border-color: var(--app-danger);
      color: #fff;
    }
  `,
})
export class ConfirmDialog {
  protected readonly confirm = inject(ConfirmService);

  protected respond(result: boolean): void {
    this.confirm.resolve(result);
  }
}
