import { Command } from "commander";
import * as p from "@clack/prompts";
import pc from "picocolors";
import path from "path";
import { setVerbose } from "../utils/logger";
import { DIRS } from "../consts";
import {
  compileAllSkillPlugins,
  compileSkillPlugin,
  printCompilationSummary,
} from "../lib/skill-plugin-compiler";

const DEFAULT_OUTPUT_DIR = "dist/plugins";

export const compilePluginsCommand = new Command("compile-plugins")
  .description("Compile skills into standalone plugins")
  .option("-s, --skills-dir <dir>", "Skills source directory", DIRS.skills)
  .option("-o, --output-dir <dir>", "Output directory", DEFAULT_OUTPUT_DIR)
  .option(
    "--skill <name>",
    "Compile only a specific skill (path to skill directory)",
  )
  .option("-v, --verbose", "Enable verbose logging", false)
  .configureOutput({
    writeErr: (str) => console.error(pc.red(str)),
  })
  .showHelpAfterError(true)
  .action(async (options) => {
    const s = p.spinner();

    // Set verbose mode globally
    setVerbose(options.verbose);

    const projectRoot = process.cwd();
    const skillsDir = path.resolve(projectRoot, options.skillsDir);
    const outputDir = path.resolve(projectRoot, options.outputDir);

    console.log(`\nCompiling skill plugins`);
    console.log(`  Skills directory: ${pc.cyan(skillsDir)}`);
    console.log(`  Output directory: ${pc.cyan(outputDir)}\n`);

    try {
      if (options.skill) {
        // Compile a single skill
        const skillPath = path.resolve(skillsDir, options.skill);
        s.start(`Compiling skill at ${skillPath}...`);

        const result = await compileSkillPlugin({
          skillPath,
          outputDir,
        });

        s.stop(`Compiled skill-${result.skillName}`);
        console.log(`  Plugin path: ${pc.cyan(result.pluginPath)}`);
      } else {
        // Compile all skills
        s.start("Finding and compiling all skills...");

        const results = await compileAllSkillPlugins(skillsDir, outputDir);

        s.stop(`Compiled ${results.length} skill plugins`);
        printCompilationSummary(results);
      }

      p.outro(pc.green("Plugin compilation complete!"));
    } catch (error) {
      s.stop("Compilation failed");
      p.log.error(String(error));
      process.exit(1);
    }
  });
