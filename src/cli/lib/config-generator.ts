/**
 * Config Generator
 *
 * Generates a StackConfig from manually selected skills.
 * Uses skill-agent-mappings to assign skills to appropriate agents.
 *
 * This allows users who don't select a pre-built stack to still get
 * properly configured agent-skill assignments.
 */

import type { StackConfig, SkillAssignment } from "../../types";
import type { ResolvedSkill, MergedSkillsMatrix } from "../types-matrix";
import {
  getAgentsForSkill,
  shouldPreloadSkill,
  extractCategoryKey,
} from "./skill-agent-mappings";

/**
 * Plugin name constant
 */
const PLUGIN_NAME = "claude-collective";

/**
 * Default version for generated configs
 */
const DEFAULT_VERSION = "1.0.0";

/**
 * Default author for generated configs
 */
const DEFAULT_AUTHOR = "@user";

/**
 * Generate a StackConfig from manually selected skills.
 *
 * This function:
 * 1. Maps each selected skill to appropriate agents based on category
 * 2. Determines which skills should be preloaded for each agent
 * 3. Groups skills by category within each agent's assignment
 * 4. Returns a complete StackConfig that can be serialized to YAML
 *
 * @param selectedSkillIds - Array of selected skill IDs (full IDs with author)
 * @param matrix - The merged skills matrix containing skill metadata
 * @returns A complete StackConfig object
 */
export function generateConfigFromSkills(
  selectedSkillIds: string[],
  matrix: MergedSkillsMatrix,
): StackConfig {
  // Build agent_skills map: Record<agentId, Record<category, SkillAssignment[]>>
  const agentSkills: Record<string, Record<string, SkillAssignment[]>> = {};

  // Track which agents are needed
  const neededAgents = new Set<string>();

  // Process each selected skill
  for (const skillId of selectedSkillIds) {
    const skill = matrix.skills[skillId];
    if (!skill) {
      continue; // Skip unknown skills
    }

    // Get the skill's path and category
    const skillPath = skill.path;
    const category = skill.category;

    // Find which agents should receive this skill
    const agents = getAgentsForSkill(skillPath, category);

    // Get the category key for grouping
    const categoryKey = extractCategoryKey(skillPath);

    // Assign skill to each agent
    for (const agentId of agents) {
      neededAgents.add(agentId);

      // Initialize agent's skill map if needed
      if (!agentSkills[agentId]) {
        agentSkills[agentId] = {};
      }

      // Initialize category array if needed
      if (!agentSkills[agentId][categoryKey]) {
        agentSkills[agentId][categoryKey] = [];
      }

      // Determine if this skill should be preloaded for this agent
      const isPreloaded = shouldPreloadSkill(
        skillPath,
        skillId,
        category,
        agentId,
      );

      // Add the skill assignment
      const assignment: SkillAssignment = { id: skillId };
      if (isPreloaded) {
        assignment.preloaded = true;
      }

      agentSkills[agentId][categoryKey].push(assignment);
    }
  }

  // Build the skills array (flat list of all selected skills)
  // For local skills, include the local flag and path
  const skills: SkillAssignment[] = selectedSkillIds.map((id) => {
    const skill = matrix.skills[id];
    if (skill?.local && skill?.localPath) {
      return {
        id,
        local: true,
        path: skill.localPath,
      };
    }
    return { id };
  });

  // Build the config
  const config: StackConfig = {
    name: PLUGIN_NAME,
    version: DEFAULT_VERSION,
    author: DEFAULT_AUTHOR,
    description: `Custom plugin with ${selectedSkillIds.length} skills`,
    skills,
    agents: Array.from(neededAgents).sort(),
    agent_skills: agentSkills,
  };

  return config;
}

/**
 * Generate a StackConfig from a selected stack template.
 *
 * This preserves the stack's original agent_skills assignments
 * while ensuring the config format is consistent.
 *
 * @param stackConfig - The loaded stack configuration
 * @returns A StackConfig with consistent format
 */
