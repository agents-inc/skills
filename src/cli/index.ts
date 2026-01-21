#!/usr/bin/env node
import { Command } from 'commander';
import pc from 'picocolors';
import { compileCommand } from './commands/compile';
import { initCommand } from './commands/init';
import { addCommand } from './commands/add';
import { updateCommand } from './commands/update';
import { validateCommand } from './commands/validate';

async function main() {
  const program = new Command();

  program
    .name('cc')
    .description('Claude Collective CLI - Manage skills, stacks, and agents')
    .version('0.1.0')
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
  console.error(pc.red('Error:'), err.message);
  process.exit(1);
});
