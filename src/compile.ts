#!/usr/bin/env bun
/**
 * Profile-Based Agent Compilation System
 *
 * Hybrid TypeScript + LiquidJS compilation:
 * - TypeScript handles file reading, path resolution, template composition, and validation
 * - LiquidJS handles simple variable interpolation and loops within templates
 *
 * Architecture (Phase 0B - SKILL.md as Source of Truth):
 * - agent.yaml: Co-located in each agent folder (src/agent-sources/{agent}/agent.yaml)
 * - SKILL.md: Single source of truth for skill identity (name, description, model)
 * - metadata.yaml: Relationship/catalog data (category, tags, requires, conflicts, etc.)
 * - profiles/{profile}/config.yaml: Agent-centric config with prompts and skills per agent
 *
 * Usage:
 *   bun src/compile.ts --profile=home
 *   bun src/compile.ts --profile=work --verbose
 *   bun src/compile.ts --stack=modern-react
 *   bun src/compile.ts --stack=home-stack --verbose
 */

import { Liquid } from "liquidjs";
import { parse as parseYaml } from "yaml";
import type {
  AgentConfig,
  AgentDefinition,
  AgentYamlConfig,
  CompiledAgentData,
  ProfileConfig,
  ProfileAgentConfig,
  Skill,
  SkillDefinition,
  SkillReference,
  SkillMetadataConfig,
  StackConfig,
  ValidationResult,
} from "./types";

// =============================================================================
// Configuration
// =============================================================================

const PROFILE =
  Bun.argv.find((a) => a.startsWith("--profile="))?.split("=")[1] ?? "home";
const STACK =
  Bun.argv.find((a) => a.startsWith("--stack="))?.split("=")[1];
const VERBOSE = Bun.argv.includes("--verbose");
const ROOT = import.meta.dir;
const OUT = `${ROOT}/../.claude`;

// =============================================================================
// LiquidJS Setup (minimal - just for final template rendering)
// =============================================================================

const engine = new Liquid({
  root: [`${ROOT}/templates`],
  extname: ".liquid",
  strictVariables: false, // Allow undefined variables (for optional content)
  strictFilters: true, // Fail on undefined filters
});

// =============================================================================
// File Reading Utilities
// =============================================================================

async function readFile(path: string): Promise<string> {
  const file = Bun.file(path);
  if (!(await file.exists())) {
    throw new Error(`File not found: ${path}`);
  }
  return file.text();
}

async function readFileOptional(path: string, fallback = ""): Promise<string> {
  const file = Bun.file(path);
  if (!(await file.exists())) {
    return fallback;
  }
  return file.text();
}

async function fileExists(path: string): Promise<boolean> {
  const file = Bun.file(path);
  return file.exists();
}

function log(message: string): void {
  if (VERBOSE) {
    console.log(`  ${message}`);
  }
}

// =============================================================================
// Frontmatter Parser (Phase 0B - SKILL.md as source of truth)
// =============================================================================

interface SkillFrontmatter {
  name: string;
  description: string;
  model?: string;
}

/**
 * Parse YAML frontmatter from a markdown file
 * Frontmatter is enclosed between --- markers at the start of the file
 */
function parseFrontmatter(content: string): SkillFrontmatter | null {
  const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---/;
  const match = content.match(FRONTMATTER_REGEX);

  if (!match) {
    return null;
  }

  const yamlContent = match[1];
  const frontmatter = parseYaml(yamlContent) as SkillFrontmatter;

  if (!frontmatter.name || !frontmatter.description) {
    return null;
  }

  return frontmatter;
}

// =============================================================================
// Directory Scanning (Phase 0A - replaces registry.yaml)
// =============================================================================

/**
 * Load all agents by scanning src/agent-sources/{agentId}/agent.yaml
 * Returns a map of agent ID to AgentDefinition (same structure as registry.yaml)
 */