export function generateConfigFromStack(stackConfig: StackConfig): StackConfig {
  // Return a copy with consistent structure
  return {
    name: PLUGIN_NAME,
    version: stackConfig.version || DEFAULT_VERSION,
    author: stackConfig.author || DEFAULT_AUTHOR,
    description: stackConfig.description,
    framework: stackConfig.framework,
    skills: stackConfig.skills,
    agents: stackConfig.agents,
    agent_skills: stackConfig.agent_skills,
    hooks: stackConfig.hooks,
    philosophy: stackConfig.philosophy,
    principles: stackConfig.principles,
    tags: stackConfig.tags,
  };
}

/**
 * Merge user-selected skills with a stack's base configuration.
 *
 * If the user starts with a stack template but then modifies skills,
 * this function merges the changes while preserving stack defaults.
 *
 * @param baseStackConfig - The original stack configuration
 * @param selectedSkillIds - The user's current skill selection
 * @param matrix - The merged skills matrix
 * @returns A merged StackConfig
 */
export function mergeStackWithSkills(
  baseStackConfig: StackConfig,
  selectedSkillIds: string[],
  matrix: MergedSkillsMatrix,
): StackConfig {
  // Get base skills from stack
  const baseSkillIds = new Set(baseStackConfig.skills.map((s) => s.id));
  const selectedSet = new Set(selectedSkillIds);

  // Find added and removed skills
  const addedSkills = selectedSkillIds.filter((id) => !baseSkillIds.has(id));
  const removedSkills = [...baseSkillIds].filter((id) => !selectedSet.has(id));

  // If no changes, return the base config
  if (addedSkills.length === 0 && removedSkills.length === 0) {
    return generateConfigFromStack(baseStackConfig);
  }

  // Start with the base config
  const config = generateConfigFromStack(baseStackConfig);

  // Update the skills array (handle local skills with extra fields)
  config.skills = selectedSkillIds.map((id) => {
    const skill = matrix.skills[id];
    if (skill?.local && skill?.localPath) {
      return {
        id,
        local: true,
        path: skill.localPath,
      };
    }
    return { id };
  });

  // Add new skills to agent_skills
  if (addedSkills.length > 0 && config.agent_skills) {
    for (const skillId of addedSkills) {
      const skill = matrix.skills[skillId];
      if (!skill) continue;

      const skillPath = skill.path;
      const category = skill.category;
      const categoryKey = extractCategoryKey(skillPath);
      const agents = getAgentsForSkill(skillPath, category);

      for (const agentId of agents) {
        if (!config.agent_skills[agentId]) {
          config.agent_skills[agentId] = {};
        }
        if (!config.agent_skills[agentId][categoryKey]) {
          config.agent_skills[agentId][categoryKey] = [];
        }

        const isPreloaded = shouldPreloadSkill(
          skillPath,
          skillId,
          category,
          agentId,
        );
        const assignment: SkillAssignment = { id: skillId };
        if (isPreloaded) {
          assignment.preloaded = true;
        }

        config.agent_skills[agentId][categoryKey].push(assignment);
      }
    }
  }

  // Remove skills from agent_skills
  if (removedSkills.length > 0 && config.agent_skills) {
    const removedSet = new Set(removedSkills);
    for (const agentId of Object.keys(config.agent_skills)) {
      for (const categoryKey of Object.keys(config.agent_skills[agentId])) {
        config.agent_skills[agentId][categoryKey] = config.agent_skills[
          agentId
        ][categoryKey].filter((s) => !removedSet.has(s.id));

        // Clean up empty categories
        if (config.agent_skills[agentId][categoryKey].length === 0) {
          delete config.agent_skills[agentId][categoryKey];
        }
      }

      // Clean up empty agents
      if (Object.keys(config.agent_skills[agentId]).length === 0) {
        delete config.agent_skills[agentId];
      }
    }
  }

  // Update description to reflect customization
  config.description = `Custom plugin based on ${baseStackConfig.name} with ${selectedSkillIds.length} skills`;

  return config;
}
