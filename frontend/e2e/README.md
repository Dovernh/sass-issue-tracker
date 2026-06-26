# End-to-end tests (Playwright)

E2E specs live here (`*.spec.ts`). They mock the backend with Playwright route
interception and seed the auth session into `localStorage`, so no real server is
required — only the Angular dev server (started automatically).

```bash
npx playwright install   # one-time: download browser binaries
npm run e2e              # preferred: runs Playwright directly (auto-starts the dev server)
ng e2e                   # same suite via the Angular CLI builder
```

Both routes use `../playwright.config.ts`. Pass Playwright flags through either,
e.g. `npm run e2e -- --ui` or `ng e2e --headed`.

## Accessibility scans

`checkA11y(page)` (in `fixtures.ts`) runs an [`@axe-core/playwright`] scan of the
current page state against WCAG 2.0/2.1 A and AA rules and fails on any
violation (this enforces the "MUST pass all AXE checks" rule in CLAUDE.md). Call
it from a spec once the state you want to audit is on screen:

```ts
await page.getByRole('button', { name: 'Add issue' }).click();
await expect(page.getByRole('heading', { name: 'New issue' })).toBeVisible();
await checkA11y(page);
```

It waits for CSS animations to settle before scanning, so auditing a state mid
entrance-animation (e.g. the modal fade-in) doesn't report spurious contrast
failures. Pass selectors to skip markup we don't own, e.g.
`checkA11y(page, ['.ag-root'])` — prefer fixing over excluding.

Scans currently cover the signed-out landing + sign-in form (`auth.spec.ts`),
the dashboard (`dashboard.spec.ts`), the issues list + new-issue dialog
(`issues.spec.ts`), the admin Users tab (`admin.spec.ts`), the open row-actions
menu + the platform-owner control plane (`roles.spec.ts`), the navbar in the
**dark** theme (`navigation.spec.ts`), and the rich-text editor with its Format
menu open (`rich-text-editor.spec.ts`). Note that axe catches only automatable
issues (~30–50% of WCAG); keyboard/focus behaviour still needs explicit
interaction assertions.

[`@axe-core/playwright`]: https://github.com/dequelabs/axe-core-npm/tree/develop/packages/playwright

## `ng e2e` prints a DEP0190 warning

`ng e2e` is wired through `playwright-ng-schematics` (the `e2e` target in
`../angular.json`). That builder spawns Playwright with `shell: true` and an
args array, which makes Node emit a harmless `DEP0190` deprecation warning —
it's an upstream bug in the builder, not in our tests or config, and the suite
still passes.

To avoid it, prefer **`npm run e2e`** (runs Playwright directly, no builder, no
warning). If you'd rather keep typing `ng e2e`, silence just that one warning by
exporting the flag in your shell (e.g. `~/.zshrc`):

```bash
export NODE_OPTIONS=--disable-warning=DEP0190
```

It can't be set in `angular.json`/`package.json` because the warning comes from
the `ng` process itself, so `NODE_OPTIONS` must be in the shell that launches it.
