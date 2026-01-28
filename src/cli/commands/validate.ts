import { Command } from "commander";
import * as p from "@clack/prompts";
import pc from "picocolors";
import path from "path";
import { setVerbose } from "../utils/logger";
import {
  validateAllSchemas,
  printValidationResults,
} from "../lib/schema-validator";
import {
  validatePlugin,
  validateAllPlugins,
  printPluginValidationResult,
} from "../lib/plugin-validator";

export const validateCommand = new Command("validate")
  .description(
    "Validate YAML files against schemas, or validate compiled plugins",
  )
  .argument("[path]", "Path to plugin or plugins directory to validate")
  .option("-v, --verbose", "Enable verbose logging", false)
  .option("-a, --all", "Validate all plugins in directory", false)
  .option("-p, --plugins", "Validate plugins instead of schemas", false)
  .configureOutput({
    writeErr: (str) => console.error(pc.red(str)),
  })
  .showHelpAfterError(true)
  .action(async (pluginPath, options) => {
    const s = p.spinner();

    setVerbose(options.verbose);

    // If path is provided or --plugins flag, validate plugins
    if (pluginPath || options.plugins) {
      await validatePluginsAction(pluginPath, options, s);
    } else {
      // Default: validate YAML schemas
      await validateSchemasAction(options, s);
    }
  });

async function validateSchemasAction(
  options: { verbose: boolean },
  s: ReturnType<typeof p.spinner>,
): Promise<void> {
  console.log(`\n${pc.bold("Validating all schemas")}\n`);

  try {
    s.start("Validating...");
    const result = await validateAllSchemas();
    s.stop(
      result.valid
        ? pc.green(
            `Done: ${result.summary.validFiles}/${result.summary.totalFiles} files valid`,
          )
        : pc.red(`Done: ${result.summary.invalidFiles} invalid files`),
    );

    printValidationResults(result);

    if (!result.valid) {
      process.exit(1);
    }
  } catch (error) {
    s.stop(pc.red("Validation failed"));
    const message = error instanceof Error ? error.message : String(error);
    console.error(pc.red(`\nError: ${message}\n`));
    process.exit(1);
  }
}

async function validatePluginsAction(
  pluginPath: string | undefined,
  options: { verbose: boolean; all: boolean },
  s: ReturnType<typeof p.spinner>,
): Promise<void> {
  // Resolve path (default to current directory if --plugins flag but no path)
  const targetPath = pluginPath ? path.resolve(pluginPath) : process.cwd();

  if (options.all) {
    // Validate all plugins in directory
    console.log(`\n${pc.bold("Validating all plugins in:")} ${targetPath}\n`);

    try {
      s.start("Validating plugins...");
      const result = await validateAllPlugins(targetPath);
      s.stop(
        result.valid
          ? pc.green(
              `Done: ${result.summary.valid}/${result.summary.total} plugins valid`,
            )
          : pc.red(`Done: ${result.summary.invalid} invalid plugins`),
      );

      console.log(`\n  Plugin Validation Summary:`);
      console.log(`  -------------------------`);
      console.log(`  Total plugins: ${result.summary.total}`);
      console.log(`  Valid: ${result.summary.valid}`);
      console.log(`  Invalid: ${result.summary.invalid}`);
      console.log(`  With warnings: ${result.summary.withWarnings}`);

      // Print individual results
      for (const { name, result: pluginResult } of result.results) {
        printPluginValidationResult(name, pluginResult, options.verbose);
      }

      if (result.valid) {
        console.log(`\n  ${pc.green("All plugins validated successfully")}\n`);
      } else {
        console.log(`\n  ${pc.red("Validation failed")}\n`);
        process.exit(1);
      }
    } catch (error) {
      s.stop(pc.red("Validation failed"));
      const message = error instanceof Error ? error.message : String(error);
      console.error(pc.red(`\nError: ${message}\n`));
      process.exit(1);
    }
  } else {
    // Validate single plugin
    console.log(`\n${pc.bold("Validating plugin:")} ${targetPath}\n`);

    try {
      s.start("Validating plugin...");
      const result = await validatePlugin(targetPath);
      s.stop(
        result.valid
          ? pc.green("Done: Plugin is valid")
          : pc.red("Done: Plugin has errors"),
      );

      printPluginValidationResult(path.basename(targetPath), result, true);

      if (result.valid && result.warnings.length === 0) {
        console.log(`\n  ${pc.green("Plugin validated successfully")}\n`);
      } else if (result.valid) {
        console.log(`\n  ${pc.yellow("Plugin valid with warnings")}\n`);
      } else {
        console.log(`\n  ${pc.red("Validation failed")}\n`);
        process.exit(1);
      }
    } catch (error) {
      s.stop(pc.red("Validation failed"));
      const message = error instanceof Error ? error.message : String(error);
      console.error(pc.red(`\nError: ${message}\n`));
      process.exit(1);
    }
  }
}
