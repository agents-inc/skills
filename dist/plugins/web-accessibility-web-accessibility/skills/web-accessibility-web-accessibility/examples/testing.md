# Accessibility — Testing

> Automated auditing, role-based queries, and the manual pass. Rule IDs and the manual checklists are in [reference.md](../reference.md).

Automated auditing finds roughly half of WCAG failures — the machine-checkable half: a missing label,
an unnamed button, a contrast ratio. It cannot tell you whether the tab order made sense, whether the
alt text described the right thing, or whether the announcement arrived when the reader needed it.
Both passes are load-bearing.

---

## Auditing a rendered component

An axe-core audit runs against real DOM and reports rule violations with the element and the
severity. It is available as an adapter for every common test runner, and the assertion is the same
shape in all of them: render, audit, expect no violations.

**`runAxe`, `auditPage` and `visit` below stand for whatever the installed adapter calls them** —
every runner names them differently. The option names inside them (`runOnly`, `includedImpacts`,
`include`) are axe-core's own and are the same everywhere.

```typescript
it("has no accessibility violations", async () => {
  const { container } = render(<LoginForm />);
  const results = await runAxe(container);

  expect(results.violations).toEqual([]);
});

it("has no violations while showing an error", async () => {
  const { container } = render(<LoginForm errors={{ email: "Invalid email" }} />);
  const results = await runAxe(container);

  expect(results.violations).toEqual([]);
});
```

**Why good:** the second case is the one that matters — error, loading and empty states are rendered
by different branches, and an audit of the default state never reaches them. Audit each state the
component can be in, not each component.

**Targeting a WCAG version:**

```typescript
const results = await runAxe(container, {
  runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag22aa"] },
});
```

**Why good:** it pins what "passing" means. Without it the rule set changes when the auditing library
updates, and a green suite goes red on a dependency bump for reasons nobody changed.

**What a unit-level audit cannot see:** colour contrast, because a headless DOM implementation has no
layout or computed colours. Those checks need a real browser, which is why an end-to-end pass carries
part of the coverage.

---

## Auditing a real page

```typescript
it("has no critical or serious violations", async () => {
  await visit("/");
  const results = await auditPage({ includedImpacts: ["critical", "serious"] });

  expect(results.violations).toEqual([]);
});

it("has no violations in the main region", async () => {
  await visit("/");
  const results = await auditPage({ include: "main" });

  expect(results.violations).toEqual([]);
});
```

**Why good:** a real browser gives contrast, computed styles and the effect of the actual stylesheet,
none of which a headless DOM has. Scoping to a region keeps a third-party widget in a footer from
failing a build over markup nobody here controls.

**Adopting this on an existing codebase:** gate on critical and serious first and report the rest
without failing, then tighten. A gate that fails on day one against four hundred existing violations
gets switched off, which is worse than a gate that ratchets.

---

## Role-based queries as a check in themselves

```typescript
const submit = screen.getByRole("button", { name: "Submit form" });
const email = screen.getByLabelText("Email");
const toggle = within(row).getByRole("switch");
```

**Why good:** each of these fails when the accessibility is wrong, in an ordinary functional test.
A button with no accessible name cannot be found by name; an input with no label cannot be found by
label. Test id queries pass either way, which is why they hide exactly these defects.

Useful roles: `button`, `link`, `textbox`, `checkbox`, `switch`, `dialog`, `alert`, `status`,
`listbox`, `option`, `table`, `columnheader`, `heading` — with `{ level: 2 }` to check the outline.

**The trade:** a query by role is coupled to the markup being right, which is the point. When one
starts failing after a refactor, the first question is whether the accessibility regressed rather
than whether the query needs loosening.

---

## Gating in CI

Audit scores and violation counts both belong in the pipeline, and the useful settings are the same
either way: what severity blocks a merge, what is reported and tracked, and how a known exception is
recorded so it does not read as an unfixed failure.

Every suppression carries a reason. An unexplained one is indistinguishable from an unfixed
violation, and both survive equally long.

---

## The manual pass

No automation covers these. Run them on anything interactive before it ships:

- Tab through the whole page and watch the focus indicator — the order, and whether it is ever invisible
- Open every dialog and menu with the keyboard, close it with Escape, and confirm focus came back
- Turn on a screen reader and use the flow end to end without looking at the screen
- Zoom to 200% and check nothing scrolls horizontally or overlaps
- Turn on reduced motion and confirm the interface still communicates what it needs to

The screen reader pass is the one people skip and the one that finds the most. Fifteen minutes with
a built-in screen reader — VoiceOver or TalkBack — costs nothing and surfaces what no rule ID would
have caught.

The full checklists are in [reference.md](../reference.md).
