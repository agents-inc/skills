# Plugin Architecture Implementation Approach

> **Purpose**: Detailed implementation plan to align current codebase with target architecture
> **Date**: 2026-01-24
> **Status**: SUPERSEDED by Agent Plugin Migration
> **Note**: This document describes the original multi-plugin approach. The architecture has been simplified to use a single shared plugin with switchable stacks. See [AGENT-PLUGIN-MIGRATION.md](./AGENT-PLUGIN-MIGRATION.md) for the current architecture.

---

## Executive Summary

This document outlines the implementation changes required to transform the current CLI from a dual-mode (classic + plugin) system to a unified plugin-first architecture where:

1. **`cc init`** produces complete plugins (skills + compiled agents)
2. **`cc add`** adds skills to existing plugins and recompiles
3. **Marketplace is single source of truth** for skills, agents, principles, templates
4. **CLI is stateless** - no bundled content, all fetched at runtime

---

## Current State Analysis

### What Works Well

| Component               | Status  | Location                               |
| ----------------------- | ------- | -------------------------------------- |
| LiquidJS templating     | Working | `src/cli/lib/compiler.ts`              |
| Agent compilation       | Working | `src/agents/_templates/agent.liquid`   |
| Skill plugin generation | Working | `src/cli/lib/skill-plugin-compiler.ts` |
| Source fetching (giget) | Working | `src/cli/lib/source-fetcher.ts`        |
| Marketplace generation  | Working | `src/cli/lib/marketplace-generator.ts` |
| Plugin validation       | Working | `src/cli/lib/plugin-validator.ts`      |

### Critical Gaps

| Gap                              | Current Behavior                            | Target Behavior                         | Priority   |
| -------------------------------- | ------------------------------------------- | --------------------------------------- | ---------- |
| Stack plugins don't embed skills | `skills: ["skill-react", ...]` (references) | `skills: "./skills/"` (embedded folder) | **HIGH**   |
| `cc init` incomplete             | Skills only OR agents only                  | Skills AND agents                       | **HIGH**   |
| `cc add` wrong behavior          | Adds new stacks                             | Adds skill to existing plugin           | **HIGH**   |
| No network fetch for agents      | Bundled in CLI                              | Fetched from marketplace                | **MEDIUM** |
| `.claude-collective/` deprecated | Still used                                  | Remove completely                       | **MEDIUM** |

---

## Implementation Phases

### Phase 1: Stack Plugin Embeds Skills

**Goal**: Make `compile-stack` output include `skills/` directory with embedded content.

#### Files to Modify

| File                                   | Changes                                   |
| -------------------------------------- | ----------------------------------------- |
| `src/cli/lib/stack-plugin-compiler.ts` | Add skill copying logic                   |
| `src/cli/lib/plugin-manifest.ts`       | Change `skills` from array to path string |

#### Implementation Details

**1.1 Modify imports in `stack-plugin-compiler.ts`**

Location: Lines 3-10

```typescript
// ADD directoryExists to existing imports:
import {
  readFile,
  readFileOptional,
  writeFile,
  ensureDir,
  copy,
  fileExists,
  directoryExists, // ADD THIS
} from "../utils/fs";
```

**1.2 Modify `compileStackPlugin()` in `stack-plugin-compiler.ts`**

Location: Lines 302-419

```typescript
// ADD after line 334 (after `await ensureDir(agentsDir);`)
// Create skills directory
const pluginSkillsDir = path.join(pluginDir, "skills");
await ensureDir(pluginSkillsDir);

// Copy skills from stack source to plugin output
const stackSkillsDir = path.join(projectRoot, DIRS.stacks, stackId, "skills");
if (await directoryExists(stackSkillsDir)) {
  await copy(stackSkillsDir, pluginSkillsDir);
  verbose(`  Copied skills to ${pluginSkillsDir}`);
}
```

> **Note:** Uses existing `copy()` and `directoryExists()` functions from `src/cli/utils/fs.ts` (lines 21-28 and 56-58).

