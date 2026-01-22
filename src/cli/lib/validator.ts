import path from "path";
import { fileExists } from "../utils/fs";
import { DIRS } from "../consts";
import { resolveClaudeMd } from "./resolver";
import type { AgentConfig, ValidationResult } from "../types";

/**
 * Validate configuration before compilation
 * Returns errors (fatal) and warnings (non-fatal)
 */
export async function validate(
  resolvedAgents: Record<string, AgentConfig>,
  stackId: string,
  projectRoot: string,
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check CLAUDE.md from stack
  try {
    await resolveClaudeMd(projectRoot, stackId);
  } catch {
    errors.push(`CLAUDE.md not found in stack "${stackId}"`);
  }

  // Check core prompts directory exists
  const corePromptsDir = path.join(projectRoot, DIRS.corePrompts);
  const corePromptsCheck = path.join(corePromptsDir, "core-principles.md");
  if (!(await fileExists(corePromptsCheck))) {
    errors.push(`Core prompts directory missing or empty: ${corePromptsDir}`);
  }

  // Collect all prompt names for validation
  const allPromptNames = new Set<string>();

  // Check each resolved agent
  for (const [name, agent] of Object.entries(resolvedAgents)) {
    // Use stored path if available, otherwise fall back to name (for backwards compatibility)
    const agentDir = path.join(projectRoot, DIRS.agents, agent.path || name);

    // Required agent files
    const requiredFiles = ["intro.md", "workflow.md"];
    for (const file of requiredFiles) {
      const filePath = path.join(agentDir, file);
      if (!(await fileExists(filePath))) {
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
      const filePath = path.join(agentDir, file);
      if (!(await fileExists(filePath))) {
        warnings.push(`Optional file missing for ${name}: ${file}`);
      }
    }

    // Collect prompt names from this agent
    agent.core_prompts.forEach((p) => allPromptNames.add(p));
    agent.ending_prompts.forEach((p) => allPromptNames.add(p));

    // Check skill paths
    for (const skill of agent.skills) {
      if (!skill.path) {
        warnings.push(
          `Skill missing path (won't be compiled): ${skill.id} (agent: ${name})`,
        );
        continue;
      }

      const basePath = path.join(projectRoot, skill.path);
      const isFolder = skill.path.endsWith("/");

      if (isFolder) {
        // Folder-based skill: check for SKILL.md inside
        const skillFile = path.join(basePath, "SKILL.md");
        if (!(await fileExists(skillFile))) {
          errors.push(
            `Skill folder missing SKILL.md: ${skill.path}SKILL.md (agent: ${name})`,
          );
        }
      } else {
        // Legacy: single file skill
        if (!(await fileExists(basePath))) {
          errors.push(`Skill file not found: ${skill.path} (agent: ${name})`);
        }
      }
    }
  }

  // Check all prompt files exist
  for (const prompt of allPromptNames) {
    const promptPath = path.join(corePromptsDir, `${prompt}.md`);
    if (!(await fileExists(promptPath))) {
      errors.push(`Core prompt not found: ${prompt}.md`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Print validation results to console
 */
export function printValidationResult(result: ValidationResult): void {
  if (result.warnings.length > 0) {
    console.log("\n  Warnings:");
    result.warnings.forEach((w) => console.log(`   - ${w}`));
  }

  if (!result.valid) {
    console.error("\n  Validation failed:");
    result.errors.forEach((e) => console.error(`   - ${e}`));
  } else {
    console.log("  Validation passed\n");
  }
}
