---
name: meta-planning-web-planning
description: Frontend specification planning frameworks. Use when a spec touches UI components, forms, client state, or user-facing flows. Covers UI-state completeness (loading, error, empty, success), component boundaries, form validation contracts, state ownership, and measurable UI success criteria.
---

# Web Planning Frameworks

> **Quick Guide:** Specify every state the UI can be in — loading, error, empty, and success are four different screens, and an unspecified one ships as a blank div. Reference the concrete component and form patterns the implementation must follow (file:line), bound the change to named directories, and write success criteria a reviewer can check with a yes/no: which element appears, what the validation rejects, what the user sees on a network error.

---

<critical_requirements>

## CRITICAL: Before Specifying Frontend Work

> **All specifications must be grounded in the codebase's real components, stores, and form patterns** — reference specific files with line numbers

**(You MUST specify every UI state the feature can render — loading, error, empty, and success — or explicitly rule one out)**

**(You MUST reference the concrete component, form, and store patterns to follow, with file and line numbers)**

**(You MUST specify validation per field — the rule, when it fires, and the exact message shown)**

**(You MUST bound the change to named files and directories, with an explicit do-not-touch list)**

**(You MUST write success criteria as yes/no checks a reviewer can verify — never "works well" or "good UX")**

</critical_requirements>

---

**Auto-detection:** UI spec, component spec, frontend feature spec, form spec, modal spec, loading state, empty state, error state, client state design, frontend success criteria

**When to use:**

- Specifying new or changed UI components, pages, or flows
- Specifying forms: fields, validation rules, submission behavior, error display
- Specifying where client state lives and which store owns it
- Specifying loading, error, empty, and success behavior
- Defining measurable success criteria for user-facing work

**When NOT to use:**

- When implementing components (use the relevant web implementation skill)
- For the API the UI calls (use the api planning skill)
- For the planning PROCESS itself — research, scope fencing, success criteria structure — which the PM agent carries

**Key patterns covered:**

- UI-state completeness (loading, error, empty, success)
- Pattern-reference discipline for components, forms, and stores
- Form contracts: fields, validation, submission, feedback
- State ownership and reuse boundaries
- Scope fencing by directory
- Measurable UI success criteria

**Detailed Resources:**

- [examples/core.md](examples/core.md) - Spec fragments and a worked example specification

---

<philosophy>

## Philosophy

**A UI spec is a contract about what the user sees, in every state.** The happy path is the easy fifth of the work; the loading spinner, the validation message, the empty list, and the failed request are where an unspecified feature quietly becomes four different developers' four different guesses.

**When specifying frontend work:**

- Find the closest existing component, form, and modal first — their patterns are the spec's vocabulary, referenced by file:line
- Walk the feature through all four states — loading, error, empty, success — and write down what each renders
- Specify validation as the user experiences it: the rule, when it fires, and the exact message
- Name what must NOT change: the stores, shared components, and auth surfaces the feature merely touches

**When NOT to specify:**

- Don't specify implementation details (hook wiring, memoization) — behavior and patterns, not code
- Don't design new UI primitives when the codebase's component library covers the need
- Don't specify visual design beyond what the existing design system already decides
- Don't add "should have" enhancements to the must-have list — scope creep starts in the spec

**Core principles:**

- **Four states or an explicit ruling-out**: an unhandled state ships as a blank screen
- **Patterns by reference, not description**: "follow SettingsForm.tsx:45-89" beats "use proper form handling"
- **State has one owner**: name the store or component that holds each piece; duplicated state is a spec defect
- **Criteria are yes/no**: "invalid email shows an error message" is checkable; "validation works" is not

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: UI-State Completeness

Every data-driven surface has four states. Specify each, or explicitly rule it out.

```markdown
## UI States

For EACH data-driven surface the spec adds or changes:

- [ ] Loading — what renders while data is in flight (skeleton, spinner, disabled control)
- [ ] Error — what the user sees on failure, and whether retry is offered
- [ ] Empty — what renders with zero items, and whether a call-to-action belongs there
- [ ] Success — the populated state, including singular/plural and overflow behavior
```

```
BAD:  "Show the user's projects"
GOOD: "Loading: 3 skeleton rows. Error: inline message with Retry button.
       Empty: 'No projects yet' with a Create button. Success: project cards,
       newest first, 20 per page."
```

**Why this matters:** the unspecified states are the ones users hit at the worst moments — slow networks and failures. A spec that covers only success delegates the other three to chance.

---

### Pattern 2: Pattern-Reference Discipline

Reference the concrete implementation to follow, never a style in the abstract.

```
BAD:  "Use proper form handling"
GOOD: "Follow the form pattern from SettingsForm.tsx:45-89. Use the same validation
       approach, error display, and success messaging."

BAD:  "Open it in our usual modal"
GOOD: "Use the ModalContainer pattern from components/modals/UpdateAllProjects.tsx:12-78 —
       overlay, positioning, and onClose handled by the container."
```

**Rules the spec must state:**

- Every referenced pattern names a file and line range that was actually read — an unverified reference is a guess
- Why each pattern is the right reference, in one line
- Which utilities and components must be reused rather than re-created (validation helpers, API client wrappers, shared inputs)

---

### Pattern 3: Form Contracts

A form is specified field by field, then as a whole.

