// =============================================================================
// src/cli/types-matrix.ts
// =============================================================================
// Type definitions for the Skills Matrix system
// Handles: raw config files, extracted metadata, and merged CLI output
// =============================================================================

// =============================================================================
// SECTION 1: Raw Input Types (skills-matrix.yaml)
// =============================================================================

/**
 * Root configuration from skills-matrix.yaml
 * This is the manually-maintained file containing relationships and structure
 */
export interface SkillsMatrixConfig {
  /** Semantic version of the matrix schema (e.g., "1.0.0") */
  version: string;

  /**
   * Category definitions indexed by category ID
   * Includes both top-level (frontend, backend) and subcategories (styling, state)
   */
  categories: Record<string, CategoryDefinition>;

  /** Relationship rules between skills */
  relationships: RelationshipDefinitions;

  /** Pre-configured technology combinations for quick setup */
  suggested_stacks: SuggestedStack[];

  /**
   * Maps short alias names to full skill IDs
   * @example { "react": "react (@vince)", "zustand": "zustand (@vince)" }
   */
  skill_aliases: Record<string, string>;
}

/**
 * Category definition from skills-matrix.yaml
 * Categories can be top-level (frontend, backend) or subcategories (styling, state)
 */
export interface CategoryDefinition {
  /** Unique identifier (e.g., "styling", "state-management") */
  id: string;

  /** Human-readable display name (e.g., "State Management") */
  name: string;

  /** Brief description shown in wizard */
  description: string;

  /**
   * Parent category ID for subcategories
   * If undefined, this is a top-level category
   * @example "frontend" for styling, state-management subcategories
   */
  parent?: string;

  /**
   * If true, only one skill from this category can be selected
   * @default true
   * @example true for framework (can't have React AND Vue)
   */
  exclusive: boolean;

  /**
   * If true, user MUST select something from this category
   * @default false
   * @example true for framework, false for state-management
   */
  required: boolean;

  /** Display order within parent category (lower = earlier) */
  order: number;

  /** Optional emoji icon for display */
  icon?: string;
}

/**
 * All relationship types between skills
 */
export interface RelationshipDefinitions {
  /** Mutual exclusion rules - selecting one disables the others */
  conflicts: ConflictRule[];

  /** Soft warnings - selecting one shows warning for others but doesn't disable */
  discourages: DiscourageRule[];

  /** Soft suggestions - selecting one highlights recommended companions */
  recommends: RecommendRule[];

  /** Hard dependencies - skill A requires skill B to be selected first */
  requires: RequireRule[];

  /** Groups of interchangeable skills for the same purpose */
  alternatives: AlternativeGroup[];
}

/**
 * Conflict rule - skills that cannot be selected together
 */
export interface ConflictRule {
  /**
   * List of skill aliases/IDs that conflict with each other
   * Selecting any one disables ALL others in this list
   */
  skills: string[];

  /** Human-readable explanation shown when option is disabled */
  reason: string;
}

/**
 * Discourage rule - skills that show a warning when selected together
 * Unlike conflicts, these can still be selected but show a "not recommended" warning
 */
export interface DiscourageRule {
  /**
   * List of skill aliases/IDs that discourage each other
   * Selecting any one shows a warning for ALL others in this list
   */
  skills: string[];

  /** Human-readable explanation shown as a warning */
  reason: string;
}

/**
 * Recommendation rule - suggests skills based on current selection
 */
export interface RecommendRule {
  /** Skill alias/ID that triggers this recommendation */
  when: string;

  /** List of skill aliases/IDs to highlight as recommended */
  suggest: string[];

  /** Human-readable explanation shown with recommendation */
  reason: string;
}

/**
 * Requirement rule - enforces hard dependencies between skills
 */
export interface RequireRule {
  /** Skill alias/ID that has requirements */
  skill: string;

  /** Skills that must be selected before this one */
  needs: string[];

  /**
   * If true, only ONE of the `needs` skills is required (OR logic)
   * If false/undefined, ALL of the `needs` skills are required (AND logic)
   * @default false
   */
  needs_any?: boolean;

