import path from "path";
import os from "os";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CLI root is src/cli, project root is two levels up
export const CLI_ROOT = path.resolve(__dirname, "..");
export const PROJECT_ROOT = path.resolve(__dirname, "../..");

export const OUTPUT_DIR = ".claude";
export const GITHUB_REPO = "claude-collective/claude-collective";
export const DEFAULT_MATRIX_PATH = "src/config/skills-matrix.yaml";

/**
 * @deprecated - .claude-collective directory support removed in favor of plugins.
 * Use ~/.claude/plugins/ for user plugins or .claude/plugins/ for project plugins.
 * TODO: Remove in next major version.
 */
export const COLLECTIVE_DIR = ".claude-collective";

/**
 * @deprecated - See COLLECTIVE_DIR deprecation note.
 * TODO: Remove in next major version.
 */
export const COLLECTIVE_STACKS_SUBDIR = "stacks";

/**
 * @deprecated - See COLLECTIVE_DIR deprecation note.
 * TODO: Remove in next major version.
 */
export const ACTIVE_STACK_FILE = "active-stack";

// Plugin directories
export const CLAUDE_DIR = ".claude";
export const PLUGINS_SUBDIR = "plugins";
export const PLUGIN_MANIFEST_DIR = ".claude-plugin";
export const PLUGIN_MANIFEST_FILE = "plugin.json";

// Use os.homedir() instead of process.env.HOME for cross-platform
export const CACHE_DIR = path.join(os.homedir(), ".cache", "claude-collective");

// Skills matrix path within a source repository
export const SKILLS_MATRIX_PATH = "src/config/skills-matrix.yaml";

// Skills directory within a source repository
export const SKILLS_DIR_PATH = "src/skills";

// Directory paths relative to project root
export const DIRS = {
  agents: "src/agents",
  skills: "src/skills",
  stacks: "src/stacks",
  principles: "src/agents/_principles",
  templates: "src/agents/_templates",
  commands: "src/commands",
} as const;
