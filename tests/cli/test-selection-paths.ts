#!/usr/bin/env bun
/**
 * Test all selection paths through the CLI wizard
 * Simulates user selections to verify all skill combinations work
 */

import path from 'path'
import { loadAndMergeSkillsMatrix } from '../../src/cli/lib/matrix-loader'
import {
  getTopLevelCategories,
  getSubcategories,
  getAvailableSkills,
  validateSelection,
  isDisabled,
} from '../../src/cli/lib/matrix-resolver'
import type { MergedSkillsMatrix } from '../../src/cli/types-matrix'

const PROJECT_ROOT = path.resolve(__dirname, '../..')
const MATRIX_PATH = path.join(PROJECT_ROOT, 'src/config/skills-matrix.yaml')

interface TestResult {
  path: string
  success: boolean
  skills: string[]
  error?: string
}

const results: TestResult[] = []
let testCount = 0
let passCount = 0
let failCount = 0

function log(msg: string) {
  console.log(msg)
}

function logSection(title: string) {
  console.log(`\n${'='.repeat(70)}`)
  console.log(`  ${title}`)
  console.log(`${'='.repeat(70)}\n`)
}

/**
 * Test selecting a framework and then all available dependent skills
 */
async function testFrameworkPath(
  frameworkAlias: string,
  frameworkId: string,
  matrix: MergedSkillsMatrix
) {
  log(`\nTesting: ${frameworkAlias}`)

  const selectedSkills = [frameworkId]

  // Get all categories
  const topCategories = getTopLevelCategories(matrix)

  for (const topCatId of topCategories) {
    const subcategories = getSubcategories(topCatId, matrix)

    for (const subCatId of subcategories) {
      const availableSkills = getAvailableSkills(subCatId, selectedSkills, matrix)
      const enabledSkills = availableSkills.filter(s => !s.disabled && !s.selected)

      if (enabledSkills.length > 0) {
        // Try selecting each enabled skill
        for (const skill of enabledSkills) {
          testCount++
          const testSelection = [...selectedSkills, skill.id]
          const validation = validateSelection(testSelection, matrix)

          if (validation.valid) {
            passCount++
            log(`  ✓ ${frameworkAlias} + ${skill.name}: Valid`)
            results.push({
              path: `${frameworkAlias}/${skill.alias || skill.id}`,
              success: true,
              skills: testSelection,
            })
          } else {
            failCount++
            const errors = validation.errors.map(e => e.message).join('; ')
            log(`  ✗ ${frameworkAlias} + ${skill.name}: ${errors}`)
            results.push({
              path: `${frameworkAlias}/${skill.alias || skill.id}`,
              success: false,
              skills: testSelection,
              error: errors,
            })
          }
        }
      }
    }
  }
}

/**
 * Test a full path through the wizard: framework → styling → state → etc.
 */
async function testFullPath(
  name: string,
  skillAliases: string[],
  matrix: MergedSkillsMatrix
) {
  testCount++

  const skillIds = skillAliases.map(alias => matrix.aliases[alias] || alias)
  const validation = validateSelection(skillIds, matrix)

  if (validation.valid) {
    passCount++
    log(`  ✓ ${name}: Valid with ${skillIds.length} skills`)
    results.push({
      path: name,
      success: true,
      skills: skillIds,
    })
  } else {
    failCount++
    const errors = validation.errors.map(e => e.message).join('; ')
    log(`  ✗ ${name}: ${errors}`)
    results.push({
      path: name,
      success: false,
      skills: skillIds,
      error: errors,
    })
  }
}

/**
 * Test that disabled skills cannot be selected
 */
async function testDisabledSkills(matrix: MergedSkillsMatrix) {
  logSection('Testing Disabled Skill States')

  // Test that React-only skills are disabled without React
  const reactOnlySkills = ['zustand', 'react-query', 'react-hook-form', 'react-testing-library']

  for (const alias of reactOnlySkills) {
    testCount++
    const skillId = matrix.aliases[alias]
    if (!skillId) continue

    const disabled = isDisabled(skillId, [], matrix)

    if (disabled) {
      passCount++
      log(`  ✓ ${alias}: Correctly disabled without React`)
    } else {
      failCount++
      log(`  ✗ ${alias}: Should be disabled without React`)
    }
  }

  // Test that Vue-only skills are disabled without Vue
  const vueOnlySkills = ['pinia', 'vee-validate', 'vue-test-utils']

  for (const alias of vueOnlySkills) {
    testCount++
    const skillId = matrix.aliases[alias]
    if (!skillId) continue

    const disabled = isDisabled(skillId, [], matrix)

    if (disabled) {
      passCount++
      log(`  ✓ ${alias}: Correctly disabled without Vue`)
    } else {
      failCount++
      log(`  ✗ ${alias}: Should be disabled without Vue`)
    }
  }

  // Test that React-only skills are ENABLED with React
  const reactId = matrix.aliases['react']
  for (const alias of reactOnlySkills) {
    testCount++
    const skillId = matrix.aliases[alias]
    if (!skillId) continue

    const disabled = isDisabled(skillId, [reactId], matrix)

    if (!disabled) {
      passCount++
      log(`  ✓ ${alias}: Correctly enabled with React`)
    } else {
      failCount++
      log(`  ✗ ${alias}: Should be enabled with React`)
    }
  }

  // Test that Vue-only skills are ENABLED with Vue
  const vueId = matrix.aliases['vue']
  for (const alias of vueOnlySkills) {
    testCount++
    const skillId = matrix.aliases[alias]
    if (!skillId) continue

    const disabled = isDisabled(skillId, [vueId], matrix)

    if (!disabled) {
      passCount++
      log(`  ✓ ${alias}: Correctly enabled with Vue`)
    } else {
      failCount++
      log(`  ✗ ${alias}: Should be enabled with Vue`)
    }
  }
}

