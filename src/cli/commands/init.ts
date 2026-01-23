import { Command } from "commander";
import * as p from "@clack/prompts";
import pc from "picocolors";
import path from "path";
import os from "os";
import {
  COLLECTIVE_DIR,
  COLLECTIVE_STACKS_SUBDIR,
  CLAUDE_DIR,
  PLUGINS_SUBDIR,
  PLUGIN_MANIFEST_DIR,
  PLUGIN_MANIFEST_FILE,
} from "../consts";
import { ensureDir, directoryExists, writeFile } from "../utils/fs";
import {
  runWizard,
  clearTerminal,
  renderSelectionsHeader,
} from "../lib/wizard";
import {
  loadSkillsMatrixFromSource,
  type SourceLoadResult,
} from "../lib/source-loader";
import {
  createStackFromSource,
  promptStackName,
  displayStackSummary,
} from "../lib/stack-creator";
import { writeActiveStack } from "../lib/active-stack";
import { formatSourceOrigin } from "../lib/config";
import { copySkillsToStackFromSource } from "../lib/skill-copier";
import {
  createStackConfig,
  createStackConfigFromSuggested,
} from "../lib/stack-config";
import { generateStackPluginManifest } from "../lib/plugin-manifest";
import type { PluginManifest } from "../../types";

/**
 * Scope for plugin output location
 */
type PluginScope = "user" | "project" | "local";

/**
 * Default version for new plugins
 */
const DEFAULT_PLUGIN_VERSION = "1.0.0";

/**
 * Check if a project has been initialized (.claude-collective/stacks/ directory exists)
 */
async function isInitialized(projectDir: string): Promise<boolean> {
  const stacksDir = path.join(
    projectDir,
    COLLECTIVE_DIR,
    COLLECTIVE_STACKS_SUBDIR,
  );
  return directoryExists(stacksDir);
}

/**
 * Get the output path for a plugin based on scope
 */
function getPluginOutputPath(name: string, scope: PluginScope): string {
  switch (scope) {
    case "user":
      return path.join(os.homedir(), CLAUDE_DIR, PLUGINS_SUBDIR, name);
    case "project":
    case "local":
      return path.join(process.cwd(), CLAUDE_DIR, PLUGINS_SUBDIR, name);
  }
}

/**
 * Get the output path for classic collective mode
 */
function getCollectiveOutputPath(projectDir: string): string {
  return path.join(projectDir, COLLECTIVE_DIR);
}

/**
 * Display summary for plugin output
 */
function displayPluginSummary(
  pluginName: string,
  pluginDir: string,
  skillCount: number,
  scope: PluginScope,
): void {
  console.log("");
  console.log(pc.green(`Plugin "${pluginName}" created successfully!`));
  console.log("");
  console.log(pc.dim("Files created:"));
  console.log(
    `  ${pc.cyan(path.relative(process.cwd(), pluginDir) || pluginDir)}`,
  );
  console.log(
    `    ${pc.dim(`${PLUGIN_MANIFEST_DIR}/${PLUGIN_MANIFEST_FILE}`)}`,
  );
  console.log(`    ${pc.dim(`skills/ (${skillCount} skills)`)}`);
  console.log("");
  console.log(pc.dim(`Scope: ${scope}`));
  console.log("");
}