  /** Human-readable explanation shown when requirement not met */
  reason: string;
}

/**
 * Alternative group - skills that serve the same purpose
 * Used for display grouping and "similar options" suggestions
 */
export interface AlternativeGroup {
  /** Description of what these skills are for */
  purpose: string;

  /** List of interchangeable skill aliases/IDs */
  skills: string[];
}

/**
 * Pre-configured stack of skills for a specific use case
 */
export interface SuggestedStack {
  /** Unique identifier for this stack */
  id: string;

  /** Human-readable display name */
  name: string;

  /** Brief description of the stack's purpose */
  description: string;

  /** Target audiences (e.g., "startups", "enterprise", "personal") */
  audience: string[];

  /**
   * Skill selections organized by category
   * Structure: { category: { subcategory: skill_alias } }
   */
  skills: Record<string, Record<string, string>>;

  /** Guiding principle for this stack */
  philosophy: string;
}

// =============================================================================
// SECTION 2: Extracted Skill Metadata (from metadata.yaml + SKILL.md)
// =============================================================================

/**
 * Skill metadata extracted from individual skill directories
 * Combines SKILL.md frontmatter (identity) with metadata.yaml (relationships)
 *
 * This is the raw extraction before merging with skills-matrix.yaml
 */
export interface ExtractedSkillMetadata {
  // --- Identity (from SKILL.md frontmatter) ---

  /**
   * Unique skill identifier (from frontmatter name)
   * Format: "skill-name (@author)"
   * @example "react (@vince)"
   */
  id: string;

  /**
   * Directory path for filesystem access
   * Used for loading skill files from the filesystem
   * @example "frontend/framework/react (@vince)"
   */
  directoryPath: string;

  /**
   * Display name derived from id
   * @example "Zustand" from "zustand (@vince)"
   */
  name: string;

  /** Brief description of the skill's purpose (for CLI display) */
  description: string;

  /** When an AI agent should invoke this skill (decision criteria) */
  usageGuidance?: string;

  // --- Catalog Data (from metadata.yaml) ---

  /**
   * Primary category this skill belongs to
   * @example "state", "styling", "framework", "backend"
   */
  category: string;

  /**
   * If true, only one skill from this category can be active
   * @default true
   */
  categoryExclusive: boolean;

  /** Author handle for attribution */
  author: string;

  /** Tags for search and filtering */
  tags: string[];

  // --- Relationships (from metadata.yaml) ---

  /**
   * Skills this works well with (soft recommendation)
   * @example ["react (@vince)", "hono (@vince)"]
   */
  compatibleWith: string[];

  /**
   * Skills that cannot coexist with this one
   * @example ["mobx (@vince)", "redux (@vince)"]
   */
  conflictsWith: string[];

  /**
   * Skills that must be present for this to work
   * @example ["react (@vince)"] for zustand
   */
  requires: string[];

  // --- Setup Relationships (from metadata.yaml) ---

  /**
   * Setup skills that must be completed first
   * Links usage skills to their prerequisites
   * @example ["posthog-setup (@vince)"] for posthog-analytics
   */
  requiresSetup: string[];

  /**
   * Usage skills this setup skill configures
   * Links setup skills to what they enable
   * @example ["posthog-analytics (@vince)", "posthog-flags (@vince)"]
   */
  providesSetupFor: string[];

  // --- Location ---

  /**
   * Relative path from src/ to the skill directory
   * @example "skills/frontend/client-state-management/zustand (@vince)"
   */
  path: string;

  // --- Local Skill Fields ---

  /**
   * True if this skill is from .claude/skills/ (user-defined local skill)
   */
  local?: boolean;

  /**
   * Relative path from project root for local skills
   * @example ".claude/skills/my-skill/"
   */
  localPath?: string;
}

// =============================================================================
// SECTION 3: Merged Output Types (for CLI consumption)
// =============================================================================

/**
 * Fully merged skills matrix for CLI consumption
 * This is the output of mergeMatrixWithSkills() - combining:
 * - skills-matrix.yaml (structure, relationships, stacks)
 * - All extracted metadata.yaml files (skill data)
 *
 * The CLI reads ONLY this structure - it has no knowledge of
 * React, Zustand, or any specific technology.
 */
