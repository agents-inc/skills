import { Command } from "commander";
import * as p from "@clack/prompts";
import pc from "picocolors";
import {
  resolveSource,
  loadGlobalConfig,
  saveGlobalConfig,
  loadProjectConfig,
  getGlobalConfigPath,
  getProjectConfigPath,
  formatSourceOrigin,
  DEFAULT_SOURCE,
  SOURCE_ENV_VAR,
  type GlobalConfig,
} from "../lib/config";

export const configCommand = new Command("config")
  .description("Manage Claude Collective configuration")
  .configureOutput({
    writeErr: (str) => console.error(pc.red(str)),
  })
  .showHelpAfterError(true);

/**
 * cc config show - Show effective configuration
 */
configCommand
  .command("show")
  .description("Show current effective configuration")
  .action(async () => {
    const projectDir = process.cwd();

    console.log(pc.cyan("\nClaude Collective Configuration\n"));

    // Resolve source with full precedence chain
    const resolved = await resolveSource(undefined, projectDir);

    console.log(pc.bold("Source:"));
    console.log(`  ${pc.green(resolved.source)}`);
    console.log(
      `  ${pc.dim(`(from ${formatSourceOrigin(resolved.sourceOrigin)})`)}`,
    );
    console.log("");

    // Show all configuration layers
    console.log(pc.bold("Configuration Layers:"));
    console.log("");

    // 1. Environment variable
    const envValue = process.env[SOURCE_ENV_VAR];
    console.log(`  ${pc.dim("1.")} Environment (${SOURCE_ENV_VAR}):`);
    if (envValue) {
      console.log(`     ${pc.green(envValue)}`);
    } else {
      console.log(`     ${pc.dim("(not set)")}`);
    }

    // 2. Project config
    const projectConfig = await loadProjectConfig(projectDir);
    const projectConfigPath = getProjectConfigPath(projectDir);
    console.log(`  ${pc.dim("2.")} Project config:`);
    console.log(`     ${pc.dim(projectConfigPath)}`);
    if (projectConfig?.source) {
      console.log(`     source: ${pc.green(projectConfig.source)}`);
    } else {
      console.log(`     ${pc.dim("(not configured)")}`);
    }

    // 3. Global config
    const globalConfig = await loadGlobalConfig();
    const globalConfigPath = getGlobalConfigPath();
    console.log(`  ${pc.dim("3.")} Global config:`);
    console.log(`     ${pc.dim(globalConfigPath)}`);
    if (globalConfig?.source) {
      console.log(`     source: ${pc.green(globalConfig.source)}`);
    } else {
      console.log(`     ${pc.dim("(not configured)")}`);
    }

    // 4. Default
    console.log(`  ${pc.dim("4.")} Default:`);
    console.log(`     ${pc.dim(DEFAULT_SOURCE)}`);

    console.log("");
    console.log(pc.dim("Precedence: flag > env > project > global > default"));
    console.log("");
  });

/**
 * cc config set <key> <value> - Set a global configuration value
 */
configCommand
  .command("set")
  .description("Set a global configuration value")
  .argument("<key>", "Configuration key (source, author)")
  .argument("<value>", "Configuration value")
  .action(async (key: string, value: string) => {
    const validKeys = ["source", "author"];

    if (!validKeys.includes(key)) {
      p.log.error(`Unknown configuration key: ${key}`);
      p.log.info(`Valid keys: ${validKeys.join(", ")}`);
      process.exit(1);
    }

    // Load existing config
    const existingConfig = (await loadGlobalConfig()) || {};

    // Update the config
    const newConfig: GlobalConfig = {
      ...existingConfig,
      [key]: value,
    };

    await saveGlobalConfig(newConfig);

    p.log.success(`Set ${key} = ${value}`);
    p.log.info(`Saved to ${getGlobalConfigPath()}`);
  });

/**
 * cc config get <key> - Get a configuration value
 */
configCommand
  .command("get")
  .description("Get a configuration value")
  .argument("<key>", "Configuration key (source, author)")
  .action(async (key: string) => {
    const projectDir = process.cwd();

    if (key === "source") {
      const resolved = await resolveSource(undefined, projectDir);
      console.log(resolved.source);
    } else if (key === "author") {
      const globalConfig = await loadGlobalConfig();
      console.log(globalConfig?.author || "");
    } else {
      p.log.error(`Unknown configuration key: ${key}`);
      p.log.info(`Valid keys: source, author`);
      process.exit(1);
    }
  });

/**
 * cc config unset <key> - Remove a global configuration value
 */
configCommand
  .command("unset")
  .description("Remove a global configuration value")
  .argument("<key>", "Configuration key to remove")
  .action(async (key: string) => {
    const validKeys = ["source", "author"];

    if (!validKeys.includes(key)) {
      p.log.error(`Unknown configuration key: ${key}`);
      p.log.info(`Valid keys: ${validKeys.join(", ")}`);
      process.exit(1);
    }

    // Load existing config
    const existingConfig = await loadGlobalConfig();

    if (!existingConfig) {
      p.log.info("No global configuration exists.");
      return;
    }

    // Remove the key
    const newConfig: GlobalConfig = { ...existingConfig };
    delete newConfig[key as keyof GlobalConfig];

    await saveGlobalConfig(newConfig);

    p.log.success(`Removed ${key} from global configuration`);
  });

/**
 * cc config path - Show configuration file paths
 */
configCommand
  .command("path")
  .description("Show configuration file paths")
  .action(async () => {
    const projectDir = process.cwd();

    console.log(pc.bold("\nConfiguration File Paths:\n"));
    console.log(`Global:  ${getGlobalConfigPath()}`);
    console.log(`Project: ${getProjectConfigPath(projectDir)}`);
    console.log("");
  });
