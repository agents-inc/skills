import { Liquid } from "liquidjs";
import path from "path";
import {
  readFile,
  readFileOptional,
  writeFile,
  ensureDir,
  remove,
  copy,
  glob,
  fileExists,
} from "../utils/fs";
import { verbose } from "../utils/logger";
import { DIRS, OUTPUT_DIR } from "../consts";
import { resolveClaudeMd } from "./resolver";
import {
  validateCompiledAgent,
  printOutputValidationResult,
} from "./output-validator";
import type {
  Skill,
  AgentConfig,
  CompiledAgentData,
  CompileConfig,
  CompileContext,
} from "../types";

/**
 * Read and concatenate core prompt files
 */
async function readCorePrompts(
  promptNames: string[],
  projectRoot: string,
): Promise<string> {
  const contents: string[] = [];
  const corePromptsDir = path.join(projectRoot, DIRS.corePrompts);

  for (const name of promptNames) {
    const content = await readFile(path.join(corePromptsDir, `${name}.md`));
    contents.push(content);
  }

  return contents.join("\n\n---\n\n");
}

/**
 * Compile a single agent using LiquidJS
 */
async function compileAgent(
  name: string,
  agent: AgentConfig,
  projectRoot: string,
  engine: Liquid,
): Promise<string> {
  verbose(`Reading agent files for ${name}...`);

  const agentDir = path.join(projectRoot, DIRS.agents, name);

  // Read agent-specific files
  const intro = await readFile(path.join(agentDir, "intro.md"));
  const workflow = await readFile(path.join(agentDir, "workflow.md"));
  const examples = await readFileOptional(
    path.join(agentDir, "examples.md"),
    "## Examples\n\n_No examples defined._",
  );
  const criticalRequirementsTop = await readFileOptional(
    path.join(agentDir, "critical-requirements.md"),
    "",
  );
  const criticalReminders = await readFileOptional(
    path.join(agentDir, "critical-reminders.md"),
    "",
  );

  // Read core prompts
  const corePromptsContent = await readCorePrompts(
    agent.core_prompts,
    projectRoot,
  );

  // Read output format
  const outputFormat = await readFileOptional(
    path.join(projectRoot, DIRS.agentOutputs, `${agent.output_format}.md`),
    "",
  );

  // Read ending prompts
  const endingPromptsContent = await readCorePrompts(
    agent.ending_prompts,
    projectRoot,
  );

  // Format prompt names for display
  const formatPromptName = (n: string) =>
    n.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

  const formattedCorePromptNames = agent.core_prompts.map(formatPromptName);
  const formattedEndingPromptNames = agent.ending_prompts.map(formatPromptName);

  // Partition skills into preloaded vs dynamic
  // Preloaded skills: listed in frontmatter, Claude Code loads them automatically
  // Dynamic skills: listed in Available Skills section, loaded via Skill tool
  const preloadedSkills = agent.skills.filter((s) => s.preloaded);
  const dynamicSkills = agent.skills.filter((s) => !s.preloaded);

  // IDs for frontmatter
  const preloadedSkillIds = preloadedSkills.map((s) => s.id);

  verbose(
    `Skills for ${name}: ${preloadedSkills.length} preloaded, ${dynamicSkills.length} dynamic`,
  );

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
    skills: agent.skills,
    preloadedSkills,
    dynamicSkills,
    preloadedSkillIds,
  };

  // Render with LiquidJS
  verbose(`Rendering template for ${name}...`);
  return engine.renderFile("agent", data);
}

/**
 * Compile all agents to output directory
 */
export async function compileAllAgents(
  resolvedAgents: Record<string, AgentConfig>,
  config: CompileConfig,
  ctx: CompileContext,
  engine: Liquid,
): Promise<void> {
  const outDir = path.join(ctx.outputDir, "agents");
  await ensureDir(outDir);

  let hasValidationIssues = false;

  for (const [name, agent] of Object.entries(resolvedAgents)) {
    try {
      const output = await compileAgent(name, agent, ctx.projectRoot, engine);
      await writeFile(path.join(outDir, `${name}.md`), output);
      console.log(`  ✓ ${name}.md`);

      // Validate compiled output
      const validationResult = validateCompiledAgent(output);
      if (!validationResult.valid || validationResult.warnings.length > 0) {
        hasValidationIssues = true;
        printOutputValidationResult(name, validationResult);
      }
    } catch (error) {
      console.error(`  ✗ ${name}.md - ${error}`);
      throw error;
    }
  }

  if (hasValidationIssues) {
    console.log("");
  }
}

