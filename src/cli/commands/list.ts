import { Command } from "commander";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { getPluginInfo, formatPluginDisplay } from "../lib/plugin-info";

export const listCommand = new Command("list")
  .alias("ls")
  .description("Show plugin information")
  .configureOutput({
    writeErr: (str) => console.error(pc.red(str)),
  })
  .showHelpAfterError(true)
  .action(async () => {
    const info = await getPluginInfo();

    if (!info) {
      p.log.warn("No plugin found.");
      p.log.info(`Run ${pc.cyan("cc init")} to create one.`);
      return;
    }

    console.log("");
    p.log.info(formatPluginDisplay(info));
    console.log("");
  });
