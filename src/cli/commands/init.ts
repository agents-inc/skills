import { Command } from "commander";
import * as p from "@clack/prompts";
import pc from "picocolors";
import path from "path";
import { Liquid } from "liquidjs";
import { PLUGIN_MANIFEST_DIR, PLUGIN_MANIFEST_FILE, DIRS } from "../consts";
import { ensureDir, writeFile, directoryExists } from "../utils/fs";
import {
  runWizard,
  clearTerminal,
  renderSelectionsHeader,
} from "../lib/wizard";
import {
  loadSkillsMatrixFromSource,
  type SourceLoadResult,
} from "../lib/source-loader";
import { formatSourceOrigin } from "../lib/config";
import { copySkillsToPluginFromSource } from "../lib/skill-copier";
import { checkPermissions } from "../lib/permission-checker";
import { generateStackPluginManifest } from "../lib/plugin-manifest";
import { loadAllAgents, loadPluginSkills, loadStack } from "../lib/loader";
import { resolveAgents, stackToCompileConfig } from "../lib/resolver";
import { compileAgentForPlugin } from "../lib/stack-plugin-compiler";
import { getCollectivePluginDir } from "../lib/plugin-finder";
import type {
  PluginManifest,
  CompileConfig,
  CompileAgentConfig,
} from "../../types";

/**
 * Default version for new plugins
 */
const DEFAULT_PLUGIN_VERSION = "1.0.0";

/**
 * Default agents to compile when no stack specifies agents
 * All available agents are included by default
 */
const DEFAULT_AGENTS = [
  // Developer agents
  "frontend-developer",
  "backend-developer",
  "architecture",
  // Reviewer agents
  "frontend-reviewer",
  "backend-reviewer",
  // Researcher agents
  "frontend-researcher",
  "backend-researcher",
  // Planning agents
  "pm",
  // Pattern agents
  "pattern-scout",
  "pattern-critique",
  // Meta agents
  "agent-summoner",
  "skill-summoner",
  "documentor",
  // Tester agents
  "tester",
];

/**
 * Default plugin name for Claude Collective
 */
const PLUGIN_NAME = "claude-collective";

/**
 * Display summary for plugin creation
 */
function displayPluginSummary(
  pluginDir: string,
  skillCount: number,
  agentCount: number,
): void {
  console.log("");
  console.log(pc.green("Claude Collective initialized successfully!"));
  console.log("");
  console.log(pc.dim("Plugin created:"));
  console.log(`  ${pc.cyan(pluginDir)}`);
  console.log(
    `    ${pc.dim(`${PLUGIN_MANIFEST_DIR}/${PLUGIN_MANIFEST_FILE}`)}`,
  );
  console.log(`    ${pc.dim(`skills/ (${skillCount} skills)`)}`);
  console.log(`    ${pc.dim(`agents/ (${agentCount} agents)`)}`);
  console.log("");
}

