import { Command } from "commander";
import * as p from "@clack/prompts";
import pc from "picocolors";
import path from "path";
import { setVerbose, verbose } from "../utils/logger";
import { OUTPUT_DIR, DIRS } from "../consts";
import {
  loadAllAgents,
  loadStackSkills,
  loadStack,
  detectCompileMode,
} from "../lib/loader";
import { resolveAgents, stackToCompileConfig } from "../lib/resolver";
import { validate, printValidationResult } from "../lib/validator";
import {
  compileAllAgents,
  compileAllSkills,
  copyClaude,
  compileAllCommands,
  createLiquidEngine,
  cleanOutputDir,
} from "../lib/compiler";
import { versionAllSkills, printVersionResults } from "../lib/versioning";
import {
  findPluginDirectory,
  getPluginSkillsDir,
  getPluginAgentsDir,
} from "../lib/plugin-finder";
import { fetchAgentDefinitions } from "../lib/agent-fetcher";
import { resolveSource } from "../lib/config";
import { directoryExists, glob, readFile } from "../utils/fs";
import type {
  AgentConfig,
  CompileConfig,
  CompileContext,
  Skill,
  AgentSourcePaths,
} from "../types";

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
  .description("Compile agents from a stack or plugin")
  .option(
    "-s, --stack <name>",
    "Stack to compile (uses active stack if not specified)",
  )
  .option("-v, --verbose", "Enable verbose logging", false)
  .option(
    "--version-skills",
    "Auto-increment version and update content_hash for changed source skills",
    false,
  )
  .option(
    "--plugin",
    "Compile from plugin mode (uses local skills, fetches agent definitions)",
    false,
  )
  .option(
    "--source <url>",
    "Marketplace source for agent definitions (plugin mode only)",
  )
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

    // Determine project root (where we're running from)
    const projectRoot = process.cwd();

    // Check if plugin mode is requested
    if (options.plugin) {
      await runPluginModeCompile(s, options, dryRun);
      return;
    }

    // Detect compile mode (existing behavior)
    const mode = await detectCompileMode(projectRoot);

    // Resolve stack ID - always required now (user mode with active stack removed)
    const stackId = options.stack;

    if (!stackId) {
      p.log.error("Stack name required. Use -s flag.");
      p.log.info(`Example: ${pc.cyan("cc compile -s fullstack-react")}`);
      p.log.info(
        `Or use ${pc.cyan("cc compile --plugin")} to compile from a plugin.`,
      );
      process.exit(1);
    }

    const outputDir = path.join(projectRoot, OUTPUT_DIR);

    console.log(`\nCompiling stack: ${stackId} (mode: ${mode})\n`);

    if (dryRun) {
      console.log(
        pc.yellow("[dry-run] Preview mode - no files will be written\n"),
      );
    }

    try {
      // Version source skills if requested
      if (options.versionSkills) {
        s.start("Versioning source skills...");
        const skillsDir = path.join(projectRoot, DIRS.skills);
        const versionResults = await versionAllSkills(skillsDir);
        const changedCount = versionResults.filter((r) => r.changed).length;
        s.stop(
          `Versioned skills: ${changedCount} updated, ${versionResults.length - changedCount} unchanged`,
        );

        if (changedCount > 0 && options.verbose) {
          printVersionResults(versionResults);
        }
      }

      // Load agents first (shared across all stacks)
      s.start("Loading agents...");
      const agents = await loadAllAgents(projectRoot);
      s.stop(`Loaded ${Object.keys(agents).length} agents`);

      // Load stack configuration
      s.start("Loading stack configuration...");
      const stack = await loadStack(stackId, projectRoot, mode);
      const compileConfig: CompileConfig = stackToCompileConfig(stackId, stack);
      // StackConfig always has agents[] and skills[] properties
      const agentCount = stack.agents.length;
      const skillCount = stack.skills.length;
      s.stop(`Stack loaded: ${agentCount} agents, ${skillCount} skills`);

      // Load skills from stack
      s.start("Loading skills...");
      const skills = await loadStackSkills(stackId, projectRoot, mode);
      s.stop(
        `Loaded ${Object.keys(skills).length} skills from stack: ${stackId}`,
      );

      // Resolve agents
      s.start("Resolving agents...");
      let resolvedAgents: Record<string, AgentConfig>;
      try {
        resolvedAgents = await resolveAgents(
          agents,
          skills,
          compileConfig,
          projectRoot,
        );
        s.stop(`Resolved ${Object.keys(resolvedAgents).length} agents`);
      } catch (error) {
        s.stop("Failed to resolve agents");
        p.log.error(String(error));
        process.exit(1);
      }

      // Validate
      s.start("Validating configuration...");
      const ctx: CompileContext = {
        stackId,
        verbose: options.verbose,
        projectRoot,
        outputDir,
        mode,
      };

      const validation = await validate(resolvedAgents, stackId, projectRoot);
      s.stop("Validation complete");

      printValidationResult(validation);

      if (!validation.valid) {
        process.exit(1);
      }

      if (dryRun) {
        // Dry-run: show what would happen without executing
        console.log(
          pc.yellow(`[dry-run] Would clean output directory: ${outputDir}`),
        );
        console.log(
          pc.yellow(
            `[dry-run] Would compile ${Object.keys(resolvedAgents).length} agents`,
          ),
        );

        // Count total skills across all agents
        const totalSkills = Object.values(resolvedAgents).reduce(
          (sum, agent) => sum + agent.skills.length,
          0,
        );
        console.log(
          pc.yellow(`[dry-run] Would compile ${totalSkills} skill references`),
        );
        console.log(pc.yellow("[dry-run] Would compile commands"));
        console.log(pc.yellow("[dry-run] Would copy CLAUDE.md"));

        p.outro(pc.green("[dry-run] Preview complete - no files were written"));
      } else {
        // Clean output directory
        s.start("Cleaning output directory...");
        await cleanOutputDir(outputDir);
        s.stop("Output directory cleaned");

        // Create Liquid engine
        const engine = createLiquidEngine(projectRoot);

        // Compile agents
        console.log("\nCompiling agents...");
        await compileAllAgents(resolvedAgents, compileConfig, ctx, engine);

        // Compile skills
        console.log("\nCompiling skills...");
        await compileAllSkills(resolvedAgents, ctx);

        // Compile commands
        console.log("\nCompiling commands...");
        await compileAllCommands(ctx);

        // Copy CLAUDE.md
        console.log("\nCopying CLAUDE.md...");
        await copyClaude(ctx);

        p.outro(pc.green("Compilation complete!"));
      }
    } catch (error) {
      s.stop("Compilation failed");
      p.log.error(String(error));
      process.exit(1);
    }
  });

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

  // 1. Find existing plugin
  s.start("Finding plugin...");
  const pluginLocation = await findPluginDirectory();

  if (!pluginLocation) {
    s.stop("No plugin found");
    p.log.error("No plugin found.");
    p.log.info(
      `Run ${pc.cyan("cc init --name <name>")} first to create a plugin.`,
    );
    process.exit(1);
  }

  s.stop(
    `Found plugin: ${pluginLocation.manifest.name} (${pluginLocation.scope})`,
  );
  verbose(`  Path: ${pluginLocation.path}`);

  // 2. Read local skills (do NOT fetch)
  const skillsDir = getPluginSkillsDir(pluginLocation.path);
  s.start("Loading local skills...");
  const skills = await loadLocalSkills(skillsDir);
  const skillCount = Object.keys(skills).length;

  if (skillCount === 0) {
    s.stop("No skills found");
    p.log.warn("No skills found in plugin. Add skills with 'cc add <skill>'.");
    process.exit(1);
  }

  s.stop(`Loaded ${skillCount} local skills`);

  // 3. Resolve source and fetch agent definitions
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
    verbose(`  Principles: ${agentDefs.principlesDir}`);
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
      pc.yellow(
        `[dry-run] Would output to: ${getPluginAgentsDir(pluginLocation.path)}`,
      ),
    );
    p.outro(pc.green("[dry-run] Preview complete - no files were written"));
    return;
  }

  // 4. Compile agents using local skills + fetched definitions
  // Note: Full agent compilation is complex and requires the existing compiler infrastructure
  // For now, we indicate that compilation would happen
  p.log.info(
    pc.dim("Agent compilation from plugin skills not yet fully implemented."),
  );
  p.log.info(
    pc.dim(
      "Current implementation requires running 'cc compile -s <stack>' in dev mode.",
    ),
  );

  p.outro(pc.green("Plugin compile check complete!"));
}
