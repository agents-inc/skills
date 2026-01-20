import { Command } from 'commander'
import * as p from '@clack/prompts'
import pc from 'picocolors'
import path from 'path'
import { parse as parseYaml } from 'yaml'
import { readFile } from '../utils/fs'
import { PROJECT_ROOT } from '../consts'
import { runWizard, buildMvpMatrix, clearTerminal, renderSelectionsHeader } from '../lib/wizard'
import type { SkillsMatrixConfig } from '../types-matrix'

// Default path to MVP matrix config for testing
const DEFAULT_MATRIX_PATH = 'src/config/skills-matrix-mvp.yaml'

export const initCommand = new Command('init')
  .description('Initialize Claude Collective in your project')
  .option('--matrix <path>', 'Path to skills-matrix.yaml config', DEFAULT_MATRIX_PATH)
  .option('-y, --yes', 'Skip prompts and use defaults')
  .configureOutput({
    writeErr: str => console.error(pc.red(str)),
  })
  .showHelpAfterError(true)
  .action(async options => {
    p.intro(pc.cyan('Claude Collective Setup') + pc.dim(' (MVP Test Mode)'))

    // Load skills matrix config
    const matrixPath = path.isAbsolute(options.matrix) ? options.matrix : path.join(PROJECT_ROOT, options.matrix)

    let matrixConfig: SkillsMatrixConfig

    const s = p.spinner()
    s.start('Loading skills matrix...')

    try {
      const content = await readFile(matrixPath)
      matrixConfig = parseYaml(content) as SkillsMatrixConfig
      s.stop(`Loaded ${Object.keys(matrixConfig.skill_aliases).length} skills from matrix`)
    } catch (error) {
      s.stop('Failed to load skills matrix')
      p.log.error(`Could not load skills matrix from ${matrixPath}`)
      p.log.info('Make sure the file exists and is valid YAML')
      process.exit(1)
    }

    // Build merged matrix for wizard (MVP mode - from config only)
    const matrix = buildMvpMatrix(matrixConfig)

    // Run the wizard
    const result = await runWizard(matrix)

    if (!result) {
      p.cancel('Setup cancelled')
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

    // MVP TEST MODE - Don't actually do anything
    console.log(pc.bgYellow(pc.black(' MVP TEST MODE ')))
    console.log(pc.yellow('Wizard completed successfully, but no files were created.'))
    console.log(pc.dim('This is a test run - remove this block to enable actual setup.\n'))

    p.outro(pc.green('Test complete! Wizard navigation works correctly.'))
  })
