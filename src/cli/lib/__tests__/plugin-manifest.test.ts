import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import os from "os";
import { mkdtemp, rm, readFile, stat } from "fs/promises";
import {
  generateSkillPluginManifest,
  generateStackPluginManifest,
  writePluginManifest,
  getPluginDir,
  getPluginManifestPath,
} from "../plugin-manifest";

describe("plugin-manifest", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "plugin-manifest-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  // =============================================================================
  // generateSkillPluginManifest
  // =============================================================================

  describe("generateSkillPluginManifest", () => {
    it("should generate manifest with skill- prefix", () => {
      const manifest = generateSkillPluginManifest({
        skillName: "react",
      });

      expect(manifest.name).toBe("skill-react");
    });

    it("should include skills path", () => {
      const manifest = generateSkillPluginManifest({
        skillName: "react",
      });

      expect(manifest.skills).toBe("./skills/");
    });

    it("should not include agents path", () => {
      const manifest = generateSkillPluginManifest({
        skillName: "react",
      });

      expect(manifest.agents).toBeUndefined();
    });

    it("should include author when provided", () => {
      const manifest = generateSkillPluginManifest({
        skillName: "react",
        author: "@vince",
        authorEmail: "vince@example.com",
      });

      expect(manifest.author).toEqual({
        name: "@vince",
        email: "vince@example.com",
      });
    });

    it("should include author without email when only name provided", () => {
      const manifest = generateSkillPluginManifest({
        skillName: "react",
        author: "@vince",
      });

      expect(manifest.author).toEqual({ name: "@vince" });
    });

    it("should include keywords when provided", () => {
      const manifest = generateSkillPluginManifest({
        skillName: "react",
        keywords: ["frontend", "ui", "framework"],
      });

      expect(manifest.keywords).toEqual(["frontend", "ui", "framework"]);
    });

    it("should not include keywords when empty array", () => {
      const manifest = generateSkillPluginManifest({
        skillName: "react",
        keywords: [],
      });

      expect(manifest.keywords).toBeUndefined();
    });

    it("should include description when provided", () => {
      const manifest = generateSkillPluginManifest({
        skillName: "react",
        description: "React skills for frontend development",
      });

      expect(manifest.description).toBe(
        "React skills for frontend development",
      );
    });

    it("should use custom version when provided", () => {
      const manifest = generateSkillPluginManifest({
        skillName: "react",
        version: 5,
      });

      expect(manifest.version).toBe(5);
    });

    it("should default to version 1", () => {
      const manifest = generateSkillPluginManifest({
        skillName: "react",
      });

      expect(manifest.version).toBe(1);
    });

    it("should include content_hash when provided", () => {
      const manifest = generateSkillPluginManifest({
        skillName: "react",
        contentHash: "a1b2c3d",
      });

      expect(manifest.content_hash).toBe("a1b2c3d");
    });

    it("should include updated when provided", () => {
      const manifest = generateSkillPluginManifest({
        skillName: "react",
        updated: "2026-01-25",
      });

      expect(manifest.updated).toBe("2026-01-25");
    });

    it("should include MIT license by default", () => {
      const manifest = generateSkillPluginManifest({
        skillName: "react",
      });

      expect(manifest.license).toBe("MIT");
    });
  });

  // =============================================================================
  // generateStackPluginManifest
  // =============================================================================

  describe("generateStackPluginManifest", () => {
    it("should generate manifest without skill- prefix", () => {
      const manifest = generateStackPluginManifest({
        stackName: "modern-react",
      });

      expect(manifest.name).toBe("modern-react");
    });

    it("should include agents path when hasAgents is true", () => {
      const manifest = generateStackPluginManifest({
        stackName: "modern-react",
        hasAgents: true,
      });

      expect(manifest.agents).toBe("./agents/");
    });

    it("should not include agents when hasAgents is false", () => {
      const manifest = generateStackPluginManifest({
        stackName: "modern-react",
        hasAgents: false,
      });

      expect(manifest.agents).toBeUndefined();
    });

    it("should not include agents when hasAgents is undefined", () => {
      const manifest = generateStackPluginManifest({
        stackName: "modern-react",
      });

      expect(manifest.agents).toBeUndefined();
    });

    it("should include hooks when hasHooks is true", () => {
      const manifest = generateStackPluginManifest({
        stackName: "modern-react",
        hasHooks: true,
      });

      expect(manifest.hooks).toBe("./hooks/hooks.json");
    });

    it("should not include hooks when hasHooks is false", () => {
      const manifest = generateStackPluginManifest({
        stackName: "modern-react",
        hasHooks: false,
      });

      expect(manifest.hooks).toBeUndefined();
    });

    it("should not include skills when hasSkills is undefined", () => {
      const manifest = generateStackPluginManifest({
        stackName: "modern-react",
      });

      expect(manifest.skills).toBeUndefined();
    });

    it("should include skills path when hasSkills is true", () => {
      const manifest = generateStackPluginManifest({
        stackName: "modern-react",
        hasSkills: true,
      });

      expect(manifest.skills).toBe("./skills/");
    });

    it("should not include skills when hasSkills is false", () => {
      const manifest = generateStackPluginManifest({
        stackName: "modern-react",
        hasSkills: false,
      });

      expect(manifest.skills).toBeUndefined();
    });

    it("should include author when provided", () => {
      const manifest = generateStackPluginManifest({
        stackName: "modern-react",
        author: "@claude",
        authorEmail: "claude@example.com",
      });

      expect(manifest.author).toEqual({
        name: "@claude",
        email: "claude@example.com",
      });
    });

    it("should include keywords when provided", () => {
      const manifest = generateStackPluginManifest({
        stackName: "modern-react",
        keywords: ["frontend", "react", "stack"],
      });

      expect(manifest.keywords).toEqual(["frontend", "react", "stack"]);
    });

    it("should default to version 1", () => {
      const manifest = generateStackPluginManifest({
        stackName: "modern-react",
      });

      expect(manifest.version).toBe(1);
    });

    it("should include content_hash when provided", () => {
      const manifest = generateStackPluginManifest({
        stackName: "modern-react",
        contentHash: "b2c3d4e",
      });

      expect(manifest.content_hash).toBe("b2c3d4e");
    });

    it("should include updated when provided", () => {
      const manifest = generateStackPluginManifest({
        stackName: "modern-react",
        updated: "2026-01-25",
      });

      expect(manifest.updated).toBe("2026-01-25");
    });
  });

  // =============================================================================
  // writePluginManifest
  // =============================================================================

  describe("writePluginManifest", () => {
    it("should create .claude-plugin directory", async () => {
      const manifest = generateSkillPluginManifest({ skillName: "test" });

      await writePluginManifest(tempDir, manifest);

      const pluginDir = path.join(tempDir, ".claude-plugin");
      const stats = await stat(pluginDir);
      expect(stats.isDirectory()).toBe(true);
    });

    it("should write valid JSON", async () => {
      const manifest = generateSkillPluginManifest({
        skillName: "test",
        description: "Test skill",
      });

      await writePluginManifest(tempDir, manifest);

      const manifestPath = path.join(tempDir, ".claude-plugin", "plugin.json");
      const content = await readFile(manifestPath, "utf-8");
      const parsed = JSON.parse(content);

      expect(parsed.name).toBe("skill-test");
      expect(parsed.description).toBe("Test skill");
    });

    it("should overwrite existing manifest", async () => {
      const manifest1 = generateSkillPluginManifest({
        skillName: "original",
      });
      const manifest2 = generateSkillPluginManifest({
        skillName: "updated",
      });

      await writePluginManifest(tempDir, manifest1);
      await writePluginManifest(tempDir, manifest2);

      const manifestPath = path.join(tempDir, ".claude-plugin", "plugin.json");
      const content = await readFile(manifestPath, "utf-8");
      const parsed = JSON.parse(content);

      expect(parsed.name).toBe("skill-updated");
    });

    it("should return the manifest path", async () => {
      const manifest = generateSkillPluginManifest({ skillName: "test" });

      const result = await writePluginManifest(tempDir, manifest);

      expect(result).toBe(path.join(tempDir, ".claude-plugin", "plugin.json"));
    });

    it("should format JSON with 2-space indentation", async () => {
      const manifest = generateSkillPluginManifest({
        skillName: "test",
        description: "Test description",
      });

      await writePluginManifest(tempDir, manifest);

      const manifestPath = path.join(tempDir, ".claude-plugin", "plugin.json");
      const content = await readFile(manifestPath, "utf-8");

      // Check for 2-space indentation pattern
      expect(content).toContain('  "name"');
      expect(content).toContain('  "description"');
    });
  });

  // =============================================================================
  // getPluginDir
  // =============================================================================

  describe("getPluginDir", () => {
    it("should return .claude-plugin subdirectory", () => {
      const result = getPluginDir("/some/output/dir");

      expect(result).toBe("/some/output/dir/.claude-plugin");
    });

    it("should handle paths with trailing slash", () => {
      const result = getPluginDir("/some/output/dir/");

      expect(result).toBe("/some/output/dir/.claude-plugin");
    });

    it("should handle relative paths", () => {
      const result = getPluginDir("dist/plugins");

      expect(result).toBe(path.join("dist/plugins", ".claude-plugin"));
    });
  });

  // =============================================================================
  // getPluginManifestPath
  // =============================================================================

  describe("getPluginManifestPath", () => {
    it("should return path to plugin.json", () => {
      const result = getPluginManifestPath("/some/output/dir");

      expect(result).toBe("/some/output/dir/.claude-plugin/plugin.json");
    });

    it("should handle paths with trailing slash", () => {
      const result = getPluginManifestPath("/some/output/dir/");

      expect(result).toBe("/some/output/dir/.claude-plugin/plugin.json");
    });

    it("should handle relative paths", () => {
      const result = getPluginManifestPath("dist/plugins");

      expect(result).toBe(
        path.join("dist/plugins", ".claude-plugin", "plugin.json"),
      );
    });
  });
});
