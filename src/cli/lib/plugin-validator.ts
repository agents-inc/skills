import Ajv, { type ValidateFunction, type ErrorObject } from "ajv";
import addFormats from "ajv-formats";
import path from "path";
import { parse as parseYaml } from "yaml";
import fg from "fast-glob";
import {
  fileExists,
  readFile,
  directoryExists,
  listDirectories,
} from "../utils/fs";
import { PROJECT_ROOT } from "../consts";
import type { ValidationResult } from "../../types";

// =============================================================================
// Constants
// =============================================================================

const PLUGIN_DIR = ".claude-plugin";
const PLUGIN_MANIFEST = "plugin.json";
const SKILL_FILE = "SKILL.md";
const KEBAB_CASE_REGEX = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const SEMVER_REGEX =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

// =============================================================================
// Schema Loading & Caching
// =============================================================================

const schemaCache = new Map<string, object>();
const validatorCache = new Map<string, ValidateFunction>();

async function loadSchema(schemaName: string): Promise<object> {
  if (schemaCache.has(schemaName)) {
    return schemaCache.get(schemaName)!;
  }

  const schemaPath = path.join(PROJECT_ROOT, "src", "schemas", schemaName);
  const content = await readFile(schemaPath);
  const schema = JSON.parse(content);
  schemaCache.set(schemaName, schema);
  return schema;
}

