/**
 * TypeScript types for the Stack-Based Agent Compilation System
 */

// =============================================================================
// Skill Types
// =============================================================================

/**
 * Skill definition from registry.yaml
 * Contains static metadata that doesn't change per-agent
 */
export interface SkillDefinition {
  path: string;
  name: string;
  description: string;
  /** Canonical skill ID from frontmatter (e.g., "frontend/react (@vince)") */
  canonicalId: string;
}

/**
 * Skill assignment in stack config.yaml
 * Specifies whether a skill should be preloaded (embedded) or dynamic (loaded via Skill tool)
 */
export interface SkillAssignment {
  id: string;
  preloaded?: boolean; // Default: false (dynamic)
}

/**
 * Skill reference in config.yaml (agent-specific)
 * References a skill by ID and provides context-specific usage
 */
export interface SkillReference {
  id: string;
  usage: string; // Context-specific description of when to use this skill
  preloaded?: boolean; // Whether skill content should be embedded in compiled agent
}

/**
 * Skills config from skills.yaml (deprecated - use RegistryConfig)
 */
export interface SkillsConfig {
  skills: Record<string, SkillDefinition>;
}

/**
 * Registry config from registry.yaml
 * Single source of truth for all agent and skill definitions
 */
export interface RegistryConfig {
  agents: Record<string, AgentDefinition>;
  skills: Record<string, SkillDefinition>;
}

/**
 * Fully resolved skill (merged from registry.yaml + config.yaml)
 * This is what the compiler uses after merging
 */
export interface Skill {
  id: string;
  path: string;
  name: string;
  description: string;
  usage: string;
  preloaded: boolean; // Whether skill is listed in frontmatter (Claude Code loads automatically)
}

// SkillAssignment removed - now using flat Skill[] array

// =============================================================================
// Agent Definition Types (from agents.yaml - single source of truth)
// =============================================================================

/**
 * Base agent definition from agents.yaml
 * Does NOT include skills or prompts - those are profile-specific
 */
export interface AgentDefinition {
  title: string;
  description: string;
  model?: string;
  tools: string[];
  disallowed_tools?: string[]; // Tools this agent cannot use
  permission_mode?: string; // Permission mode for agent operations
  hooks?: Record<string, AgentHookDefinition[]>; // Lifecycle hooks
  output_format?: string; // Which output format file to use
  path?: string; // Relative path to agent directory (e.g., "developer/backend-developer")
}

/**
 * Top-level structure of agents.yaml
 */
export interface AgentsConfig {
  agents: Record<string, AgentDefinition>;
}

// =============================================================================
// Compile Config Types (agent-centric structure)
// =============================================================================

/**
 * Agent configuration for compilation
 * Contains skills for a specific agent
 */
export interface CompileAgentConfig {
  skills?: SkillReference[]; // Optional - can come from stack
}

/**
 * Compile configuration (derived from stack)
 * Agents to compile are derived from the keys of `agents`
 */
export interface CompileConfig {
  name: string;
  description: string;
  claude_md: string;
  /** Stack reference - resolves stack skills for agents */
  stack?: string;
  agents: Record<string, CompileAgentConfig>; // Keys determine which agents to compile
}

// =============================================================================
// Resolved/Compiled Types (used during compilation)
// =============================================================================

/**
 * Fully resolved agent config (agent definition + compile config)
 * This is what the compiler uses after merging agent definitions with stack config
 */
export interface AgentConfig {
  name: string;
  title: string;
  description: string;
  model?: string;
  tools: string[];
  disallowed_tools?: string[]; // Tools this agent cannot use
  permission_mode?: string; // Permission mode for agent operations
  hooks?: Record<string, AgentHookDefinition[]>; // Lifecycle hooks
  output_format?: string;
  skills: Skill[]; // Unified skills list (loaded dynamically via Skill tool)
  path?: string; // Relative path to agent directory (e.g., "developer/backend-developer")
}

export interface CompiledAgentData {
  agent: AgentConfig;
  intro: string;
  workflow: string;
  examples: string;
  criticalRequirementsTop: string; // <critical_requirements> at TOP
  criticalReminders: string; // <critical_reminders> at BOTTOM
  outputFormat: string;
  skills: Skill[]; // Flat array of all skills
  preloadedSkills: Skill[]; // Skills with content embedded
  dynamicSkills: Skill[]; // Skills loaded via Skill tool (metadata only)
  preloadedSkillIds: string[]; // IDs for frontmatter and skill tool check
}

// =============================================================================
// Validation Types
// =============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// =============================================================================
// Stack Types
// =============================================================================

/**
 * Stack configuration from stacks/{stack-id}/config.yaml
 * Bundles framework, skills, agents, and philosophy into a single config
 */
