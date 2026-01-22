# Example Output Format

<output_format>
Create a file at `./extracted-standards.md` with this structure:

```markdown
# [Project Name] - Comprehensive Standards & Patterns

**Extraction Date:** [YYYY-MM-DD]
**Codebase Version:** [commit hash if available]
**Monorepo Tool:** [Turborepo/Nx/Lerna/Yarn Workspaces]
**Confidence Level:** [High/Medium/Low] - based on pattern consistency

---

## Table of Contents

1. [Package Architecture](#1-package-architecture)
2. [Code Conventions](#2-code-conventions)
3. [State Management](#3-state-management)
4. [Testing Standards](#4-testing-standards)
5. [Design System](#5-design-system)
6. [Accessibility](#6-accessibility)
7. [Build & Tooling](#7-build--tooling)
8. [CI/CD Pipelines](#8-cicd-pipelines)
9. [Environment Management](#9-environment-management)
10. [Architecture Decisions](#10-architecture-decisions)
11. [AI Agent Optimization](#11-ai-agent-optimization)
12. [Performance Standards](#12-performance-standards)
13. [Security Patterns](#13-security-patterns)
14. [Git Workflow](#14-git-workflow)
15. [Anti-Patterns Observed](#15-anti-patterns-observed)
16. [Quick Reference for AI](#16-quick-reference-for-ai)

---

## 1. Package Architecture

### 1.1 Workspace Structure

**Pattern:** [Describe workspace organization]
**Frequency:** Found in X packages
**Example:**
```

packages/
├── ui/ # type:ui - Shared components
├── utils/ # type:util - Pure functions
apps/
├── web/ # Next.js application

````
**Rationale:** [Why this organization works]

### 1.2 Package Naming Conventions

**Pattern:** All internal packages use `@repo/` prefix
**Example:**
```json
{
  "name": "@repo/ui",
  "dependencies": {
    "@repo/utils": "workspace:*"
  }
}
````

**Rationale:** [Why workspace protocol is used]

[... continues with all sections ...]

---

## 16. Quick Reference for AI Agents

### Essential Patterns

```typescript
// Query hook
export const usePost = (id: number) => {
  return useQuery({
    queryKey: ['posts', 'detail', id],
    queryFn: () => fetchPost(id)
  })
}

// Component with tokens
<button className={styles.primary}>
  {/* Styles use CSS variables: */}
  {/* background: var(--button-primary-bgColor); */}
</button>

// Package imports
import { Button } from '@repo/ui';
import { formatDate } from '@repo/utils';
```

### Critical Do's

- [Top 5 most important do's extracted]

### Critical Don'ts

- [Top 5 most important don'ts extracted]

### File-Scoped Commands (Fast Feedback)

```bash
# Type check single file
pnpm tsc --noEmit path/to/file.ts

# Format single file
pnpm prettier --write path/to/file.ts

# Lint single file
pnpm eslint path/to/file.ts

# Test single file
pnpm vitest run path/to/file.test.ts
```

---

## Confidence & Coverage Notes

**High Confidence Patterns:** [List patterns seen 5+ times]
**Medium Confidence Patterns:** [List patterns seen 3-4 times]
**Low Confidence Patterns:** [List patterns seen 2 times - needs verification]

**Coverage Gaps:** [Areas where patterns are inconsistent or missing]

**Missing Documentation:**

- [ ] Package architecture not documented
- [ ] Testing standards undefined
- [ ] No ADRs found
- [ ] AGENTS.md missing

---

## Implementation Priority

### Immediate (Week 1)

1. Create AGENTS.md
2. Document package architecture
3. Define testing standards
4. Clarify state management separation

### High Priority (Week 2-3)

5. Document design token system
6. Optimize Turborepo configuration
7. Setup ADR templates
8. Improve CI/CD pipelines

### Ongoing

- Keep AGENTS.md updated
- Record architectural decisions
- Maintain performance budgets
- Review and refactor anti-patterns

```

</output_format>
```
