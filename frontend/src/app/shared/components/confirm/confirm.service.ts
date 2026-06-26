import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  title?: string;
  message: string;
  /** Confirm button label. Default: 'OK'. */
  confirmText?: string;
  /** Cancel button label. Omit/undefined for an OK-only dialog. */
  cancelText?: string;
  /** Style the confirm button as destructive. */
  danger?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly #request = signal<ConfirmOptions | null>(null);
  #resolver: ((result: boolean) => void) | null = null;

  readonly request = this.#request.asReadonly();

  confirm(options: ConfirmOptions): Promise<boolean> {
    this.#resolver?.(false);
    this.#request.set(options);
    return new Promise<boolean>((resolve) => {
      this.#resolver = resolve;
    });
  }

  resolve(result: boolean): void {
    this.#request.set(null);
    this.#resolver?.(result);
    this.#resolver = null;
  }
}
