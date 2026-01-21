  **Compliance Mode** - Use `.ai-docs/` as the sole source of truth. NO external research.

  ## Task: Recreate All Frontend Skills from Documentation

  ### Documentation Structure:

  **Primary Source (Standards & Patterns):**
  - `.ai-docs/WORK-STANDARDS` - THE authoritative source for coding standards, patterns, and conventions

  **Supporting Evidence (Context & Implementation):**
  - `.ai-docs/llms.txt` - Quick orientation
  - `.ai-docs/CONCEPTS.md` - Terminology and domain concepts
  - `.ai-docs/features/*/README.md` - Where code lives, system architecture
  - `.ai-docs/features/*/flows/*.md` - How things are implemented, file locations
  - `.ai-docs/features/*/PITFALLS.md` - Known issues, gotchas
  - `.ai-docs/_decisions/*.md` - Architectural decisions and constraints

  ### Workflow:

  1. **FIRST: Read `.ai-docs/WORK-STANDARDS` completely with ultrathink**
     - This is your PRIMARY source for patterns and conventions
     - Extract ALL coding standards, patterns, and rules
     - Note the exact terminology and naming conventions used

  2. **THEN: Read supporting `.ai-docs/` files for evidence**
     - Find WHERE these patterns are implemented (file paths, directories)
     - Find HOW the system is organized (architecture context)
     - Find PITFALLS to include in RED FLAGS sections
     - Map terminology from CONCEPTS.md

  3. **Create skills that document the standards WITH supporting context**
     - Standards from WORK-STANDARDS → Core Patterns, Critical Requirements
     - File locations from features/ → "Where to find examples"
     - Pitfalls from PITFALLS.md → RED FLAGS section
     - Architecture from README.md → Philosophy section

  ### Frontend Skills to Create:

  1. `frontend/react.md` - React component patterns
  2. `frontend/styling.md` - SCSS/cva patterns
  3. `frontend/api.md` - API integration patterns
  4. `frontend/client-state.md` - State management patterns
  5. `frontend/accessibility.md` - a11y patterns
  6. `frontend/performance.md` - Render optimization patterns
  7. `frontend/testing.md` - Testing patterns
  8. `frontend/mocking.md` - MSW/mock patterns

  ### For EACH skill:

  1. Extract relevant standards from WORK-STANDARDS
  2. Find supporting evidence in features/ docs
  3. Map to PROMPT_BIBLE skill structure:
     - `<critical_requirements>` at TOP (from WORK-STANDARDS rules)
     - `<philosophy>` (from architecture docs)
     - `<patterns>` (standards + file location examples)
     - `<decision_framework>` (when to use what)
     - `<red_flags>` (from PITFALLS.md + WORK-STANDARDS anti-patterns)
     - `<critical_reminders>` at BOTTOM (repeat critical rules)
  4. Write to `src/stacks/work/skills/frontend/{skill}.md`
  5. Verify file was written before proceeding

  ### CRITICAL CONSTRAINTS:

  - **NO WebSearch** - Do not search the web
  - **NO WebFetch** - Do not fetch external URLs
  - **WORK-STANDARDS is authoritative** - Standards come from this file
  - **Supporting docs provide context** - Where things are, how system works
  - **NO improvements** - Do not suggest alternatives to documented standards
  - **Faithful reproduction** - Match documented patterns exactly

  ### After ALL skills complete:
  - Run `bunx compile -s work`
  - Verify all skills compile without errors

  Process all 8 frontend skills autonomously. Do not pause for user input between skills.