async function getValidator(schemaName: string): Promise<ValidateFunction> {
  if (validatorCache.has(schemaName)) {
    return validatorCache.get(schemaName)!;
  }

  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const schema = await loadSchema(schemaName);
  const validate = ajv.compile(schema);
  validatorCache.set(schemaName, validate);
  return validate;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Format ajv errors into readable strings
 */
function formatAjvErrors(errors: ErrorObject[] | null | undefined): string[] {
  if (!errors) return [];

  return errors.map((err) => {
    const errorPath = err.instancePath
      ? err.instancePath.replace(/^\//, "").replace(/\//g, ".")
      : "";
    const message = err.message || "Unknown error";

    if (err.keyword === "additionalProperties") {
      const prop = (err.params as { additionalProperty?: string })
        .additionalProperty;
      return `Unrecognized key: "${prop}"`;
    }

    if (err.keyword === "enum") {
      const allowed = (err.params as { allowedValues?: string[] })
        .allowedValues;
      return errorPath
        ? `${errorPath}: ${message}. Allowed: ${allowed?.join(", ")}`
        : `${message}. Allowed: ${allowed?.join(", ")}`;
    }

    if (err.keyword === "pattern") {
      // Provide context-appropriate message based on field
      let hint = "";
      if (errorPath === "name") {
        hint = " (must be kebab-case)";
      } else if (errorPath === "version") {
        hint = " (must be semver: x.y.z)";
      }
      return errorPath
        ? `${errorPath}: ${message}${hint}`
        : `${message}${hint}`;
    }

    return errorPath ? `${errorPath}: ${message}` : message;
  });
}

/**
 * Extract YAML frontmatter from a markdown file
 */
function extractFrontmatter(content: string): unknown | null {
  const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---/;
  const match = content.match(frontmatterRegex);

  if (!match || !match[1]) {
    return null;
  }

  try {
    return parseYaml(match[1]);
  } catch {
    return null;
  }
}

/**
 * Check if a string is valid kebab-case
 */
function isKebabCase(str: string): boolean {
  return KEBAB_CASE_REGEX.test(str);
}

/**
 * Check if a string is valid semver
 */
function isValidSemver(str: string): boolean {
  return SEMVER_REGEX.test(str);
}

// =============================================================================
// Validation Functions
// =============================================================================

/**
 * Validate a plugin directory structure
 * Checks that required files and directories exist
 */
export async function validatePluginStructure(
  pluginPath: string,
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check plugin directory exists
  if (!(await directoryExists(pluginPath))) {
    return {
      valid: false,
      errors: [`Plugin directory does not exist: ${pluginPath}`],
      warnings: [],
    };
  }

  // Check .claude-plugin directory exists
  const pluginDir = path.join(pluginPath, PLUGIN_DIR);
  if (!(await directoryExists(pluginDir))) {
    errors.push(`Missing ${PLUGIN_DIR}/ directory`);
  }

  // Check plugin.json exists
  const manifestPath = path.join(pluginDir, PLUGIN_MANIFEST);
  if (!(await fileExists(manifestPath))) {
    errors.push(`Missing ${PLUGIN_DIR}/${PLUGIN_MANIFEST}`);
  }

  // Check for README.md (optional but recommended)
  const readmePath = path.join(pluginPath, "README.md");
  if (!(await fileExists(readmePath))) {
    warnings.push("Missing README.md (recommended for documentation)");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate plugin.json against schema
 */
export async function validatePluginManifest(
  manifestPath: string,
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check file exists
  if (!(await fileExists(manifestPath))) {
    return {
      valid: false,
      errors: [`Manifest file not found: ${manifestPath}`],
      warnings: [],
    };
  }

  // Read and parse JSON
  let manifest: Record<string, unknown>;
  try {
    const content = await readFile(manifestPath);
    manifest = JSON.parse(content);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      valid: false,
      errors: [`Invalid JSON in ${PLUGIN_MANIFEST}: ${message}`],
      warnings: [],
    };
  }

  // Validate against schema
  const validate = await getValidator("plugin.schema.json");
  const isValid = validate(manifest);

  if (!isValid) {
    errors.push(...formatAjvErrors(validate.errors));
  }

  // Additional checks not covered by schema

  // Check name is kebab-case (schema has pattern but provide clearer error)
  if (manifest.name && typeof manifest.name === "string") {
    if (!isKebabCase(manifest.name)) {
      errors.push(`name must be kebab-case: "${manifest.name}"`);
    }
  }

  // Warn if version is present but not valid semver
  if (manifest.version && typeof manifest.version === "string") {
    if (!isValidSemver(manifest.version)) {
      warnings.push(
        `version "${manifest.version}" is not valid semver (expected: major.minor.patch)`,
      );
    }
  }

  // Warn if description is missing
  if (!manifest.description) {
    warnings.push(
      "Missing description field (recommended for discoverability)",
    );
  }

  // Check that referenced paths exist
  const pluginDir = path.dirname(path.dirname(manifestPath)); // Go up from .claude-plugin/plugin.json

  // Check skills path if specified
  if (manifest.skills && typeof manifest.skills === "string") {
    const skillsPath = path.join(pluginDir, manifest.skills);
    if (!(await directoryExists(skillsPath))) {
      errors.push(`Skills path does not exist: ${manifest.skills}`);
    }
  }

  // Check agents path if specified
  if (manifest.agents && typeof manifest.agents === "string") {
    const agentsPath = path.join(pluginDir, manifest.agents);
    if (!(await directoryExists(agentsPath))) {
      errors.push(`Agents path does not exist: ${manifest.agents}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate SKILL.md frontmatter
 */
export async function validateSkillFrontmatter(
  skillPath: string,
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check file exists
  if (!(await fileExists(skillPath))) {
    return {
      valid: false,
      errors: [`Skill file not found: ${skillPath}`],
      warnings: [],
    };
  }

  // Read content and extract frontmatter
  const content = await readFile(skillPath);
  const frontmatter = extractFrontmatter(content);

  if (frontmatter === null) {
    return {
      valid: false,
      errors: ["Missing or invalid YAML frontmatter"],
      warnings: [],
    };
  }

  // Validate against schema
  const validate = await getValidator("skill-frontmatter.schema.json");
  const isValid = validate(frontmatter);

  if (!isValid) {
    errors.push(...formatAjvErrors(validate.errors));
  }

  // Additional checks
  const fm = frontmatter as Record<string, unknown>;

  // Check for deprecated fields
  if (fm.category) {
    warnings.push(
      'Deprecated field: "category" - use metadata.yaml for category information',
    );
  }
  if (fm.author) {
    warnings.push(
      'Deprecated field: "author" - use metadata.yaml for author information',
    );
  }
  if (fm.version) {
    warnings.push(
      'Deprecated field: "version" - use metadata.yaml for version information',
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate agent.md frontmatter
 */
export async function validateAgentFrontmatter(
  agentPath: string,
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check file exists
  if (!(await fileExists(agentPath))) {
    return {
      valid: false,
      errors: [`Agent file not found: ${agentPath}`],
      warnings: [],
    };
  }

  // Read content and extract frontmatter
  const content = await readFile(agentPath);
  const frontmatter = extractFrontmatter(content);

  if (frontmatter === null) {
    return {
      valid: false,
      errors: ["Missing or invalid YAML frontmatter"],
      warnings: [],
    };
  }

  // Validate against schema
  const validate = await getValidator("agent-frontmatter.schema.json");
  const isValid = validate(frontmatter);

  if (!isValid) {
    errors.push(...formatAjvErrors(validate.errors));
  }

  // Additional checks
  const fm = frontmatter as Record<string, unknown>;

  // Check name is kebab-case
  if (fm.name && typeof fm.name === "string") {
    if (!isKebabCase(fm.name)) {
      errors.push(`name must be kebab-case: "${fm.name}"`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate entire plugin (structure + all files)
 */
export async function validatePlugin(
  pluginPath: string,
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate structure first
  const structureResult = await validatePluginStructure(pluginPath);
  errors.push(...structureResult.errors);
  warnings.push(...structureResult.warnings);

  // If structure is invalid, can't continue
  if (!structureResult.valid) {
    return { valid: false, errors, warnings };
  }

  // Validate manifest
  const manifestPath = path.join(pluginPath, PLUGIN_DIR, PLUGIN_MANIFEST);
  const manifestResult = await validatePluginManifest(manifestPath);
  errors.push(...manifestResult.errors);
  warnings.push(...manifestResult.warnings);

  // Get manifest to determine what else to validate
  let manifest: Record<string, unknown> | null = null;
  try {
    const content = await readFile(manifestPath);
    manifest = JSON.parse(content);
  } catch {
    // Manifest validation already reported the error
  }

  if (manifest) {
    // Validate skills if specified
    if (manifest.skills && typeof manifest.skills === "string") {
      const skillsDir = path.join(pluginPath, manifest.skills);
      if (await directoryExists(skillsDir)) {
        // Find all SKILL.md files
        const skillFiles = await fg("**/SKILL.md", {
          cwd: skillsDir,
          absolute: true,
        });

        if (skillFiles.length === 0) {
          warnings.push(
            `Skills directory exists but contains no SKILL.md files: ${manifest.skills}`,
          );
        }

        for (const skillFile of skillFiles) {
          const relativePath = path.relative(pluginPath, skillFile);
          const skillResult = await validateSkillFrontmatter(skillFile);

          if (!skillResult.valid) {
            errors.push(
              ...skillResult.errors.map((e) => `${relativePath}: ${e}`),
            );
          }
          warnings.push(
            ...skillResult.warnings.map((w) => `${relativePath}: ${w}`),
          );
        }
      }
    }

    // Validate agents if specified
    if (manifest.agents && typeof manifest.agents === "string") {
      const agentsDir = path.join(pluginPath, manifest.agents);
      if (await directoryExists(agentsDir)) {
        // Find all .md files in agents directory
        const agentFiles = await fg("*.md", {
          cwd: agentsDir,
          absolute: true,
        });

        if (agentFiles.length === 0) {
          warnings.push(
            `Agents directory exists but contains no .md files: ${manifest.agents}`,
          );
        }

        for (const agentFile of agentFiles) {
          const relativePath = path.relative(pluginPath, agentFile);
          const agentResult = await validateAgentFrontmatter(agentFile);

          if (!agentResult.valid) {
            errors.push(
              ...agentResult.errors.map((e) => `${relativePath}: ${e}`),
            );
          }
          warnings.push(
            ...agentResult.warnings.map((w) => `${relativePath}: ${w}`),
          );
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate all plugins in a directory
 */
export async function validateAllPlugins(pluginsDir: string): Promise<{
  valid: boolean;
  results: Array<{ name: string; result: ValidationResult }>;
  summary: {
    total: number;
    valid: number;
    invalid: number;
    withWarnings: number;
  };
}> {
  const results: Array<{ name: string; result: ValidationResult }> = [];

  // Check directory exists
  if (!(await directoryExists(pluginsDir))) {
    return {
      valid: false,
      results: [
        {
          name: pluginsDir,
          result: {
            valid: false,
            errors: [`Directory does not exist: ${pluginsDir}`],
            warnings: [],
          },
        },
      ],
      summary: { total: 0, valid: 0, invalid: 1, withWarnings: 0 },
    };
  }

  // List all subdirectories that contain .claude-plugin/ (actual plugins)
  const allDirs = await listDirectories(pluginsDir);
  const pluginDirs: string[] = [];

  for (const dirName of allDirs) {
    const potentialPluginDir = path.join(pluginsDir, dirName, PLUGIN_DIR);
    if (await directoryExists(potentialPluginDir)) {
      pluginDirs.push(dirName);
    }
  }

  if (pluginDirs.length === 0) {
    return {
      valid: false,
      results: [
        {
          name: pluginsDir,
          result: {
            valid: false,
            errors: [
              `No plugins found in directory: ${pluginsDir}. Plugins must contain a ${PLUGIN_DIR}/ directory.`,
            ],
            warnings: [],
          },
        },
      ],
      summary: { total: 0, valid: 0, invalid: 1, withWarnings: 0 },
    };
  }

  for (const pluginName of pluginDirs) {
    const pluginPath = path.join(pluginsDir, pluginName);
    const result = await validatePlugin(pluginPath);
    results.push({ name: pluginName, result });
  }

  const summary = {
    total: results.length,
    valid: results.filter((r) => r.result.valid).length,
    invalid: results.filter((r) => !r.result.valid).length,
    withWarnings: results.filter((r) => r.result.warnings.length > 0).length,
  };

  return {
    valid: summary.invalid === 0,
    results,
    summary,
  };
}

/**
 * Print validation result to console
 */
export function printPluginValidationResult(
  name: string,
  result: ValidationResult,
  verbose = false,
): void {
  const status = result.valid ? "\u2713" : "\u2717";

  if (result.valid && result.warnings.length === 0 && !verbose) {
    // Skip entirely valid plugins in non-verbose mode
    return;
  }

  console.log(`\n  ${status} ${name}`);

  if (result.errors.length > 0) {
    console.log("    Errors:");
    result.errors.forEach((e) => console.log(`      - ${e}`));
  }

  if (result.warnings.length > 0) {
    console.log("    Warnings:");
    result.warnings.forEach((w) => console.log(`      - ${w}`));
  }
}