/**
 * Test conflicting selections
 */
async function testConflicts(matrix: MergedSkillsMatrix) {
  logSection('Testing Conflict Detection')

  const conflicts = [
    { a: 'react', b: 'vue', reason: 'framework conflict' },
    { a: 'react', b: 'angular', reason: 'framework conflict' },
    { a: 'react', b: 'solidjs', reason: 'framework conflict' },
    { a: 'scss-modules', b: 'tailwind', reason: 'styling conflict' },
    { a: 'hono', b: 'express', reason: 'API framework conflict' },
    { a: 'hono', b: 'fastify', reason: 'API framework conflict' },
    { a: 'drizzle', b: 'prisma', reason: 'ORM conflict' },
    { a: 'playwright-e2e', b: 'cypress-e2e', reason: 'E2E conflict' },
  ]

  for (const conflict of conflicts) {
    testCount++

    const aId = matrix.aliases[conflict.a]
    const bId = matrix.aliases[conflict.b]

    if (!aId || !bId) {
      log(`  ? ${conflict.a} + ${conflict.b}: One or both aliases not found`)
      continue
    }

    const validation = validateSelection([aId, bId], matrix)

    if (!validation.valid) {
      passCount++
      log(`  ✓ ${conflict.a} + ${conflict.b}: Correctly rejected (${conflict.reason})`)
    } else {
      failCount++
      log(`  ✗ ${conflict.a} + ${conflict.b}: Should be rejected (${conflict.reason})`)
    }
  }
}

/**
 * Test full React stack path
 */
async function testReactStackPaths(matrix: MergedSkillsMatrix) {
  logSection('Testing React Stack Paths')

  const paths = [
    { name: 'React minimal', skills: ['react', 'scss-modules'] },
    { name: 'React + Zustand', skills: ['react', 'scss-modules', 'zustand'] },
    { name: 'React + React Query', skills: ['react', 'scss-modules', 'zustand', 'react-query'] },
    { name: 'React + Forms', skills: ['react', 'scss-modules', 'zustand', 'react-query', 'react-hook-form', 'zod-validation'] },
    { name: 'React + Testing', skills: ['react', 'scss-modules', 'zustand', 'react-query', 'vitest', 'react-testing-library'] },
    { name: 'React + MSW', skills: ['react', 'scss-modules', 'zustand', 'react-query', 'vitest', 'react-testing-library', 'msw'] },
    { name: 'React + Playwright', skills: ['react', 'scss-modules', 'zustand', 'react-query', 'vitest', 'playwright-e2e'] },
    { name: 'React + Next.js', skills: ['react', 'nextjs-app-router', 'scss-modules', 'zustand', 'react-query'] },
    { name: 'React + Tailwind + shadcn', skills: ['react', 'tailwind', 'shadcn-ui', 'zustand', 'react-query'] },
    { name: 'React + Backend', skills: ['react', 'scss-modules', 'hono', 'drizzle'] },
    { name: 'React + Backend + Auth', skills: ['react', 'scss-modules', 'hono', 'drizzle', 'better-auth'] },
  ]

  for (const path of paths) {
    await testFullPath(path.name, path.skills, matrix)
  }
}

/**
 * Test Vue stack paths
 */
async function testVueStackPaths(matrix: MergedSkillsMatrix) {
  logSection('Testing Vue Stack Paths')

  const paths = [
    { name: 'Vue minimal', skills: ['vue', 'scss-modules'] },
    { name: 'Vue + Pinia', skills: ['vue', 'scss-modules', 'pinia'] },
    { name: 'Vue + Forms', skills: ['vue', 'scss-modules', 'pinia', 'vee-validate', 'zod-validation'] },
    { name: 'Vue + Testing', skills: ['vue', 'scss-modules', 'pinia', 'vitest', 'vue-test-utils'] },
    { name: 'Vue + Nuxt', skills: ['vue', 'nuxt', 'tailwind', 'pinia'] },
    { name: 'Vue + Backend', skills: ['vue', 'scss-modules', 'hono', 'drizzle'] },
  ]

  for (const path of paths) {
    await testFullPath(path.name, path.skills, matrix)
  }
}

