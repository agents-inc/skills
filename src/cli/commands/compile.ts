import { Command } from "commander";
import * as p from "@clack/prompts";
import pc from "picocolors";
import path from "path";
import { setVerbose } from "../utils/logger";
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
import { readActiveStack } from "../lib/active-stack";
import type { AgentConfig, CompileConfig, CompileContext } from "../types";

export const compileCommand = new Command("compile")
  .description("Compile agents from a stack")
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

    // Detect compile mode
    const mode = await detectCompileMode(projectRoot);

    // Resolve stack ID
    let stackId = options.stack;

    if (!stackId) {
      if (mode === "user") {
        // In user mode, fall back to active stack
        const activeStack = await readActiveStack(projectRoot);
        if (!activeStack) {
          p.log.error("No active stack set and no -s flag provided.");
          p.log.info(
            `Use ${pc.cyan("cc switch <name>")} to set an active stack, or ${pc.cyan("cc list")} to see available stacks.`,
          );
          process.exit(1);
        }
        stackId = activeStack;
        console.log(`Using active stack: ${pc.cyan(stackId)}`);
      } else {
        // Dev mode requires explicit stack
        p.log.error("Stack name required in dev mode. Use -s flag.");
        process.exit(1);
      }
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
      const agentCount =
        "agents" in stack ? (stack as any).agents.length : "all";
      const skillCount =
        "skills" in stack
          ? (stack as any).skills.length
          : "skill_ids" in stack
            ? (stack as any).skill_ids.length
            : 0;
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

        p.outro(pc.green("✨ Compilation complete!"));
      }
    } catch (error) {
      s.stop("Compilation failed");
      p.log.error(String(error));
      process.exit(1);
    }
  });
