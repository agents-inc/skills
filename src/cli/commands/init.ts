import { Command } from "commander";
import * as p from "@clack/prompts";
import pc from "picocolors";
import path from "path";
import { Liquid } from "liquidjs";
import {
  PLUGIN_MANIFEST_DIR,
  PLUGIN_MANIFEST_FILE,
  DIRS,
  getUserStacksDir,
} from "../consts";
import {
  ensureDir,
  writeFile,
  directoryExists,
  copy,
  remove,
} from "../utils/fs";
import {
  runWizard,
  clearTerminal,
  renderSelectionsHeader,
} from "../lib/wizard";
import {
  loadSkillsMatrixFromSource,
  type SourceLoadResult,
} from "../lib/source-loader";
import { promptStackName } from "../lib/stack-creator";
import { formatSourceOrigin, setActiveStack } from "../lib/config";
import { copySkillsToStackFromSource } from "../lib/skill-copier";
import { checkPermissions } from "../lib/permission-checker";
import {
  createStackConfig,
  createStackConfigFromSuggested,
} from "../lib/stack-config";
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
 * Get the output path for a stack (always user scope)
 * Returns: ~/.claude-collective/stacks/{name}/
 */
function getStackOutputPath(name: string): string {
  return path.join(getUserStacksDir(), name);
}

/**
 * Display summary for stack creation
 */
function displayStackSummary(
  stackName: string,
  stackDir: string,
  pluginDir: string,
  skillCount: number,
  agentCount: number,
  isFirstStack: boolean,
): void {
  console.log("");
  console.log(pc.green(`Stack "${stackName}" created successfully!`));
  console.log("");
  console.log(pc.dim("Stack created:"));
  console.log(`  ${pc.cyan(stackDir)}`);
  console.log(`    ${pc.dim(`skills/ (${skillCount} skills)`)}`);
  console.log("");
  if (isFirstStack) {
    console.log(pc.dim("Plugin activated:"));
    console.log(`  ${pc.cyan(pluginDir)}`);
    console.log(
      `    ${pc.dim(`${PLUGIN_MANIFEST_DIR}/${PLUGIN_MANIFEST_FILE}`)}`,
    );
    console.log(`    ${pc.dim(`skills/ (${skillCount} skills)`)}`);
    console.log(`    ${pc.dim(`agents/ (${agentCount} agents)`)}`);
    console.log("");
  }
}