/**
 * Test Angular stack paths
 */
async function testAngularStackPaths(matrix: MergedSkillsMatrix) {
  logSection('Testing Angular Stack Paths')

  const paths = [
    { name: 'Angular minimal', skills: ['angular', 'scss-modules'] },
    { name: 'Angular + NgRx', skills: ['angular', 'scss-modules', 'ngrx-signalstore'] },
    { name: 'Angular + Testing', skills: ['angular', 'scss-modules', 'vitest', 'playwright-e2e'] },
    { name: 'Angular + Backend', skills: ['angular', 'scss-modules', 'hono', 'drizzle'] },
  ]

  for (const path of paths) {
    await testFullPath(path.name, path.skills, matrix)
  }
}

/**
 * Test SolidJS stack paths
 */
async function testSolidJSStackPaths(matrix: MergedSkillsMatrix) {
  logSection('Testing SolidJS Stack Paths')

  const paths = [
    { name: 'SolidJS minimal', skills: ['solidjs', 'scss-modules'] },
    { name: 'SolidJS + Tailwind', skills: ['solidjs', 'tailwind'] },
    { name: 'SolidJS + Testing', skills: ['solidjs', 'tailwind', 'vitest', 'playwright-e2e'] },
    { name: 'SolidJS + Backend', skills: ['solidjs', 'tailwind', 'hono', 'drizzle'] },
  ]

  for (const path of paths) {
    await testFullPath(path.name, path.skills, matrix)
  }
}

/**
 * Test backend-only paths
 */
async function testBackendPaths(matrix: MergedSkillsMatrix) {
  logSection('Testing Backend-Only Paths')

  const paths = [
    { name: 'Hono only', skills: ['hono'] },
    { name: 'Hono + Drizzle', skills: ['hono', 'drizzle'] },
    { name: 'Hono + Drizzle + Auth', skills: ['hono', 'drizzle', 'better-auth'] },
    { name: 'Hono + Prisma', skills: ['hono', 'prisma'] },
    { name: 'Express + Drizzle', skills: ['express', 'drizzle'] },
    { name: 'Express + Prisma', skills: ['express', 'prisma'] },
    { name: 'Fastify + Drizzle', skills: ['fastify', 'drizzle'] },
    { name: 'Fastify + Prisma', skills: ['fastify', 'prisma'] },
    { name: 'Hono + Observability', skills: ['hono', 'drizzle', 'axiom-pino-sentry', 'posthog'] },
  ]

  for (const path of paths) {
    await testFullPath(path.name, path.skills, matrix)
  }
}

/**
 * Test mobile paths
 */
async function testMobilePaths(matrix: MergedSkillsMatrix) {
  logSection('Testing Mobile Paths')

  const paths = [
    { name: 'React Native only', skills: ['react-native'] },
    { name: 'React Native + Zustand', skills: ['react-native', 'zustand'] },
    { name: 'React Native + React Query', skills: ['react-native', 'zustand', 'react-query'] },
    { name: 'React Native + Forms', skills: ['react-native', 'zustand', 'react-query', 'react-hook-form', 'zod-validation'] },
  ]

  for (const path of paths) {
    await testFullPath(path.name, path.skills, matrix)
  }
}

/**
 * Main
 */
async function main() {
  console.log('\n' + '='.repeat(70))
  console.log('  CLI Selection Path Tester')
  console.log('='.repeat(70))

  log('\nLoading skills matrix...')
  const matrix = await loadAndMergeSkillsMatrix(MATRIX_PATH, PROJECT_ROOT)
  log(`Loaded ${Object.keys(matrix.skills).length} skills`)

  // Run all tests
  await testDisabledSkills(matrix)
  await testConflicts(matrix)
  await testReactStackPaths(matrix)
  await testVueStackPaths(matrix)
  await testAngularStackPaths(matrix)
  await testSolidJSStackPaths(matrix)
  await testBackendPaths(matrix)
  await testMobilePaths(matrix)

  // Summary
  logSection('Test Summary')
  console.log(`Total tests: ${testCount}`)
  console.log(`Passed: ${passCount}`)
  console.log(`Failed: ${failCount}`)
  console.log(`Pass rate: ${((passCount / testCount) * 100).toFixed(1)}%`)

  if (failCount > 0) {
    console.log('\n--- Failed Tests ---')
    for (const result of results) {
      if (!result.success) {
        console.log(`  ${result.path}: ${result.error}`)
      }
    }
    process.exit(1)
  }

  process.exit(0)
}

main()
