# Web Planning — Core Examples

> Bad and good spec fragments for the patterns in [SKILL.md](../SKILL.md). The feature throughout is profile editing: users change their name, email and bio in a dialog opened from their profile page. Read in order, the good fragments are that spec's web sections — the worked example. Its goal, context, requirement tiers and handoffs come from the spec's own format.

---

## Pattern 1: UI-State Completeness

A list surface, where all four states and a refresh apply:

```
BAD:  "Show the user's projects on the dashboard"

GOOD: "Projects panel:
       - Loading: 3 skeleton rows sized like a ProjectCard, shown once
         loading passes 1 second
       - Error: inline 'Could not load projects' with Retry; no toast
       - Empty, no projects: 'No projects yet' with a 'Create project' button
       - Empty, filtered: 'No projects match these filters' with 'Clear filters'
       - Success: ProjectCard grid, newest first, 20 per page with Load more
       - Refresh: current cards stay while reloading; a failed refresh keeps
         them and shows 'Showing saved results. Retry?'"
```

The bad version specifies one state. The rest are invented during implementation and found in review, or in production.

The profile dialog, where two states are ruled out rather than skipped:

```
GOOD: "Edit-profile dialog:
       - Loading: ruled out — fields fill from the user store, already loaded
       - Saving: Save disabled with 'Saving…'; fields disabled
       - Error: per the form contract — a 422 and a network failure both keep
         the entered values
       - Empty: ruled out — a signed-in user always has a profile
       - Success: 'Profile updated', the dialog closes, the page shows the new
         values"
```

**Indicator timing, for the numbers a spec states:** no indicator under about a second, since it only flashes; a looped indicator for waits of a few seconds; a percent-done indicator past about ten. Guidelines agree on that shape and differ on the exact switch-over points, so the spec states its own.

---

## Pattern 2: Component Boundaries

```
BAD:  "Follow our standard modal and form patterns"

GOOD: "- Edit dialog: reuse components/modals/modal-container.tsx:12-78 —
         overlay, focus trap, Escape and onClose come with it
       - Form: follow components/settings/settings-form.tsx:45-89 — validation
         timing, error display and success message
       - Bio field: extend components/form/text-area.tsx:8-40 with an optional
         character counter; text-area.tsx joins the modified files, and its
         other consumers pass no counter and render unchanged
       - Save request: lib/user-service.ts:34-56, the apiClient.put() wrapper
       - Store action: stores/user-store.ts:23-34, shaped like updateUser()"
```

Every reference names a file and lines that were read, and what it supplies. "Follow our patterns" with no path means nobody checked one exists, and a "create" with no line on why nothing existing fits reads as nobody having looked.

---

## Pattern 3: Form Contracts

```
BAD:  "Add an edit-profile form with validation"

GOOD: "Fields:
       - name: text, required, initial = current name. Empty on submit:
         'Name is required'
       - email: email, required, format checked when the field loses focus and
         re-checked as the user types once flagged. Invalid: 'Enter a valid
         email address' below the field
       - bio: textarea, optional, 500 characters max, counter shown from 400

       Submission: PUT /api/users/:id through lib/user-service.ts:34-56.
       Save disabled with 'Saving…' while pending.
       Success: 'Profile updated', the dialog closes.
       Server 422: each field error shown at its input; values kept.
       Network failure: 'Could not save. Retry?' above the actions; values kept.
       Unsaved changes: closing with edits asks 'Discard changes?'"
```

The email timing follows the codebase's existing convention — flag on leaving the field, clear on the first valid keystroke. A codebase that validates on submit instead gets an error summary that takes focus and links to each field, worded the same as the message at the field.

---

## Pattern 4: State Ownership

```
BAD:  "Store the form values, the profile and the projects list in UserStore"

GOOD: "- Draft form values: ProfileEditDialog local state, discarded on close
       - Saved profile: stores/user-store.ts — add updateProfile() only; the
         store's existing shape is unchanged
       - Bio character count: derived from the draft bio, not stored
       - Projects list: read through the data-access layer, not copied
       - Project filter and page: the URL params status and page"
```

The draft lives in the dialog because nothing outside it reads it; copied into the store, a cancelled edit would leave a stale draft for the next open to find.

---

## Pattern 5: Fencing the Shared UI Surface

```
BAD:  "Don't break anything"

GOOD: "Do not modify: auth/ — session handling for every page;
       components/shared/ — rendered across the app; styles/ — global
       styles and tokens.
       Partly fenced: stores/user-store.ts — add updateProfile() only; the
       header and settings page read its existing fields.
       Verify: git diff -- auth/ components/shared/ styles/ is empty."
```

Each entry says who depends on it, so a developer who finds a reason to cross the line knows what they would break.

---

## Pattern 6: Observable Success Criteria

```
BAD:  - Feature works well
      - Good user experience
      - No bugs

GOOD: 1. Clicking "Edit profile" opens the dialog with the current name,
         email and bio — manual check
      2. An invalid email shows "Enter a valid email address"; correcting it
         clears the message — component test
      3. Save updates the profile and shows "Profile updated" within
         2 seconds — component test
      4. A network failure shows "Could not save. Retry?" and keeps the
         entered values — component test with a failing request
      5. Every control is reachable by Tab, Escape closes the dialog, and
         focus returns to "Edit profile" — keyboard check
      6. "Profile updated" is announced by a screen reader — screen-reader check
      7. git diff -- auth/ components/shared/ styles/ is empty — command
```

Each good criterion can fail, and says how someone finds out that it did.
