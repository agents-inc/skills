#!/usr/bin/env node
import { Command } from "commander";
import pc from "picocolors";
import { compileCommand } from "./commands/compile";
import { initCommand } from "./commands/init";
import { addCommand } from "./commands/add";
import { updateCommand } from "./commands/update";
import { validateCommand } from "./commands/validate";
import { EXIT_CODES } from "./lib/exit-codes";

// Handle Ctrl+C gracefully
process.on("SIGINT", () => {
  console.log(pc.yellow("\nCancelled"));
  process.exit(EXIT_CODES.CANCELLED);
});

async function main() {
  const program = new Command();

  program
    .name("cc")
    .description("Claude Collective CLI - Manage skills, stacks, and agents")
    .version("0.1.0")
    .option("--dry-run", "Preview operations without executing")
    .configureOutput({
      writeErr: (str) => console.error(pc.red(str)),
    })
    .showHelpAfterError(true);

  // Register commands
  program.addCommand(initCommand);
  program.addCommand(addCommand);
  program.addCommand(updateCommand);
  program.addCommand(compileCommand);
  program.addCommand(validateCommand);

  // Parse arguments
  await program.parseAsync(process.argv);
}

main().catch((err) => {
  console.error(pc.red("Error:"), err.message);
  process.exit(EXIT_CODES.ERROR);
});
