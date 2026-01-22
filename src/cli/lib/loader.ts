import { parse as parseYaml } from 'yaml';
import path from 'path';
import { glob, readFile } from '../utils/fs';
import { verbose } from '../utils/logger';
import { DIRS } from '../consts';
import type {
  AgentDefinition,
  AgentYamlConfig,
  SkillDefinition,
  SkillFrontmatter,
  StackConfig,
} from '../types';

const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---/;

/**
 * Parse YAML frontmatter from a markdown file
 */
export function parseFrontmatter(content: string): SkillFrontmatter | null {
  const match = content.match(FRONTMATTER_REGEX);
  if (!match) return null;

  const yamlContent = match[1];
  const frontmatter = parseYaml(yamlContent) as SkillFrontmatter;

  if (!frontmatter.name || !frontmatter.description) return null;
  return frontmatter;
}

/**
 * Extract display name from skill ID
 * e.g., "frontend/react (@vince)" -> "React"
 */
function extractDisplayName(skillId: string): string {
  const withoutCategory = skillId.split('/').pop() || skillId;
  const withoutAuthor = withoutCategory.replace(/\s*\(@\w+\)$/, '').trim();
  return withoutAuthor
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Load all agents by scanning agent-sources/{agentId}/agent.yaml
 */
export async function loadAllAgents(
  projectRoot: string
): Promise<Record<string, AgentDefinition>> {
  const agents: Record<string, AgentDefinition> = {};
  const agentSourcesDir = path.join(projectRoot, DIRS.agents);

  const files = await glob('*/agent.yaml', agentSourcesDir);

  for (const file of files) {
    const fullPath = path.join(agentSourcesDir, file);
    const content = await readFile(fullPath);
    const config = parseYaml(content) as AgentYamlConfig;

    agents[config.id] = {
      title: config.title,
      description: config.description,
      model: config.model,
      tools: config.tools,
      output_format: config.output_format,
    };

    verbose(`Loaded agent: ${config.id} from ${file}`);
  }

  return agents;
}

/**
 * Load skills from a stack's embedded skills directory
 * Scans stacks/{stackId}/skills/**\/SKILL.md for Phase 1 architecture
 */
export async function loadStackSkills(
  stackId: string,
  projectRoot: string
): Promise<Record<string, SkillDefinition>> {
  const skills: Record<string, SkillDefinition> = {};
  const stackSkillsDir = path.join(projectRoot, DIRS.stacks, stackId, 'skills');

  const files = await glob('**/SKILL.md', stackSkillsDir);

  for (const file of files) {
    const fullPath = path.join(stackSkillsDir, file);
    const content = await readFile(fullPath);

    const frontmatter = parseFrontmatter(content);
    if (!frontmatter) {
      console.warn(`  Warning: Skipping ${file}: Missing or invalid frontmatter`);
      continue;
    }

    const folderPath = file.replace('/SKILL.md', '');
    // Path points to stack's embedded skill location (relative to src/)
    const skillPath = `stacks/${stackId}/skills/${folderPath}/`;
    const skillId = frontmatter.name;

    skills[skillId] = {
      path: skillPath,
      name: extractDisplayName(frontmatter.name),
      description: frontmatter.description,
    };

    verbose(`Loaded stack skill: ${skillId} from ${file}`);
  }

  return skills;
}

// Cache for loaded stacks
const stackCache = new Map<string, StackConfig>();

/**
 * Load a stack configuration from stacks/{stackId}/config.yaml
 */
export async function loadStack(
  stackId: string,
  projectRoot: string
): Promise<StackConfig> {
  const cached = stackCache.get(stackId);
  if (cached) return cached;

  const stackPath = path.join(projectRoot, DIRS.stacks, stackId, 'config.yaml');

  try {
    const content = await readFile(stackPath);
    const stack = parseYaml(content) as StackConfig;
    stackCache.set(stackId, stack);
    verbose(`Loaded stack: ${stack.name} (${stackId})`);
    return stack;
  } catch (error) {
    throw new Error(`Failed to load stack "${stackId}": ${error}`);
  }
}

