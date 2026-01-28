import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "path";
import os from "os";
import { mkdtemp, rm, mkdir, writeFile, readFile, stat } from "fs/promises";
import fg from "fast-glob";
import { compileAllSkillPlugins } from "../skill-plugin-compiler";
import { compileStackPlugin } from "../stack-plugin-compiler";
import {
  generateMarketplace,
  writeMarketplace,
  getMarketplaceStats,
} from "../marketplace-generator";
import { validateAllPlugins, validatePlugin } from "../plugin-validator";
import type { Marketplace, PluginManifest } from "../../../types";

// =============================================================================
// Constants
// =============================================================================

const PROJECT_ROOT = path.resolve(__dirname, "../../../..");
const SKILLS_DIR = path.join(PROJECT_ROOT, "src", "skills");
const STACKS_DIR = path.join(PROJECT_ROOT, "src", "stacks");

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Count SKILL.md files in a directory
 */
async function countSkillFiles(dir: string): Promise<number> {
  const files = await fg("**/SKILL.md", { cwd: dir });
  return files.length;
}

/**
 * List stack directories
 */
async function listStacks(): Promise<string[]> {
  const entries = await fg("*/config.yaml", { cwd: STACKS_DIR });
  return entries.map((e) => path.dirname(e));
}

/**
 * Read plugin.json from a plugin directory
 */
async function readPluginManifest(
  pluginDir: string,
): Promise<PluginManifest | null> {
  const manifestPath = path.join(pluginDir, ".claude-plugin", "plugin.json");
  try {
    const content = await readFile(manifestPath, "utf-8");
    return JSON.parse(content) as PluginManifest;
  } catch {
    return null;
  }
}

/**
 * Check if a path exists
 */
async function pathExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

// =============================================================================
// Test 1: Full Skill Pipeline
// =============================================================================

