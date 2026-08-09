# Web Planning - Spec Fragments and Worked Example

> Good/bad specification fragments for frontend work, and a complete worked example. See [../SKILL.md](../SKILL.md) for the frameworks behind each.

---

## UI States — specified vs delegated to chance

```
BAD:  "Show the user's projects on the dashboard"

GOOD: "Projects panel states:
       - Loading: 3 skeleton rows matching ProjectCard dimensions
       - Error: inline 'Could not load projects' with a Retry button; no toast
       - Empty: 'No projects yet' with a 'Create project' button
       - Success: ProjectCard grid, newest first, 20 per page with Load More"
```

The BAD version specifies one of four states. The other three get invented during implementation and discovered in review — or production.

---

## Form Contract — field by field

```
BAD:  "Add an edit-profile form with validation"

GOOD: "Fields:
       - name: text, required, initial = current name. Empty on submit: 'Name is required'
       - email: text, required, format-validated on blur. Invalid: 'Enter a valid
         email address' below the field
       - bio: textarea, optional, max 500 chars, counter shown from 400

       Submission: PUT /api/users/:id via the apiClient pattern (lib/user-service.ts:34-56).
       Save disabled while pending. Success: 'Profile updated' message, modal closes.
       Server 422: field errors mapped back to inputs, entered values preserved.
       Network failure: 'Could not save. Retry?' — values preserved."
```

---

## Pattern References — verified, not vibes

```
BAD:  "Follow our standard modal and form patterns"

GOOD: "1. Modal: components/modals/UpdateAllProjects.tsx:12-78 — ModalContainer wrapper,
          overlay and positioning provided, onClose prop
       2. Form: components/settings/SettingsForm.tsx:45-89 — validation approach,
          error display, success messaging
       3. API: lib/user-service.ts:34-56 — apiClient.put() pattern
       4. Store: stores/UserStore.ts:23-34 — updateUser() action shape"
```

Every reference names a file and lines that were actually read. "Follow our patterns" with no path means no pattern was verified to exist.

---

## Scope Fence — both directions

```
BAD:  "Don't break anything"

GOOD: "Modify:  components/profile/UserProfile.tsx (add button and modal state),
                stores/UserStore.ts (add updateProfile action only)
       Create:  components/profile/ProfileEditModal.tsx
       Do NOT touch: authentication system, stores/ structure, components/shared/
       Verify:  git diff -- components/shared/ returns empty"
```

---

## Worked example — user profile editing

```markdown
# User Profile Editing

## Goal

Add profile editing so users can update their name, email, and bio.

## Context

**Why:** Top customer request (Issue #123). Users can't modify profile after signup.

**Current State:**

- Profile display: `components/profile/UserProfile.tsx`
- Profile data: `stores/UserStore.ts`
- API endpoint: `PUT /api/users/:id`

**Desired State:** User clicks "Edit Profile" -> modal opens -> edits fields -> saves -> profile updates

## Patterns to Follow

Developer agent MUST read these files before implementation:

1. **Modal:** `components/modals/UpdateAllProjects.tsx:12-78` - ModalContainer wrapper
2. **Forms:** `components/settings/SettingsForm.tsx:45-89` - Validation and errors
3. **API:** `lib/user-service.ts:34-56` - apiClient.put() pattern
4. **Store:** `stores/UserStore.ts:23-34` - updateUser() action

## UI States

- Loading (initial open): fields pre-filled from store; no spinner needed (data is local)
- Saving: Save button disabled with pending label; fields remain editable? No — disabled
- Error (server 422): field errors mapped to inputs, values preserved
- Error (network): 'Could not save. Retry?' inline; values preserved
- Success: 'Profile updated' message, modal closes, profile re-renders with new values

## Requirements

**Must Have:**

1. "Edit Profile" button in UserProfile component
2. Modal with fields: name, email, bio
3. Validation: email format, required fields
4. Save button disabled during submission
5. Success/error messages
6. Profile refreshes after save

**Must NOT:**

- Modify authentication system
- Change UserStore structure
- Add new dependencies

## Files

**Modify:**

- `components/profile/UserProfile.tsx` - Add button and modal state
- `stores/UserStore.ts` - Add updateProfile action

**Create:**

- `components/profile/ProfileEditModal.tsx`

**Do NOT Modify:**

- Authentication system
- Shared components outside profile/

## Success Criteria

**Functional:**

1. Modal opens with current values on "Edit Profile" click
2. Save updates profile within 2 seconds
3. Invalid email shows error message
4. Network errors show retry message; entered values preserved
5. Focus returns to the "Edit Profile" button when the modal closes

**Technical:**

1. All tests in profile/ pass
2. New tests cover: happy path, validation, network errors
3. Code follows SettingsForm.tsx pattern
4. No changes outside profile/ directory

**Verify:**

- Manual test: Edit and verify persistence
- Run: `npm test components/profile/`
- Check: `git diff -- components/shared/` (should be empty)
```
