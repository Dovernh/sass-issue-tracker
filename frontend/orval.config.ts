import { defineConfig } from 'orval';

/**
 * Generates a typed Angular client from the backend OpenAPI spec.
 *
 * Regen workflow:
 *   1. (backend)  npm run openapi:gen     -> writes backend/openapi.json
 *   2. (frontend) npm run gen:api         -> regenerates src/app/api/proxies/
 *
 * `mode: 'tags-split'` gives each backend router/entity its own collapsible
 * folder (grouped by the OpenAPI tag), e.g. proxies/issues/issues.service.ts and
 * proxies/members/members.service.ts. Shared DTO types go in
 * proxies/issueTrackerAPI.schemas.ts.
 *
 * The generated service uses Angular HttpClient (Observables). It does NOT use
 * the apiUrl base from environment.ts — pair it with an interceptor that adds
 * the base URL + auth bearer (the existing auth interceptor already does auth).
 */
export default defineConfig({
  issueTracker: {
    input: '../backend/openapi.json',
    output: {
      mode: 'tags-split',
      target: 'src/app/api/proxies',
      client: 'angular',
      clean: true,
      // Method names come straight from each route's `operationId` in
      // backend/src/openapi.ts (e.g. issueList, issueCreate, memberUpdate).
      // orval requires globally-unique operation names, so methods are
      // entity-prefixed rather than a bare list/create repeated per service.
    },
    // orval auto-formats generated files with prettier when it's installed.
  },
});
