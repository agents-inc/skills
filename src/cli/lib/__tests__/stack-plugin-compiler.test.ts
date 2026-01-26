import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "path";
import os from "os";
import { mkdtemp, rm, mkdir, writeFile, readFile, stat } from "fs/promises";
import {
  compileStackPlugin,
  printStackCompilationSummary,
  type CompiledStackPlugin,
} from "../stack-plugin-compiler";

describe("stack-plugin-compiler", () => {
  let tempDir: string;
  let projectRoot: string;
  let outputDir: string;
  let testCounter = 0;

  // Generate unique stack ID to avoid cache collisions between tests
  // The loader caches stacks by mode:stackId, so we need unique IDs per test
  function uniqueStackId(base = "test-stack"): string {
    testCounter++;
    return `${base}-${testCounter}-${Date.now()}`;
  }

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "stack-compiler-test-"));
    projectRoot = path.join(tempDir, "project");
    outputDir = path.join(tempDir, "output");

    await mkdir(outputDir, { recursive: true });
    await mkdir(projectRoot, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  // =============================================================================
  // Helper Functions
  // =============================================================================

  async function createProjectStructure() {
    // Create directories
    const agentsDir = path.join(projectRoot, "src/agents");
    const templatesDir = path.join(projectRoot, "src/agents/_templates");
    const stacksDir = path.join(projectRoot, "src/stacks");

    await mkdir(agentsDir, { recursive: true });
    await mkdir(templatesDir, { recursive: true });
    await mkdir(stacksDir, { recursive: true });

    // Create agent template
    await writeFile(
      path.join(templatesDir, "agent.liquid"),
      `---
name: {{ agent.name }}
description: {{ agent.description }}
tools: {{ agent.tools | join: ", " }}
{%- if preloadedSkillIds.size > 0 %}
skills: {{ preloadedSkillIds | join: ", " }}
{%- endif %}
---

{{ intro }}

<core_principles>
Core principles are embedded directly in the template.
</core_principles>

{{ workflow }}
`,
    );

    return { agentsDir, templatesDir, stacksDir };
  }

  async function createAgent(
    agentsDir: string,
    agentId: string,
    config: {
      title: string;
      description: string;
      tools: string[];
      intro?: string;
      workflow?: string;
    },
  ) {
    const agentDir = path.join(agentsDir, agentId);
    await mkdir(agentDir, { recursive: true });

    // Create agent.yaml
    await writeFile(
      path.join(agentDir, "agent.yaml"),
      `id: ${agentId}
title: ${config.title}
description: ${config.description}
tools:
${config.tools.map((t) => `  - ${t}`).join("\n")}
`,
    );

    // Create intro.md
    await writeFile(
      path.join(agentDir, "intro.md"),
      config.intro || `# ${config.title}\n\nThis is the ${agentId} agent.`,
    );

    // Create workflow.md
    await writeFile(
      path.join(agentDir, "workflow.md"),
      config.workflow || `## Workflow\n\n1. Analyze\n2. Implement\n3. Test`,
    );
  }

  async function createStack(
    stacksDir: string,
    stackId: string,
    config: {
      name: string;
      version: string;
      author: string;
      description?: string;
      agents: string[];
      skills?: Array<{ id: string; preloaded?: boolean }>;
      tags?: string[];
      philosophy?: string;
      principles?: string[];
      hooks?: Record<
        string,
        Array<{
          matcher?: string;
          hooks: Array<{
            type: string;
            command?: string;
            script?: string;
            prompt?: string;
            timeout?: number;
          }>;
        }>
      >;
    },
  ) {
    const stackDir = path.join(stacksDir, stackId);
    const skillsSubDir = path.join(stackDir, "skills");
    await mkdir(skillsSubDir, { recursive: true });

    // Create config.yaml (author needs to be quoted because of @ symbol)
    // Handle skills array properly - empty array should be `skills: []`
    let skillsYaml = "skills: []";
    if (config.skills && config.skills.length > 0) {
      skillsYaml = `skills:\n${config.skills.map((s) => `  - id: ${s.id}\n    preloaded: ${s.preloaded ?? false}`).join("\n")}`;
    }

    // Handle hooks configuration
    let hooksYaml = "";
    if (config.hooks && Object.keys(config.hooks).length > 0) {
      const hooksLines: string[] = ["hooks:"];
      for (const [event, definitions] of Object.entries(config.hooks)) {
        hooksLines.push(`  ${event}:`);
        for (const def of definitions) {
          if (def.matcher) {
            hooksLines.push(`    - matcher: "${def.matcher}"`);
          } else {
            hooksLines.push(`    -`);
          }
          hooksLines.push(`      hooks:`);
          for (const hook of def.hooks) {
            hooksLines.push(`        - type: ${hook.type}`);
            if (hook.command)
              hooksLines.push(`          command: "${hook.command}"`);
            if (hook.script)
              hooksLines.push(`          script: "${hook.script}"`);
            if (hook.prompt)
              hooksLines.push(`          prompt: "${hook.prompt}"`);
            if (hook.timeout)
              hooksLines.push(`          timeout: ${hook.timeout}`);
          }
        }
      }
      hooksYaml = hooksLines.join("\n");
    }

    const configContent = `name: ${config.name}
version: "${config.version}"
author: "${config.author}"
${config.description ? `description: "${config.description}"` : ""}
agents:
${config.agents.map((a) => `  - ${a}`).join("\n")}
${skillsYaml}
${config.tags ? `tags:\n${config.tags.map((t) => `  - ${t}`).join("\n")}` : ""}
${config.philosophy ? `philosophy: "${config.philosophy}"` : ""}
${config.principles ? `principles:\n${config.principles.map((p) => `  - "${p}"`).join("\n")}` : ""}
${hooksYaml}
`;
    await writeFile(path.join(stackDir, "config.yaml"), configContent);

    return stackDir;
  }

  async function createSkillInStack(
    stackDir: string,
    skillId: string,
    config: { name: string; description: string; content?: string },
  ) {
    const skillDir = path.join(stackDir, "skills", skillId);
    await mkdir(skillDir, { recursive: true });

    await writeFile(
      path.join(skillDir, "SKILL.md"),
      `---
name: ${config.name}
description: ${config.description}
---

${config.content || `# ${config.name}\n\nSkill content here.`}
`,
    );
  }

  /**
   * Create a skill in src/skills/ (new architecture)
   * @param directoryPath - filesystem path like "frontend/framework/react (@vince)"
   * @param config.name - frontmatter name (canonical ID) like "frontend/react (@vince)"
   */
  async function createSkillInSource(
    directoryPath: string,
    config: { name: string; description: string; content?: string },
  ) {
    const skillDir = path.join(projectRoot, "src", "skills", directoryPath);
    await mkdir(skillDir, { recursive: true });

    await writeFile(
      path.join(skillDir, "SKILL.md"),
      `---
name: ${config.name}
description: ${config.description}
---

${config.content || `# ${config.name}\n\nSkill content here.`}
`,
    );
  }

  // =============================================================================
  // compileStackPlugin - Main Function Tests
  // =============================================================================

  describe("compileStackPlugin", () => {
    it("should create plugin directory structure", async () => {
      const { agentsDir, stacksDir } = await createProjectStructure();

      await createAgent(agentsDir, "frontend-developer", {
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read", "Write", "Glob"],
      });

      // Create skill in src/skills/ (new architecture)
      // Directory path is where the files live, frontmatter name is the canonical ID
      const directoryPath = "frontend/framework/react (@vince)";
      const frontmatterName = "react (@vince)";
      await createSkillInSource(directoryPath, {
        name: frontmatterName,
        description: "React development skills",
      });

      const stackId = uniqueStackId();
      await createStack(stacksDir, stackId, {
        name: "Test Stack",
        version: "1.0.0",
        author: "@test",
        description: "A test stack",
        agents: ["frontend-developer"],
        // Reference by canonical ID (frontmatter name)
        skills: [{ id: frontmatterName, preloaded: true }],
      });

      const result = await compileStackPlugin({
        stackId,
        outputDir,
        projectRoot,
      });

      // Verify directory exists
      const stats = await stat(result.pluginPath);
      expect(stats.isDirectory()).toBe(true);

      // Verify agents subdirectory
      const agentsDirOutput = path.join(result.pluginPath, "agents");
      const agentStats = await stat(agentsDirOutput);
      expect(agentStats.isDirectory()).toBe(true);
    });

    it("should generate valid plugin.json in .claude-plugin directory", async () => {
      const { agentsDir, stacksDir } = await createProjectStructure();

      await createAgent(agentsDir, "frontend-developer", {
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read", "Write"],
      });

      const stackId = uniqueStackId("my-stack");
      const stackDir = await createStack(stacksDir, stackId, {
        name: "My Stack",
        version: "2.0.0",
        author: "@vince",
        description: "My custom stack",
        agents: ["frontend-developer"],
        skills: [],
      });

      const result = await compileStackPlugin({
        stackId,
        outputDir,
        projectRoot,
      });

      const manifestPath = path.join(
        result.pluginPath,
        ".claude-plugin",
        "plugin.json",
      );
      const manifestContent = await readFile(manifestPath, "utf-8");
      const manifest = JSON.parse(manifestContent);

      expect(manifest.name).toBe(stackId);
      expect(manifest.description).toBe("My custom stack");
      expect(manifest.version).toBe("1.0.0"); // Semver versioning
      // content_hash and updated are no longer in manifest - stored internally
      expect(manifest.content_hash).toBeUndefined();
      expect(manifest.updated).toBeUndefined();
      expect(manifest.agents).toBe("./agents/");
    });

    it("should compile agent markdown files to agents directory", async () => {
      const { agentsDir, stacksDir } = await createProjectStructure();

      await createAgent(agentsDir, "frontend-developer", {
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read", "Write"],
        intro: "# Frontend Developer\n\nThis is the intro.",
        workflow: "## Workflow\n\n1. Build components",
      });

      const stackId = uniqueStackId();
      const stackDir = await createStack(stacksDir, stackId, {
        name: "Test Stack",
        version: "1.0.0",
        author: "@test",
        agents: ["frontend-developer"],
        skills: [],
      });

      const result = await compileStackPlugin({
        stackId,
        outputDir,
        projectRoot,
      });

      const agentMdPath = path.join(
        result.pluginPath,
        "agents",
        "frontend-developer.md",
      );
      const agentContent = await readFile(agentMdPath, "utf-8");

      expect(agentContent).toContain("name: frontend-developer");
      expect(agentContent).toContain("Frontend Developer");
      expect(agentContent).toContain("Build components");
    });

    it("should generate README.md with stack information", async () => {
      const { agentsDir, stacksDir } = await createProjectStructure();

      await createAgent(agentsDir, "frontend-developer", {
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read"],
      });

      const stackId = uniqueStackId();
      await createStack(stacksDir, stackId, {
        name: "Test Stack",
        version: "1.0.0",
        author: "@test",
        description: "A comprehensive test stack",
        agents: ["frontend-developer"],
        skills: [],
      });

      const result = await compileStackPlugin({
        stackId,
        outputDir,
        projectRoot,
      });

      const readmePath = path.join(result.pluginPath, "README.md");
      const readmeContent = await readFile(readmePath, "utf-8");

      expect(readmeContent).toContain("# Test Stack");
      expect(readmeContent).toContain("A comprehensive test stack");
      expect(readmeContent).toContain("## Installation");
      expect(readmeContent).toContain(stackId);
    });

    it("should include tags in README when stack has tags", async () => {
      const { agentsDir, stacksDir } = await createProjectStructure();

      await createAgent(agentsDir, "frontend-developer", {
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read"],
      });

      const stackId = uniqueStackId();
      await createStack(stacksDir, stackId, {
        name: "Test Stack",
        version: "1.0.0",
        author: "@test",
        agents: ["frontend-developer"],
        tags: ["frontend", "react", "typescript"],
        skills: [],
      });

      const result = await compileStackPlugin({
        stackId,
        outputDir,
        projectRoot,
      });

      const readmePath = path.join(result.pluginPath, "README.md");
      const readmeContent = await readFile(readmePath, "utf-8");

      expect(readmeContent).toContain("## Tags");
      expect(readmeContent).toContain("`frontend`");
      expect(readmeContent).toContain("`react`");
      expect(readmeContent).toContain("`typescript`");
    });

    it("should include philosophy in README when stack has philosophy", async () => {
      const { agentsDir, stacksDir } = await createProjectStructure();

      await createAgent(agentsDir, "frontend-developer", {
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read"],
      });

      const stackId = uniqueStackId();
      await createStack(stacksDir, stackId, {
        name: "Test Stack",
        version: "1.0.0",
        author: "@test",
        agents: ["frontend-developer"],
        philosophy: "Keep things simple and testable",
        skills: [],
      });

      const result = await compileStackPlugin({
        stackId,
        outputDir,
        projectRoot,
      });

      const readmePath = path.join(result.pluginPath, "README.md");
      const readmeContent = await readFile(readmePath, "utf-8");

      expect(readmeContent).toContain("## Philosophy");
      expect(readmeContent).toContain("Keep things simple and testable");
    });

    it("should include principles in README when stack has principles", async () => {
      const { agentsDir, stacksDir } = await createProjectStructure();

      await createAgent(agentsDir, "frontend-developer", {
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read"],
      });

      const stackId = uniqueStackId();
      await createStack(stacksDir, stackId, {
        name: "Test Stack",
        version: "1.0.0",
        author: "@test",
        agents: ["frontend-developer"],
        principles: ["Test first", "Ship fast", "Keep it simple"],
        skills: [],
      });

      const result = await compileStackPlugin({
        stackId,
        outputDir,
        projectRoot,
      });

      const readmePath = path.join(result.pluginPath, "README.md");
      const readmeContent = await readFile(readmePath, "utf-8");

      expect(readmeContent).toContain("## Principles");
      expect(readmeContent).toContain("- Test first");
      expect(readmeContent).toContain("- Ship fast");
      expect(readmeContent).toContain("- Keep it simple");
    });

    it("should list agents in README", async () => {
      const { agentsDir, stacksDir } = await createProjectStructure();

      await createAgent(agentsDir, "frontend-developer", {
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read", "Write"],
      });

      await createAgent(agentsDir, "backend-developer", {
        title: "Backend Developer",
        description: "A backend developer agent",
        tools: ["Read", "Write", "Bash"],
      });

      const stackId = uniqueStackId();
      await createStack(stacksDir, stackId, {
        name: "Test Stack",
        version: "1.0.0",
        author: "@test",
        agents: ["frontend-developer", "backend-developer"],
        skills: [],
      });

      const result = await compileStackPlugin({
        stackId,
        outputDir,
        projectRoot,
      });

      const readmePath = path.join(result.pluginPath, "README.md");
      const readmeContent = await readFile(readmePath, "utf-8");

      expect(readmeContent).toContain("## Agents");
      expect(readmeContent).toContain("`frontend-developer`");
      expect(readmeContent).toContain("`backend-developer`");
    });

    it("should copy CLAUDE.md to plugin root when present", async () => {
      const { agentsDir, stacksDir } = await createProjectStructure();

      await createAgent(agentsDir, "frontend-developer", {
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read"],
      });

      const stackId = uniqueStackId();
      const stackDir = await createStack(stacksDir, stackId, {
        name: "Test Stack",
        version: "1.0.0",
        author: "@test",
        agents: ["frontend-developer"],
        skills: [],
      });

      // Create CLAUDE.md in stack directory
      await writeFile(
        path.join(stackDir, "CLAUDE.md"),
        "# Project Instructions\n\nFollow these guidelines.",
      );

      const result = await compileStackPlugin({
        stackId,
        outputDir,
        projectRoot,
      });

      const claudeMdPath = path.join(result.pluginPath, "CLAUDE.md");
      const claudeContent = await readFile(claudeMdPath, "utf-8");

      expect(claudeContent).toContain("# Project Instructions");
      expect(claudeContent).toContain("Follow these guidelines");
    });

    it("should return compiled agents list", async () => {
      const { agentsDir, stacksDir } = await createProjectStructure();

      await createAgent(agentsDir, "frontend-developer", {
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read"],
      });

      await createAgent(agentsDir, "tester", {
        title: "Tester",
        description: "A testing agent",
        tools: ["Read", "Bash"],
      });

      const stackId = uniqueStackId();
      await createStack(stacksDir, stackId, {
        name: "Test Stack",
        version: "1.0.0",
        author: "@test",
        agents: ["frontend-developer", "tester"],
        skills: [],
      });

      const result = await compileStackPlugin({
        stackId,
        outputDir,
        projectRoot,
      });

      expect(result.agents).toContain("frontend-developer");
      expect(result.agents).toContain("tester");
      expect(result.agents).toHaveLength(2);
    });

    it("should return skill plugin references", async () => {
      const { agentsDir, stacksDir } = await createProjectStructure();

      await createAgent(agentsDir, "frontend-developer", {
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read"],
      });

      // Create skills in src/skills/ (new architecture)
      // Directory paths are where files live, frontmatter names are canonical IDs
      const reactDirPath = "frontend/framework/react (@vince)";
      const reactCanonicalId = "react (@vince)";
      const tsDirPath = "frontend/language/typescript (@vince)";
      const tsCanonicalId = "typescript (@vince)";

      await createSkillInSource(reactDirPath, {
        name: reactCanonicalId,
        description: "React development",
      });

      await createSkillInSource(tsDirPath, {
        name: tsCanonicalId,
        description: "TypeScript development",
      });

      const stackId = uniqueStackId();
      await createStack(stacksDir, stackId, {
        name: "Test Stack",
        version: "1.0.0",
        author: "@test",
        agents: ["frontend-developer"],
        // Reference by canonical IDs (frontmatter names)
        skills: [
          { id: reactCanonicalId, preloaded: true },
          { id: tsCanonicalId, preloaded: false },
        ],
      });

      const result = await compileStackPlugin({
        stackId,
        outputDir,
        projectRoot,
      });

      // Skill plugins now use canonical frontmatter names (simplified ID format)
      expect(result.skillPlugins).toContain("react (@vince)");
      expect(result.skillPlugins).toContain("typescript (@vince)");
    });

    it("should return correct manifest structure", async () => {
      const { agentsDir, stacksDir } = await createProjectStructure();

      await createAgent(agentsDir, "frontend-developer", {
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read"],
      });

      const stackId = uniqueStackId();
      await createStack(stacksDir, stackId, {
        name: "Test Stack",
        version: "2.5.0",
        author: "@vince",
        description: "A versioned stack",
        agents: ["frontend-developer"],
        skills: [],
      });

      const result = await compileStackPlugin({
        stackId,
        outputDir,
        projectRoot,
      });

      expect(result.manifest.name).toBe(stackId);
      expect(result.manifest.description).toBe("A versioned stack");
      expect(result.manifest.version).toBe("1.0.0"); // Semver versioning
      expect(result.manifest.author?.name).toBe("@vince");
    });

    it("should return stack name from config", async () => {
      const { agentsDir, stacksDir } = await createProjectStructure();

      await createAgent(agentsDir, "frontend-developer", {
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read"],
      });

      const stackId = uniqueStackId();
      await createStack(stacksDir, stackId, {
        name: "Modern React Stack",
        version: "1.0.0",
        author: "@test",
        agents: ["frontend-developer"],
        skills: [],
      });

      const result = await compileStackPlugin({
        stackId,
        outputDir,
        projectRoot,
      });

      expect(result.stackName).toBe("Modern React Stack");
    });
  });

  // =============================================================================
  // compileStackPlugin - Error Handling Tests
  // =============================================================================

  describe("compileStackPlugin - error handling", () => {
    it("should throw error when stack config is missing", async () => {
      await createProjectStructure();

      await expect(
        compileStackPlugin({
          stackId: "nonexistent-stack",
          outputDir,
          projectRoot,
        }),
      ).rejects.toThrow();
    });

    it("should throw error when agent is missing", async () => {
      const { stacksDir } = await createProjectStructure();

      const stackId = uniqueStackId();
      await createStack(stacksDir, stackId, {
        name: "Test Stack",
        version: "1.0.0",
        author: "@test",
        agents: ["missing-agent"],
        skills: [],
      });

      await expect(
        compileStackPlugin({
          stackId,
          outputDir,
          projectRoot,
        }),
      ).rejects.toThrow();
    });

    it("should throw error when skill is missing", async () => {
      const { agentsDir, stacksDir } = await createProjectStructure();

      await createAgent(agentsDir, "frontend-developer", {
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read"],
      });

      // Stack references a skill that doesn't exist
      const stackId = uniqueStackId();
      await createStack(stacksDir, stackId, {
        name: "Test Stack",
        version: "1.0.0",
        author: "@test",
        agents: ["frontend-developer"],
        skills: [{ id: "missing-skill", preloaded: true }],
      });

      await expect(
        compileStackPlugin({
          stackId,
          outputDir,
          projectRoot,
        }),
      ).rejects.toThrow();
    });
  });

  // =============================================================================
  // compileStackPlugin - Edge Cases
  // =============================================================================

  describe("compileStackPlugin - edge cases", () => {
    it("should handle stack with no skills", async () => {
      const { agentsDir, stacksDir } = await createProjectStructure();

      await createAgent(agentsDir, "frontend-developer", {
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read"],
      });

      const stackId = uniqueStackId();
      await createStack(stacksDir, stackId, {
        name: "Test Stack",
        version: "1.0.0",
        author: "@test",
        agents: ["frontend-developer"],
        skills: [],
      });

      const result = await compileStackPlugin({
        stackId,
        outputDir,
        projectRoot,
      });

      expect(result.skillPlugins).toHaveLength(0);

      // README should not have "Required Skill Plugins" section
      const readmePath = path.join(result.pluginPath, "README.md");
      const readmeContent = await readFile(readmePath, "utf-8");
      expect(readmeContent).not.toContain("## Required Skill Plugins");
    });

    it("should handle stack with no tags", async () => {
      const { agentsDir, stacksDir } = await createProjectStructure();

      await createAgent(agentsDir, "frontend-developer", {
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read"],
      });

      const stackId = uniqueStackId();
      await createStack(stacksDir, stackId, {
        name: "Test Stack",
        version: "1.0.0",
        author: "@test",
        agents: ["frontend-developer"],
        skills: [],
        // No tags
      });

      const result = await compileStackPlugin({
        stackId,
        outputDir,
        projectRoot,
      });

      const readmePath = path.join(result.pluginPath, "README.md");
      const readmeContent = await readFile(readmePath, "utf-8");
      expect(readmeContent).not.toContain("## Tags");
    });

    it("should handle stack with no philosophy", async () => {
      const { agentsDir, stacksDir } = await createProjectStructure();

      await createAgent(agentsDir, "frontend-developer", {
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read"],
      });

      const stackId = uniqueStackId();
      await createStack(stacksDir, stackId, {
        name: "Test Stack",
        version: "1.0.0",
        author: "@test",
        agents: ["frontend-developer"],
        skills: [],
        // No philosophy
      });

      const result = await compileStackPlugin({
        stackId,
        outputDir,
        projectRoot,
      });

      const readmePath = path.join(result.pluginPath, "README.md");
      const readmeContent = await readFile(readmePath, "utf-8");
      expect(readmeContent).not.toContain("## Philosophy");
    });

    it("should handle stack with no principles", async () => {
      const { agentsDir, stacksDir } = await createProjectStructure();

      await createAgent(agentsDir, "frontend-developer", {
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read"],
      });

      const stackId = uniqueStackId();
      await createStack(stacksDir, stackId, {
        name: "Test Stack",
        version: "1.0.0",
        author: "@test",
        agents: ["frontend-developer"],
        skills: [],
        // No principles
      });

      const result = await compileStackPlugin({
        stackId,
        outputDir,
        projectRoot,
      });

      const readmePath = path.join(result.pluginPath, "README.md");
      const readmeContent = await readFile(readmePath, "utf-8");
      expect(readmeContent).not.toContain("## Principles");
    });

    it("should handle stack with no description", async () => {
      const { agentsDir, stacksDir } = await createProjectStructure();

      await createAgent(agentsDir, "frontend-developer", {
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read"],
      });

      const stackId = uniqueStackId();
      await createStack(stacksDir, stackId, {
        name: "Test Stack",
        version: "1.0.0",
        author: "@test",
        agents: ["frontend-developer"],
        skills: [],
        // No description
      });

      const result = await compileStackPlugin({
        stackId,
        outputDir,
        projectRoot,
      });

      const readmePath = path.join(result.pluginPath, "README.md");
      const readmeContent = await readFile(readmePath, "utf-8");
      // Should use default description
      expect(readmeContent).toContain("A Claude Code stack plugin.");
    });

    it("should handle stack without CLAUDE.md", async () => {
      const { agentsDir, stacksDir } = await createProjectStructure();

      await createAgent(agentsDir, "frontend-developer", {
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read"],
      });

      const stackId = uniqueStackId();
      await createStack(stacksDir, stackId, {
        name: "Test Stack",
        version: "1.0.0",
        author: "@test",
        agents: ["frontend-developer"],
        skills: [],
      });

      // Don't create CLAUDE.md

      const result = await compileStackPlugin({
        stackId,
        outputDir,
        projectRoot,
      });

      // Plugin should still be created successfully
      expect(result.pluginPath).toBeDefined();

      // CLAUDE.md should not exist in output
      let claudeExists = false;
      try {
        await stat(path.join(result.pluginPath, "CLAUDE.md"));
        claudeExists = true;
      } catch {
        claudeExists = false;
      }
      expect(claudeExists).toBe(false);
    });

    it("should handle multiple agents in a single stack", async () => {
      const { agentsDir, stacksDir } = await createProjectStructure();

      await createAgent(agentsDir, "frontend-developer", {
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read", "Write"],
      });

      await createAgent(agentsDir, "backend-developer", {
        title: "Backend Developer",
        description: "A backend developer agent",
        tools: ["Read", "Write", "Bash"],
      });

      await createAgent(agentsDir, "tester", {
        title: "Tester",
        description: "A tester agent",
        tools: ["Read", "Bash"],
      });

      const stackId = uniqueStackId();
      await createStack(stacksDir, stackId, {
        name: "Full Stack",
        version: "1.0.0",
        author: "@test",
        agents: ["frontend-developer", "backend-developer", "tester"],
        skills: [],
      });

      const result = await compileStackPlugin({
        stackId,
        outputDir,
        projectRoot,
      });

      // All agents should be compiled
      expect(result.agents).toHaveLength(3);
      expect(result.agents).toContain("frontend-developer");
      expect(result.agents).toContain("backend-developer");
      expect(result.agents).toContain("tester");

      // All agent files should exist
      for (const agent of result.agents) {
        const agentPath = path.join(result.pluginPath, "agents", `${agent}.md`);
        const agentStats = await stat(agentPath);
        expect(agentStats.isFile()).toBe(true);
      }
    });

    it("should include skill plugins in README when skills are present", async () => {
      const { agentsDir, stacksDir } = await createProjectStructure();

      await createAgent(agentsDir, "frontend-developer", {
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read"],
      });

      // Create skills in src/skills/ (new architecture)
      // Directory paths are where files live, frontmatter names are canonical IDs
      const reactDirPath = "frontend/framework/react (@vince)";
      const reactCanonicalId = "react (@vince)";
      const zustandDirPath =
        "frontend/client-state-management/zustand (@vince)";
      const zustandCanonicalId = "zustand (@vince)";

      await createSkillInSource(reactDirPath, {
        name: reactCanonicalId,
        description: "React development",
      });

      await createSkillInSource(zustandDirPath, {
        name: zustandCanonicalId,
        description: "State management",
      });

      const stackId = uniqueStackId();
      await createStack(stacksDir, stackId, {
        name: "Test Stack",
        version: "1.0.0",
        author: "@test",
        agents: ["frontend-developer"],
        // Reference by canonical IDs (frontmatter names)
        skills: [
          { id: reactCanonicalId, preloaded: true },
          { id: zustandCanonicalId, preloaded: false },
        ],
      });

      const result = await compileStackPlugin({
        stackId,
        outputDir,
        projectRoot,
      });

      const readmePath = path.join(result.pluginPath, "README.md");
      const readmeContent = await readFile(readmePath, "utf-8");

      // README now uses "Included Skills" with canonical IDs
      expect(readmeContent).toContain("## Included Skills");
      expect(readmeContent).toContain("`react (@vince)`");
      expect(readmeContent).toContain("`zustand (@vince)`");
    });
  });

  // =============================================================================
  // printStackCompilationSummary Tests
  // =============================================================================

  describe("printStackCompilationSummary", () => {
    it("should print stack name and path", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const result: CompiledStackPlugin = {
        pluginPath: "/output/test-stack",
        manifest: { name: "test-stack", version: "1.0.0" },
        stackName: "Test Stack",
        agents: ["frontend-developer"],
        skillPlugins: ["react (@vince)"],
        hasHooks: false,
      };

      printStackCompilationSummary(result);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Test Stack"),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("/output/test-stack"),
      );

      consoleSpy.mockRestore();
    });

    it("should print agent count and list", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const result: CompiledStackPlugin = {
        pluginPath: "/output/test-stack",
        manifest: { name: "test-stack" },
        stackName: "Test Stack",
        agents: ["frontend-developer", "backend-developer", "tester"],
        skillPlugins: [],
        hasHooks: false,
      };

      printStackCompilationSummary(result);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Agents: 3"),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("frontend-developer"),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("backend-developer"),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("tester"),
      );

      consoleSpy.mockRestore();
    });

    it("should print skill plugins when present", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const result: CompiledStackPlugin = {
        pluginPath: "/output/test-stack",
        manifest: { name: "test-stack" },
        stackName: "Test Stack",
        agents: ["frontend-developer"],
        skillPlugins: [
          "react (@vince)",
          "zustand (@vince)",
          "typescript (@vince)",
        ],
        hasHooks: false,
      };

      printStackCompilationSummary(result);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Skills included: 3"),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("react (@vince)"),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("zustand (@vince)"),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("typescript (@vince)"),
      );

      consoleSpy.mockRestore();
    });

    it("should not print skill plugins section when empty", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const result: CompiledStackPlugin = {
        pluginPath: "/output/test-stack",
        manifest: { name: "test-stack" },
        stackName: "Test Stack",
        agents: ["frontend-developer"],
        skillPlugins: [],
        hasHooks: false,
      };

      printStackCompilationSummary(result);

      // Check that "Skills included" was never called
      const calls = consoleSpy.mock.calls.flat().join("\n");
      expect(calls).not.toContain("Skills included");

      consoleSpy.mockRestore();
    });

    it("should print hooks status when enabled", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const result: CompiledStackPlugin = {
        pluginPath: "/output/test-stack",
        manifest: { name: "test-stack" },
        stackName: "Test Stack",
        agents: ["frontend-developer"],
        skillPlugins: [],
        hasHooks: true,
      };

      printStackCompilationSummary(result);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Hooks: enabled"),
      );

      consoleSpy.mockRestore();
    });

    it("should not print hooks status when disabled", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const result: CompiledStackPlugin = {
        pluginPath: "/output/test-stack",
        manifest: { name: "test-stack" },
        stackName: "Test Stack",
        agents: ["frontend-developer"],
        skillPlugins: [],
        hasHooks: false,
      };

      printStackCompilationSummary(result);

      const calls = consoleSpy.mock.calls.flat().join("\n");
      expect(calls).not.toContain("Hooks:");

      consoleSpy.mockRestore();
    });
  });

  // =============================================================================
  // compileStackPlugin - Hooks Tests
  // =============================================================================

  describe("compileStackPlugin - hooks", () => {
    it("should generate hooks/hooks.json when stack has hooks", async () => {
      const { agentsDir, stacksDir } = await createProjectStructure();

      await createAgent(agentsDir, "frontend-developer", {
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read", "Write"],
      });

      const stackId = uniqueStackId();
      await createStack(stacksDir, stackId, {
        name: "Test Stack",
        version: "1.0.0",
        author: "@test",
        agents: ["frontend-developer"],
        skills: [],
        hooks: {
          PostToolUse: [
            {
              matcher: "Write|Edit",
              hooks: [
                {
                  type: "command",
                  command: "${CLAUDE_PLUGIN_ROOT}/scripts/format.sh",
                  timeout: 30,
                },
              ],
            },
          ],
        },
      });

      const result = await compileStackPlugin({
        stackId,
        outputDir,
        projectRoot,
      });

      // Verify hasHooks is true
      expect(result.hasHooks).toBe(true);

      // Verify hooks.json was created
      const hooksJsonPath = path.join(result.pluginPath, "hooks", "hooks.json");
      const hooksContent = await readFile(hooksJsonPath, "utf-8");
      const hooksJson = JSON.parse(hooksContent);

      expect(hooksJson.hooks).toBeDefined();
      expect(hooksJson.hooks.PostToolUse).toBeDefined();
      expect(hooksJson.hooks.PostToolUse).toHaveLength(1);
      expect(hooksJson.hooks.PostToolUse[0].matcher).toBe("Write|Edit");
      expect(hooksJson.hooks.PostToolUse[0].hooks).toHaveLength(1);
      expect(hooksJson.hooks.PostToolUse[0].hooks[0].type).toBe("command");
    });

    it("should include hooks path in manifest when hooks exist", async () => {
      const { agentsDir, stacksDir } = await createProjectStructure();

      await createAgent(agentsDir, "frontend-developer", {
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read"],
      });

      const stackId = uniqueStackId();
      await createStack(stacksDir, stackId, {
        name: "Test Stack",
        version: "1.0.0",
        author: "@test",
        agents: ["frontend-developer"],
        skills: [],
        hooks: {
          SessionStart: [
            {
              hooks: [
                {
                  type: "command",
                  command: "echo 'Session started'",
                },
              ],
            },
          ],
        },
      });

      const result = await compileStackPlugin({
        stackId,
        outputDir,
        projectRoot,
      });

      // Verify manifest includes hooks path
      expect(result.manifest.hooks).toBe("./hooks/hooks.json");
    });

    it("should not generate hooks.json when stack has no hooks", async () => {
      const { agentsDir, stacksDir } = await createProjectStructure();

      await createAgent(agentsDir, "frontend-developer", {
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read"],
      });

      const stackId = uniqueStackId();
      await createStack(stacksDir, stackId, {
        name: "Test Stack",
        version: "1.0.0",
        author: "@test",
        agents: ["frontend-developer"],
        skills: [],
        // No hooks
      });

      const result = await compileStackPlugin({
        stackId,
        outputDir,
        projectRoot,
      });

      // Verify hasHooks is false
      expect(result.hasHooks).toBe(false);

      // Verify hooks directory does not exist
      let hooksExists = false;
      try {
        await stat(path.join(result.pluginPath, "hooks"));
        hooksExists = true;
      } catch {
        hooksExists = false;
      }
      expect(hooksExists).toBe(false);

      // Verify manifest does not include hooks
      expect(result.manifest.hooks).toBeUndefined();
    });

    it("should handle multiple hook events", async () => {
      const { agentsDir, stacksDir } = await createProjectStructure();

      await createAgent(agentsDir, "frontend-developer", {
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read"],
      });

      const stackId = uniqueStackId();
      await createStack(stacksDir, stackId, {
        name: "Test Stack",
        version: "1.0.0",
        author: "@test",
        agents: ["frontend-developer"],
        skills: [],
        hooks: {
          SessionStart: [
            {
              hooks: [
                {
                  type: "command",
                  command: "echo 'Starting'",
                },
              ],
            },
          ],
          PostToolUse: [
            {
              matcher: "Write",
              hooks: [
                {
                  type: "command",
                  command: "npm run format",
                },
              ],
            },
          ],
          SessionEnd: [
            {
              hooks: [
                {
                  type: "command",
                  command: "echo 'Ending'",
                },
              ],
            },
          ],
        },
      });

      const result = await compileStackPlugin({
        stackId,
        outputDir,
        projectRoot,
      });

      const hooksJsonPath = path.join(result.pluginPath, "hooks", "hooks.json");
      const hooksContent = await readFile(hooksJsonPath, "utf-8");
      const hooksJson = JSON.parse(hooksContent);

      expect(Object.keys(hooksJson.hooks)).toHaveLength(3);
      expect(hooksJson.hooks.SessionStart).toBeDefined();
      expect(hooksJson.hooks.PostToolUse).toBeDefined();
      expect(hooksJson.hooks.SessionEnd).toBeDefined();
    });

    it("should handle hooks without matcher", async () => {
      const { agentsDir, stacksDir } = await createProjectStructure();

      await createAgent(agentsDir, "frontend-developer", {
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read"],
      });

      const stackId = uniqueStackId();
      await createStack(stacksDir, stackId, {
        name: "Test Stack",
        version: "1.0.0",
        author: "@test",
        agents: ["frontend-developer"],
        skills: [],
        hooks: {
          SessionStart: [
            {
              hooks: [
                {
                  type: "command",
                  command: "echo 'No matcher'",
                },
              ],
            },
          ],
        },
      });

      const result = await compileStackPlugin({
        stackId,
        outputDir,
        projectRoot,
      });

      const hooksJsonPath = path.join(result.pluginPath, "hooks", "hooks.json");
      const hooksContent = await readFile(hooksJsonPath, "utf-8");
      const hooksJson = JSON.parse(hooksContent);

      expect(hooksJson.hooks.SessionStart[0].matcher).toBeUndefined();
      expect(hooksJson.hooks.SessionStart[0].hooks).toBeDefined();
    });
  });
});
