import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { Editor } from '@tiptap/core';

import { RteMenu, RteMenuItem } from '../rte-menu/rte-menu';

/** Block style at the cursor; drives the "Formats" picker label. */
export type RteBlock = 'paragraph' | 'h2' | 'h3' | 'quote' | 'code';

/** Reactive snapshot of the editor's marks/blocks, for active highlighting. */
export interface RteState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  bulletList: boolean;
  orderedList: boolean;
  link: boolean;
  block: RteBlock;
  canUndo: boolean;
  canRedo: boolean;
}

const BLOCK_LABELS: Record<RteBlock, string> = {
  paragraph: 'Paragraph',
  h2: 'Heading 2',
  h3: 'Heading 3',
  quote: 'Quote',
  code: 'Code block',
};

/**
 * Presentation + command dispatch for the rich-text editor. A TinyMCE-style
 * menubar ("Format", "Insert") sits above a toolbar row (undo/redo, a block
 * style picker, inline marks, lists, and link). It reads `state` for active
 * highlighting and runs commands against the bound Tiptap `editor`.
 */
@Component({
  selector: 'app-rte-toolbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RteMenu],
  templateUrl: './rte-toolbar.html',
  styleUrl: './rte-toolbar.scss',
})
export class RteToolbar {
  readonly editor = input<Editor | undefined>(undefined);
  readonly state = input.required<RteState>();
  readonly disabled = input(false);
  /** Names the toolbar for assistive tech, e.g. "Description formatting". */
  readonly label = input('Rich text');

  readonly #document = inject(DOCUMENT);

  protected readonly blockLabel = computed(() => BLOCK_LABELS[this.state().block]);

  /** The menubar "Format" menu: marks, block styles, and clear formatting. */
  protected readonly formatItems = computed<RteMenuItem[]>(() => {
    const s = this.state();
    return [
      { label: 'Bold', icon: 'bi-type-bold', shortcut: '⌘B', isActive: s.bold, run: () => this.toggleBold() },
      { label: 'Italic', icon: 'bi-type-italic', shortcut: '⌘I', isActive: s.italic, run: () => this.toggleItalic() },
      { label: 'Underline', icon: 'bi-type-underline', shortcut: '⌘U', isActive: s.underline, run: () => this.toggleUnderline() },
      { label: 'Strikethrough', icon: 'bi-type-strikethrough', isActive: s.strike, run: () => this.toggleStrike() },
      { label: 'Paragraph', separatorBefore: true, isActive: s.block === 'paragraph', run: () => this.setParagraph() },
      { label: 'Heading 2', isActive: s.block === 'h2', run: () => this.setHeading(2) },
      { label: 'Heading 3', isActive: s.block === 'h3', run: () => this.setHeading(3) },
      { label: 'Quote', icon: 'bi-blockquote-left', isActive: s.block === 'quote', run: () => this.toggleBlockquote() },
      { label: 'Code block', icon: 'bi-code-square', isActive: s.block === 'code', run: () => this.toggleCodeBlock() },
      { label: 'Clear formatting', icon: 'bi-eraser', separatorBefore: true, run: () => this.clearFormatting() },
    ];
  });

  /** The menubar "Insert" menu. */
  protected readonly insertItems = computed<RteMenuItem[]>(() => {
    const s = this.state();
    return [
      { label: s.link ? 'Edit link…' : 'Link…', icon: 'bi-link-45deg', isActive: s.link, run: () => this.setLink() },
      { label: 'Horizontal rule', icon: 'bi-dash-lg', separatorBefore: true, run: () => this.insertHorizontalRule() },
    ];
  });

  /** The toolbar "Formats" picker: switch the current block's style. */
  protected readonly styleItems = computed<RteMenuItem[]>(() => {
    const s = this.state();
    return [
      { label: 'Paragraph', isActive: s.block === 'paragraph', run: () => this.setParagraph() },
      { label: 'Heading 2', isActive: s.block === 'h2', run: () => this.setHeading(2) },
      { label: 'Heading 3', isActive: s.block === 'h3', run: () => this.setHeading(3) },
      { label: 'Quote', isActive: s.block === 'quote', run: () => this.toggleBlockquote() },
      { label: 'Code block', isActive: s.block === 'code', run: () => this.toggleCodeBlock() },
    ];
  });

  /** Start a command chain that re-focuses the editor first; undefined if no editor. */
  #chain() {
    return this.editor()?.chain().focus();
  }

  protected undo(): void {
    this.#chain()?.undo().run();
  }

  protected redo(): void {
    this.#chain()?.redo().run();
  }

  protected toggleBold(): void {
    this.#chain()?.toggleBold().run();
  }

  protected toggleItalic(): void {
    this.#chain()?.toggleItalic().run();
  }

  protected toggleUnderline(): void {
    this.#chain()?.toggleUnderline().run();
  }

  protected toggleStrike(): void {
    this.#chain()?.toggleStrike().run();
  }

  protected setParagraph(): void {
    this.#chain()?.setParagraph().run();
  }

  protected setHeading(level: 2 | 3): void {
    this.#chain()?.toggleHeading({ level }).run();
  }

  protected toggleBlockquote(): void {
    this.#chain()?.toggleBlockquote().run();
  }

  protected toggleCodeBlock(): void {
    this.#chain()?.toggleCodeBlock().run();
  }

  protected toggleBulletList(): void {
    this.#chain()?.toggleBulletList().run();
  }

  protected toggleOrderedList(): void {
    this.#chain()?.toggleOrderedList().run();
  }

  protected clearFormatting(): void {
    this.#chain()?.unsetAllMarks().clearNodes().run();
  }

  protected insertHorizontalRule(): void {
    this.#chain()?.setHorizontalRule().run();
  }

  /** Prompt for a URL and toggle a link on the selection (empty clears it). */
  protected setLink(): void {
    const editor = this.editor();
    if (!editor) return;

    const previous = (editor.getAttributes('link')['href'] as string) ?? '';
    const url = this.#document.defaultView?.prompt('Link URL', previous);
    if (url === null || url === undefined) return; // cancelled

    const chain = editor.chain().focus().extendMarkRange('link');
    if (url === '') {
      chain.unsetLink().run();
    } else {
      chain.setLink({ href: url }).run();
    }
  }
}
