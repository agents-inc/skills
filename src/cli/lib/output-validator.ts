import { parse as parseYaml } from "yaml";

// =============================================================================
// Types (reusing ValidationResult from src/types.ts pattern)
// =============================================================================

export interface OutputValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// =============================================================================
// Validation Functions
// =============================================================================

/**
 * Extract YAML frontmatter from compiled agent content
 * Returns null if no valid frontmatter found
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
 * Check XML tag balance - all opening tags have matching closing tags
 * Uses simple regex matching (as spec suggests)
 */
function checkXmlTagBalance(content: string): string[] {
  const errors: string[] = [];

  // Find all XML-style tags (e.g., <role>, </role>, <critical_requirements>)
  // Excludes self-closing tags and code blocks
  const tagRegex = /<\/?([a-z_][a-z0-9_-]*)\s*>/gi;
  const tagCounts = new Map<string, number>();

  let match;
  while ((match = tagRegex.exec(content)) !== null) {
    const fullTag = match[0];
    const tagName = match[1].toLowerCase();

    // Skip if inside a code block (simple heuristic: check for backticks nearby)
    const before = content.slice(Math.max(0, match.index - 10), match.index);
    const after = content.slice(
      match.index + fullTag.length,
      match.index + fullTag.length + 10,
    );
    if (before.includes("`") || after.includes("`")) {
      continue;
    }

    const isClosing = fullTag.startsWith("</");
    const current = tagCounts.get(tagName) || 0;
    tagCounts.set(tagName, isClosing ? current - 1 : current + 1);
  }

  // Check for unbalanced tags
  for (const [tag, count] of tagCounts) {
    if (count > 0) {
      errors.push(`Unclosed XML tag: <${tag}> (${count} unclosed)`);
    } else if (count < 0) {
      errors.push(`Extra closing tag: </${tag}> (${Math.abs(count)} extra)`);
    }
  }

  return errors;
}

/**
 * Check for template artifacts (unprocessed Liquid tags)
 */
function checkTemplateArtifacts(content: string): string[] {
  const warnings: string[] = [];

  // Check for Liquid variable tags {{ }}
  const variableMatches = content.match(/\{\{[^}]*\}\}/g);
  if (variableMatches) {
    warnings.push(
      `Template artifacts found: ${variableMatches.length} unprocessed {{ }} tags`,
    );
  }

  // Check for Liquid control tags {% %}
  const controlMatches = content.match(/\{%[^%]*%\}/g);
  if (controlMatches) {
    warnings.push(
      `Template artifacts found: ${controlMatches.length} unprocessed {% %} tags`,
    );
  }

  return warnings;
}

/**
 * Check for required content patterns in compiled agent
 */
function checkRequiredPatterns(content: string): string[] {
  const warnings: string[] = [];

  // Check for frontmatter
  if (!content.startsWith("---")) {
    warnings.push("Missing YAML frontmatter at start of file");
  }

  // Check for role section (most agents have this)
  if (!content.includes("<role>")) {
    warnings.push("Missing <role> section");
  }

  // Check for core principles (should be present in compiled agents)
  if (
    !content.includes("Core Principles") &&
    !content.includes("core_principles")
  ) {
    warnings.push("Missing Core Principles section");
  }

  // Check that file doesn't end abruptly (should have substantial content)
  const lines = content.trim().split("\n");
  if (lines.length < 50) {
    warnings.push(`Suspiciously short output: only ${lines.length} lines`);
  }

  return warnings;
}

/**
 * Validate frontmatter can be parsed and has required fields
 */
function validateFrontmatter(content: string): {
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  const frontmatter = extractFrontmatter(content);

  if (frontmatter === null) {
    errors.push("Failed to parse YAML frontmatter");
    return { errors, warnings };
  }

  // Check for required frontmatter fields
  const fm = frontmatter as Record<string, unknown>;

  if (!fm.name || typeof fm.name !== "string") {
    errors.push("Frontmatter missing required field: name");
  }

  if (!fm.description || typeof fm.description !== "string") {
    warnings.push("Frontmatter missing field: description");
  }

  if (!fm.tools || typeof fm.tools !== "string") {
    warnings.push("Frontmatter missing field: tools");
  }

  return { errors, warnings };
}

// =============================================================================
// Main Validation Function
// =============================================================================

/**
 * Validate compiled agent output
 * Returns errors (potential issues) and warnings (informational)
 */
export function validateCompiledAgent(content: string): OutputValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for empty content
  if (!content || content.trim().length === 0) {
    return {
      valid: false,
      errors: ["Compiled output is empty"],
      warnings: [],
    };
  }

  // Validate frontmatter
  const fmResult = validateFrontmatter(content);
  errors.push(...fmResult.errors);
  warnings.push(...fmResult.warnings);

  // Check XML tag balance
  const xmlErrors = checkXmlTagBalance(content);
  errors.push(...xmlErrors);

  // Check for template artifacts
  const artifactWarnings = checkTemplateArtifacts(content);
  warnings.push(...artifactWarnings);

  // Check required patterns
  const patternWarnings = checkRequiredPatterns(content);
  warnings.push(...patternWarnings);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Print validation result for a single agent
 */
export function printOutputValidationResult(
  agentName: string,
  result: OutputValidationResult,
): void {
  if (result.errors.length > 0) {
    console.log(`    Validation errors for ${agentName}:`);
    result.errors.forEach((e) => console.log(`      - ${e}`));
  }

  if (result.warnings.length > 0) {
    console.log(`    Validation warnings for ${agentName}:`);
    result.warnings.forEach((w) => console.log(`      - ${w}`));
  }
}
