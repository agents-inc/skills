import { Command } from "commander";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { directoryExists, ensureDir, remove } from "../utils/fs";
import {
  getCollectivePluginDir,
  getPluginSkillsDir,
  getPluginSkillIds,
} from "../lib/plugin-finder";
import { resolveSource } from "../lib/config";
import { loadSkillsMatrixFromSource } from "../lib/source-loader";
import {
  runWizard,
  clearTerminal,
  renderSelectionsHeader,
} from "../lib/wizard";
import { copySkillsToPluginFromSource } from "../lib/skill-copier";
import { recompileAgents } from "../lib/agent-recompiler";
import { bumpPluginVersion } from "../lib/plugin-version";
import { fetchAgentDefinitions } from "../lib/agent-fetcher";

export const editCommand = new Command("edit")
  .description("Edit skills in the plugin")
  .option(
    "--source <url>",
    "Marketplace source URL (e.g., github:org/repo or local path)",
  )
  .option("--refresh", "Force refresh from marketplace", false)
  .configureOutput({
    writeErr: (str) => console.error(pc.red(str)),
  })
  .showHelpAfterError(true)
  .action(async (options) => {
    // 1. Get plugin directory
    const pluginDir = getCollectivePluginDir();
    const pluginSkillsDir = getPluginSkillsDir(pluginDir);

    // Check if plugin exists
    if (!(await directoryExists(pluginDir))) {
      p.log.error("No plugin found. Run 'cc init' first to set up the plugin.");
      process.exit(1);
    }

    p.intro(pc.cyan("Edit Plugin Skills"));

    const s = p.spinner();

    // 2. Resolve source
    s.start("Resolving marketplace source...");
    let sourceConfig;
    try {
      sourceConfig = await resolveSource(options.source);
      s.stop(`Source: ${sourceConfig.sourceOrigin}`);
    } catch (error) {
      s.stop("Failed to resolve source");
      p.log.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }

    // 3. Load skills matrix
    s.start("Loading skills matrix...");
    let sourceResult;
    try {
      sourceResult = await loadSkillsMatrixFromSource({
        sourceFlag: options.source,
        projectDir: process.cwd(),
        forceRefresh: options.refresh,
      });
      s.stop(`Loaded ${Object.keys(sourceResult.matrix.skills).length} skills`);
    } catch (error) {
      s.stop("Failed to load skills matrix");
      p.log.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }

    // 4. Get current plugin's skill IDs
    s.start("Reading current skills...");
    let currentSkillIds: string[];
    try {
      currentSkillIds = await getPluginSkillIds(
        pluginSkillsDir,
        sourceResult.matrix,
      );
      s.stop(`Current plugin has ${currentSkillIds.length} skills`);
    } catch (error) {
      s.stop("Failed to read current skills");
      p.log.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }

    // 5. Run wizard with current skills pre-selected
    const result = await runWizard(sourceResult.matrix, {
      initialSkills: currentSkillIds,
    });

    if (!result) {
      p.cancel("Edit cancelled");
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

    // Show final summary
    clearTerminal();
    renderSelectionsHeader(result.selectedSkills, sourceResult.matrix);

    // Show warnings if any
    if (result.validation.warnings.length > 0) {
      console.log(pc.yellow("Warnings:"));
      for (const warning of result.validation.warnings) {
        console.log(`  ${pc.yellow("!")} ${warning.message}`);
      }
      console.log("");
    }

    // Check if anything changed
    const addedSkills = result.selectedSkills.filter(
      (id) => !currentSkillIds.includes(id),
    );
    const removedSkills = currentSkillIds.filter(
      (id) => !result.selectedSkills.includes(id),
    );

    if (addedSkills.length === 0 && removedSkills.length === 0) {
      p.log.info("No changes made.");
      p.outro(pc.dim("Plugin unchanged"));
      return;
    }

    // Show what changed
    console.log(pc.bold("Changes:"));
    for (const skillId of addedSkills) {
      const skill = sourceResult.matrix.skills[skillId];
      console.log(`  ${pc.green("+")} ${skill?.name || skillId}`);
    }
    for (const skillId of removedSkills) {
      const skill = sourceResult.matrix.skills[skillId];
      console.log(`  ${pc.red("-")} ${skill?.name || skillId}`);
    }
    console.log("");

    // 6. Apply changes directly to plugin
    s.start("Updating plugin skills...");
    try {
      // Remove existing skills from plugin
      if (await directoryExists(pluginSkillsDir)) {
        await remove(pluginSkillsDir);
      }
      await ensureDir(pluginSkillsDir);

      // Copy new selection directly to plugin
      await copySkillsToPluginFromSource(
        result.selectedSkills,
        pluginDir,
        sourceResult.matrix,
        sourceResult,
      );
      s.stop(`Plugin updated with ${result.selectedSkills.length} skills`);
    } catch (error) {
      s.stop("Failed to update plugin");
      p.log.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }

    // 7. Get source path for agent definitions
    let sourcePath: string;

    if (sourceResult.isLocal) {
      // Use local source path directly
      sourcePath = sourceResult.sourcePath;
    } else {
      // Fetch agent definitions from remote
      s.start("Fetching agent definitions...");
      try {
        const agentDefs = await fetchAgentDefinitions(sourceConfig.source, {
          forceRefresh: options.refresh,
        });
        sourcePath = agentDefs.sourcePath;
        s.stop("Agent definitions fetched");
      } catch (error) {
        s.stop("Failed to fetch agent definitions");
        p.log.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    }

    // 8. Recompile agents with updated skills
    s.start("Recompiling agents...");
    try {
      const recompileResult = await recompileAgents({
        pluginDir,
        sourcePath,
      });

      if (recompileResult.failed.length > 0) {
        s.stop(
          `Recompiled ${recompileResult.compiled.length} agents (${recompileResult.failed.length} failed)`,
        );
        for (const warning of recompileResult.warnings) {
          p.log.warn(warning);
        }
      } else if (recompileResult.compiled.length > 0) {
        s.stop(`Recompiled ${recompileResult.compiled.length} agents`);
      } else {
        s.stop("No agents to recompile");
      }
    } catch (error) {
      s.stop("Failed to recompile agents");
      p.log.warn(
        `Agent recompilation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      p.log.info(pc.dim("You can manually recompile with 'cc compile'."));
    }

    // 9. Bump patch version
    s.start("Updating plugin version...");
    try {
      const newVersion = await bumpPluginVersion(pluginDir, "patch");
      s.stop(`Version bumped to ${newVersion}`);
    } catch (error) {
      s.stop("Failed to update version");
      p.log.error(error instanceof Error ? error.message : String(error));
      // Don't exit - skills were updated successfully
    }

    // Success message
    console.log("");
    p.outro(
      pc.green(
        `Plugin updated! (${addedSkills.length} added, ${removedSkills.length} removed)`,
      ),
    );
  });
