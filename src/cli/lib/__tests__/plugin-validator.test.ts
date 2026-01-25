import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import os from "os";
import { mkdtemp, rm, mkdir, writeFile } from "fs/promises";
import {
  validatePluginStructure,
  validatePluginManifest,
  validateSkillFrontmatter,
  validateAgentFrontmatter,
  validatePlugin,
  validateAllPlugins,
} from "../plugin-validator";

describe("plugin-validator", () => {
  let tempDir: string;

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = await mkdtemp(path.join(os.tmpdir(), "plugin-validator-test-"));
  });

  afterEach(async () => {
    // Clean up temporary directory
    await rm(tempDir, { recursive: true, force: true });
  });

  // =============================================================================
  // validatePluginStructure
  // =============================================================================

  describe("validatePluginStructure", () => {
    it("should pass for valid plugin structure", async () => {
      // Create valid plugin structure
      await mkdir(path.join(tempDir, ".claude-plugin"), { recursive: true });
      await writeFile(
        path.join(tempDir, ".claude-plugin", "plugin.json"),
        JSON.stringify({ name: "test-plugin" }),
      );
      await writeFile(path.join(tempDir, "README.md"), "# Test Plugin");

      const result = await validatePluginStructure(tempDir);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it("should fail if plugin directory does not exist", async () => {
      const result = await validatePluginStructure(
        path.join(tempDir, "nonexistent"),
      );

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("does not exist");
    });

    it("should fail if .claude-plugin/plugin.json missing", async () => {
      // Create directory but no .claude-plugin
      const result = await validatePluginStructure(tempDir);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Missing .claude-plugin/ directory");
    });

    it("should fail if plugin.json is missing but .claude-plugin exists", async () => {
      // Create .claude-plugin directory without plugin.json
      await mkdir(path.join(tempDir, ".claude-plugin"), { recursive: true });

      const result = await validatePluginStructure(tempDir);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Missing .claude-plugin/plugin.json");
    });

    it("should warn if README.md is missing", async () => {
      // Create valid structure without README
      await mkdir(path.join(tempDir, ".claude-plugin"), { recursive: true });
      await writeFile(
        path.join(tempDir, ".claude-plugin", "plugin.json"),
        JSON.stringify({ name: "test-plugin" }),
      );

      const result = await validatePluginStructure(tempDir);

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain(
        "Missing README.md (recommended for documentation)",
      );
    });
  });

  // =============================================================================
  // validatePluginManifest
  // =============================================================================

  describe("validatePluginManifest", () => {
    it("should pass for valid manifest", async () => {
      const manifestPath = path.join(tempDir, "plugin.json");
      await writeFile(
        manifestPath,
        JSON.stringify({
          name: "test-plugin",
          version: "1.0.0",
          description: "A test plugin",
        }),
      );

      const result = await validatePluginManifest(manifestPath);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should fail if file does not exist", async () => {
      const result = await validatePluginManifest(
        path.join(tempDir, "nonexistent.json"),
      );

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("not found");
    });

    it("should fail if JSON is invalid", async () => {
      const manifestPath = path.join(tempDir, "plugin.json");
      await writeFile(manifestPath, "{ invalid json }");

      const result = await validatePluginManifest(manifestPath);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("Invalid JSON");
    });

    it("should fail if name missing", async () => {
      const manifestPath = path.join(tempDir, "plugin.json");
      await writeFile(
        manifestPath,
        JSON.stringify({
          version: "1.0.0",
        }),
      );

      const result = await validatePluginManifest(manifestPath);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("name"))).toBe(true);
    });

    it("should fail if name not kebab-case", async () => {
      const manifestPath = path.join(tempDir, "plugin.json");
      await writeFile(
        manifestPath,
        JSON.stringify({
          name: "TestPlugin", // PascalCase - invalid
        }),
      );

      const result = await validatePluginManifest(manifestPath);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("kebab-case"))).toBe(true);
    });

    it("should fail if version is not valid semver", async () => {
      const manifestPath = path.join(tempDir, "plugin.json");
      await writeFile(
        manifestPath,
        JSON.stringify({
          name: "test-plugin",
          version: 1, // Integer - should be semver string
        }),
      );

      const result = await validatePluginManifest(manifestPath);

      // Schema enforces semver string type, so integer version is an error
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("version"))).toBe(true);
    });

    it("should pass with valid semver version", async () => {
      const manifestPath = path.join(tempDir, "plugin.json");
      await writeFile(
        manifestPath,
        JSON.stringify({
          name: "test-plugin",
          version: "3.2.1",
          description: "Test plugin",
        }),
      );

      const result = await validatePluginManifest(manifestPath);

      expect(result.valid).toBe(true);
    });

    it("should fail if version is invalid semver", async () => {
      const manifestPath = path.join(tempDir, "plugin.json");
      await writeFile(
        manifestPath,
        JSON.stringify({
          name: "test-plugin",
          version: "v1.0", // Invalid semver format
        }),
      );

      const result = await validatePluginManifest(manifestPath);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("version"))).toBe(true);
    });

    it("should warn if description missing", async () => {
      const manifestPath = path.join(tempDir, "plugin.json");
      await writeFile(
        manifestPath,
        JSON.stringify({
          name: "test-plugin",
        }),
      );

      const result = await validatePluginManifest(manifestPath);

      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.includes("description"))).toBe(true);
    });

    it("should fail if skills path does not exist", async () => {
      // Create directory structure
      await mkdir(path.join(tempDir, ".claude-plugin"), { recursive: true });
      const manifestPath = path.join(tempDir, ".claude-plugin", "plugin.json");
      await writeFile(
        manifestPath,
        JSON.stringify({
          name: "test-plugin",
          skills: "./skills/",
        }),
      );

      const result = await validatePluginManifest(manifestPath);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("Skills path"))).toBe(true);
    });

    it("should pass if skills path exists", async () => {
      // Create directory structure with skills
      await mkdir(path.join(tempDir, ".claude-plugin"), { recursive: true });
      await mkdir(path.join(tempDir, "skills"), { recursive: true });
      const manifestPath = path.join(tempDir, ".claude-plugin", "plugin.json");
      await writeFile(
        manifestPath,
        JSON.stringify({
          name: "test-plugin",
          description: "Test",
          skills: "./skills/",
        }),
      );

      const result = await validatePluginManifest(manifestPath);

      expect(result.valid).toBe(true);
    });
  });

  // =============================================================================
  // validateSkillFrontmatter
  // =============================================================================

  describe("validateSkillFrontmatter", () => {
    it("should pass for valid frontmatter", async () => {
      const skillPath = path.join(tempDir, "SKILL.md");
      await writeFile(
        skillPath,
        `---
name: test-skill
description: A test skill
---

# Test Skill

Content here.
`,
      );

      const result = await validateSkillFrontmatter(skillPath);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should fail if file does not exist", async () => {
      const result = await validateSkillFrontmatter(
        path.join(tempDir, "SKILL.md"),
      );

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("not found");
    });

    it("should fail if frontmatter missing", async () => {
      const skillPath = path.join(tempDir, "SKILL.md");
      await writeFile(skillPath, "# Test Skill\n\nNo frontmatter here.");

      const result = await validateSkillFrontmatter(skillPath);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("Missing or invalid YAML frontmatter");
    });

    it("should fail if description missing", async () => {
      const skillPath = path.join(tempDir, "SKILL.md");
      await writeFile(
        skillPath,
        `---
name: test-skill
---

# Test Skill
`,
      );

      const result = await validateSkillFrontmatter(skillPath);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("description"))).toBe(true);
    });

    it("should fail if using unrecognized fields", async () => {
      const skillPath = path.join(tempDir, "SKILL.md");
      await writeFile(
        skillPath,
        `---
name: test-skill
description: A test skill
author: "@test"
category: frontend
version: "1.0.0"
---

# Test Skill
`,
      );

      const result = await validateSkillFrontmatter(skillPath);

      // Schema has additionalProperties: false, so extra fields cause errors
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("Unrecognized key"))).toBe(
        true,
      );
    });

    it("should pass with optional runtime fields", async () => {
      const skillPath = path.join(tempDir, "SKILL.md");
      await writeFile(
        skillPath,
        `---
name: test-skill
description: A test skill
model: sonnet
allowed-tools: "Read, Grep, Glob"
disable-model-invocation: false
user-invocable: true
---

# Test Skill
`,
      );

      const result = await validateSkillFrontmatter(skillPath);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // =============================================================================
  // validateAgentFrontmatter
  // =============================================================================

  describe("validateAgentFrontmatter", () => {
    it("should pass for valid frontmatter", async () => {
      const agentPath = path.join(tempDir, "agent.md");
      await writeFile(
        agentPath,
        `---
name: frontend-developer
description: Expert frontend developer
tools: Read, Write, Edit, Grep, Glob
---

# Frontend Developer Agent
`,
      );

      const result = await validateAgentFrontmatter(agentPath);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should fail if file does not exist", async () => {
      const result = await validateAgentFrontmatter(
        path.join(tempDir, "agent.md"),
      );

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("not found");
    });

    it("should fail if name not kebab-case", async () => {
      const agentPath = path.join(tempDir, "agent.md");
      await writeFile(
        agentPath,
        `---
name: FrontendDeveloper
description: Expert frontend developer
---

# Agent
`,
      );

      const result = await validateAgentFrontmatter(agentPath);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("kebab-case"))).toBe(true);
    });

    it("should fail if description missing", async () => {
      const agentPath = path.join(tempDir, "agent.md");
      await writeFile(
        agentPath,
        `---
name: frontend-developer
---

# Agent
`,
      );

      const result = await validateAgentFrontmatter(agentPath);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("description"))).toBe(true);
    });

    it("should pass with skills array", async () => {
      const agentPath = path.join(tempDir, "agent.md");
      await writeFile(
        agentPath,
        `---
name: frontend-developer
description: Expert frontend developer
tools: Read, Write, Edit
skills:
  - skill-react
  - skill-zustand
---

# Agent
`,
      );

      const result = await validateAgentFrontmatter(agentPath);

      expect(result.valid).toBe(true);
    });

    it("should pass with permission mode", async () => {
      const agentPath = path.join(tempDir, "agent.md");
      await writeFile(
        agentPath,
        `---
name: frontend-developer
description: Expert frontend developer
permissionMode: acceptEdits
---

# Agent
`,
      );

      const result = await validateAgentFrontmatter(agentPath);

      expect(result.valid).toBe(true);
    });
  });

  // =============================================================================
  // validatePlugin (full validation)
  // =============================================================================

  describe("validatePlugin", () => {
    it("should pass for complete valid plugin", async () => {
      // Create complete plugin structure
      await mkdir(path.join(tempDir, ".claude-plugin"), { recursive: true });
      await mkdir(path.join(tempDir, "skills", "test-skill"), {
        recursive: true,
      });
      await mkdir(path.join(tempDir, "agents"), { recursive: true });

      // Write manifest
      await writeFile(
        path.join(tempDir, ".claude-plugin", "plugin.json"),
        JSON.stringify({
          name: "test-plugin",
          version: "1.0.0",
          description: "A test plugin",
          skills: "./skills/",
          agents: "./agents/",
        }),
      );

      // Write README
      await writeFile(path.join(tempDir, "README.md"), "# Test Plugin");

      // Write skill
      await writeFile(
        path.join(tempDir, "skills", "test-skill", "SKILL.md"),
        `---
name: test-skill
description: A test skill
---

# Test Skill
`,
      );

      // Write agent
      await writeFile(
        path.join(tempDir, "agents", "test-agent.md"),
        `---
name: test-agent
description: A test agent
tools: Read, Write
---

# Test Agent
`,
      );

      const result = await validatePlugin(tempDir);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should aggregate errors from all validations", async () => {
      // Create plugin with multiple issues
      await mkdir(path.join(tempDir, ".claude-plugin"), { recursive: true });
      await mkdir(path.join(tempDir, "skills", "bad-skill"), {
        recursive: true,
      });

      // Manifest with invalid name
      await writeFile(
        path.join(tempDir, ".claude-plugin", "plugin.json"),
        JSON.stringify({
          name: "BadName", // Not kebab-case
          skills: "./skills/",
        }),
      );

      // Skill with missing description
      await writeFile(
        path.join(tempDir, "skills", "bad-skill", "SKILL.md"),
        `---
name: bad-skill
---

# Bad Skill
`,
      );

      const result = await validatePlugin(tempDir);

      expect(result.valid).toBe(false);
      // Should have errors from manifest (bad name) and skill (missing description)
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });

    it("should warn if skills directory empty", async () => {
      await mkdir(path.join(tempDir, ".claude-plugin"), { recursive: true });
      await mkdir(path.join(tempDir, "skills"), { recursive: true });

      await writeFile(
        path.join(tempDir, ".claude-plugin", "plugin.json"),
        JSON.stringify({
          name: "test-plugin",
          description: "Test",
          skills: "./skills/",
        }),
      );
      await writeFile(path.join(tempDir, "README.md"), "# Test");

      const result = await validatePlugin(tempDir);

      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.includes("no SKILL.md files"))).toBe(
        true,
      );
    });
  });

  // =============================================================================
  // validateAllPlugins
  // =============================================================================

  describe("validateAllPlugins", () => {
    it("should validate multiple plugins", async () => {
      // Create two plugins
      for (const name of ["plugin-one", "plugin-two"]) {
        const pluginDir = path.join(tempDir, name);
        await mkdir(path.join(pluginDir, ".claude-plugin"), {
          recursive: true,
        });
        await writeFile(
          path.join(pluginDir, ".claude-plugin", "plugin.json"),
          JSON.stringify({ name, description: `${name} description` }),
        );
        await writeFile(path.join(pluginDir, "README.md"), `# ${name}`);
      }

      const result = await validateAllPlugins(tempDir);

      expect(result.valid).toBe(true);
      expect(result.summary.total).toBe(2);
      expect(result.summary.valid).toBe(2);
      expect(result.summary.invalid).toBe(0);
    });

    it("should fail if directory does not exist", async () => {
      const result = await validateAllPlugins(
        path.join(tempDir, "nonexistent"),
      );

      expect(result.valid).toBe(false);
      expect(result.results[0].result.errors[0]).toContain("does not exist");
    });

    it("should report mix of valid and invalid plugins", async () => {
      // Create one valid and one invalid plugin
      const validDir = path.join(tempDir, "valid-plugin");
      await mkdir(path.join(validDir, ".claude-plugin"), { recursive: true });
      await writeFile(
        path.join(validDir, ".claude-plugin", "plugin.json"),
        JSON.stringify({ name: "valid-plugin", description: "Valid" }),
      );
      await writeFile(path.join(validDir, "README.md"), "# Valid");

      const invalidDir = path.join(tempDir, "invalid-plugin");
      await mkdir(path.join(invalidDir, ".claude-plugin"), { recursive: true });
      // Invalid plugin.json (missing required name field)
      await writeFile(
        path.join(invalidDir, ".claude-plugin", "plugin.json"),
        JSON.stringify({ description: "Invalid - missing name" }),
      );

      const result = await validateAllPlugins(tempDir);

      expect(result.valid).toBe(false);
      expect(result.summary.total).toBe(2);
      expect(result.summary.valid).toBe(1);
      expect(result.summary.invalid).toBe(1);
    });

    it("should count plugins with warnings", async () => {
      // Create plugin with warnings (missing description)
      const pluginDir = path.join(tempDir, "warn-plugin");
      await mkdir(path.join(pluginDir, ".claude-plugin"), { recursive: true });
      await writeFile(
        path.join(pluginDir, ".claude-plugin", "plugin.json"),
        JSON.stringify({ name: "warn-plugin" }), // Missing description triggers warning
      );
      await writeFile(path.join(pluginDir, "README.md"), "# Warn");

      const result = await validateAllPlugins(tempDir);

      expect(result.valid).toBe(true);
      expect(result.summary.withWarnings).toBe(1);
    });
  });
});
