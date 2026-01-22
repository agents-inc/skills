import { Command } from "commander";
import * as p from "@clack/prompts";
import pc from "picocolors";
import path from "path";
import { COLLECTIVE_DIR, COLLECTIVE_STACKS_SUBDIR } from "../consts";
import { directoryExists } from "../utils/fs";
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
import { getExistingStacks } from "../lib/active-stack";
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

export const addCommand = new Command("add")
  .description("Add a new stack to your project")
  .option(
    "--source <url>",
    "Skills source URL (e.g., github:org/repo or local path)",
  )
  .option("--refresh", "Force refresh from remote source", false)
  .configureOutput({
    writeErr: (str) => console.error(pc.red(str)),
  })
  .showHelpAfterError(true)
  .action(async (options) => {
    // Determine target directory (current working directory)
    const projectDir = process.cwd();

    p.intro(pc.cyan("Add New Stack"));

    // Check if initialized
    const initialized = await isInitialized(projectDir);
    if (!initialized) {
      p.log.error("Project not initialized.");
      p.log.info(
        `Run ${pc.cyan("cc init")} first to set up Claude Collective.`,
      );
      process.exit(1);
    }

    // Get existing stacks from filesystem
    const existingStacks = await getExistingStacks(projectDir);
    if (existingStacks.length > 0) {
      console.log(pc.dim(`Existing stacks: ${existingStacks.join(", ")}`));
      console.log("");
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
      p.cancel("Cancelled");
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

    // Prompt for stack name (after seeing selections)
    const stackName = await promptStackName(existingStacks, "new-stack");

    if (p.isCancel(stackName)) {
      p.cancel("Cancelled");
      process.exit(0);
    }

    // Create the stack
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

      // Display summary
      displayStackSummary(createResult);

      p.outro(pc.green(`Stack "${stackName}" added successfully!`));
    } catch (error) {
      s.stop("Failed to create stack");
      p.log.error(`Error: ${error}`);
      process.exit(1);
    }
  });
