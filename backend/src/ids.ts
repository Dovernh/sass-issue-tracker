import { randomUUID } from 'node:crypto';

/**
 * App-generated, prefixed identifiers for users and orgs. Text IDs so they
 * populate the text `issues.org_id` / `issues.created_by` columns directly.
 */
export const newUserId = (): string => `user_${randomUUID()}`;
export const newOrgId = (): string => `org_${randomUUID()}`;
