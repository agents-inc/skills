/**
 * TypeScript types for the Profile-Based Agent Compilation System
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
 * Skill reference in config.yaml (agent-specific)
 * References a skill by ID and provides context-specific usage
 */
export interface SkillReference {
  id: string;
  usage: string; // Context-specific description of when to use this skill
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
  content?: string; // Populated at compile time for precompiled skills
}

export interface SkillAssignment {
  precompiled: Skill[];
  dynamic: Skill[];
}

/**
 * Skill assignment in config.yaml (before resolution)
 * Contains references, not full skills
 */
export interface SkillReferenceAssignment {
  precompiled: SkillReference[];
  dynamic: SkillReference[];
}

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
  output_format: string; // Which output format file to use
}

/**
 * Top-level structure of agents.yaml
 */
export interface AgentsConfig {
  agents: Record<string, AgentDefinition>;
}

// =============================================================================
// Profile Config Types (agent-centric structure)
// =============================================================================

/**
 * Profile-specific agent configuration
 * Contains prompts and skills for a specific agent in this profile
 */
export interface ProfileAgentConfig {
  core_prompts: string[]; // Prompt names for beginning of agent
  ending_prompts: string[]; // Prompt names for end of agent
  precompiled: SkillReference[]; // Skills compiled into agent
  dynamic: SkillReference[]; // Skills loaded dynamically
}

/**
 * Profile configuration
 * Agents to compile are derived from the keys of `agents`
 */
export interface ProfileConfig {
  name: string;
  description: string;
  claude_md: string;
  agents: Record<string, ProfileAgentConfig>; // Keys determine which agents to compile
}

// =============================================================================
// Resolved/Compiled Types (used during compilation)
// =============================================================================

/**
 * Fully resolved agent config (agent definition + profile config)
 * This is what the compiler uses after merging agents.yaml with profile config
 */
export interface AgentConfig {
  name: string;
  title: string;
  description: string;
  model?: string;
  tools: string[];
  core_prompts: string[]; // Direct array of prompt names
  ending_prompts: string[]; // Direct array of prompt names
  output_format: string;
  skills: SkillAssignment;
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
  skills: SkillAssignment;
}

// =============================================================================
// Validation Types
// =============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
