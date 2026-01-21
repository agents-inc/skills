import path from 'path'
import { stringify as stringifyYaml, parse as parseYaml } from 'yaml'
import { readFile, writeFile, fileExists } from '../utils/fs'
import type { ResolvedStack } from '../types-matrix'

/**
 * Stack config file name
 */
const STACK_CONFIG_NAME = 'config.yaml'

/**
 * Stack configuration structure
 */
export interface StackConfig {
  name: string
  description: string
  created_at: string
  updated_at: string
  based_on_stack?: string
  skill_ids: string[]
}

/**
 * Get the stack config file path
 */
export function getStackConfigPath(stackDir: string): string {
  return path.join(stackDir, STACK_CONFIG_NAME)
}

/**
 * Create a stack config from wizard result
 */
export function createStackConfig(
  stackName: string,
  description: string,
  skillIds: string[],
  basedOnStack?: string,
): StackConfig {
  const now = new Date().toISOString()
  return {
    name: stackName,
    description,
    created_at: now,
    updated_at: now,
    based_on_stack: basedOnStack,
    skill_ids: skillIds,
  }
}

/**
 * Create a stack config from a suggested stack selection
 */
export function createStackConfigFromSuggested(
  stackName: string,
  suggestedStack: ResolvedStack,
): StackConfig {
  return createStackConfig(
    stackName,
    suggestedStack.description,
    suggestedStack.allSkillIds,
    suggestedStack.id,
  )
}

/**
 * Write the stack config file
 */
export async function writeStackConfig(stackDir: string, config: StackConfig): Promise<void> {
  const configPath = getStackConfigPath(stackDir)
  const content = stringifyYaml(config, { lineWidth: 0 })
  await writeFile(configPath, content)
}

/**
 * Read the stack config file
 * Returns null if the file doesn't exist
 */
export async function readStackConfig(stackDir: string): Promise<StackConfig | null> {
  const configPath = getStackConfigPath(stackDir)
  const exists = await fileExists(configPath)

  if (!exists) {
    return null
  }

  const content = await readFile(configPath)
  return parseYaml(content) as StackConfig
}

/**
 * Update the stack config with new skill IDs
 */
export function updateStackConfig(
  config: StackConfig,
  skillIds: string[],
  basedOnStack?: string,
): StackConfig {
  return {
    ...config,
    updated_at: new Date().toISOString(),
    skill_ids: skillIds,
    based_on_stack: basedOnStack,
  }
}
