## Example Test Output

Here's what a complete, high-quality test file handoff looks like:

```markdown
# Test Suite: ProfileEditModal

## Test File

`components/profile/ProfileEditModal.test.tsx`

## Coverage Summary

- Happy path: 2 tests
- Validation: 4 tests
- Error handling: 3 tests
- Accessibility: 2 tests
- **Total: 11 tests**

## Test Categories

### Rendering
- shows modal with current user values
- displays all form fields (name, email, bio)

### Validation
- shows error when email is invalid format
- shows error when name is empty
- shows error when name exceeds 50 characters
- prevents submission when validation fails

### Submission
- calls API with correct data on valid submission
- shows success message after successful save
- closes modal after successful save

### Error Handling
- displays error message when API call fails
- allows retry after network error

### Accessibility
- manages focus on modal open
- supports keyboard navigation (Escape closes)

## Test Status

All tests: FAILING (ready for implementation)

## Expected Patterns

Developer should implement to make these tests pass:
- Use ModalContainer wrapper
- Use existing validateEmail() utility
- Follow SettingsForm error display pattern
- Use userStore.updateProfile() action
```

This handoff gives the developer:
- Clear understanding of what to implement
- Specific test coverage to achieve
- Pattern references for implementation