async function loadAllAgents(): Promise<Record<string, AgentDefinition>> {
  const agents: Record<string, AgentDefinition> = {};
  const glob = new Bun.Glob("*/agent.yaml");
  const agentSourcesDir = `${ROOT}/agent-sources`;

  for await (const path of glob.scan({ cwd: agentSourcesDir })) {
    const fullPath = `${agentSourcesDir}/${path}`;
    const content = await readFile(fullPath);
    const config = parseYaml(content) as AgentYamlConfig;

    // Convert to AgentDefinition format (matching registry.yaml structure)
    agents[config.id] = {
      title: config.title,
      description: config.description,
      model: config.model,
      tools: config.tools,
      output_format: config.output_format,
    };

    log(`Loaded agent: ${config.id} from ${path}`);
  }

  return agents;
}

/**
 * Load all skills by scanning src/skills/{category}/{subcategory}/{skillId}/SKILL.md
 * Phase 0B: SKILL.md frontmatter is the single source of truth for skill identity
 * Returns a map of skill ID to SkillDefinition
 */
async function loadAllSkills(): Promise<Record<string, SkillDefinition>> {
  const skills: Record<string, SkillDefinition> = {};
  const glob = new Bun.Glob("**/SKILL.md");
  const skillsDir = `${ROOT}/skills`;

  for await (const path of glob.scan({ cwd: skillsDir })) {
    const fullPath = `${skillsDir}/${path}`;
    const content = await readFile(fullPath);

    // Phase 0B: Parse frontmatter from SKILL.md for identity
    const frontmatter = parseFrontmatter(content);
    if (!frontmatter) {
      console.warn(`  ⚠️  Skipping ${path}: Missing or invalid frontmatter (requires name and description)`);
      continue;
    }

    // Derive path from file location (relative to src/)
    // path is like "frontend/styling/scss-modules (@vince)/SKILL.md"
    // We want "skills/frontend/styling/scss-modules (@vince)/"
    const folderPath = path.replace("/SKILL.md", "");
    const skillPath = `skills/${folderPath}/`;

    // The skill ID comes from the frontmatter name field
    // e.g., "frontend/react (@vince)" or "backend/hono (@vince)"
    const skillId = frontmatter.name;

    // Convert to SkillDefinition format
    skills[skillId] = {
      path: skillPath,
      name: extractDisplayName(frontmatter.name),
      description: frontmatter.description,
    };

    log(`Loaded skill: ${skillId} from ${path}`);
  }

  return skills;
}

/**
 * Extract display name from skill ID
 * e.g., "frontend/react (@vince)" -> "React"
 * e.g., "backend/hono (@vince)" -> "Hono"
 */