export interface MergedSkillsMatrix {
  /** Schema version for compatibility checking */
  version: string;

  /** Category definitions for wizard navigation */
  categories: Record<string, CategoryDefinition>;

  /**
   * Fully resolved skills with computed relationship data
   * Indexed by full skill ID for O(1) lookup
   */
  skills: Record<string, ResolvedSkill>;

  /** Pre-configured stacks with resolved skill references */
  suggestedStacks: ResolvedStack[];

  /**
   * Alias lookup map (alias -> full skill ID)
   * @example { "react": "react (@vince)" }
   */
  aliases: Record<string, string>;

  /**
   * Reverse alias lookup (full skill ID -> alias)
   * @example { "react (@vince)": "react" }
   */
  aliasesReverse: Record<string, string>;

  /** Generated timestamp for cache invalidation */
  generatedAt: string;
}

/**
 * Single skill with ALL computed relationships resolved
 * This is what the CLI uses to render options and compute disabled/recommended state
 */
export interface ResolvedSkill {
  // --- Identity ---

  /** Full unique identifier: "zustand (@vince)" */
  id: string;

  /**
   * Short alias if defined in skill_aliases
   * @example "zustand" for "zustand (@vince)"
   */
  alias?: string;

  /** Human-readable display name */
  name: string;

  /** Brief description (for CLI display) */
  description: string;

  /** When an AI agent should invoke this skill (decision criteria) */
  usageGuidance?: string;

  // --- Categorization ---

  /** Primary category ID (matches key in matrix.categories) */
  category: string;

  /** If true, only one skill from this category can be selected */
  categoryExclusive: boolean;

  /** Tags for filtering and search */
  tags: string[];

  // --- Authorship ---

  /** Author handle */
  author: string;

  /** DEPRECATED: Version now lives in plugin.json. Optional for backward compatibility. */
  version?: string;

  // --- Computed Relationships (populated by resolver) ---

  /**
   * Skills that conflict with this one
   * Computed from: metadata.yaml conflicts_with + skills-matrix.yaml conflicts
   * Format: Array of { skillId, reason }
   */
  conflictsWith: SkillRelation[];

  /**
   * Skills that are recommended when this is selected
   * Computed from: metadata.yaml compatible_with + skills-matrix.yaml recommends
   * Format: Array of { skillId, reason }
   */
  recommends: SkillRelation[];

  /**
   * Skills that recommend THIS skill when THEY are selected
   * Inverse of recommends - "who recommends me?"
   * Format: Array of { skillId, reason }
   */
  recommendedBy: SkillRelation[];

  /**
   * Skills that THIS skill requires (must select first)
   * Computed from: metadata.yaml requires + skills-matrix.yaml requires
   * Format: Array of { skillId, reason, needsAny }
   */
  requires: SkillRequirement[];

  /**
   * Skills that require THIS skill (I am their dependency)
   * Inverse of requires - "who needs me?"
   * Format: Array of { skillId, reason }
   */
  requiredBy: SkillRelation[];

  /**
   * Alternative skills that serve the same purpose
   * From skills-matrix.yaml alternatives groups
   * Format: Array of { skillId, purpose }
   */
  alternatives: SkillAlternative[];

  /**
   * Skills that are discouraged when this is selected (show warning)
   * Computed from: skills-matrix.yaml discourages
   * Format: Array of { skillId, reason }
   */
  discourages: SkillRelation[];

  // --- Setup Relationships ---

  /**
   * Setup skills that must be completed before using this
   * @example ["posthog-setup (@vince)"] for posthog-analytics
   */
  requiresSetup: string[];

  /**
   * Usage skills that this setup skill configures
   * @example ["posthog-analytics (@vince)"] for posthog-setup
   */
  providesSetupFor: string[];

  // --- File Location ---

  /** Relative path to skill directory from src/ */
  path: string;

  // --- Local Skill Fields ---

