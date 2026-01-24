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
} from "./plugin-manifest";
import { loadStack, loadSkillsByIds, loadAllAgents } from "./loader";
import { resolveAgents, stackToCompileConfig } from "./resolver";
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

/**
 * Extract skill plugin name from skill ID
 * "frontend/react (@vince)" -> "skill-react"
 * "backend/api-hono (@vince)" -> "skill-api-hono"
 */
function extractSkillPluginName(skillId: string): string {
  // Get the last part after the last "/"
  const lastPart = skillId.split("/").pop() || skillId;
  // Remove the (@author) suffix
  const withoutAuthor = lastPart.replace(/\s*\(@\w+\)$/, "").trim();
  return `skill-${withoutAuthor}`;
}

/**
 * Read and concatenate principle files
 */
async function readPrinciples(
  promptNames: string[],
  projectRoot: string,
): Promise<string> {
  const contents: string[] = [];
  const principlesDir = path.join(projectRoot, DIRS.principles);

  for (const name of promptNames) {
    const content = await readFile(path.join(principlesDir, `${name}.md`));
    contents.push(content);
  }

  return contents.join("\n\n---\n\n");
}

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

  // Read principles (core prompts)
  const principlesContent = await readPrinciples(
    agent.core_prompts,
    projectRoot,
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

  // Read ending principles
  const endingPrinciplesContent = await readPrinciples(
    agent.ending_prompts,
    projectRoot,
  );

  // Format prompt names for display
  const formatPromptName = (n: string) =>
    n.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

  const formattedCorePromptNames = agent.core_prompts.map(formatPromptName);
  const formattedEndingPromptNames = agent.ending_prompts.map(formatPromptName);

  // Partition skills into preloaded vs dynamic
  const preloadedSkills = agent.skills.filter((s) => s.preloaded);
  const dynamicSkills = agent.skills.filter((s) => !s.preloaded);

  // IDs for frontmatter - convert to kebab-case plugin references
  const preloadedSkillIds = preloadedSkills.map((s) =>
    extractSkillPluginName(s.id),
  );

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
    corePromptNames: formattedCorePromptNames,
    corePromptsContent: principlesContent,
    outputFormat,
    endingPromptNames: formattedEndingPromptNames,
    endingPromptsContent: endingPrinciplesContent,
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
    lines.push("## Required Skill Plugins");
    lines.push("");
    lines.push(
      "Agents in this stack reference the following skill plugins (install separately):",
    );
    lines.push("");
    const uniquePlugins = [...new Set(skillPlugins)].sort();
    for (const plugin of uniquePlugins) {
      lines.push(`- \`${plugin}\``);
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

  // Copy each skill from src/skills/ to plugin
  for (const skillRef of stack.skills || []) {
    const skillId = skillRef.id;
    const sourceSkillDir = path.join(projectRoot, DIRS.skills, skillId);
    // Flatten skill path for output: "frontend/framework/react (@vince)" -> "react"
    const skillName =
      skillId
        .split("/")
        .pop()
        ?.replace(/\s*\(@\w+\)$/, "")
        .trim() || skillId;
    const destSkillDir = path.join(pluginSkillsDir, skillName);

    if (await directoryExists(sourceSkillDir)) {
      await copy(sourceSkillDir, destSkillDir);
      verbose(`  Copied skill: ${skillId} -> ${skillName}`);
    } else {
      console.warn(`  Warning: Skill not found: ${skillId}`);
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

    // Collect skill plugin references
    for (const skill of agent.skills) {
      allSkillPlugins.push(extractSkillPluginName(skill.id));
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

  // 11. Generate and write plugin manifest
  const uniqueSkillPlugins = [...new Set(allSkillPlugins)];
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

  await writePluginManifest(pluginDir, manifest);
  verbose(`  Wrote plugin.json`);

  // 12. Generate and write README.md
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
    console.log(`  Skill plugins referenced: ${result.skillPlugins.length}`);
    for (const plugin of result.skillPlugins) {
      console.log(`    - ${plugin}`);
    }
  }
  if (result.hasHooks) {
    console.log(`  Hooks: enabled`);
  }
}
