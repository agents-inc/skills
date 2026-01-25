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

    // Use frontmatter name as the canonical skill ID
    // frontmatter.name is like "frontend/react (@vince)"
    const skillId = frontmatter.name;

    // Build extracted skill metadata
    // Display name format: "cli_name author" (e.g., "React @vince")
    const extracted: ExtractedSkillMetadata = {
      // Identity (from SKILL.md frontmatter - this is the canonical ID)
      id: skillId,
      // Store directory path for resolving old references and filesystem access
      // skillDir is the path like "frontend/framework/react (@vince)"
      directoryPath: skillDir,
      name: `${metadata.cli_name} ${metadata.author}`,
      description: metadata.cli_description || frontmatter.description,
      usageGuidance: metadata.usage_guidance,

      // Catalog data (from metadata.yaml)
      category: metadata.category,
      categoryExclusive: metadata.category_exclusive ?? true,
      author: metadata.author,
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
 * Build a mapping from directory paths to canonical skill IDs (frontmatter names)
 * This allows stack configs and other references using directory paths to be resolved
 */
function buildDirectoryPathToIdMap(
  skills: ExtractedSkillMetadata[],
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const skill of skills) {
    if (skill.directoryPath && skill.directoryPath !== skill.id) {
      map[skill.directoryPath] = skill.id;
    }
  }
  return map;
}

/**
 * Resolve an alias or directory path to canonical skill ID (frontmatter name)
 * Checks in order: aliases -> directoryPathToId -> returns original
 */
function resolveToCanonicalId(
  aliasOrId: string,
  aliases: Record<string, string>,
  directoryPathToId: Record<string, string> = {},
): string {
  // Check aliases first (e.g., "react" -> "frontend/react (@vince)")
  if (aliases[aliasOrId]) {
    return aliases[aliasOrId];
  }
  // Check directory paths (e.g., "frontend/framework/react (@vince)" -> "frontend/react (@vince)")
  if (directoryPathToId[aliasOrId]) {
    return directoryPathToId[aliasOrId];
  }
  // Return as-is (might already be a canonical ID / frontmatter name)
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
  // Build mapping from directory paths to canonical IDs (frontmatter names)
  // This allows stack configs using directory paths to be resolved to canonical IDs
  const directoryPathToId = buildDirectoryPathToIdMap(skills);

  // Build resolved skills
  const resolvedSkills: Record<string, ResolvedSkill> = {};

  for (const skill of skills) {
    const resolved = buildResolvedSkill(
      skill,
      matrix,
      aliases,
      aliasesReverse,
      directoryPathToId,
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
  directoryPathToId: Record<string, string>,
): ResolvedSkill {
  const conflictsWith: SkillRelation[] = [];
  const recommends: SkillRelation[] = [];
  const requires: SkillRequirement[] = [];
  const alternatives: SkillAlternative[] = [];
  const discourages: SkillRelation[] = [];

  // Conflicts from metadata.yaml
  for (const conflictRef of skill.conflictsWith) {
    const canonicalId = resolveToCanonicalId(
      conflictRef,
      aliases,
      directoryPathToId,
    );
    conflictsWith.push({
      skillId: canonicalId,
      reason: "Defined in skill metadata",
    });
  }

  // Conflicts from skills-matrix.yaml
  for (const conflictRule of matrix.relationships.conflicts) {
    const resolvedSkills = conflictRule.skills.map((s) =>
      resolveToCanonicalId(s, aliases, directoryPathToId),
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
    const canonicalId = resolveToCanonicalId(
      compatRef,
      aliases,
      directoryPathToId,
    );
    recommends.push({
      skillId: canonicalId,
      reason: "Compatible with this skill",
    });
  }

  // Recommendations from skills-matrix.yaml
  for (const recommendRule of matrix.relationships.recommends) {
    const whenCanonicalId = resolveToCanonicalId(
      recommendRule.when,
      aliases,
      directoryPathToId,
    );
    if (whenCanonicalId === skill.id) {
      for (const suggested of recommendRule.suggest) {
        const canonicalId = resolveToCanonicalId(
          suggested,
          aliases,
          directoryPathToId,
        );
        // Avoid duplicates
        if (!recommends.some((r) => r.skillId === canonicalId)) {
          recommends.push({
            skillId: canonicalId,
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
        resolveToCanonicalId(r, aliases, directoryPathToId),
      ),
      needsAny: false,
      reason: "Defined in skill metadata",
    });
  }

  // Requirements from skills-matrix.yaml
  for (const requireRule of matrix.relationships.requires) {
    const skillCanonicalId = resolveToCanonicalId(
      requireRule.skill,
      aliases,
      directoryPathToId,
    );
    if (skillCanonicalId === skill.id) {
      requires.push({
        skillIds: requireRule.needs.map((n) =>
          resolveToCanonicalId(n, aliases, directoryPathToId),
        ),
        needsAny: requireRule.needs_any ?? false,
        reason: requireRule.reason,
      });
    }
  }

  // Alternatives from skills-matrix.yaml
  for (const altGroup of matrix.relationships.alternatives) {
    const resolvedAlts = altGroup.skills.map((s) =>
      resolveToCanonicalId(s, aliases, directoryPathToId),
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
        resolveToCanonicalId(s, aliases, directoryPathToId),
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
    // version is deprecated and now lives in plugin.json

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
      resolveToCanonicalId(s, aliases, directoryPathToId),
    ),
    providesSetupFor: skill.providesSetupFor.map((s) =>
      resolveToCanonicalId(s, aliases, directoryPathToId),
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
 * Resolve suggested stacks, converting aliases to canonical skill IDs
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
        // Aliases now point to canonical IDs (frontmatter names)
        const canonicalId = resolveToCanonicalId(alias, aliases);
        resolvedSkillsMap[category][subcategory] = canonicalId;
        allSkillIds.push(canonicalId);
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
