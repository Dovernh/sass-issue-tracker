import { Component, inject } from '@angular/core';

import { NotificationService } from '../core/notification.service';

@Component({
  selector: 'app-toast',
  template: `
    <div class="toasts" aria-live="polite">
      @for (toast of notify.toasts(); track toast.id) {
        <div class="toast toast--{{ toast.type }}" role="alert">
          <span class="toast__text">{{ toast.text }}</span>
          <button
            type="button"
            class="toast__close"
            aria-label="Dismiss"
            (click)="notify.dismiss(toast.id)"
          >
            <i class="bi bi-x-lg" aria-hidden="true"></i>
          </button>
        </div>
      }
    </div>
  `,
  styleUrl: './toast.scss',
})
export class Toast {
  protected readonly notify = inject(NotificationService);
}
