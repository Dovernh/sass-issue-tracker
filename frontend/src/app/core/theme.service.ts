import { effect, inject, Injectable, signal } from '@angular/core';

import { StorageService } from './storage.service';

export type Theme = 'light' | 'dark';
const KEY = 'theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly #storage = inject(StorageService);
  readonly theme = signal<Theme>(this.#initial());

  constructor() {
    effect(() => {
      const theme = this.theme();
      document.documentElement.setAttribute('data-theme', theme);
      this.#storage.set(KEY, theme);
    });
  }

  toggle(): void {
    this.theme.update((t) => (t === 'dark' ? 'light' : 'dark'));
  }

  #initial(): Theme {
    const saved = this.#storage.get<Theme>(KEY);
    if (saved === 'light' || saved === 'dark') return saved;
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
}
