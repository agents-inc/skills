import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "path";
import os from "os";
import { mkdtemp, rm, mkdir, writeFile, readFile, stat } from "fs/promises";
import {
  compileSkillPlugin,
  compileAllSkillPlugins,
  printCompilationSummary,
  extractSkillName,
  extractAuthor,
  extractCategory,
} from "../skill-plugin-compiler";

describe("skill-plugin-compiler", () => {
  let tempDir: string;
  let skillsDir: string;
  let outputDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "skill-compiler-test-"));
    skillsDir = path.join(tempDir, "skills");
    outputDir = path.join(tempDir, "output");
    await mkdir(skillsDir, { recursive: true });
    await mkdir(outputDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  // =============================================================================
  // extractSkillName
  // =============================================================================

  describe("extractSkillName", () => {
    it("should extract name from path with author", () => {
      const result = extractSkillName("/skills/frontend/react (@vince)");
      expect(result).toBe("react");
    });

    it("should extract name from nested path with author", () => {
      const result = extractSkillName(
        "/skills/frontend/framework/react (@vince)",
      );
      expect(result).toBe("react");
    });

    it("should handle plus signs in name", () => {
      const result = extractSkillName("/skills/frontend/c++ (@dev)");
      expect(result).toBe("c--");
    });

    it("should handle multiple plus signs", () => {
      const result = extractSkillName("/skills/tools/boost++ (@lib)");
      expect(result).toBe("boost--");
    });

    it("should handle path without author", () => {
      const result = extractSkillName("/skills/frontend/react");
      expect(result).toBe("react");
    });

    it("should handle simple directory name", () => {
      const result = extractSkillName("react");
      expect(result).toBe("react");
    });

    it("should handle kebab-case names", () => {
      const result = extractSkillName("/skills/backend/api-hono (@vince)");
      expect(result).toBe("api-hono");
    });

    it("should trim whitespace around name", () => {
      const result = extractSkillName("/skills/frontend/react  (@vince)");
      expect(result).toBe("react");
    });
  });

  // =============================================================================
  // extractAuthor
  // =============================================================================

  describe("extractAuthor", () => {
    it("should extract author from parentheses", () => {
      const result = extractAuthor("/skills/frontend/react (@vince)");
      expect(result).toBe("vince");
    });

    it("should return undefined when no author", () => {
      const result = extractAuthor("/skills/frontend/react");
      expect(result).toBeUndefined();
    });

    it("should handle author at end of path", () => {
      const result = extractAuthor("react (@claude)");
      expect(result).toBe("claude");
    });

    it("should handle underscores in author name", () => {
      const result = extractAuthor("/skills/frontend/react (@user_name)");
      expect(result).toBe("user_name");
    });

    it("should return undefined for malformed author syntax", () => {
      const result = extractAuthor("/skills/frontend/react (vince)");
      expect(result).toBeUndefined();
    });

    it("should extract author from deeply nested path", () => {
      const result = extractAuthor(
        "/home/user/projects/skills/frontend/framework/react (@dev)",
      );
      expect(result).toBe("dev");
    });
  });

  // =============================================================================
  // extractCategory
  // =============================================================================

  describe("extractCategory", () => {
    it("should extract category from relative path", () => {
      const skillPath = "/home/skills/frontend/react (@vince)";
      const skillsRoot = "/home/skills";
      const result = extractCategory(skillPath, skillsRoot);
      expect(result).toBe("frontend");
    });

    it("should return undefined for skill at root level", () => {
      const skillPath = "/home/skills/react";
      const skillsRoot = "/home/skills";
      const result = extractCategory(skillPath, skillsRoot);
      expect(result).toBeUndefined();
    });

    it("should extract first directory as category", () => {
      const skillPath = "/home/skills/backend/api/hono (@vince)";
      const skillsRoot = "/home/skills";
      const result = extractCategory(skillPath, skillsRoot);
      expect(result).toBe("backend");
    });
  });

  // =============================================================================
  // compileSkillPlugin (integration tests)
  // =============================================================================

  describe("compileSkillPlugin", () => {
    async function createTestSkill(
      skillName: string,
      frontmatter: Record<string, string>,
      content = "# Skill Content",
      metadata?: Record<string, unknown>,
    ): Promise<string> {
      const skillPath = path.join(skillsDir, `${skillName} (@test)`);
      await mkdir(skillPath, { recursive: true });

      // Create SKILL.md with frontmatter
      const frontmatterYaml = Object.entries(frontmatter)
        .map(([key, value]) => `${key}: ${value}`)
        .join("\n");
      const skillMd = `---\n${frontmatterYaml}\n---\n\n${content}`;
      await writeFile(path.join(skillPath, "SKILL.md"), skillMd);

      // Create metadata.yaml if provided
      if (metadata) {
        const metadataYaml = Object.entries(metadata)
          .map(([key, value]) => {
            if (Array.isArray(value)) {
              return `${key}:\n${value.map((v) => `  - ${v}`).join("\n")}`;
            }
            return `${key}: ${value}`;
          })
          .join("\n");
        await writeFile(path.join(skillPath, "metadata.yaml"), metadataYaml);
      }

      return skillPath;
    }

    it("should create plugin directory structure", async () => {
      const skillPath = await createTestSkill("react", {
        name: "react",
        description: "React skills",
      });

      const result = await compileSkillPlugin({
        skillPath,
        outputDir,
      });

      const pluginDir = result.pluginPath;
      const stats = await stat(pluginDir);
      expect(stats.isDirectory()).toBe(true);

      const skillsSubDir = path.join(pluginDir, "skills", "react");
      const skillsStats = await stat(skillsSubDir);
      expect(skillsStats.isDirectory()).toBe(true);
    });

    it("should generate valid plugin.json", async () => {
      const skillPath = await createTestSkill("zustand", {
        name: "zustand",
        description: "State management with Zustand",
      });

      const result = await compileSkillPlugin({
        skillPath,
        outputDir,
      });

      const manifestPath = path.join(
        result.pluginPath,
        ".claude-plugin",
        "plugin.json",
      );
      const content = await readFile(manifestPath, "utf-8");
      const manifest = JSON.parse(content);

      expect(manifest.name).toBe("skill-zustand");
      expect(manifest.version).toBe(1);
      expect(manifest.content_hash).toMatch(/^[a-f0-9]{7}$/);
      expect(manifest.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(manifest.skills).toBe("./skills/");
    });

    it("should copy SKILL.md with frontmatter", async () => {
      const frontmatter = {
        name: "tailwind",
        description: "Tailwind CSS styling",
      };
      const skillPath = await createTestSkill(
        "tailwind",
        frontmatter,
        "# Tailwind Content\n\nStyling guide.",
      );

      const result = await compileSkillPlugin({
        skillPath,
        outputDir,
      });

      const copiedSkillMd = path.join(
        result.pluginPath,
        "skills",
        "tailwind",
        "SKILL.md",
      );
      const content = await readFile(copiedSkillMd, "utf-8");

      expect(content).toContain("---");
      expect(content).toContain("name: tailwind");
      expect(content).toContain("description: Tailwind CSS styling");
      expect(content).toContain("# Tailwind Content");
    });

    it("should copy examples directory when present", async () => {
      const skillPath = await createTestSkill("vitest", {
        name: "vitest",
        description: "Testing with Vitest",
      });

      // Create examples directory
      const examplesDir = path.join(skillPath, "examples");
      await mkdir(examplesDir, { recursive: true });
      await writeFile(
        path.join(examplesDir, "basic.test.ts"),
        "// test example",
      );

      const result = await compileSkillPlugin({
        skillPath,
        outputDir,
      });

      const copiedExamples = path.join(
        result.pluginPath,
        "skills",
        "vitest",
        "examples",
      );
      const stats = await stat(copiedExamples);
      expect(stats.isDirectory()).toBe(true);

      const exampleContent = await readFile(
        path.join(copiedExamples, "basic.test.ts"),
        "utf-8",
      );
      expect(exampleContent).toBe("// test example");
    });

    it("should generate README.md", async () => {
      const skillPath = await createTestSkill("mobx", {
        name: "mobx",
        description: "State management with MobX",
      });

      const result = await compileSkillPlugin({
        skillPath,
        outputDir,
      });

      const readmePath = path.join(result.pluginPath, "README.md");
      const content = await readFile(readmePath, "utf-8");

      expect(content).toContain("# mobx");
      expect(content).toContain("State management with MobX");
      expect(content).toContain("## Installation");
      expect(content).toContain("skill-mobx");
    });

    it("should include tags in README when metadata has tags", async () => {
      const skillPath = await createTestSkill(
        "react-query",
        {
          name: "react-query",
          description: "Data fetching with React Query",
        },
        "# React Query",
        { tags: ["frontend", "data", "async"] },
      );

      const result = await compileSkillPlugin({
        skillPath,
        outputDir,
      });

      const readmePath = path.join(result.pluginPath, "README.md");
      const content = await readFile(readmePath, "utf-8");

      expect(content).toContain("## Tags");
      expect(content).toContain("`frontend`");
      expect(content).toContain("`data`");
      expect(content).toContain("`async`");
    });

    it("should use custom skill name when provided", async () => {
      const skillPath = await createTestSkill("original", {
        name: "original",
        description: "Original skill",
      });

      const result = await compileSkillPlugin({
        skillPath,
        outputDir,
        skillName: "custom-name",
      });

      expect(result.skillName).toBe("custom-name");
      expect(result.manifest.name).toBe("skill-custom-name");
    });

    it("should throw error when SKILL.md is missing", async () => {
      const skillPath = path.join(skillsDir, "missing-skill");
      await mkdir(skillPath, { recursive: true });
      // Don't create SKILL.md

      await expect(
        compileSkillPlugin({ skillPath, outputDir }),
      ).rejects.toThrow(/is missing required SKILL\.md file/);
    });

    it("should throw error when frontmatter is invalid", async () => {
      const skillPath = path.join(skillsDir, "bad-skill");
      await mkdir(skillPath, { recursive: true });
      await writeFile(
        path.join(skillPath, "SKILL.md"),
        "# No frontmatter here",
      );

      await expect(
        compileSkillPlugin({ skillPath, outputDir }),
      ).rejects.toThrow(/has invalid or missing YAML frontmatter/);
    });

    it("should extract author from directory name", async () => {
      const skillPath = await createTestSkill("react", {
        name: "react",
        description: "React skills",
      });

      const result = await compileSkillPlugin({
        skillPath,
        outputDir,
      });

      // Author should be @test (from (@test) in path)
      expect(result.manifest.author?.name).toBe("@test");
    });

    it("should use hash-based versioning on recompile", async () => {
      const skillPath = await createTestSkill(
        "simple",
        {
          name: "simple",
          description: "Simple skill",
        },
        "# Simple version 1",
      );

      // First compile
      const result1 = await compileSkillPlugin({
        skillPath,
        outputDir,
      });

      expect(result1.manifest.version).toBe(1);
      const originalHash = result1.manifest.content_hash;

      // Recompile without changes - version should stay the same
      const result2 = await compileSkillPlugin({
        skillPath,
        outputDir,
      });

      expect(result2.manifest.version).toBe(1);
      expect(result2.manifest.content_hash).toBe(originalHash);

      // Modify the skill content
      await writeFile(
        path.join(skillPath, "SKILL.md"),
        `---
name: simple
description: Simple skill
---

# Simple version 2 - updated content`,
      );

      // Recompile with changes - version should bump
      const result3 = await compileSkillPlugin({
        skillPath,
        outputDir,
      });

      expect(result3.manifest.version).toBe(2);
      expect(result3.manifest.content_hash).not.toBe(originalHash);
    });
  });

  // =============================================================================
  // compileAllSkillPlugins
  // =============================================================================

  describe("compileAllSkillPlugins", () => {
    async function createTestSkill(
      skillName: string,
      frontmatter: Record<string, string>,
      content = "# Skill Content",
      subDir = "",
    ): Promise<string> {
      const basePath = subDir ? path.join(skillsDir, subDir) : skillsDir;
      const skillPath = path.join(basePath, `${skillName} (@test)`);
      await mkdir(skillPath, { recursive: true });

      const frontmatterYaml = Object.entries(frontmatter)
        .map(([key, value]) => `${key}: ${value}`)
        .join("\n");
      const skillMd = `---\n${frontmatterYaml}\n---\n\n${content}`;
      await writeFile(path.join(skillPath, "SKILL.md"), skillMd);

      return skillPath;
    }

    it("should compile multiple skills from directory", async () => {
      await createTestSkill(
        "react",
        { name: "react", description: "React skills" },
        "# React",
        "frontend",
      );
      await createTestSkill(
        "zustand",
        { name: "zustand", description: "State management" },
        "# Zustand",
        "frontend",
      );
      await createTestSkill(
        "hono",
        { name: "hono", description: "API framework" },
        "# Hono",
        "backend",
      );

      const results = await compileAllSkillPlugins(skillsDir, outputDir);

      expect(results).toHaveLength(3);
      const skillNames = results.map((r) => r.skillName);
      expect(skillNames).toContain("react");
      expect(skillNames).toContain("zustand");
      expect(skillNames).toContain("hono");
    });

    it("should create plugin directories for each skill", async () => {
      await createTestSkill(
        "react",
        { name: "react", description: "React skills" },
        "# React",
        "frontend",
      );
      await createTestSkill(
        "hono",
        { name: "hono", description: "API framework" },
        "# Hono",
        "backend",
      );

      const results = await compileAllSkillPlugins(skillsDir, outputDir);

      for (const result of results) {
        const stats = await stat(result.pluginPath);
        expect(stats.isDirectory()).toBe(true);
      }
    });

    it("should handle empty skills directory", async () => {
      const results = await compileAllSkillPlugins(skillsDir, outputDir);
      expect(results).toHaveLength(0);
    });

    it("should prefix skill names with category when name collision detected", async () => {
      // Create two skills with same name in different categories
      await createTestSkill(
        "utils",
        { name: "utils", description: "Frontend utils" },
        "# Frontend Utils",
        "frontend",
      );
      await createTestSkill(
        "utils",
        { name: "utils", description: "Backend utils" },
        "# Backend Utils",
        "backend",
      );

      const results = await compileAllSkillPlugins(skillsDir, outputDir);

      expect(results).toHaveLength(2);
      const skillNames = results.map((r) => r.skillName).sort();
      expect(skillNames).toContain("backend-utils");
      expect(skillNames).toContain("frontend-utils");
    });

    it("should continue compiling other skills when one fails", async () => {
      // Create valid skill
      await createTestSkill(
        "react",
        { name: "react", description: "React skills" },
        "# React",
        "frontend",
      );

      // Create invalid skill (no frontmatter)
      const badSkillPath = path.join(skillsDir, "backend", "bad-skill");
      await mkdir(badSkillPath, { recursive: true });
      await writeFile(path.join(badSkillPath, "SKILL.md"), "# No frontmatter");

      // Create another valid skill
      await createTestSkill(
        "zustand",
        { name: "zustand", description: "State" },
        "# Zustand",
        "frontend",
      );

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const results = await compileAllSkillPlugins(skillsDir, outputDir);

      // Should have compiled the valid skills
      expect(results).toHaveLength(2);
      const skillNames = results.map((r) => r.skillName);
      expect(skillNames).toContain("react");
      expect(skillNames).toContain("zustand");

      // Should have warned about the failed skill
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[WARN]"),
      );

      consoleSpy.mockRestore();
    });

    it("should log success messages for compiled skills", async () => {
      await createTestSkill(
        "react",
        { name: "react", description: "React skills" },
        "# React",
        "frontend",
      );

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await compileAllSkillPlugins(skillsDir, outputDir);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("[OK]"));
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("skill-react"),
      );

      consoleSpy.mockRestore();
    });

    it("should return correct manifest for each compiled skill", async () => {
      await createTestSkill(
        "react",
        { name: "react", description: "React skills" },
        "# React",
        "frontend",
      );
      await createTestSkill(
        "hono",
        { name: "hono", description: "API framework" },
        "# Hono",
        "backend",
      );

      const results = await compileAllSkillPlugins(skillsDir, outputDir);

      for (const result of results) {
        expect(result.manifest.name).toMatch(/^skill-/);
        expect(result.manifest.version).toBe(1);
        expect(result.manifest.content_hash).toMatch(/^[a-f0-9]{7}$/);
      }
    });
  });

  // =============================================================================
  // printCompilationSummary
  // =============================================================================

  describe("printCompilationSummary", () => {
    it("should print count of compiled plugins", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const results = [
        {
          pluginPath: "/out/skill-react",
          manifest: { name: "skill-react", version: 1 },
          skillName: "react",
        },
        {
          pluginPath: "/out/skill-zustand",
          manifest: { name: "skill-zustand", version: 2 },
          skillName: "zustand",
        },
        {
          pluginPath: "/out/skill-hono",
          manifest: { name: "skill-hono", version: 3 },
          skillName: "hono",
        },
      ];

      printCompilationSummary(results);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Compiled 3 skill plugins"),
      );

      consoleSpy.mockRestore();
    });

    it("should print each skill name with version", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const results = [
        {
          pluginPath: "/out/skill-react",
          manifest: { name: "skill-react", version: 1 },
          skillName: "react",
        },
        {
          pluginPath: "/out/skill-zustand",
          manifest: { name: "skill-zustand", version: 5 },
          skillName: "zustand",
        },
      ];

      printCompilationSummary(results);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("skill-react"),
      );
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("v1"));
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("skill-zustand"),
      );
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("v5"));

      consoleSpy.mockRestore();
    });

    it("should handle empty results array", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      printCompilationSummary([]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Compiled 0 skill plugins"),
      );

      consoleSpy.mockRestore();
    });

    it("should handle single result", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const results = [
        {
          pluginPath: "/out/skill-react",
          manifest: { name: "skill-react", version: 1 },
          skillName: "react",
        },
      ];

      printCompilationSummary(results);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Compiled 1 skill plugins"),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("skill-react"),
      );

      consoleSpy.mockRestore();
    });
  });
});
