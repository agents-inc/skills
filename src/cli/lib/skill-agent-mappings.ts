/**
 * Skill-to-Agent Mapping Configuration
 *
 * Defines default mappings from skill categories to agents.
 * Used when user manually selects skills (no pre-built stack).
 *
 * This module is the source of truth for which agents receive which skills
 * and which skills should be preloaded for each agent.
 */

/**
 * Maps skill path prefixes or category names to agent arrays.
 *
 * Keys can be:
 * - Top-level paths: "frontend/*", "backend/*", "mobile/*"
 * - Specific paths: "frontend/testing", "backend/testing"
 * - Category names: "framework", "styling", "api"
 *
 * Matching priority:
 * 1. Exact category match
 * 2. Exact path match
 * 3. Wildcard prefix match (e.g., "frontend/*" matches "frontend/framework")
 */
export const SKILL_TO_AGENTS: Record<string, string[]> = {
  // Frontend skills → frontend agents + shared
  "frontend/*": [
    "frontend-developer",
    "frontend-reviewer",
    "frontend-researcher",
    "pm",
    "pattern-scout",
    "pattern-critique",
    "agent-summoner",
    "skill-summoner",
    "documentor",
  ],

  // Backend skills → backend agents + shared
  "backend/*": [
    "backend-developer",
    "backend-reviewer",
    "backend-researcher",
    "architecture",
    "pm",
    "pattern-scout",
    "pattern-critique",
    "agent-summoner",
    "skill-summoner",
    "documentor",
  ],

  // Mobile skills → frontend agents (React Native/Expo are frontend tech)
  "mobile/*": [
    "frontend-developer",
    "frontend-reviewer",
    "frontend-researcher",
    "pm",
    "agent-summoner",
    "skill-summoner",
    "documentor",
  ],

  // Setup skills → architecture + both developers + meta
  "setup/*": [
    "architecture",
    "frontend-developer",
    "backend-developer",
    "agent-summoner",
    "skill-summoner",
    "documentor",
  ],

  // Security → both developers + both reviewers + architecture
  "security/*": [
    "frontend-developer",
    "backend-developer",
    "frontend-reviewer",
    "backend-reviewer",
    "architecture",
    "pm",
    "agent-summoner",
    "skill-summoner",
    "documentor",
  ],

  // Reviewing skills → reviewer agents + pattern-critique
  "reviewing/*": [
    "frontend-reviewer",
    "backend-reviewer",
    "pattern-critique",
    "agent-summoner",
    "skill-summoner",
    "documentor",
  ],

  // Research methodology → researchers + planning + pattern agents
  "research/*": [
    "frontend-researcher",
    "backend-researcher",
    "pm",
    "pattern-scout",
    "pattern-critique",
    "documentor",
    "agent-summoner",
    "skill-summoner",
  ],

  // Methodology skills → all implementation agents
  "methodology/*": [
    "frontend-developer",
    "backend-developer",
    "frontend-reviewer",
    "backend-reviewer",
    "frontend-researcher",
    "backend-researcher",
    "tester",
    "pm",
    "architecture",
    "pattern-scout",
    "pattern-critique",
    "agent-summoner",
    "skill-summoner",
    "documentor",
  ],

  // Testing skills - specific assignments
  "frontend/testing": ["tester", "frontend-developer", "frontend-reviewer"],
  "backend/testing": ["tester", "backend-developer", "backend-reviewer"],

  // Mocks - testers + developers
  "frontend/mocks": ["tester", "frontend-developer", "frontend-reviewer"],
};

/**
 * Maps agent IDs to categories/subcategories that should be preloaded.
 *
 * Skills matching these patterns will have preloaded: true in the config.
 * Patterns can match:
 * - Category names: "framework", "styling"
 * - Path segments: "frontend/testing"
 * - Skill IDs: "research-methodology"
 */
export const PRELOADED_SKILLS: Record<string, string[]> = {
  "frontend-developer": ["framework", "styling"],
  "backend-developer": ["api", "database"],
  "frontend-reviewer": ["framework", "styling", "reviewing"],
  "backend-reviewer": ["api", "database", "reviewing"],
  "frontend-researcher": ["framework", "research-methodology"],
  "backend-researcher": ["api", "research-methodology"],
  tester: ["testing", "mocks"],
  architecture: ["monorepo", "turborepo"],
  pm: ["research-methodology"],
  "pattern-scout": ["research-methodology"],
  "pattern-critique": ["research-methodology", "reviewing"],
  documentor: ["research-methodology"],
  // meta agents: no preloaded (they get everything dynamically)
  "agent-summoner": [],
  "skill-summoner": [],
};

