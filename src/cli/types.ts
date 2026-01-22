// Re-export all shared types from the main types file
export * from '../types';

// CLI-specific types

/** Compilation context passed through the compile pipeline */
export interface CompileContext {
  stackId: string;
  verbose: boolean;
  projectRoot: string;
  outputDir: string;
}
