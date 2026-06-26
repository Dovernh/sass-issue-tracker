import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

/** A supported UI language. */
export const LanguageSchema = z
  .object({
    code: z.string(),
    name: z.string(),
    nativeName: z.string(),
    enabled: z.boolean(),
    sortOrder: z.number().int(),
    createdAt: z.string(),
  })
  .openapi('Language');

export const LanguageListSchema = z
  .object({ languages: z.array(LanguageSchema) })
  .openapi('LanguageList');

/** Add a language to an org. `code` is the per-org primary key. */
export const NewLanguageSchema = z
  .object({
    code: z.string().min(2),
    name: z.string().min(1),
    nativeName: z.string().min(1),
    sortOrder: z.number().int().optional(),
    enabled: z.boolean().optional(),
  })
  .openapi('NewLanguage');

/** Edit a language (display fields / order / availability). `code` is immutable. */
export const LanguagePatchSchema = z
  .object({
    name: z.string().min(1).optional(),
    nativeName: z.string().min(1).optional(),
    sortOrder: z.number().int().optional(),
    enabled: z.boolean().optional(),
  })
  .openapi('LanguagePatch');

export type Language = z.infer<typeof LanguageSchema>;
export type NewLanguage = z.infer<typeof NewLanguageSchema>;
export type LanguagePatch = z.infer<typeof LanguagePatchSchema>;