  /**
   * True if this skill is from .claude/skills/ (user-defined local skill)
   */
  local?: boolean;

  /**
   * Relative path from project root for local skills
   * @example ".claude/skills/my-skill/"
   */
  localPath?: string;
}

/**
 * Relationship to another skill with explanation
 */
export interface SkillRelation {
  /** Full skill ID of the related skill */
  skillId: string;

  /** Human-readable explanation of the relationship */
  reason: string;
}

/**
 * Requirement relationship with AND/OR logic
 */
export interface SkillRequirement {
  /** Full skill IDs that are required */
  skillIds: string[];

  /**
   * If true, only ONE of skillIds is needed (OR)
   * If false, ALL of skillIds are needed (AND)
   * @default false
   */
  needsAny: boolean;

  /** Human-readable explanation */
  reason: string;
}

/**
 * Alternative skill reference
 */
export interface SkillAlternative {
  /** Full skill ID of the alternative */
  skillId: string;

  /** What purpose this alternative serves */
  purpose: string;
}

/**
 * Suggested stack with all skill references resolved to full IDs
 */
export interface ResolvedStack {
  /** Stack identifier */
  id: string;

  /** Display name */
  name: string;

  /** Description */
  description: string;

  /** Target audiences */
  audience: string[];

  /**
   * Skill selections with FULL skill IDs (aliases resolved)
   * Structure: { category: { subcategory: fullSkillId } }
   * @example { frontend: { styling: "scss-modules (@vince)" } }
   */
  skills: Record<string, Record<string, string>>;

  /**
   * Flat list of all skill IDs in this stack
   * Computed for easy iteration
   * @example ["react (@vince)", "scss-modules (@vince)", ...]
   */
  allSkillIds: string[];

  /** Guiding principle */
  philosophy: string;
}

// =============================================================================
// SECTION 4: Runtime Types (for wizard state)
// =============================================================================

/**
 * Skill option as displayed in the wizard
 * Computed at runtime based on current selections
 */
export interface SkillOption {
  /** Full skill ID */
  id: string;

  /** Short alias if available */
  alias?: string;

  /** Display name */
  name: string;

  /** Description */
  description: string;

  /** Whether this option is currently disabled */
  disabled: boolean;

  /**
   * Why this option is disabled
   * @example "Conflicts with Tailwind (already selected)"
   */
  disabledReason?: string;

  /** Whether this option is discouraged (not recommended) based on current selections */
  discouraged: boolean;

  /**
   * Why this is not recommended
   * @example "Mixing CSS paradigms is unusual"
   */
  discouragedReason?: string;

  /** Whether this option is recommended based on current selections */
  recommended: boolean;

  /**
   * Why this is recommended
   * @example "Works great with React"
   */
  recommendedReason?: string;

  /** Whether this skill is already selected */
  selected: boolean;

  /** Alternative skills that serve the same purpose */
  alternatives: string[];
}

/**
 * Current wizard state for computing available options
 */
export interface WizardState {
  /** Currently selected skill IDs (full IDs, not aliases) */
  selectedSkills: string[];

  /** Current step/category being displayed */
  currentCategory: string;

  /** Selected stack (if user chose a pre-built stack) */
  selectedStack?: string;
}

// =============================================================================
// SECTION 5: Validation Types
// =============================================================================

/**
 * Validation result for a skill selection
 */
export interface SelectionValidation {
  /** Whether the selection is valid */
  valid: boolean;

  /** Error messages if invalid */
  errors: ValidationError[];

  /** Warning messages (valid but with caveats) */
  warnings: ValidationWarning[];
}

/**
 * Validation error detail
 */
export interface ValidationError {
  /** Type of error */
  type: "conflict" | "missing_requirement" | "category_exclusive";

  /** Human-readable message */
  message: string;

  /** Skill IDs involved in the error */
  skills: string[];
}

/**
 * Validation warning detail
 */
export interface ValidationWarning {
  /** Type of warning */
  type: "missing_recommendation" | "unused_setup";

  /** Human-readable message */
  message: string;

  /** Skill IDs involved */
  skills: string[];
}
