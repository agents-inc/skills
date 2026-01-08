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
 *   bun .claude-src/compile.ts --profile=home
 *   bun .claude-src/compile.ts --profile=work --verbose
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
  SkillAssignment,
  SkillReference,
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
  precompiled: SkillReference[],
  dynamic: SkillReference[],
  registry: RegistryConfig
): SkillAssignment {
  return {
    precompiled: precompiled.map((ref) =>
      resolveSkillReference(ref, registry)
    ),
    dynamic: dynamic.map((ref) => resolveSkillReference(ref, registry)),
  };
}

// =============================================================================
// Agent Resolution (merge registry.yaml agents + profile config)
// =============================================================================

function resolveAgents(
  registry: RegistryConfig,
  profileConfig: ProfileConfig
): Record<string, AgentConfig> {
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

    // Resolve skill references
    const skills = resolveSkillReferences(
      profileAgentConfig.precompiled,
      profileAgentConfig.dynamic,
      registry
    );

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

  // Read core prompts for this agent (directly from agent config)
  const corePromptsContent = await readCorePrompts(agent.core_prompts);

  // Read output format
  const outputFormat = await readFileOptional(
    `${ROOT}/agent-outputs/${agent.output_format}.md`,
    ""
  );

  // Read ending prompts for this agent (directly from agent config)
  const endingPromptsContent = await readCorePrompts(agent.ending_prompts);

  // Read precompiled skills with their content
  const precompiledSkills = await readSkillsWithContent(
    agent.skills.precompiled,
    PROFILE
  );

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
    resolvedAgents = resolveAgents(registry, profileConfig);
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
