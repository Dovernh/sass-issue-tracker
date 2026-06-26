# saas-issue-tracker

Two-part app for logging users' issues with an app.

```
frontend/   Angular client (self-owned auth via AuthService)
backend/    Node + Express API (argon2 + session JWTs over libsql/Drizzle)
```

## How auth works

Self-owned auth — no third-party identity provider.

1. The user signs in via `POST /api/auth/login` (email + password). The backend
   verifies the argon2id password hash and returns a signed session **JWT**
   (HS256, signed with `AUTH_SECRET`).
2. The Angular `AuthService` stores the JWT; an HTTP interceptor
   (`frontend/src/app/auth/auth.interceptor.ts`) attaches it as
   `Authorization: Bearer <token>` on every request to the backend.
3. The Express backend verifies the JWT, loads the user's org membership, and
   enforces org permissions (`backend/src/auth.local.ts` + `auth.ts`).
   Accounts/orgs are created via `POST /api/auth/register`.

Tenancy is org-scoped: every issue query is filtered by `org_id`.

## Run

```bash
# backend
cd backend && npm install && cp .env.example .env   # set AUTH_SECRET
npm run dev                                          # http://localhost:8000

# frontend
cd frontend && npm install
npm start                                            # http://localhost:4200
```

Endpoints: `GET /api/health` (public); `POST /api/auth/{register,login,logout}`;
`GET /api/me` and `PUT /api/me/avatar` (auth); `GET /api/issues`
(needs `org:tasks:view`), `POST /api/issues` (needs `org:tasks:create`),
`PATCH/DELETE /api/issues/:id` (edit/delete perms).
