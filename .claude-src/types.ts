/**
 * TypeScript types for the Profile-Based Agent Compilation System
 */

export interface Skill {
  id: string;
  path?: string;
  name: string;
  description: string;
  usage: string; // Required for dynamic skills - describes when to invoke
  content?: string; // Populated at compile time for precompiled skills
}

export interface AgentConfig {
  name: string;
  title: string;
  description: string;
  model?: string;
  tools: string[];
  core_prompts: string; // Key into core_prompt_sets (beginning prompts)
  ending_prompts: string; // Key into ending_prompt_sets (end prompts)
  output_format: string; // Which output format file to use
  skills: {
    precompiled: Skill[];
    dynamic: Skill[];
  };
}

export interface ProfileConfig {
  name: string;
  description: string;
  claude_md: string;
  core_prompt_sets: Record<string, string[]>;
  ending_prompt_sets: Record<string, string[]>;
  agents: Record<string, AgentConfig>;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
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
  skills: {
    precompiled: Skill[];
    dynamic: Skill[];
  };
}
