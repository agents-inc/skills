import path from "path";
import { Liquid } from "liquidjs";
import {
  readFile,
  readFileOptional,
  writeFile,
  ensureDir,
  copy,
  fileExists,
  directoryExists,
} from "../utils/fs";
import { verbose } from "../utils/logger";
import { DIRS } from "../consts";
import {
  generateStackPluginManifest,
  writePluginManifest,
  getPluginManifestPath,
} from "./plugin-manifest";
import { loadStack, loadSkillsByIds, loadAllAgents } from "./loader";
import { resolveAgents, stackToCompileConfig } from "./resolver";
import { hashString, getCurrentDate } from "./versioning";
import type {
  PluginManifest,
  StackConfig,
  AgentConfig,
  CompileConfig,
  Skill,
  CompiledAgentData,
  AgentHookDefinition,
} from "../../types";

/**
 * Default version for new stack plugins (semver format)
 */
const DEFAULT_VERSION = "1.0.0";

/**
 * Internal state for tracking content hash between compiles
 * Hash is stored in a separate .content-hash file alongside plugin.json
 */
const CONTENT_HASH_FILE = ".content-hash";

/**
 * Parse semver string to extract major version number
 */
function parseMajorVersion(version: string): number {
  const match = version.match(/^(\d+)\./);
  return match ? parseInt(match[1], 10) : 1;
}

/**
 * Create a semver string with bumped major version
 */
function bumpMajorVersion(version: string): string {
  const major = parseMajorVersion(version);
  return `${major + 1}.0.0`;
}

/**
 * Read existing plugin manifest to get previous version
 */
async function readExistingManifest(
  pluginDir: string,
): Promise<{ version: string; contentHash: string | undefined } | null> {
  const manifestPath = getPluginManifestPath(pluginDir);

  if (!(await fileExists(manifestPath))) {
    return null;
  }

  try {
    const content = await readFile(manifestPath);
    const manifest = JSON.parse(content) as PluginManifest;

    // Try to read content hash from separate file
    const hashFilePath = manifestPath.replace("plugin.json", CONTENT_HASH_FILE);
    let contentHash: string | undefined;
    if (await fileExists(hashFilePath)) {
      contentHash = (await readFile(hashFilePath)).trim();
    }

    return {
      version: manifest.version ?? DEFAULT_VERSION,
      contentHash,
    };
  } catch {
    return null;
  }
}

/**
 * Hash stack config for content change detection
 * Uses stack config YAML and skill IDs as the content fingerprint
 */
function hashStackConfig(stack: StackConfig): string {
  // Create a deterministic string from stack config
  const parts: string[] = [
    `name:${stack.name}`,
    `description:${stack.description ?? ""}`,
    `skills:${(stack.skills || [])
      .map((s) => s.id)
      .sort()
      .join(",")}`,
    `agents:${(stack.agents || []).sort().join(",")}`,
  ];
  return hashString(parts.join("\n"));
}

/**
 * Determine version based on content hash comparison
 */
async function determineStackVersion(
  stack: StackConfig,
  pluginDir: string,
): Promise<{ version: string; contentHash: string }> {
  // Calculate current content hash
  const newHash = hashStackConfig(stack);

  // Read existing manifest
  const existing = await readExistingManifest(pluginDir);

  if (!existing) {
    // New plugin - use default version
    return {
      version: DEFAULT_VERSION,
      contentHash: newHash,
    };
  }

  if (existing.contentHash !== newHash) {
    // Content changed - bump major version (1.0.0 -> 2.0.0)
    return {
      version: bumpMajorVersion(existing.version),
      contentHash: newHash,
    };
  }

  // No change - keep existing version
  return {
    version: existing.version,
    contentHash: newHash,
  };
}

/**
 * Options for compiling a stack into a plugin
 */
export interface StackPluginOptions {
  /** Stack ID (directory name in src/stacks/) */
  stackId: string;
  /** Base output directory (e.g., dist/stacks) */
  outputDir: string;
  /** Project root directory */
  projectRoot: string;
}

