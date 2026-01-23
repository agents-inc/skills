import { Command } from "commander";
import * as p from "@clack/prompts";
import pc from "picocolors";
import path from "path";
import { setVerbose } from "../utils/logger";
import {
  generateMarketplace,
  writeMarketplace,
  getMarketplaceStats,
} from "../lib/marketplace-generator";

const DEFAULT_PLUGINS_DIR = "dist/plugins";
const DEFAULT_OUTPUT_FILE = ".claude-plugin/marketplace.json";
const DEFAULT_NAME = "claude-collective";
const DEFAULT_VERSION = "1.0.0";
const DEFAULT_DESCRIPTION = "Community skills and stacks for Claude Code";
const DEFAULT_OWNER_NAME = "Claude Collective";
const DEFAULT_OWNER_EMAIL = "hello@claude-collective.com";

export const generateMarketplaceCommand = new Command("generate-marketplace")
  .description("Generate marketplace.json from compiled plugins")
  .option("-p, --plugins-dir <dir>", "Plugins directory", DEFAULT_PLUGINS_DIR)
  .option("-o, --output <file>", "Output file", DEFAULT_OUTPUT_FILE)
  .option("--name <name>", "Marketplace name", DEFAULT_NAME)
  .option("--version <version>", "Marketplace version", DEFAULT_VERSION)
  .option(
    "--description <desc>",
    "Marketplace description",
    DEFAULT_DESCRIPTION,
  )
  .option("--owner-name <name>", "Owner name", DEFAULT_OWNER_NAME)
  .option("--owner-email <email>", "Owner email", DEFAULT_OWNER_EMAIL)
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
    const pluginsDir = path.resolve(projectRoot, options.pluginsDir);
    const outputPath = path.resolve(projectRoot, options.output);

    console.log(`\nGenerating marketplace.json`);
    console.log(`  Plugins directory: ${pc.cyan(pluginsDir)}`);
    console.log(`  Output file: ${pc.cyan(outputPath)}\n`);

    try {
      s.start("Scanning plugins...");

      const marketplace = await generateMarketplace(pluginsDir, {
        name: options.name,
        version: options.version,
        description: options.description,
        ownerName: options.ownerName,
        ownerEmail: options.ownerEmail,
        pluginRoot: `./${options.pluginsDir}`,
      });

      const stats = getMarketplaceStats(marketplace);
      s.stop(`Found ${stats.total} plugins`);

      // Print category breakdown
      console.log(`\nCategory breakdown:`);
      const sortedCategories = Object.entries(stats.byCategory).sort(
        ([, a], [, b]) => b - a,
      );
      for (const [category, count] of sortedCategories) {
        console.log(`  ${pc.dim(category)}: ${count}`);
      }

      // Write marketplace file
      s.start("Writing marketplace.json...");
      await writeMarketplace(outputPath, marketplace);
      s.stop(`Wrote ${outputPath}`);

      // Print sample
      console.log(`\nSample plugins:`);
      const sampleSize = 5;
      for (const plugin of marketplace.plugins.slice(0, sampleSize)) {
        const category = plugin.category ? pc.dim(`[${plugin.category}]`) : "";
        console.log(`  ${pc.green(plugin.name)} ${category}`);
        if (plugin.description) {
          console.log(`    ${pc.dim(plugin.description)}`);
        }
      }
      if (marketplace.plugins.length > sampleSize) {
        console.log(
          `  ${pc.dim(`... and ${marketplace.plugins.length - sampleSize} more`)}`,
        );
      }

      p.outro(pc.green(`Marketplace generated with ${stats.total} plugins!`));
    } catch (error) {
      s.stop("Generation failed");
      p.log.error(String(error));
      process.exit(1);
    }
  });
