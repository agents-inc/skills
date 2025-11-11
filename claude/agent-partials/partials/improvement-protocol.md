# Prompt Improvement Protocol

When asked to improve your own configuration, read over this file

**Recognition triggers:**

- "improve your prompt"
- "update your configuration"
- "based on this work, you should add..."
- "review your own instructions"

When triggered:

1. Read `.claude/agents/[agent-name].md` (your current config)
2. Apply the improvement protocol above
3. Suggest structured, specific changes
4. Output only the sections that need modification

When analyzing and improving agent prompts, follow this structured approach:

## 1. Identify the Improvement Category

Every improvement must fit into one of these categories:

- **Investigation Enhancement**: Add specific files/patterns to check
- **Constraint Addition**: Add explicit "do not do X" rules
- **Pattern Reference**: Add concrete example from codebase
- **Workflow Step**: Add/modify a step in the process
- **Anti-Pattern**: Add something to actively avoid
- **Tool Usage**: Clarify how to use a specific tool
- **Success Criteria**: Add verification step

## 2. Determine the Correct Section

Place improvements in the appropriate section:

- `core-principles.md` - Fundamental rules (rarely changed)
- `investigation-requirement.md` - What to examine before work
- `anti-over-engineering.md` - What to avoid
- Agent-specific workflow - Process steps
- Agent-specific constraints - Boundaries and limits

## 3. Use Proven Patterns

All improvements must use established prompt engineering patterns:

### Pattern 1: Specific File References

❌ Bad: "Check the auth patterns"
✅ Good: "Examine UserStore.ts lines 45-89 for the async flow pattern"

### Pattern 2: Concrete Examples

❌ Bad: "Use MobX properly"
✅ Good: "Use `flow` from MobX for async actions (see UserStore.fetchUser())"

### Pattern 3: Explicit Constraints

❌ Bad: "Don't over-engineer"
✅ Good: "Do not create new HTTP clients - use apiClient from lib/api-client.ts"

### Pattern 4: Verification Steps

❌ Bad: "Make sure it works"
✅ Good: "Run `npm test` and verify UserStore.test.ts passes"

### Pattern 5: Emphatic for Critical Rules

Use **bold** or CAPITALS for rules that are frequently violated:
"**NEVER modify files in /auth directory without explicit approval**"

## 4. Format Requirements

- Use XML tags for structured sections (`<investigation>`, `<constraints>`)
- Use numbered lists for sequential steps
- Use bullet points for non-sequential items
- Use code blocks for examples
- Keep sentences concise (under 20 words)

## 5. Integration Requirements

New content must:

- Not duplicate existing instructions
- Not contradict existing rules
- Fit naturally into the existing structure
- Reference the source of the insight (e.g., "Based on OAuth implementation in PR #123")

## 6. Output Format

When suggesting improvements, provide:

<analysis>
Category: [Investigation Enhancement / Constraint Addition / etc.]
Section: [Which file/section this goes in]
Rationale: [Why this improvement is needed]
Source: [What triggered this - specific implementation, bug, etc.]
</analysis>

<current_content>
[Show the current content that needs improvement]
</current_content>

<proposed_change>
[Show the exact new content to add, following all formatting rules]
</proposed_change>

<integration_notes>
[Explain where/how this fits with existing content]
</integration_notes>
