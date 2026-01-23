import { Command } from "commander";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { directoryExists, ensureDir, glob } from "../utils/fs";
import { findPluginDirectory, getPluginSkillsDir } from "../lib/plugin-finder";
import { bumpPluginVersion } from "../lib/plugin-version";
import { fetchMarketplace } from "../lib/source-fetcher";
import { fetchSkills } from "../lib/skill-fetcher";
import { fetchAgentDefinitions } from "../lib/agent-fetcher";
import { resolveSource } from "../lib/config";
import { verbose } from "../utils/logger";
import { recompileAgents } from "../lib/agent-recompiler";

export const addCommand = new Command("add")
  .description("Add a skill to an existing plugin")
  .argument("<skill>", "Skill name to add (e.g., 'jotai', 'zustand')")
  .option(
    "--source <url>",
    "Marketplace source URL (e.g., github:org/repo or local path)",
  )
  .option("--refresh", "Force refresh from marketplace", false)
  .option(
    "--plugin <name>",
    "Target plugin name (finds first plugin if not specified)",
  )
  .configureOutput({
    writeErr: (str) => console.error(pc.red(str)),
  })
  .showHelpAfterError(true)
  .action(async (skillName: string, options) => {
    p.intro(pc.cyan(`Add Skill: ${skillName}`));

    const s = p.spinner();

    // 1. Find existing plugin
    s.start("Finding plugin...");
    const pluginLocation = await findPluginDirectory(options.plugin);

    if (!pluginLocation) {
      s.stop("No plugin found");
      p.log.error("No plugin found.");
      p.log.info(
        `Run ${pc.cyan("cc init --name <name>")} first to create a plugin.`,
      );
      process.exit(1);
    }

    s.stop(
      `Found plugin: ${pluginLocation.manifest.name} (${pluginLocation.scope})`,
    );

    // 2. Check if skill already exists
    const skillsDir = getPluginSkillsDir(pluginLocation.path);

    // Skills can be nested, so we need to check for any directory containing the skill name
    if (await directoryExists(skillsDir)) {
      // Check if this specific skill exists
      const existingSkills = await glob(`**/${skillName}*/SKILL.md`, skillsDir);

      if (existingSkills.length > 0) {
        p.log.error(`Skill "${skillName}" already exists in this plugin.`);
        p.log.info(`Found at: ${existingSkills[0]}`);
        process.exit(1);
      }
    }

    // 3. Resolve source
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

    // 4. Fetch marketplace
    s.start("Fetching marketplace...");
    let marketplaceResult;
    try {
      marketplaceResult = await fetchMarketplace(sourceConfig.source, {
        forceRefresh: options.refresh,
      });
      s.stop(
        `Marketplace loaded: ${marketplaceResult.marketplace.plugins.length} plugins`,
      );
    } catch (error) {
      s.stop("Failed to fetch marketplace");
      p.log.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }

    // 5. Fetch and copy skill
    s.start(`Fetching skill: ${skillName}...`);
    try {
      await ensureDir(skillsDir);
      const copiedSkills = await fetchSkills(
        [skillName],
        marketplaceResult.marketplace,
        pluginLocation.path,
        marketplaceResult.sourcePath,
        { forceRefresh: options.refresh },
      );
      s.stop(`Skill fetched: ${copiedSkills.join(", ")}`);
    } catch (error) {
      s.stop("Failed to fetch skill");
      p.log.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }

    // 6. Fetch agent definitions
    s.start("Fetching agent definitions...");
    let agentDefs;
    try {
      agentDefs = await fetchAgentDefinitions(sourceConfig.source, {
        forceRefresh: options.refresh,
      });
      s.stop("Agent definitions fetched");
      verbose(`  Agents: ${agentDefs.agentsDir}`);
      verbose(`  Principles: ${agentDefs.principlesDir}`);
      verbose(`  Templates: ${agentDefs.templatesDir}`);
    } catch (error) {
      s.stop("Failed to fetch agent definitions");
      p.log.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }

    // 7. Recompile agents with updated skills
    s.start("Recompiling agents...");
    try {
      // agentDefs contains paths to source directories
      // We need the parent directory that contains agents/, principles/, templates/
      const sourcePath = agentDefs.sourcePath;

      const recompileResult = await recompileAgents({
        pluginDir: pluginLocation.path,
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

    // 8. Bump patch version
    s.start("Updating plugin version...");
    try {
      const newVersion = await bumpPluginVersion(pluginLocation.path, "patch");
      s.stop(`Version bumped to ${newVersion}`);
    } catch (error) {
      s.stop("Failed to update version");
      p.log.error(error instanceof Error ? error.message : String(error));
      // Don't exit - skill was added successfully
    }

    // Success message
    console.log("");
    p.outro(
      pc.green(
        `Skill "${skillName}" added to ${pluginLocation.manifest.name}!`,
      ),
    );
  });
