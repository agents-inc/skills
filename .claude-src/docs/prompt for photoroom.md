  **Compliance Mode** - Use `.ai-docs/` as the sole source of truth.

  ## Task: Recreate All Frontend Skills from Documentation

  Read the documentation in `.ai-docs/` and recreate ALL frontend skills following the exact patterns documented there. NO
  external research. NO WebSearch. NO WebFetch. Faithful reproduction only.

  ### Frontend Skills to Create (in order):

  1. `frontend/react.md` - React component patterns
  2. `frontend/styling.md` - SCSS/cva patterns
  3. `frontend/api.md` - API integration patterns
  4. `frontend/client-state.md` - State management patterns
  5. `frontend/accessibility.md` - a11y patterns
  6. `frontend/performance.md` - Render optimization patterns
  7. `frontend/testing.md` - Testing patterns
  8. `frontend/mocking.md` - MSW/mock patterns

  ### Workflow for EACH skill:

  1. **Read relevant `.ai-docs/` documentation with ultrathink**
     - `llms.txt` for orientation
     - `CONCEPTS.md` for terminology
     - `features/*/README.md` for architecture
     - `features/*/flows/*.md` for implementation
     - `features/*/PITFALLS.md` for anti-patterns

  2. **Map documentation to PROMPT_BIBLE skill structure**
     - `<critical_requirements>` at TOP
     - `<philosophy>`, `<patterns>`, `<decision_framework>`, `<red_flags>`
     - `<critical_reminders>` at BOTTOM
     - Embedded ✅/❌ examples in each pattern

  3. **Create skill file at `.claude-src/profiles/work/skills/frontend/{skill}.md`**
     - Use documented terminology exactly
     - Copy/adapt documented code examples
     - Preserve documented anti-patterns as RED FLAGS
     - Do NOT suggest improvements or alternatives

  4. **Verify each skill was written correctly before proceeding to next**

  ### CRITICAL CONSTRAINTS:

  - **NO WebSearch** - Do not search the web
  - **NO WebFetch** - Do not fetch external URLs  
  - **NO improvements** - Do not critique or suggest alternatives to documented patterns
  - **NO external best practices** - Only document what IS, not what SHOULD BE
  - **Faithful reproduction** - Match documented patterns exactly

  ### Output Location:
  `.claude-src/profiles/work/skills/frontend/`

  ### After ALL skills are created:
  - Run `npm run compile:work` to compile the profile
  - Verify all skills compile without errors

  Process all 8 frontend skills autonomously without pausing for user input between skills.