export const initCommand = new Command("init")
  .description("Create a new Claude Collective stack")
  .option(
    "--source <url>",
    "Skills source URL (e.g., github:org/repo or local path)",
  )
  .option("--refresh", "Force refresh from remote source", false)
  .option("--name <name>", "Stack name")
  .configureOutput({
    writeErr: (str) => console.error(pc.red(str)),
  })
  .showHelpAfterError(true)
  .action(async (options, command) => {
    // Get global --dry-run option from parent
    const dryRun = command.optsWithGlobals().dryRun ?? false;

    // Determine target directory (current working directory)
    const projectDir = process.cwd();

    p.intro(pc.cyan("Claude Collective Stack Setup"));

    if (dryRun) {
      p.log.info(
        pc.yellow("[dry-run] Preview mode - no files will be created"),
      );
    }

    const s = p.spinner();

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

    // Prompt for stack name
    const stackName =
      options.name || ((await promptStackName([], "my-stack")) as string);

    if (p.isCancel(stackName)) {
      p.cancel("Setup cancelled");
      process.exit(0);
    }

    // Stack output paths (source of truth)
    const stackDir = getStackOutputPath(stackName);
    const stackSkillsDir = path.join(stackDir, "skills");

    // Plugin paths (the single claude-collective plugin)
    const pluginDir = getCollectivePluginDir();
    const pluginSkillsDir = path.join(pluginDir, "skills");
    const pluginAgentsDir = path.join(pluginDir, "agents");
    const manifestDir = path.join(pluginDir, PLUGIN_MANIFEST_DIR);
    const manifestPath = path.join(manifestDir, PLUGIN_MANIFEST_FILE);

    // Check if plugin already exists (determines if this is first stack or subsequent)
    const pluginExists = await directoryExists(pluginDir);

    if (dryRun) {
      p.log.info(
        pc.yellow(`[dry-run] Would create stack directory: ${stackDir}`),
      );
      p.log.info(
        pc.yellow(
          `[dry-run] Would copy ${result.selectedSkills.length} skills to stack`,
        ),
      );
      if (!pluginExists) {
        p.log.info(pc.yellow(`[dry-run] Would create plugin at: ${pluginDir}`));
        p.log.info(
          pc.yellow(`[dry-run] Would compile agents and activate stack`),
        );
      } else {
        p.log.info(
          pc.yellow(`[dry-run] Plugin already exists, would prompt to switch`),
        );
      }
      p.outro(pc.green("[dry-run] Preview complete - no files were created"));
    } else {
      s.start(`Creating stack "${stackName}"...`);
      try {
        // Step 1: Create stack directory and copy skills to stack
        await ensureDir(stackDir);
        await ensureDir(stackSkillsDir);

        const copiedSkills = await copySkillsToStackFromSource(
          result.selectedSkills,
          stackDir,
          matrix,
          sourceResult,
        );

        s.stop(`Stack created with ${copiedSkills.length} skills`);

        // Step 2: Handle plugin creation/activation
        let compiledAgentNames: string[] = [];

        if (!pluginExists) {
          // First stack: create the plugin, compile agents, and activate
          s.start("Creating plugin and activating stack...");

          await ensureDir(pluginDir);
          await ensureDir(pluginSkillsDir);
          await ensureDir(pluginAgentsDir);
          await ensureDir(manifestDir);

          // Copy skills from stack to plugin (switch logic)
          await copy(stackSkillsDir, pluginSkillsDir);

          // Compile agents
          const agents = await loadAllAgents(sourceResult.sourcePath);
          const loadedPluginSkills = await loadPluginSkills(pluginDir);

          // Build compile config
          let compileConfig: CompileConfig;

          if (result.selectedStack) {
            const loadedStackConfig = await loadStack(
              result.selectedStack.id,
              sourceResult.sourcePath,
              "dev",
            );
            compileConfig = stackToCompileConfig(
              result.selectedStack.id,
              loadedStackConfig,
            );
            compileConfig.name = stackName;
          } else {
            const compileAgents: Record<string, CompileAgentConfig> = {};
            for (const agentId of DEFAULT_AGENTS) {
              if (agents[agentId]) {
                compileAgents[agentId] = {};
              }
            }
            compileConfig = {
              name: stackName,
              description: `Stack with ${result.selectedSkills.length} skills`,
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

          // Generate stack config for manifest
          const stackConfig = result.selectedStack
            ? createStackConfigFromSuggested(stackName, result.selectedStack)
            : createStackConfig(
                stackName,
                `Stack with ${result.selectedSkills.length} skills`,
                result.selectedSkills,
              );

          // Generate plugin manifest
          const manifest: PluginManifest = generateStackPluginManifest({
            stackName: "claude-collective",
            description:
              "Claude Collective plugin with switchable skill stacks",
            version: DEFAULT_PLUGIN_VERSION,
            keywords: stackConfig.tags,
            hasSkills: true,
            hasAgents: compiledAgentNames.length > 0,
          });

          await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

          // Set this stack as active
          await setActiveStack(stackName);

          s.stop(
            `Plugin created with ${copiedSkills.length} skills and ${compiledAgentNames.length} agents`,
          );

          // Display summary
          displayStackSummary(
            stackName,
            stackDir,
            pluginDir,
            copiedSkills.length,
            compiledAgentNames.length,
            true,
          );

          p.outro(pc.green(`Stack "${stackName}" created and activated!`));

          // Check for permission configuration
          await checkPermissions(projectDir);
        } else {
          // Plugin already exists: just create stack, prompt to switch
          console.log("");
          console.log(pc.dim("Stack created:"));
          console.log(`  ${pc.cyan(stackDir)}`);
          console.log(
            `    ${pc.dim(`skills/ (${copiedSkills.length} skills)`)}`,
          );
          console.log("");

          // Ask if user wants to switch to the new stack
          const shouldSwitch = await p.confirm({
            message: `Switch to "${stackName}" now?`,
            initialValue: true,
          });

          if (p.isCancel(shouldSwitch)) {
            p.cancel("Setup cancelled");
            process.exit(0);
          }

          if (shouldSwitch) {
            s.start("Switching to new stack...");

            // Remove existing skills from plugin
            if (await directoryExists(pluginSkillsDir)) {
              await remove(pluginSkillsDir);
            }

            // Copy skills from new stack to plugin
            await copy(stackSkillsDir, pluginSkillsDir);

            // Update active stack in config
            await setActiveStack(stackName);

            s.stop("Stack activated");

            p.outro(pc.green(`Switched to "${stackName}"!`));

            // Check for permission configuration
            await checkPermissions(projectDir);
          } else {
            p.log.info(
              `Run ${pc.cyan(`cc switch ${stackName}`)} later to activate this stack.`,
            );
            p.outro(pc.green(`Stack "${stackName}" created successfully!`));

            // Check for permission configuration
            await checkPermissions(projectDir);
          }
        }
      } catch (error) {
        s.stop("Failed to create stack");
        p.log.error(`Error: ${error}`);
        process.exit(1);
      }
    }
  });
