## Example Specification

Here's what a complete, high-quality specification looks like:

```markdown
# User Profile Editing

## Goal

Add profile editing capability so users can update their name, email, and bio.

## Context

**Why This Matters:**
Top customer feature request (Issue #123). Currently users can't modify profile after signup.

**Current State:**

- Profile display exists: `components/profile/UserProfile.tsx`
- Profile data in UserStore: `stores/UserStore.ts`
- API endpoint exists: `PUT /api/users/:id` (see user-service.ts)

**Desired State:**
User clicks "Edit Profile" -> modal opens with current values -> edits fields -> saves -> profile updates

## Existing Patterns to Follow

**Before Implementation:** Developer agent MUST read these files completely:

1. **Modal Pattern**: `components/modals/UpdateAllProjects.tsx` (lines 12-78)
   - Use ModalContainer wrapper
   - Handle open/close state in parent component
   - Follow the modal's structure for layout

2. **Form Handling**: `components/settings/SettingsForm.tsx` (lines 45-89)
   - Form state management with useState
   - Validation before submission
   - Error display pattern
   - Success message pattern

3. **API Calls**: `lib/user-service.ts` (lines 34-56)
   - Use apiClient.put() method
   - Error handling structure
   - Success callback pattern

4. **Store Updates**: `stores/UserStore.ts` (lines 23-34)
   - updateUser() action pattern
   - Observable state updates
   - Error state handling

## Technical Requirements

**Must Have:**

1. "Edit Profile" button in UserProfile component
2. Modal with three fields: name (text), email (email), bio (textarea)
3. Validation: email format, required fields
4. Save button disabled during submission
5. Success message: "Profile updated successfully"
6. Error handling: network errors, validation errors
7. Profile display refreshes after save

**Must NOT:**

- Modify authentication system (auth.py)
- Change UserStore structure (keep existing observables)
- Add new dependencies

## Constraints

**Files to Modify:**

- `components/profile/UserProfile.tsx` (add button and modal state)
- Create: `components/profile/ProfileEditModal.tsx` (new modal component)
- `stores/UserStore.ts` (add updateProfile action)

**Files to NOT Modify:**

- Authentication system
- Shared components outside profile/
- API service structure

**Scope Limits:**

- Avatar upload: NOT included (future feature)
- Password change: NOT included (separate feature)
- Preferences: NOT included (separate feature)

## Success Criteria

**Functional:**

1. User clicks "Edit Profile" and modal opens with current values
2. Changing values and clicking "Save" updates profile within 2 seconds
3. Invalid email shows "Please enter a valid email" error
4. Network errors show "Error updating profile. Please try again." message
5. Profile display updates immediately after successful save

**Technical:**

6. All tests in profile/ directory pass
7. New tests cover: happy path, validation errors, network errors
8. Code follows SettingsForm.tsx pattern exactly
9. Modal uses ModalContainer pattern
10. No changes to files outside profile/ directory

**How to Verify:**

- Manual test: Edit profile and verify changes persist
- Run: `npm test components/profile/`
- Check: `git diff main -- auth.py` (should be empty)
- Measure: Profile update completes in <2 seconds

## Implementation Notes

**For Developer Agent:**

- Start by reading the 4 pattern files listed above
- Copy SettingsForm validation approach exactly
- Use existing validateEmail() from validation.ts
- Follow modal open/close pattern from UpdateAllProjects

**For Tester Agent:**

- Test scenarios: valid input, invalid email, empty required fields, network errors
- Mock the API call with success and error cases
- Test modal open/close behavior
- Verify profile display updates after save

**For React Specialist:**

- Review ProfileEditModal component structure
- Ensure hooks are used correctly
- Verify modal accessibility (keyboard nav, focus management)
```

This specification:

- References specific files with line numbers
- Provides concrete patterns to follow
- Sets clear scope boundaries
- Defines measurable success criteria
- Includes context about WHY
- Gives each agent role-specific guidance
