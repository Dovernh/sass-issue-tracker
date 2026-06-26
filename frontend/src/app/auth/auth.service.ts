import { DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../environments/environment';
import { StorageService } from '../core/storage.service';

/**
 * Self-owned auth client. Exposes auth state as signals (`isSignedIn`, `user`,
 * `imageUrl`, `loaded`) plus `signInWithPassword`, `signOut`, `setProfileImage`,
 * `getToken`/`tokenValue`, and `load`. Backed by the `/api/auth` endpoints; the
 * Bearer JWT is persisted in localStorage and replayed by the auth interceptor.
 */

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  imageUrl: string | null;
}

/** An org the user belongs to, for the switcher. */
export interface UserOrg {
  id: string;
  name: string;
  role: string;
  status: string;
}

interface AuthResponse {
  token: string;
  user: AuthUser;
  orgId?: string;
  orgRole?: string;
  orgPermissions?: string[];
  platformRole?: string | null;
}

interface MeResponse {
  userId: string;
  orgId: string;
  orgRole: string;
  orgPermissions: string[];
  platformRole: string | null;
}

interface SwitchOrgResponse {
  token: string;
  orgId: string;
  orgRole: string;
  orgPermissions: string[];
}

const TOKEN_KEY = 'authToken';
const USER_KEY = 'authUser';
const PERMS_KEY = 'authPerms';
const ROLE_KEY = 'authRole';
const ORG_KEY = 'authOrgId';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly #http = inject(HttpClient);
  readonly #storage = inject(StorageService);
  readonly #document = inject(DOCUMENT);
  readonly #base = environment.apiUrl;

  readonly #user = signal<AuthUser | null>(null);
  readonly #token = signal<string | null>(null);
  readonly #imageUrl = signal<string | null>(null);
  readonly #role = signal<string | null>(null);
  readonly #permissions = signal<string[]>([]);
  readonly #loaded = signal(false);
  readonly #orgId = signal<string | null>(null);
  readonly #orgs = signal<UserOrg[]>([]);
  readonly #platformRole = signal<string | null>(null);

  /** The signed-in user, or null. */
  readonly user = this.#user.asReadonly();
  /** Avatar URL, tracked separately so it updates after an upload. */
  readonly imageUrl = this.#imageUrl.asReadonly();
  /** The active org role (admin/member/viewer), or null. */
  readonly role = this.#role.asReadonly();
  /** The active org permission strings (e.g. 'org:members:view'). */
  readonly permissions = this.#permissions.asReadonly();
  /** True once `load()` has settled. */
  readonly loaded = this.#loaded.asReadonly();
  /** Orgs the user belongs to (empty for the platform owner). */
  readonly orgs = this.#orgs.asReadonly();
  /** The platform role ('owner') when the user is the SaaS owner, else null. */
  readonly platformRole = this.#platformRole.asReadonly();
  /** True when a user is authenticated. */
  readonly isSignedIn = computed(() => !!this.#user());
  /** True for the platform owner (control plane; no org context). */
  readonly isPlatformOwner = computed(() => this.#platformRole() === 'owner');
  /** The currently active org, resolved from the org list, or null. */
  readonly currentOrg = computed(
    () => this.#orgs().find((o) => o.id === this.#orgId()) ?? null,
  );
  /** Whether to show the org switcher: the user belongs to more than one org. */
  readonly canSwitchOrg = computed(() => this.#orgs().length > 1);

  /** Whether the active membership grants a given permission string. */
  hasPermission(permission: string): boolean {
    return this.#permissions().includes(permission);
  }

  /**
   * Restore a persisted session at startup and validate the token against the
   * backend (a 401 — e.g. expired/rotated — clears the stale session).
   */
  async load(): Promise<void> {
    try {
      const token = this.#storage.get<string>(TOKEN_KEY);
      const user = this.#storage.get<AuthUser>(USER_KEY);
      if (!token || !user) return;
      // Restore cached role/perms/org first so guards work before /api/me resolves.
      this.#setSession(token, user, this.#storage.get<string>(ROLE_KEY), this.#storage.get<string[]>(PERMS_KEY) ?? []);
      this.#orgId.set(this.#storage.get<string>(ORG_KEY) ?? null);
      try {
        // Re-validate the token and refresh role/permissions/org from the server.
        const me = await firstValueFrom(this.#http.get<MeResponse>(`${this.#base}/api/me`));
        this.#applyOrgState(me.orgId, me.orgRole, me.orgPermissions, me.platformRole);
        await this.#refreshOrgs();
      } catch {
        this.#clearSession();
      }
    } finally {
      this.#loaded.set(true);
    }
  }

  /** Email/password sign-in via the local auth backend. Throws on failure. */
  async signInWithPassword(email: string, password: string): Promise<void> {
    const res = await firstValueFrom(
      this.#http.post<AuthResponse>(`${this.#base}/api/auth/login`, { email, password }),
    );
    this.#setSession(res.token, res.user, res.orgRole ?? null, res.orgPermissions ?? []);
    this.#applyOrgState(res.orgId ?? null, res.orgRole ?? null, res.orgPermissions ?? [], res.platformRole ?? null);
    this.#storage.set(TOKEN_KEY, res.token);
    this.#storage.set(USER_KEY, res.user);
    this.#storage.set(ROLE_KEY, res.orgRole ?? null);
    this.#storage.set(PERMS_KEY, res.orgPermissions ?? []);
    // Populate the org list for the switcher (empty for the platform owner).
    await this.#refreshOrgs();
  }

  /**
   * Switch the active org: re-issue a token scoped to `orgId`, persist it, then
   * reload the app so every data resource refetches under the new org context.
   */
  async switchOrg(orgId: string): Promise<void> {
    if (orgId === this.#orgId()) return;
    const res = await firstValueFrom(
      this.#http.post<SwitchOrgResponse>(`${this.#base}/api/auth/switch-org`, { orgId }),
    );
    this.#token.set(res.token);
    this.#applyOrgState(res.orgId, res.orgRole, res.orgPermissions, null);
    this.#storage.set(TOKEN_KEY, res.token);
    this.#storage.set(ROLE_KEY, res.orgRole);
    this.#storage.set(PERMS_KEY, res.orgPermissions);
    this.#document.defaultView?.location.reload();
  }

  /** Fetch the orgs the user belongs to (best-effort; clears on failure). */
  async #refreshOrgs(): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.#http.get<{ orgs: UserOrg[] }>(`${this.#base}/api/me/orgs`),
      );
      this.#orgs.set(res.orgs);
    } catch {
      this.#orgs.set([]);
    }
  }

  #applyOrgState(
    orgId: string | null,
    role: string | null,
    permissions: string[],
    platformRole: string | null,
  ): void {
    this.#orgId.set(orgId || null);
    this.#role.set(role);
    this.#permissions.set(permissions);
    this.#platformRole.set(platformRole);
    if (orgId) this.#storage.set(ORG_KEY, orgId);
    else this.#storage.remove(ORG_KEY);
  }

  async signOut(): Promise<void> {
    // Stateless JWT: the server call is best-effort; local state is authoritative.
    try {
      await firstValueFrom(this.#http.post(`${this.#base}/api/auth/logout`, {}));
    } catch {
      /* ignore — nothing to revoke server-side */
    }
    this.#clearSession();
  }

  /** Upload a new avatar (sent as a data URL) and refresh the image signal. */
  async setProfileImage(file: File): Promise<void> {
    const dataUrl = await this.#readAsDataUrl(file);
    const res = await firstValueFrom(
      this.#http.put<{ imageUrl: string }>(`${this.#base}/api/me/avatar`, { imageUrl: dataUrl }),
    );
    this.#imageUrl.set(res.imageUrl);
    const user = this.#user();
    if (user) {
      const updated: AuthUser = { ...user, imageUrl: res.imageUrl };
      this.#user.set(updated);
      this.#storage.set(USER_KEY, updated);
    }
  }

  /** Bearer token for the backend; null when signed out. Async for parity. */
  async getToken(): Promise<string | null> {
    return this.#token();
  }

  /** Synchronous token access used by the HTTP interceptor. */
  get tokenValue(): string | null {
    return this.#token();
  }

  #setSession(token: string, user: AuthUser, role: string | null, permissions: string[]): void {
    this.#token.set(token);
    this.#user.set(user);
    this.#imageUrl.set(user.imageUrl);
    this.#role.set(role);
    this.#permissions.set(permissions);
  }

  #clearSession(): void {
    this.#token.set(null);
    this.#user.set(null);
    this.#imageUrl.set(null);
    this.#role.set(null);
    this.#permissions.set([]);
    this.#orgId.set(null);
    this.#orgs.set([]);
    this.#platformRole.set(null);
    this.#storage.remove(TOKEN_KEY);
    this.#storage.remove(USER_KEY);
    this.#storage.remove(ROLE_KEY);
    this.#storage.remove(PERMS_KEY);
    this.#storage.remove(ORG_KEY);
  }

  #readAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }
}
