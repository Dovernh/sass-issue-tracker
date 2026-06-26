import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RichTextEditor } from './rich-text-editor';

describe('RichTextEditor', () => {
  let component: RichTextEditor;
  let fixture: ComponentFixture<RichTextEditor>;
  let host: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RichTextEditor],
    }).compileComponents();

    fixture = TestBed.createComponent(RichTextEditor);
    component = fixture.componentInstance;
    host = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders the toolbar and an accessible editable region', () => {
    expect(host.querySelector('app-rte-toolbar')).not.toBeNull();
    const region = host.querySelector('.rte__content');
    expect(region?.getAttribute('role')).toBe('textbox');
    expect(region?.getAttribute('aria-multiline')).toBe('true');
  });

  it('renders the value set on the model', async () => {
    component.value.set('<p>Hello <strong>world</strong></p>');
    fixture.detectChanges();
    await fixture.whenStable();

    const content = host.querySelector('.rte__content');
    expect(content?.textContent).toContain('Hello world');
    expect(content?.querySelector('strong')).toBeTruthy();
  });

  it('uses the label as the aria-label of the editable region', async () => {
    // The label feeds the editor's accessible name when it is created, so set
    // it on a fresh component before the first render.
    const f = TestBed.createComponent(RichTextEditor);
    f.componentRef.setInput('label', 'Description');
    f.detectChanges();
    await f.whenStable();

    const region = (f.nativeElement as HTMLElement).querySelector('.rte__content');
    expect(region?.getAttribute('aria-label')).toBe('Description');
  });

  it('propagates the disabled state to the control and toolbar', async () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(host.querySelector('.rte--disabled')).toBeTruthy();
    expect(host.querySelector<HTMLButtonElement>('.rte-toolbar__btn')?.disabled).toBe(
      true,
    );
  });
});