export const initCommand = new Command("init")
  .description("Initialize Claude Collective in your project")
  .option(
    "--source <url>",
    "Skills source URL (e.g., github:org/repo or local path)",
  )
  .option("--refresh", "Force refresh from remote source", false)
  .option("--name <name>", "Plugin name (for plugin output mode)")
  .option(
    "--scope <scope>",
    "Output scope: user (~/.claude/plugins), project (.claude/plugins), local (.claude/plugins, gitignored)",
    "user",
  )
  .option(
    "--plugin",
    "Output as a plugin instead of classic .claude-collective format",
    false,
  )
  .configureOutput({
    writeErr: (str) => console.error(pc.red(str)),
  })
  .showHelpAfterError(true)
  .action(async (options, command) => {
    // Get global --dry-run option from parent
    const dryRun = command.optsWithGlobals().dryRun ?? false;

    // Determine target directory (current working directory)
    const projectDir = process.cwd();

    // Validate scope option
    const validScopes: PluginScope[] = ["user", "project", "local"];
    if (!validScopes.includes(options.scope as PluginScope)) {
      p.log.error(
        `Invalid scope: "${options.scope}". Must be one of: ${validScopes.join(", ")}`,
      );
      process.exit(1);
    }

    const scope = options.scope as PluginScope;
    const isPluginMode = options.plugin || options.name || scope !== "user";

    p.intro(
      pc.cyan(
        isPluginMode
          ? "Claude Collective Plugin Setup"
          : "Claude Collective Setup",
      ),
    );

    if (dryRun) {
      p.log.info(
        pc.yellow("[dry-run] Preview mode - no files will be created"),
      );
    }

    // For classic mode, check if already initialized
    if (!isPluginMode) {
      const initialized = await isInitialized(projectDir);
      if (initialized) {
        p.log.warn("Project already initialized.");
        p.log.info(
          `Use ${pc.cyan("cc add")} to add another stack, or ${pc.cyan("cc update")} to modify existing stacks.`,
        );
        process.exit(0);
      }
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

    // Prompt for stack/plugin name
    const defaultName = isPluginMode ? "my-plugin" : "my-stack";
    const stackName = options.name || (await promptStackName([], defaultName));

    if (p.isCancel(stackName)) {
      p.cancel("Setup cancelled");
      process.exit(0);
    }

    const pluginName = stackName as string;

    if (isPluginMode) {
      // Plugin output mode
      const pluginDir = getPluginOutputPath(pluginName, scope);
      const skillsDir = path.join(pluginDir, "skills");
      const manifestDir = path.join(pluginDir, PLUGIN_MANIFEST_DIR);
      const manifestPath = path.join(manifestDir, PLUGIN_MANIFEST_FILE);

      if (dryRun) {
        p.log.info(
          pc.yellow(`[dry-run] Would create plugin directory: ${pluginDir}`),
        );
        p.log.info(
          pc.yellow(
            `[dry-run] Would copy ${result.selectedSkills.length} skills`,
          ),
        );
        p.log.info(pc.yellow(`[dry-run] Would create ${PLUGIN_MANIFEST_FILE}`));
        if (scope === "local") {
          p.log.info(
            pc.yellow(`[dry-run] Would add .claude/plugins to .gitignore`),
          );
        }
        p.outro(pc.green("[dry-run] Preview complete - no files were created"));
      } else {
        s.start(`Creating plugin "${pluginName}"...`);
        try {
          // Create plugin directory structure
          await ensureDir(pluginDir);
          await ensureDir(skillsDir);
          await ensureDir(manifestDir);

          // Copy skills to plugin
          const copiedSkills = await copySkillsToStackFromSource(
            result.selectedSkills,
            pluginDir,
            matrix,
            sourceResult,
          );

          // Generate stack config for reference
          const stackConfig = result.selectedStack
            ? createStackConfigFromSuggested(pluginName, result.selectedStack)
            : createStackConfig(
                pluginName,
                `Plugin with ${result.selectedSkills.length} skills`,
                result.selectedSkills,
              );

          // Generate plugin manifest
          const manifest: PluginManifest = generateStackPluginManifest({
            stackName: pluginName,
            description: stackConfig.description,
            version: DEFAULT_PLUGIN_VERSION,
            keywords: stackConfig.tags,
          });

          // Write plugin manifest
          await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

          // For local scope, add to .gitignore
          if (scope === "local") {
            const gitignorePath = path.join(projectDir, ".gitignore");
            const gitignoreEntry = `${CLAUDE_DIR}/${PLUGINS_SUBDIR}/`;
            try {
              const { readFile: readFileFs } = await import("../utils/fs");
              const existingContent = await readFileFs(gitignorePath).catch(
                () => "",
              );
              if (!existingContent.includes(gitignoreEntry)) {
                const newContent = existingContent.endsWith("\n")
                  ? existingContent + gitignoreEntry + "\n"
                  : existingContent + "\n" + gitignoreEntry + "\n";
                await writeFile(gitignorePath, newContent);
              }
            } catch {
              // .gitignore doesn't exist or can't be read, create new one
              await writeFile(gitignorePath, gitignoreEntry + "\n");
            }
          }

          s.stop(`Plugin created with ${copiedSkills.length} skills`);

          // Display summary
          displayPluginSummary(
            pluginName,
            pluginDir,
            copiedSkills.length,
            scope,
          );

          p.outro(pc.green(`Plugin "${pluginName}" created successfully!`));
        } catch (error) {
          s.stop("Failed to create plugin");
          p.log.error(`Error: ${error}`);
          process.exit(1);
        }
      }
    } else {
      // Classic .claude-collective output mode
      const collectiveDir = getCollectiveOutputPath(projectDir);
      if (dryRun) {
        p.log.info(
          pc.yellow(`[dry-run] Would create directory: ${collectiveDir}`),
        );
      } else {
        s.start("Creating .claude-collective directory...");
        await ensureDir(collectiveDir);
        s.stop("Created .claude-collective directory");
      }

      // Create the stack
      if (dryRun) {
        const stackDir = path.join(
          collectiveDir,
          COLLECTIVE_STACKS_SUBDIR,
          pluginName,
        );
        p.log.info(
          pc.yellow(`[dry-run] Would create stack directory: ${stackDir}`),
        );
        p.log.info(
          pc.yellow(
            `[dry-run] Would copy ${result.selectedSkills.length} skills`,
          ),
        );
        p.log.info(pc.yellow(`[dry-run] Would create config.yaml`));
        p.log.info(
          pc.yellow(`[dry-run] Would set "${pluginName}" as active stack`),
        );
        p.outro(pc.green("[dry-run] Preview complete - no files were created"));
      } else {
        s.start(`Creating stack "${pluginName}"...`);
        try {
          const createResult = await createStackFromSource(
            pluginName,
            result.selectedSkills,
            matrix,
            projectDir,
            result.selectedStack,
            sourceResult,
          );
          s.stop(`Stack created with ${createResult.skillCount} skills`);

          // Set as active stack
          await writeActiveStack(projectDir, pluginName);

          // Display summary
          displayStackSummary(createResult);

          p.outro(pc.green(`Stack "${pluginName}" created and set as active!`));
          p.log.info(`Run ${pc.cyan("cc compile")} to compile your stack.`);
        } catch (error) {
          s.stop("Failed to create stack");
          p.log.error(`Error: ${error}`);
          process.exit(1);
        }
      }
    }
  });
