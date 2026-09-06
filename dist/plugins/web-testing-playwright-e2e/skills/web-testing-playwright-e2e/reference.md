# Playwright E2E Testing Reference

> Lookup tables, config and CLI, version changes, troubleshooting. Decisions and red flags live in
> [SKILL.md](SKILL.md); code lives under [examples/](examples/core.md).

---

## Locators

### Priority order

| Priority | Locator              | Use when                 | Example                                    |
| -------- | -------------------- | ------------------------ | ------------------------------------------ |
| 1        | `getByRole()`        | The element has a role   | `getByRole('button', { name: /submit/i })` |
| 2        | `getByLabel()`       | Labelled form control    | `getByLabel(/email address/i)`             |
| 3        | `getByText()`        | Unique visible text      | `getByText(/welcome back/i)`               |
| 4        | `getByPlaceholder()` | Input with a placeholder | `getByPlaceholder('Search...')`            |
| 5        | `getByAltText()`     | Image with alt text      | `getByAltText('Company logo')`             |
| 6        | `getByTitle()`       | Element with a title     | `getByTitle('Close dialog')`               |
| 7        | `getByTestId()`      | No semantic role exists  | `getByTestId('user-avatar')`               |
| 8        | CSS / XPath          | Legacy markup only       | `locator('.btn-primary')`                  |

### Operators (v1.33+)

| Operator                  | Purpose               | Example                                                      |
| ------------------------- | --------------------- | ------------------------------------------------------------ |
| `.and()`                  | Both conditions       | `page.getByRole('button').and(page.getByTitle('Subscribe'))` |
| `.or()`                   | Either condition      | `page.getByRole('button').or(page.getByRole('link'))`        |
| `.filter({ hasNot })`     | Exclude by locator    | `items.filter({ hasNot: page.getByText('Sold') })`           |
| `.filter({ hasNotText })` | Exclude by text       | `items.filter({ hasNotText: 'Out of stock' })`               |
| `.filter({ visible })`    | Visible only (v1.51+) | `buttons.filter({ visible: true })`                          |

### Role mappings

| Element                   | Role        | Element         | Role            |
| ------------------------- | ----------- | --------------- | --------------- |
| `<button>`                | button      | `<nav>`         | navigation      |
| `<a href>`                | link        | `<main>`        | main            |
| `<h1>`–`<h6>`             | heading     | `<aside>`       | complementary   |
| `<input type="text">`     | textbox     | `<header>`      | banner          |
| `<input type="checkbox">` | checkbox    | `<footer>`      | contentinfo     |
| `<select>`                | combobox    | `<dialog>`      | dialog          |
| `<table>` / `<tr>`        | table / row | `<ul>` / `<li>` | list / listitem |

---

## Assertions

All of these retry until they pass or `expect.timeout` expires, and all can be negated with `.not`
or made non-fatal with `expect.soft`.

| Assertion                            | Checks                               |
| ------------------------------------ | ------------------------------------ |
| `toBeVisible()` / `toBeHidden()`     | Visibility                           |
| `toBeAttached()`                     | Presence in the DOM (v1.33+)         |
| `toBeEnabled()` / `toBeDisabled()`   | Interactivity                        |
| `toBeChecked()`                      | Checkbox or radio state              |
| `toHaveText()` / `toContainText()`   | Text content, exact or partial       |
| `toHaveValue()`                      | Input value                          |
| `toHaveAttribute()`                  | Attribute presence and value         |
| `toHaveClass()` / `toContainClass()` | Class list (`toContainClass` v1.52+) |
| `toHaveCount()`                      | Number of matched elements           |
| `toHaveURL()` / `toHaveTitle()`      | Page URL and title                   |
| `toHaveScreenshot()`                 | Visual baseline                      |
| `toMatchAriaSnapshot()`              | Accessible tree (v1.49+)             |
| `toHaveAccessibleName()`             | Computed accessible name (v1.44+)    |
| `toHaveAccessibleDescription()`      | Computed description (v1.44+)        |
| `toHaveRole()`                       | Computed role (v1.44+)               |
| `toHaveAccessibleErrorMessage()`     | Validation message (v1.50+)          |
| `toPass()`                           | Any block, polled with intervals     |

`toHaveURL()` takes `{ ignoreCase: true }` since v1.50.

---

## Clock API (v1.45+)

`clock.install()` runs before any other clock method.

| Method                  | Effect                                                                              |
| ----------------------- | ----------------------------------------------------------------------------------- |
| `clock.install()`       | Start controlling time, at a set date                                               |
| `clock.pauseAt()`       | Stop at an exact moment                                                             |
| `clock.fastForward()`   | Jump forward, firing timers — a number is ms, a string is `"mm:ss"` or `"hh:mm:ss"` |
| `clock.runFor()`        | Tick through a duration                                                             |
| `clock.setFixedTime()`  | Freeze `Date.now()` while timers run                                                |
| `clock.setSystemTime()` | Move the system clock                                                               |
| `clock.resume()`        | Hand time back                                                                      |

