#!/usr/bin/env bun
/**
 * Profile-Based Agent Compilation System
 *
 * Hybrid TypeScript + LiquidJS compilation:
 * - TypeScript handles file reading, path resolution, template composition, and validation
 * - LiquidJS handles simple variable interpolation and loops within templates
 *
 * Architecture:
 * - agents.yaml: Single source of truth for all agent definitions
 * - profiles/{profile}/config.yaml: References agents by name + adds profile-specific skills
 *
 * Usage:
 *   bun .claude-src/compile.ts --profile=home
 *   bun .claude-src/compile.ts --profile=work --verbose
 */

import { Liquid } from "liquidjs";
import { parse as parseYaml } from "yaml";
import type {
  AgentConfig,
  AgentDefinition,
  AgentsConfig,
  CompiledAgentData,
  ProfileConfig,
  Skill,
  SkillAssignment,
  SkillReference,
  SkillReferenceAssignment,
  SkillsConfig,
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
// Skill Resolution (merge skills.yaml + profile skill references)
// =============================================================================

function resolveSkillReference(
  ref: SkillReference,
  skillsConfig: SkillsConfig
): Skill {
  const definition = skillsConfig.skills[ref.id];
  if (!definition) {
    throw new Error(`Skill "${ref.id}" not found in skills.yaml`);
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
  refs: SkillReferenceAssignment,
  skillsConfig: SkillsConfig
): SkillAssignment {
  return {
    precompiled: refs.precompiled.map((ref) =>
      resolveSkillReference(ref, skillsConfig)
    ),
    dynamic: refs.dynamic.map((ref) => resolveSkillReference(ref, skillsConfig)),
  };
}

// =============================================================================
// Agent Resolution (merge agents.yaml + profile skills)
// =============================================================================

function resolveAgents(
  agentsConfig: AgentsConfig,
  profileConfig: ProfileConfig,
  skillsConfig: SkillsConfig
): Record<string, AgentConfig> {
  const resolved: Record<string, AgentConfig> = {};

  // Derive agents to compile from agent_skills keys
  const agentNames = Object.keys(profileConfig.agent_skills);

  for (const agentName of agentNames) {
    const definition = agentsConfig.agents[agentName];
    if (!definition) {
      throw new Error(
        `Agent "${agentName}" in agent_skills but not found in agents.yaml`
      );
    }

    // Get profile-specific skill references and resolve them
    const skillRefs = profileConfig.agent_skills[agentName];
    const skills = resolveSkillReferences(skillRefs, skillsConfig);

    // Merge definition with resolved skills
    resolved[agentName] = {
      name: agentName,
      title: definition.title,
      description: definition.description,
      model: definition.model,
      tools: definition.tools,
      core_prompts: definition.core_prompts,
      ending_prompts: definition.ending_prompts,
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
  agentsConfig: AgentsConfig,
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

    // Check core_prompts reference
    if (!profileConfig.core_prompt_sets[agent.core_prompts]) {
      errors.push(
        `Invalid core_prompts reference "${agent.core_prompts}" for agent: ${name}`
      );
    }

    // Check ending_prompts reference
    if (
      agent.ending_prompts &&
      !profileConfig.ending_prompt_sets[agent.ending_prompts]
    ) {
      errors.push(
        `Invalid ending_prompts reference "${agent.ending_prompts}" for agent: ${name}`
      );
    }

    // Check precompiled skill paths
    for (const skill of agent.skills.precompiled) {
      if (!skill.path) {
        errors.push(
          `Precompiled skill missing path: ${skill.id} (agent: ${name})`
        );
        continue;
      }
      const skillPath = `${ROOT}/profiles/${PROFILE}/${skill.path}`;
      if (!(await Bun.file(skillPath).exists())) {
        errors.push(`Skill file not found: ${skill.path} (agent: ${name})`);
      }
    }

    // Check dynamic skills have paths (for compilation to .claude/skills/)
    for (const skill of agent.skills.dynamic) {
      if (!skill.path) {
        warnings.push(
          `Dynamic skill missing path (won't be compiled): ${skill.id} (agent: ${name})`
        );
      }
    }

    // Validate dynamic skills have usage property
    for (const skill of agent.skills.dynamic) {
      if (!skill.usage) {
        errors.push(
          `Dynamic skill missing required "usage" property: ${skill.id} (agent: ${name})`
        );
      }
    }
  }

  // Check core prompt files exist
  const allCorePrompts = new Set<string>();
  for (const prompts of Object.values(profileConfig.core_prompt_sets)) {
    prompts.forEach((p) => allCorePrompts.add(p));
  }
  for (const prompt of allCorePrompts) {
    const promptPath = `${ROOT}/core-prompts/${prompt}.md`;
    if (!(await Bun.file(promptPath).exists())) {
      errors.push(`Core prompt not found: ${prompt}.md`);
    }
  }

  // Check ending prompt files exist
  const allEndingPrompts = new Set<string>();
  for (const prompts of Object.values(profileConfig.ending_prompt_sets || {})) {
    prompts.forEach((p) => allEndingPrompts.add(p));
  }
  for (const prompt of allEndingPrompts) {
    const promptPath = `${ROOT}/core-prompts/${prompt}.md`;
    if (!(await Bun.file(promptPath).exists())) {
      errors.push(`Ending prompt not found: ${prompt}.md`);
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

async function readSkillsWithContent(
  skills: Skill[],
  profile: string
): Promise<Skill[]> {
  const result: Skill[] = [];
  for (const skill of skills) {
    if (!skill.path) continue;
    const content = await readFile(`${ROOT}/profiles/${profile}/${skill.path}`);
    result.push({ ...skill, content });
  }
  return result;
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

  // Read core prompts for this agent type
  const corePromptNames = config.core_prompt_sets[agent.core_prompts] ?? [];
  const corePromptsContent = await readCorePrompts(corePromptNames);

  // Read output format
  const outputFormat = await readFileOptional(
    `${ROOT}/core-prompts/${agent.output_format}.md`,
    ""
  );

  // Read ending prompts for this agent type (configured, not hardcoded)
  const endingPromptNames = agent.ending_prompts
    ? (config.ending_prompt_sets[agent.ending_prompts] ?? [])
    : [];
  const endingPromptsContent = await readCorePrompts(endingPromptNames);

  // Read precompiled skills with their content
  const precompiledSkills = await readSkillsWithContent(
    agent.skills.precompiled,
    PROFILE
  );

  // Format prompt names for display
  const formatPromptName = (n: string) =>
    n.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

  const formattedCorePromptNames = corePromptNames.map(formatPromptName);
  const formattedEndingPromptNames = endingPromptNames.map(formatPromptName);

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
    skills: {
      precompiled: precompiledSkills,
      dynamic: agent.skills.dynamic,
    },
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

async function compileAllSkills(
  resolvedAgents: Record<string, AgentConfig>
): Promise<void> {
  // Collect all unique skills with paths
  const allSkills = Object.values(resolvedAgents)
    .flatMap((a) => [...a.skills.precompiled, ...a.skills.dynamic])
    .filter((s) => s.path);

  const uniqueSkills = [...new Map(allSkills.map((s) => [s.id, s])).values()];

  for (const skill of uniqueSkills) {
    const id = skill.id.replace("/", "-");
    const outDir = `${OUT}/skills/${id}`;
    await Bun.$`mkdir -p ${outDir}`;

    try {
      const content = await readFile(
        `${ROOT}/profiles/${PROFILE}/${skill.path}`
      );
      await Bun.write(`${outDir}/SKILL.md`, content);
      console.log(`  ✓ skills/${id}/SKILL.md`);
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
// Main
// =============================================================================

async function main(): Promise<void> {
  console.log(`\n🚀 Compiling profile: ${PROFILE}\n`);

  // Load agents.yaml (single source of truth for agent definitions)
  const agentsPath = `${ROOT}/agents.yaml`;
  let agentsConfig: AgentsConfig;

  try {
    agentsConfig = parseYaml(await readFile(agentsPath));
    log(`Loaded ${Object.keys(agentsConfig.agents).length} agent definitions`);
  } catch (error) {
    console.error(`❌ Failed to load agents.yaml: ${agentsPath}`);
    console.error(`   ${error}`);
    process.exit(1);
  }

  // Load skills.yaml (single source of truth for skill definitions)
  const skillsPath = `${ROOT}/skills.yaml`;
  let skillsConfig: SkillsConfig;

  try {
    skillsConfig = parseYaml(await readFile(skillsPath));
    log(`Loaded ${Object.keys(skillsConfig.skills).length} skill definitions`);
  } catch (error) {
    console.error(`❌ Failed to load skills.yaml: ${skillsPath}`);
    console.error(`   ${error}`);
    process.exit(1);
  }

  // Load profile config
  const configPath = `${ROOT}/profiles/${PROFILE}/config.yaml`;
  let profileConfig: ProfileConfig;

  try {
    profileConfig = parseYaml(await readFile(configPath));
    log(`Loaded profile config with ${Object.keys(profileConfig.agent_skills).length} agents`);
  } catch (error) {
    console.error(`❌ Failed to load config: ${configPath}`);
    console.error(`   ${error}`);
    process.exit(1);
  }

  // Resolve agents (merge definitions with profile skills)
  let resolvedAgents: Record<string, AgentConfig>;
  try {
    resolvedAgents = resolveAgents(agentsConfig, profileConfig, skillsConfig);
    log(`Resolved ${Object.keys(resolvedAgents).length} agents for profile`);
  } catch (error) {
    console.error(`❌ Failed to resolve agents:`);
    console.error(`   ${error}`);
    process.exit(1);
  }

  // Validate
  console.log("🔍 Validating configuration...");
  const validation = await validate(agentsConfig, profileConfig, resolvedAgents);

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
  await Bun.$`rm -rf ${OUT}/agents ${OUT}/skills`;

  // Compile
  console.log("📄 Compiling agents...");
  await compileAllAgents(resolvedAgents, profileConfig);

  console.log("\n📦 Compiling skills...");
  await compileAllSkills(resolvedAgents);

  console.log("\n📋 Copying CLAUDE.md...");
  await copyClaude(profileConfig);

  console.log("\n✨ Done!\n");
}

main().catch((error) => {
  console.error("❌ Compilation failed:", error);
  process.exit(1);
});
