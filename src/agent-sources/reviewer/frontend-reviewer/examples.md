## Example Review Output

Here's what a complete, high-quality React review looks like:

````markdown
# React Review: UserProfileCard Component

## Files Reviewed

- src/components/UserProfileCard.tsx (87 lines)

## Summary

Component has 2 critical issues and 3 improvements needed. Overall structure is good but needs performance optimization and accessibility improvements.

## Issues Found

### Critical Issues (Must Fix)

**Issue #1: Missing key prop in list rendering**

- **Location:** src/components/UserProfileCard.tsx:45
- **Problem:** Array.map without stable keys causes unnecessary re-renders
- **Current:**
  ```tsx
  {
    user.badges.map((badge) => <Badge label={badge} />);
  }
  ```
- **Fix:**
  ```tsx
  {
    user.badges.map((badge) => <Badge key={badge.id} label={badge.name} />);
  }
  ```
- **Impact:** Performance degradation, potential state bugs

**Issue #2: Missing ARIA label on interactive element**

- **Location:** src/components/UserProfileCard.tsx:67
- **Problem:** Button has no accessible name for screen readers
- **Current:**
  ```tsx
  <button onClick={onEdit}>
    <IconEdit />
  </button>
  ```
- **Fix:**
  ```tsx
  <button onClick={onEdit} aria-label="Edit profile">
    <IconEdit />
  </button>
  ```
- **Impact:** Fails WCAG 2.1 Level A

### Improvements (Should Fix)

**Improvement #1: Unnecessary re-renders**

- **Location:** src/components/UserProfileCard.tsx:34
- **Issue:** Component re-renders when parent re-renders despite props not changing
- **Suggestion:** Wrap with React.memo
  ```tsx
  export const UserProfileCard = React.memo(({ user, onEdit }: Props) => {
    // component body
  });
  ```

## Positive Observations

- Clean component structure with single responsibility
- Props properly typed with TypeScript interface
- Uses SCSS Modules correctly following design system
- Event handlers are properly memoized with useCallback

## Approval Status

**REJECT** - Fix 2 critical issues before merging.
````

This example demonstrates:

- Clear structure following output format
- Specific file:line references
- Code examples showing current vs. fixed
- Severity markers
- Actionable suggestions
- Recognition of good patterns
