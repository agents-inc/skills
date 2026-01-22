import { Command } from "commander";
import * as p from "@clack/prompts";
import pc from "picocolors";
import path from "path";
import { PROJECT_ROOT, DEFAULT_MATRIX_PATH } from "../consts";
import { ensureDir, directoryExists } from "../utils/fs";
import {
  runWizard,
  clearTerminal,
  renderSelectionsHeader,
} from "../lib/wizard";
import { loadAndMergeSkillsMatrix } from "../lib/matrix-loader";
import {
  createStack,
  promptStackName,
  displayStackSummary,
} from "../lib/stack-creator";

/**
 * Check if a project has been initialized (.claude/stacks/ directory exists)
 */
async function isInitialized(projectDir: string): Promise<boolean> {
  const stacksDir = path.join(projectDir, ".claude", "stacks");
  return directoryExists(stacksDir);
}

export const initCommand = new Command("init")
  .description("Initialize Claude Collective in your project")
  .option(
    "--matrix <path>",
    "Path to skills-matrix.yaml config",
    DEFAULT_MATRIX_PATH,
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

    // Load skills matrix config
    const matrixPath = path.isAbsolute(options.matrix)
      ? options.matrix
      : path.join(PROJECT_ROOT, options.matrix);

    const s = p.spinner();
    s.start("Loading skills matrix...");

    let matrix;
    try {
      matrix = await loadAndMergeSkillsMatrix(matrixPath, PROJECT_ROOT);
      s.stop(`Loaded ${Object.keys(matrix.skills).length} skills from matrix`);
    } catch (error) {
      s.stop("Failed to load skills matrix");
      p.log.error(`Could not load skills matrix from ${matrixPath}`);
      p.log.info("Make sure the file exists and is valid YAML");
      process.exit(1);
    }

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

    // Create .claude directory
    const claudeDir = path.join(projectDir, ".claude");
    if (dryRun) {
      p.log.info(pc.yellow(`[dry-run] Would create directory: ${claudeDir}`));
    } else {
      s.start("Creating .claude directory...");
      await ensureDir(claudeDir);
      s.stop("Created .claude directory");
    }

    // Create the stack
    if (dryRun) {
      const stackDir = path.join(claudeDir, "stacks", stackName as string);
      p.log.info(
        pc.yellow(`[dry-run] Would create stack directory: ${stackDir}`),
      );
      p.log.info(
        pc.yellow(
          `[dry-run] Would copy ${result.selectedSkills.length} skills`,
        ),
      );
      p.log.info(pc.yellow(`[dry-run] Would create config.yaml`));
      p.outro(pc.green("[dry-run] Preview complete - no files were created"));
    } else {
      s.start(`Creating stack "${stackName}"...`);
      try {
        const createResult = await createStack(
          stackName as string,
          result.selectedSkills,
          matrix,
          projectDir,
          result.selectedStack,
          PROJECT_ROOT,
        );
        s.stop(`Stack created with ${createResult.skillCount} skills`);

        // Display summary
        displayStackSummary(createResult);

        p.outro(pc.green("Claude Collective initialized successfully!"));
      } catch (error) {
        s.stop("Failed to create stack");
        p.log.error(`Error: ${error}`);
        process.exit(1);
      }
    }
  });
