import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RteMenu, RteMenuItem } from './rte-menu';

describe('RteMenu', () => {
  let fixture: ComponentFixture<RteMenu>;
  let host: HTMLElement;
  let ran: string[];

  const items = (): RteMenuItem[] => [
    { label: 'Heading 2', isActive: true, run: () => ran.push('h2') },
    { label: 'Quote', separatorBefore: true, run: () => ran.push('quote') },
  ];

  beforeEach(async () => {
    ran = [];
    await TestBed.configureTestingModule({ imports: [RteMenu] }).compileComponents();

    fixture = TestBed.createComponent(RteMenu);
    fixture.componentRef.setInput('label', 'Format');
    fixture.componentRef.setInput('items', items());
    fixture.detectChanges();
    host = fixture.nativeElement as HTMLElement;
  });

  const trigger = () => host.querySelector<HTMLButtonElement>('.rte-menu__trigger')!;
  const menu = () => host.querySelector('[role="menu"]');

  it('starts closed with a collapsed trigger', () => {
    expect(menu()).toBeNull();
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(trigger().getAttribute('aria-haspopup')).toBe('menu');
  });

  it('opens the popup on trigger click', () => {
    trigger().click();
    fixture.detectChanges();

    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(menu()).not.toBeNull();
    expect(host.querySelectorAll('[role="menuitem"]').length).toBe(2);
  });

  it('marks active items and renders separators', () => {
    trigger().click();
    fixture.detectChanges();

    const active = host.querySelector('.rte-menu__item--active');
    expect(active?.textContent).toContain('Heading 2');
    expect(host.querySelector('.rte-menu__separator')).not.toBeNull();
  });

  it('runs an item action and closes when selected', () => {
    trigger().click();
    fixture.detectChanges();

    host.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')[1].click();
    fixture.detectChanges();

    expect(ran).toEqual(['quote']);
    expect(menu()).toBeNull();
  });

  it('closes on Escape', () => {
    trigger().click();
    fixture.detectChanges();

    trigger().dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    fixture.detectChanges();

    expect(menu()).toBeNull();
  });
});
