<xml_structure_guide>
## Why XML Tags Matter

Anthropic specifically fine-tuned Claude to pay special attention to XML tags. Research shows **60% reduction in format errors** with XML structuring versus unstructured prompts.

XML creates semantic boundaries that prevent Claude from mixing instructions with context.

## Standard Tag Hierarchy

```xml
<!-- High-level organizational tags -->
<role>Your role definition</role>
<context>Background information</context>
<task>What needs to be accomplished</task>

<!-- Operational tags -->
<instructions>Specific steps to follow</instructions>
<workflow>Sequential process</workflow>
<constraints>What NOT to do</constraints>

<!-- Input/Output tags -->
<existing_patterns>Code to reference</existing_patterns>
<examples>Example patterns</examples>
<output_format>Expected response structure</output_format>

<!-- Quality gates -->
<success_criteria>How to verify completion</success_criteria>
<verification>Confirmation of criteria met</verification>

<!-- Core behavioral tags -->
<core_principles>Self-reminder principles</core_principles>
<investigation_requirement>Never speculate rule</investigation_requirement>
<coding_standards>Anti-over-engineering rules</coding_standards>
```

## Usage Patterns

### For Defining Scope
```xml
<task>
Implement user profile editing with name, email, and bio fields.

Include as many relevant features and interactions as possible.
Go beyond the basics to create a fully-featured implementation.
</task>
```

**Why it works:** The `<task>` tag signals "this is the primary goal" while the explicit language prevents minimal implementations.

### For Providing Context
```xml
<context>
This codebase uses:
- TypeScript for type safety
- MobX for state management (see stores/ directory)
- Tailwind CSS for styling (utility classes only)
- React functional components with hooks

Key files:
- .claude/conventions.md: Our coding standards
- .claude/patterns.md: Common patterns with examples
</context>
```

**Why it works:** Clear boundaries between context and instructions.

### For Constraints
```xml
<constraints>
**Must Follow:**
- Use existing utilities in lib/api-client.ts
- Follow form pattern from SettingsForm.tsx
- Keep changes within profile/ directory

**Must NOT:**
- Modify authentication system
- Create new utility libraries
- Change existing components outside profile/
- **(Do not change anything not explicitly mentioned in the task)**
</constraints>
```

**Why it works:** Explicit boundaries + emphasis on critical constraints.

### For Examples
```xml
<examples>
<example name="form-handling">
Our standard form pattern (from SettingsForm.tsx, lines 45-89):

```typescript
const [formData, setFormData] = useState(initialData);
const [errors, setErrors] = useState({});

const handleSubmit = async (e) => {
  e.preventDefault();
  const validationErrors = validateForm(formData);
  
  if (Object.keys(validationErrors).length > 0) {
    setErrors(validationErrors);
    return;
  }
  
  try {
    await apiClient.put(`/users/${id}`, formData);
    showSuccessMessage("Profile updated");
  } catch (error) {
    showErrorMessage(error.message);
  }
};
```

Follow this exact pattern for profile editing.
</example>

<example name="validation">
Our validation approach (from validation.ts):

```typescript
export const validateEmail = (email: string) => {
  if (!email) return "Email is required";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "Please enter a valid email";
  }
  return null;
};
```

Use these existing validators—don't create new ones.
</example>
</examples>
```

**Why it works:** Concrete examples are more effective than abstract descriptions.

### For Output Structure
```xml
<output_format>
Provide your response in this structure:

<investigation_notes>
[What files you examined]
</investigation_notes>

<implementation>
[Your code changes]
</implementation>

<tests>
[Test code]
</tests>

<verification>
[Confirmation of success criteria]
</verification>
</output_format>
```

**Why it works:** Claude knows exactly what structure to produce.

## Nesting Rules

**Good nesting:**
```xml
<task>
  <goal>Primary objective</goal>
  <requirements>
    <must_have>Essential feature 1</must_have>
    <must_have>Essential feature 2</must_have>
    <nice_to_have>Optional feature</nice_to_have>
  </requirements>
</task>
```

**Avoid deep nesting (>3 levels):**
```xml
<!-- Too deep - harder to parse -->
<task>
  <requirements>
    <functional>
      <user_facing>
        <profile>
          <edit>...</edit>
        </profile>
      </user_facing>
    </functional>
  </requirements>
</task>
```

**Better:**
```xml
<task>
  <goal>User profile editing</goal>
</task>

<functional_requirements>
  <requirement>Edit name, email, bio</requirement>
  <requirement>Validate before save</requirement>
</functional_requirements>
```

## Common Tags by Agent Type

### PM/Architect Agent (Auggie)
```xml
<specification>
  <goal>...</goal>
  <context>...</context>
  <existing_patterns>...</existing_patterns>
  <technical_requirements>...</technical_requirements>
  <constraints>...</constraints>
  <success_criteria>...</success_criteria>
</specification>
```

### Developer Agent
```xml
<investigation_notes>...</investigation_notes>
<implementation_plan>...</implementation_plan>
<implementation>...</implementation>
<tests>...</tests>
<verification>...</verification>
```

### TDD Agent
```xml
<test_suite>...</test_suite>
<coverage_analysis>...</coverage_analysis>
<expected_behavior>...</expected_behavior>
<test_status>...</test_status>
```

### Reviewer Agent
```xml
<summary>...</summary>
<must_fix>...</must_fix>
<suggestions>...</suggestions>
<positive_feedback>...</positive_feedback>
<convention_check>...</convention_check>
```

## Best Practices

1. **Use semantic tags** - Tag names should describe the content's purpose
2. **Keep tags focused** - Each tag should contain one type of information
3. **Use consistent naming** - Stick to a naming convention (snake_case or kebab-case)
4. **Provide context in tags** - Use attributes when helpful: `<example name="form-handling">`
5. **Don't over-nest** - Keep hierarchy flat when possible (≤3 levels)
6. **Close tags explicitly** - Always use `</tag>` even if content seems obvious

## Combining XML with Markdown

XML tags work seamlessly in markdown files:

```markdown
# Developer Agent

You are an expert TypeScript developer...

<core_principles>
Principle 1: Investigate before implementing
Principle 2: Follow existing patterns
...
</core_principles>

## Your Workflow

<workflow>
1. Research: Read specification
2. Plan: Create implementation plan
3. Implement: Write code
4. Test: Run tests
5. Verify: Confirm criteria met
</workflow>

<coding_standards>
- Use existing utilities
- Make minimal changes
...
</coding_standards>
```

This gives you markdown's readability with XML's structure.

</xml_structure_guide>