**1.3 Modify `generateStackPluginManifest()` in `plugin-manifest.ts`**

Location: Lines 120-157

```typescript
// CHANGE lines 129-133 from:
// Stack plugins reference skill plugins by name, not by path
// Only include if there are skill plugin dependencies
if (options.skills && options.skills.length > 0) {
  manifest.skills = options.skills; // Array of names
}

// TO:
// Stack plugins embed skills as a directory
if (options.hasSkills) {
  manifest.skills = "./skills/"; // Path to embedded skills
}
```

**1.4 Update `StackPluginOptions` interface in `plugin-manifest.ts`**

Location: Lines 51-70

```typescript
// CHANGE line 65:
skills?: string[];  // Array of skill plugin names

// TO:
hasSkills?: boolean;  // Whether skills directory should be embedded
```

**1.5 Update caller in `stack-plugin-compiler.ts`**

Location: Lines 385-396

```typescript
// CHANGE from:
const uniqueSkillPlugins = [...new Set(allSkillPlugins)];
const manifest = generateStackPluginManifest({
  // ...
  skills: uniqueSkillPlugins,
});

// TO:
const manifest = generateStackPluginManifest({
  stackName: stackId,
  description: stack.description,
  author: stack.author,
  version: stack.version,
  keywords: stack.tags,
  hasAgents: true,
  hasHooks,
  hasSkills: true, // Always true - skills are embedded
});
```

#### Verification

```bash
# Before: dist/stacks/fullstack-react/ has no skills/ directory
# After:
dist/stacks/fullstack-react/
├── .claude-plugin/plugin.json  # skills: "./skills/"
├── skills/                     # NEW - embedded skills
│   └── frontend/
│       └── react/
│           └── SKILL.md
├── agents/
└── README.md
```

---

### Phase 2: Unified `cc init` Command

**Goal**: Single command produces complete plugin with skills AND agents.

#### Current Flow (init.ts)

```
1. loadSkillsMatrixFromSource() - Fetch skills matrix
2. runWizard() - User selects skills
3. createStackFromSource() - Copy skills to .claude-collective/
4. writeActiveStack() - Set active stack
```

#### Target Flow

```
1. resolveSource() - Determine marketplace URL
2. fetchMarketplace() - NEW: Get marketplace.json
3. runWizard() - User selects skills from marketplace
4. fetchSkills() - NEW: Download selected skills
5. fetchAgentDefinitions() - NEW: Download agents, principles, templates
6. compilePlugin() - Compile skills + agents into complete plugin
7. writePlugin() - Output to .claude/plugins/<name>/
```

#### New Functions Required

**2.1 `fetchMarketplace()` in `source-fetcher.ts`**

```typescript
import type { Marketplace, MarketplaceFetchResult } from "../../types";

export async function fetchMarketplace(
  source: string,
  options: { forceRefresh?: boolean } = {},
): Promise<MarketplaceFetchResult> {
  const result = await fetchFromSource(source, {
    forceRefresh: options.forceRefresh,
    subdir: "", // Root of repo
  });

  const marketplacePath = path.join(
    result.path,
    ".claude-plugin",
    "marketplace.json",
  );
  const content = await fs.readFile(marketplacePath, "utf-8");
  const marketplace = JSON.parse(content) as Marketplace;

  return {
    marketplace,
    sourcePath: result.path,
    fromCache: result.fromCache ?? false,
    cacheKey: sanitizeSourceForCache(source),
  };
}
```

> **Note:** `Marketplace` type is defined at `types.ts:456-471`. The `sanitizeSourceForCache` function already exists in `source-fetcher.ts`.

**2.2 `fetchSkills()` in new file `skill-fetcher.ts`**

