---
name: meta-planning-web-planning
description: Frontend specification planning frameworks. Use when a spec touches UI components, forms, client state, or user-facing flows. Covers UI-state completeness (loading, error, empty, success), component boundaries, form validation contracts, state ownership, and measurable UI success criteria.
---

# Web Planning Frameworks

> **Quick Guide:** A UI spec is a contract about what the user sees in every state, and a state nobody specified still renders — as whatever the developer improvised. For each data-driven surface, specify loading, error, empty and success; for each UI piece, decide reuse, extend or create against a named component; for each form field, the rule, when it fires and the exact message; for each piece of state, one owner; and for each success criterion, what a reviewer will see. Apply a framework only where the feature touches its artifact — a feature with no form carries no form contract.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — bad and good spec fragments for each pattern; read in order, the good ones are the web sections of a worked profile-editing spec

---

<critical_requirements>

## Before writing a frontend spec

**Specify loading, error, empty and success for every data-driven surface, or rule a state out in writing.** An unspecified state still renders — as a blank region, a spinner that never resolves, or whatever the developer guessed.

**Decide reuse, extend or create for each UI piece, naming by file and lines the existing component each decision was measured against.** A spec that says "a modal" gets a new modal; one that names the existing modal gets its focus handling and dismissal for nothing.

**Give each form field its rule, when the rule fires, and the exact message.** Timing and wording left open are decided form by form, so two forms in one product validate differently.

**Bound the change to named files and directories, with a do-not-touch list naming each shared store, component and auth surface the feature only consumes.** Without one, the feature "fixes" a shared store or component on the way through and breaks its other consumers.

**Name one owner for each piece of state the feature introduces.** Two owners drift apart after the first update, and state in the wrong owner is the costliest thing in the feature to move later.

**Write each success criterion as something a reviewer can see or do in the UI, with how it is checked.** "Validation works" is met by any implementation; "an invalid email shows 'Enter a valid email address' below the field" is met by one.

</critical_requirements>

---

**Auto-detection:** UI spec, frontend spec, component spec, page spec, form spec, modal spec, loading state, empty state, error state, skeleton screen, validation message, validation timing, error summary, client state ownership, URL state, do-not-touch list, UI acceptance criteria

**Applies to:**

- Specifying new or changed components, pages, dialogs and flows
- Specifying forms: fields, validation, submission, success and failure
- Deciding whether a store, a component or the URL owns each piece of client state
- Writing success criteria a reviewer checks against the rendered UI

**Handled elsewhere:**

- The spec's own structure — goal, context, requirement tiers, the list of files to modify and create, and the handoffs to testing and review — belongs to the specification format these sections sit inside.
- The endpoint the UI calls — its request and response shapes, status codes and auth are specified on the API side; this spec names the endpoint and maps each of its failures to what the user sees.
- How components are built — their internals, data wiring, memoisation and styling approach — is the implementation's; the spec states behaviour and the patterns to follow.
- Visual design — spacing, colour and type are the design system's, and the spec restates none of it.

---

<decision_framework>

## Which sections the spec needs

Each yes adds a section. A section the feature never touches is left out rather than filled with "N/A".

- **Renders data, fetched or held locally** → UI states (Pattern 1), one block per surface
- **Includes a form** → form contract (Pattern 3)
- **Introduces or moves client state** → state ownership (Pattern 4)
- **Changes any UI** → component boundaries (Pattern 2), the shared-surface fence (Pattern 5) and observable criteria (Pattern 6)

Inside a section that applies, the rule reverses: a state or field that cannot occur is ruled out in writing, because silence there reads as an oversight.

</decision_framework>

---

<patterns>

## Core patterns

### Pattern 1: UI-State Completeness

Every data-driven surface gets four states, each specified or ruled out. A surface rendering local data — a cart held in a store, recently viewed items — still gets an empty state; its loading and error are ruled out.

```markdown
- Loading — what renders, and after what delay it appears
- Error — the message, whether Retry is offered, and what stays on screen
- Empty — first use, and no results for the current filters, where they differ
- Success — one item, many, and overflow: pagination, truncation or scroll
```

Where the data refreshes after first load, also specify what stays visible during the refresh and what a failed refresh does to data already on screen.

