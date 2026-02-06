## Compliance Mode Workflow

**When user triggers Compliance Mode** (says "compliance mode", "use .ai-docs", "match documented patterns", "no external research", or provides .ai-docs path):

```xml
<compliance_mode_workflow>
1. **Identify Documentation Location**
   - User provides path to .ai-docs/ folder
   - Confirm the documentation follows docs/bibles/DOCUMENTATION_BIBLE.md structure
   - Note: Do NOT use WebSearch or WebFetch in this mode

2. **Load Documentation** (analyze thoroughly for deep understanding)
   - Read llms.txt for quick orientation
   - Read CONCEPTS.md for terminology and aliases
   - Read features/*/README.md for architecture patterns
   - Read features/*/STORE-API.md for method signatures
   - Read features/*/flows/*.md for implementation patterns
   - Read features/*/PITFALLS.md for anti-patterns
   - Read _decisions/*.md for architectural constraints

3. **Extract Patterns Exactly As Documented**
   - Use documented terminology (not industry standard alternatives)
   - Use documented code examples as templates
   - Use documented file paths and structure
   - Preserve documented anti-patterns in RED FLAGS
   - Do NOT suggest improvements or alternatives
   - Do NOT critique the documented approaches

4. **Map Documentation to Skill Structure**
   - llms.txt -> Quick Guide summary
   - CONCEPTS.md -> Auto-detection keywords
   - README.md architecture -> Philosophy section
   - STORE-API.md methods -> Core Patterns
   - flows/*.md -> Implementation examples
   - PITFALLS.md -> RED FLAGS section
   - _decisions/*.md -> Critical requirements (DO NOTs)

5. **Create Skills Following docs/bibles/PROMPT_BIBLE.md Structure**
   - <critical_requirements> at TOP
   - <philosophy>, <patterns>, <decision_framework>, <red_flags>
   - <critical_reminders> at BOTTOM
   - All examples copied/adapted from documentation
</compliance_mode_workflow>
```

---

## Create/Improve Mode Workflow

**BEFORE creating any skill:**

```xml
<mandatory_research>
1. **Understand the Technology Request**
   - What technology/library is this skill for?
   - What problem does this technology solve?
   - Does a skill already exist? (Check .claude/skills/)
   - Is this a library-specific skill or a broader pattern?

2. **Study Existing Skills**
   - Read at least 3 existing skills in .claude/skills/
   - Note the directory structure with SKILL.md + metadata.yaml
   - Identify auto-detection keywords pattern
   - Review RED FLAGS sections format

3. **Research Modern Best Practices**
   - WebSearch: "[Technology] best practices 2024/2025"
   - WebSearch: "[Technology] official documentation"
   - WebSearch: "[Technology] patterns from [Vercel|Stripe|Shopify]"
   - WebFetch official docs to analyze recommended patterns
   - WebFetch reputable blog posts (Kent C. Dodds, Josh Comeau, etc.)

4. **Compare with Codebase Standards (if provided)**
   - Read the provided standards file completely
   - Identify alignment points (where they match)
   - Identify differences (where they differ)
   - Prepare comparison for user decision

5. **Synthesize Patterns**
   - Extract core principles from research
   - Identify anti-patterns and RED FLAGS
   - Collect realistic code examples
   - Determine decision frameworks (when to use what)
</mandatory_research>
```

---

## Skill Creation Steps

**Step 1: Technology Analysis**

- Technology name and version
- Primary use case
- How it fits into the stack
- Related technologies/skills

**Step 2: Research Phase**

Use WebSearch and WebFetch to gather:

- Official documentation patterns
- Industry best practices (2024/2025)
- Real-world usage from major codebases
- Common mistakes and anti-patterns

**Step 3: Comparison Phase (if standards provided)**

```markdown
## External Best Practices vs Codebase Standards

### Where They Align

- [Pattern 1]: Both recommend X
- [Pattern 2]: Both avoid Y

### Where They Differ

- **Pattern**: [What differs]
- **External Best Practice**: [Approach from research]
- **Codebase Standard**: [Approach from provided file]
- **Pros/Cons**: [Analysis]

### Recommendation

[Your assessment with rationale]
```

**Step 4: Generate Skill Directory**

Create skill at `.claude/skills/{domain}-{subcategory}-{technology}/`:

```
{domain}-{subcategory}-{technology}/
├── SKILL.md          # Main documentation
├── metadata.yaml     # Metadata
├── reference.md      # Quick reference (optional)
└── examples/         # Examples (optional)
```

**Step 5: Validation**

Run through validation checklist:

**Structure:**

- [ ] Directory created with correct 3-part name
- [ ] SKILL.md has complete structure
- [ ] metadata.yaml has required fields
- [ ] Auto-detection keywords are specific
- [ ] Each Core Pattern has embedded good vs bad examples

**docs/bibles/PROMPT_BIBLE.md Compliance:**

- [ ] Has `<critical_requirements>` section at TOP
- [ ] Has `<critical_reminders>` section at BOTTOM
- [ ] Critical rules use `**(bold + parentheses)**` format
- [ ] Major sections wrapped in semantic XML tags
- [ ] References CLAUDE.md for generic conventions

**Write Verification:**

- [ ] Re-read the files after completing edits
- [ ] Verified all required files exist
- [ ] Only reported success AFTER verification passed
