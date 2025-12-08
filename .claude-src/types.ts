/**
 * TypeScript types for the Profile-Based Agent Compilation System
 */

// =============================================================================
// Skill Types
// =============================================================================

/**
 * Skill definition from skills.yaml (single source of truth)
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
 * Skills config from skills.yaml
 */
export interface SkillsConfig {
  skills: Record<string, SkillDefinition>;
}

/**
 * Fully resolved skill (merged from skills.yaml + config.yaml)
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
 * Does NOT include skills - those are profile-specific
 */
export interface AgentDefinition {
  title: string;
  description: string;
  model?: string;
  tools: string[];
  core_prompts: string; // Key into core_prompt_sets (beginning prompts)
  ending_prompts: string; // Key into ending_prompt_sets (end prompts)
  output_format: string; // Which output format file to use
}

/**
 * Top-level structure of agents.yaml
 */
export interface AgentsConfig {
  agents: Record<string, AgentDefinition>;
}

// =============================================================================
// Profile Config Types (simplified - references agents by name)
// =============================================================================

/**
 * Simplified profile configuration
 * No longer contains full agent definitions - references agents.yaml instead
 * Agents to compile are derived from the keys of agent_skills
 */
export interface ProfileConfig {
  name: string;
  description: string;
  claude_md: string;
  core_prompt_sets: Record<string, string[]>;
  ending_prompt_sets: Record<string, string[]>;
  agent_skills: Record<string, SkillReferenceAssignment>; // Keys determine which agents to compile
}

// =============================================================================
// Resolved/Compiled Types (used during compilation)
// =============================================================================

/**
 * Fully resolved agent config (agent definition + profile skills)
 * This is what the compiler uses after merging agents.yaml with profile config
 */
export interface AgentConfig {
  name: string;
  title: string;
  description: string;
  model?: string;
  tools: string[];
  core_prompts: string;
  ending_prompts: string;
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
