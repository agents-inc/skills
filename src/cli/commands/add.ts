import { Command } from 'commander'
import * as p from '@clack/prompts'
import pc from 'picocolors'
import path from 'path'
import { PROJECT_ROOT, DEFAULT_MATRIX_PATH } from '../consts'
import { directoryExists, listDirectories } from '../utils/fs'
import { runWizard, clearTerminal, renderSelectionsHeader } from '../lib/wizard'
import { loadAndMergeSkillsMatrix } from '../lib/matrix-loader'
import { createStack, promptStackName, displayStackSummary } from '../lib/stack-creator'

/**
 * Check if a project has been initialized (.claude/stacks/ directory exists)
 */
async function isInitialized(projectDir: string): Promise<boolean> {
  const stacksDir = path.join(projectDir, '.claude', 'stacks')
  return directoryExists(stacksDir)
}

/**
 * Get list of existing stack names by reading .claude/stacks/ directory
 */
async function getExistingStacks(projectDir: string): Promise<string[]> {
  const stacksDir = path.join(projectDir, '.claude', 'stacks')
  return listDirectories(stacksDir)
}

export const addCommand = new Command('add')
  .description('Add a new stack to your project')
  .option('--matrix <path>', 'Path to skills-matrix.yaml config', DEFAULT_MATRIX_PATH)
  .configureOutput({
    writeErr: str => console.error(pc.red(str)),
  })
  .showHelpAfterError(true)
  .action(async options => {
    // Determine target directory (current working directory)
    const projectDir = process.cwd()

    p.intro(pc.cyan('Add New Stack'))

    // Check if initialized
    const initialized = await isInitialized(projectDir)
    if (!initialized) {
      p.log.error('Project not initialized.')
      p.log.info(`Run ${pc.cyan('cc init')} first to set up Claude Collective.`)
      process.exit(1)
    }

    // Get existing stacks from filesystem
    const existingStacks = await getExistingStacks(projectDir)
    if (existingStacks.length > 0) {
      console.log(pc.dim(`Existing stacks: ${existingStacks.join(', ')}`))
      console.log('')
    }

    // Load skills matrix config
    const matrixPath = path.isAbsolute(options.matrix) ? options.matrix : path.join(PROJECT_ROOT, options.matrix)

    const s = p.spinner()
    s.start('Loading skills matrix...')

    let matrix
    try {
      matrix = await loadAndMergeSkillsMatrix(matrixPath, PROJECT_ROOT)
      s.stop(`Loaded ${Object.keys(matrix.skills).length} skills from matrix`)
    } catch (error) {
      s.stop('Failed to load skills matrix')
      p.log.error(`Could not load skills matrix from ${matrixPath}`)
      p.log.info('Make sure the file exists and is valid YAML')
      process.exit(1)
    }

    // Prompt for stack name first
    const stackName = await promptStackName(existingStacks, 'new-stack')

    if (p.isCancel(stackName)) {
      p.cancel('Cancelled')
      process.exit(0)
    }

    // Run the wizard
    const result = await runWizard(matrix)

    if (!result) {
      p.cancel('Cancelled')
      process.exit(0)
    }

    // Validate the result
    if (!result.validation.valid) {
      p.log.error('Selection has validation errors:')
      for (const error of result.validation.errors) {
        p.log.error(`  ${error.message}`)
      }
      process.exit(1)
    }

    // Show final summary - clear screen and show selections header
    clearTerminal()
    renderSelectionsHeader(result.selectedSkills, matrix)

    // Show warnings if any
    if (result.validation.warnings.length > 0) {
      console.log(pc.yellow('Warnings:'))
      for (const warning of result.validation.warnings) {
        console.log(`  ${pc.yellow('!')} ${warning.message}`)
      }
      console.log('')
    }

    // Create the stack
    s.start(`Creating stack "${stackName}"...`)
    try {
      const createResult = await createStack(
        stackName as string,
        result.selectedSkills,
        matrix,
        projectDir,
        result.selectedStack,
        PROJECT_ROOT,
      )
      s.stop(`Stack created with ${createResult.skillCount} skills`)

      // Display summary
      displayStackSummary(createResult)

      p.outro(pc.green(`Stack "${stackName}" added successfully!`))
    } catch (error) {
      s.stop('Failed to create stack')
      p.log.error(`Error: ${error}`)
      process.exit(1)
    }
  })
