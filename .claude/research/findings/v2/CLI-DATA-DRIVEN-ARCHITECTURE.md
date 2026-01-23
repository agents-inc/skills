# CLI Data-Driven Architecture

> **Purpose**: Design a data-driven CLI where ALL decisions come from configuration files, not hardcoded logic.
> **Date**: 2026-01-20
> **Status**: Research complete, ready for implementation

---

## Executive Summary

The CLI should be **dumb** - it reads configuration files and displays options accordingly. All intelligence about:

- What categories exist (frontend, backend)
- What subcategories exist (framework, styling, state-management)
- Which skills belong to which category
- What conflicts/recommends/requires what
- What stacks are available

...lives in **two configuration files**:

1. `skills-matrix.yaml` - Relationships, recommendations, conflicts
2. Auto-extracted from existing `metadata.yaml` files - Skill identity and category

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Data Flow](#data-flow)
3. [Configuration Schema](#configuration-schema)
4. [Metadata Extraction](#metadata-extraction)
5. [Minimal MVP Dataset](#minimal-mvp-dataset)
6. [Implementation Plan](#implementation-plan)
7. [Repository Separation](#repository-separation)
8. [Implementation Status](#implementation-status)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLI (Dumb)                               │
│  - Reads config files                                           │
│  - Renders prompts based on config                              │
│  - NO hardcoded skill/category knowledge                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Skills Matrix Loader                          │
│  - Loads skills-matrix.yaml (relationships)                     │
│  - Extracts metadata from existing metadata.yaml files          │
│  - Computes disabled/recommended options at runtime             │
└─────────────────────────────────────────────────────────────────┘
                              │
           ┌──────────────────┴──────────────────┐
           ▼                                      ▼
┌─────────────────────────┐          ┌─────────────────────────┐
│  skills-matrix.yaml     │          │  metadata.yaml files    │
│  (Manually maintained)  │          │  (Per-skill, existing)  │
│                         │          │                         │
│  - Categories           │          │  - category             │
│  - Relationships        │          │  - category_exclusive   │
│  - Suggested stacks     │          │  - compatible_with      │
│  - Decision tree        │          │  - conflicts_with       │
└─────────────────────────┘          │  - requires             │
                                     │  - tags                 │
                                     └─────────────────────────┘
```

---

## Data Flow

### Step 1: Load Configuration

```typescript
const matrix = await loadSkillsMatrix("skills-matrix.yaml");
const skills = await extractSkillMetadata("src/skills/**/metadata.yaml");
const merged = mergeMatrixWithSkills(matrix, skills);
```

### Step 2: Compute Available Options

```typescript
function getAvailableSkills(
  category: string,
  currentSelections: string[],
): SkillOption[] {
  return merged.skills
    .filter((s) => s.category === category)
    .map((skill) => ({
      ...skill,
      disabled: isDisabled(skill, currentSelections, merged),
      recommended: isRecommended(skill, currentSelections, merged),
      reason: getDisableReason(skill, currentSelections, merged),
    }));
}
```

### Step 3: Render Wizard

```typescript
// CLI has NO knowledge of what "react" or "zustand" is
// It just reads the config and renders accordingly
for (const category of matrix.categories) {
  const options = getAvailableSkills(category.id, selections);
  const choice = await prompt(category.name, options);
  selections.push(choice);
}
```

---

## Configuration Schema

### Primary File: `skills-matrix.yaml`

```yaml
# src/config/skills-matrix.yaml
version: "1.0.0"

# =============================================================================
# Categories (What the user selects)
# =============================================================================

categories:
  # Top-level categories
  frontend:
    id: frontend
    name: Frontend
    description: UI and client-side development
    order: 1
    icon: "⚛️"

  backend:
    id: backend
    name: Backend
    description: API and server-side development
    order: 2
    icon: "🔌"

  # Subcategories (nested under parent)
  framework:
    id: framework
    name: Framework
    description: Core UI framework
    parent: frontend
    exclusive: true # Only one framework allowed
    required: true # Must select one
    order: 1

  styling:
    id: styling
    name: Styling
    description: CSS approach
    parent: frontend
    exclusive: true
    required: true
    order: 2

  state-management:
    id: state-management
    name: State Management
    description: Client-side state
    parent: frontend
    exclusive: true # Zustand OR Redux, not both
    required: false # Optional
    order: 3

  api:
    id: api
    name: API Framework
    description: Backend framework
    parent: backend
    exclusive: true
    required: true
    order: 1

  database:
    id: database
    name: Database ORM
    description: Database access layer
    parent: backend
    exclusive: true
    required: false
    order: 2

  auth:
    id: auth
    name: Authentication
    description: Auth solution
    parent: backend
    exclusive: true
    required: false
    order: 3

# =============================================================================
# Relationships (The Intelligence)
# =============================================================================

relationships:
  # ─────────────────────────────────────────────────────────────────
  # CONFLICTS (Mutually exclusive - selecting A disables B)
  # ─────────────────────────────────────────────────────────────────
  conflicts:
    # Styling conflicts
    - skills: [scss-modules, tailwind]
      reason: "Different styling paradigms"

    - skills: [scss-modules, styled-components]
      reason: "Different styling approaches"

    # State management conflicts
    - skills: [zustand, redux]
      reason: "Both solve client state - choose one"

    - skills: [zustand, mobx]
      reason: "Both solve client state - choose one"

    # Backend conflicts
    - skills: [hono, express]
      reason: "Both are API frameworks"

    - skills: [drizzle, prisma]
      reason: "Both are ORMs"

  # ─────────────────────────────────────────────────────────────────
  # RECOMMENDS (Soft suggestions - selecting A highlights B)
  # ─────────────────────────────────────────────────────────────────
  recommends:
    # React ecosystem recommendations
    - when: react
      suggest: [zustand, react-query, vitest]
      reason: "Works great with React"

    # Hono ecosystem
    - when: hono
      suggest: [drizzle, better-auth]
      reason: "Hono + Drizzle is a powerful combo"

    # SCSS Modules
    - when: scss-modules
      suggest: [cva]
      reason: "CVA enhances SCSS Modules with variants"

  # ─────────────────────────────────────────────────────────────────
  # REQUIRES (Hard dependencies - A requires B to be selected first)
  # ─────────────────────────────────────────────────────────────────
  requires:
    # React-specific libraries
    - skill: zustand
      needs: [react]
      reason: "Zustand is React-only"

    - skill: redux
      needs: [react]
      reason: "Redux Toolkit is React-only"

    - skill: react-query
      needs: [react]
      reason: "React Query is React-only"

    # Vue-specific
    - skill: pinia
      needs: [vue]
      reason: "Pinia is Vue-only"

    # Backend dependencies
    - skill: drizzle
      needs: [hono, express]
      needs_any: true # Needs at least one (OR logic)
      reason: "Drizzle needs an API framework"

    - skill: better-auth
      needs: [hono]
      reason: "Better Auth integration is for Hono"

  # ─────────────────────────────────────────────────────────────────
  # ALTERNATIVES (Interchangeable options for same purpose)
  # ─────────────────────────────────────────────────────────────────
  alternatives:
    - purpose: "State Management (React)"
      skills: [zustand, redux, mobx, jotai]

    - purpose: "Styling"
      skills: [scss-modules, tailwind, styled-components]

    - purpose: "Database ORM"
      skills: [drizzle, prisma, kysely]

    - purpose: "API Framework"
      skills: [hono, express, fastify]

# =============================================================================
# Suggested Stacks (Pre-built combinations)
# =============================================================================

suggested_stacks:
  - id: modern-react
    name: Modern React Stack
    description: Fast, modern React for startups and MVPs
    audience: [startups, mvp, personal]
    skills:
      frontend:
        framework: react
        styling: scss-modules
        state-management: zustand
        server-state: react-query
      backend:
        api: hono
        database: drizzle
        auth: better-auth
    philosophy: "Ship fast, iterate faster"

  - id: enterprise-react
    name: Enterprise React
    description: Production-grade React with comprehensive tooling
    audience: [enterprise, large-teams]
    skills:
      frontend:
        framework: react
        styling: tailwind
        state-management: redux
      backend:
        api: hono
        database: drizzle
        auth: better-auth
        observability: pino-sentry-axiom
    philosophy: "Stability and type safety first"

  - id: minimal-backend
    name: Minimal Backend
    description: Lightweight API without frontend
    audience: [api-only, microservices]
    skills:
      backend:
        api: hono
        database: drizzle
    philosophy: "Just the essentials"

# =============================================================================
# Skill Aliases (Map short names to full IDs)
# =============================================================================

skill_aliases:
  # These map the short names above to full skill IDs
  react: "frontend/react (@vince)"
  vue: "frontend/vue (@vince)"
  scss-modules: "frontend/styling-scss-modules (@vince)"
  tailwind: "frontend/styling-tailwind (@vince)"
  styled-components: "frontend/styling-styled-components (@vince)"
  zustand: "frontend/state-zustand (@vince)"
  redux: "frontend/state-redux (@vince)"
  mobx: "frontend/state-mobx (@vince)"
  react-query: "frontend/server-state-react-query (@vince)"
  hono: "backend/api-hono (@vince)"
  express: "backend/api-express (@vince)"
  drizzle: "backend/database-drizzle (@vince)"
  prisma: "backend/database-prisma (@vince)"
  better-auth: "backend/auth-better-auth+drizzle+hono (@vince)"
  cva: "frontend/styling-cva (@vince)"
  vitest: "frontend/testing-vitest (@vince)"
  pinia: "frontend/state-pinia (@vince)"
```

### TypeScript Types

```typescript
// src/cli/types-matrix.ts

export interface SkillsMatrixConfig {
  version: string;
  categories: Record<string, CategoryDefinition>;
  relationships: RelationshipDefinitions;
  suggested_stacks: SuggestedStack[];
  skill_aliases: Record<string, string>;
}

export interface CategoryDefinition {
  id: string;
  name: string;
  description: string;
  parent?: string; // For subcategories
  exclusive: boolean; // Only one skill allowed
  required: boolean; // Must select something
  order: number;
  icon?: string;
}

export interface RelationshipDefinitions {
  conflicts: ConflictRule[];
  recommends: RecommendRule[];
  requires: RequireRule[];
  alternatives: AlternativeGroup[];
}

export interface ConflictRule {
  skills: string[]; // All these conflict with each other
  reason: string;
}

export interface RecommendRule {
  when: string; // When this skill is selected
  suggest: string[]; // Suggest these
  reason: string;
}

export interface RequireRule {
  skill: string; // This skill
  needs: string[]; // Requires these
  needs_any?: boolean; // OR logic (needs at least one)
  reason: string;
}

export interface AlternativeGroup {
  purpose: string;
  skills: string[];
}

export interface SuggestedStack {
  id: string;
  name: string;
  description: string;
  audience: string[];
  skills: Record<string, Record<string, string>>;
  philosophy: string;
}
```

---

## Metadata Extraction

### What Already Exists in `metadata.yaml`

Each skill's `metadata.yaml` contains:

```yaml
# yaml-language-server: $schema=../../../schemas/metadata.schema.json
category: client-state # Required: skill category
category_exclusive: true # Optional: only one from category (default: true)
author: "@vince" # Required: author handle with @ prefix
version: 1 # Required: integer version (NOT semver)
cli_name: Zustand # Required: short display name for CLI
cli_description: Lightweight client state # Required: 5-6 word description for CLI
usage_guidance: Use when managing global UI state, replacing Context misuse, or handling cross-component state.
compatible_with: # Optional: skills this works well with
  - frontend/react
  - frontend/api
tags: # Optional: search/filtering tags
  - zustand
  - state-management
```

**Required fields:**

- `category`: Skill category (framework, state, styling, etc.)
- `author`: Author handle with @ prefix (e.g., "@vince")
- `version`: Integer version (1, 2, 3) - NOT semantic versioning
- `cli_name`: Short display name shown in CLI (combined with author as "Zustand @vince")
- `cli_description`: Brief description (5-6 words max) for CLI display
- `usage_guidance`: When an AI agent should invoke this skill (decision criteria)

### Extraction Script

```typescript
// src/cli/lib/extract-matrix.ts

import fg from "fast-glob";
import { parse as parseYaml } from "yaml";
import { readFile } from "./fs";

interface ExtractedSkill {
  id: string;
  name: string;
  description: string;
  category: string;
  categoryExclusive: boolean;
  author: string;
  version: string;
  compatibleWith: string[];
  conflictsWith: string[];
  requires: string[];
  tags: string[];
  path: string;
}

export async function extractAllSkills(
  rootDir: string,
): Promise<ExtractedSkill[]> {
  const skills: ExtractedSkill[] = [];

  // Find all SKILL.md files
  const skillFiles = await fg("**/SKILL.md", {
    cwd: `${rootDir}/src/skills`,
    absolute: true,
  });

  for (const skillFile of skillFiles) {
    const skillDir = path.dirname(skillFile);

    // Parse SKILL.md frontmatter
    const skillContent = await readFile(skillFile);
    const frontmatter = parseFrontmatter(skillContent);

    // Parse metadata.yaml
    const metadataFile = path.join(skillDir, "metadata.yaml");
    const metadataContent = await readFile(metadataFile);
    const metadata = parseYaml(metadataContent);

    skills.push({
      id: frontmatter.name,
      name: extractDisplayName(frontmatter.name),
      description: frontmatter.description,
      category: metadata.category,
      categoryExclusive: metadata.category_exclusive ?? true,
      author: metadata.author,
      version: metadata.version,
      compatibleWith: metadata.compatible_with ?? [],
      conflictsWith: metadata.conflicts_with ?? [],
      requires: metadata.requires ?? [],
      tags: metadata.tags ?? [],
      path: path.relative(`${rootDir}/src`, skillDir),
    });
  }

  return skills;
}

// Output combined data for CLI consumption
export async function generateSkillsMatrix(rootDir: string) {
  const skills = await extractAllSkills(rootDir);
  const matrix = await loadSkillsMatrix(
    `${rootDir}/src/config/skills-matrix.yaml`,
  );

  // Merge extracted skills with matrix relationships
  return {
    version: matrix.version,
    categories: matrix.categories,
    skills: skills.map((s) => ({
      ...s,
      // Add computed relationship data
      conflictsWith: getConflicts(s.id, matrix),
      recommends: getRecommendations(s.id, matrix),
      requiredBy: getRequirements(s.id, matrix),
    })),
    suggestedStacks: matrix.suggested_stacks,
    skillAliases: matrix.skill_aliases,
  };
}
```

---

## Minimal MVP Dataset

### Why This Matters

To iterate quickly, use the **smallest possible dataset** that tests ALL wizard flows.

### The Minimal Dataset

```yaml
# src/config/skills-matrix-mvp.yaml
# MINIMAL dataset for testing - 10 skills, 4 subcategories, 2 stacks

version: "1.0.0-mvp"

categories:
  frontend:
    id: frontend
    name: Frontend
    order: 1

  backend:
    id: backend
    name: Backend
    order: 2

  styling:
    id: styling
    name: Styling
    parent: frontend
    exclusive: true
    required: true
    order: 1

  state:
    id: state
    name: State Management
    parent: frontend
    exclusive: true
    required: false
    order: 2

  api:
    id: api
    name: API Framework
    parent: backend
    exclusive: true
    required: true
    order: 1

  database:
    id: database
    name: Database
    parent: backend
    exclusive: true
    required: false
    order: 2

relationships:
  conflicts:
    # Styling conflicts
    - skills: [scss, tailwind]
      reason: "Different CSS approaches"

    # State conflicts
    - skills: [zustand, redux]
      reason: "Choose one state solution"

    # Backend conflicts
    - skills: [hono, express]
      reason: "Choose one API framework"

  recommends:
    - when: scss
      suggest: [cva]
      reason: "CVA works great with SCSS"

    - when: hono
      suggest: [drizzle]
      reason: "Hono + Drizzle is recommended"

  requires:
    - skill: zustand
      needs: [react]
      reason: "React only"

    - skill: redux
      needs: [react]
      reason: "React only"

    - skill: drizzle
      needs: [hono, express]
      needs_any: true
      reason: "Needs API framework"

  alternatives:
    - purpose: "Styling"
      skills: [scss, tailwind]

    - purpose: "State"
      skills: [zustand, redux]

    - purpose: "Backend"
      skills: [hono, express]

suggested_stacks:
  - id: modern
    name: Modern Stack
    description: SCSS + Zustand + Hono + Drizzle
    audience: [general]
    skills:
      frontend:
        styling: scss
        state: zustand
      backend:
        api: hono
        database: drizzle
    philosophy: "Modern and lightweight"

  - id: minimal
    name: Minimal Stack
    description: Tailwind + Hono only
    audience: [minimal]
    skills:
      frontend:
        styling: tailwind
      backend:
        api: hono
    philosophy: "Just the essentials"

skill_aliases:
  react: "frontend/react (@vince)"
  scss: "frontend/styling-scss-modules (@vince)"
  tailwind: "frontend/styling-tailwind (@vince)"
  zustand: "frontend/state-zustand (@vince)"
  redux: "frontend/state-redux (@vince)"
  cva: "frontend/styling-cva (@vince)"
  hono: "backend/api-hono (@vince)"
  express: "backend/api-express (@vince)"
  drizzle: "backend/database-drizzle (@vince)"
```

### Test Coverage Matrix

| Flow                   | Test Case                          | What Tests It                         |
| ---------------------- | ---------------------------------- | ------------------------------------- |
| Category selection     | Choose frontend or backend         | 2 top-level categories                |
| Subcategory (required) | Frontend → Styling                 | `required: true`                      |
| Subcategory (optional) | Frontend → State                   | `required: false`                     |
| Skill selection        | SCSS or Tailwind                   | 2 skills per subcategory              |
| **Conflicts**          | Select SCSS → Tailwind disabled    | `conflicts: [scss, tailwind]`         |
| **Recommendations**    | Select SCSS → CVA highlighted      | `recommends: scss → cva`              |
| **Requirements**       | Select Zustand → needs React       | `requires: zustand → react`           |
| **Cross-category req** | Select Drizzle → needs Hono        | `requires: drizzle → [hono, express]` |
| Alternatives display   | Show SCSS/Tailwind as alternatives | `alternatives` group                  |
| Back navigation        | Go back from any step              | Wizard state machine                  |
| Skip category          | Skip backend entirely              | `required: false` on parent           |
| Pre-built stacks       | Select "Modern" or "Minimal"       | 2 stacks                              |

### Skill Count: 10

1. `react` (framework - implicit/assumed)
2. `scss` (styling)
3. `tailwind` (styling)
4. `cva` (styling enhancement)
5. `zustand` (state)
6. `redux` (state)
7. `hono` (api)
8. `express` (api)
9. `drizzle` (database)
10. (implicit) `prisma` could be added for database alternatives

This is the **minimum viable dataset** - removing any item would lose test coverage.

---

## Implementation Plan

### Phase 1: Create Configuration Files (1 hour)

1. Create `src/config/skills-matrix-mvp.yaml` with minimal dataset
2. Create `src/cli/types-matrix.ts` with TypeScript types
3. Create `src/schemas/skills-matrix.schema.json` for validation

### Phase 2: Build Matrix Loader (2 hours)

1. Create `src/cli/lib/matrix-loader.ts`
   - Load and parse YAML
   - Validate against schema
   - Build lookup tables

2. Create `src/cli/lib/matrix-resolver.ts`
   - `isDisabled(skill, selections)` - Check if skill is disabled
   - `isRecommended(skill, selections)` - Check if skill is recommended
   - `getDisableReason(skill, selections)` - Get human-readable reason
   - `getRequirements(skill)` - Get required skills

### Phase 3: Integrate with Wizard (2 hours)

1. Update wizard to load matrix at startup
2. Replace hardcoded options with matrix-driven options
3. Add visual indicators for disabled/recommended

### Phase 4: Test All Flows (1 hour)

1. Run through each flow in test matrix
2. Verify conflicts disable correctly
3. Verify recommendations highlight correctly
4. Verify requirements enforce correctly

### Total: ~6 hours for MVP

---

## File Structure

```
src/
├── config/
│   ├── skills-matrix.yaml           # Full production config
│   └── skills-matrix-mvp.yaml       # Minimal test config
├── schemas/
│   └── skills-matrix.schema.json    # Validation schema
├── cli/
│   ├── types-matrix.ts              # TypeScript types
│   └── lib/
│       ├── matrix-loader.ts         # Load & parse config
│       ├── matrix-resolver.ts       # Compute disabled/recommended
│       └── wizard.ts                # Wizard with matrix integration
```

---

## Repository Separation

### The Problem

Currently, CLI and content (skills, stacks, matrix) live in the same repository. Eventually:

- **CLI** → Separate npm package (`@claude-collective/cc`)
- **Content** → Separate repository (`claude-collective/claude-collective`)

How does the CLI access the skills matrix when they're in different repos?

### The Solution: Fetch at Runtime

```
┌─────────────────────────────────────────────────────────────────┐
│                    User's Machine                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐     ┌──────────────────────────────────┐  │
│  │   CLI Package    │     │      Local Cache                 │  │
│  │  (@claude-       │────▶│  ~/.cache/claude-collective/     │  │
│  │   collective/cc) │     │  ├── skills-matrix.yaml          │  │
│  └──────────────────┘     │  ├── skills/                     │  │
│           │               │  └── stacks/                     │  │
│           │ cc update     └──────────────────────────────────┘  │
│           │                          ▲                          │
│           ▼                          │ giget                    │
│  ┌──────────────────────────────────┴───────────────────────┐  │
│  │              GitHub: claude-collective/claude-collective  │  │
│  │              ├── skills-matrix.yaml                       │  │
│  │              ├── skills/                                  │  │
│  │              └── stacks/                                  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### How It Works

#### 1. First Run (`cc init`)

```typescript
// No local cache exists
// CLI fetches skills-matrix.yaml from GitHub
const matrix = await fetchFromGitHub("skills-matrix.yaml");
await cacheLocally(matrix);
```

#### 2. Subsequent Runs

```typescript
// Check local cache first
const matrix = await loadFromCache("skills-matrix.yaml");
if (!matrix) {
  // Fallback to fetch
  matrix = await fetchFromGitHub("skills-matrix.yaml");
}
```

#### 3. Explicit Update (`cc update`)

```typescript
// Force refresh from GitHub
await fetchFromGitHub("skills-matrix.yaml", { force: true });
await fetchFromGitHub("skills/", { force: true });
await fetchFromGitHub("stacks/", { force: true });
```

### Implementation with giget

Already using `giget` in the codebase (see `CLI-IMPLEMENTATION-PLAN.md`):

```typescript
import { downloadTemplate } from "giget";

const GITHUB_REPO = "claude-collective/claude-collective";
const CACHE_DIR = path.join(os.homedir(), ".cache", "claude-collective");

export async function fetchSkillsMatrix(options: { force?: boolean } = {}) {
  const dest = path.join(CACHE_DIR, "skills-matrix.yaml");

  await downloadTemplate(`gh:${GITHUB_REPO}/skills-matrix.yaml#main`, {
    dir: path.dirname(dest),
    preferOffline: !options.force, // Use cache if available
    force: options.force, // Force re-download
  });

  return loadYaml(dest);
}

export async function fetchSkills(options: { force?: boolean } = {}) {
  await downloadTemplate(`gh:${GITHUB_REPO}/skills#main`, {
    dir: path.join(CACHE_DIR, "skills"),
    preferOffline: !options.force,
    force: options.force,
  });
}
```

### Local Project Overrides

Users can have a local `skills-matrix.yaml` in their project to:

- Add custom skills
- Override recommendations
- Define project-specific stacks

```typescript
async function loadMatrix() {
  // 1. Load base matrix from cache (fetched from GitHub)
  const baseMatrix = await loadFromCache("skills-matrix.yaml");

  // 2. Check for local override
  const localOverride = await loadIfExists("./skills-matrix.yaml");

  // 3. Merge (local wins)
  return deepMerge(baseMatrix, localOverride);
}
```

### Cache Location

Following XDG Base Directory spec:

| Platform | Cache Path                            |
| -------- | ------------------------------------- |
| Linux    | `~/.cache/claude-collective/`         |
| macOS    | `~/Library/Caches/claude-collective/` |
| Windows  | `%LOCALAPPDATA%/claude-collective/`   |

```typescript
import os from "os";
import path from "path";

function getCacheDir(): string {
  const platform = process.platform;

  if (platform === "darwin") {
    return path.join(os.homedir(), "Library", "Caches", "claude-collective");
  } else if (platform === "win32") {
    return path.join(
      process.env.LOCALAPPDATA || os.homedir(),
      "claude-collective",
    );
  } else {
    // Linux and others - use XDG
    const xdgCache =
      process.env.XDG_CACHE_HOME || path.join(os.homedir(), ".cache");
    return path.join(xdgCache, "claude-collective");
  }
}
```

### CLI Commands

| Command              | Action                                    |
| -------------------- | ----------------------------------------- |
| `cc init`            | Fetches matrix if not cached, runs wizard |
| `cc update`          | Force refresh all content from GitHub     |
| `cc update --matrix` | Only refresh skills-matrix.yaml           |
| `cc update --skills` | Only refresh skills/ directory            |
| `cc cache clear`     | Clear local cache                         |
| `cc cache path`      | Show cache location                       |

### Version Checking

The matrix has a `version` field:

```yaml
version: "1.2.0"
```

CLI can check if cached version is outdated:

```typescript
async function checkForUpdates() {
  const cached = await loadFromCache("skills-matrix.yaml");
  const remote = await fetchVersionOnly(); // Lightweight API call

  if (semver.gt(remote.version, cached.version)) {
    console.log(`Update available: ${cached.version} → ${remote.version}`);
    console.log("Run: cc update");
  }
}
```

### Offline Mode

CLI works offline with cached content:

```typescript
async function loadMatrixWithFallback() {
  try {
    // Try to update from GitHub
    return await fetchSkillsMatrix({ preferOffline: false });
  } catch (error) {
    // Network error - use cache
    console.warn("Using cached matrix (offline mode)");
    return await loadFromCache("skills-matrix.yaml");
  }
}
```

### Summary

| Concern                 | Solution                                             |
| ----------------------- | ---------------------------------------------------- |
| Where does matrix live? | Content repo (`claude-collective/claude-collective`) |
| How does CLI get it?    | `giget` fetches from GitHub                          |
| Where is it cached?     | `~/.cache/claude-collective/`                        |
| How to update?          | `cc update` command                                  |
| Local customization?    | Merge with `./skills-matrix.yaml` in project         |
| Offline support?        | Falls back to cached version                         |

---

## Implementation Status

> **Last Updated:** 2026-01-20

### Completed Files

The following files have been created as part of Phase 1 (Configuration Files):

| File                          | Path                                    | Purpose                                                 | Status  |
| ----------------------------- | --------------------------------------- | ------------------------------------------------------- | ------- |
| **skills-matrix.yaml**        | `src/config/skills-matrix.yaml`         | Full production matrix with 70+ skills, 20+ categories  | Created |
| **skills-matrix-mvp.yaml**    | `src/config/skills-matrix-mvp.yaml`     | MVP test dataset with 10 skills, 7 categories, 3 stacks | Created |
| **types-matrix.ts**           | `src/cli/types-matrix.ts`               | Comprehensive TypeScript types for the matrix system    | Created |
| **skills-matrix.schema.json** | `src/schemas/skills-matrix.schema.json` | JSON Schema for YAML validation                         | Created |

### File Details

#### `src/config/skills-matrix.yaml` (807 lines)

Production-ready matrix containing:

- **4 top-level categories**: frontend, backend, mobile, setup
- **18 subcategories**: framework, meta-framework, styling, client-state, server-state, forms, testing, ui-components, i18n, mocking, api, database, auth, observability, analytics, email, mobile-framework, monorepo, tooling
- **70+ skill aliases** mapping to full skill IDs
- **7 suggested stacks**: modern-react, modern-react-tailwind, vue-stack, angular-stack, minimal-backend, mobile-stack, full-observability
- **Complete relationship definitions**: conflicts, recommends, requires, alternatives

#### `src/config/skills-matrix-mvp.yaml` (255 lines)

Minimal test dataset covering all wizard flows:

- **2 top-level categories**: frontend, backend
- **5 subcategories**: framework, styling, state, api, database
- **10 skills**: react, scss, tailwind, cva, zustand, redux, vitest, hono, express, drizzle, prisma
- **3 suggested stacks**: modern, minimal, enterprise
- **Test coverage matrix** documented in comments

#### `src/cli/types-matrix.ts` (676 lines)

Comprehensive TypeScript type definitions organized into 6 sections:

1. **Raw Input Types** - `SkillsMatrixConfig`, `CategoryDefinition`, `RelationshipDefinitions`
2. **Extracted Skill Metadata** - `ExtractedSkillMetadata` for metadata.yaml data
3. **Merged Output Types** - `MergedSkillsMatrix`, `ResolvedSkill`, `ResolvedStack`
4. **Runtime Types** - `SkillOption`, `CategoryWithOptions`, `WizardState`
5. **Validation Types** - `SelectionValidation`, `ValidationError`, `ValidationWarning`
6. **Utility Types** - `MatrixLookupTables`, `ResolvedId`

#### `src/schemas/skills-matrix.schema.json` (311 lines)

JSON Schema (draft-07) for validation:

- Validates all required fields
- Pattern matching for IDs (kebab-case)
- Minimum items for arrays
- References for nested types (`$ref`)
- Examples for documentation

### Remaining Work

The following files are planned but **not yet created**:

| File               | Path                             | Purpose                                    | Status  |
| ------------------ | -------------------------------- | ------------------------------------------ | ------- |
| matrix-loader.ts   | `src/cli/lib/matrix-loader.ts`   | Load & parse YAML, validate against schema | Planned |
| matrix-resolver.ts | `src/cli/lib/matrix-resolver.ts` | Compute disabled/recommended at runtime    | Planned |

### Phase Completion

| Phase   | Description                | Status       |
| ------- | -------------------------- | ------------ |
| Phase 1 | Create Configuration Files | **Complete** |
| Phase 2 | Build Matrix Loader        | Not Started  |
| Phase 3 | Integrate with Wizard      | Not Started  |
| Phase 4 | Test All Flows             | Not Started  |

---

## Eject: Full Independence

### Philosophy

The CLI and community content are designed to help users get started quickly. Once a team is comfortable with the system and wants full control, they can eject.

Two modes:

1. **Local eject** - Copy everything locally (simple, offline, no connection)
2. **Fork eject** - Create a GitHub fork (keeps upstream connection, can pull updates)

---

### Option 1: Local Eject

Exports all resolved content into `.claude-collective/`:

```
.claude-collective/
├── principles/           # All principles (core + any overrides)
├── templates/            # LiquidJS templates
├── agents/               # All agent definitions
│   ├── developer/
│   ├── reviewer/
│   └── ...
├── skills/               # All skills from selected stacks
├── schemas/              # JSON schemas for validation
├── stacks/
│   └── {stack-name}/
│       └── config.yaml
└── compile.ts            # Standalone compiler script
```

**Command:**

```bash
cc eject                  # Eject to .claude-collective/
cc eject --dry-run        # Preview what would be exported
cc eject --include-all    # Include all skills, not just selected
```

**After local eject:**

- Everything is local—no external dependencies
- The CLI still works with local content
- No automatic updates from upstream
- Full ownership and responsibility

---

### Option 2: Fork Eject (Recommended for Teams)

Creates a GitHub fork, preserving git history and upstream connection.

**Command:**

```bash
cc eject --fork                      # Fork to your GitHub account
cc eject --fork --org my-company     # Fork to an organization
cc eject --fork --private            # Make the fork private
```

**What this creates:**

```
┌─────────────────────────────────────────────────────┐
│  claude-collective/skills (upstream)                │
│  ───────────────────────────────────────────────    │
│  Commits: A → B → C → D → E → F                     │
└─────────────────────────────────────────────────────┘
                      │
                      │ gh repo fork
                      ▼
┌─────────────────────────────────────────────────────┐
│  my-company/skills (your fork)                      │
│  ───────────────────────────────────────────────    │
│  Commits: A → B → C → X → Y (your changes)          │
│                                                     │
│  Upstream remote configured automatically           │
└─────────────────────────────────────────────────────┘
```

**After fork eject:**

- Full git history preserved
- Upstream remote configured (`upstream` → claude-collective/skills)
- Can pull updates selectively
- Can contribute back via PRs
- Your source config updated to point to your fork

**Pulling upstream updates later:**

```bash
cd .claude-collective
git fetch upstream
git log upstream/main --oneline     # See what's new
git cherry-pick abc123              # Pick specific updates
# or
git merge upstream/main             # Merge all updates
```

**Comparison:**

| Aspect            | Local Eject      | Fork Eject           |
| ----------------- | ---------------- | -------------------- |
| Git history       | None (snapshot)  | Full history         |
| Upstream updates  | Manual re-eject  | `git fetch upstream` |
| Contribution path | None             | PR to upstream       |
| Requires GitHub   | No               | Yes                  |
| Offline setup     | Yes              | No (needs network)   |
| Recommended for   | Solo/experiments | Teams/companies      |

---

### Implementation Notes

#### Local Eject Process

1. **Resolve all content** - Determine what files are needed based on current stacks
2. **Copy principles** - From `src/agents/_principles/` or cache
3. **Copy templates** - From `src/agents/_templates/` or cache
4. **Copy agents** - All agent definitions needed by stacks
5. **Copy skills** - All skills referenced by current stacks
6. **Copy schemas** - For continued validation support
7. **Generate standalone compiler** - Self-contained `compile.ts` that works without the CLI
8. **Remove source config** - Clear the `source:` field so CLI knows content is local

```typescript
// Pseudo-implementation
async function ejectLocal(options: { dryRun?: boolean; includeAll?: boolean }) {
  const destination = ".claude-collective";

  const stacks = await loadLocalStacks();
  const requiredSkills = options.includeAll
    ? await getAllAvailableSkills()
    : getSkillsFromStacks(stacks);

  await copyPrinciples(destination);
  await copyTemplates(destination);
  await copyAgents(destination);
  await copySkills(requiredSkills, destination);
  await copySchemas(destination);
  await generateStandaloneCompiler(destination);
  await updateConfig({ ejected: true, source: null });

  console.log("Ejected successfully. Content is now fully local.");
}
```

#### Fork Eject Process

1. **Verify GitHub CLI** - Check `gh` is installed and authenticated
2. **Create fork** - Use `gh repo fork` with appropriate flags
3. **Clone fork** - Clone to `.claude-collective/`
4. **Configure upstream** - Ensure upstream remote is set
5. **Update source config** - Point to the new fork

```typescript
// Pseudo-implementation
async function ejectFork(options: { org?: string; private?: boolean }) {
  // 1. Check gh CLI
  await assertGhInstalled();
  await assertGhAuthenticated();

  // 2. Fork the repo
  const forkArgs = ["repo", "fork", "claude-collective/skills", "--clone"];
  if (options.org) forkArgs.push("--org", options.org);
  // Note: --private requires GitHub API, may need additional handling

  await exec("gh", forkArgs);

  // 3. Move to .claude-collective
  await fs.rename("skills", ".claude-collective");

  // 4. Verify upstream remote
  await exec("git", ["-C", ".claude-collective", "remote", "-v"]);

  // 5. Update config
  const forkUrl = await getForkUrl();
  await updateConfig({ source: forkUrl, ejected: "fork" });

  console.log("Fork created successfully.");
  console.log(
    "Pull upstream updates with: cd .claude-collective && git fetch upstream",
  );
}
```

---

### The Standalone Compiler

After local eject, `.claude-collective/compile.ts` is a self-contained script:

```typescript
// .claude-collective/compile.ts
// Standalone compiler - no CLI dependency required

import { compile } from "./lib/compiler";

const stack = process.argv[2] || "default";
await compile({
  stackDir: `.claude-collective/stacks/${stack}`,
  outputDir: ".claude",
  principlesDir: ".claude-collective/principles",
  templatesDir: ".claude-collective/templates",
});
```

Users can:

- Run `bun .claude-collective/compile.ts` directly
- Uninstall the CLI entirely
- Modify any file without worrying about upstream changes

---

## Key Insight

**The CLI knows NOTHING about React, Zustand, Hono, or any specific technology.**

It simply:

1. Reads `skills-matrix.yaml`
2. Shows categories from config
3. Shows skills from config
4. Computes disabled/recommended from relationships
5. Validates selections against requirements

All the "intelligence" is in the YAML file, not the code.

---

_Created: 2026-01-20_
