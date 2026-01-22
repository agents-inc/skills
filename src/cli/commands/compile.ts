import { Command } from "commander";
import * as p from "@clack/prompts";
import pc from "picocolors";
import path from "path";
import { setVerbose } from "../utils/logger";
import { OUTPUT_DIR, DIRS } from "../consts";
import { loadAllAgents, loadStackSkills, loadStack } from "../lib/loader";
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
import type { CompileConfig, CompileContext } from "../types";

export const compileCommand = new Command("compile")
  .description("Compile agents from a stack")
  .requiredOption("-s, --stack <name>", "Stack to compile")
  .option("-v, --verbose", "Enable verbose logging", false)
  .option(
    "--version-skills",
    "Auto-increment version and update content_hash for changed source skills",
    false,
  )
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

    const stackId = options.stack;

    // Determine project root (where we're running from)
    const projectRoot = process.cwd();
    const outputDir = path.join(projectRoot, OUTPUT_DIR);

    console.log(`\n📦 Compiling stack: ${stackId}\n`);

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
      const stack = await loadStack(stackId, projectRoot);
      const compileConfig: CompileConfig = stackToCompileConfig(stackId, stack);
      s.stop(
        `Stack loaded: ${stack.agents.length} agents, ${stack.skills.length} skills`,
      );

      // Load skills from stack
      s.start("Loading skills...");
      const skills = await loadStackSkills(stackId, projectRoot);
      s.stop(
        `Loaded ${Object.keys(skills).length} skills from stack: ${stackId}`,
      );

      // Resolve agents
      s.start("Resolving agents...");
      let resolvedAgents;
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
      };

      const validation = await validate(
        compileConfig,
        resolvedAgents,
        stackId,
        projectRoot,
      );
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

        p.outro(pc.green("✨ Compilation complete!"));
      }
    } catch (error) {
      s.stop("Compilation failed");
      p.log.error(String(error));
      process.exit(1);
    }
  });