| Element     | Specify                                                                           |
| ----------- | --------------------------------------------------------------------------------- |
| Fields      | Name, input type, initial value and where it comes from                           |
| Validation  | Rule per field, when it fires (on blur, on submit), exact error message           |
| Submission  | What is sent, to which endpoint, and the button's disabled-while-pending behavior |
| Success     | The message or navigation that confirms the save                                  |
| Failure     | Network and server-validation errors — what is shown, what is preserved           |
| Dirty state | Whether unsaved changes warn on close/navigation                                  |

```
BAD:  "Validate the email"
GOOD: "email: required, format-validated on blur. Invalid: 'Enter a valid email
       address' below the field. Submit disabled while pending; server 422 maps
       field errors back to the matching inputs, values preserved."
```

---

### Pattern 4: State Ownership

Every piece of state has exactly one named owner.

```markdown
## State Ownership

For EACH piece of state the feature introduces or touches:

- [ ] Owner named: which store, or which component's local state
- [ ] Derived values computed, not stored — if it can be computed from existing state, it is
- [ ] Server data cached through the codebase's existing data-fetching layer, not mirrored into a store
- [ ] Existing store structures unchanged unless the spec explicitly changes them
```

**Why this matters:** state added in the wrong place is the hardest thing to move later. A spec that says "add updateProfile to UserStore, do not restructure it" prevents both the second store and the accidental rewrite.

---

### Pattern 5: Scope Fencing by Directory

Bound the change in file terms, both directions.

```markdown
## Scope Boundaries

**Files to Modify:** [each named file, with what changes in it]
**Files to Create:** [each new file, with its purpose]
**Files NOT to Touch:** [the stores, shared components, and auth surfaces the feature
merely consumes — with why each is off-limits]
```

```
BAD:  "Don't break anything"
GOOD: "Do not modify: the authentication flow (auth/), existing stores (stores/),
       shared components (components/shared/). Changes are limited to profile/."
```

A verification command belongs with the fence: `git diff -- <excluded paths>` should be empty.

---

### Pattern 6: Measurable UI Success Criteria

Each criterion is a yes/no check with a named verification method.

```
BAD:  - Feature works well
      - Good user experience
      - No bugs

GOOD: 1. Clicking "Edit Profile" opens the modal with current name, email, bio
      2. Invalid email shows 'Enter a valid email address'; valid input clears it
      3. Save updates the profile and shows the success message within 2 seconds
      4. Network failure shows the retry message; entered values are preserved
      5. All interactive elements reachable by keyboard; focus returns to the
         trigger button on close
      6. No changes outside profile/ (git diff -- stores/ components/shared/ is empty)
```

**Rules the spec must state:**

- Each criterion names how it is verified: a test file, a manual check, or a command
- Accessibility criteria are stated for what the feature adds — keyboard reachability, focus behavior, labels
- Performance criteria carry a number when they exist at all ("under 2 seconds", not "fast")

</patterns>

---

<decision_framework>

## Decision Framework

### Which Spec Sections Does This Feature Need?

```
Does the feature render data from an async source?
├─ YES → UI States section (Pattern 1) — all four states
└─ Does it include a form?
    ├─ YES → Form Contract section (Pattern 3), field by field
    └─ Does it introduce or move client state?
        ├─ YES → State Ownership section (Pattern 4)
        └─ NO  → Pattern references + scope fence + criteria may be the whole spec
```

Always applicable: Pattern-reference discipline (Pattern 2), Scope fencing (Pattern 5), Measurable criteria (Pattern 6).

### Common Spec Failures

| Failure                                | Consequence                                                   |
| -------------------------------------- | ------------------------------------------------------------- |
| Only the success state specified       | Loading, error, and empty ship as blank or broken screens     |
| "Use proper form handling"             | Each form invents its own validation timing and error display |
| No do-not-touch list                   | The feature "fixes" a store and breaks its other consumers    |
| Criteria like "works well"             | Nothing gates the merge; review becomes opinion               |
| Server data mirrored into a store      | Two sources of truth; stale UI after every mutation           |
| Pattern reference without line numbers | The reference was never verified to exist                     |

</decision_framework>

---

<red_flags>

## RED FLAGS

**High Priority Issues (a spec with one of these is incomplete):**

- A data-driven surface with no loading, error, or empty behavior specified
- A form without per-field validation rules and messages
- No do-not-touch list on a feature that consumes shared stores or components
- Success criteria that cannot be answered yes/no

**Medium Priority Issues:**

- A new component where the referenced codebase pattern already provides one
- State introduced without a named owner
- Accessibility unmentioned on new interactive elements
- A pattern reference to a file that was never read

**Common Mistakes:**

- Specifying the modal's content but not its close/cancel/focus behavior
- Leaving "what happens to entered values on failure" undecided
- Writing enhancement wishes into the must-have list
- Describing visual design the design system already decides

**Gotchas & Edge Cases:**

- Empty and error states can coincide (failed load of an empty list) — decide which wins
- A disabled submit button needs a reason the user can see
- Optimistic updates need a rollback story in the spec, or must be explicitly out of scope

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All specifications must be grounded in the codebase's real components, stores, and form patterns**

**(You MUST specify every UI state the feature can render — loading, error, empty, and success — or explicitly rule one out)**

**(You MUST reference the concrete component, form, and store patterns to follow, with file and line numbers)**

**(You MUST specify validation per field — the rule, when it fires, and the exact message shown)**

**(You MUST bound the change to named files and directories, with an explicit do-not-touch list)**

**(You MUST write success criteria as yes/no checks a reviewer can verify)**

**Failure to specify these contracts produces UIs whose error and empty states are accidents, whose forms each validate differently, and whose "done" nobody can verify.**

</critical_reminders>
