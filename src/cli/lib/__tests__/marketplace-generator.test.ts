import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import os from "os";
import { mkdtemp, rm, mkdir, writeFile, readFile } from "fs/promises";
import {
  generateMarketplace,
  writeMarketplace,
  getMarketplaceStats,
} from "../marketplace-generator";
import type { Marketplace, MarketplacePlugin } from "../../../types";

describe("marketplace-generator", () => {
  let tempDir: string;
  let pluginsDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "marketplace-test-"));
    pluginsDir = path.join(tempDir, "plugins");
    await mkdir(pluginsDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  // Helper to create a plugin with manifest
  async function createPlugin(
    name: string,
    manifest: Record<string, unknown>,
  ): Promise<void> {
    const pluginDir = path.join(pluginsDir, name);
    await mkdir(path.join(pluginDir, ".claude-plugin"), { recursive: true });
    await writeFile(
      path.join(pluginDir, ".claude-plugin", "plugin.json"),
      JSON.stringify(manifest, null, 2),
    );
    await writeFile(path.join(pluginDir, "README.md"), `# ${name}`);
  }

  // =============================================================================
  // generateMarketplace
  // =============================================================================

  describe("generateMarketplace", () => {
    it("should include all plugins from directory", async () => {
      await createPlugin("skill-react", {
        name: "skill-react",
        description: "React skills",
        version: "1.0.0",
      });
      await createPlugin("skill-vue", {
        name: "skill-vue",
        description: "Vue skills",
        version: "1.0.0",
      });

      const marketplace = await generateMarketplace(pluginsDir, {
        name: "test-marketplace",
        ownerName: "Test Owner",
        pluginRoot: "./plugins",
      });

      expect(marketplace.plugins).toHaveLength(2);
      const names = marketplace.plugins.map((p) => p.name);
      expect(names).toContain("skill-react");
      expect(names).toContain("skill-vue");
    });

    it("should extract category from keywords", async () => {
      await createPlugin("skill-react", {
        name: "skill-react",
        description: "React framework",
        version: "1.0.0",
      });

      const marketplace = await generateMarketplace(pluginsDir, {
        name: "test-marketplace",
        ownerName: "Test Owner",
        pluginRoot: "./plugins",
      });

      // skill-react should match frontend category pattern
      const reactPlugin = marketplace.plugins.find(
        (p) => p.name === "skill-react",
      );
      expect(reactPlugin?.category).toBe("frontend");
    });

    it("should sort plugins alphabetically", async () => {
      await createPlugin("skill-zustand", {
        name: "skill-zustand",
        description: "Zustand state",
        version: "1.0.0",
      });
      await createPlugin("skill-axios", {
        name: "skill-axios",
        description: "Axios HTTP",
        version: "1.0.0",
      });
      await createPlugin("skill-mobx", {
        name: "skill-mobx",
        description: "MobX state",
        version: "1.0.0",
      });

      const marketplace = await generateMarketplace(pluginsDir, {
        name: "test-marketplace",
        ownerName: "Test Owner",
        pluginRoot: "./plugins",
      });

      const names = marketplace.plugins.map((p) => p.name);
      expect(names).toEqual(["skill-axios", "skill-mobx", "skill-zustand"]);
    });

    it("should include marketplace metadata", async () => {
      await createPlugin("skill-test", {
        name: "skill-test",
        description: "Test",
        version: "1.0.0",
      });

      const marketplace = await generateMarketplace(pluginsDir, {
        name: "my-marketplace",
        version: "2.0.0",
        description: "My awesome marketplace",
        ownerName: "Claude",
        ownerEmail: "claude@example.com",
        pluginRoot: "./dist/plugins",
      });

      expect(marketplace.name).toBe("my-marketplace");
      expect(marketplace.version).toBe("2.0.0");
      expect(marketplace.description).toBe("My awesome marketplace");
      expect(marketplace.owner.name).toBe("Claude");
      expect(marketplace.owner.email).toBe("claude@example.com");
      expect(marketplace.metadata?.pluginRoot).toBe("./dist/plugins");
    });

    it("should include $schema field", async () => {
      await createPlugin("skill-test", {
        name: "skill-test",
        description: "Test",
        version: "1.0.0",
      });

      const marketplace = await generateMarketplace(pluginsDir, {
        name: "test-marketplace",
        ownerName: "Test Owner",
        pluginRoot: "./plugins",
      });

      expect(marketplace.$schema).toBe(
        "https://anthropic.com/claude-code/marketplace.schema.json",
      );
    });

    it("should use default version 1.0.0 when not specified", async () => {
      await createPlugin("skill-test", {
        name: "skill-test",
        description: "Test",
        version: "1.0.0",
      });

      const marketplace = await generateMarketplace(pluginsDir, {
        name: "test-marketplace",
        ownerName: "Test Owner",
        pluginRoot: "./plugins",
      });

      expect(marketplace.version).toBe("1.0.0");
    });

    it("should handle empty plugins directory", async () => {
      const marketplace = await generateMarketplace(pluginsDir, {
        name: "empty-marketplace",
        ownerName: "Test Owner",
        pluginRoot: "./plugins",
      });

      expect(marketplace.plugins).toHaveLength(0);
    });

    it("should skip directories without valid plugin.json", async () => {
      // Create a valid plugin
      await createPlugin("skill-valid", {
        name: "skill-valid",
        description: "Valid plugin",
        version: "1.0.0",
      });

      // Create an invalid directory (no .claude-plugin)
      await mkdir(path.join(pluginsDir, "not-a-plugin"), { recursive: true });
      await writeFile(
        path.join(pluginsDir, "not-a-plugin", "README.md"),
        "# Not a plugin",
      );

      const marketplace = await generateMarketplace(pluginsDir, {
        name: "test-marketplace",
        ownerName: "Test Owner",
        pluginRoot: "./plugins",
      });

      expect(marketplace.plugins).toHaveLength(1);
      expect(marketplace.plugins[0].name).toBe("skill-valid");
    });

    it("should include plugin author in marketplace entry", async () => {
      await createPlugin("skill-with-author", {
        name: "skill-with-author",
        description: "Plugin with author",
        version: "1.0.0",
        author: {
          name: "@vince",
          email: "vince@example.com",
        },
      });

      const marketplace = await generateMarketplace(pluginsDir, {
        name: "test-marketplace",
        ownerName: "Test Owner",
        pluginRoot: "./plugins",
      });

      const plugin = marketplace.plugins[0];
      expect(plugin.author?.name).toBe("@vince");
      expect(plugin.author?.email).toBe("vince@example.com");
    });

    it("should include plugin keywords in marketplace entry", async () => {
      await createPlugin("skill-with-keywords", {
        name: "skill-with-keywords",
        description: "Plugin with keywords",
        version: "1.0.0",
        keywords: ["frontend", "react", "ui"],
      });

      const marketplace = await generateMarketplace(pluginsDir, {
        name: "test-marketplace",
        ownerName: "Test Owner",
        pluginRoot: "./plugins",
      });

      const plugin = marketplace.plugins[0];
      expect(plugin.keywords).toEqual(["frontend", "react", "ui"]);
    });

    it("should generate correct source paths for plugins", async () => {
      await createPlugin("skill-test", {
        name: "skill-test",
        description: "Test plugin",
        version: "1.0.0",
      });

      const marketplace = await generateMarketplace(pluginsDir, {
        name: "test-marketplace",
        ownerName: "Test Owner",
        pluginRoot: "./dist/plugins",
      });

      const plugin = marketplace.plugins[0];
      expect(plugin.source).toBe("./dist/plugins/skill-test");
    });
  });

  // =============================================================================
  // writeMarketplace
  // =============================================================================

  describe("writeMarketplace", () => {
    it("should create parent directories", async () => {
      const marketplace: Marketplace = {
        $schema: "https://anthropic.com/claude-code/marketplace.schema.json",
        name: "test",
        version: "1.0.0",
        owner: { name: "Test" },
        plugins: [],
      };

      const nestedPath = path.join(
        tempDir,
        "nested",
        "dir",
        "marketplace.json",
      );
      await writeMarketplace(nestedPath, marketplace);

      const content = await readFile(nestedPath, "utf-8");
      expect(JSON.parse(content).name).toBe("test");
    });

    it("should write valid JSON", async () => {
      const marketplace: Marketplace = {
        $schema: "https://anthropic.com/claude-code/marketplace.schema.json",
        name: "valid-marketplace",
        version: "1.0.0",
        description: "Test description",
        owner: { name: "Test Owner", email: "test@example.com" },
        plugins: [
          {
            name: "skill-react",
            source: "./plugins/skill-react",
            description: "React skills",
            version: "1.0.0",
          },
        ],
      };

      const outputPath = path.join(tempDir, "marketplace.json");
      await writeMarketplace(outputPath, marketplace);

      const content = await readFile(outputPath, "utf-8");
      const parsed = JSON.parse(content);

      expect(parsed.name).toBe("valid-marketplace");
      expect(parsed.version).toBe("1.0.0");
      expect(parsed.plugins).toHaveLength(1);
      expect(parsed.plugins[0].name).toBe("skill-react");
    });

    it("should include $schema field", async () => {
      const marketplace: Marketplace = {
        $schema: "https://anthropic.com/claude-code/marketplace.schema.json",
        name: "test",
        version: "1.0.0",
        owner: { name: "Test" },
        plugins: [],
      };

      const outputPath = path.join(tempDir, "marketplace.json");
      await writeMarketplace(outputPath, marketplace);

      const content = await readFile(outputPath, "utf-8");
      const parsed = JSON.parse(content);

      expect(parsed.$schema).toBe(
        "https://anthropic.com/claude-code/marketplace.schema.json",
      );
    });

    it("should format JSON with 2-space indentation", async () => {
      const marketplace: Marketplace = {
        name: "test",
        version: "1.0.0",
        owner: { name: "Test" },
        plugins: [],
      };

      const outputPath = path.join(tempDir, "marketplace.json");
      await writeMarketplace(outputPath, marketplace);

      const content = await readFile(outputPath, "utf-8");
      // Check for 2-space indentation
      expect(content).toContain('  "name"');
      expect(content).toContain('  "version"');
    });

    it("should add trailing newline", async () => {
      const marketplace: Marketplace = {
        name: "test",
        version: "1.0.0",
        owner: { name: "Test" },
        plugins: [],
      };

      const outputPath = path.join(tempDir, "marketplace.json");
      await writeMarketplace(outputPath, marketplace);

      const content = await readFile(outputPath, "utf-8");
      expect(content.endsWith("\n")).toBe(true);
    });
  });

  // =============================================================================
  // getMarketplaceStats
  // =============================================================================

  describe("getMarketplaceStats", () => {
    it("should count total plugins", () => {
      const marketplace: Marketplace = {
        name: "test",
        version: "1.0.0",
        owner: { name: "Test" },
        plugins: [
          { name: "plugin-1", source: "./p1" },
          { name: "plugin-2", source: "./p2" },
          { name: "plugin-3", source: "./p3" },
        ],
      };

      const stats = getMarketplaceStats(marketplace);
      expect(stats.total).toBe(3);
    });

    it("should count by category", () => {
      const marketplace: Marketplace = {
        name: "test",
        version: "1.0.0",
        owner: { name: "Test" },
        plugins: [
          { name: "skill-react", source: "./p1", category: "frontend" },
          { name: "skill-vue", source: "./p2", category: "frontend" },
          { name: "skill-express", source: "./p3", category: "backend" },
          { name: "skill-vitest", source: "./p4", category: "testing" },
        ],
      };

      const stats = getMarketplaceStats(marketplace);

      expect(stats.byCategory.frontend).toBe(2);
      expect(stats.byCategory.backend).toBe(1);
      expect(stats.byCategory.testing).toBe(1);
    });

    it("should categorize plugins without category as uncategorized", () => {
      const marketplace: Marketplace = {
        name: "test",
        version: "1.0.0",
        owner: { name: "Test" },
        plugins: [
          { name: "skill-react", source: "./p1", category: "frontend" },
          { name: "skill-unknown", source: "./p2" }, // No category
          { name: "skill-misc", source: "./p3" }, // No category
        ],
      };

      const stats = getMarketplaceStats(marketplace);

      expect(stats.byCategory.frontend).toBe(1);
      expect(stats.byCategory.uncategorized).toBe(2);
    });

    it("should handle empty plugins array", () => {
      const marketplace: Marketplace = {
        name: "test",
        version: "1.0.0",
        owner: { name: "Test" },
        plugins: [],
      };

      const stats = getMarketplaceStats(marketplace);

      expect(stats.total).toBe(0);
      expect(Object.keys(stats.byCategory)).toHaveLength(0);
    });

    it("should handle single plugin", () => {
      const marketplace: Marketplace = {
        name: "test",
        version: "1.0.0",
        owner: { name: "Test" },
        plugins: [{ name: "skill-solo", source: "./p1", category: "tools" }],
      };

      const stats = getMarketplaceStats(marketplace);

      expect(stats.total).toBe(1);
      expect(stats.byCategory.tools).toBe(1);
    });

    it("should return correct stats structure", () => {
      const marketplace: Marketplace = {
        name: "test",
        version: "1.0.0",
        owner: { name: "Test" },
        plugins: [
          { name: "p1", source: "./p1", category: "a" },
          { name: "p2", source: "./p2", category: "b" },
        ],
      };

      const stats = getMarketplaceStats(marketplace);

      expect(stats).toHaveProperty("total");
      expect(stats).toHaveProperty("byCategory");
      expect(typeof stats.total).toBe("number");
      expect(typeof stats.byCategory).toBe("object");
    });
  });
});
