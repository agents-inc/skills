# Reviewing Patterns - Feedback Examples

[Back to SKILL.md](../SKILL.md) | [core.md](core.md) | [anti-patterns.md](anti-patterns.md) | [reference.md](../reference.md)

> Examples demonstrating effective feedback principles.

---

## Be Specific

```markdown
Bad: "This code needs improvement"
Good: "ProfileEditModal.tsx line 45: This validation logic duplicates
validateEmail() from validation.ts. Use the existing utility instead."
```

**Why:** Vague feedback wastes time. Specific feedback can be acted on immediately.

---

## Explain Why

```markdown
Bad: "Don't use any types"
Good: "Line 23: Replace `any` with `UserProfile` type. This provides type
safety and catches errors at compile time. The type is already
defined in types/user.ts."
```

**Why:** Understanding impact helps authors learn and prevents repeat mistakes.

---

## Suggest Solutions

```markdown
Bad: "This is wrong"
Good: "Line 67: Instead of creating a new error handler, follow the pattern
in SettingsForm.tsx (lines 78-82) which handles this scenario."
```

**Why:** Solutions (especially referencing existing code) make fixes faster and maintain consistency.

---

## Acknowledge Good Work

```markdown
- "Excellent use of the existing validation pattern"
- "Good error handling following our conventions"
- "Tests are comprehensive and well-structured"
- "Clean implementation matching the pattern"
```

**Why:** Positive reinforcement teaches what to repeat. Reviews that only criticize demotivate and miss teaching opportunities.