```typescript
export async function fetchSkills(
  skillIds: string[],
  marketplace: Marketplace,
  outputDir: string,
  options: { forceRefresh?: boolean } = {},
): Promise<void> {
  for (const skillId of skillIds) {
    const plugin = marketplace.plugins.find(
      (p) => p.name === `skill-${skillId}`,
    );
    if (!plugin) throw new Error(`Skill not found: ${skillId}`);

    // Fetch skill plugin from marketplace
    const skillSource = resolvePluginSource(plugin, marketplace);
    const result = await fetchFromSource(skillSource, options);

    // Copy skill content to output
    const srcSkillDir = path.join(result.path, "skills", skillId);
    const destSkillDir = path.join(outputDir, "skills", skillId);
    await copyDirectory(srcSkillDir, destSkillDir);
  }
}
```

**2.3 `fetchAgentDefinitions()` in new file `agent-fetcher.ts`**

```typescript
import type { AgentSourcePaths } from "../../types";

export async function fetchAgentDefinitions(
  source: string,
  options: { forceRefresh?: boolean } = {},
): Promise<AgentSourcePaths> {
  const result = await fetchFromSource(source, {
    forceRefresh: options.forceRefresh,
    subdir: "src/agents",
  });

  return {
    agentsDir: result.path,
    templatesDir: path.join(result.path, "_templates"),
    sourcePath: result.path,
  };
}
```

**Note:** Core principles are embedded directly in the template - no separate `principlesDir` needed.

**2.4 Update `init.ts` command**

```typescript
import type { AgentSourcePaths, MarketplaceFetchResult } from "../../types";
import { fetchMarketplace } from "../lib/source-fetcher";
import { fetchSkills } from "../lib/skill-fetcher";
import { fetchAgentDefinitions } from "../lib/agent-fetcher";

// Remove classic mode entirely
// Remove --plugin flag (always plugin mode)
// Keep --name, --scope, --source, --refresh

const initCommand = new Command("init")
  .description("Create a new Claude Code plugin")
  .requiredOption("--name <name>", "Plugin name (kebab-case)")
  .option("--source <url>", "Marketplace source URL")
  .option("--scope <scope>", "Output scope: user, project", "user")
  .option("--refresh", "Force refresh from marketplace")
  .action(async (options) => {
    // 1. Resolve source
    const sourceConfig = await resolveSource(options.source);

    // 2. Fetch marketplace
    const marketplaceResult: MarketplaceFetchResult = await fetchMarketplace(
      sourceConfig.source,
      { forceRefresh: options.refresh },
    );

    // 3. Run wizard (pass marketplace data, not the result wrapper)
    const selections = await runWizard(marketplaceResult.marketplace);

    // 4. Determine output path
    const outputDir = getPluginOutputPath(options.name, options.scope);

    // 5. Fetch skills
    await fetchSkills(
      selections.skills,
      marketplaceResult.marketplace,
      outputDir,
      { forceRefresh: options.refresh },
    );

    // 6. Fetch agent definitions
    const agentDefs: AgentSourcePaths = await fetchAgentDefinitions(
      sourceConfig.source,
      { forceRefresh: options.refresh },
    );

    // 7. Compile agents
    await compileAgents(outputDir, agentDefs, selections.agents);

    // 8. Generate manifest, CLAUDE.md, README.md
    await generatePluginFiles(outputDir, options.name, selections);

    console.log(`Plugin created at ${outputDir}`);
  });
```

---

### Phase 3: Update `cc add` Command

**Goal**: Add skill to existing plugin and recompile.

#### Target Flow

```
1. Locate existing plugin
2. Resolve marketplace source
3. Fetch skill from marketplace
4. Copy to plugin's skills/ folder
5. Fetch agent definitions from marketplace
6. Recompile all agents
7. Update plugin.json version
```

#### Implementation

