#!/usr/bin/env bun
/**
 * Profile-Based Agent Compilation System
 *
 * Hybrid TypeScript + LiquidJS compilation:
 * - TypeScript handles file reading, path resolution, template composition, and validation
 * - LiquidJS handles simple variable interpolation and loops within templates
 *
 * Architecture:
 * - registry.yaml: Single source of truth for agent and skill definitions
 * - profiles/{profile}/config.yaml: Agent-centric config with prompts and skills per agent
 *
 * Usage:
 *   bun src/compile.ts --profile=home
 *   bun src/compile.ts --profile=work --verbose
 */

import { Liquid } from "liquidjs";
import { parse as parseYaml } from "yaml";
import type {
  AgentConfig,
  AgentDefinition,
  CompiledAgentData,
  ProfileConfig,
  ProfileAgentConfig,
  RegistryConfig,
  Skill,
  SkillReference,
  StackConfig,
  ValidationResult,
} from "./types";

// =============================================================================
// Configuration
// =============================================================================

const PROFILE =
  Bun.argv.find((a) => a.startsWith("--profile="))?.split("=")[1] ?? "home";
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

function log(message: string): void {
  if (VERBOSE) {
    console.log(`  ${message}`);
  }
}

// =============================================================================
// Skill Resolution (merge registry.yaml skills + profile skill references)
// =============================================================================