/**
 * Result of compiling a stack into a plugin
 */
export interface CompiledStackPlugin {
  /** Path to the compiled plugin directory */
  pluginPath: string;
  /** Generated plugin manifest */
  manifest: PluginManifest;
  /** Stack name from config */
  stackName: string;
  /** List of compiled agent names */
  agents: string[];
  /** List of skill plugin names referenced by agents */
  skillPlugins: string[];
  /** Whether the stack has hooks configured */
  hasHooks: boolean;
}

// Skill IDs are now used directly from frontmatter names (e.g., "frontend/react (@vince)")
// This preserves category prefixes for disambiguation and author attribution

/**
 * Compile a single agent for stack plugin output
 * Returns the compiled markdown content
 */
export async function compileAgentForPlugin(
  name: string,
  agent: AgentConfig,
  projectRoot: string,
  engine: Liquid,
): Promise<string> {
  verbose(`Compiling agent: ${name}`);

  // Use stored path if available, otherwise fall back to name
  const agentDir = path.join(projectRoot, DIRS.agents, agent.path || name);

  // Read agent-specific files
  const intro = await readFile(path.join(agentDir, "intro.md"));
  const workflow = await readFile(path.join(agentDir, "workflow.md"));
  const examples = await readFileOptional(
    path.join(agentDir, "examples.md"),
    "## Examples\n\n_No examples defined._",
  );
  const criticalRequirementsTop = await readFileOptional(
    path.join(agentDir, "critical-requirements.md"),
    "",
  );
  const criticalReminders = await readFileOptional(
    path.join(agentDir, "critical-reminders.md"),
    "",
  );

  // Extract category from agent path
  const agentPath = agent.path || name;
  const category = agentPath.split("/")[0];
  const categoryDir = path.join(projectRoot, DIRS.agents, category);

  // Read output format with cascading resolution
  let outputFormat = await readFileOptional(
    path.join(agentDir, "output-format.md"),
    "",
  );
  if (!outputFormat) {
    outputFormat = await readFileOptional(
      path.join(categoryDir, "output-format.md"),
      "",
    );
  }

  // Partition skills into preloaded vs dynamic
  const preloadedSkills = agent.skills.filter((s) => s.preloaded);
  const dynamicSkills = agent.skills.filter((s) => !s.preloaded);

  // IDs for frontmatter - use canonical frontmatter names directly
  // This preserves category prefixes (frontend/, backend/) and author attribution (@vince)
  const preloadedSkillIds = preloadedSkills.map((s) => s.id);

  verbose(
    `Skills for ${name}: ${preloadedSkills.length} preloaded, ${dynamicSkills.length} dynamic`,
  );

  // Prepare template data
  const data: CompiledAgentData = {
    agent,
    intro,
    workflow,
    examples,
    criticalRequirementsTop,
    criticalReminders,
    outputFormat,
    skills: agent.skills,
    preloadedSkills,
    dynamicSkills,
    preloadedSkillIds,
  };

  // Render with LiquidJS
  return engine.renderFile("agent", data);
}

/**
 * Generate README.md content for a stack plugin
 */
