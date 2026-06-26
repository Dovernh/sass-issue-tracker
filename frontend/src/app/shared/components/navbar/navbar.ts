import {
  Component,
  computed,
  ElementRef,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { AuthService } from '../../../auth/auth.service';
import { LanguageService } from '../../../core/language.service';
import { ThemeService } from '../../../core/theme.service';

@Component({
  selector: 'app-navbar',
  imports: [TranslatePipe, RouterLink, RouterLinkActive],
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(keydown.escape)': 'closeMenus()',
  },
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
})
export class Navbar {
  protected readonly auth = inject(AuthService);
  protected readonly language = inject(LanguageService);
  protected readonly theme = inject(ThemeService);
  readonly login = output<void>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    // The navbar only renders when signed in, so the auth-gated language list
    // can be loaded here for the switcher.
    this.language.loadAvailable();
  }

  protected readonly profileOpen = signal(false);
  /** Mobile nav (hamburger) open state. */
  protected readonly navOpen = signal(false);
  private readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');

  /** Admin nav link shows only with member-view permission. */
  protected readonly canAdmin = computed(() => this.auth.hasPermission('org:members:view'));
  /** Dashboard nav link shows only with dashboard-view permission. */
  protected readonly canDashboard = computed(() => this.auth.hasPermission('org:dashboard:view'));

  protected readonly avatarUrl = computed(() => this.auth.imageUrl());

  protected readonly displayName = computed(() => {
    const user = this.auth.user();
    return user?.name || this.userEmail().split('@')[0] || '';
  });

  protected readonly initials = computed(() => {
    const name = this.displayName().trim();
    return name ? name.charAt(0).toUpperCase() : '?';
  });

  protected changeLang(event: Event): void {
    this.language.use((event.target as HTMLSelectElement).value);
  }

  /** Switch the active org; AuthService reloads the app under the new context. */
  protected async switchOrg(event: Event): Promise<void> {
    const orgId = (event.target as HTMLSelectElement).value;
    await this.auth.switchOrg(orgId);
  }

  protected userEmail(): string {
    return this.auth.user()?.email ?? '';
  }

  protected toggleProfile(): void {
    this.profileOpen.update((open) => !open);
  }

  protected toggleNav(): void {
    this.navOpen.update((open) => !open);
  }

  /** Collapse the mobile nav after navigating. */
  protected closeNav(): void {
    this.navOpen.set(false);
  }

  protected closeMenus(): void {
    this.navOpen.set(false);
    if (this.profileOpen()) {
      this.profileOpen.set(false);
      this.trigger()?.nativeElement.focus();
    }
  }

  /** Close open menus when a click lands outside the navbar. */
  protected onDocumentClick(event: MouseEvent): void {
    if (!this.profileOpen() && !this.navOpen()) return;
    const target = event.target as Node;

    if (this.profileOpen()) {
      const profile = this.host.nativeElement.querySelector('.profile');
      if (profile && !profile.contains(target)) this.profileOpen.set(false);
    }
    if (this.navOpen()) {
      const menu = this.host.nativeElement.querySelector('.navbar__menu');
      const burger = this.host.nativeElement.querySelector('.navbar__burger');
      if (menu && !menu.contains(target) && burger && !burger.contains(target)) {
        this.navOpen.set(false);
      }
    }
  }

  protected async onImageSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) await this.auth.setProfileImage(file);
    input.value = '';
  }

  protected async logout(): Promise<void> {
    this.profileOpen.set(false);
    await this.auth.signOut();
  }
}
