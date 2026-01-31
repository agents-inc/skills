# Screen Reader Support Patterns

> sr-only class, hidden content, and decorative content handling.

---

## Hidden Content for Screen Readers

### Example: Additional Context for Screen Readers

```typescript
// Usage: Additional context for screen readers
<button>
  {/* Use your icon component here */}
  <span aria-hidden="true">🗑</span>
  <span className="sr-only">Delete item</span>
</button>

// Screen readers announce: "Delete item, button"
// Sighted users see: Only the trash icon
```

```scss
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

---

## Hiding Decorative Content

### Example: aria-hidden for Decorative Elements

```typescript
// GOOD: Hide decorative icons from screen readers
<div className="banner">
  {/* Use your icon component with aria-hidden */}
  <span aria-hidden="true">✨</span>  {/* Decorative */}
  <h1>Welcome to our site!</h1>
</div>

// GOOD: Empty alt for decorative images
<img src="decorative-pattern.png" alt="" />

// BAD: Redundant alt text
<button>
  <img src="save-icon.png" alt="Save" />  {/* Redundant! */}
  Save
</button>

// GOOD: Icon marked as decorative
<button>
  <img src="save-icon.png" alt="" />  {/* Decorative */}
  Save
</button>
```
