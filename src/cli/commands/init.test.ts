import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import os from "os";
import {
  mkdtemp,
  rm,
  mkdir,
  writeFile,
  readFile,
  readdir,
  stat,
} from "fs/promises";
import { copy } from "../utils/fs";

// =============================================================================
// Constants
// =============================================================================

const SKILL_CONTENT = `---
name: test-skill
description: A test skill
category: frontend
---

# Test Skill

This is a test skill for the init command tests.
`;

const SKILL_METADATA = `version: 1
author: test
`;

const PLUGIN_MANIFEST = {
  name: "claude-collective",
  version: "1.0.0",
  license: "MIT",
  skills: "./skills/",
  agents: "./agents/",
};

// =============================================================================
// Test Helpers
// =============================================================================

interface TestDirs {
  tempDir: string;
  projectDir: string;
  pluginDir: string;
}

/**
 * Create test directory structure for init command tests.
 * Simplified architecture:
 * - {project}/.claude/plugins/claude-collective/
 */
async function createTestDirs(): Promise<TestDirs> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "cc-init-test-"));
  const projectDir = path.join(tempDir, "project");
  const pluginDir = path.join(
    projectDir,
    ".claude",
    "plugins",
    "claude-collective",
  );

  // Create project directory
  await mkdir(projectDir, { recursive: true });

  return { tempDir, projectDir, pluginDir };
}

/**
 * Check if a directory exists
 */
async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stats = await stat(dirPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Check if a file exists
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    const stats = await stat(filePath);
    return stats.isFile();
  } catch {
    return false;
  }
}

/**
 * List directories in a path
 */
