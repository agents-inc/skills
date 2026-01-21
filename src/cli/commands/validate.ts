import { Command } from 'commander'
import * as p from '@clack/prompts'
import pc from 'picocolors'
import { setVerbose } from '../utils/logger'
import {
  validateAllSchemas,
  printValidationResults,
} from '../lib/schema-validator'

export const validateCommand = new Command('validate')
  .description('Validate all YAML files against their schemas')
  .option('-v, --verbose', 'Enable verbose logging', false)
  .configureOutput({
    writeErr: (str) => console.error(pc.red(str)),
  })
  .showHelpAfterError(true)
  .action(async (options) => {
    const s = p.spinner()

    setVerbose(options.verbose)

    console.log(`\n${pc.bold('📋 Validating all schemas')}\n`)

    try {
      s.start('Validating...')
      const result = await validateAllSchemas()
      s.stop(
        result.valid
          ? pc.green(`✓ ${result.summary.validFiles}/${result.summary.totalFiles} files valid`)
          : pc.red(`✗ ${result.summary.invalidFiles} invalid files`)
      )

      printValidationResults(result)

      if (!result.valid) {
        process.exit(1)
      }
    } catch (error) {
      s.stop(pc.red('Validation failed'))
      const message = error instanceof Error ? error.message : String(error)
      console.error(pc.red(`\nError: ${message}\n`))
      process.exit(1)
    }
  })
