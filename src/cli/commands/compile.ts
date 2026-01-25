import { Command } from "commander";
import * as p from "@clack/prompts";
import pc from "picocolors";
import path from "path";
import { setVerbose, verbose } from "../utils/logger";
import {
  getCollectivePluginDir,
  getPluginSkillsDir,
  getPluginAgentsDir,
  getPluginManifestPath,
} from "../lib/plugin-finder";
import { fetchAgentDefinitions } from "../lib/agent-fetcher";
import { resolveSource } from "../lib/config";
import { directoryExists, glob, readFile, fileExists } from "../utils/fs";
import { recompileAgents } from "../lib/agent-recompiler";
import type { Skill, AgentSourcePaths, PluginManifest } from "../types";

/**
 * Load skills from a plugin's local skills directory
 * Recursively finds all SKILL.md files and parses them
 */
async function loadLocalSkills(
  skillsDir: string,
): Promise<Record<string, Skill>> {
  const skills: Record<string, Skill> = {};

  if (!(await directoryExists(skillsDir))) {
    return skills;
  }

  // Recursively find all SKILL.md files
  const skillFiles = await glob("**/SKILL.md", skillsDir);

  for (const skillFile of skillFiles) {
    const skillPath = path.join(skillsDir, skillFile);
    const skillDir = path.dirname(skillPath);
    const skillId = path.relative(skillsDir, skillDir);

    try {
      const content = await readFile(skillPath);

      // Parse frontmatter if present
      let metadata: Record<string, unknown> = {};
      let skillContent = content;

      if (content.startsWith("---")) {
        const endIndex = content.indexOf("---", 3);
        if (endIndex > 0) {
          const yamlContent = content.slice(3, endIndex).trim();
          skillContent = content.slice(endIndex + 3).trim();

          // Simple YAML parsing for common fields
          const lines = yamlContent.split("\n");
          for (const line of lines) {
            const colonIndex = line.indexOf(":");
            if (colonIndex > 0) {
              const key = line.slice(0, colonIndex).trim();
              const value = line.slice(colonIndex + 1).trim();
              // Remove quotes if present
              metadata[key] = value.replace(/^["']|["']$/g, "");
            }
          }
        }
      }

      const skill: Skill = {
        id: skillId,
        path: skillDir,
        name: (metadata.name as string) || path.basename(skillDir),
        description: (metadata.description as string) || "",
        usage: `When working with ${(metadata.name as string) || path.basename(skillDir)}`,
        preloaded: false,
      };

      skills[skillId] = skill;
      verbose(`  Loaded skill: ${skillId}`);
    } catch (error) {
      verbose(`  Failed to load skill: ${skillFile} - ${error}`);
    }
  }

  return skills;
}

export const compileCommand = new Command("compile")
  .description(
    "Compile agents using local skills and fetched agent definitions",
  )
  .option("-v, --verbose", "Enable verbose logging", false)
  .option("--source <url>", "Marketplace source for agent definitions")
  .option("--refresh", "Force refresh agent definitions from source", false)
  .configureOutput({
    writeErr: (str) => console.error(pc.red(str)),
  })
  .showHelpAfterError(true)
  .action(async (options, command) => {
    // Get global --dry-run option from parent
    const dryRun = command.optsWithGlobals().dryRun ?? false;

    const s = p.spinner();

    // Set verbose mode globally
    setVerbose(options.verbose);

    // Always run in plugin mode
    await runPluginModeCompile(s, options, dryRun);
  });

/**
 * Read plugin manifest from the collective plugin directory
 * Returns null if manifest doesn't exist or is invalid
 */
async function readPluginManifest(
  pluginDir: string,
): Promise<PluginManifest | null> {
  const manifestPath = getPluginManifestPath(pluginDir);

  if (!(await fileExists(manifestPath))) {
    return null;
  }

  try {
    const content = await readFile(manifestPath);
    return JSON.parse(content) as PluginManifest;
  } catch {
    return null;
  }
}

/**
 * Run compilation in plugin mode
 * Uses local skills but fetches agent definitions from marketplace
 */
async function runPluginModeCompile(
  s: ReturnType<typeof p.spinner>,
  options: { source?: string; refresh?: boolean; verbose?: boolean },
  dryRun: boolean,
): Promise<void> {
  console.log(`\n${pc.cyan("Plugin Mode Compile")}\n`);

  // 1. Get the collective plugin directory (always ~/.claude/plugins/claude-collective/)
  const pluginDir = getCollectivePluginDir();
  s.start("Finding plugin...");

  // Check if plugin exists
  if (!(await directoryExists(pluginDir))) {
    s.stop("No plugin found");
    p.log.error("No plugin found.");
    p.log.info(
      `Run ${pc.cyan("cc init --name <name>")} first to create a plugin.`,
    );
    process.exit(1);
  }

  // Read manifest to get plugin name
  const manifest = await readPluginManifest(pluginDir);
  const pluginName = manifest?.name ?? "claude-collective";

  s.stop(`Found plugin: ${pluginName}`);
  verbose(`  Path: ${pluginDir}`);

  // 2. Read local skills from the plugin's skills/ directory (do NOT fetch)
  const skillsDir = getPluginSkillsDir(pluginDir);
  s.start("Loading local skills...");
  const skills = await loadLocalSkills(skillsDir);
  const skillCount = Object.keys(skills).length;

  if (skillCount === 0) {
    s.stop("No skills found");
    p.log.warn("No skills found in plugin. Add skills with 'cc add <skill>'.");
    process.exit(1);
  }

  s.stop(`Loaded ${skillCount} local skills`);

  // 3. Resolve source and fetch agent definitions from marketplace
  s.start("Resolving marketplace source...");
  let sourceConfig;
  try {
    sourceConfig = await resolveSource(options.source);
    s.stop(`Source: ${sourceConfig.sourceOrigin}`);
  } catch (error) {
    s.stop("Failed to resolve source");
    p.log.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  s.start("Fetching agent definitions...");
  let agentDefs: AgentSourcePaths;
  try {
    agentDefs = await fetchAgentDefinitions(sourceConfig.source, {
      forceRefresh: options.refresh,
    });
    s.stop("Agent definitions fetched");
    verbose(`  Agents: ${agentDefs.agentsDir}`);
    verbose(`  Templates: ${agentDefs.templatesDir}`);
  } catch (error) {
    s.stop("Failed to fetch agent definitions");
    p.log.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  if (dryRun) {
    console.log(pc.yellow(`\n[dry-run] Would compile ${skillCount} skills`));
    console.log(
      pc.yellow(
        `[dry-run] Would use agent definitions from: ${agentDefs.sourcePath}`,
      ),
    );
    console.log(
      pc.yellow(`[dry-run] Would output to: ${getPluginAgentsDir(pluginDir)}`),
    );
    p.outro(pc.green("[dry-run] Preview complete - no files were written"));
    return;
  }

  // 4. Compile agents using local skills + fetched definitions
  s.start("Recompiling agents...");
  try {
    const recompileResult = await recompileAgents({
      pluginDir,
      sourcePath: agentDefs.sourcePath,
    });

    if (recompileResult.failed.length > 0) {
      s.stop(
        `Recompiled ${recompileResult.compiled.length} agents (${recompileResult.failed.length} failed)`,
      );
      for (const warning of recompileResult.warnings) {
        p.log.warn(warning);
      }
    } else if (recompileResult.compiled.length > 0) {
      s.stop(`Recompiled ${recompileResult.compiled.length} agents`);
    } else {
      s.stop("No agents to recompile");
    }

    // Show compiled agents
    if (recompileResult.compiled.length > 0) {
      verbose(`  Compiled: ${recompileResult.compiled.join(", ")}`);
    }
  } catch (error) {
    s.stop("Failed to recompile agents");
    p.log.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  p.outro(pc.green("Plugin compile complete!"));
}