async function listDirectories(dirPath: string): Promise<string[]> {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

/**
 * Create a mock source directory with skills (simulates marketplace)
 */
async function createMockSource(
  baseDir: string,
  skillNames: string[],
): Promise<string> {
  const sourceDir = path.join(baseDir, "source");
  const skillsDir = path.join(sourceDir, "src", "skills");
  const agentsDir = path.join(sourceDir, "src", "agents");

  await mkdir(skillsDir, { recursive: true });
  await mkdir(agentsDir, { recursive: true });

  for (const skillName of skillNames) {
    const skillDir = path.join(skillsDir, skillName);
    await mkdir(skillDir, { recursive: true });
    await writeFile(path.join(skillDir, "SKILL.md"), SKILL_CONTENT);
    await writeFile(path.join(skillDir, "metadata.yaml"), SKILL_METADATA);
  }

  // Create mock agent definitions
  const agentDir = path.join(agentsDir, "developer", "frontend-developer");
  await mkdir(agentDir, { recursive: true });
  await writeFile(
    path.join(agentDir, "agent.yaml"),
    "name: frontend-developer\ndescription: Test agent",
  );

  return sourceDir;
}

/**
 * Simulate init command for new simplified architecture:
 * 1. Check if plugin exists - if yes, return early
 * 2. Create plugin at .claude/plugins/claude-collective/
 * 3. Copy skills directly to plugin
 * 4. Create plugin manifest
 */
async function simulateInit(
  sourceDir: string,
  skillNames: string[],
  dirs: TestDirs,
): Promise<{ success: boolean; error?: string; alreadyExists?: boolean }> {
  try {
    // Check if plugin already exists
    if (await directoryExists(dirs.pluginDir)) {
      return { success: false, alreadyExists: true };
    }

    // Create plugin directory structure
    await mkdir(path.join(dirs.pluginDir, ".claude-plugin"), {
      recursive: true,
    });
    await mkdir(path.join(dirs.pluginDir, "skills"), { recursive: true });
    await mkdir(path.join(dirs.pluginDir, "agents"), { recursive: true });

    // Copy skills directly to plugin
    for (const skillName of skillNames) {
      const srcSkillDir = path.join(sourceDir, "src", "skills", skillName);
      const destSkillDir = path.join(dirs.pluginDir, "skills", skillName);
      await copy(srcSkillDir, destSkillDir);
    }

    // Write plugin manifest
    await writeFile(
      path.join(dirs.pluginDir, ".claude-plugin", "plugin.json"),
      JSON.stringify(PLUGIN_MANIFEST, null, 2),
    );

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// =============================================================================
// Tests
// =============================================================================

describe("init command (simplified architecture)", () => {
  let dirs: TestDirs;
  let sourceDir: string;

  beforeEach(async () => {
    dirs = await createTestDirs();
    sourceDir = await createMockSource(dirs.tempDir, [
      "react",
      "zustand",
      "nextjs",
    ]);
  });

  afterEach(async () => {
    await rm(dirs.tempDir, { recursive: true, force: true });
  });

  describe("first init (creates plugin directly)", () => {
    it("should create plugin at .claude/plugins/claude-collective/", async () => {
      // Act
      const result = await simulateInit(sourceDir, ["react", "zustand"], dirs);

      // Assert
      expect(result.success).toBe(true);
      expect(await directoryExists(dirs.pluginDir)).toBe(true);
    });

    it("should copy skills directly to plugin skills directory", async () => {
      // Act
      await simulateInit(sourceDir, ["react", "zustand"], dirs);

      // Assert
      const pluginSkillsDir = path.join(dirs.pluginDir, "skills");
      const skills = await listDirectories(pluginSkillsDir);
      expect(skills).toContain("react");
      expect(skills).toContain("zustand");
      expect(skills).toHaveLength(2);
    });

    it("should create plugin manifest at .claude-plugin/plugin.json", async () => {
      // Act
      await simulateInit(sourceDir, ["react"], dirs);

      // Assert
      const manifestPath = path.join(
        dirs.pluginDir,
        ".claude-plugin",
        "plugin.json",
      );
      expect(await fileExists(manifestPath)).toBe(true);

      const content = await readFile(manifestPath, "utf-8");
      const manifest = JSON.parse(content);
      expect(manifest.name).toBe("claude-collective");
      expect(manifest.skills).toBe("./skills/");
      expect(manifest.agents).toBe("./agents/");
    });

    it("should create agents directory in plugin", async () => {
      // Act
      await simulateInit(sourceDir, ["react"], dirs);

      // Assert
      const agentsDir = path.join(dirs.pluginDir, "agents");
      expect(await directoryExists(agentsDir)).toBe(true);
    });

    it("should preserve skill content after copy to plugin", async () => {
      // Act
      await simulateInit(sourceDir, ["react"], dirs);

      // Assert: Plugin skill content
      const pluginSkillContent = await readFile(
        path.join(dirs.pluginDir, "skills", "react", "SKILL.md"),
        "utf-8",
      );
      expect(pluginSkillContent).toContain("# Test Skill");
      expect(pluginSkillContent).toContain("name: test-skill");
    });
  });

  describe("subsequent init (plugin already exists)", () => {
    it("should detect plugin already exists and return early", async () => {
      // Arrange: First init
      await simulateInit(sourceDir, ["react"], dirs);

      // Act: Second init
      const result = await simulateInit(sourceDir, ["zustand"], dirs);

      // Assert
      expect(result.success).toBe(false);
      expect(result.alreadyExists).toBe(true);
    });

    it("should not modify existing plugin when already exists", async () => {
      // Arrange: First init
      await simulateInit(sourceDir, ["react"], dirs);

      // Record plugin state
      const pluginSkillsBefore = await listDirectories(
        path.join(dirs.pluginDir, "skills"),
      );

      // Act: Second init (should fail gracefully)
      await simulateInit(sourceDir, ["zustand", "nextjs"], dirs);

      // Assert: Plugin skills unchanged
      const pluginSkillsAfter = await listDirectories(
        path.join(dirs.pluginDir, "skills"),
      );
      expect(pluginSkillsAfter).toEqual(pluginSkillsBefore);
    });
  });

  describe("directory structure correctness", () => {
    it("should use correct path for plugin: .claude/plugins/claude-collective/", async () => {
      // Act
      await simulateInit(sourceDir, ["react"], dirs);

      // Assert: Full path structure
      const expectedPluginPath = path.join(
        dirs.projectDir,
        ".claude",
        "plugins",
        "claude-collective",
      );
      expect(dirs.pluginDir).toBe(expectedPluginPath);
      expect(await directoryExists(dirs.pluginDir)).toBe(true);
    });

    it("should NOT create any .claude-collective/ directory", async () => {
      // Act
      await simulateInit(sourceDir, ["react"], dirs);

      // Assert: No .claude-collective directory
      const collectiveDir = path.join(dirs.projectDir, ".claude-collective");
      expect(await directoryExists(collectiveDir)).toBe(false);
    });

    it("should create plugin manifest at correct path", async () => {
      // Act
      await simulateInit(sourceDir, ["react"], dirs);

      // Assert
      const manifestPath = path.join(
        dirs.pluginDir,
        ".claude-plugin",
        "plugin.json",
      );
      expect(await fileExists(manifestPath)).toBe(true);
    });

    it("should have agents directory at plugin root", async () => {
      // Act
      await simulateInit(sourceDir, ["react"], dirs);

      // Assert
      const agentsPath = path.join(dirs.pluginDir, "agents");
      expect(await directoryExists(agentsPath)).toBe(true);
    });

    it("should have skills directory at plugin root", async () => {
      // Act
      await simulateInit(sourceDir, ["react"], dirs);

      // Assert
      const skillsPath = path.join(dirs.pluginDir, "skills");
      expect(await directoryExists(skillsPath)).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("should handle empty skill selection", async () => {
      // Act
      const result = await simulateInit(sourceDir, [], dirs);

      // Assert: Should still create directories, just empty
      expect(result.success).toBe(true);
      const pluginSkillsDir = path.join(dirs.pluginDir, "skills");
      expect(await directoryExists(pluginSkillsDir)).toBe(true);
      const skills = await listDirectories(pluginSkillsDir);
      expect(skills).toHaveLength(0);
    });

    it("should handle many skills", async () => {
      // Act
      await simulateInit(sourceDir, ["react", "zustand", "nextjs"], dirs);

      // Assert
      const pluginSkillsDir = path.join(dirs.pluginDir, "skills");
      const skills = await listDirectories(pluginSkillsDir);
      expect(skills).toHaveLength(3);
    });

    it("should create proper directory structure even with no skills", async () => {
      // Act
      await simulateInit(sourceDir, [], dirs);

      // Assert: All required directories exist
      expect(await directoryExists(dirs.pluginDir)).toBe(true);
      expect(await directoryExists(path.join(dirs.pluginDir, "skills"))).toBe(
        true,
      );
      expect(await directoryExists(path.join(dirs.pluginDir, "agents"))).toBe(
        true,
      );
      expect(
        await directoryExists(path.join(dirs.pluginDir, ".claude-plugin")),
      ).toBe(true);
    });
  });

  describe("skills content integrity", () => {
    it("should copy SKILL.md file correctly", async () => {
      // Act
      await simulateInit(sourceDir, ["react"], dirs);

      // Assert
      const skillMdPath = path.join(
        dirs.pluginDir,
        "skills",
        "react",
        "SKILL.md",
      );
      const content = await readFile(skillMdPath, "utf-8");
      expect(content).toContain("# Test Skill");
      expect(content).toContain("name: test-skill");
    });

    it("should copy metadata.yaml file correctly", async () => {
      // Act
      await simulateInit(sourceDir, ["react"], dirs);

      // Assert
      const metadataPath = path.join(
        dirs.pluginDir,
        "skills",
        "react",
        "metadata.yaml",
      );
      const content = await readFile(metadataPath, "utf-8");
      expect(content).toContain("version: 1");
      expect(content).toContain("author: test");
    });
  });

  describe("plugin manifest", () => {
    it("should have correct manifest structure", async () => {
      // Act
      await simulateInit(sourceDir, ["react"], dirs);

      // Assert
      const manifestPath = path.join(
        dirs.pluginDir,
        ".claude-plugin",
        "plugin.json",
      );
      const content = await readFile(manifestPath, "utf-8");
      const manifest = JSON.parse(content);

      expect(manifest.name).toBe("claude-collective");
      expect(manifest.version).toBe("1.0.0");
      expect(manifest.skills).toBe("./skills/");
      expect(manifest.agents).toBe("./agents/");
    });
  });
});