```typescript
import { directoryExists } from "../utils/fs";
import type { AgentSourcePaths, MarketplaceFetchResult } from "../../types";

const addCommand = new Command("add")
  .description("Add a skill to an existing plugin")
  .argument("<skill>", "Skill name to add")
  .option("--source <url>", "Marketplace source URL")
  .option("--refresh", "Force refresh from marketplace")
  .action(async (skillName, options) => {
    // 1. Find existing plugin
    const pluginDir = await findPluginDirectory();
    if (!pluginDir) {
      throw new Error("No plugin found. Run 'cc init' first.");
    }

    // 2. Check if skill already exists (prevent duplicates)
    const existingSkillDir = path.join(pluginDir, "skills", skillName);
    if (await directoryExists(existingSkillDir)) {
      throw new Error(`Skill "${skillName}" already exists in this plugin.`);
    }

    // 3. Resolve source
    const sourceConfig = await resolveSource(options.source);

    // 4. Fetch marketplace
    const marketplaceResult: MarketplaceFetchResult = await fetchMarketplace(
      sourceConfig.source,
      { forceRefresh: options.refresh },
    );

    // 5. Fetch and copy skill
    await fetchSkills([skillName], marketplaceResult.marketplace, pluginDir, {
      forceRefresh: options.refresh,
    });

    // 6. Fetch agent definitions
    const agentDefs: AgentSourcePaths = await fetchAgentDefinitions(
      sourceConfig.source,
      { forceRefresh: options.refresh },
    );

    // 7. Recompile all agents
    await recompileAgents(pluginDir, agentDefs);

    // 8. Bump patch version
    await bumpPluginVersion(pluginDir, "patch");

    console.log(`Added ${skillName} to plugin`);
  });
```

**Helper function: `bumpPluginVersion()`**

```typescript
// Add to src/cli/lib/plugin-version.ts (or version.ts if extending existing)

import { readFile, writeFile } from "../utils/fs";
import path from "path";

export async function bumpPluginVersion(
  pluginDir: string,
  type: "major" | "minor" | "patch",
): Promise<string> {
  const manifestPath = path.join(pluginDir, ".claude-plugin", "plugin.json");
  const content = await readFile(manifestPath);
  const manifest = JSON.parse(content);

  const [major, minor, patch] = (manifest.version || "1.0.0")
    .split(".")
    .map(Number);

  const newVersion =
    type === "major"
      ? `${major + 1}.0.0`
      : type === "minor"
        ? `${major}.${minor + 1}.0`
        : `${major}.${minor}.${patch + 1}`;

  manifest.version = newVersion;
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

  return newVersion;
}
```

> **Note:** The existing `src/cli/commands/version.ts` has similar logic at lines 59-85 but operates on skill plugins. This function is for stack plugins specifically.

---

### Phase 4: Update `cc compile` Command

**Goal**: Recompile agents using local skills but fetched agent definitions.

#### Implementation

```typescript
import type { AgentSourcePaths } from "../../types";

const compileCommand = new Command("compile")
  .description("Recompile agents after manual skill edits")
  .option("--source <url>", "Marketplace source URL")
  .option("--refresh", "Force refresh agent definitions")
  .option("-v, --verbose", "Enable verbose logging")
  .action(async (options) => {
    // 1. Find existing plugin
    const pluginDir = await findPluginDirectory();
    if (!pluginDir) {
      throw new Error("No plugin found. Run 'cc init' first.");
    }

    // 2. Read local skills (do NOT fetch - use what's in the plugin)
    const skillsDir = path.join(pluginDir, "skills");
    const skills = await loadLocalSkills(skillsDir);

    // 3. Resolve source and fetch agent definitions
    const sourceConfig = await resolveSource(options.source);
    const agentDefs: AgentSourcePaths = await fetchAgentDefinitions(
      sourceConfig.source,
      { forceRefresh: options.refresh },
    );

    // 4. Compile agents using local skills + fetched definitions
    await compileAgents(pluginDir, agentDefs, skills, {
      verbose: options.verbose,
    });

    console.log("Agents recompiled successfully");
  });
```

> **Key difference from `cc init` and `cc add`:** The `compile` command does NOT fetch skills - it uses whatever is already in the plugin's `skills/` directory. This allows users to make local modifications to skills and recompile without losing their changes.

---

### Phase 5: Remove Deprecated Code

**Goal**: Clean up `.claude-collective/` support and classic mode.

#### Files to Remove/Modify

