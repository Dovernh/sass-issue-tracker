import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';

import { RteState, RteToolbar } from './rte-toolbar/rte-toolbar';

const EMPTY_STATE: RteState = {
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  bulletList: false,
  orderedList: false,
  link: false,
  block: 'paragraph',
  canUndo: false,
  canRedo: false,
};

@Component({
  selector: 'app-rich-text-editor',
  templateUrl: './rich-text-editor.html',
  styleUrl: './rich-text-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RteToolbar],
})
export class RichTextEditor implements FormValueControl<string> {
  readonly value = model<string>('');
  readonly disabled = input<boolean>(false);
  readonly label = input('Rich text editor');

  private readonly mount =
    viewChild.required<ElementRef<HTMLDivElement>>('mount');

  protected readonly editor = signal<Editor | undefined>(undefined);
  protected readonly state = signal<RteState>(EMPTY_STATE);

  constructor() {
    // Create the editor lazily and keep its content in step with the model.
    // Skipped when already in sync so the user's own edits don't reset the
    // cursor/history (the onUpdate -> value.set cycle short-circuits here).
    effect(() => {
      const html = this.value() ?? '';
      const editor = this.ensureEditor();
      if (editor.getHTML() === html) return;
      editor.commands.setContent(html, { emitUpdate: false });
      this.syncState(editor);
    });

    effect(() => this.editor()?.setEditable(!this.disabled()));

    inject(DestroyRef).onDestroy(() => this.editor()?.destroy());
  }

  private ensureEditor(): Editor {
    const existing = this.editor();
    if (existing) return existing;

    const editor = new Editor({
      element: this.mount().nativeElement,
      extensions: [
        StarterKit.configure({
          // Links open via the toolbar; auto-linking on paste/type is on.
          link: { openOnClick: false },
        }),
      ],
      editable: !this.disabled(),
      editorProps: {
        attributes: {
          role: 'textbox',
          'aria-multiline': 'true',
          'aria-label': this.label(),
          class: 'rte__content',
        },
      },
      onUpdate: ({ editor: e }) => {
        // Tiptap emits "<p></p>" for an empty doc; normalize that to ''.
        this.value.set(e.isEmpty ? '' : e.getHTML());
      },
      onSelectionUpdate: ({ editor: e }) => this.syncState(e),
      onTransaction: ({ editor: e }) => this.syncState(e),
    });

    this.editor.set(editor);
    return editor;
  }

  private syncState(editor: Editor): void {
    this.state.set({
      bold: editor.isActive('bold'),
      italic: editor.isActive('italic'),
      underline: editor.isActive('underline'),
      strike: editor.isActive('strike'),
      bulletList: editor.isActive('bulletList'),
      orderedList: editor.isActive('orderedList'),
      link: editor.isActive('link'),
      block: editor.isActive('heading', { level: 2 })
        ? 'h2'
        : editor.isActive('heading', { level: 3 })
          ? 'h3'
          : editor.isActive('blockquote')
            ? 'quote'
            : editor.isActive('codeBlock')
              ? 'code'
              : 'paragraph',
      canUndo: editor.can().undo(),
      canRedo: editor.can().redo(),
    });
  }
}