/**
 * Aliases for category matching.
 *
 * Maps short category names to their full path equivalents.
 * Used when matching preloaded patterns against skill paths.
 */
export const SUBCATEGORY_ALIASES: Record<string, string> = {
  framework: "frontend/framework",
  styling: "frontend/styling",
  api: "backend/api",
  database: "backend/database",
  mocks: "frontend/mocks",
  testing: "testing",
  reviewing: "reviewing",
  "research-methodology": "research/research-methodology",
  monorepo: "setup/monorepo",
};

/**
 * Get the list of agents that should receive a skill based on its path/category.
 *
 * @param skillPath - The skill's directory path (e.g., "skills/frontend/framework/react (@vince)/")
 * @param category - The skill's category from metadata (e.g., "framework")
 * @returns Array of agent IDs that should receive this skill
 */
export function getAgentsForSkill(
  skillPath: string,
  category: string,
): string[] {
  // Normalize path: remove "skills/" prefix and trailing slash
  const normalizedPath = skillPath.replace(/^skills\//, "").replace(/\/$/, "");

  // Try exact category match first
  if (SKILL_TO_AGENTS[category]) {
    return SKILL_TO_AGENTS[category];
  }

  // Try exact path match
  for (const [pattern, agents] of Object.entries(SKILL_TO_AGENTS)) {
    if (
      normalizedPath === pattern ||
      normalizedPath.startsWith(`${pattern}/`)
    ) {
      return agents;
    }
  }

  // Try wildcard patterns (e.g., "frontend/*")
  for (const [pattern, agents] of Object.entries(SKILL_TO_AGENTS)) {
    if (pattern.endsWith("/*")) {
      const prefix = pattern.slice(0, -2);
      if (normalizedPath.startsWith(prefix)) {
        return agents;
      }
    }
  }

  // Default: give to meta agents only
  return ["agent-summoner", "skill-summoner", "documentor"];
}

/**
 * Determine if a skill should be preloaded for a specific agent.
 *
 * @param skillPath - The skill's directory path
 * @param skillId - The skill's canonical ID
 * @param category - The skill's category
 * @param agentId - The agent to check
 * @returns true if the skill should be preloaded for this agent
 */
export function shouldPreloadSkill(
  skillPath: string,
  skillId: string,
  category: string,
  agentId: string,
): boolean {
  const preloadedPatterns = PRELOADED_SKILLS[agentId];
  if (!preloadedPatterns || preloadedPatterns.length === 0) {
    return false;
  }

  // Normalize path: remove "skills/" prefix and trailing slash
  const normalizedPath = skillPath.replace(/^skills\//, "").replace(/\/$/, "");

  for (const pattern of preloadedPatterns) {
    // Check category match
    if (category === pattern) {
      return true;
    }

    // Check path contains pattern
    if (normalizedPath.includes(pattern)) {
      return true;
    }

    // Check skill ID contains pattern
    if (skillId.toLowerCase().includes(pattern.toLowerCase())) {
      return true;
    }

    // Check subcategory alias
    const aliasedPath = SUBCATEGORY_ALIASES[pattern];
    if (aliasedPath && normalizedPath.includes(aliasedPath)) {
      return true;
    }
  }

  return false;
}

/**
 * Extract the category key from a skill path for grouping.
 *
 * @param skillPath - The skill's directory path (e.g., "skills/frontend/framework/react (@vince)/")
 * @returns The subcategory name (e.g., "framework")
 */
export function extractCategoryKey(skillPath: string): string {
  // Normalize path: remove "skills/" prefix and trailing slash
  const normalizedPath = skillPath.replace(/^skills\//, "").replace(/\/$/, "");

  // Path format: "frontend/framework/react (@vince)" or "backend/api/hono (@vince)"
  const parts = normalizedPath.split("/");
  // Return the second part (subcategory) if available, otherwise the first
  return parts.length >= 2 ? parts[1] : parts[0];
}
