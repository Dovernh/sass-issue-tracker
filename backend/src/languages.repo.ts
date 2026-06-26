import { and, asc, eq } from 'drizzle-orm';
import { db } from './db/index.js';
import { languages, optionTranslations, type Language } from './db/schema.js';
import type { NewLanguage, LanguagePatch } from './schemas/languages.schema.js';

/**
 * Data access for an org's supported UI languages. Each org owns its own list
 * (seeded on creation), which drives that org's language switcher and the set of
 * locales its option labels can be translated into.
 */

/** Default supported languages — the locales we ship i18n files for today. */
export const DEFAULT_LANGUAGES: { code: string; name: string; nativeName: string }[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'uk', name: 'Ukrainian', nativeName: 'Українська' },
];

/** An org's enabled languages, in display order (drives the switcher). */
export function listLanguages(orgId: string): Promise<Language[]> {
  return db
    .select()
    .from(languages)
    .where(and(eq(languages.orgId, orgId), eq(languages.enabled, true)))
    .orderBy(asc(languages.sortOrder), asc(languages.code));
}

/** All of an org's languages, in display order (admin view). */
export function listAllLanguages(orgId: string): Promise<Language[]> {
  return db
    .select()
    .from(languages)
    .where(eq(languages.orgId, orgId))
    .orderBy(asc(languages.sortOrder), asc(languages.code));
}

/** Whether the org already has a language with this code. */
export async function languageExists(orgId: string, code: string): Promise<boolean> {
  const rows = await db
    .select({ code: languages.code })
    .from(languages)
    .where(and(eq(languages.orgId, orgId), eq(languages.code, code)))
    .limit(1);
  return rows.length > 0;
}

/** Add a language to an org. */
export async function createLanguage(orgId: string, input: NewLanguage): Promise<Language> {
  const [row] = await db
    .insert(languages)
    .values({
      orgId,
      code: input.code,
      name: input.name,
      nativeName: input.nativeName,
      sortOrder: input.sortOrder ?? 0,
      enabled: input.enabled ?? true,
    })
    .returning();
  return row;
}

/** Edit a language (display fields / order / enabled). Returns the row, or undefined. */
export async function updateLanguage(
  orgId: string,
  code: string,
  patch: LanguagePatch,
): Promise<Language | undefined> {
  const [row] = await db
    .update(languages)
    .set(patch)
    .where(and(eq(languages.orgId, orgId), eq(languages.code, code)))
    .returning();
  return row;
}

/**
 * Remove a language from an org. Cascades the org's option_translations for that
 * locale first (they FK the language). Returns whether a row was removed.
 */
export async function deleteLanguage(orgId: string, code: string): Promise<boolean> {
  const [existing] = await db
    .select({ code: languages.code })
    .from(languages)
    .where(and(eq(languages.orgId, orgId), eq(languages.code, code)))
    .limit(1);
  if (!existing) return false;

  await db
    .delete(optionTranslations)
    .where(and(eq(optionTranslations.orgId, orgId), eq(optionTranslations.languageCode, code)));
  await db.delete(languages).where(and(eq(languages.orgId, orgId), eq(languages.code, code)));
  return true;
}

/**
 * Seed an org's default languages. Idempotent: no-op if the org already has any,
 * so it's safe to call on every new org. Must run before option seeding, since
 * option_translations FK the org's language list.
 */
export async function seedLanguages(orgId: string): Promise<void> {
  const existing = await db
    .select({ code: languages.code })
    .from(languages)
    .where(eq(languages.orgId, orgId))
    .limit(1);
  if (existing.length > 0) return;

  await db.insert(languages).values(
    DEFAULT_LANGUAGES.map((l, i) => ({
      orgId,
      code: l.code,
      name: l.name,
      nativeName: l.nativeName,
      sortOrder: i,
      enabled: true,
    })),
  );
}