export const initCommand = new Command("init")
  .description("Initialize Claude Collective in this project")
  .option(
    "--source <url>",
    "Skills source URL (e.g., github:org/repo or local path)",
  )
  .option("--refresh", "Force refresh from remote source", false)
  .configureOutput({
    writeErr: (str) => console.error(pc.red(str)),
  })
  .showHelpAfterError(true)
  .action(async (options, command) => {
    // Get global --dry-run option from parent
    const dryRun = command.optsWithGlobals().dryRun ?? false;

    // Determine target directory (current working directory)
    const projectDir = process.cwd();

    p.intro(pc.cyan("Claude Collective Setup"));

    if (dryRun) {
      p.log.info(
        pc.yellow("[dry-run] Preview mode - no files will be created"),
      );
    }

    const s = p.spinner();

    // Plugin paths (the single claude-collective plugin)
    const pluginDir = getCollectivePluginDir();
    const pluginSkillsDir = path.join(pluginDir, "skills");
    const pluginAgentsDir = path.join(pluginDir, "agents");
    const manifestDir = path.join(pluginDir, PLUGIN_MANIFEST_DIR);
    const manifestPath = path.join(manifestDir, PLUGIN_MANIFEST_FILE);

    // Check if plugin already exists
    const pluginExists = await directoryExists(pluginDir);

    if (pluginExists) {
      // Plugin already exists - inform user
      p.log.warn(
        `Claude Collective is already initialized at ${pc.cyan(pluginDir)}`,
      );
      p.log.info(`Use ${pc.cyan("cc edit")} to modify skills.`);
      p.outro(pc.dim("No changes made."));
      return;
    }

    // Load skills matrix from source
    s.start("Loading skills matrix...");

    let sourceResult: SourceLoadResult;
    try {
      sourceResult = await loadSkillsMatrixFromSource({
        sourceFlag: options.source,
        projectDir,
        forceRefresh: options.refresh,
      });

      const sourceInfo = sourceResult.isLocal
        ? "local"
        : formatSourceOrigin(sourceResult.sourceConfig.sourceOrigin);
      s.stop(
        `Loaded ${Object.keys(sourceResult.matrix.skills).length} skills (${sourceInfo})`,
      );
    } catch (error) {
      s.stop("Failed to load skills matrix");
      p.log.error(
        error instanceof Error ? error.message : "Unknown error occurred",
      );
      process.exit(1);
    }

    const matrix = sourceResult.matrix;

    // Run the wizard
    const result = await runWizard(matrix);

    if (!result) {
      p.cancel("Setup cancelled");
      process.exit(0);
    }

    // Validate the result
    if (!result.validation.valid) {
      p.log.error("Selection has validation errors:");
      for (const error of result.validation.errors) {
        p.log.error(`  ${error.message}`);
      }
      process.exit(1);
    }

    // Show final summary - clear screen and show selections header
    clearTerminal();
    renderSelectionsHeader(result.selectedSkills, matrix);

    // Show warnings if any
    if (result.validation.warnings.length > 0) {
      console.log(pc.yellow("Warnings:"));
      for (const warning of result.validation.warnings) {
        console.log(`  ${pc.yellow("!")} ${warning.message}`);
      }
      console.log("");
    }

    if (dryRun) {
      p.log.info(pc.yellow(`[dry-run] Would create plugin at: ${pluginDir}`));
      p.log.info(
        pc.yellow(
          `[dry-run] Would copy ${result.selectedSkills.length} skills to plugin`,
        ),
      );
      p.log.info(pc.yellow(`[dry-run] Would compile agents`));
      p.outro(pc.green("[dry-run] Preview complete - no files were created"));
      return;
    }

    s.start("Creating plugin...");
    try {
      // Create plugin directory structure
      await ensureDir(pluginDir);
      await ensureDir(pluginSkillsDir);
      await ensureDir(pluginAgentsDir);
      await ensureDir(manifestDir);

      // Copy skills directly to plugin
      const copiedSkills = await copySkillsToPluginFromSource(
        result.selectedSkills,
        pluginDir,
        matrix,
        sourceResult,
      );

      s.stop(`Copied ${copiedSkills.length} skills to plugin`);

      // Compile agents
      s.start("Compiling agents...");

      const agents = await loadAllAgents(sourceResult.sourcePath);
      const loadedPluginSkills = await loadPluginSkills(pluginDir);

      // Build compile config
      let compileConfig: CompileConfig;

      if (result.selectedStack) {
        // Using a pre-configured stack template
        const loadedStackConfig = await loadStack(
          result.selectedStack.id,
          sourceResult.sourcePath,
          "dev",
        );
        compileConfig = stackToCompileConfig(
          result.selectedStack.id,
          loadedStackConfig,
        );
        compileConfig.name = PLUGIN_NAME;
      } else {
        // Custom skill selection - use all default agents
        const compileAgents: Record<string, CompileAgentConfig> = {};
        for (const agentId of DEFAULT_AGENTS) {
          if (agents[agentId]) {
            compileAgents[agentId] = {};
          }
        }
        compileConfig = {
          name: PLUGIN_NAME,
          description: `Plugin with ${result.selectedSkills.length} skills`,
          claude_md: "",
          agents: compileAgents,
        };
      }

      // Create Liquid engine
      const engine = new Liquid({
        root: [path.join(sourceResult.sourcePath, DIRS.templates)],
        extname: ".liquid",
        strictVariables: false,
        strictFilters: true,
      });

      // Resolve and compile agents
      const resolvedAgents = await resolveAgents(
        agents,
        loadedPluginSkills,
        compileConfig,
        sourceResult.sourcePath,
      );

      const compiledAgentNames: string[] = [];
      for (const [name, agent] of Object.entries(resolvedAgents)) {
        const output = await compileAgentForPlugin(
          name,
          agent,
          sourceResult.sourcePath,
          engine,
        );
        await writeFile(path.join(pluginAgentsDir, `${name}.md`), output);
        compiledAgentNames.push(name);
      }

      s.stop(`Compiled ${compiledAgentNames.length} agents`);

      // Generate plugin manifest
      const manifest: PluginManifest = generateStackPluginManifest({
        stackName: PLUGIN_NAME,
        description: "Claude Collective plugin with AI development skills",
        version: DEFAULT_PLUGIN_VERSION,
        keywords: [],
        hasSkills: true,
        hasAgents: compiledAgentNames.length > 0,
      });

      await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

      // Display summary
      displayPluginSummary(
        pluginDir,
        copiedSkills.length,
        compiledAgentNames.length,
      );

      p.outro(pc.green("Claude Collective is ready to use!"));

      // Check for permission configuration
      await checkPermissions(projectDir);
    } catch (error) {
      s.stop("Failed to create plugin");
      p.log.error(`Error: ${error}`);
      process.exit(1);
    }
  });
