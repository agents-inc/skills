import { parse as parseYaml } from "yaml";
import path from "path";
import { glob, readFile, fileExists } from "../utils/fs";
import { verbose } from "../utils/logger";
import { DIRS } from "../consts";
import { parseFrontmatter } from "./loader";
import type {
  SkillsMatrixConfig,
  ExtractedSkillMetadata,
  MergedSkillsMatrix,
  ResolvedSkill,
  ResolvedStack,
  SkillRelation,
  SkillRequirement,
  SkillAlternative,
} from "../types-matrix";

/**
 * Metadata from individual metadata.yaml files
 */
interface RawMetadata {
  category: string;
  category_exclusive?: boolean;
  author: string;
  version: string;
  /** Required for skill to load. Short display name for CLI (e.g., "React", "Zustand", "SolidJS") */
  cli_name?: string;
  /** Short description for CLI display (5-6 words) */
  cli_description?: string;
  /** When an AI agent should invoke this skill */
  usage_guidance?: string;
  tags?: string[];
  compatible_with?: string[];
  conflicts_with?: string[];
  requires?: string[];
  requires_setup?: string[];
  provides_setup_for?: string[];
}

/**
 * Load and parse skills-matrix.yaml
 * Validates basic structure (required fields exist)
 */
export async function loadSkillsMatrix(
  configPath: string,
): Promise<SkillsMatrixConfig> {
  const content = await readFile(configPath);
  const config = parseYaml(content) as SkillsMatrixConfig;

  // Basic structure validation
  validateMatrixStructure(config, configPath);

  verbose(`Loaded skills matrix: ${configPath}`);
  return config;
}

/**
 * Validate that skills-matrix.yaml has required structure
 */
function validateMatrixStructure(
  config: SkillsMatrixConfig,
  configPath: string,
): void {
  const requiredFields = [
    "version",
    "categories",
    "relationships",
    "suggested_stacks",
    "skill_aliases",
  ];
  const missing = requiredFields.filter((field) => !(field in config));

  if (missing.length > 0) {
    throw new Error(
      `Skills matrix at ${configPath} is missing required fields: ${missing.join(", ")}`,
    );
  }

  // Validate relationships structure
  const relationshipFields = [
    "conflicts",
    "recommends",
    "requires",
    "alternatives",
  ];
  const missingRelationships = relationshipFields.filter(
    (field) => !config.relationships || !(field in config.relationships),
  );

  if (missingRelationships.length > 0) {
    throw new Error(
      `Skills matrix relationships missing required fields: ${missingRelationships.join(", ")}`,
    );
  }

  // Validate categories have required fields
  for (const [categoryId, category] of Object.entries(config.categories)) {
    const requiredCategoryFields = [
      "id",
      "name",
      "description",
      "exclusive",
      "required",
      "order",
    ];
    const missingCategoryFields = requiredCategoryFields.filter(
      (field) => !(field in category),
    );

    if (missingCategoryFields.length > 0) {
      throw new Error(
        `Category "${categoryId}" missing required fields: ${missingCategoryFields.join(", ")}`,
      );
    }
  }
}

/**
 * Extract skill metadata from all skills directories
 * Combines SKILL.md frontmatter (identity) with metadata.yaml (relationships)
 */