Full fragments: [examples/core.md](examples/core.md#pattern-1-ui-state-completeness)

### Pattern 2: Component Boundaries

For each UI piece the feature adds, the spec decides reuse, extend or create, and names what it measured against by file and lines.

```markdown
- [UI piece] — reuse | extend | create [file:lines] — [what it supplies, or why nothing fits]
- Edit dialog — reuse components/modals/modal-container.tsx:12-78 — focus trap, Escape, overlay
```

The references a frontend spec usually needs are the nearest component, form, dialog and store, the wrapper the codebase calls its API through, and the validation helpers its forms already share — each at lines someone actually read. The decision covers utilities as well as UI pieces: validation helpers, API client wrappers and shared inputs are named for reuse rather than re-created, because two copies of one email check soon disagree. Extending a shared component changes it for every consumer, so an "extend" moves that file into the modified list and says what its other consumers see.

Full fragments: [examples/core.md](examples/core.md#pattern-2-component-boundaries)

### Pattern 3: Form Contracts

A form is specified field by field, then as a whole:

- **Fields** — name, input type, initial value and where it comes from
- **Validation** — the rule, when it fires, the exact message and where it shows
- **Submission** — what is sent where, and what the submit control does while the request is pending
- **Success** — the message or navigation that confirms the save
- **Failure** — server field errors mapped back to their inputs, network failure, and entered values kept through both
- **Unsaved changes** — whether leaving with edits warns

**Validation timing is a product-wide convention, so the spec names the one the codebase already uses rather than choosing per form.** The two common conventions: validate on submit, then show an error summary that takes focus and links to each field; or flag a field when the user leaves it and clear the error as soon as the input is valid. Neither flags a field while it is first being typed into.

Full fragments: [examples/core.md](examples/core.md#pattern-3-form-contracts)

### Pattern 4: State Ownership

Each piece of state the feature introduces or touches has exactly one named owner.

```markdown
- [ ] Owner named — a store, one component's local state, or the URL
- [ ] Derived values computed from existing state, never stored beside it
- [ ] Server data read through the existing data-access layer, not copied into a store
- [ ] Shareable view state — filters, sort, page, active tab — in the URL
- [ ] Existing store shapes unchanged unless the spec says otherwise
```

The URL test is whether someone opening the link should see the same view. An open dialog and an unsaved edit fail it and stay out.

Full fragments: [examples/core.md](examples/core.md#pattern-4-state-ownership)

### Pattern 5: Fencing the Shared UI Surface

The spec's file list says what the feature changes; the frontend half of the fence names the shared surfaces it consumes and leaves alone, each with who depends on it, and a command that proves the fence held.

```
Do not modify: [shared surface] — [who else depends on it]
Partly fenced: [file] — [the one change allowed]
Verify: git diff -- [fenced paths] is empty
```

The usual candidates: shared components and their props, stores other features read, global styles and design tokens, routing configuration, and session handling.

Full fragments: [examples/core.md](examples/core.md#pattern-5-fencing-the-shared-ui-surface)

### Pattern 6: Observable Success Criteria

Each criterion names something a reviewer can see or do in the running UI, and how it is checked.

```markdown
1. An invalid email shows "Enter a valid email address" below the field — component test
2. Closing the dialog returns focus to "Edit profile" — keyboard check
```

Accessibility criteria cover what the feature adds: each new control reachable and operable by keyboard, focus placed on open and returned on close, each input labelled, and status messages such as "Saved" announced to screen readers without taking focus. A performance criterion carries a number or is left out.

Full fragments: [examples/core.md](examples/core.md#pattern-6-observable-success-criteria)

</patterns>

---

<red_flags>

## Red flags

**Leaves the spec incomplete:**

- Only the success state written for a surface that fetches — the other three ship as whatever was quickest to build — specify each or rule it out.
- "With validation" in place of a per-field contract — each developer picks their own timing and wording — give each field its rule, timing and message.
- "Use our usual modal" with no path — nobody confirmed the pattern exists, and a second modal gets built — name the file and lines.
- A dialog specified by its content alone — close, cancel, Escape and where focus lands are left to chance — specify them, or reuse a container that owns them.
- Server data copied into a store — two sources of truth, and the copy goes stale after the first update made elsewhere — read it through the data-access layer.
- No do-not-touch list on a feature that consumes shared stores or components — a store gets "fixed" and its other consumers break — fence each shared surface with who depends on it.
- A criterion such as "works well" or "good UX" — nothing can fail it, so review turns into opinion — write what the reviewer will see.

**Easy to miss:**

- A submit button disabled until the form is valid. A disabled button leaves the tab order and gives no reason, so keyboard and screen-reader users cannot find what is missing; keep it enabled and report errors on submit, or specify the visible reason it is unavailable. Disabling it while the request is pending is a separate decision, and prevents a double submit.
- A dialog action that removes the control which opened it. Focus has nowhere to return, so the spec names where it goes.
- A refresh that fails while data is already on screen. Keep the stale data with a notice, or replace it with the error state — left unspecified, both ship in different places.
- One "empty" covering both "nothing exists yet" and "no results for these filters". The first wants a create action, the second a way to clear the filters.
- A loading indicator shown immediately. Under about a second it only flashes, so the spec states the delay before it appears.
- An optimistic update with no rollback. The UI shows a save that did not happen; specify the rollback and its message, or rule optimism out.
- A filter, sort or page held in component state. A reload and the back button both lose it.
- An enhancement written into the must-have list. Scope creep starts in the spec: everything listed as must-have is built and reviewed as required, so a "should have" belongs in its own tier.

</red_flags>
