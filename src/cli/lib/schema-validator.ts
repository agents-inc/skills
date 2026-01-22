import Ajv, { type ValidateFunction, type ErrorObject } from 'ajv'
import addFormats from 'ajv-formats'
import path from 'path'
import { readFile, fileExists } from '../utils/fs'
import { parse as parseYaml } from 'yaml'
import fg from 'fast-glob'
import { PROJECT_ROOT } from '../consts'

// =============================================================================
// Types
// =============================================================================

export interface FileValidationError {
  file: string
  errors: string[]
}

export interface SchemaValidationResult {
  schemaName: string
  valid: boolean
  totalFiles: number
  validFiles: number
  invalidFiles: FileValidationError[]
}

export interface FullValidationResult {
  valid: boolean
  results: SchemaValidationResult[]
  summary: {
    totalSchemas: number
    totalFiles: number
    validFiles: number
    invalidFiles: number
  }
}

/**
 * Content extractor function type
 * Returns the content to validate (parsed YAML/JSON) or null if extraction fails
 */
type ContentExtractor = (content: string) => unknown | null

/**
 * Schema validation target definition
 */
interface ValidationTarget {
  /** Human-readable name */
  name: string
  /** Path to the JSON schema file (relative to src/schemas/) */
  schema: string
  /** Glob pattern to find files to validate */
  pattern: string
  /** Base directory for the pattern */
  baseDir: string
  /** Optional content extractor for non-standard file formats (e.g., frontmatter) */
  extractor?: ContentExtractor
}

// =============================================================================
// Content Extractors
// =============================================================================

/**
 * Extract YAML frontmatter from a markdown file
 * Frontmatter is delimited by --- at the start and end
 */
function extractFrontmatter(content: string): unknown | null {
  const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---/
  const match = content.match(frontmatterRegex)

  if (!match || !match[1]) {
    return null
  }

  try {
    return parseYaml(match[1])
  } catch {
    return null
  }
}

// =============================================================================
// Validation Targets
// =============================================================================

const VALIDATION_TARGETS: ValidationTarget[] = [
  {
    name: 'Skill Metadata',
    schema: 'metadata.schema.json',
    pattern: '**/metadata.yaml',
    baseDir: 'src/skills',
  },
  {
    name: 'Stack Skill Metadata',
    schema: 'metadata.schema.json',
    pattern: '**/skills/**/metadata.yaml',
    baseDir: 'src/stacks',
  },
  {
    name: 'Stack Config',
    schema: 'stack.schema.json',
    pattern: '*/config.yaml',
    baseDir: 'src/stacks',
  },
  {
    name: 'Agent Definition',
    schema: 'agent.schema.json',
    pattern: '*/agent.yaml',
    baseDir: 'src/agent-sources',
  },
  {
    name: 'Skill Frontmatter',
    schema: 'skill-frontmatter.schema.json',
    pattern: '**/SKILL.md',
    baseDir: 'src/skills',
    extractor: extractFrontmatter,
  },
  {
    name: 'Stack Skill Frontmatter',
    schema: 'skill-frontmatter.schema.json',
    pattern: '**/skills/**/SKILL.md',
    baseDir: 'src/stacks',
    extractor: extractFrontmatter,
  },
]

// =============================================================================
// Schema Loading & Caching
// =============================================================================

const schemaCache = new Map<string, object>()
const validatorCache = new Map<string, ValidateFunction>()

/**
 * Load a JSON schema from the schemas directory
 */
async function loadSchema(schemaName: string): Promise<object> {
  if (schemaCache.has(schemaName)) {
    return schemaCache.get(schemaName)!
  }

  const schemaPath = path.join(PROJECT_ROOT, 'src', 'schemas', schemaName)
  const content = await readFile(schemaPath)
  const schema = JSON.parse(content)
  schemaCache.set(schemaName, schema)
  return schema
}

/**
 * Get or create a validator for a schema
 */
async function getValidator(schemaName: string): Promise<ValidateFunction> {
  if (validatorCache.has(schemaName)) {
    return validatorCache.get(schemaName)!
  }

  const ajv = new Ajv({ allErrors: true, strict: false })
  addFormats(ajv) // Add support for format: "date", "date-time", etc.
  const schema = await loadSchema(schemaName)
  const validate = ajv.compile(schema)
  validatorCache.set(schemaName, validate)
  return validate
}

// =============================================================================
// Error Formatting
// =============================================================================

/**
 * Format ajv errors into readable strings
 */
