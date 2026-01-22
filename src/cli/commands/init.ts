import { Command } from "commander";
import * as p from "@clack/prompts";
import pc from "picocolors";
import path from "path";
import { COLLECTIVE_DIR, COLLECTIVE_STACKS_SUBDIR } from "../consts";
import { ensureDir, directoryExists } from "../utils/fs";
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

export const initCommand = new Command("init")
  .description("Initialize Claude Collective in your project")
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

    // Check if already initialized
    const initialized = await isInitialized(projectDir);
    if (initialized) {
      p.log.warn("Project already initialized.");
      p.log.info(
        `Use ${pc.cyan("cc add")} to add another stack, or ${pc.cyan("cc update")} to modify existing stacks.`,
      );
      process.exit(0);
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
    const stackName = await promptStackName([], "my-stack");

    if (p.isCancel(stackName)) {
      p.cancel("Setup cancelled");
      process.exit(0);
    }

    // Create .claude-collective directory
    const collectiveDir = path.join(projectDir, COLLECTIVE_DIR);
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
        stackName as string,
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
        pc.yellow(`[dry-run] Would set "${stackName}" as active stack`),
      );
      p.outro(pc.green("[dry-run] Preview complete - no files were created"));
    } else {
      s.start(`Creating stack "${stackName}"...`);
      try {
        const createResult = await createStackFromSource(
          stackName as string,
          result.selectedSkills,
          matrix,
          projectDir,
          result.selectedStack,
          sourceResult,
        );
        s.stop(`Stack created with ${createResult.skillCount} skills`);

        // Set as active stack
        await writeActiveStack(projectDir, stackName as string);

        // Display summary
        displayStackSummary(createResult);

        p.outro(pc.green(`Stack "${stackName}" created and set as active!`));
        p.log.info(`Run ${pc.cyan("cc compile")} to compile your stack.`);
      } catch (error) {
        s.stop("Failed to create stack");
        p.log.error(`Error: ${error}`);
        process.exit(1);
      }
    }
  });
