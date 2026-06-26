import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';

import { OwnerOrgs } from './owner-orgs';

describe('OwnerOrgs', () => {
  let component: OwnerOrgs;
  let fixture: ComponentFixture<OwnerOrgs>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OwnerOrgs],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideTranslateService()],
    }).compileComponents();

    fixture = TestBed.createComponent(OwnerOrgs);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
