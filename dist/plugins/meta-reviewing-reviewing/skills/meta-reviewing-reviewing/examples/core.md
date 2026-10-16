# Code Review - Core Examples

> Worked reviews for the patterns in [SKILL.md](../SKILL.md). Comment prefixes and platform review states are in [reference.md](../reference.md).

---

## Pattern 1: Purpose first, then the core of the change

### Good Example - The design finding leads

```markdown
**Must Fix — the queue cannot survive a restart** · `src/sync/job-queue.ts:12`

Jobs are held in an in-memory array, and success criterion 3 is "queued jobs survive
a process restart". The worker, the retry policy and the tests in this diff all build
on that store, so I have held line-level comments until the storage approach is
settled — most of them would be about code the change replaces.
```

**Why good:** The one finding that decides whether the rest of the diff survives arrives before any line comment on code that is about to be rewritten, and it is tied to the criterion it fails.

### Bad Example - A finding from a partial read

```markdown
`profile-form.tsx:30` — the validation logic seems incomplete; phone numbers are never checked.
```

```typescript
// profile-form.tsx, line 145 — below where the reading stopped
const { validateEmail, validatePhone } = useValidation();
```

**Why bad:** The check exists. The author spends a round proving it, and every other finding in the review is now read with suspicion.

---

## Pattern 2: The finding

### Good Example - Location, problem, consequence, existing pattern

```markdown
**Must Fix — failed save reported as success** · `src/profile/save-profile.ts:42`

The `put` call has no rejection path, and `profile-form.tsx:88` shows "Saved"
unconditionally, so a failed save reads as success and the edit is lost on reload.
Map the rejection to the form's error state, as `settings/save-settings.ts:31` does.
```

**Why good:** The author can open the line, see why it matters to a user, and copy a shape the codebase already trusts — no follow-up question needed.

```markdown
**Should Fix — `any` hides a shape the codebase already names** · `src/profile/profile-card.tsx:23`

`profile: any` lets a renamed field compile and fail at render. `UserProfile` in
`types/user.ts` describes exactly this object.
```

**Why good:** The consequence — a rename that compiles and breaks at runtime — is what makes this more than a style note.

### Bad Example - Vague, with no location

```markdown
- This code needs improvement
- There are some issues with the types
- The error handling could be better
```

**Why bad:** Nothing here can be acted on. The author has to ask which code, which types and which errors, and the answers arrive a round later.

### Bad Example - About the author, not the code

```markdown
Why did you use a worker thread here when there's obviously no benefit?
```

**Better:** "The worker thread adds a message-passing boundary without a performance benefit I can see — the job is a single 2 ms transform. Is there a load this is meant for?"

---

## Pattern 3: Labelled severity

### Good Example - Grouped under severity

```markdown
**Must Fix**

- `search.ts:24` — the search term is interpolated into SQL, so any caller can read
  the whole table. Use the parameterised form from `orders.ts:41`.

**Should Fix**

- `search.ts:35` — an empty term throws, and the spec's search box implies an empty
  term means "all users". Return the first page, as `users.ts:20` does.

**Nice to Have**

- nit: `rows` → `matchingUsers` at `search.ts:30`; three lists are in scope there
```

### Good Example - Prefixed inline comments

```markdown
issue (blocking): the search term reaches SQL unparameterised — any caller can read the table.
issue (non-blocking): an empty term throws; the search box implies it means "all users".
nitpick: `rows` → `matchingUsers`; three lists are in scope here.
```

### Bad Example - Everything at the same weight

```markdown
- Fix the typo in the comment on line 3
- Add validation on the search input
- Use a more descriptive variable name
- Fix the SQL injection on line 24
```

**Why bad:** Read as four equal requirements. The typo and the rename get fixed first, and the injection sits in the same list as a comment typo.

---

## Pattern 4: Scope against the spec

The specification asked for email validation, name and bio editing, and saving. It said "leave the authentication system unchanged".