function formatAjvErrors(errors: ErrorObject[] | null | undefined): string[] {
  if (!errors) return []

  return errors.map((err) => {
    const errorPath = err.instancePath
      ? err.instancePath.replace(/^\//, '').replace(/\//g, '.')
      : ''
    const message = err.message || 'Unknown error'

    if (err.keyword === 'additionalProperties') {
      const prop = (err.params as { additionalProperty?: string }).additionalProperty
      return `Unrecognized key: "${prop}"`
    }

    if (err.keyword === 'enum') {
      const allowed = (err.params as { allowedValues?: string[] }).allowedValues
      return errorPath
        ? `${errorPath}: ${message}. Allowed: ${allowed?.join(', ')}`
        : `${message}. Allowed: ${allowed?.join(', ')}`
    }

    return errorPath ? `${errorPath}: ${message}` : message
  })
}

// =============================================================================
// Validation Functions
// =============================================================================

/**
 * Validate a single file against a schema
 */
async function validateFile(
  filePath: string,
  validate: ValidateFunction,
  extractor?: ContentExtractor
): Promise<{ valid: boolean; errors: string[] }> {
  try {
    if (!(await fileExists(filePath))) {
      return { valid: false, errors: [`File not found: ${filePath}`] }
    }

    const content = await readFile(filePath)

    // Use extractor if provided, otherwise parse as YAML
    let parsed: unknown
    if (extractor) {
      parsed = extractor(content)
      if (parsed === null) {
        return { valid: false, errors: ['Failed to extract content (no valid frontmatter found)'] }
      }
    } else {
      parsed = parseYaml(content)
    }

    const isValid = validate(parsed)

    if (isValid) {
      return { valid: true, errors: [] }
    }

    return { valid: false, errors: formatAjvErrors(validate.errors) }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { valid: false, errors: [`Failed to parse content: ${message}`] }
  }
}

/**
 * Validate all files matching a pattern against a schema
 */
async function validateTarget(target: ValidationTarget): Promise<SchemaValidationResult> {
  const baseDir = path.join(PROJECT_ROOT, target.baseDir)
  const pattern = path.join(baseDir, target.pattern)
  const files = await fg(pattern, { absolute: true })

  const result: SchemaValidationResult = {
    schemaName: target.name,
    valid: true,
    totalFiles: files.length,
    validFiles: 0,
    invalidFiles: [],
  }

  if (files.length === 0) {
    return result
  }

  const validate = await getValidator(target.schema)

  for (const file of files) {
    const validation = await validateFile(file, validate, target.extractor)
    const relativePath = path.relative(PROJECT_ROOT, file)

    if (validation.valid) {
      result.validFiles++
    } else {
      result.valid = false
      result.invalidFiles.push({
        file: relativePath,
        errors: validation.errors,
      })
    }
  }

  return result
}

/**
 * Validate all schemas
 */
export async function validateAllSchemas(): Promise<FullValidationResult> {
  const results: SchemaValidationResult[] = []

  for (const target of VALIDATION_TARGETS) {
    const result = await validateTarget(target)
    results.push(result)
  }

  const summary = {
    totalSchemas: results.length,
    totalFiles: results.reduce((sum, r) => sum + r.totalFiles, 0),
    validFiles: results.reduce((sum, r) => sum + r.validFiles, 0),
    invalidFiles: results.reduce((sum, r) => sum + r.invalidFiles.length, 0),
  }

  return {
    valid: results.every((r) => r.valid),
    results,
    summary,
  }
}

/**
 * Print validation results to console
 */
export function printValidationResults(result: FullValidationResult): void {
  console.log(`\n  Schema Validation Summary:`)
  console.log(`  ─────────────────────────`)
  console.log(`  Total schemas checked: ${result.summary.totalSchemas}`)
  console.log(`  Total files: ${result.summary.totalFiles}`)
  console.log(`  Valid: ${result.summary.validFiles}`)
  console.log(`  Invalid: ${result.summary.invalidFiles}`)

  for (const schemaResult of result.results) {
    if (schemaResult.totalFiles === 0) continue

    const status = schemaResult.valid ? '✓' : '✗'
    console.log(
      `\n  ${status} ${schemaResult.schemaName}: ${schemaResult.validFiles}/${schemaResult.totalFiles} valid`
    )

    if (schemaResult.invalidFiles.length > 0) {
      for (const file of schemaResult.invalidFiles) {
        console.log(`\n    ${file.file}:`)
        file.errors.forEach((e) => console.log(`      - ${e}`))
      }
    }
  }

  if (result.valid) {
    console.log(`\n  ✓ All schemas validated successfully\n`)
  } else {
    console.log(`\n  ✗ Validation failed\n`)
  }
}
