import { Command } from 'commander'
import * as p from '@clack/prompts'
import pc from 'picocolors'
import path from 'path'
import { PROJECT_ROOT } from '../consts'
import { remove } from '../utils/fs'
import { runWizard, clearTerminal, renderSelectionsHeader } from '../lib/wizard'
import { loadAndMergeSkillsMatrix } from '../lib/matrix-loader'
import {
  isInitialized,
  readLockFile,
  writeLockFile,
  addStackToLockFile,
  getStackNames,
  type LockFile,
} from '../lib/lock-file'
import { readStackConfig, updateStackConfig, writeStackConfig } from '../lib/stack-config'
import { copySkillsToStack, getStackDir } from '../lib/skill-copier'
import { generateStackLock, writeStackLock } from '../lib/stack-lock'
import { displayStackSummary, type CreateStackResult } from '../lib/stack-creator'

// Default path to skills matrix config
const DEFAULT_MATRIX_PATH = 'src/config/skills-matrix.yaml'

/**
 * Prompt user to select a stack from the list
 */
async function selectStack(lockFile: LockFile): Promise<string | symbol> {
  const options = lockFile.stacks.map(stack => ({
    value: stack.name,
    label: `${stack.name} ${pc.dim(`(${stack.skill_count} skills)`)}`,
  }))

  const result = await p.select({
    message: 'Select a stack to update:',
    options,
  })

  return result as string | symbol
}

export const updateCommand = new Command('update')
  .description('Update an existing stack\'s skill selection')
  .option('--matrix <path>', 'Path to skills-matrix.yaml config', DEFAULT_MATRIX_PATH)
  .option('-s, --stack <name>', 'Stack name to update (skip selection)')
  .configureOutput({
    writeErr: str => console.error(pc.red(str)),
  })
  .showHelpAfterError(true)
  .action(async options => {
    // Determine target directory (current working directory)
    const projectDir = process.cwd()

    p.intro(pc.cyan('Update Stack'))

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
    if (existingStacks.length === 0) {
      p.log.error('No stacks found.')
      p.log.info(`Run ${pc.cyan('cc add')} to create a stack.`)
      process.exit(1)
    }

    // Select or validate stack name
    let stackName: string

    if (options.stack) {
      // Validate provided stack name exists
      if (!existingStacks.includes(options.stack)) {
        p.log.error(`Stack "${options.stack}" not found.`)
        p.log.info(`Available stacks: ${existingStacks.join(', ')}`)
        process.exit(1)
      }
      stackName = options.stack
    } else {
      // Prompt user to select a stack
      const selected = await selectStack(lockFile)

      if (p.isCancel(selected)) {
        p.cancel('Cancelled')
        process.exit(0)
      }

      stackName = selected as string
    }

    const stackDir = getStackDir(projectDir, stackName)

    // Read existing stack config
    const existingConfig = await readStackConfig(stackDir)
    if (!existingConfig) {
      p.log.error(`Could not read stack config for "${stackName}".`)
      process.exit(1)
    }

    console.log(pc.dim(`Current skills: ${existingConfig.skill_ids.length}`))
    console.log('')

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

    // TODO: Pre-populate wizard with existing selections
    // For now, start fresh wizard
    p.log.info('Starting wizard to select new skills...')
    p.log.info(pc.dim('(Pre-population of existing selections is not yet implemented)'))
    console.log('')

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

    // Confirm update
    const confirm = await p.confirm({
      message: `Update stack "${stackName}" with ${result.selectedSkills.length} skills?`,
      initialValue: true,
    })

    if (p.isCancel(confirm) || !confirm) {
      p.cancel('Cancelled')
      process.exit(0)
    }

    // Update the stack
    s.start(`Updating stack "${stackName}"...`)
    try {
      // Remove old skills directory
      const skillsDir = path.join(stackDir, 'skills')
      await remove(skillsDir)

      // Copy new skills
      const copiedSkills = await copySkillsToStack(result.selectedSkills, stackDir, matrix, PROJECT_ROOT)

      // Generate and write new stack lock
      const stackLock = generateStackLock(stackName, copiedSkills)
      await writeStackLock(stackDir, stackLock)

      // Update stack config
      const updatedConfig = updateStackConfig(
        existingConfig,
        result.selectedSkills,
        result.selectedStack?.id,
      )
      await writeStackConfig(stackDir, updatedConfig)

      s.stop(`Stack updated with ${copiedSkills.length} skills`)

      // Update lock file
      addStackToLockFile(lockFile, stackName, copiedSkills.length)
      await writeLockFile(projectDir, lockFile)

      // Display summary
      const updateResult: CreateStackResult = {
        stackName,
        stackDir,
        copiedSkills,
        skillCount: copiedSkills.length,
      }
      displayStackSummary(updateResult)

      p.outro(pc.green(`Stack "${stackName}" updated successfully!`))
    } catch (error) {
      s.stop('Failed to update stack')
      p.log.error(`Error: ${error}`)
      process.exit(1)
    }
  })
