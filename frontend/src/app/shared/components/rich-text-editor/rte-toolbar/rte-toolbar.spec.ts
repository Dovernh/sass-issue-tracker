import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';

import { RteState, RteToolbar } from './rte-toolbar';

const state = (over: Partial<RteState> = {}): RteState => ({
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
  ...over,
});

describe('RteToolbar', () => {
  let fixture: ComponentFixture<RteToolbar>;
  let host: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [RteToolbar] }).compileComponents();

    fixture = TestBed.createComponent(RteToolbar);
    fixture.componentRef.setInput('state', state());
    fixture.detectChanges();
    host = fixture.nativeElement as HTMLElement;
  });

  const byLabel = (label: string) =>
    host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('reflects active marks on the toolbar buttons', () => {
    fixture.componentRef.setInput('state', state({ bold: true }));
    fixture.detectChanges();

    expect(byLabel('Bold').getAttribute('aria-pressed')).toBe('true');
    expect(byLabel('Italic').getAttribute('aria-pressed')).toBe('false');
  });

  it('labels the block-style picker from the current block', () => {
    fixture.componentRef.setInput('state', state({ block: 'h2' }));
    fixture.detectChanges();

    const picker = host.querySelector('.rte-menu__trigger--toolbar');
    expect(picker?.textContent).toContain('Heading 2');
  });

  it('disables undo/redo when there is no history', () => {
    fixture.componentRef.setInput('state', state({ canUndo: false, canRedo: true }));
    fixture.detectChanges();

    expect(byLabel('Undo').disabled).toBe(true);
    expect(byLabel('Redo').disabled).toBe(false);
  });

  it('disables every control when disabled', () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();

    expect(byLabel('Bold').disabled).toBe(true);
    expect(host.querySelector<HTMLButtonElement>('.rte-menu__trigger')!.disabled).toBe(true);
  });

  it('dispatches a command to the bound editor', () => {
    const element = document.createElement('div');
    document.body.appendChild(element);
    const editor = new Editor({ element, extensions: [StarterKit], content: '<p>hello</p>' });
    editor.commands.selectAll();

    fixture.componentRef.setInput('editor', editor);
    fixture.detectChanges();

    byLabel('Bold').click();

    expect(editor.getHTML()).toContain('<strong>');

    editor.destroy();
    element.remove();
  });
});