export interface StackConfig {
  id?: string;
  name: string;
  version: string;
  author: string;
  description?: string;
  created?: string;
  updated?: string;
  framework?: string;
  /** Array of skill assignments with preloaded flag */
  skills: SkillAssignment[];
  /** List of agent names this stack supports */
  agents: string[];
  /** Per-agent skill assignments - maps agent name to categories, each with array of skill assignments */
  agent_skills?: Record<string, Record<string, SkillAssignment[]>>;
  /** Lifecycle hooks for the stack plugin */
  hooks?: Record<string, AgentHookDefinition[]>;
  philosophy?: string;
  principles?: string[];
  tags?: string[];
  overrides?: Record<string, StackOverrideRule>;
  metrics?: StackMetrics;
}

export interface StackOverrideRule {
  alternatives?: string[];
  locked?: boolean;
}

export interface StackMetrics {
  upvotes?: number;
  downloads?: number;
}

// =============================================================================
// Co-located Config Types (Phase 0A - replaces registry.yaml)
// =============================================================================

/**
 * Agent configuration from agent.yaml (co-located in each agent folder)
 * Supports official Claude Code plugin format fields
 */
export interface AgentYamlConfig {
  id: string;
  title: string;
  description: string;
  model?: string;
  tools: string[];
  disallowed_tools?: string[]; // Tools this agent cannot use
  permission_mode?: string; // Permission mode for agent operations
  hooks?: Record<string, AgentHookDefinition[]>; // Lifecycle hooks
  output_format?: string;
}

/**
 * Skill configuration from skill.yaml (co-located in each skill folder)
 * @deprecated Use SkillMetadataConfig + SKILL.md frontmatter instead (Phase 0B)
 */
export interface SkillYamlConfig {
  id: string;
  name: string;
  description: string;
  category?: string;
  category_exclusive?: boolean;
  author?: string;
  version?: string;
  tags?: string[];
}

// =============================================================================
// Phase 0B: SKILL.md as Source of Truth (Official Claude Code Plugin Format)
// =============================================================================

/**
 * SKILL.md frontmatter - matches official Claude Code plugin format
 * Contains: name (kebab-case identifier), description, and optional runtime behavior
 *
 * Note: `author` and `version` are in metadata.yaml (for marketplace.json), NOT here
 */
export interface SkillFrontmatter {
  /** Skill identifier in kebab-case (e.g., "react", "api-hono"). Used as plugin name. */
  name: string;
  /** Brief description of the skill's purpose for Claude agents */
  description: string;
  /** If true, prevents the AI model from invoking this skill. Default: false */
  "disable-model-invocation"?: boolean;
  /** If true, users can invoke this skill directly. Default: true */
  "user-invocable"?: boolean;
  /** Comma-separated list of tools this skill can use (e.g., "Read, Grep, Glob") */
  "allowed-tools"?: string;
  /** AI model to use for this skill */
  model?: "sonnet" | "opus" | "haiku" | "inherit";
  /** Context mode for skill execution */
  context?: "fork";
  /** Agent name to use when skill is invoked */
  agent?: string;
  /** Hint for arguments when skill is invoked */
  "argument-hint"?: string;
}

/**
 * metadata.yaml - relationship and catalog data for skills
 * Identity (name, description) comes from SKILL.md frontmatter
 */
export interface SkillMetadataConfig {
  category?: string;
  category_exclusive?: boolean;
  author?: string;
  version?: string;
  tags?: string[];
  requires?: string[];
  compatible_with?: string[];
  conflicts_with?: string[];
}

// =============================================================================
// Phase 0C: Agent Frontmatter (Official Claude Code Plugin Format)
// =============================================================================

/**
 * Hook action types for agent lifecycle hooks
 */
export interface AgentHookAction {
  type: "command" | "script" | "prompt";
  command?: string;
  script?: string;
  prompt?: string;
}

/**
 * Hook definition with matcher and actions
 */
export interface AgentHookDefinition {
  matcher?: string;
  hooks?: AgentHookAction[];
}

/**
 * Agent frontmatter - matches official Claude Code plugin format for agents
 * Used in compiled agent.md files
 */
export interface AgentFrontmatter {
  /** Agent identifier in kebab-case (e.g., "frontend-developer"). Used as plugin name. */
  name: string;
  /** Brief description of the agent's purpose. Shown in Task tool description. */
  description: string;
  /** Comma-separated list of tools available to this agent */
  tools?: string;
  /** Comma-separated list of tools this agent cannot use */
  disallowedTools?: string;
  /** AI model to use for this agent. Use "inherit" to use parent model. */
  model?: "sonnet" | "opus" | "haiku" | "inherit";
  /** Permission mode for agent operations */
  permissionMode?:
    | "default"
    | "acceptEdits"
    | "dontAsk"
    | "bypassPermissions"
    | "plan"
    | "delegate";
  /** Array of skill names that are preloaded for this agent */
  skills?: string[];
  /** Lifecycle hooks for agent execution */
  hooks?: Record<string, AgentHookDefinition[]>;
}

// =============================================================================
// Plugin Manifest Types (Claude Code Plugin System)
// =============================================================================

/**
 * Author information for plugin manifest
 */
