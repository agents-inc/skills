## Output Format

<output_format>
Provide your specification in this structure:

<goal>
[Clear, concise description of what's being built - one sentence]

**User Story:** As a [user type], I want to [action] so that [benefit].
</goal>

<context>

## Why This Matters

**Business Problem:** [What problem this solves]
**User Impact:** [How users benefit]
**Priority:** [Critical | High | Medium | Low]

## Current State

- [What exists now - with file references]
- [Current user experience or technical limitation]

## Desired State

- [What will exist after implementation]
- [How the experience changes]

</context>

<existing_patterns>

## Pattern Files to Reference

**Before implementing, developers MUST read these files:**

| Priority | File                             | Lines | Pattern Demonstrated      |
| -------- | -------------------------------- | ----- | ------------------------- |
| 1        | [/path/to/similar/feature.tsx]   | [X-Y] | [What pattern this shows] |
| 2        | [/path/to/similar/component.tsx] | [X-Y] | [What pattern this shows] |
| 3        | [/path/to/utility.ts]            | [X-Y] | [Utility to reuse]        |

**Why these patterns:**

- [Pattern 1]: [Why this is the right reference]
- [Pattern 2]: [Why this is the right reference]

</existing_patterns>

<technical_requirements>

## Requirements

### Must Have (MVP)

1. [Requirement - specific and measurable]
2. [Requirement - specific and measurable]
3. [Requirement - specific and measurable]

### Should Have (If Time Permits)

1. [Enhancement]
2. [Enhancement]

### Must NOT Have (Explicitly Out of Scope)

1. [Feature explicitly excluded] - [Why excluded]
2. [Feature explicitly excluded] - [Why excluded]

</technical_requirements>

<constraints>

## Constraints

### Scope Boundaries

**Files to Modify:**

- [/path/to/file.tsx] - [What changes]
- [/path/to/file.ts] - [What changes]

**Files to Create:**

- [/path/to/new-file.tsx] - [Purpose]

**Files NOT to Touch:**

- [/path/to/file.ts] - [Why off-limits]

### Technical Constraints

- [Constraint - e.g., "Must use existing validation utilities"]
- [Constraint - e.g., "No new dependencies without approval"]
- [Constraint - e.g., "Must maintain backward compatibility"]

### Dependencies

- **Requires:** [Other features/APIs this depends on]
- **Blocks:** [Features waiting on this]

</constraints>

<success_criteria>

## Success Criteria

### Functional Requirements

| Criterion              | How to Verify                       |
| ---------------------- | ----------------------------------- |
| [User can X when Y]    | [Manual test / automated test name] |
| [System does X when Y] | [Test command / API call]           |

### Technical Requirements

| Criterion                        | How to Verify                                  |
| -------------------------------- | ---------------------------------------------- |
| [Tests pass with > X% coverage]  | `bun test --coverage`                          |
| [No TypeScript errors]           | `bun tsc --noEmit`                             |
| [Follows existing patterns]      | [Reference pattern file]                       |
| [No modifications outside scope] | `git diff -- [excluded paths]` should be empty |

### Non-Functional Requirements

| Criterion                      | How to Verify                      |
| ------------------------------ | ---------------------------------- |
| [Response time < X ms]         | [Performance test / manual timing] |
| [Accessible to keyboard users] | [A11y test / manual check]         |

</success_criteria>

<implementation_notes>

## Role-Specific Guidance

### For Developer

**Investigation Phase:**

1. Read all pattern files listed above (priority order)
2. Understand the [specific pattern] before implementing
3. Check for existing [utilities/components] in [path]

**Implementation Order:**

1. [First step - usually infrastructure]
2. [Second step - core functionality]
3. [Third step - integration]

**Key Decisions Already Made:**

- [Decision] - [Rationale]
- [Decision] - [Rationale]

### For Tester

**Test Coverage Requirements:**

- Happy path: [Specific scenarios]
- Error cases: [Specific error conditions]
- Edge cases: [Boundary conditions]

**Mock Requirements:**

- [API/service to mock] - [Why]

### For Reviewer

**Focus Areas:**

- [Specific pattern to verify]
- [Security consideration]
- [Performance consideration]

</implementation_notes>

<questions>

## Open Questions (If Any)

**Resolved:**

- Q: [Question] → A: [Answer/decision made]

**Needs Clarification:**

- Q: [Unanswered question that may affect implementation]

</questions>

</output_format>

---

## Section Guidelines

### What Makes a Good Spec

| Principle                       | Example                                             |
| ------------------------------- | --------------------------------------------------- |
| **Specific pattern references** | `/path/to/file.tsx:45-89` not "follow our patterns" |
| **Measurable success criteria** | "Response < 200ms" not "fast response"              |
| **Clear scope boundaries**      | "Only modify /profile/" not "update user features"  |
| **Explicit out-of-scope**       | "Password change NOT included"                      |
| **No implementation details**   | WHAT to build, not HOW to code it                   |

### Spec Quality Checklist

Before delivering a spec, verify:

- [ ] All pattern references have specific file:line locations
- [ ] Success criteria are measurable and verifiable
- [ ] Scope is bounded (what's IN and what's OUT)
- [ ] No code examples (only architecture/behavior)
- [ ] Developer can implement autonomously
- [ ] Tester knows what to test
- [ ] Reviewer knows what to focus on

### Relationship to Other Agents

| This Spec Feeds To     | What They Need                                       |
| ---------------------- | ---------------------------------------------------- |
| **frontend-developer** | Pattern files, file boundaries, success criteria     |
| **backend-developer**  | API contracts, db schema refs, integration points    |
| **tester**             | Behavior descriptions, test scenarios, mocking needs |
| **reviewer**           | Focus areas, patterns to verify, scope limits        |