/**
 * Compile all skills to output directory
 */
export async function compileAllSkills(
  resolvedAgents: Record<string, AgentConfig>,
  ctx: CompileContext,
): Promise<void> {
  // Collect all unique skills with paths
  const allSkills = Object.values(resolvedAgents)
    .flatMap((a) => a.skills)
    .filter((s) => s.path);

  const uniqueSkills = [...new Map(allSkills.map((s) => [s.id, s])).values()];

  for (const skill of uniqueSkills) {
    const id = skill.id.replace("/", "-");
    const outDir = path.join(ctx.outputDir, "skills", id);
    await ensureDir(outDir);

    // Skills are in src/skills/ directory
    const sourcePath = path.join(ctx.projectRoot, "src", skill.path);
    const isFolder = skill.path.endsWith("/");

    try {
      if (isFolder) {
        // Folder-based skill: read SKILL.md and copy
        const mainContent = await readFile(path.join(sourcePath, "SKILL.md"));
        await writeFile(path.join(outDir, "SKILL.md"), mainContent);
        console.log(`  ✓ skills/${id}/SKILL.md`);

        // Copy reference.md if exists
        const referenceContent = await readFileOptional(
          path.join(sourcePath, "reference.md"),
        );
        if (referenceContent) {
          await writeFile(path.join(outDir, "reference.md"), referenceContent);
          console.log(`  ✓ skills/${id}/reference.md`);
        }

        // Copy examples folder if exists
        const examplesDir = path.join(sourcePath, "examples");
        if (await fileExists(examplesDir)) {
          await copy(examplesDir, path.join(outDir, "examples"));
          console.log(`  ✓ skills/${id}/examples/`);
        }

        // Copy scripts directory if exists
        const scriptsDir = path.join(sourcePath, "scripts");
        if (await fileExists(scriptsDir)) {
          await copy(scriptsDir, path.join(outDir, "scripts"));
          console.log(`  ✓ skills/${id}/scripts/`);
        }
      } else {
        // Legacy: single file skill
        const content = await readFile(sourcePath);
        await writeFile(path.join(outDir, "SKILL.md"), content);
        console.log(`  ✓ skills/${id}/SKILL.md`);
      }
    } catch (error) {
      console.error(`  ✗ skills/${id}/SKILL.md - ${error}`);
      throw error;
    }
  }
}

/**
 * Copy CLAUDE.md to output
 */
export async function copyClaude(ctx: CompileContext): Promise<void> {
  const claudePath = await resolveClaudeMd(ctx.projectRoot, ctx.stackId);

  const content = await readFile(claudePath);
  const outputPath = path.join(ctx.outputDir, "..", "CLAUDE.md");
  await writeFile(outputPath, content);
  console.log(`  ✓ CLAUDE.md (from stack)`);
}

/**
 * Compile all commands to output directory
 */
export async function compileAllCommands(ctx: CompileContext): Promise<void> {
  const commandsDir = path.join(ctx.projectRoot, DIRS.commands);
  const outDir = path.join(ctx.outputDir, "commands");

  // Check if commands directory exists
  if (!(await fileExists(commandsDir))) {
    console.log("  - No commands directory found, skipping...");
    return;
  }

  // Check for .md files
  const files = await glob("*.md", commandsDir);

  if (files.length === 0) {
    console.log("  - No commands found, skipping...");
    return;
  }

  await ensureDir(outDir);

  for (const file of files) {
    try {
      const content = await readFile(path.join(commandsDir, file));
      await writeFile(path.join(outDir, file), content);
      console.log(`  ✓ ${file}`);
    } catch (error) {
      console.error(`  ✗ ${file} - ${error}`);
      throw error;
    }
  }
}

/**
 * Create a configured Liquid engine
 */
export function createLiquidEngine(projectRoot: string): Liquid {
  return new Liquid({
    root: [path.join(projectRoot, DIRS.templates)],
    extname: ".liquid",
    strictVariables: false,
    strictFilters: true,
  });
}

/**
 * Clean output directory (agents, skills, commands)
 */
export async function cleanOutputDir(outputDir: string): Promise<void> {
  await remove(path.join(outputDir, "agents"));
  await remove(path.join(outputDir, "skills"));
  await remove(path.join(outputDir, "commands"));
}
