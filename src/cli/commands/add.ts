import { Command } from 'commander'
import * as p from '@clack/prompts'
import pc from 'picocolors'
import path from 'path'
import { PROJECT_ROOT } from '../consts'
import { runWizard, clearTerminal, renderSelectionsHeader } from '../lib/wizard'
import { loadAndMergeSkillsMatrix } from '../lib/matrix-loader'
import {
  isInitialized,
  readLockFile,
  writeLockFile,
  addStackToLockFile,
  getStackNames,
} from '../lib/lock-file'
import { createStack, promptStackName, displayStackSummary } from '../lib/stack-creator'

// Default path to skills matrix config
const DEFAULT_MATRIX_PATH = 'src/config/skills-matrix.yaml'

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

    // Read existing lock file
    const lockFile = await readLockFile(projectDir)
    if (!lockFile) {
      p.log.error('Could not read lock file.')
      process.exit(1)
    }

    const existingStacks = getStackNames(lockFile)
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

      // Update and write lock file
      addStackToLockFile(lockFile, stackName as string, createResult.skillCount)
      await writeLockFile(projectDir, lockFile)

      // Display summary
      displayStackSummary(createResult)

      p.outro(pc.green(`Stack "${stackName}" added successfully!`))
    } catch (error) {
      s.stop('Failed to create stack')
      p.log.error(`Error: ${error}`)
      process.exit(1)
    }
  })
