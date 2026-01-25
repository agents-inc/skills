import path from "path";
import { fetchFromSource, type FetchOptions } from "./source-fetcher";
import { directoryExists } from "../utils/fs";
import { verbose } from "../utils/logger";
import type { AgentSourcePaths } from "../../types";

/**
 * Fetch agent definitions from marketplace source
 *
 * Returns paths to agent components (agents, templates)
 * without loading them into memory.
 *
 * @param source - Source URL (e.g., "github:claude-collective/skills")
 * @param options - Fetch options
 * @returns Paths to agent definition directories
 */
export async function fetchAgentDefinitions(
  source: string,
  options: FetchOptions = {},
): Promise<AgentSourcePaths> {
  // Fetch the source repository (uses cache if available)
  const result = await fetchFromSource(source, {
    forceRefresh: options.forceRefresh,
    subdir: "", // Need root to access src/agents
  });

  // Build paths to agent components
  const agentsDir = path.join(result.path, "src", "agents");
  const templatesDir = path.join(agentsDir, "_templates");

  // Validate directories exist
  if (!(await directoryExists(agentsDir))) {
    throw new Error(`Agent definitions not found at: ${agentsDir}`);
  }

  if (!(await directoryExists(templatesDir))) {
    verbose(`Templates directory not found: ${templatesDir}`);
  }

  verbose(`Agent definitions fetched from: ${result.path}`);

  return {
    agentsDir,
    templatesDir,
    sourcePath: result.path,
  };
}
