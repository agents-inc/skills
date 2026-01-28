import path from "path";
import { Liquid } from "liquidjs";
import { glob, writeFile, ensureDir, readFile, fileExists } from "../utils/fs";
import { verbose } from "../utils/logger";
import { DIRS } from "../consts";
import { loadAllAgents, loadPluginSkills } from "./loader";
import { resolveAgents, resolveStackSkills } from "./resolver";
import { compileAgentForPlugin } from "./stack-plugin-compiler";
import { getPluginAgentsDir } from "./plugin-finder";
import { parse as parseYaml } from "yaml";
import type {
  CompileConfig,
  CompileAgentConfig,
  StackConfig,
  SkillReference,
} from "../../types";

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
 * Load config.yaml from plugin directory
 * Returns null if not found or invalid
 */
async function loadPluginConfig(
  pluginDir: string,
): Promise<StackConfig | null> {
  const configPath = path.join(pluginDir, "config.yaml");
  if (!(await fileExists(configPath))) {
    verbose(`No config.yaml found at ${configPath}`);
    return null;
  }

  try {
    const content = await readFile(configPath);
    const config = parseYaml(content) as StackConfig;
    verbose(`Loaded config.yaml from ${configPath}`);
    return config;
  } catch (error) {
    verbose(`Failed to parse config.yaml: ${error}`);
    return null;
  }
}

/**
 * Recompile agents in a plugin
 *
 * This is used after adding/removing skills to update agents with new skill references.
 * It reads existing compiled agents, loads the source definitions, and recompiles them
 * with the updated skill set from the plugin.
 *
 * If a config.yaml exists in the plugin directory, it will be used to determine
 * agent-skill assignments. Otherwise, all skills are given to all agents.
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

  // 1. Try to load config.yaml from plugin directory
  const pluginConfig = await loadPluginConfig(pluginDir);

  // 2. Determine which agents to recompile
  let agentNames: string[];
  if (specifiedAgents) {
    agentNames = specifiedAgents;
  } else if (pluginConfig?.agents) {
    // Use agents from config.yaml
    agentNames = pluginConfig.agents;
    verbose(`Using agents from config.yaml: ${agentNames.join(", ")}`);
  } else {
    // Fall back to existing compiled agents
    agentNames = await getExistingAgentNames(pluginDir);
  }

  if (agentNames.length === 0) {
    result.warnings.push("No agents found to recompile");
    return result;
  }

  verbose(`Recompiling ${agentNames.length} agents in ${pluginDir}`);

  // 3. Load agent definitions from source
  const allAgents = await loadAllAgents(sourcePath);

  // 4. Load skills from the plugin
  const pluginSkills = await loadPluginSkills(pluginDir);

  // 5. Build compile config for the agents
  const compileAgents: Record<string, CompileAgentConfig> = {};
  for (const agentName of agentNames) {
    if (allAgents[agentName]) {
      // If we have a config with agent_skills, resolve them
      if (pluginConfig?.agent_skills?.[agentName]) {
        const skillRefs = resolveStackSkills(
          pluginConfig,
          agentName,
          pluginSkills,
        );
        compileAgents[agentName] = { skills: skillRefs };
        verbose(`  Agent ${agentName}: ${skillRefs.length} skills from config`);
      } else if (pluginConfig?.skills) {
        // Fall back to all skills in the config
        const skillRefs: SkillReference[] = pluginConfig.skills.map((s) => ({
          id: s.id,
          usage: `when working with ${s.id.split(" ")[0]}`,
          preloaded: s.preloaded ?? false,
        }));
        compileAgents[agentName] = { skills: skillRefs };
        verbose(`  Agent ${agentName}: ${skillRefs.length} skills (all)`);
      } else {
        // No config - agent gets all plugin skills
        compileAgents[agentName] = {};
      }
    } else {
      result.warnings.push(
        `Agent "${agentName}" not found in source definitions`,
      );
    }
  }

  const compileConfig: CompileConfig = {
    name: pluginConfig?.name || path.basename(pluginDir),
    description: pluginConfig?.description || "Recompiled plugin",
    claude_md: "",
    agents: compileAgents,
  };

  // 6. Create Liquid engine
  const engine = new Liquid({
    root: [path.join(sourcePath, DIRS.templates)],
    extname: ".liquid",
    strictVariables: false,
    strictFilters: true,
  });

  // 7. Resolve and compile agents
  const resolvedAgents = await resolveAgents(
    allAgents,
    pluginSkills,
    compileConfig,
    sourcePath,
  );

  // 8. Ensure agents directory exists
  const agentsDir = getPluginAgentsDir(pluginDir);
  await ensureDir(agentsDir);

  // 9. Compile each agent
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