export async function extractAllSkills(
  skillsDir: string,
): Promise<ExtractedSkillMetadata[]> {
  const skills: ExtractedSkillMetadata[] = [];

  // Find all metadata.yaml files
  const metadataFiles = await glob("**/metadata.yaml", skillsDir);

  for (const metadataFile of metadataFiles) {
    const skillDir = path.dirname(metadataFile);
    const skillMdPath = path.join(skillsDir, skillDir, "SKILL.md");
    const metadataPath = path.join(skillsDir, metadataFile);

    // Check SKILL.md exists
    if (!(await fileExists(skillMdPath))) {
      verbose(`Skipping ${metadataFile}: No SKILL.md found`);
      continue;
    }

    // Read and parse metadata.yaml
    const metadataContent = await readFile(metadataPath);
    const metadata = parseYaml(metadataContent) as RawMetadata;

    // Read and parse SKILL.md frontmatter
    const skillMdContent = await readFile(skillMdPath);
    const frontmatter = parseFrontmatter(skillMdContent);

    if (!frontmatter) {
      verbose(`Skipping ${metadataFile}: Invalid SKILL.md frontmatter`);
      continue;
    }

    // cli_name is required in metadata.yaml
    if (!metadata.cli_name) {
      throw new Error(
        `Skill at ${metadataFile} is missing required 'cli_name' field in metadata.yaml`,
      );
    }

    // Use directory path as skill ID (matches stack configs and skill_aliases)
    // skillDir is the path like "frontend/framework/react (@vince)"
    const skillId = skillDir;

    // Build extracted skill metadata
    // Display name format: "cli_name author" (e.g., "React @vince")
    const extracted: ExtractedSkillMetadata = {
      // Identity (from directory path, matches stack config references)
      id: skillId,
      // Store frontmatter name for resolving metadata.yaml references
      frontmatterName: frontmatter.name,
      name: `${metadata.cli_name} ${metadata.author}`,
      description: metadata.cli_description || frontmatter.description,
      usageGuidance: metadata.usage_guidance,

      // Catalog data (from metadata.yaml)
      category: metadata.category,
      categoryExclusive: metadata.category_exclusive ?? true,
      author: metadata.author,
      version: metadata.version,
      tags: metadata.tags ?? [],

      // Relationships (from metadata.yaml)
      compatibleWith: metadata.compatible_with ?? [],
      conflictsWith: metadata.conflicts_with ?? [],
      requires: metadata.requires ?? [],

      // Setup relationships
      requiresSetup: metadata.requires_setup ?? [],
      providesSetupFor: metadata.provides_setup_for ?? [],

      // Location
      path: `skills/${skillDir}/`,
    };

    skills.push(extracted);
    verbose(`Extracted skill: ${skillId}`);
  }

  return skills;
}

/**
 * Build reverse alias lookup map
 */
function buildReverseAliases(
  aliases: Record<string, string>,
): Record<string, string> {
  const reverse: Record<string, string> = {};
  for (const [alias, fullId] of Object.entries(aliases)) {
    reverse[fullId] = alias;
  }
  return reverse;
}

/**
 * Build a mapping from frontmatter names to directory paths
 * This allows metadata.yaml files to reference skills by their frontmatter name
 */
function buildFrontmatterToPathMap(
  skills: ExtractedSkillMetadata[],
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const skill of skills) {
    if (skill.frontmatterName && skill.frontmatterName !== skill.id) {
      map[skill.frontmatterName] = skill.id;
    }
  }
  return map;
}

/**
 * Resolve an alias, frontmatter name, or ID to full skill ID (directory path)
 * Checks in order: aliases -> frontmatterToPath -> returns original
 */
function resolveToFullId(
  aliasOrId: string,
  aliases: Record<string, string>,
  frontmatterToPath: Record<string, string> = {},
): string {
  // Check aliases first (e.g., "react" -> "frontend/framework/react (@vince)")
  if (aliases[aliasOrId]) {
    return aliases[aliasOrId];
  }
  // Check frontmatter names (e.g., "frontend/react (@vince)" -> "frontend/framework/react (@vince)")
  if (frontmatterToPath[aliasOrId]) {
    return frontmatterToPath[aliasOrId];
  }
  // Return as-is (might already be a directory path)
  return aliasOrId;
}

/**
 * Merge skills-matrix.yaml with extracted skill metadata
 * Produces the final MergedSkillsMatrix for CLI consumption
 */
