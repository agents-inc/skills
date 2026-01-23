import path from "path";
import { Liquid } from "liquidjs";
import { glob, writeFile, ensureDir } from "../utils/fs";
import { verbose } from "../utils/logger";
import { DIRS } from "../consts";
import { loadAllAgents, loadPluginSkills } from "./loader";
import { resolveAgents } from "./resolver";
import { compileAgentForPlugin } from "./stack-plugin-compiler";
import { getPluginAgentsDir } from "./plugin-finder";
import type { CompileConfig, CompileAgentConfig } from "../../types";

/**
 * Options for recompiling agents
 */
export interface RecompileAgentsOptions {
  /** Path to the plugin directory */
  pluginDir: string;
  /** Path to the source directory (agents, principles, templates) */
  sourcePath: string;
  /** Optional: specific agents to recompile (defaults to all existing) */
  agents?: string[];
}

/**
 * Result of recompiling agents
 */
export interface RecompileAgentsResult {
  /** List of successfully recompiled agent names */
  compiled: string[];
  /** List of agents that failed to recompile */
  failed: string[];
  /** Any warnings during recompilation */
  warnings: string[];
}

/**
 * Get the list of existing compiled agents in a plugin
 * Returns agent names (without .md extension)
 */
async function getExistingAgentNames(pluginDir: string): Promise<string[]> {
  const agentsDir = getPluginAgentsDir(pluginDir);
  const files = await glob("*.md", agentsDir);
  return files.map((f) => path.basename(f, ".md"));
}

/**
 * Default core and ending prompts for agents
 */
const DEFAULT_CORE_PROMPTS = [
  "core-principles",
  "investigation-requirement",
  "write-verification",
  "anti-over-engineering",
];

const DEFAULT_ENDING_PROMPTS = ["context-management", "improvement-protocol"];

/**
 * Recompile agents in a plugin
 *
 * This is used after adding/removing skills to update agents with new skill references.
 * It reads existing compiled agents, loads the source definitions, and recompiles them
 * with the updated skill set from the plugin.
 */
export async function recompileAgents(
  options: RecompileAgentsOptions,
): Promise<RecompileAgentsResult> {
  const { pluginDir, sourcePath, agents: specifiedAgents } = options;

  const result: RecompileAgentsResult = {
    compiled: [],
    failed: [],
    warnings: [],
  };

  // 1. Determine which agents to recompile
  const agentNames =
    specifiedAgents || (await getExistingAgentNames(pluginDir));

  if (agentNames.length === 0) {
    result.warnings.push("No agents found to recompile");
    return result;
  }

  verbose(`Recompiling ${agentNames.length} agents in ${pluginDir}`);

  // 2. Load agent definitions from source
  const allAgents = await loadAllAgents(sourcePath);

  // 3. Load skills from the plugin
  const pluginSkills = await loadPluginSkills(pluginDir);

  // 4. Build compile config for the agents
  const compileAgents: Record<string, CompileAgentConfig> = {};
  for (const agentName of agentNames) {
    if (allAgents[agentName]) {
      compileAgents[agentName] = {
        core_prompts: DEFAULT_CORE_PROMPTS,
        ending_prompts: DEFAULT_ENDING_PROMPTS,
      };
    } else {
      result.warnings.push(
        `Agent "${agentName}" not found in source definitions`,
      );
    }
  }

  const compileConfig: CompileConfig = {
    name: path.basename(pluginDir),
    description: "Recompiled plugin",
    claude_md: "",
    agents: compileAgents,
  };

  // 5. Create Liquid engine
  const engine = new Liquid({
    root: [path.join(sourcePath, DIRS.templates)],
    extname: ".liquid",
    strictVariables: false,
    strictFilters: true,
  });

  // 6. Resolve and compile agents
  const resolvedAgents = await resolveAgents(
    allAgents,
    pluginSkills,
    compileConfig,
    sourcePath,
  );

  // 7. Ensure agents directory exists
  const agentsDir = getPluginAgentsDir(pluginDir);
  await ensureDir(agentsDir);

  // 8. Compile each agent
  for (const [name, agent] of Object.entries(resolvedAgents)) {
    try {
      const output = await compileAgentForPlugin(
        name,
        agent,
        sourcePath,
        engine,
      );
      await writeFile(path.join(agentsDir, `${name}.md`), output);
      result.compiled.push(name);
      verbose(`  Recompiled: ${name}`);
    } catch (error) {
      result.failed.push(name);
      result.warnings.push(
        `Failed to compile ${name}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return result;
}