function generateStackReadme(
  stackId: string,
  stack: StackConfig,
  agents: string[],
  skillPlugins: string[],
): string {
  const lines: string[] = [];

  lines.push(`# ${stack.name}`);
  lines.push("");
  lines.push(stack.description || "A Claude Code stack plugin.");
  lines.push("");

  if (stack.tags && stack.tags.length > 0) {
    lines.push("## Tags");
    lines.push("");
    lines.push(stack.tags.map((t) => `\`${t}\``).join(" "));
    lines.push("");
  }

  lines.push("## Installation");
  lines.push("");
  lines.push("Add this plugin to your Claude Code configuration:");
  lines.push("");
  lines.push("```json");
  lines.push(`{`);
  lines.push(`  "plugins": ["${stackId}"]`);
  lines.push(`}`);
  lines.push("```");
  lines.push("");

  lines.push("## Agents");
  lines.push("");
  lines.push("This stack includes the following agents:");
  lines.push("");
  for (const agent of agents) {
    lines.push(`- \`${agent}\``);
  }
  lines.push("");

  if (skillPlugins.length > 0) {
    lines.push("## Included Skills");
    lines.push("");
    lines.push("This stack includes the following skills:");
    lines.push("");
    const uniqueSkills = [...new Set(skillPlugins)].sort();
    for (const skill of uniqueSkills) {
      lines.push(`- \`${skill}\``);
    }
    lines.push("");
  }

  if (stack.philosophy) {
    lines.push("## Philosophy");
    lines.push("");
    lines.push(stack.philosophy);
    lines.push("");
  }

  if (stack.principles && stack.principles.length > 0) {
    lines.push("## Principles");
    lines.push("");
    for (const principle of stack.principles) {
      lines.push(`- ${principle}`);
    }
    lines.push("");
  }

  lines.push("---");
  lines.push("");
  lines.push("*Generated by Claude Collective stack-plugin-compiler*");
  lines.push("");

  return lines.join("\n");
}

/**
 * Hooks output format for hooks.json
 * Matches the hooks.schema.json specification
 */
interface HooksJsonOutput {
  hooks: Record<string, AgentHookDefinition[]>;
}

/**
 * Check if a stack has hooks configured
 */
function stackHasHooks(stack: StackConfig): boolean {
  return stack.hooks !== undefined && Object.keys(stack.hooks).length > 0;
}

/**
 * Generate hooks.json content from stack hooks configuration
 */
function generateHooksJson(
  hooks: Record<string, AgentHookDefinition[]>,
): string {
  const output: HooksJsonOutput = { hooks };
  return JSON.stringify(output, null, 2);
}

/**
 * Compile a stack into a standalone plugin
 */
