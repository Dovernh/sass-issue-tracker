import { sql } from 'drizzle-orm';
import {
  foreignKey,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

/**
 * Enum value sets. SQLite has no native enum, so these are enforced as a TS-level
 * union by Drizzle plus a runtime check in the API layer.
 *
 * These back the column types and defaults below. Each org customizes its own
 * priority and category lists via the admin option-list editor (the `priorities`
 * / `categories` tables), so don't hardcode these sets in business logic — read
 * from the org's lists.
 */
export const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export const STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const;
export const CATEGORIES = [
  'bug',
  'feature_request',
  'ui_ux',
  'performance',
  'billing',
  'other',
] as const;

export const issues = sqliteTable('issues', {
  id: integer('id').primaryKey({ autoIncrement: true }),

  // Multi-tenant scoping (org id) + author (user id).
  orgId: text('org_id').notNull(),
  createdBy: text('created_by').notNull(),

  description: text('description').notNull(),
  assignedUser: text('assigned_user'), // user id, nullable until assigned
  priority: text('priority', { enum: PRIORITIES }).notNull().default('medium'),
  category: text('category', { enum: CATEGORIES }).notNull().default('other'),
  status: text('status', { enum: STATUSES }).notNull().default('open'),

  // Optional screenshot reference: we store the path/key only, not the file bytes.
  screenshotPath: text('screenshot_path'),

  createdAt: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text('updated_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),

  // Soft delete: NULL = live, timestamp = deleted. Queries filter on this.
  deletedAt: text('deleted_at'),
});

export type Issue = typeof issues.$inferSelect;
export type NewIssueRow = typeof issues.$inferInsert;

/* ============================================================================
   Self-owned auth tables. IDs are text and app-generated (`user_<uuid>` /
   `org_<uuid>`) so they back the text `issues.org_id` / `issues.created_by`
   columns directly.
   ========================================================================== */

export const users = sqliteTable('users', {
  // App-generated, e.g. `user_<uuid>`. Text so it can back issues.created_by.
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  // argon2id hash; never the plaintext.
  passwordHash: text('password_hash').notNull(),
  name: text('name'),
  imageUrl: text('image_url'),
  // Platform plane (SaaS): 'owner' = platform operator (no org membership; manages
  // orgs/admins, never tenant data). NULL = ordinary user.
  platformRole: text('platform_role'),
  createdAt: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
});

export const organizations = sqliteTable('organizations', {
  // App-generated, e.g. `org_<uuid>`. Text so it can back issues.org_id.
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  // Lifecycle: 'active' | 'disabled'. Disabled orgs block member access.
  status: text('status').notNull().default('active'),
  // Editable permission template for the `member` role (admin customizes it).
  // JSON array of permission strings; NULL falls back to DEFAULT_MEMBER_PERMISSIONS.
  memberPermissions: text('member_permissions', { mode: 'json' }).$type<string[]>(),
  // Soft delete: NULL = live, timestamp = deleted (access revoked).
  deletedAt: text('deleted_at'),
  createdAt: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
});

export const memberships = sqliteTable('memberships', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  orgId: text('org_id')
    .notNull()
    .references(() => organizations.id),
  // High-level role; fine-grained access is driven by `permissions` below.
  role: text('role').notNull().default('member'),
  // Permission strings (e.g. "org:tasks:view"), JSON-encoded; the
  // `requireView/Create/Edit/Delete` guards check membership against these.
  permissions: text('permissions', { mode: 'json' })
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'`),
  createdAt: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
}, (t) => [
  // A user can belong to an org at most once.
  uniqueIndex('memberships_org_user_unq').on(t.orgId, t.userId),
]);

export type User = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
export type Organization = typeof organizations.$inferSelect;
export type NewOrganizationRow = typeof organizations.$inferInsert;
export type Membership = typeof memberships.$inferSelect;
export type NewMembershipRow = typeof memberships.$inferInsert;

/* ============================================================================
   Org-configurable option lists for issue priority & category. These replace
   the hardcoded PRIORITIES/CATEGORIES enums as the source of truth for admin
   screens and dropdowns: each org owns its own list — all client data, no
   system/immutable rows. `key` is the stored slug (matches what
   `issues.priority`/`issues.category` hold); `sortOrder` controls display
   order. Display text lives entirely in option_translations.
   ========================================================================== */

export const priorities = sqliteTable('priorities', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  orgId: text('org_id')
    .notNull()
    .references(() => organizations.id),
  // The stored slug (matches issues.priority). Per-locale display text lives in
  // option_translations, keyed by (org, kind, key, language).
  key: text('key').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  orgId: text('org_id')
    .notNull()
    .references(() => organizations.id),
  key: text('key').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
});

export type PriorityRow = typeof priorities.$inferSelect;
export type NewPriorityRow = typeof priorities.$inferInsert;
export type CategoryRow = typeof categories.$inferSelect;
export type NewCategoryRow = typeof categories.$inferInsert;

/* ============================================================================
   Supported UI languages, per org. Seeded per org on creation with the locales
   shipped as i18n files (en/es/uk); the source of truth for that org's language
   switcher and for which locales its option labels can be translated into.
   ========================================================================== */
export const languages = sqliteTable(
  'languages',
  {
    orgId: text('org_id')
      .notNull()
      .references(() => organizations.id),
    // BCP-47 code, e.g. 'en', 'es', 'uk'.
    code: text('code').notNull(),
    name: text('name').notNull(), // English name, e.g. 'Spanish'
    nativeName: text('native_name').notNull(), // endonym, e.g. 'Español'
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
  },
  (t) => [primaryKey({ columns: [t.orgId, t.code] })],
);

export type Language = typeof languages.$inferSelect;
export type NewLanguageRow = typeof languages.$inferInsert;

/**
 * Per-locale labels for org option lists (priority/category). One row per
 * (org, kind, key, language); `label` is the only place translated text lives.
 * Polymorphic by `kind` so both lists share one table. `language_code` FKs the
 * org's own language list, so labels can only target languages that org offers.
 */
export const optionTranslations = sqliteTable(
  'option_translations',
  {
    orgId: text('org_id')
      .notNull()
      .references(() => organizations.id),
    kind: text('kind', { enum: ['priority', 'category'] }).notNull(),
    key: text('key').notNull(), // the option's `key`
    languageCode: text('language_code').notNull(),
    label: text('label').notNull(),
    createdAt: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
  },
  (t) => [
    primaryKey({ columns: [t.orgId, t.kind, t.key, t.languageCode] }),
    foreignKey({
      columns: [t.orgId, t.languageCode],
      foreignColumns: [languages.orgId, languages.code],
    }),
  ],
);

export type OptionTranslation = typeof optionTranslations.$inferSelect;
