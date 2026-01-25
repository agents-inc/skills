import { Command } from "commander";
import * as p from "@clack/prompts";
import pc from "picocolors";

export const updateCommand = new Command("update")
  .description("Update plugin skills")
  .configureOutput({
    writeErr: (str) => console.error(pc.red(str)),
  })
  .showHelpAfterError(true)
  .action(async () => {
    p.log.info(`Use ${pc.cyan("cc edit")} to modify skills in your plugin.`);
  });
