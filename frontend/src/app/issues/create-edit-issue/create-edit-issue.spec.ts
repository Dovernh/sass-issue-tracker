import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';

import { CreateEditIssue } from './create-edit-issue';

describe('CreateEditIssue', () => {
  let component: CreateEditIssue;
  let fixture: ComponentFixture<CreateEditIssue>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreateEditIssue],
      providers: [
        // Testing backend intercepts the component's proxy GETs (members,
        // priorities, categories) so no real HTTP is attempted.
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTranslateService({ fallbackLang: 'en' }),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CreateEditIssue);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
