import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "path";
import os from "os";
import { mkdtemp, rm, mkdir, writeFile, readFile } from "fs/promises";
import {
  DEFAULT_SOURCE,
  SOURCE_ENV_VAR,
  GLOBAL_CONFIG_DIR,
  loadGlobalConfig,
  loadProjectConfig,
  saveGlobalConfig,
  saveProjectConfig,
  resolveSource,
  formatSourceOrigin,
  isLocalSource,
  getGlobalConfigPath,
  getProjectConfigPath,
} from "./config";

describe("config", () => {
  let tempDir: string;

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = await mkdtemp(path.join(os.tmpdir(), "cc-config-test-"));
    // Clear any environment variables
    delete process.env[SOURCE_ENV_VAR];
  });

  afterEach(async () => {
    // Clean up temporary directory
    await rm(tempDir, { recursive: true, force: true });
    // Restore environment
    delete process.env[SOURCE_ENV_VAR];
  });

  describe("DEFAULT_SOURCE", () => {
    it("should be set to the claude-collective skills repo", () => {
      expect(DEFAULT_SOURCE).toBe("github:claude-collective/skills");
    });
  });

  describe("SOURCE_ENV_VAR", () => {
    it("should be CC_SOURCE", () => {
      expect(SOURCE_ENV_VAR).toBe("CC_SOURCE");
    });
  });

  describe("getGlobalConfigPath", () => {
    it("should return path in home directory", () => {
      const configPath = getGlobalConfigPath();
      expect(configPath).toContain(".claude-collective");
      expect(configPath).toContain("config.yaml");
    });
  });

  describe("getProjectConfigPath", () => {
    it("should return path in project .claude-collective directory", () => {
      const configPath = getProjectConfigPath("/my/project");
      expect(configPath).toBe("/my/project/.claude-collective/config.yaml");
    });
  });

  describe("isLocalSource", () => {
    it("should return true for absolute paths", () => {
      expect(isLocalSource("/home/user/skills")).toBe(true);
      expect(isLocalSource("/var/lib/skills")).toBe(true);
    });

    it("should return true for relative paths starting with .", () => {
      expect(isLocalSource("./skills")).toBe(true);
      expect(isLocalSource("../skills")).toBe(true);
      expect(isLocalSource(".")).toBe(true);
    });

    it("should return false for github: URLs", () => {
      expect(isLocalSource("github:org/repo")).toBe(false);
      expect(isLocalSource("gh:org/repo")).toBe(false);
    });

    it("should return false for gitlab: URLs", () => {
      expect(isLocalSource("gitlab:org/repo")).toBe(false);
    });

    it("should return false for https: URLs", () => {
      expect(isLocalSource("https://github.com/org/repo")).toBe(false);
      expect(isLocalSource("http://github.com/org/repo")).toBe(false);
    });

    it("should return true for paths without protocol prefix", () => {
      // Plain directory names without / or . prefix are ambiguous
      // but we treat them as local
      expect(isLocalSource("my-skills")).toBe(true);
    });

    it("should throw error for path traversal in bare names", () => {
      // Bare names (no / or . prefix) with traversal patterns are suspicious
      expect(() => isLocalSource("my-skills/../../../etc")).toThrow(
        /Path traversal patterns are not allowed/,
      );
    });

    it("should throw error for home directory expansion in bare names", () => {
      // Bare names with ~ are suspicious since shell expansion doesn't happen
      expect(() => isLocalSource("skills~backup")).toThrow(
        /Path traversal patterns are not allowed/,
      );
    });

    it("should allow legitimate relative paths with ..", () => {
      // Paths starting with . are recognized as relative and allowed
      expect(isLocalSource("../../../other-project/skills")).toBe(true);
      expect(isLocalSource("../skills")).toBe(true);
    });
  });

  describe("formatSourceOrigin", () => {
    it("should format flag origin", () => {
      expect(formatSourceOrigin("flag")).toBe("--source flag");
    });

    it("should format env origin", () => {
      expect(formatSourceOrigin("env")).toContain(SOURCE_ENV_VAR);
    });

    it("should format project origin", () => {
      expect(formatSourceOrigin("project")).toContain("project config");
    });

    it("should format global origin", () => {
      expect(formatSourceOrigin("global")).toContain("global config");
    });

    it("should format default origin", () => {
      expect(formatSourceOrigin("default")).toBe("default");
    });
  });

  describe("loadProjectConfig", () => {
    it("should return null if config file does not exist", async () => {
      const config = await loadProjectConfig(tempDir);
      expect(config).toBeNull();
    });

    it("should load config from .claude-collective/config.yaml", async () => {
      // Create config file
      const configDir = path.join(tempDir, ".claude-collective");
      await mkdir(configDir, { recursive: true });
      await writeFile(
        path.join(configDir, "config.yaml"),
        "source: github:mycompany/skills\n",
      );

      const config = await loadProjectConfig(tempDir);
      expect(config).toEqual({ source: "github:mycompany/skills" });
    });

    it("should return null for invalid YAML", async () => {
      const configDir = path.join(tempDir, ".claude-collective");
      await mkdir(configDir, { recursive: true });
      await writeFile(
        path.join(configDir, "config.yaml"),
        "invalid: yaml: content: :",
      );

      const config = await loadProjectConfig(tempDir);
      // Should return null or throw - implementation dependent
      // Current implementation catches errors and returns null
      expect(config).toBeNull();
    });
  });

  describe("saveProjectConfig", () => {
    it("should create config directory if it does not exist", async () => {
      await saveProjectConfig(tempDir, { source: "github:test/repo" });

      const configPath = path.join(
        tempDir,
        ".claude-collective",
        "config.yaml",
      );
      const content = await readFile(configPath, "utf-8");
      expect(content).toContain("source: github:test/repo");
    });

    it("should overwrite existing config", async () => {
      // Save initial config
      await saveProjectConfig(tempDir, { source: "github:first/repo" });

      // Save new config
      await saveProjectConfig(tempDir, { source: "github:second/repo" });

      const configPath = path.join(
        tempDir,
        ".claude-collective",
        "config.yaml",
      );
      const content = await readFile(configPath, "utf-8");
      expect(content).toContain("github:second/repo");
      expect(content).not.toContain("github:first/repo");
    });
  });

  describe("resolveSource", () => {
    it("should return flag value with highest priority", async () => {
      // Set environment variable
      process.env[SOURCE_ENV_VAR] = "github:env/repo";

      const result = await resolveSource("github:flag/repo", tempDir);

      expect(result.source).toBe("github:flag/repo");
      expect(result.sourceOrigin).toBe("flag");
    });

    it("should return env value when no flag is provided", async () => {
      process.env[SOURCE_ENV_VAR] = "github:env/repo";

      const result = await resolveSource(undefined, tempDir);

      expect(result.source).toBe("github:env/repo");
      expect(result.sourceOrigin).toBe("env");
    });

    it("should return project config when no flag or env", async () => {
      // Create project config
      const configDir = path.join(tempDir, ".claude-collective");
      await mkdir(configDir, { recursive: true });
      await writeFile(
        path.join(configDir, "config.yaml"),
        "source: github:project/repo\n",
      );

      const result = await resolveSource(undefined, tempDir);

      expect(result.source).toBe("github:project/repo");
      expect(result.sourceOrigin).toBe("project");
    });

    it("should return default when no config is set", async () => {
      const result = await resolveSource(undefined, tempDir);

      expect(result.source).toBe(DEFAULT_SOURCE);
      expect(result.sourceOrigin).toBe("default");
    });

    it("should handle undefined projectDir", async () => {
      const result = await resolveSource(undefined, undefined);

      // Should still work, just skip project config
      expect(result.source).toBe(DEFAULT_SOURCE);
      expect(result.sourceOrigin).toBe("default");
    });

    it("should prioritize flag over all other sources", async () => {
      // Set everything
      process.env[SOURCE_ENV_VAR] = "github:env/repo";
      const configDir = path.join(tempDir, ".claude-collective");
      await mkdir(configDir, { recursive: true });
      await writeFile(
        path.join(configDir, "config.yaml"),
        "source: github:project/repo\n",
      );

      const result = await resolveSource("github:flag/repo", tempDir);

      expect(result.source).toBe("github:flag/repo");
      expect(result.sourceOrigin).toBe("flag");
    });

    it("should prioritize env over project config", async () => {
      process.env[SOURCE_ENV_VAR] = "github:env/repo";
      const configDir = path.join(tempDir, ".claude-collective");
      await mkdir(configDir, { recursive: true });
      await writeFile(
        path.join(configDir, "config.yaml"),
        "source: github:project/repo\n",
      );

      const result = await resolveSource(undefined, tempDir);

      expect(result.source).toBe("github:env/repo");
      expect(result.sourceOrigin).toBe("env");
    });

    it("should throw error for empty source flag", async () => {
      await expect(resolveSource("", tempDir)).rejects.toThrow(
        /--source flag cannot be empty/,
      );
    });

    it("should throw error for whitespace-only source flag", async () => {
      await expect(resolveSource("   ", tempDir)).rejects.toThrow(
        /--source flag cannot be empty/,
      );
    });
  });
});
