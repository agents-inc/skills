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

// Source stacks directory (user's local stacks)
export const COLLECTIVE_DIR = ".claude-collective";
export const COLLECTIVE_STACKS_SUBDIR = "stacks";
export const ACTIVE_STACK_FILE = "active-stack";

// Use os.homedir() instead of process.env.HOME for cross-platform
export const CACHE_DIR = path.join(os.homedir(), ".cache", "claude-collective");

// Skills matrix path within a source repository
export const SKILLS_MATRIX_PATH = "src/config/skills-matrix.yaml";

// Skills directory within a source repository
export const SKILLS_DIR_PATH = "src/skills";

// Directory paths relative to project root
export const DIRS = {
  agents: "src/agent-sources",
  skills: "src/skills",
  stacks: "src/stacks",
  corePrompts: "src/core-prompts",
  agentOutputs: "src/agent-outputs",
  templates: "src/templates",
  commands: "src/commands",
} as const;