---

## Configuration

| Option                | Effect                                    | Typical value                                                             |
| --------------------- | ----------------------------------------- | ------------------------------------------------------------------------- |
| `testDir`             | Where specs live                          | `'./tests/e2e'`                                                           |
| `fullyParallel`       | Parallel within a file too                | `true`                                                                    |
| `forbidOnly`          | Fail if `test.only` reaches CI            | `!!process.env.CI`                                                        |
| `retries`             | Retry failures                            | `process.env.CI ? 2 : 0`                                                  |
| `workers`             | Parallel workers                          | `process.env.CI ? 2 : undefined`                                          |
| `timeout`             | Per-test budget (ms)                      | `30_000`                                                                  |
| `expect.timeout`      | Per-assertion retry budget (ms)           | `5_000`                                                                   |
| `use.baseURL`         | Base for relative navigation              | dev server URL                                                            |
| `use.trace`           | Trace capture                             | `'on-first-retry'`                                                        |
| `use.screenshot`      | Screenshot capture                        | `'only-on-failure'`                                                       |
| `use.video`           | Video capture                             | `'retain-on-failure'`                                                     |
| `reporter`            | Output formats, stacked                   | `[['html'], ['list']]`, plus `['github']` under CI for inline annotations |
| `updateSnapshots`     | Baseline update policy (v1.50+)           | `'changed'`                                                               |
| `failOnFlakyTests`    | Treat a pass-on-retry as failure (v1.52+) | `true`                                                                    |
| `testProject.workers` | Workers for one project (v1.52+)          | `2`                                                                       |

### Suggested layout

```
tests/e2e/
├── fixtures/     auth.ts, database.ts, index.ts
├── pages/        base-page.ts, login-page.ts, dashboard-page.ts
├── auth/         login-flow.spec.ts, registration.spec.ts
├── checkout/     checkout-flow.spec.ts, payment-errors.spec.ts
└── visual/       homepage.spec.ts
```

Specs are grouped by user journey rather than by component, since that is how a failure is read.
Naming: `*.spec.ts` for tests, `*.smoke.ts` for the subset safe to run against production,
`*-page.ts` for page objects.

---

## CLI

```bash
npx playwright test                          # everything
npx playwright test tests/e2e/auth/login.spec.ts
npx playwright test -g "login"               # by title
npx playwright test --project=chromium
npx playwright test --headed | --ui | --debug
npx playwright test --shard=1/4              # split across CI machines
npx playwright test --update-snapshots
npx playwright codegen http://localhost:3000 # record a draft test
npx playwright show-report
npx playwright show-trace trace.zip
```

---

## Breaking changes

| Version | Change                                                                                                                                                                                                    |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v1.58   | `_react` / `_vue` selector engines removed; `:light` suffix removed; `devtools` option removed from `browserType.launch()`; WebKit needs macOS 14+                                                        |
| v1.57   | Chrome for Testing replaces Chromium in both modes; `page.accessibility` removed — audit the tree with `toMatchAriaSnapshot` or a dedicated auditing tool; `webServer.wait` added; `testConfig.tag` added |
| v1.56   | `browserContext.on('backgroundpage')` deprecated                                                                                                                                                          |
| v1.55   | Chromium extensions must use manifest v3                                                                                                                                                                  |
| v1.54   | Node 16 removed, Node 18 deprecated                                                                                                                                                                       |
| v1.52   | `?` and `[]` no longer supported in `page.route()` globs — use a regex; `route.continue()` cannot override `Cookie`                                                                                       |
| v1.50   | `toBeEditable()` throws on non-editable elements; `updateSnapshots: 'all'` is the default, `'changed'` restores the old behaviour                                                                         |

---

## Troubleshooting

| Symptom                           | Usually                                                 | Try                                                                                                     |
| --------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Passes sometimes, fails otherwise | A fixed wait, or state shared between tests             | Replace waits with retrying assertions; move setup into a fixture                                       |
| `Timeout waiting for locator`     | Element hidden, in an iframe, or in shadow DOM          | `page.frameLocator()`; chain `locator()` through the host element; check the element is rendered at all |
| Screenshots differ from CI        | Different OS, browser build or font rendering           | Generate baselines in the CI environment; mask dynamic regions; allow `maxDiffPixels`                   |
| Suite takes too long              | Serial execution, or logging in through the UI per test | `fullyParallel: true`; set up through the API; reuse stored auth state                                  |
