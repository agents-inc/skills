// Re-export all shared types from the main types file
export * from '../types';

// CLI-specific types

/** Options for the compile command */
export interface CompileOptions {
  stack?: string;
  verbose?: boolean;
}

/** Options for the init command */
export interface InitOptions {
  stack?: string;
  yes?: boolean;
}

/** Result from validation */
export interface ValidationSummary {
  agentCount: number;
  skillCount: number;
  errors: string[];
  warnings: string[];
}

/** Compilation context passed through the compile pipeline */
export interface CompileContext {
  stackId: string;
  verbose: boolean;
  projectRoot: string;
  outputDir: string;
}
