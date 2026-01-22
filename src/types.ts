/**
 * TypeScript types for the Stack-Based Agent Compilation System
 */

// =============================================================================
// Skill Types
// =============================================================================

/**
 * Skill definition from registry.yaml
 * Contains static metadata that doesn't change per-agent
 */
export interface SkillDefinition {
  path: string;
  name: string;
  description: string;
}

/**
 * Skill assignment in stack config.yaml
 * Specifies whether a skill should be preloaded (embedded) or dynamic (loaded via Skill tool)
 */
export interface SkillAssignment {
  id: string;
  preloaded?: boolean; // Default: false (dynamic)
}

/**
 * Skill reference in config.yaml (agent-specific)
 * References a skill by ID and provides context-specific usage
 */
export interface SkillReference {
  id: string;
  usage: string; // Context-specific description of when to use this skill
  preloaded?: boolean; // Whether skill content should be embedded in compiled agent
}

/**
 * Skills config from skills.yaml (deprecated - use RegistryConfig)
 */
export interface SkillsConfig {
  skills: Record<string, SkillDefinition>;
}

/**
 * Registry config from registry.yaml
 * Single source of truth for all agent and skill definitions
 */
export interface RegistryConfig {
  agents: Record<string, AgentDefinition>;
  skills: Record<string, SkillDefinition>;
}

/**
 * Fully resolved skill (merged from registry.yaml + config.yaml)
 * This is what the compiler uses after merging
 */
export interface Skill {
  id: string;
  path: string;
  name: string;
  description: string;
  usage: string;
  preloaded: boolean; // Whether skill is listed in frontmatter (Claude Code loads automatically)
}

// SkillAssignment removed - now using flat Skill[] array

// =============================================================================
// Agent Definition Types (from agents.yaml - single source of truth)
// =============================================================================

/**
 * Base agent definition from agents.yaml
 * Does NOT include skills or prompts - those are profile-specific
 */
export interface AgentDefinition {
  title: string;
  description: string;
  model?: string;
  tools: string[];
  output_format?: string; // Which output format file to use
  path?: string; // Relative path to agent directory (e.g., "developer/backend-developer")
}

/**
 * Top-level structure of agents.yaml
 */
export interface AgentsConfig {
  agents: Record<string, AgentDefinition>;
}

// =============================================================================
// Compile Config Types (agent-centric structure)
// =============================================================================

/**
 * Agent configuration for compilation
 * Contains prompts and skills for a specific agent
 */
export interface CompileAgentConfig {
  core_prompts: string[]; // Prompt names for beginning of agent
  ending_prompts: string[]; // Prompt names for end of agent
  skills?: SkillReference[]; // Optional - can come from stack
}

/**
 * Compile configuration (derived from stack)
 * Agents to compile are derived from the keys of `agents`
 */
export interface CompileConfig {
  name: string;
  description: string;
  claude_md: string;
  /** Stack reference - resolves stack skills for agents */
  stack?: string;
  agents: Record<string, CompileAgentConfig>; // Keys determine which agents to compile
}

// =============================================================================
// Resolved/Compiled Types (used during compilation)
// =============================================================================

/**
 * Fully resolved agent config (agent definition + compile config)
 * This is what the compiler uses after merging agent definitions with stack config
 */
export interface AgentConfig {
  name: string;
  title: string;
  description: string;
  model?: string;
  tools: string[];
  core_prompts: string[]; // Direct array of prompt names
  ending_prompts: string[]; // Direct array of prompt names
  output_format?: string;
  skills: Skill[]; // Unified skills list (loaded dynamically via Skill tool)
  path?: string; // Relative path to agent directory (e.g., "developer/backend-developer")
}

export interface CompiledAgentData {
  agent: AgentConfig;
  intro: string;
  workflow: string;
  examples: string;
  criticalRequirementsTop: string; // <critical_requirements> at TOP
  criticalReminders: string; // <critical_reminders> at BOTTOM
  corePromptNames: string[];
  corePromptsContent: string;
  outputFormat: string;
  endingPromptNames: string[];
  endingPromptsContent: string;
  skills: Skill[]; // Flat array of all skills
  preloadedSkills: Skill[]; // Skills with content embedded
  dynamicSkills: Skill[]; // Skills loaded via Skill tool (metadata only)
  preloadedSkillIds: string[]; // IDs for frontmatter and skill tool check
}

// =============================================================================
// Validation Types
// =============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// =============================================================================
// Stack Types
// =============================================================================

/**
 * Stack configuration from stacks/{stack-id}/config.yaml
 * Bundles framework, skills, agents, and philosophy into a single config
 */
export interface StackConfig {
  id?: string;
  name: string;
  version: string;
  author: string;
  description?: string;
  created?: string;
  updated?: string;
  framework?: string;
  /** Array of skill assignments with preloaded flag */
  skills: SkillAssignment[];
  /** List of agent names this stack supports */
  agents: string[];
  /** Per-agent skill assignments - maps agent name to categories, each with array of skill assignments */
  agent_skills?: Record<string, Record<string, SkillAssignment[]>>;
  philosophy?: string;
  principles?: string[];
  tags?: string[];
  overrides?: Record<string, StackOverrideRule>;
  metrics?: StackMetrics;
}

export interface StackOverrideRule {
  alternatives?: string[];
  locked?: boolean;
}

export interface StackMetrics {
  upvotes?: number;
  downloads?: number;
}

// =============================================================================
// Co-located Config Types (Phase 0A - replaces registry.yaml)
// =============================================================================

/**
 * Agent configuration from agent.yaml (co-located in each agent folder)
 */
export interface AgentYamlConfig {
  id: string;
  title: string;
  description: string;
  model?: string;
  tools: string[];
  output_format?: string;
}

/**
 * Skill configuration from skill.yaml (co-located in each skill folder)
 * @deprecated Use SkillMetadataConfig + SKILL.md frontmatter instead (Phase 0B)
 */
export interface SkillYamlConfig {
  id: string;
  name: string;
  description: string;
  category?: string;
  category_exclusive?: boolean;
  author?: string;
  version?: string;
  tags?: string[];
}

// =============================================================================
// Phase 0B: SKILL.md as Source of Truth
// =============================================================================

/**
 * SKILL.md frontmatter - the single source of truth for skill identity
 * Contains: name (IS the identifier), description, optional model
 */
export interface SkillFrontmatter {
  /** The skill identifier (e.g., "frontend/react (@vince)") - must be unique */
  name: string;
  /** Brief description of what this skill teaches */
  description: string;
  /** Optional: which AI model to use for this skill */
  model?: string;
}

/**
 * metadata.yaml - relationship and catalog data for skills
 * Identity (name, description) comes from SKILL.md frontmatter
 */
export interface SkillMetadataConfig {
  category?: string;
  category_exclusive?: boolean;
  author?: string;
  version?: string;
  tags?: string[];
  requires?: string[];
  compatible_with?: string[];
  conflicts_with?: string[];
}