export interface PluginAuthor {
  /** Author's display name */
  name: string;
  /** Author's email address (optional) */
  email?: string;
}

/**
 * Plugin manifest for Claude Code plugins (plugin.json)
 * Defines the structure and content of a plugin package
 */
export interface PluginManifest {
  /** Plugin name in kebab-case (e.g., "skill-react", "stack-modern-react") */
  name: string;
  /** Plugin version in semver format (e.g., "1.0.0") */
  version?: string;
  /** Brief description of the plugin's purpose */
  description?: string;
  /** Plugin author information */
  author?: PluginAuthor;
  /** URL to plugin documentation or homepage */
  homepage?: string;
  /** URL to plugin source repository */
  repository?: string;
  /** SPDX license identifier */
  license?: string;
  /** Keywords for discoverability */
  keywords?: string[];
  /** Path(s) to commands directory or files */
  commands?: string | string[];
  /** Path(s) to agents directory or files */
  agents?: string | string[];
  /** Path(s) to skills directory or files */
  skills?: string | string[];
  /** Path to hooks config file or inline hooks object */
  hooks?: string | Record<string, AgentHookDefinition[]>;
  /** Path to MCP servers config file or inline object */
  mcpServers?: string | object;
}

// =============================================================================
// Marketplace Types (for marketplace.json)
// =============================================================================

/**
 * Remote source configuration for marketplace plugins
 */
export interface MarketplaceRemoteSource {
  /** Source type: github or url */
  source: "github" | "url";
  /** GitHub repository in owner/repo format */
  repo?: string;
  /** Direct URL to plugin archive */
  url?: string;
  /** Git ref (branch, tag, or commit) */
  ref?: string;
}

/**
 * Plugin entry in a marketplace.json file
 */
export interface MarketplacePlugin {
  /** Plugin name in kebab-case (e.g., "skill-react") */
  name: string;
  /** Local path or remote source configuration */
  source: string | MarketplaceRemoteSource;
  /** Brief description of the plugin */
  description?: string;
  /** Plugin version */
  version?: string;
  /** Plugin author information */
  author?: PluginAuthor;
  /** Plugin category for organization (e.g., "frontend", "backend") */
  category?: string;
  /** Keywords for discoverability */
  keywords?: string[];
}

/**
 * Marketplace owner information
 */
export interface MarketplaceOwner {
  /** Owner's display name */
  name: string;
  /** Owner's contact email */
  email?: string;
}

/**
 * Marketplace metadata
 */
export interface MarketplaceMetadata {
  /** Root directory for plugin sources */
  pluginRoot?: string;
}

/**
 * Marketplace configuration (marketplace.json)
 * Defines a collection of Claude Code plugins
 */
export interface Marketplace {
  /** JSON schema reference URL */
  $schema?: string;
  /** Marketplace name in kebab-case */
  name: string;
  /** Marketplace version (semantic versioning) */
  version: string;
  /** Brief description of the marketplace */
  description?: string;
  /** Marketplace owner information */
  owner: MarketplaceOwner;
  /** Additional marketplace metadata */
  metadata?: MarketplaceMetadata;
  /** List of plugins in the marketplace */
  plugins: MarketplacePlugin[];
}

// =============================================================================
// Config Types (for ~/.claude-collective/config.yaml)
// =============================================================================

/**
 * User configuration stored in ~/.claude-collective/config.yaml
 * Manages source settings and active stack state
 */
export interface Config {
  /** Source URL for fetching skills/agents (e.g., "github:claude-collective/skills") */
  source?: string;
  /** Name of the currently active stack (e.g., "work-stack"). Used by cc add and cc switch. */
  active_stack?: string;
}

// =============================================================================
// Fetcher Types (for unified cc init flow)
// =============================================================================

/**
 * Result from fetching marketplace data from a remote source.
 * Contains the parsed marketplace and caching metadata.
 */
export interface MarketplaceFetchResult {
  /** Parsed marketplace data */
  marketplace: Marketplace;
  /** Path where source was fetched/cached */
  sourcePath: string;
  /** Whether result came from cache */
  fromCache: boolean;
  /** Cache key for invalidation (optional) */
  cacheKey?: string;
}

/**
 * Paths to fetched agent definition sources.
 * Contains directory paths, not agent data itself.
 */
export interface AgentSourcePaths {
  /** Path to agents directory (contains agent subdirs) */
  agentsDir: string;
  /** Path to _templates directory */
  templatesDir: string;
  /** Original source path */
  sourcePath: string;
}

/**
 * Options for compiling a complete plugin.
 * Used by unified compilation flow.
 */
export interface PluginCompileOptions {
  /** Output plugin directory */
  pluginDir: string;
  /** Path to skills directory in plugin */
  skillsDir: string;
  /** Fetched agent definition paths */
  agentDefs: AgentSourcePaths;
  /** Agent configs (matches CompileConfig.agents pattern) */
  agentConfigs: Record<string, CompileAgentConfig>;
  /** Enable verbose logging */
  verbose?: boolean;
}