export async function mergeMatrixWithSkills(
  matrix: SkillsMatrixConfig,
  skills: ExtractedSkillMetadata[],
): Promise<MergedSkillsMatrix> {
  const aliases = matrix.skill_aliases;
  const aliasesReverse = buildReverseAliases(aliases);
  // Build mapping from frontmatter names to directory paths
  // This allows metadata.yaml to reference skills by frontmatter name
  const frontmatterToPath = buildFrontmatterToPathMap(skills);

  // Build resolved skills
  const resolvedSkills: Record<string, ResolvedSkill> = {};

  for (const skill of skills) {
    const resolved = buildResolvedSkill(
      skill,
      matrix,
      aliases,
      aliasesReverse,
      frontmatterToPath,
    );
    resolvedSkills[skill.id] = resolved;
  }

  // Compute inverse relationships (recommendedBy, requiredBy)
  computeInverseRelationships(resolvedSkills);

  // Resolve suggested stacks
  const suggestedStacks = resolveSuggestedStacks(matrix, aliases);

  const merged: MergedSkillsMatrix = {
    version: matrix.version,
    categories: matrix.categories,
    skills: resolvedSkills,
    suggestedStacks,
    aliases,
    aliasesReverse,
    generatedAt: new Date().toISOString(),
  };

  return merged;
}

/**
 * Build a ResolvedSkill from extracted metadata and matrix relationships
 */
function buildResolvedSkill(
  skill: ExtractedSkillMetadata,
  matrix: SkillsMatrixConfig,
  aliases: Record<string, string>,
  aliasesReverse: Record<string, string>,
  frontmatterToPath: Record<string, string>,
): ResolvedSkill {
  const conflictsWith: SkillRelation[] = [];
  const recommends: SkillRelation[] = [];
  const requires: SkillRequirement[] = [];
  const alternatives: SkillAlternative[] = [];
  const discourages: SkillRelation[] = [];

  // Conflicts from metadata.yaml
  for (const conflictRef of skill.conflictsWith) {
    const fullId = resolveToFullId(conflictRef, aliases, frontmatterToPath);
    conflictsWith.push({
      skillId: fullId,
      reason: "Defined in skill metadata",
    });
  }

  // Conflicts from skills-matrix.yaml
  for (const conflictRule of matrix.relationships.conflicts) {
    const resolvedSkills = conflictRule.skills.map((s) =>
      resolveToFullId(s, aliases, frontmatterToPath),
    );
    if (resolvedSkills.includes(skill.id)) {
      for (const otherSkill of resolvedSkills) {
        if (otherSkill !== skill.id) {
          // Avoid duplicates
          if (!conflictsWith.some((c) => c.skillId === otherSkill)) {
            conflictsWith.push({
              skillId: otherSkill,
              reason: conflictRule.reason,
            });
          }
        }
      }
    }
  }

  // Recommendations from metadata.yaml (compatible_with)
  for (const compatRef of skill.compatibleWith) {
    const fullId = resolveToFullId(compatRef, aliases, frontmatterToPath);
    recommends.push({
      skillId: fullId,
      reason: "Compatible with this skill",
    });
  }

  // Recommendations from skills-matrix.yaml
  for (const recommendRule of matrix.relationships.recommends) {
    const whenFullId = resolveToFullId(
      recommendRule.when,
      aliases,
      frontmatterToPath,
    );
    if (whenFullId === skill.id) {
      for (const suggested of recommendRule.suggest) {
        const fullId = resolveToFullId(suggested, aliases, frontmatterToPath);
        // Avoid duplicates
        if (!recommends.some((r) => r.skillId === fullId)) {
          recommends.push({
            skillId: fullId,
            reason: recommendRule.reason,
          });
        }
      }
    }
  }

  // Requirements from metadata.yaml
  if (skill.requires.length > 0) {
    requires.push({
      skillIds: skill.requires.map((r) =>
        resolveToFullId(r, aliases, frontmatterToPath),
      ),
      needsAny: false,
      reason: "Defined in skill metadata",
    });
  }

  // Requirements from skills-matrix.yaml
  for (const requireRule of matrix.relationships.requires) {
    const skillFullId = resolveToFullId(
      requireRule.skill,
      aliases,
      frontmatterToPath,
    );
    if (skillFullId === skill.id) {
      requires.push({
        skillIds: requireRule.needs.map((n) =>
          resolveToFullId(n, aliases, frontmatterToPath),
        ),
        needsAny: requireRule.needs_any ?? false,
        reason: requireRule.reason,
      });
    }
  }

  // Alternatives from skills-matrix.yaml
  for (const altGroup of matrix.relationships.alternatives) {
    const resolvedAlts = altGroup.skills.map((s) =>
      resolveToFullId(s, aliases, frontmatterToPath),
    );
    if (resolvedAlts.includes(skill.id)) {
      for (const altSkill of resolvedAlts) {
        if (altSkill !== skill.id) {
          alternatives.push({
            skillId: altSkill,
            purpose: altGroup.purpose,
          });
        }
      }
    }
  }

  // Discourages from skills-matrix.yaml
  if (matrix.relationships.discourages) {
    for (const discourageRule of matrix.relationships.discourages) {
      const resolvedSkills = discourageRule.skills.map((s) =>
        resolveToFullId(s, aliases, frontmatterToPath),
      );
      if (resolvedSkills.includes(skill.id)) {
        for (const otherSkill of resolvedSkills) {
          if (otherSkill !== skill.id) {
            // Avoid duplicates
            if (!discourages.some((d) => d.skillId === otherSkill)) {
              discourages.push({
                skillId: otherSkill,
                reason: discourageRule.reason,
              });
            }
          }
        }
      }
    }
  }

  return {
    // Identity
    id: skill.id,
    alias: aliasesReverse[skill.id],
    name: skill.name,
    description: skill.description,
    usageGuidance: skill.usageGuidance,

    // Categorization
    category: skill.category,
    categoryExclusive: skill.categoryExclusive,
    tags: skill.tags,

    // Authorship
    author: skill.author,
    version: skill.version,

    // Relationships (forward)
    conflictsWith,
    recommends,
    recommendedBy: [], // Computed later
    requires,
    requiredBy: [], // Computed later
    alternatives,
    discourages,

    // Setup relationships
    requiresSetup: skill.requiresSetup.map((s) =>
      resolveToFullId(s, aliases, frontmatterToPath),
    ),
    providesSetupFor: skill.providesSetupFor.map((s) =>
      resolveToFullId(s, aliases, frontmatterToPath),
    ),

    // Location
    path: skill.path,
  };
}

