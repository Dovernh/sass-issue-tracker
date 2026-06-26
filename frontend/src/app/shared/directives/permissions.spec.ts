import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AuthService } from '../../auth/auth.service';
import { Permissions } from './permissions';

@Component({
  imports: [Permissions],
  template: `<span *appPermissions="'org:tasks:create'">content</span>`,
})
class Host {}

describe('Permissions', () => {
  function setup(perms: string[]): HTMLElement {
    TestBed.configureTestingModule({
      imports: [Host],
      providers: [{ provide: AuthService, useValue: { hasPermission: (p: string) => perms.includes(p) } }],
    });
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders content when the permission is granted', () => {
    expect(setup(['org:tasks:create']).textContent).toContain('content');
  });

  it('hides content when the permission is missing', () => {
    expect(setup(['org:tasks:view']).textContent).not.toContain('content');
  });
});
