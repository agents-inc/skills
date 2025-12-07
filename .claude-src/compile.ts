#!/usr/bin/env bun
/**
 * Profile-Based Agent Compilation System
 *
 * Hybrid TypeScript + LiquidJS compilation:
 * - TypeScript handles file reading, path resolution, template composition, and validation
 * - LiquidJS handles simple variable interpolation and loops within templates
 *
 * Usage:
 *   bun .claude-src/compile.ts --profile=home
 *   bun .claude-src/compile.ts --profile=work --verbose
 */

import { Liquid } from "liquidjs";
import { parse as parseYaml } from "yaml";
import type {
  AgentConfig,
  CompiledAgentData,
  ProfileConfig,
  Skill,
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
// Validation
// =============================================================================

async function validate(config: ProfileConfig): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check CLAUDE.md
  const claudePath = `${ROOT}/profiles/${PROFILE}/${config.claude_md}`;
  if (!(await Bun.file(claudePath).exists())) {
    errors.push(`CLAUDE.md not found: ${claudePath}`);
  }

  // Check core prompts directory exists
  const corePromptsDir = `${ROOT}/core-prompts`;
  if (!(await Bun.file(`${corePromptsDir}/core-principles.md`).exists())) {
    errors.push(`Core prompts directory missing or empty: ${corePromptsDir}`);
  }

  // Check each agent
  for (const [name, agent] of Object.entries(config.agents)) {
    const agentDir = `${ROOT}/agents/${name}`;

    // Required agent files
    const requiredFiles = ["intro.md", "workflow.md"];
    for (const file of requiredFiles) {
      if (!(await Bun.file(`${agentDir}/${file}`).exists())) {
        errors.push(`Missing ${file} for agent: ${name}`);
      }
    }

    // Optional agent files (warn if missing)
    const optionalFiles = ["examples.md", "critical-requirements.md", "critical-reminders.md"];
    for (const file of optionalFiles) {
      if (!(await Bun.file(`${agentDir}/${file}`).exists())) {
        warnings.push(`Optional file missing for ${name}: ${file}`);
      }
    }

    // Check core_prompts reference
    if (!config.core_prompt_sets[agent.core_prompts]) {
      errors.push(
        `Invalid core_prompts reference "${agent.core_prompts}" for agent: ${name}`
      );
    }

    // Check ending_prompts reference
    if (agent.ending_prompts && !config.ending_prompt_sets[agent.ending_prompts]) {
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
  for (const prompts of Object.values(config.core_prompt_sets)) {
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
  for (const prompts of Object.values(config.ending_prompt_sets || {})) {
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
  const agentDir = `${ROOT}/agents/${name}`;
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

async function compileAllAgents(config: ProfileConfig): Promise<void> {
  await Bun.$`mkdir -p ${OUT}/agents`;

  for (const [name, agent] of Object.entries(config.agents)) {
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

async function compileAllSkills(config: ProfileConfig): Promise<void> {
  // Collect all unique skills with paths
  const allSkills = Object.values(config.agents)
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

  // Load config
  const configPath = `${ROOT}/profiles/${PROFILE}/config.yaml`;
  let config: ProfileConfig;

  try {
    config = parseYaml(await readFile(configPath));
  } catch (error) {
    console.error(`❌ Failed to load config: ${configPath}`);
    console.error(`   ${error}`);
    process.exit(1);
  }

  // Validate
  console.log("🔍 Validating configuration...");
  const validation = await validate(config);

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
  await compileAllAgents(config);

  console.log("\n📦 Compiling skills...");
  await compileAllSkills(config);

  console.log("\n📋 Copying CLAUDE.md...");
  await copyClaude(config);

  console.log("\n✨ Done!\n");
}

main().catch((error) => {
  console.error("❌ Compilation failed:", error);
  process.exit(1);
});
