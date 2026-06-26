import {
  Component,
  effect,
  ElementRef,
  input,
  output,
  viewChild,
} from '@angular/core';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

@Component({
  selector: 'app-modal',
  template: `
    <!-- Native <dialog> handles Escape/focus; the click is only backdrop-dismissal. -->
    <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -->
    <dialog
      #dialog
      class="modal"
      aria-modal="true"
      [attr.aria-label]="label()"
      (close)="closed.emit()"
      (cancel)="onCancel($event)"
      (click)="onBackdropClick($event)"
    >
      <div class="modal__panel" [class]="'modal__panel--' + size()">
        @if (dismissable()) {
          <button
            type="button"
            class="modal__close"
            aria-label="Close dialog"
            (click)="closed.emit()"
          >
            <i class="bi bi-x-lg" aria-hidden="true"></i>
          </button>
        }
        <ng-content />
      </div>
    </dialog>
  `,
  styleUrl: './modal.scss',
})
export class Modal {
  readonly open = input(false);
  readonly label = input('Dialog');
  readonly dismissable = input(true);
  readonly size = input<ModalSize>('lg');
  readonly closed = output<void>();

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    effect(() => {
      const dialog = this.dialog().nativeElement;

      if (this.open()) {
        if (!dialog.open) dialog.showModal();
      } else if (dialog.open) {
        dialog.close();
      }
    });
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (!this.dismissable()) return;
    if (event.target === this.dialog().nativeElement) {
      this.closed.emit();
    }
  }

  protected onCancel(event: Event): void {
    if (!this.dismissable()) {
      event.preventDefault();
    }
  }
}
