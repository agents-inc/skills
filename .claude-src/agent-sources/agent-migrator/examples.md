## Example Migration Output

Here's what a complete, high-quality migration looks like:

### Source File Analysis

**Source:** `.claude-src/agents/example-agent.src.md` (500 lines)

**Structure Identified:**
```
Lines 1-6: Frontmatter (STRIP)
Lines 7-15: Role/Introduction (-> intro.md)
Lines 16-45: @include directives (STRIP)
Lines 46-80: Preloaded content (STRIP)
Lines 81-250: Investigation & Workflow (-> workflow.md)
Lines 251-320: Domain-specific sections (-> workflow.md)
Lines 321-400: Example Output section (-> examples.md)
Lines 401-480: Critical reminders (-> critical-reminders.md)
Lines 481-490: Final loop lines (STRIP)
```

### Extracted Files

**intro.md:**
```markdown
You are an expert example agent implementing examples based on detailed specifications.

Your job is **surgical implementation**: read the spec, examine the patterns, implement exactly what's requested. Nothing more, nothing less.

**When creating examples, be comprehensive and thorough. Include as many relevant patterns as needed.**
```

**workflow.md:**
```markdown
## Your Investigation Process

**BEFORE writing any code, you MUST:**

[Full investigation content from source...]

---

## Your Development Workflow

**ALWAYS follow this exact sequence:**

[Full workflow content from source...]

---

<self_correction_triggers>

## Self-Correction Checkpoints

**If you notice yourself:**

- **Generating code without reading pattern files first**
  -> STOP. Read all referenced files completely before implementing.

[All self-correction content...]

</self_correction_triggers>

---

<domain_scope>

**You handle:**
- [Domain tasks...]

**You DON'T handle:**
- [Out of scope items...]

</domain_scope>
```

**examples.md:**
```markdown
## Example Implementation Output

Here's what a complete, high-quality output looks like:

[Full example content from source...]
```

**critical-reminders.md:**
```markdown
## Emphatic Repetition for Critical Rules

**CRITICAL: Make minimal and necessary changes ONLY. Do not modify anything not explicitly mentioned in the specification.**

This is the most important rule. Most quality issues stem from violating it.

**CRITICAL: Make minimal and necessary changes ONLY.**
```

### Generated Config Entry

```yaml
example-agent:
  name: example-agent
  title: Example Agent
  description: Implements examples from detailed specs - surgical execution following existing patterns
  model: opus
  tools:
    - Read
    - Write
    - Edit
    - Grep
    - Glob
    - Bash
  core_prompts: developer
  ending_prompts: developer
  output_format: output-formats-developer
  skills:
    precompiled: []
    dynamic: []
```

### Verification Checklist

**Files Created:**
- [x] `.claude-src/agents/example-agent/intro.md` (4 lines)
- [x] `.claude-src/agents/example-agent/workflow.md` (170 lines)
- [x] `.claude-src/agents/example-agent/examples.md` (80 lines)
- [x] `.claude-src/agents/example-agent/critical-requirements.md` (8 lines)
- [x] `.claude-src/agents/example-agent/critical-reminders.md` (10 lines)

**Content Verification:**
- [x] No @include() directives in any file
- [x] No frontmatter in any file
- [x] No preloaded_content section in any file
- [x] No "DISPLAY ALL 5 CORE PRINCIPLES..." line
- [x] All XML tags preserved (self_correction_triggers, domain_scope, etc.)
- [x] Example output complete and intact

**Line Count Check:**
- Source: 500 lines
- Infrastructure stripped: ~100 lines (frontmatter, includes, preloaded, final lines)
- Expected output: ~400 lines
- Actual output: 264 lines (intro + workflow + examples + critical-reminders)
- Discrepancy: Acceptable - some formatting differences

**Config Verification:**
- [x] Valid YAML syntax
- [x] core_prompts references valid set
- [x] ending_prompts references valid set
- [x] output_format file exists
- [x] Tools list appropriate for agent type

---

## Example: Handling Large Agents

For agents like `pattern-scout.src.md` (~2088 lines):

### Extraction Strategy

**1. Map major sections first:**
```
- Role section: lines 8-30
- Content preservation rules: lines 32-60
- Critical requirements: lines 65-90
- Investigation process: lines 100-200
- Pattern documentation: lines 210-800
- Output formats: lines 810-1200
- Validation checklists: lines 1210-1600
- Examples: lines 1610-1900
- Critical reminders: lines 1910-2000
- Final lines: lines 2010-2088 (STRIP)
```

**2. Group into target files:**
```
intro.md: Role section only (~25 lines)
workflow.md: Everything from investigation through validation (~1500 lines)
examples.md: Example sections (~300 lines)
critical-reminders.md: Critical reminders (~90 lines)
```

**3. Verify no content loss:**
```
Source: 2088 lines
Infrastructure: ~200 lines
Expected: ~1888 lines
Actual combined: ~1915 lines (formatting may add lines)
Status: PASS
```

---

## Example: Config for Complex Agent

For an agent with skills (like frontend-developer):

```yaml
frontend-developer:
  name: frontend-developer
  title: Frontend Developer Agent
  description: Implements frontend features from detailed specs - React components, TypeScript, styling, client state
  model: opus
  tools:
    - Read
    - Write
    - Edit
    - Grep
    - Glob
    - Bash
  core_prompts: developer
  ending_prompts: developer
  output_format: output-formats-developer
  skills:
    precompiled:
      - id: frontend/react
        path: skills/frontend/react.md
        name: React
        description: Component architecture, hooks, patterns
      - id: frontend/styling
        path: skills/frontend/styling.md
        name: Styling
        description: SCSS Modules, cva, design tokens
    dynamic:
      - id: frontend/api
        path: skills/frontend/api.md
        name: API Integration
        description: REST APIs, React Query, data fetching
      - id: frontend/accessibility
        path: skills/frontend/accessibility.md
        name: Accessibility
        description: WCAG, ARIA, keyboard navigation
```

This demonstrates:
- Correct YAML structure
- Precompiled skills for constant-use patterns
- Dynamic skills for occasional needs
- Complete metadata for each skill
