import path from 'path'
import * as p from '@clack/prompts'
import pc from 'picocolors'
import { ensureDir } from '../utils/fs'
import { PROJECT_ROOT } from '../consts'
import { copySkillsToStack, getStackDir } from './skill-copier'
import { generateStackLock, writeStackLock } from './stack-lock'
import { createStackConfig, createStackConfigFromSuggested, writeStackConfig } from './stack-config'
import type { MergedSkillsMatrix, ResolvedStack } from '../types-matrix'
import type { CopiedSkill } from './skill-copier'

/**
 * CLI version - should match package.json
 */
export const CLI_VERSION = '0.1.0'

/**
 * Regex for valid stack names (kebab-case)
 */
const STACK_NAME_REGEX = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/

/**
 * Validate a stack name follows kebab-case convention
 */
export function isValidStackName(name: string): boolean {
  return STACK_NAME_REGEX.test(name)
}

/**
 * Result of creating a stack
 */
export interface CreateStackResult {
  stackName: string
  stackDir: string
  copiedSkills: CopiedSkill[]
  skillCount: number
}

/**
 * Create a stack from wizard result
 * Handles copying skills, generating lock files, and config
 */
export async function createStack(
  stackName: string,
  selectedSkillIds: string[],
  matrix: MergedSkillsMatrix,
  projectDir: string,
  selectedStack: ResolvedStack | null,
  registryRoot: string = PROJECT_ROOT,
): Promise<CreateStackResult> {
  const stackDir = getStackDir(projectDir, stackName)

  // Ensure stack directory exists
  await ensureDir(stackDir)

  // Copy skills to stack
  const copiedSkills = await copySkillsToStack(selectedSkillIds, stackDir, matrix, registryRoot)

  // Generate and write stack lock file
  const stackLock = generateStackLock(stackName, copiedSkills)
  await writeStackLock(stackDir, stackLock)

  // Generate and write stack config
  let stackConfig
  if (selectedStack) {
    stackConfig = createStackConfigFromSuggested(stackName, selectedStack)
  } else {
    stackConfig = createStackConfig(
      stackName,
      `Custom stack with ${selectedSkillIds.length} skills`,
      selectedSkillIds,
    )
  }
  await writeStackConfig(stackDir, stackConfig)

  return {
    stackName,
    stackDir,
    copiedSkills,
    skillCount: copiedSkills.length,
  }
}

/**
 * Prompt for a stack name with validation
 */
export async function promptStackName(
  existingNames: string[],
  defaultName: string = 'my-stack',
): Promise<string | symbol> {
  const result = await p.text({
    message: 'Stack name:',
    placeholder: defaultName,
    defaultValue: defaultName,
    validate: (value) => {
      if (!value || value.trim().length === 0) {
        return 'Stack name is required'
      }

      const name = value.trim().toLowerCase()

      if (!isValidStackName(name)) {
        return 'Stack name must be kebab-case (e.g., my-stack, work-project)'
      }

      if (existingNames.includes(name)) {
        return `Stack "${name}" already exists. Choose a different name.`
      }

      return undefined
    },
  })

  if (p.isCancel(result)) {
    return result
  }

  return (result as string).trim().toLowerCase()
}

/**
 * Display a summary of the created stack
 */
export function displayStackSummary(result: CreateStackResult): void {
  console.log('')
  console.log(pc.green(`Stack "${result.stackName}" created successfully!`))
  console.log('')
  console.log(pc.dim('Files created:'))
  console.log(`  ${pc.cyan(path.relative(process.cwd(), result.stackDir))}`)
  console.log(`    ${pc.dim('config.yaml')}`)
  console.log(`    ${pc.dim('stack.lock.yaml')}`)
  console.log(`    ${pc.dim(`skills/ (${result.skillCount} skills)`)}`)
  console.log('')
}