| Action | File                      | Reason                     |
| ------ | ------------------------- | -------------------------- |
| Remove | `COLLECTIVE_DIR` constant | No longer used             |
| Remove | `readActiveStack()`       | Classic mode only          |
| Remove | `writeActiveStack()`      | Classic mode only          |
| Modify | `init.ts`                 | Remove classic mode branch |
| Modify | `compile.ts`              | Remove "user" mode         |
| Remove | `switch.ts` command       | Classic mode only          |

---

## New Files Required

| File                             | Purpose                                  |
| -------------------------------- | ---------------------------------------- |
| `src/cli/lib/skill-fetcher.ts`   | Fetch skills from marketplace            |
| `src/cli/lib/agent-fetcher.ts`   | Fetch agent definitions from marketplace |
| `src/cli/lib/plugin-finder.ts`   | Locate existing plugin directory         |
| `src/cli/lib/plugin-compiler.ts` | Unified plugin compilation               |

---

## Type Changes

### New Types (add to `types.ts` near line 456, after existing `Marketplace` type)

```typescript
import type { CompileAgentConfig } from "./types"; // Already exists

/**
 * Result from fetching marketplace data from a remote source.
 * Contains the parsed marketplace and caching metadata.
 */
export interface MarketplaceFetchResult {
  /** Parsed marketplace data */
  marketplace: Marketplace;
  /** Path where source was fetched/cached */
  sourcePath: string;
  /** Whether result came from cache */
  fromCache: boolean;
  /** Cache key for invalidation (optional) */
  cacheKey?: string;
}

/**
 * Paths to fetched agent definition sources.
 * Contains directory paths, not agent data itself.
 * Note: Core principles are embedded directly in the template.
 */
export interface AgentSourcePaths {
  /** Path to agents directory (contains agent subdirs) */
  agentsDir: string;
  /** Path to _templates directory */
  templatesDir: string;
  /** Original source path */
  sourcePath: string;
}

/**
 * Options for compiling a complete plugin.
 * Used by unified compilation flow.
 */
export interface PluginCompileOptions {
  /** Output plugin directory */
  pluginDir: string;
  /** Path to skills directory in plugin */
  skillsDir: string;
  /** Fetched agent definition paths */
  agentDefs: AgentSourcePaths;
  /** Agent configs (matches CompileConfig.agents pattern) */
  agentConfigs: Record<string, CompileAgentConfig>;
  /** Enable verbose logging */
  verbose?: boolean;
}
```

> **Note:** `AgentSourcePaths` (not `AgentFetchResult`) clarifies these are paths, not agent data. `agentConfigs` uses `Record<string, CompileAgentConfig>` to match existing `CompileConfig.agents` pattern at `types.ts:114-121`.

---

## Migration Strategy

### Breaking Changes

1. **`.claude-collective/` no longer supported**
   - Users must run `cc init` to create new plugin
   - No automatic migration of existing stacks

2. **`cc switch` command removed**
   - Users manage multiple plugins via file system
   - Or create separate plugins per project

3. **`--plugin` flag removed from `cc init`**
   - Always produces plugins
   - No classic mode

### Backward Compatibility

- Existing compiled `.claude/` output continues to work
- Existing plugins in `.claude/plugins/` continue to work
- Only the CLI workflow changes

---

## Testing Plan

### Unit Tests

| Test               | File                      | Coverage                        |
| ------------------ | ------------------------- | ------------------------------- |
| Skill fetching     | `skill-fetcher.test.ts`   | Fetch, copy, error handling     |
| Agent fetching     | `agent-fetcher.test.ts`   | Fetch, validate, error handling |
| Plugin compilation | `plugin-compiler.test.ts` | Full compilation flow           |
| Plugin finding     | `plugin-finder.test.ts`   | Locate plugin in various scopes |

### Integration Tests

| Test             | Description                  |
| ---------------- | ---------------------------- |
| `cc init` E2E    | Create plugin from scratch   |
| `cc add` E2E     | Add skill to existing plugin |
| `cc compile` E2E | Recompile after manual edit  |
| Offline mode     | Verify cache usage           |
| Error recovery   | Network failure handling     |

### Manual Testing

