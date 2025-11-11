# Output Format Templates

Different agent roles require different output structures. Include the appropriate template for your role.

---

## {{> output-formats.developer}}

<output_format>
Provide your response in this structure:

<investigation_notes>
**Files Examined:**
- [List files you read]

**Patterns Found:**
- [Key patterns and conventions discovered]
- [Relevant utilities or components to reuse]
</investigation_notes>

<implementation_plan>
**Approach:**
[Brief description of how you'll solve this following existing patterns]

**Files to Modify:**
- [File 1]: [What changes]
- [File 2]: [What changes]

**Existing Code to Reuse:**
- [Utility/component to use and why]
</implementation_plan>

<implementation>
**[filename.ts]**
```typescript
[Your code here]
```

**[filename2.tsx]**
```tsx
[Your code here]
```

[Additional files as needed]
</implementation>

<tests>
**[filename.test.ts]**
```typescript
[Test code covering the implementation]
```
</tests>

<verification>
✅ Criteria met:
- [Criterion 1]: Verified
- [Criterion 2]: Verified

📊 Test results:
- [Test suite]: All passing
- Coverage: [X%]

⚠️ Notes:
- [Any important notes or considerations]
</verification>
</output_format>

---

## {{> output-formats.tdd}}

<output_format>
<test_suite>
**[filename.test.ts]**
```typescript
[Comprehensive test code]
```
</test_suite>

<coverage_analysis>
**Behaviors Covered:**
- Happy path: [Specific scenarios]
- Edge cases: [Specific scenarios]
- Error handling: [Specific scenarios]
- Integration: [How it works with existing code]

**What's NOT Covered:**
[Any scenarios intentionally excluded and why]
</coverage_analysis>

<expected_behavior>
**When tests pass, the implementation should:**
1. [Specific behavior 1]
2. [Specific behavior 2]
3. [Specific behavior N]

**The implementation must NOT:**
1. [Anti-pattern 1]
2. [Anti-pattern 2]
</expected_behavior>

<test_status>
Current status: ❌ All tests failing (expected - no implementation exists)
Ready for: Developer agent implementation
</test_status>
</output_format>

---

## {{> output-formats.reviewer}}

<output_format>
<summary>
**Overall Assessment:** [Approve / Request Changes / Major Revisions Needed]

**Key Findings:** [2-3 sentence summary]
</summary>

<must_fix>
🔴 **Critical Issues** (must be addressed before approval)

1. **[Issue Title]**
   - Location: [File:line or general area]
   - Problem: [What's wrong]
   - Why it matters: [Impact/risk]
   - Suggestion: [How to fix while following existing patterns]

[Repeat for each critical issue]
</must_fix>

<suggestions>
🟡 **Improvements** (nice-to-have, not blockers)

1. **[Improvement Title]**
   - Could be better: [What could improve]
   - Benefit: [Why this would help]
   - Suggestion: [Optional approach]

[Repeat for each suggestion]
</suggestions>

<positive_feedback>
✅ **What Was Done Well**

- [Specific thing done well and why it's good]
- [Another thing done well]
- [Reinforces good patterns]
</positive_feedback>

<convention_check>
**Codebase Convention Adherence:**
- Naming: ✅ / ⚠️ / ❌
- File structure: ✅ / ⚠️ / ❌
- Pattern consistency: ✅ / ⚠️ / ❌
- Utility usage: ✅ / ⚠️ / ❌

[Explain any ⚠️ or ❌ marks]
</convention_check>
</output_format>

---

## {{> output-formats.specialist}}

<output_format>
<specialist_analysis>
**Domain:** [Your specialty - MobX, React, Security, etc.]

**Scope Reviewed:**
- [Specific aspect 1]
- [Specific aspect 2]

**Out of Scope:** [What you didn't review - other specialists' domains]
</specialist_analysis>

<domain_specific_implementation>
**[Relevant Code Section]**
```typescript
[Your specialized code]
```

**Pattern Justification:**
This follows the established [domain] pattern from [specific file:lines].
Specifically: [How it matches the pattern]
</domain_specific_implementation>

<integration_notes>
**For Other Agents:**
- [Instructions for how other parts of the system should use this]
- [Any dependencies or requirements]
- [Integration points to be aware of]
</integration_notes>

<domain_review>
**Strengths:**
- [What's good from domain perspective]

**Concerns:**
- [Any domain-specific issues]

**Recommendations:**
- [Domain-specific suggestions]
</domain_review>
</output_format>

---

## {{> output-formats.pm}}

<output_format>
<specification>
<goal>
[Clear, concise description of what we're building]
</goal>

<context>
**Why This Matters:**
[Business value, problem being solved]

**Current State:**
[What exists now]

**Desired State:**
[What we want after this feature]
</context>

<existing_patterns>
**Patterns to Follow:**
- [File:lines]: [What pattern it demonstrates]
- [File:lines]: [What pattern it demonstrates]

**Before Implementation:**
The developer agent MUST read these files completely to understand our approach.
</existing_patterns>

<technical_requirements>
**Must Have:**
1. [Specific requirement]
2. [Specific requirement]

**Should Have:**
3. [Nice-to-have requirement]

**Must NOT:**
- [Thing to avoid]
- [Thing to avoid]
</technical_requirements>

<constraints>
**Technical:**
- [Constraint 1]
- [Constraint 2]

**Scope:**
- Only modify [specific areas]
- Do not touch [specific areas]

**Dependencies:**
- [Any required order of implementation]
</constraints>

<success_criteria>
**Definition of Done:**
1. [Measurable criterion]
2. [Measurable criterion]
3. [Measurable criterion]

**How to Verify:**
- [Test/check 1]
- [Test/check 2]
</success_criteria>

<implementation_notes>
**For Developer Agent:**
- [Specific guidance]
- [Important considerations]

**For TDD Agent:**
- [Test scenarios to cover]
- [Edge cases to consider]
</implementation_notes>
</specification>
</output_format>

---

## Usage

In your agent file, reference the appropriate format:

```markdown
{{> core-principles}}

[Your role-specific content]

{{> output-formats.developer}}
```

Replace `.developer` with `.tdd`, `.reviewer`, `.specialist`, or `.pm` based on the agent's role.
