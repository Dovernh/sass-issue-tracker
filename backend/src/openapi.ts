import {
  OpenApiGeneratorV3,
  OpenAPIRegistry,
} from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import {
  IssueSchema,
  IssueListSchema,
  NewIssueSchema,
  IssuePatchSchema,
  ErrorSchema,
} from './schemas/issues.schema.js';
import {
  MemberSchema,
  MemberListSchema,
  NewMemberSchema,
  MemberPatchSchema,
  PasswordResetSchema,
} from './schemas/members.schema.js';
import {
  PrioritySchema,
  PriorityListSchema,
  NewPrioritySchema,
  PriorityPatchSchema,
  CategorySchema,
  CategoryListSchema,
  NewCategorySchema,
  CategoryPatchSchema,
} from './schemas/options.schema.js';
import {
  LanguageSchema,
  LanguageListSchema,
  NewLanguageSchema,
  LanguagePatchSchema,
} from './schemas/languages.schema.js';
import {
  OrgAdminSchema,
  OrgSummarySchema,
  OrgListSchema,
  NewOrgSchema,
  OrgPatchSchema,
  NewOrgAdminSchema,
} from './schemas/platform.schema.js';
import { MemberRoleSchema, MemberRolePatchSchema } from './schemas/roles.schema.js';

/**
 * OpenAPI document built from the zod DTOs. This is the machine-readable spec
 * the Angular client is generated from (frontend `npm run gen:api`).
 *
 * Each route is grouped into a proxy file by its `tags` value. Covered so far:
 * `issues`, `members`. Other routers register the same way.
 */

const registry = new OpenAPIRegistry();

const bearer = registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
});
const security = [{ [bearer.name]: [] }];

const json = <T extends z.ZodTypeAny>(schema: T) => ({
  content: { 'application/json': { schema } },
});

const errorResponses = {
  400: { description: 'Validation error', ...json(ErrorSchema) },
  401: { description: 'Not authenticated', ...json(ErrorSchema) },
  403: { description: 'Forbidden', ...json(ErrorSchema) },
  404: { description: 'Not found', ...json(ErrorSchema) },
};

const IdParam = z.object({
  id: z
    .number()
    .int()
    .openapi({ param: { name: 'id', in: 'path', required: true } }),
});

const UserIdParam = z.object({
  userId: z
    .string()
    .openapi({ param: { name: 'userId', in: 'path', required: true } }),
});