See [MANUAL-TESTING-GUIDE.md](./MANUAL-TESTING-GUIDE.md) for detailed test procedures.

---

## Implementation Order

| Phase       | Description                | Dependencies | Blockers                                                     | Status                |
| ----------- | -------------------------- | ------------ | ------------------------------------------------------------ | --------------------- |
| **Phase 1** | Stack plugin embeds skills | None         | Foundation for all phases                                    | COMPLETE (2026-01-23) |
| **Phase 2** | Unified `cc init`          | Phase 1      | Creates `skill-fetcher.ts`, `agent-fetcher.ts`               | COMPLETE (2026-01-23) |
| **Phase 3** | Update `cc add`            | Phase 2      | Uses `fetchSkills()`, `fetchAgentDefinitions()` from Phase 2 | COMPLETE (2026-01-23) |
| **Phase 4** | Update `cc compile`        | Phase 2      | Uses `fetchAgentDefinitions()` from Phase 2                  | COMPLETE (2026-01-23) |
| **Phase 5** | Remove deprecated code     | Phases 1-4   | Cleanup after all features work                              | COMPLETE (2026-01-23) |
| **Phase 6** | Finalize `cc compile`      | Phase 4      | Use `getCollectivePluginDir()`, actual recompilation         | COMPLETE (2026-01-24) |

**Critical Path:** Phase 1 → Phase 2 → (Phase 3 + Phase 4 in parallel) → Phase 5 → Phase 6

---

### Phase 6: Finalize `cc compile` Command

**Goal**: Ensure `cc compile` uses `getCollectivePluginDir()` and performs actual agent recompilation.

#### Tasks

| Task | Description                                 | Status            |
| ---- | ------------------------------------------- | ----------------- |
| 6.1  | Always use `getCollectivePluginDir()`       | DONE (2026-01-24) |
| 6.2  | Read skills from plugin's `skills/` dir     | DONE (2026-01-24) |
| 6.3  | Fetch agent definitions from source         | DONE (2026-01-24) |
| 6.4  | Compile and write to plugin's `agents/` dir | DONE (2026-01-24) |
| 6.5  | Remove all legacy code paths                | DONE (2026-01-24) |

#### Implementation Details

**6.1 Use `getCollectivePluginDir()`**

Replaced `findPluginDirectory()` with `getCollectivePluginDir()`:

```typescript
// Before (searching for any plugin):
const pluginLocation = await findPluginDirectory();

// After (fixed path):
const pluginDir = getCollectivePluginDir();
```

**6.2-6.4 Read skills, fetch definitions, compile agents**

Uses existing functions:

- `getPluginSkillsDir(pluginDir)` for skills path
- `fetchAgentDefinitions()` for remote agent definitions
- `recompileAgents()` from `agent-recompiler.ts` for compilation

**6.5 Removed legacy code paths**

- Removed `findPluginDirectory` import
- Removed `PluginLocation` type dependency
- Added local `readPluginManifest()` function for manifest reading

---

## Risk Assessment

| Risk               | Likelihood | Impact | Mitigation                 |
| ------------------ | ---------- | ------ | -------------------------- |
| Network dependency | High       | Medium | Implement robust caching   |
| Breaking changes   | Certain    | Low    | Clear migration docs       |
| Compilation errors | Medium     | High   | Comprehensive validation   |
| Source unavailable | Low        | High   | Graceful fallback to cache |

---

## Success Criteria

- [ ] `cc init --name test-stack` produces complete plugin
- [ ] `cc add skill-jotai` adds skill and recompiles
- [ ] `cc compile` uses local skills, fetched agent defs
- [ ] All plugins validate with `cc validate`
- [ ] Offline mode works with cached sources
- [ ] No references to `.claude-collective/` in new code

---

## References

- [Plugin Distribution Architecture](./PLUGIN-DISTRIBUTION-ARCHITECTURE.md)
- [CLI Reference](./CLI-REFERENCE.md)
- [Plugin Development Guide](./PLUGIN-DEVELOPMENT.md)

---

_Last updated: 2026-01-24_