### Good Example - Scope findings

```markdown
**Should Fix — unrequested features** · `profile-form.tsx:60-140`

Phone validation, avatar upload and password change are not in the spec, so nothing
says what correct looks like for them and they are being reviewed against nothing.
Move them to their own change with their own criteria.

**question:** `src/auth/session.ts` changed, and the spec fences auth off. Is this a
dependency of the profile save, or a stray edit? If stray, it is a Must Fix to revert.

**Should Fix — reinvented utility** · `profile-form.tsx:45`

This `validateEmail` duplicates the one exported from `lib/validation.ts`, which the
signup form already uses; two copies will drift on the next rule change.
```

**Why good:** Each finding says why the scope matters — unspecified behaviour, a fenced-off module, a drift risk — and the out-of-scope file is asked about before it is condemned.

### Bad Example - The reviewer's own scope creep

```markdown
- While you're in here, the settings page has the same validation problem
- The whole form module would read better as a state machine
- Consider extracting a generic `useEntityForm` for future forms
```

**Why bad:** None of it is in the diff or the spec. The author cannot weigh these against the change's purpose, and the review's real findings are now one list among many.

---

## Pattern 5: Evidence for the verdict

```markdown
## Success criteria

| Criterion                        | Status | Evidence                                      |
| -------------------------------- | ------ | --------------------------------------------- |
| Edit form rejects invalid emails | MET    | `profile-form.test.ts:41` asserts the message |
| Name and bio save on submit      | MET    | `save-profile.test.ts:18`                     |
| A failed save shows an error     | UNMET  | `save-profile.ts:42` — see Must Fix #1        |

**Reviewed:** `profile-form.tsx`, `save-profile.ts`, `profile-card.tsx` and both test files, in full.
**Not reviewed:** `src/api/generated/*` — regenerated from the schema; `users.ts` spot-checked.
```

**Why good:** The verdict can be checked rather than trusted, and the exclusion means nobody reads the approval as covering the generated client.

---

## Pattern 6: Specific praise

### Good Example

```markdown
- Reuses `formatOutput` instead of adding a second serializer, so `--json` and the
  table view cannot drift apart (`status.ts:31`)
- The exit code is preserved on both output paths, and `status.test.ts:58` pins it
```

**Why good:** Each names a decision and the reason it was right, which is what tells the author to make it again.

### Bad Example - Generic

```markdown
- Excellent use of the existing validation pattern
- Good error handling following our conventions
- Tests are comprehensive and well-structured
- Clean implementation matching the pattern
```

**Why bad:** Any review of any diff could say this. It teaches nothing, and a reader learns to skip the section — including on the review where it mattered.

### Bad Example - Nothing but problems

```markdown
- Fix line 23
- Fix line 45
- Fix line 67
- LGTM once fixed
```

**Why bad:** The author learns what to change but not what to keep doing, and the review reads as a verdict on them rather than on the code.

---

## Pattern 7: The clean review

### Good Example - Complete with zero findings

```markdown
# Review: add `--json` to the `status` command

**Verdict:** Approve — both criteria met; no findings.

| Criterion                               | Status | Evidence                                |
| --------------------------------------- | ------ | --------------------------------------- |
| `status --json` emits machine output    | MET    | `status.ts:31`; test asserts the schema |
| Human output unchanged without the flag | MET    | snapshot unchanged                      |

**Done well:** reuses `formatOutput` rather than a second serializer (`status.ts:31`).
```

### Bad Example - Padded to look thorough

```markdown
**Should Fix**

- Consider extracting the flag parsing into a shared helper for future commands
- This might need caching if `status` is ever called in a loop
- The variable name `out` could be more descriptive
```

**Why bad:** None of it passes the cost gate — no spec asks for it and no cost is shown in this diff. A clean diff now reads as one with three open findings, and the next review that carries a real one gets skimmed.
