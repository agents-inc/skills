import { Command } from "commander";
import * as p from "@clack/prompts";
import pc from "picocolors";
import path from "path";
import os from "os";
import { Liquid } from "liquidjs";
import {
  CLAUDE_DIR,
  PLUGINS_SUBDIR,
  PLUGIN_MANIFEST_DIR,
  PLUGIN_MANIFEST_FILE,
  DIRS,
} from "../consts";
import { ensureDir, writeFile } from "../utils/fs";
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
import { formatSourceOrigin } from "../lib/config";
import { copySkillsToStackFromSource } from "../lib/skill-copier";
import {
  createStackConfig,
  createStackConfigFromSuggested,
} from "../lib/stack-config";
import { generateStackPluginManifest } from "../lib/plugin-manifest";
import { loadAllAgents, loadPluginSkills, loadStack } from "../lib/loader";
import { resolveAgents, stackToCompileConfig } from "../lib/resolver";
import { compileAgentForPlugin } from "../lib/stack-plugin-compiler";
import type {
  PluginManifest,
  CompileConfig,
  CompileAgentConfig,
} from "../../types";

/**
 * Scope for plugin output location
 */
type PluginScope = "user" | "project" | "local";

/**
 * Default version for new plugins
 */
const DEFAULT_PLUGIN_VERSION = "1.0.0";

/**
 * Default agents to compile when no stack specifies agents
 */
const DEFAULT_AGENTS = [
  "frontend-developer",
  "backend-developer",
  "pm",
  "orchestrator",
  "tester",
];

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
 * Display summary for plugin output
 */
function displayPluginSummary(
  pluginName: string,
  pluginDir: string,
  skillCount: number,
  agentCount: number,
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
  console.log(`    ${pc.dim(`agents/ (${agentCount} agents)`)}`);
  console.log("");
  console.log(pc.dim(`Scope: ${scope}`));
  console.log("");
}

export const initCommand = new Command("init")
  .description("Create a new Claude Collective plugin")
  .option(
    "--source <url>",
    "Skills source URL (e.g., github:org/repo or local path)",
  )
  .option("--refresh", "Force refresh from remote source", false)
  .option("--name <name>", "Plugin name")
  .option(
    "--scope <scope>",
    "Output scope: user (~/.claude/plugins), project (.claude/plugins), local (.claude/plugins, gitignored)",
    "user",
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

    p.intro(pc.cyan("Claude Collective Plugin Setup"));

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

    // Prompt for plugin name
    const pluginName =
      options.name || ((await promptStackName([], "my-plugin")) as string);

    if (p.isCancel(pluginName)) {
      p.cancel("Setup cancelled");
      process.exit(0);
    }

    // Plugin output mode (always - classic mode removed)
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

        // Compile agents
        const agentsDir = path.join(pluginDir, "agents");
        await ensureDir(agentsDir);

        // Load agents from source
        const agents = await loadAllAgents(sourceResult.sourcePath);

        // Load skills from the plugin we just created
        const pluginSkills = await loadPluginSkills(pluginDir);

        // Build compile config - use stack's agents if pre-built stack selected, otherwise defaults
        let compileConfig: CompileConfig;

        if (result.selectedStack) {
          // Load full stack config to get agents and agent_skills
          const stackConfig = await loadStack(
            result.selectedStack.id,
            sourceResult.sourcePath,
            "dev",
          );
          compileConfig = stackToCompileConfig(
            result.selectedStack.id,
            stackConfig,
          );
          compileConfig.name = pluginName; // Override name with user's choice
        } else {
          // Custom stack - use default agents
          const compileAgents: Record<string, CompileAgentConfig> = {};
          for (const agentId of DEFAULT_AGENTS) {
            if (agents[agentId]) {
              compileAgents[agentId] = {
                core_prompts: [
                  "core-principles",
                  "investigation-requirement",
                  "write-verification",
                  "anti-over-engineering",
                ],
                ending_prompts: ["context-management", "improvement-protocol"],
              };
            }
          }
          compileConfig = {
            name: pluginName,
            description: `Plugin with ${result.selectedSkills.length} skills`,
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
          pluginSkills,
          compileConfig,
          sourceResult.sourcePath,
        );

        const compiledAgentNames: string[] = [];
        for (const [name, agent] of Object.entries(resolvedAgents)) {
          const output = await compileAgentForPlugin(
            name,
            agent,
            sourceResult.sourcePath,
            engine,
          );
          await writeFile(path.join(agentsDir, `${name}.md`), output);
          compiledAgentNames.push(name);
        }

        // Generate stack config for reference
        const stackConfig = result.selectedStack
          ? createStackConfigFromSuggested(pluginName, result.selectedStack)
          : createStackConfig(
              pluginName,
              `Plugin with ${result.selectedSkills.length} skills`,
              result.selectedSkills,
            );

        // Generate plugin manifest with agents
        const manifest: PluginManifest = generateStackPluginManifest({
          stackName: pluginName,
          description: stackConfig.description,
          version: DEFAULT_PLUGIN_VERSION,
          keywords: stackConfig.tags,
          hasSkills: true,
          hasAgents: compiledAgentNames.length > 0,
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

        s.stop(
          `Plugin created with ${copiedSkills.length} skills and ${compiledAgentNames.length} agents`,
        );

        // Display summary
        displayPluginSummary(
          pluginName,
          pluginDir,
          copiedSkills.length,
          compiledAgentNames.length,
          scope,
        );

        p.outro(pc.green(`Plugin "${pluginName}" created successfully!`));
      } catch (error) {
        s.stop("Failed to create plugin");
        p.log.error(`Error: ${error}`);
        process.exit(1);
      }
    }
  });
