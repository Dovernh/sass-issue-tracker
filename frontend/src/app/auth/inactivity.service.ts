import { effect, inject,Injectable, NgZone } from '@angular/core';

import { NotificationService } from '../core/notification.service';
import { StorageService } from '../core/storage.service';
import { AuthService } from './auth.service';

/**
 * Signs the user out after a period of inactivity
 * Adjust IDLE_LIMIT_MS to change how long a session may sit idle.
 */
const IDLE_LIMIT_MS = 30 * 60 * 1000; // 30 minutes
const KEY = 'lastActivity';
const WRITE_THROTTLE_MS = 30_000; // cap how often we touch localStorage
const CHECK_INTERVAL_MS = 60_000;
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'scroll'] as const;

@Injectable({ providedIn: 'root' })
export class InactivityService {
  readonly #auth = inject(AuthService);
  readonly #storage = inject(StorageService);
  readonly #notify = inject(NotificationService);
  readonly #zone = inject(NgZone);
  #lastWrite = 0;
  #started = false;

  constructor() {
    // Stamp the start of each signed-in session and clear it on sign-out, so a
    // stale timestamp from a previous session can't trigger an instant logout.
    effect(() => {
      if (this.#auth.isSignedIn()) {
        if (this.#storage.get<number>(KEY) == null) {
          this.#storage.set(KEY, Date.now());
        }
      } else {
        this.#storage.remove(KEY);
      }
    });
  }

  /** Begin tracking. Call once after auth has loaded. Idempotent. */
  start(): void {
    if (this.#started) return;
    this.#started = true;

    // Returning after the tab was closed (overnight) is evaluated right here.
    this.#enforce();

    // Listeners run outside Angular so routine input doesn't churn change
    // detection; #enforce re-enters the zone only when it actually signs out.
    this.#zone.runOutsideAngular(() => {
      for (const evt of ACTIVITY_EVENTS) {
        window.addEventListener(evt, this.#onActivity, { passive: true });
      }
      document.addEventListener('visibilitychange', this.#onVisible);
      setInterval(() => this.#enforce(), CHECK_INTERVAL_MS);
    });
  }

  readonly #onActivity = (): void => {
    if (!this.#auth.isSignedIn()) return;
    const now = Date.now();
    if (now - this.#lastWrite < WRITE_THROTTLE_MS) return;
    this.#lastWrite = now;
    this.#storage.set(KEY, now);
  };

  readonly #onVisible = (): void => {
    if (document.visibilityState === 'visible') this.#enforce();
  };

  #enforce(): void {
    if (!this.#auth.isSignedIn()) return;
    const last = this.#storage.get<number>(KEY);
    if (last == null) {
      this.#storage.set(KEY, Date.now());
      return;
    }
    if (Date.now() - last > IDLE_LIMIT_MS) {
      this.#storage.remove(KEY);
      // Re-enter Angular so the sign-out state change updates the UI.
      this.#zone.run(() => {
        this.#notify.info('Signed out due to inactivity.');
        void this.#auth.signOut();
      });
    }
  }
}