/**
 * Compute inverse relationships (recommendedBy, requiredBy) across all skills
 */
function computeInverseRelationships(
  skills: Record<string, ResolvedSkill>,
): void {
  for (const skill of Object.values(skills)) {
    // Build recommendedBy from others' recommends
    for (const recommend of skill.recommends) {
      const targetSkill = skills[recommend.skillId];
      if (targetSkill) {
        targetSkill.recommendedBy.push({
          skillId: skill.id,
          reason: recommend.reason,
        });
      }
    }

    // Build requiredBy from others' requires
    for (const requirement of skill.requires) {
      for (const requiredId of requirement.skillIds) {
        const targetSkill = skills[requiredId];
        if (targetSkill) {
          targetSkill.requiredBy.push({
            skillId: skill.id,
            reason: requirement.reason,
          });
        }
      }
    }
  }
}

/**
 * Resolve suggested stacks, converting aliases to full IDs
 */
function resolveSuggestedStacks(
  matrix: SkillsMatrixConfig,
  aliases: Record<string, string>,
): ResolvedStack[] {
  return matrix.suggested_stacks.map((stack) => {
    const resolvedSkillsMap: Record<string, Record<string, string>> = {};
    const allSkillIds: string[] = [];

    for (const [category, subcategories] of Object.entries(stack.skills)) {
      resolvedSkillsMap[category] = {};
      for (const [subcategory, alias] of Object.entries(subcategories)) {
        const fullId = resolveToFullId(alias, aliases);
        resolvedSkillsMap[category][subcategory] = fullId;
        allSkillIds.push(fullId);
      }
    }

    return {
      id: stack.id,
      name: stack.name,
      description: stack.description,
      audience: stack.audience,
      skills: resolvedSkillsMap,
      allSkillIds,
      philosophy: stack.philosophy,
    };
  });
}

/**
 * Convenience function to load matrix and extract skills in one call
 */
export async function loadAndMergeSkillsMatrix(
  matrixPath: string,
  projectRoot: string,
): Promise<MergedSkillsMatrix> {
  const matrix = await loadSkillsMatrix(matrixPath);
  const skillsDir = path.join(projectRoot, DIRS.skills);
  const skills = await extractAllSkills(skillsDir);
  return mergeMatrixWithSkills(matrix, skills);
}