export async function compileStackPlugin(
  options: StackPluginOptions,
): Promise<CompiledStackPlugin> {
  const { stackId, outputDir, projectRoot } = options;

  verbose(`Compiling stack plugin: ${stackId}`);

  // 1. Load stack configuration
  const stack = await loadStack(stackId, projectRoot, "dev");

  // 2. Load all agents
  const agents = await loadAllAgents(projectRoot);

  // 3. Load skills from src/skills/ based on stack config
  const skills = await loadSkillsByIds(stack.skills || [], projectRoot);

  // 4. Convert stack to compile config
  const compileConfig: CompileConfig = stackToCompileConfig(stackId, stack);

  // 5. Resolve agents with skills
  const resolvedAgents = await resolveAgents(
    agents,
    skills,
    compileConfig,
    projectRoot,
  );

  // 6. Create plugin directory structure
  const pluginDir = path.join(outputDir, stackId);
  const agentsDir = path.join(pluginDir, "agents");

  await ensureDir(pluginDir);
  await ensureDir(agentsDir);

  // Create skills directory and copy skills from src/skills/ based on stack config
  const pluginSkillsDir = path.join(pluginDir, "skills");
  await ensureDir(pluginSkillsDir);

  // Copy each skill from resolved skills map (which includes expanded directory references)
  // Track copied skills by source path to avoid duplicates
  // (loader adds skills under both canonical ID and directory path for backward compatibility)
  const copiedSourcePaths = new Set<string>();

  for (const [, resolvedSkill] of Object.entries(skills)) {
    // Use the resolved skill's path (which is the actual filesystem path)
    const sourceSkillDir = path.join(projectRoot, resolvedSkill.path);

    // Skip if this source path was already copied (handles dual-key duplicates)
    if (copiedSourcePaths.has(resolvedSkill.path)) {
      continue;
    }

    // Use the canonical skill ID (from frontmatter) as the directory path
    // This ensures consistent output regardless of which key (canonical vs directory) we iterate over
    // Format: "frontend/react (@vince)" -> "skills/frontend/react (@vince)/"
    const destSkillDir = path.join(pluginSkillsDir, resolvedSkill.canonicalId);

    if (await directoryExists(sourceSkillDir)) {
      await copy(sourceSkillDir, destSkillDir);
      copiedSourcePaths.add(resolvedSkill.path);
      verbose(`  Copied skill: ${resolvedSkill.canonicalId}`);
    } else {
      verbose(`  Warning: Skill directory not found: ${sourceSkillDir}`);
    }
  }

  // 7. Create Liquid engine
  const engine = new Liquid({
    root: [path.join(projectRoot, DIRS.templates)],
    extname: ".liquid",
    strictVariables: false,
    strictFilters: true,
  });

  // 8. Compile all agents
  const compiledAgentNames: string[] = [];
  const allSkillPlugins: string[] = [];

  for (const [name, agent] of Object.entries(resolvedAgents)) {
    const output = await compileAgentForPlugin(
      name,
      agent,
      projectRoot,
      engine,
    );
    await writeFile(path.join(agentsDir, `${name}.md`), output);
    compiledAgentNames.push(name);

    // Collect skill references (using canonical frontmatter names)
    for (const skill of agent.skills) {
      allSkillPlugins.push(skill.id);
    }

    verbose(`  Compiled agent: ${name}`);
  }

  // 9. Copy CLAUDE.md to plugin root
  const stackDir = path.join(projectRoot, DIRS.stacks, stackId);
  const claudeMdPath = path.join(stackDir, "CLAUDE.md");
  if (await fileExists(claudeMdPath)) {
    const claudeContent = await readFile(claudeMdPath);
    await writeFile(path.join(pluginDir, "CLAUDE.md"), claudeContent);
    verbose(`  Copied CLAUDE.md`);
  }

  // 10. Generate hooks.json if hooks are defined
  const hasHooks = stackHasHooks(stack);
  if (hasHooks && stack.hooks) {
    const hooksDir = path.join(pluginDir, "hooks");
    await ensureDir(hooksDir);
    const hooksJson = generateHooksJson(stack.hooks);
    await writeFile(path.join(hooksDir, "hooks.json"), hooksJson);
    verbose(`  Generated hooks/hooks.json`);
  }

  // 11. Determine version based on content hash
  const { version, contentHash } = await determineStackVersion(
    stack,
    pluginDir,
  );

  // 12. Generate and write plugin manifest
  const uniqueSkillPlugins = [...new Set(allSkillPlugins)];
  const manifest = generateStackPluginManifest({
    stackName: stackId,
    description: stack.description,
    author: stack.author,
    version,
    keywords: stack.tags,
    hasAgents: true,
    hasHooks,
    hasSkills: true, // Always true - skills are embedded
  });

  await writePluginManifest(pluginDir, manifest);

  // Write content hash to separate file for internal tracking
  const hashFilePath = getPluginManifestPath(pluginDir).replace(
    "plugin.json",
    CONTENT_HASH_FILE,
  );
  await writeFile(hashFilePath, contentHash);

  verbose(`  Wrote plugin.json (v${version})`);

  // 13. Generate and write README.md
  const readme = generateStackReadme(
    stackId,
    stack,
    compiledAgentNames,
    uniqueSkillPlugins,
  );
  await writeFile(path.join(pluginDir, "README.md"), readme);
  verbose(`  Generated README.md`);

  return {
    pluginPath: pluginDir,
    manifest,
    stackName: stack.name,
    agents: compiledAgentNames,
    skillPlugins: uniqueSkillPlugins,
    hasHooks,
  };
}

/**
 * Print compilation summary
 */
export function printStackCompilationSummary(
  result: CompiledStackPlugin,
): void {
  console.log(`\nStack plugin compiled: ${result.stackName}`);
  console.log(`  Path: ${result.pluginPath}`);
  console.log(`  Agents: ${result.agents.length}`);
  for (const agent of result.agents) {
    console.log(`    - ${agent}`);
  }
  if (result.skillPlugins.length > 0) {
    console.log(`  Skills included: ${result.skillPlugins.length}`);
    for (const skill of result.skillPlugins) {
      console.log(`    - ${skill}`);
    }
  }
  if (result.hasHooks) {
    console.log(`  Hooks: enabled`);
  }
}