describe("Integration: Full Skill Pipeline", () => {
  let tempDir: string;
  let outputDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "skill-pipeline-test-"));
    outputDir = path.join(tempDir, "plugins");
    await mkdir(outputDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("should compile all skills to plugins without errors", async () => {
    // Suppress console output during test
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Get expected skill count before compilation
    const expectedSkillCount = await countSkillFiles(SKILLS_DIR);
    expect(expectedSkillCount).toBeGreaterThan(0);

    // Compile all skills
    const results = await compileAllSkillPlugins(SKILLS_DIR, outputDir);

    // Should compile at least most skills (some may fail due to missing frontmatter)
    // Use 90% threshold to allow for a few failures
    const MIN_SUCCESS_RATE = 0.9;
    expect(results.length).toBeGreaterThanOrEqual(
      Math.floor(expectedSkillCount * MIN_SUCCESS_RATE),
    );

    // Each result should have valid structure
    for (const result of results) {
      expect(result.pluginPath).toBeTruthy();
      expect(result.manifest.name).toMatch(/^skill-/);
      expect(result.skillName).toBeTruthy();
    }

    consoleSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("should validate all compiled skill plugins", async () => {
    // Suppress console output during test
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Compile all skills
    await compileAllSkillPlugins(SKILLS_DIR, outputDir);

    // Validate all plugins
    const validationResult = await validateAllPlugins(outputDir);

    // All compiled plugins should be valid
    expect(validationResult.summary.total).toBeGreaterThan(0);
    expect(validationResult.summary.invalid).toBe(0);

    // Log any warnings for debugging (but don't fail on warnings)
    if (validationResult.summary.withWarnings > 0) {
      const warnings = validationResult.results
        .filter((r) => r.result.warnings.length > 0)
        .map((r) => `${r.name}: ${r.result.warnings.join(", ")}`);
      console.log("Warnings found:", warnings.slice(0, 5)); // Log first 5
    }

    consoleSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("should generate marketplace with correct plugin count", async () => {
    // Suppress console output during test
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Compile all skills
    const compileResults = await compileAllSkillPlugins(SKILLS_DIR, outputDir);

    // Generate marketplace
    const marketplace = await generateMarketplace(outputDir, {
      name: "test-marketplace",
      ownerName: "Test Owner",
      pluginRoot: "./plugins",
    });

    // Marketplace should have same number of plugins as compiled
    expect(marketplace.plugins.length).toBe(compileResults.length);

    // All plugins should have valid names
    for (const plugin of marketplace.plugins) {
      expect(plugin.name).toMatch(/^skill-/);
      expect(plugin.source).toBeTruthy();
    }

    // Get stats
    const stats = getMarketplaceStats(marketplace);
    expect(stats.total).toBe(compileResults.length);
    expect(Object.keys(stats.byCategory).length).toBeGreaterThan(0);

    consoleSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("should produce plugins with unique names", async () => {
    // Suppress console output during test
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Compile all skills
    const results = await compileAllSkillPlugins(SKILLS_DIR, outputDir);

    // Check for duplicate names
    const names = results.map((r) => r.manifest.name);
    const uniqueNames = new Set(names);

    expect(uniqueNames.size).toBe(names.length);

    consoleSpy.mockRestore();
    warnSpy.mockRestore();
  });
});

// =============================================================================
// Test 2: Full Stack Pipeline
// =============================================================================

describe("Integration: Full Stack Pipeline", () => {
  let tempDir: string;
  let outputDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "stack-pipeline-test-"));
    outputDir = path.join(tempDir, "stacks");
    await mkdir(outputDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("should list available stacks", async () => {
    const stacks = await listStacks();

    // Should have at least one stack
    expect(stacks.length).toBeGreaterThan(0);

    // Known stacks that should exist
    const expectedStacks = ["fullstack-react", "work-stack"];
    for (const expected of expectedStacks) {
      expect(stacks).toContain(expected);
    }
  });

  it("should compile fullstack-react stack successfully", async () => {
    const stackId = "fullstack-react";

    const result = await compileStackPlugin({
      stackId,
      outputDir,
      projectRoot: PROJECT_ROOT,
    });

    // Verify result structure
    expect(result.pluginPath).toBe(path.join(outputDir, stackId));
    expect(result.stackName).toBeTruthy();
    expect(result.agents.length).toBeGreaterThan(0);

    // Verify plugin directory structure
    expect(await pathExists(result.pluginPath)).toBe(true);
    expect(await pathExists(path.join(result.pluginPath, "agents"))).toBe(true);
    expect(
      await pathExists(
        path.join(result.pluginPath, ".claude-plugin", "plugin.json"),
      ),
    ).toBe(true);
    expect(await pathExists(path.join(result.pluginPath, "README.md"))).toBe(
      true,
    );

    // Verify manifest
    const manifest = await readPluginManifest(result.pluginPath);
    expect(manifest).not.toBeNull();
    expect(manifest!.name).toBe(stackId);
    expect(manifest!.agents).toBe("./agents/");
  });

  it("should compile work-stack successfully", async () => {
    const stackId = "work-stack";

    const result = await compileStackPlugin({
      stackId,
      outputDir,
      projectRoot: PROJECT_ROOT,
    });

    // Verify result structure
    expect(result.pluginPath).toBe(path.join(outputDir, stackId));
    expect(result.stackName).toBeTruthy();
    expect(result.agents.length).toBeGreaterThan(0);

    // Verify plugin directory structure
    expect(await pathExists(result.pluginPath)).toBe(true);
    expect(await pathExists(path.join(result.pluginPath, "agents"))).toBe(true);

    // Verify manifest
    const manifest = await readPluginManifest(result.pluginPath);
    expect(manifest).not.toBeNull();
    expect(manifest!.name).toBe(stackId);
  });

  it("should generate README with agent list", async () => {
    const stackId = "fullstack-react";

    const result = await compileStackPlugin({
      stackId,
      outputDir,
      projectRoot: PROJECT_ROOT,
    });

    const readmePath = path.join(result.pluginPath, "README.md");
    const readme = await readFile(readmePath, "utf-8");

    // README should contain section headers
    expect(readme).toContain("# ");
    expect(readme).toContain("## Agents");
    expect(readme).toContain("## Installation");

    // README should list agents
    for (const agent of result.agents) {
      expect(readme).toContain(agent);
    }
  });

  it("should include skill plugin references in manifest", async () => {
    const stackId = "fullstack-react";

    const result = await compileStackPlugin({
      stackId,
      outputDir,
      projectRoot: PROJECT_ROOT,
    });

    // Should reference skill plugins
    expect(result.skillPlugins.length).toBeGreaterThan(0);

    // Skill references now use canonical frontmatter names (e.g., "react (@vince)")
    for (const skillPlugin of result.skillPlugins) {
      // Should be in format: name (@author) - simplified IDs, generic terms may have category prefix with /
      expect(skillPlugin).toMatch(/^[a-z0-9+\-\/]+ \(@\w+\)$/i);
    }
  });

  it("should validate compiled stack plugins", async () => {
    const stackId = "fullstack-react";

    await compileStackPlugin({
      stackId,
      outputDir,
      projectRoot: PROJECT_ROOT,
    });

    const pluginPath = path.join(outputDir, stackId);
    const validationResult = await validatePlugin(pluginPath);

    // Stack plugin should be valid
    expect(validationResult.valid).toBe(true);
    expect(validationResult.errors).toHaveLength(0);
  });
});

// =============================================================================
// Test 3: Marketplace Integrity
// =============================================================================

describe("Integration: Marketplace Integrity", () => {
  let tempDir: string;
  let pluginsDir: string;
  let marketplacePath: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "marketplace-test-"));
    pluginsDir = path.join(tempDir, "plugins");
    marketplacePath = path.join(tempDir, "marketplace.json");
    await mkdir(pluginsDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("should generate valid marketplace.json", async () => {
    // Suppress console output during test
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Compile all skills
    await compileAllSkillPlugins(SKILLS_DIR, pluginsDir);

    // Generate and write marketplace
    const marketplace = await generateMarketplace(pluginsDir, {
      name: "claude-collective",
      version: "1.0.0",
      description: "Claude Collective Skills Marketplace",
      ownerName: "Claude Collective",
      ownerEmail: "hello@example.com",
      pluginRoot: "./plugins",
    });

    await writeMarketplace(marketplacePath, marketplace);

    // Read and parse the written file
    const content = await readFile(marketplacePath, "utf-8");
    const parsed = JSON.parse(content) as Marketplace;

    // Verify structure
    expect(parsed.$schema).toBe(
      "https://anthropic.com/claude-code/marketplace.schema.json",
    );
    expect(parsed.name).toBe("claude-collective");
    expect(parsed.version).toBe("1.0.0");
    expect(parsed.owner.name).toBe("Claude Collective");
    expect(parsed.owner.email).toBe("hello@example.com");
    expect(parsed.metadata?.pluginRoot).toBe("./plugins");
    expect(parsed.plugins.length).toBeGreaterThan(0);

    consoleSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("should have no duplicate plugin names", async () => {
    // Suppress console output during test
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Compile all skills
    await compileAllSkillPlugins(SKILLS_DIR, pluginsDir);

    // Generate marketplace
    const marketplace = await generateMarketplace(pluginsDir, {
      name: "test-marketplace",
      ownerName: "Test Owner",
      pluginRoot: "./plugins",
    });

    // Check for duplicate names
    const names = marketplace.plugins.map((p) => p.name);
    const uniqueNames = new Set(names);

    expect(uniqueNames.size).toBe(names.length);

    consoleSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("should have all plugin source paths resolvable", async () => {
    // Suppress console output during test
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Compile all skills
    await compileAllSkillPlugins(SKILLS_DIR, pluginsDir);

    // Generate marketplace
    const marketplace = await generateMarketplace(pluginsDir, {
      name: "test-marketplace",
      ownerName: "Test Owner",
      pluginRoot: "./plugins",
    });

    // Verify each source path resolves
    for (const plugin of marketplace.plugins) {
      if (typeof plugin.source === "string") {
        // Convert marketplace relative path to absolute path
        // Source is like "./plugins/skill-react" -> need to resolve from tempDir
        const relativePath = plugin.source.replace("./plugins/", "");
        const absolutePath = path.join(pluginsDir, relativePath);

        const exists = await pathExists(absolutePath);
        expect(exists).toBe(true);
      }
    }

    consoleSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("should have plugins sorted alphabetically", async () => {
    // Suppress console output during test
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Compile all skills
    await compileAllSkillPlugins(SKILLS_DIR, pluginsDir);

    // Generate marketplace
    const marketplace = await generateMarketplace(pluginsDir, {
      name: "test-marketplace",
      ownerName: "Test Owner",
      pluginRoot: "./plugins",
    });

    // Verify alphabetical order
    const names = marketplace.plugins.map((p) => p.name);
    const sortedNames = [...names].sort((a, b) => a.localeCompare(b));

    expect(names).toEqual(sortedNames);

    consoleSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("should categorize plugins correctly", async () => {
    // Suppress console output during test
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Compile all skills
    await compileAllSkillPlugins(SKILLS_DIR, pluginsDir);

    // Generate marketplace
    const marketplace = await generateMarketplace(pluginsDir, {
      name: "test-marketplace",
      ownerName: "Test Owner",
      pluginRoot: "./plugins",
    });

    const stats = getMarketplaceStats(marketplace);

    // Should have multiple categories
    expect(Object.keys(stats.byCategory).length).toBeGreaterThan(1);

    // Common categories that should exist
    const expectedCategories = ["frontend", "backend"];
    for (const category of expectedCategories) {
      expect(stats.byCategory[category]).toBeGreaterThan(0);
    }

    consoleSpy.mockRestore();
    warnSpy.mockRestore();
  });
});

// =============================================================================
// Test 4: End-to-End Pipeline (Skills + Stacks + Marketplace)
// =============================================================================

describe("Integration: End-to-End Pipeline", () => {
  let tempDir: string;
  let pluginsDir: string;
  let stacksDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "e2e-pipeline-test-"));
    pluginsDir = path.join(tempDir, "plugins");
    stacksDir = path.join(tempDir, "stacks");
    await mkdir(pluginsDir, { recursive: true });
    await mkdir(stacksDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("should compile skills then stacks in sequence", async () => {
    // Suppress console output during test
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Step 1: Compile all skills
    const skillResults = await compileAllSkillPlugins(SKILLS_DIR, pluginsDir);
    expect(skillResults.length).toBeGreaterThan(0);

    // Step 2: Validate skill plugins
    const skillValidation = await validateAllPlugins(pluginsDir);
    expect(skillValidation.summary.invalid).toBe(0);

    // Step 3: Compile a stack
    const stackResult = await compileStackPlugin({
      stackId: "fullstack-react",
      outputDir: stacksDir,
      projectRoot: PROJECT_ROOT,
    });
    expect(stackResult.agents.length).toBeGreaterThan(0);

    // Step 4: Validate stack plugin
    const stackValidation = await validatePlugin(stackResult.pluginPath);
    expect(stackValidation.valid).toBe(true);

    // Step 5: Generate marketplace for skills
    const marketplace = await generateMarketplace(pluginsDir, {
      name: "test-marketplace",
      ownerName: "Test Owner",
      pluginRoot: "./plugins",
    });
    expect(marketplace.plugins.length).toBe(skillResults.length);

    consoleSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("should have valid skill plugin reference format", async () => {
    // Suppress console output during test
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Compile stack
    const stackResult = await compileStackPlugin({
      stackId: "fullstack-react",
      outputDir: stacksDir,
      projectRoot: PROJECT_ROOT,
    });

    // Skill references now use simplified canonical frontmatter names (e.g., "react (@vince)")
    expect(stackResult.skillPlugins.length).toBeGreaterThan(0);

    for (const skillPlugin of stackResult.skillPlugins) {
      // Should be in format: name (@author) - simplified IDs, generic terms may have category prefix with /
      // Examples: "react (@vince)", "hono (@vince)", "frontend/accessibility (@vince)"
      expect(skillPlugin).toMatch(/^[a-z0-9+\-\/]+ \(@\w+\)$/i);
    }

    consoleSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("should compile skills and stacks that share common patterns", async () => {
    // Suppress console output during test
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Compile skills
    const skillResults = await compileAllSkillPlugins(SKILLS_DIR, pluginsDir);

    // Compile stack
    const stackResult = await compileStackPlugin({
      stackId: "fullstack-react",
      outputDir: stacksDir,
      projectRoot: PROJECT_ROOT,
    });

    // Get skill plugin names from compiled plugins (format: "skill-xxx")
    const compiledPluginNames = new Set(
      skillResults.map((r) => r.manifest.name),
    );

    // Stack skill references now use simplified canonical frontmatter names (e.g., "react (@vince)")
    // Compiled plugins use "skill-xxx" format (e.g., "skill-react")
    // To compare, extract the base name from both:
    // - Stack: "react (@vince)" -> "react"
    // - Plugin: "skill-react" -> "react"
    const extractBaseName = (id: string) => {
      // For canonical IDs like "react (@vince)"
      // Remove " (@author)" suffix
      if (id.includes("(@")) {
        return id.replace(/\s*\(@\w+\)$/, "").trim();
      }
      // For plugin names like "skill-react"
      return id.replace(/^skill-/, "");
    };

    const stackBaseNames = new Set(
      stackResult.skillPlugins.map(extractBaseName),
    );
    const compiledBaseNames = new Set(
      skillResults.map((r) => extractBaseName(r.manifest.name)),
    );

    // There should be SOME overlap between stack skill references and compiled skills
    // (e.g., both should have "react", "zustand", "vitest", etc.)
    const commonSkills = [...stackBaseNames].filter((name) =>
      compiledBaseNames.has(name),
    );

    // Expect at least a few common skills (core framework skills like react)
    expect(commonSkills.length).toBeGreaterThan(0);

    consoleSpy.mockRestore();
    warnSpy.mockRestore();
  });
});
