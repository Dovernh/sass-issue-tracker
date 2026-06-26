import { Injectable, signal } from '@angular/core';

export type ToastType = 'error' | 'success' | 'info';

export interface Toast {
  id: number;
  text: string;
  type: ToastType;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  readonly #toasts = signal<Toast[]>([]);
  readonly toasts = this.#toasts.asReadonly();
  #seq = 0;

  show(text: string, type: ToastType = 'info', ttl = 6000): void {
    const id = ++this.#seq;
    this.#toasts.update((list) => [...list, { id, text, type }]);
    if (ttl > 0) {
      setTimeout(() => this.dismiss(id), ttl);
    }
  }

  error(text: string): void {
    this.show(text, 'error');
  }

  success(text: string): void {
    this.show(text, 'success');
  }

  info(text: string): void {
    this.show(text, 'info');
  }

  dismiss(id: number): void {
    this.#toasts.update((list) => list.filter((t) => t.id !== id));
  }
}