function extractDisplayName(skillId: string): string {
  // Remove category prefix and author suffix
  // "frontend/react (@vince)" -> "react"
  const withoutCategory = skillId.split("/").pop() || skillId;
  const withoutAuthor = withoutCategory.replace(/\s*\(@\w+\)$/, "").trim();

  // Capitalize first letter of each word
  return withoutAuthor
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// =============================================================================
// Skill Resolution
// =============================================================================

function resolveSkillReference(
  ref: SkillReference,
  skills: Record<string, SkillDefinition>
): Skill {
  const definition = skills[ref.id];
  if (!definition) {
    throw new Error(`Skill "${ref.id}" not found in scanned skills`);
  }
  return {
    id: ref.id,
    path: definition.path,
    name: definition.name,
    description: definition.description,
    usage: ref.usage,
  };
}

function resolveSkillReferences(
  skillRefs: SkillReference[],
  skills: Record<string, SkillDefinition>
): Skill[] {
  return skillRefs.map((ref) => resolveSkillReference(ref, skills));
}

// =============================================================================
// Stack Resolution (resolve stack skills to skill references)
// =============================================================================

/** Cache for loaded stacks to avoid re-reading files */
const stackCache = new Map<string, StackConfig>();

/**
 * Load a stack configuration from src/stacks/{stackId}.yaml
 */
async function loadStack(stackId: string): Promise<StackConfig> {
  // Check cache first
  const cached = stackCache.get(stackId);
  if (cached) {
    return cached;
  }

  const stackPath = `${ROOT}/stacks/${stackId}/config.yaml`;
  try {
    const content = await readFile(stackPath);
    const stack = parseYaml(content) as StackConfig;
    stackCache.set(stackId, stack);
    log(`Loaded stack: ${stack.name} (${stackId})`);
    return stack;
  } catch (error) {
    throw new Error(`Failed to load stack "${stackId}": ${error}`);
  }
}

/**
 * Convert a stack config to a profile-like config for compilation
 * Stack mode: all agents get all stack skills, no explicit prompts
 */
function stackToProfileConfig(stackId: string, stack: StackConfig): ProfileConfig {
  // Build agent configs - each agent gets all stack skills
  const agents: Record<string, ProfileAgentConfig> = {};

  for (const agentId of stack.agents) {
    agents[agentId] = {
      core_prompts: ["core-principles", "investigation-requirement", "write-verification", "anti-over-engineering"],
      ending_prompts: ["context-management", "improvement-protocol"],
      // Skills come from stack, not explicit here
    };
  }

  return {
    name: stack.name,
    description: stack.description || "",
    claude_md: "", // Will use stack's CLAUDE.md via cascade
    stack: stackId, // Reference to self for skill resolution
    agents,
  };
}

/**
 * Resolve agent template with cascade: Profile -> Stack -> Default
 */
async function resolveTemplate(profile: string, stack: string | undefined): Promise<string> {
  // 1. Profile-specific template
  const profileTemplate = `${ROOT}/profiles/${profile}/agent.liquid`;
  if (await fileExists(profileTemplate)) return profileTemplate;

  // 2. Stack-specific template (if stack defined)
  if (stack) {
    const stackTemplate = `${ROOT}/stacks/${stack}/agent.liquid`;
    if (await fileExists(stackTemplate)) return stackTemplate;
  }

  // 3. Default template
  return `${ROOT}/templates/agent.liquid`;
}

/**
 * Resolve CLAUDE.md with cascade: Profile -> Stack
 */
async function resolveClaudeMd(profile: string, stack: string | undefined): Promise<string> {
  // 1. Profile-specific CLAUDE.md
  const profileClaude = `${ROOT}/profiles/${profile}/CLAUDE.md`;
  if (await fileExists(profileClaude)) return profileClaude;

  // 2. Stack-specific CLAUDE.md (if stack defined)
  if (stack) {
    const stackClaude = `${ROOT}/stacks/${stack}/CLAUDE.md`;
    if (await fileExists(stackClaude)) return stackClaude;
  }

  throw new Error(`No CLAUDE.md found for profile ${profile}${stack ? ` or stack ${stack}` : ""}`);
}

/**
 * Resolve a stack's skills to skill references for a specific agent
 * If stack.agent_skills[agentName] exists, use those; otherwise fall back to all stack skills
 * Returns: SkillReference[] with generic usage descriptions
 */
function resolveStackSkills(
  stack: StackConfig,
  agentName: string,
  skills: Record<string, SkillDefinition>
): SkillReference[] {
  const skillRefs: SkillReference[] = [];

  // Use per-agent skills if defined, otherwise fall back to all stack skills
  const agentSkillIds = stack.agent_skills?.[agentName] ?? stack.skills;

  for (const skillId of agentSkillIds) {
    // Validate skill exists
    if (!skills[skillId]) {
      throw new Error(
        `Stack "${stack.name}" references skill "${skillId}" for agent "${agentName}" not found in scanned skills`
      );
    }

    // Validate skill is in stack's skill list (if using per-agent skills)
    if (stack.agent_skills?.[agentName] && !stack.skills.includes(skillId)) {
      throw new Error(
        `Stack "${stack.name}" agent_skills for "${agentName}" includes skill "${skillId}" not in stack's skills array`
      );
    }

    const skillDef = skills[skillId];
    skillRefs.push({
      id: skillId,
      usage: `when working with ${skillDef.name.toLowerCase()}`,
    });
  }

  return skillRefs;
}

/**
 * Get skills for an agent, preferring explicit skills over stack skills
 * If agent has explicit skills, use those; otherwise use stack skills
 */
async function getAgentSkills(
  agentName: string,
  profileAgentConfig: ProfileAgentConfig,
  profileConfig: ProfileConfig,
  skills: Record<string, SkillDefinition>
): Promise<SkillReference[]> {
  // If agent has explicit skills defined, use those
  if (profileAgentConfig.skills && profileAgentConfig.skills.length > 0) {
    return profileAgentConfig.skills;
  }

  // If profile has a stack and agent has no explicit skills, resolve from stack
  if (profileConfig.stack) {
    console.log(`  📦 Resolving skills from stack "${profileConfig.stack}" for ${agentName}`);
    const stack = await loadStack(profileConfig.stack);
    return resolveStackSkills(stack, agentName, skills);
  }

  // No skills defined and no stack - return empty array
  return [];
}

// =============================================================================
// Agent Resolution (merge scanned agents + profile config)
// =============================================================================

async function resolveAgents(
  agents: Record<string, AgentDefinition>,
  skills: Record<string, SkillDefinition>,
  profileConfig: ProfileConfig
): Promise<Record<string, AgentConfig>> {
  const resolved: Record<string, AgentConfig> = {};

  // Derive agents to compile from profile agents keys
  const agentNames = Object.keys(profileConfig.agents);

  for (const agentName of agentNames) {
    const definition = agents[agentName];
    if (!definition) {
      throw new Error(
        `Agent "${agentName}" in profile config but not found in scanned agents`
      );
    }

    // Get profile-specific agent config
    const profileAgentConfig = profileConfig.agents[agentName];

    // Get skills (from explicit config or stack)
    const skillRefs = await getAgentSkills(
      agentName,
      profileAgentConfig,
      profileConfig,
      skills
    );

    // Resolve skill references to full skill objects
    const resolvedSkills = resolveSkillReferences(skillRefs, skills);

    // Merge definition with profile config
    resolved[agentName] = {
      name: agentName,
      title: definition.title,
      description: definition.description,
      model: definition.model,
      tools: definition.tools,
      core_prompts: profileAgentConfig.core_prompts,
      ending_prompts: profileAgentConfig.ending_prompts,
      output_format: definition.output_format,
      skills: resolvedSkills,
    };
  }

  return resolved;
}

// =============================================================================
// Validation
// =============================================================================

async function validate(
  profileConfig: ProfileConfig,
  resolvedAgents: Record<string, AgentConfig>,
  profileId: string | undefined,
  stackId: string | undefined
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check CLAUDE.md (using cascade: profile -> stack, or direct stack in stack mode)
  try {
    if (!profileId && stackId) {
      // Stack mode - check stack's CLAUDE.md directly
      const stackClaude = `${ROOT}/stacks/${stackId}/CLAUDE.md`;
      if (!(await fileExists(stackClaude))) {
        throw new Error("Stack CLAUDE.md not found");
      }
    } else if (profileId) {
      // Profile mode - use cascade
      await resolveClaudeMd(profileId, profileConfig.stack);
    }
  } catch {
    const location = profileId ? `profile "${profileId}"` : `stack "${stackId}"`;
    errors.push(`CLAUDE.md not found in ${location}${profileConfig.stack && profileId ? ` or stack "${profileConfig.stack}"` : ""}`);
  }

  // Check core prompts directory exists
  const corePromptsDir = `${ROOT}/core-prompts`;
  if (!(await Bun.file(`${corePromptsDir}/core-principles.md`).exists())) {
    errors.push(`Core prompts directory missing or empty: ${corePromptsDir}`);
  }

  // Collect all prompt names for validation
  const allPromptNames = new Set<string>();

  // Check each resolved agent
  for (const [name, agent] of Object.entries(resolvedAgents)) {
    const agentDir = `${ROOT}/agent-sources/${name}`;

    // Required agent files
    const requiredFiles = ["intro.md", "workflow.md"];
    for (const file of requiredFiles) {
      if (!(await Bun.file(`${agentDir}/${file}`).exists())) {
        errors.push(`Missing ${file} for agent: ${name}`);
      }
    }

    // Optional agent files (warn if missing)
    const optionalFiles = [
      "examples.md",
      "critical-requirements.md",
      "critical-reminders.md",
    ];
    for (const file of optionalFiles) {
      if (!(await Bun.file(`${agentDir}/${file}`).exists())) {
        warnings.push(`Optional file missing for ${name}: ${file}`);
      }
    }

    // Collect prompt names from this agent
    agent.core_prompts.forEach((p) => allPromptNames.add(p));
    agent.ending_prompts.forEach((p) => allPromptNames.add(p));

    // Check skill paths (unified - all skills loaded dynamically)
    for (const skill of agent.skills) {
      if (!skill.path) {
        warnings.push(
          `Skill missing path (won't be compiled): ${skill.id} (agent: ${name})`
        );
        continue;
      }
      // Skills are now in central src/skills/ directory
      const basePath = `${ROOT}/${skill.path}`;
      const isFolder = skill.path.endsWith("/");

      if (isFolder) {
        // Folder-based skill: check for SKILL.md inside the folder
        const skillFile = `${basePath}SKILL.md`;
        if (!(await Bun.file(skillFile).exists())) {
          errors.push(`Skill folder missing SKILL.md: ${skill.path}SKILL.md (agent: ${name})`);
        }
      } else {
        // Legacy: single file skill
        if (!(await Bun.file(basePath).exists())) {
          errors.push(`Skill file not found: ${skill.path} (agent: ${name})`);
        }
      }
    }
  }

  // Check all prompt files exist
  for (const prompt of allPromptNames) {
    const promptPath = `${ROOT}/core-prompts/${prompt}.md`;
    if (!(await Bun.file(promptPath).exists())) {
      errors.push(`Core prompt not found: ${prompt}.md`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// =============================================================================
// Agent Compilation
// =============================================================================

async function readCorePrompts(promptNames: string[]): Promise<string> {
  const contents: string[] = [];
  for (const name of promptNames) {
    const content = await readFile(`${ROOT}/core-prompts/${name}.md`);
    contents.push(content);
  }
  return contents.join("\n\n---\n\n");
}


async function compileAgent(
  name: string,
  agent: AgentConfig,
  config: ProfileConfig
): Promise<string> {
  log(`Reading agent files for ${name}...`);

  // Read agent-specific files
  const agentDir = `${ROOT}/agent-sources/${name}`;
  const intro = await readFile(`${agentDir}/intro.md`);
  const workflow = await readFile(`${agentDir}/workflow.md`);
  const examples = await readFileOptional(
    `${agentDir}/examples.md`,
    "## Examples\n\n_No examples defined._"
  );
  const criticalRequirementsTop = await readFileOptional(
    `${agentDir}/critical-requirements.md`,
    ""
  );
  const criticalReminders = await readFileOptional(
    `${agentDir}/critical-reminders.md`,
    ""
  );

  // Read core prompts for this agent (directly from agent config)
  const corePromptsContent = await readCorePrompts(agent.core_prompts);

  // Read output format
  const outputFormat = await readFileOptional(
    `${ROOT}/agent-outputs/${agent.output_format}.md`,
    ""
  );

  // Read ending prompts for this agent (directly from agent config)
  const endingPromptsContent = await readCorePrompts(agent.ending_prompts);

  // Skills are already a flat array (metadata only, no content embedding)
  const allSkills = agent.skills;

  // Format prompt names for display
  const formatPromptName = (n: string) =>
    n.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

  const formattedCorePromptNames = agent.core_prompts.map(formatPromptName);
  const formattedEndingPromptNames = agent.ending_prompts.map(formatPromptName);

  // Prepare template data
  const data: CompiledAgentData = {
    agent,
    intro,
    workflow,
    examples,
    criticalRequirementsTop,
    criticalReminders,
    corePromptNames: formattedCorePromptNames,
    corePromptsContent,
    outputFormat,
    endingPromptNames: formattedEndingPromptNames,
    endingPromptsContent,
    skills: allSkills, // Flat array of all skills (metadata only)
  };

  // Render with LiquidJS
  log(`Rendering template for ${name}...`);
  return engine.renderFile("agent", data);
}

async function compileAllAgents(
  resolvedAgents: Record<string, AgentConfig>,
  config: ProfileConfig
): Promise<void> {
  await Bun.$`mkdir -p ${OUT}/agents`;

  for (const [name, agent] of Object.entries(resolvedAgents)) {
    try {
      const output = await compileAgent(name, agent, config);
      await Bun.write(`${OUT}/agents/${name}.md`, output);
      console.log(`  ✓ ${name}.md`);
    } catch (error) {
      console.error(`  ✗ ${name}.md - ${error}`);
      throw error;
    }
  }
}

// =============================================================================
// Skills Compilation
// =============================================================================

// Optional supporting files to copy from skill folders
const SKILL_SUPPORTING_FILES = ["examples.md", "reference.md"];

async function compileAllSkills(
  resolvedAgents: Record<string, AgentConfig>
): Promise<void> {
  // Collect all unique skills with paths
  const allSkills = Object.values(resolvedAgents)
    .flatMap((a) => a.skills)
    .filter((s) => s.path);

  const uniqueSkills = [...new Map(allSkills.map((s) => [s.id, s])).values()];

  for (const skill of uniqueSkills) {
    const id = skill.id.replace("/", "-");
    const outDir = `${OUT}/skills/${id}`;
    await Bun.$`mkdir -p ${outDir}`;

    // Skills are now in central src/skills/ directory
    const sourcePath = `${ROOT}/${skill.path}`;
    const isFolder = skill.path.endsWith("/");

    try {
      if (isFolder) {
        // Folder-based skill: read SKILL.md and copy to output
        const mainContent = await readFile(`${sourcePath}SKILL.md`);
        await Bun.write(`${outDir}/SKILL.md`, mainContent);
        console.log(`  ✓ skills/${id}/SKILL.md`);

        // Copy optional supporting files
        for (const file of SKILL_SUPPORTING_FILES) {
          const supportingContent = await readFileOptional(`${sourcePath}${file}`);
          if (supportingContent) {
            await Bun.write(`${outDir}/${file}`, supportingContent);
            console.log(`  ✓ skills/${id}/${file}`);
          }
        }

        // Copy scripts directory if exists
        const scriptsDir = `${sourcePath}scripts`;
        if (await Bun.file(`${scriptsDir}/`).exists()) {
          await Bun.$`cp -r ${scriptsDir} ${outDir}/`;
          console.log(`  ✓ skills/${id}/scripts/`);
        }
      } else {
        // Legacy: single file skill
        const content = await readFile(sourcePath);
        await Bun.write(`${outDir}/SKILL.md`, content);
        console.log(`  ✓ skills/${id}/SKILL.md`);
      }
    } catch (error) {
      console.error(`  ✗ skills/${id}/SKILL.md - ${error}`);
      throw error;
    }
  }
}

// =============================================================================
// CLAUDE.md Compilation
// =============================================================================

async function copyClaude(
  config: ProfileConfig,
  profileId: string | undefined,
  stackId: string | undefined
): Promise<void> {
  // In stack mode, use stack's CLAUDE.md directly
  // In profile mode, use cascade (profile -> stack)
  let claudePath: string;

  if (!profileId && stackId) {
    // Stack mode - use stack's CLAUDE.md directly
    claudePath = `${ROOT}/stacks/${stackId}/CLAUDE.md`;
    if (!(await fileExists(claudePath))) {
      throw new Error(`Stack ${stackId} missing CLAUDE.md`);
    }
  } else if (profileId) {
    // Profile mode - use cascade
    claudePath = await resolveClaudeMd(profileId, config.stack);
  } else {
    throw new Error("Either profileId or stackId must be provided");
  }

  const content = await readFile(claudePath);
  await Bun.write(`${OUT}/../CLAUDE.md`, content);
  const source = claudePath.includes("/stacks/") ? "stack" : "profile";
  console.log(`  ✓ CLAUDE.md (from ${source})`);
}

// =============================================================================
// Commands Compilation
// =============================================================================

async function compileAllCommands(): Promise<void> {
  const commandsDir = `${ROOT}/commands`;
  const outDir = `${OUT}/commands`;

  // Check if commands directory exists
  const dirExists = await Bun.file(`${commandsDir}`).exists();
  if (!dirExists) {
    // Try to check if it's a directory by listing it
    try {
      const glob = new Bun.Glob("*.md");
      const files = await Array.fromAsync(glob.scan({ cwd: commandsDir }));
      if (files.length === 0) {
        console.log("  - No commands found, skipping...");
        return;
      }
    } catch {
      console.log("  - No commands directory found, skipping...");
      return;
    }
  }

  // Check if directory has any .md files
  const glob = new Bun.Glob("*.md");
  const files = await Array.fromAsync(glob.scan({ cwd: commandsDir }));

  if (files.length === 0) {
    console.log("  - No commands found, skipping...");
    return;
  }

  await Bun.$`mkdir -p ${outDir}`;

  for (const file of files) {
    try {
      const content = await readFile(`${commandsDir}/${file}`);
      await Bun.write(`${outDir}/${file}`, content);
      console.log(`  ✓ ${file}`);
    } catch (error) {
      console.error(`  ✗ ${file} - ${error}`);
      throw error;
    }
  }
}

// =============================================================================
// Main
// =============================================================================

async function main(): Promise<void> {
  // Determine compilation mode
  // STACK is explicit, PROFILE defaults to "home" if not provided
  const hasExplicitProfile = Bun.argv.some((a) => a.startsWith("--profile="));

  if (STACK && hasExplicitProfile) {
    console.error("Cannot use both --profile and --stack flags");
    process.exit(1);
  }

  const isStackMode = !!STACK;
  const stackId = STACK;
  const profileId = isStackMode ? undefined : PROFILE;

  console.log(`\n Compiling ${isStackMode ? `stack: ${stackId}` : `profile: ${profileId}`}\n`);

  // Load agents and skills from co-located config (Phase 0A)
  console.log("Scanning directories for config...");
  const agents = await loadAllAgents();
  const skills = await loadAllSkills();
  console.log(`  Loaded ${Object.keys(agents).length} agents`);
  console.log(`  Loaded ${Object.keys(skills).length} skills\n`);

  // Load profile or stack config
  let profileConfig: ProfileConfig;
  let effectiveStackId: string | undefined;

  if (isStackMode && stackId) {
    console.log("Loading stack configuration...");
    const stack = await loadStack(stackId);
    profileConfig = stackToProfileConfig(stackId, stack);
    effectiveStackId = stackId;
    log(`Stack config: ${stack.agents.length} agents, ${stack.skills.length} skills`);
  } else {
    const configPath = `${ROOT}/profiles/${profileId}/config.yaml`;
    try {
      profileConfig = parseYaml(await readFile(configPath));
      effectiveStackId = profileConfig.stack;
      log(`Loaded profile config with ${Object.keys(profileConfig.agents).length} agents`);
    } catch (error) {
      console.error(`Failed to load config: ${configPath}`);
      console.error(`   ${error}`);
      process.exit(1);
    }
  }

  // Resolve agents (merge definitions with profile config)
  let resolvedAgents: Record<string, AgentConfig>;
  try {
    resolvedAgents = await resolveAgents(agents, skills, profileConfig);
    log(`Resolved ${Object.keys(resolvedAgents).length} agents for ${isStackMode ? "stack" : "profile"}`);
  } catch (error) {
    console.error(`Failed to resolve agents:`);
    console.error(`   ${error}`);
    process.exit(1);
  }

  // Validate
  console.log("Validating configuration...");
  const validation = await validate(
    profileConfig,
    resolvedAgents,
    profileId,
    effectiveStackId
  );

  if (validation.warnings.length > 0) {
    console.log("\n  Warnings:");
    validation.warnings.forEach((w) => console.log(`   - ${w}`));
  }

  if (!validation.valid) {
    console.error("\n Validation failed:");
    validation.errors.forEach((e) => console.error(`   - ${e}`));
    process.exit(1);
  }

  console.log(" Validation passed\n");

  // Clean output directory
  await Bun.$`rm -rf ${OUT}/agents ${OUT}/skills ${OUT}/commands`;

  // Compile
  console.log("Compiling agents...");
  await compileAllAgents(resolvedAgents, profileConfig);

  console.log("\nCompiling skills...");
  await compileAllSkills(resolvedAgents);

  console.log("\nCompiling commands...");
  await compileAllCommands();

  console.log("\nCopying CLAUDE.md...");
  await copyClaude(profileConfig, profileId, effectiveStackId);

  console.log("\n Done!\n");
}

main().catch((error) => {
  console.error("❌ Compilation failed:", error);
  process.exit(1);
});
