#!/usr/bin/env node
/**
 * Simple Markdown Preprocessor
 *
 * Processes .src.md files and resolves @include(path) directives
 * Usage: node compile.mjs [source-file]
 */

import fs from "fs/promises";
import { glob } from "glob";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AGENTS_DIR = path.resolve(__dirname, "..", "agents");
const SOURCES_DIR = path.join(__dirname, "sources");

/**
 * Recursively resolves @include() directives in content
 * @param {string} content - The content to process
 * @param {string} basePath - Base path for resolving relative includes
 * @param {Set<string>} visited - Track visited files to prevent circular includes
 * @returns {Promise<string>} - Processed content with includes resolved
 */
async function resolveIncludes(content, basePath, visited = new Set()) {
  const includeRegex = /@include\(([^)]+)\)/g;
  let result = content;
  let hasIncludes = false;

  // Find all @include directives
  const matches = [...content.matchAll(includeRegex)];

  for (const match of matches) {
    hasIncludes = true;
    const relativePath = match[1].trim();
    const absolutePath = path.resolve(basePath, relativePath);

    // Check for circular includes
    if (visited.has(absolutePath)) {
      console.warn(`⚠️  Warning: Circular include detected: ${relativePath}`);
      continue;
    }

    try {
      // Read the included file
      const includeContent = await fs.readFile(absolutePath, "utf-8");

      // Recursively resolve includes in the included content
      visited.add(absolutePath);
      const resolvedContent = await resolveIncludes(
        includeContent,
        path.dirname(absolutePath),
        visited,
      );

      // Replace the @include directive with the resolved content
      result = result.replace(match[0], resolvedContent);
    } catch (error) {
      console.error(`❌ Error including ${relativePath}:`, error.message);
      // Leave the directive in place if file not found
    }
  }

  return result;
}

/**
 * Compile a single source file
 * @param {string} sourceFile - Path to .src.md file
 * @returns {Promise<string>} - Path to output file
 */
async function compile(sourceFile) {
  const sourcePath = path.resolve(sourceFile);
  const fileName = path.basename(sourceFile).replace(".src.md", ".md");
  const outputPath = path.join(AGENTS_DIR, fileName);

  console.log(`📄 Compiling ${path.basename(sourceFile)}...`);

  try {
    // Read source file
    const content = await fs.readFile(sourcePath, "utf-8");

    // Resolve all includes
    const compiled = await resolveIncludes(content, path.dirname(sourcePath), new Set());

    // Write output
    await fs.writeFile(outputPath, compiled, "utf-8");
    console.log(`   ✓ Created ${fileName}`);

    return outputPath;
  } catch (error) {
    console.error(`   ❌ Failed to compile ${path.basename(sourceFile)}:`, error.message);
    throw error;
  }
}

/**
 * Main compilation function
 */
async function main() {
  console.log("======================================================================");
  console.log("🤖 Compiling Claude Code Agents");
  console.log("======================================================================\n");

  // Check if specific file was provided as argument
  const args = process.argv.slice(2);
  let sourceFiles;

  if (args.length > 0) {
    // Compile specific file(s)
    sourceFiles = args;
  } else {
    // Find all .src.md files in _sources directory
    sourceFiles = await glob("*.src.md", { cwd: SOURCES_DIR, absolute: true });
  }

  if (sourceFiles.length === 0) {
    console.log("No .src.md files found to compile.");
    return;
  }

  // Compile all source files
  const results = [];
  for (const sourceFile of sourceFiles) {
    try {
      const outputPath = await compile(sourceFile);
      results.push(outputPath);
    } catch (error) {
      // Error already logged, continue with other files
    }
  }

  console.log("\n======================================================================");
  console.log(`✅ Compilation Complete! (${results.length}/${sourceFiles.length} succeeded)`);
  console.log("======================================================================\n");

  if (results.length > 0) {
    console.log("Compiled agents:");
    results.forEach((file) => console.log(`  - ${path.basename(file)}`));
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("Compilation failed:", error);
    process.exit(1);
  });
}

// Export for programmatic use
export { compile, resolveIncludes };