// `tags` (singular) -> service class name (IssueService) + folder.
// `operationId` -> method name, e.g. getIssues/postIssue/updateIssue/deleteIssue.
// Embedding the entity keeps names globally unique (required by OpenAPI/orval).
registry.registerPath({
  method: 'get',
  path: '/api/issues',
  tags: ['issue'],
  operationId: 'getIssues',
  summary: 'List issues for the current org',
  security,
  responses: {
    200: { description: 'Issue list', ...json(IssueListSchema) },
    ...errorResponses,
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/issues',
  tags: ['issue'],
  operationId: 'postIssue',
  summary: 'Create an issue',
  security,
  request: { body: json(NewIssueSchema) },
  responses: {
    201: { description: 'Created issue', ...json(IssueSchema) },
    ...errorResponses,
  },
});

registry.registerPath({
  method: 'patch',
  path: '/api/issues/{id}',
  tags: ['issue'],
  operationId: 'updateIssue',
  summary: 'Update an issue',
  security,
  request: { params: IdParam, body: json(IssuePatchSchema) },
  responses: {
    200: { description: 'Updated issue', ...json(IssueSchema) },
    ...errorResponses,
  },
});

registry.registerPath({
  method: 'delete',
  path: '/api/issues/{id}',
  tags: ['issue'],
  operationId: 'deleteIssue',
  summary: 'Soft-delete an issue',
  security,
  request: { params: IdParam },
  responses: {
    204: { description: 'Deleted' },
    ...errorResponses,
  },
});

// ── members ─────────────────────────────────────────────────────────────────

registry.registerPath({
  method: 'get',
  path: '/api/members',
  tags: ['member'],
  operationId: 'getMembers',
  summary: 'List org members',
  security,
  responses: {
    200: { description: 'Member list', ...json(MemberListSchema) },
    ...errorResponses,
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/members',
  tags: ['member'],
  operationId: 'postMember',
  summary: 'Create a member',
  security,
  request: { body: json(NewMemberSchema) },
  responses: {
    201: { description: 'Created member', ...json(MemberSchema) },
    409: { description: 'Email already in use', ...json(ErrorSchema) },
    ...errorResponses,
  },
});

registry.registerPath({
  method: 'patch',
  path: '/api/members/{userId}',
  tags: ['member'],
  operationId: 'updateMember',
  summary: 'Update a member',
  security,
  request: { params: UserIdParam, body: json(MemberPatchSchema) },
  responses: {
    200: { description: 'Updated member', ...json(MemberSchema) },
    409: { description: 'Cannot demote the last admin', ...json(ErrorSchema) },
    ...errorResponses,
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/members/{userId}/password',
  tags: ['member'],
  operationId: 'resetMemberPassword',
  summary: "Reset a member's password",
  security,
  request: { params: UserIdParam, body: json(PasswordResetSchema) },
  responses: {
    204: { description: 'Password reset' },
    ...errorResponses,
  },
});

registry.registerPath({
  method: 'delete',
  path: '/api/members/{userId}',
  tags: ['member'],
  operationId: 'deleteMember',
  summary: 'Remove a member',
  security,
  request: { params: UserIdParam },
  responses: {
    204: { description: 'Removed' },
    409: { description: 'Cannot remove the last admin', ...json(ErrorSchema) },
    ...errorResponses,
  },
});

// ── priorities ────────────────────────────────────────────────────────────────

registry.registerPath({
  method: 'get',
  path: '/api/priorities',
  tags: ['priority'],
  operationId: 'getPriorities',
  summary: 'List priority options',
  security,
  responses: {
    200: { description: 'Priority list', ...json(PriorityListSchema) },
    ...errorResponses,
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/priorities',
  tags: ['priority'],
  operationId: 'postPriority',
  summary: 'Create a priority option',
  security,
  request: { body: json(NewPrioritySchema) },
  responses: {
    201: { description: 'Created option', ...json(PrioritySchema) },
    ...errorResponses,
  },
});

registry.registerPath({
  method: 'patch',
  path: '/api/priorities/{id}',
  tags: ['priority'],
  operationId: 'updatePriority',
  summary: 'Update a priority option',
  security,
  request: { params: IdParam, body: json(PriorityPatchSchema) },
  responses: {
    200: { description: 'Updated option', ...json(PrioritySchema) },
    ...errorResponses,
  },
});

registry.registerPath({
  method: 'delete',
  path: '/api/priorities/{id}',
  tags: ['priority'],
  operationId: 'deletePriority',
  summary: 'Delete a priority option',
  security,
  request: { params: IdParam },
  responses: {
    204: { description: 'Deleted' },
    ...errorResponses,
  },
});

// ── categories ──────────────────────────────────────────────────────────────

registry.registerPath({
  method: 'get',
  path: '/api/categories',
  tags: ['category'],
  operationId: 'getCategories',
  summary: 'List category options',
  security,
  responses: {
    200: { description: 'Category list', ...json(CategoryListSchema) },
    ...errorResponses,
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/categories',
  tags: ['category'],
  operationId: 'postCategory',
  summary: 'Create a category option',
  security,
  request: { body: json(NewCategorySchema) },
  responses: {
    201: { description: 'Created option', ...json(CategorySchema) },
    ...errorResponses,
  },
});

registry.registerPath({
  method: 'patch',
  path: '/api/categories/{id}',
  tags: ['category'],
  operationId: 'updateCategory',
  summary: 'Update a category option',
  security,
  request: { params: IdParam, body: json(CategoryPatchSchema) },
  responses: {
    200: { description: 'Updated option', ...json(CategorySchema) },
    ...errorResponses,
  },
});

registry.registerPath({
  method: 'delete',
  path: '/api/categories/{id}',
  tags: ['category'],
  operationId: 'deleteCategory',
  summary: 'Delete a category option',
  security,
  request: { params: IdParam },
  responses: {
    204: { description: 'Deleted' },
    ...errorResponses,
  },
});

// ── languages ─────────────────────────────────────────────────────────────────

registry.registerPath({
  method: 'get',
  path: '/api/languages',
  tags: ['language'],
  operationId: 'getLanguages',
  summary: "List the org's enabled UI languages",
  security,
  responses: {
    200: { description: 'Language list', ...json(LanguageListSchema) },
    401: { description: 'Not authenticated', ...json(ErrorSchema) },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/languages/all',
  tags: ['language'],
  operationId: 'getAllLanguages',
  summary: "List all of the org's languages (admin)",
  security,
  responses: {
    200: { description: 'Language list', ...json(LanguageListSchema) },
    ...errorResponses,
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/languages',
  tags: ['language'],
  operationId: 'postLanguage',
  summary: 'Add a language to the org (admin)',
  security,
  request: { body: json(NewLanguageSchema) },
  responses: {
    201: { description: 'Created language', ...json(LanguageSchema) },
    409: { description: 'Language code already exists', ...json(ErrorSchema) },
    ...errorResponses,
  },
});

registry.registerPath({
  method: 'patch',
  path: '/api/languages/{code}',
  tags: ['language'],
  operationId: 'updateLanguage',
  summary: 'Edit a language (admin)',
  security,
  request: {
    params: z.object({ code: z.string() }),
    body: json(LanguagePatchSchema),
  },
  responses: {
    200: { description: 'Updated language', ...json(LanguageSchema) },
    ...errorResponses,
  },
});

registry.registerPath({
  method: 'delete',
  path: '/api/languages/{code}',
  tags: ['language'],
  operationId: 'deleteLanguage',
  summary: 'Remove a language from the org (admin)',
  security,
  request: { params: z.object({ code: z.string() }) },
  responses: {
    204: { description: 'Deleted' },
    ...errorResponses,
  },
});

// ── platform (control plane: org lifecycle + admins, platform owner only) ─────

// Org IDs are app-generated strings (`org_<uuid>`), unlike the numeric IdParam.
const OrgIdParam = z.object({
  id: z
    .string()
    .openapi({ param: { name: 'id', in: 'path', required: true } }),
});

registry.registerPath({
  method: 'get',
  path: '/api/platform/orgs',
  tags: ['platform'],
  operationId: 'getOrgs',
  summary: 'List all organizations (platform owner)',
  security,
  responses: {
    200: { description: 'Organization list', ...json(OrgListSchema) },
    ...errorResponses,
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/platform/orgs',
  tags: ['platform'],
  operationId: 'postOrg',
  summary: 'Create an organization with its first admin',
  security,
  request: { body: json(NewOrgSchema) },
  responses: {
    201: { description: 'Created organization', ...json(OrgSummarySchema) },
    409: { description: 'Email already in use', ...json(ErrorSchema) },
    ...errorResponses,
  },
});

registry.registerPath({
  method: 'patch',
  path: '/api/platform/orgs/{id}',
  tags: ['platform'],
  operationId: 'updateOrg',
  summary: 'Rename an organization or change its status',
  security,
  request: { params: OrgIdParam, body: json(OrgPatchSchema) },
  responses: {
    200: { description: 'Updated organization', ...json(OrgSummarySchema) },
    ...errorResponses,
  },
});

registry.registerPath({
  method: 'delete',
  path: '/api/platform/orgs/{id}',
  tags: ['platform'],
  operationId: 'deleteOrg',
  summary: 'Soft-delete an organization',
  security,
  request: { params: OrgIdParam },
  responses: {
    204: { description: 'Deleted' },
    ...errorResponses,
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/platform/orgs/{id}/admins',
  tags: ['platform'],
  operationId: 'postOrgAdmin',
  summary: 'Add an admin to an organization',
  security,
  request: { params: OrgIdParam, body: json(NewOrgAdminSchema) },
  responses: {
    201: { description: 'Created admin', ...json(OrgAdminSchema) },
    409: { description: 'Email already in use', ...json(ErrorSchema) },
    ...errorResponses,
  },
});

registry.registerPath({
  method: 'delete',
  path: '/api/platform/orgs/{id}/admins/{userId}',
  tags: ['platform'],
  operationId: 'deleteOrgAdmin',
  summary: 'Remove an admin from an organization',
  security,
  request: {
    params: OrgIdParam.merge(UserIdParam),
  },
  responses: {
    204: { description: 'Removed' },
    409: { description: 'Cannot remove the last admin', ...json(ErrorSchema) },
    ...errorResponses,
  },
});

// ── roles (editable member-role permission template) ──────────────────────────

registry.registerPath({
  method: 'get',
  path: '/api/roles/member',
  tags: ['role'],
  operationId: 'getMemberRole',
  summary: "The member role's permissions + the grantable set",
  security,
  responses: {
    200: { description: 'Member role permissions', ...json(MemberRoleSchema) },
    ...errorResponses,
  },
});

registry.registerPath({
  method: 'put',
  path: '/api/roles/member',
  tags: ['role'],
  operationId: 'updateMemberRole',
  summary: "Update the member role's permissions (admin)",
  security,
  request: { body: json(MemberRolePatchSchema) },
  responses: {
    200: { description: 'Updated member role permissions', ...json(MemberRoleSchema) },
    ...errorResponses,
  },
});

/** Build the OpenAPI 3.0 document. */
export function buildOpenApiDocument() {
  return new OpenApiGeneratorV3(registry.definitions).generateDocument({
    openapi: '3.0.0',
    info: { title: 'Issue Tracker API', version: '0.1.0' },
    servers: [{ url: '/' }],
  });
}