function resolveSkillReference(
  ref: SkillReference,
  registry: RegistryConfig
): Skill {
  const definition = registry.skills[ref.id];
  if (!definition) {
    throw new Error(`Skill "${ref.id}" not found in registry.yaml`);
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
  skills: SkillReference[],
  registry: RegistryConfig
): Skill[] {
  return skills.map((ref) => resolveSkillReference(ref, registry));
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

  const stackPath = `${ROOT}/stacks/${stackId}.yaml`;
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
 * Resolve a stack's skills to skill references
 * Stack skills format: { category: "skill-id" }
 * Returns: SkillReference[] with generic usage descriptions
 */
function resolveStackSkills(
  stack: StackConfig,
  registry: RegistryConfig
): SkillReference[] {
  const skillRefs: SkillReference[] = [];

  for (const [category, skillId] of Object.entries(stack.skills)) {
    // Validate skill exists in registry
    if (!registry.skills[skillId]) {
      throw new Error(
        `Stack "${stack.id}" references skill "${skillId}" (category: ${category}) not found in registry`
      );
    }

    const skillDef = registry.skills[skillId];
    skillRefs.push({
      id: skillId,
      usage: `when working with ${skillDef.name.toLowerCase()} (${category})`,
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
  registry: RegistryConfig
): Promise<SkillReference[]> {
  // If agent has explicit skills defined, use those
  if (profileAgentConfig.skills && profileAgentConfig.skills.length > 0) {
    return profileAgentConfig.skills;
  }

  // If profile has a stack and agent has no explicit skills, resolve from stack
  if (profileConfig.stack) {
    console.log(`  📦 Resolving skills from stack "${profileConfig.stack}" for ${agentName}`);
    const stack = await loadStack(profileConfig.stack);
    return resolveStackSkills(stack, registry);
  }

  // No skills defined and no stack - return empty array
  return [];
}

// =============================================================================
// Agent Resolution (merge registry.yaml agents + profile config)
// =============================================================================

async function resolveAgents(
  registry: RegistryConfig,
  profileConfig: ProfileConfig
): Promise<Record<string, AgentConfig>> {
  const resolved: Record<string, AgentConfig> = {};

  // Derive agents to compile from profile agents keys
  const agentNames = Object.keys(profileConfig.agents);

  for (const agentName of agentNames) {
    const definition = registry.agents[agentName];
    if (!definition) {
      throw new Error(
        `Agent "${agentName}" in profile config but not found in registry.yaml`
      );
    }

    // Get profile-specific agent config
    const profileAgentConfig = profileConfig.agents[agentName];

    // Get skills (from explicit config or stack)
    const skillRefs = await getAgentSkills(
      agentName,
      profileAgentConfig,
      profileConfig,
      registry
    );

    // Resolve skill references to full skill objects
    const skills = resolveSkillReferences(skillRefs, registry);

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
      skills,
    };
  }

  return resolved;
}

// =============================================================================
// Validation
// =============================================================================

async function validate(
  registry: RegistryConfig,
  profileConfig: ProfileConfig,
  resolvedAgents: Record<string, AgentConfig>
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check CLAUDE.md
  const claudePath = `${ROOT}/profiles/${PROFILE}/${profileConfig.claude_md}`;
  if (!(await Bun.file(claudePath).exists())) {
    errors.push(`CLAUDE.md not found: ${claudePath}`);
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

async function copyClaude(config: ProfileConfig): Promise<void> {
  const content = await readFile(
    `${ROOT}/profiles/${PROFILE}/${config.claude_md}`
  );
  await Bun.write(`${OUT}/../CLAUDE.md`, content);
  console.log(`  ✓ CLAUDE.md`);
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
  console.log(`\n🚀 Compiling profile: ${PROFILE}\n`);

  // Load registry.yaml (single source of truth for agent and skill definitions)
  const registryPath = `${ROOT}/registry.yaml`;
  let registry: RegistryConfig;

  try {
    registry = parseYaml(await readFile(registryPath));
    log(`Loaded ${Object.keys(registry.agents).length} agent definitions`);
    log(`Loaded ${Object.keys(registry.skills).length} skill definitions`);
  } catch (error) {
    console.error(`❌ Failed to load registry.yaml: ${registryPath}`);
    console.error(`   ${error}`);
    process.exit(1);
  }

  // Load profile config
  const configPath = `${ROOT}/profiles/${PROFILE}/config.yaml`;
  let profileConfig: ProfileConfig;

  try {
    profileConfig = parseYaml(await readFile(configPath));
    log(
      `Loaded profile config with ${Object.keys(profileConfig.agents).length} agents`
    );
  } catch (error) {
    console.error(`❌ Failed to load config: ${configPath}`);
    console.error(`   ${error}`);
    process.exit(1);
  }

  // Resolve agents (merge definitions with profile config)
  let resolvedAgents: Record<string, AgentConfig>;
  try {
    resolvedAgents = await resolveAgents(registry, profileConfig);
    log(`Resolved ${Object.keys(resolvedAgents).length} agents for profile`);
  } catch (error) {
    console.error(`❌ Failed to resolve agents:`);
    console.error(`   ${error}`);
    process.exit(1);
  }

  // Validate
  console.log("🔍 Validating configuration...");
  const validation = await validate(
    registry,
    profileConfig,
    resolvedAgents
  );

  if (validation.warnings.length > 0) {
    console.log("\n⚠️  Warnings:");
    validation.warnings.forEach((w) => console.log(`   - ${w}`));
  }

  if (!validation.valid) {
    console.error("\n❌ Validation failed:");
    validation.errors.forEach((e) => console.error(`   - ${e}`));
    process.exit(1);
  }

  console.log("✅ Validation passed\n");

  // Clean output directory
  await Bun.$`rm -rf ${OUT}/agents ${OUT}/skills ${OUT}/commands`;

  // Compile
  console.log("📄 Compiling agents...");
  await compileAllAgents(resolvedAgents, profileConfig);

  console.log("\n📦 Compiling skills...");
  await compileAllSkills(resolvedAgents);

  console.log("\n📋 Compiling commands...");
  await compileAllCommands();

  console.log("\n📋 Copying CLAUDE.md...");
  await copyClaude(profileConfig);

  console.log("\n✨ Done!\n");
}

main().catch((error) => {
  console.error("❌ Compilation failed:", error);
  process.exit(1);
});
