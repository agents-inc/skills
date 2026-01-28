import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "path";
import os from "os";
import { mkdtemp, rm, mkdir, writeFile } from "fs/promises";
import { loadSkillsMatrixFromSource } from "./source-loader";
import { PROJECT_ROOT } from "../consts";

describe("source-loader", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "cc-source-loader-test-"));
    // Clear environment
    delete process.env.CC_SOURCE;
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
    delete process.env.CC_SOURCE;
  });

  describe("loadSkillsMatrixFromSource", () => {
    describe("dev mode detection", () => {
      it("should detect dev mode when running from project with local skills", async () => {
        // When running from the actual project, it should use local mode
        // This test verifies the dev mode detection works
        const result = await loadSkillsMatrixFromSource({
          projectDir: tempDir,
        });

        // Should load from local PROJECT_ROOT in dev mode
        expect(result.isLocal).toBe(true);
        expect(result.matrix).toBeDefined();
        expect(result.matrix.skills).toBeDefined();
      });

      it("should use source flag when provided", async () => {
        // Using an explicit local path as source
        const result = await loadSkillsMatrixFromSource({
          sourceFlag: PROJECT_ROOT,
          projectDir: tempDir,
        });

        expect(result.isLocal).toBe(true);
        expect(result.sourceConfig.source).toBe(PROJECT_ROOT);
        expect(result.sourceConfig.sourceOrigin).toBe("flag");
      });
    });

    describe("local source loading", () => {
      it("should load matrix from local source", async () => {
        const result = await loadSkillsMatrixFromSource({
          sourceFlag: PROJECT_ROOT,
          projectDir: tempDir,
        });

        expect(result.matrix).toBeDefined();
        expect(result.matrix.version).toBeDefined();
        expect(result.matrix.categories).toBeDefined();
        expect(result.matrix.skills).toBeDefined();
        expect(Object.keys(result.matrix.skills).length).toBeGreaterThan(0);
      });

      it("should set sourcePath to the root path", async () => {
        const result = await loadSkillsMatrixFromSource({
          sourceFlag: PROJECT_ROOT,
          projectDir: tempDir,
        });

        expect(result.sourcePath).toBe(PROJECT_ROOT);
      });

      it("should mark result as local", async () => {
        const result = await loadSkillsMatrixFromSource({
          sourceFlag: PROJECT_ROOT,
          projectDir: tempDir,
        });

        expect(result.isLocal).toBe(true);
      });
    });

    describe("error handling", () => {
      it("should throw error for non-existent local path", async () => {
        await expect(
          loadSkillsMatrixFromSource({
            sourceFlag: "/non/existent/path",
            projectDir: tempDir,
          }),
        ).rejects.toThrow();
      });

      it("should throw error if skills-matrix.yaml is missing", async () => {
        // Create a directory without skills-matrix.yaml
        const emptySource = path.join(tempDir, "empty-source");
        await mkdir(emptySource, { recursive: true });

        await expect(
          loadSkillsMatrixFromSource({
            sourceFlag: emptySource,
            projectDir: tempDir,
          }),
        ).rejects.toThrow();
      });
    });
  });
});

describe("source-loader integration", () => {
  it("should load all skills from local source", async () => {
    const result = await loadSkillsMatrixFromSource({
      sourceFlag: PROJECT_ROOT,
    });

    // Verify we loaded a reasonable number of skills
    const skillCount = Object.keys(result.matrix.skills).length;
    expect(skillCount).toBeGreaterThan(50); // We know there are 70+ skills

    // Verify skills have required properties
    const firstSkill = Object.values(result.matrix.skills)[0];
    expect(firstSkill.id).toBeDefined();
    expect(firstSkill.name).toBeDefined();
    expect(firstSkill.category).toBeDefined();
    expect(firstSkill.path).toBeDefined();
  });

  it("should load suggested stacks", async () => {
    const result = await loadSkillsMatrixFromSource({
      sourceFlag: PROJECT_ROOT,
    });

    expect(result.matrix.suggestedStacks).toBeDefined();
    expect(result.matrix.suggestedStacks.length).toBeGreaterThan(0);

    // Verify stack structure
    const firstStack = result.matrix.suggestedStacks[0];
    expect(firstStack.id).toBeDefined();
    expect(firstStack.name).toBeDefined();
    expect(firstStack.allSkillIds).toBeDefined();
    expect(firstStack.allSkillIds.length).toBeGreaterThan(0);
  });

  it("should load categories", async () => {
    const result = await loadSkillsMatrixFromSource({
      sourceFlag: PROJECT_ROOT,
    });

    expect(result.matrix.categories).toBeDefined();
    const categoryCount = Object.keys(result.matrix.categories).length;
    expect(categoryCount).toBeGreaterThan(10); // We know there are 20+ categories
  });
});
