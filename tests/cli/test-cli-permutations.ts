#!/usr/bin/env bun
/**
 * CLI Permutation Tester
 * Tests all possible combinations of skills and stacks
 * without requiring interactive input
 */

import path from 'path'
import { loadAndMergeSkillsMatrix } from '../../src/cli/lib/matrix-loader'
import {
  getTopLevelCategories,
  getSubcategories,
  getAvailableSkills,
  validateSelection,
  isDisabled,
  getDisableReason,
} from '../../src/cli/lib/matrix-resolver'
import type { MergedSkillsMatrix, SkillOption } from '../../src/cli/types-matrix'

const PROJECT_ROOT = path.resolve(__dirname, '../..')
const MATRIX_PATH = path.join(PROJECT_ROOT, 'src/config/skills-matrix.yaml')

interface TestResult {
  path: string
  success: boolean
  error?: string
  warnings?: string[]
}

interface TestStats {
  total: number
  passed: number
  failed: number
  warnings: number
}

const results: TestResult[] = []
const stats: TestStats = { total: 0, passed: 0, failed: 0, warnings: 0 }

function log(msg: string) {
  console.log(msg)
}

function logSuccess(msg: string) {
  console.log(`✓ ${msg}`)
}

function logError(msg: string) {
  console.error(`✗ ${msg}`)
}

function logWarning(msg: string) {
  console.log(`! ${msg}`)
}

function logSection(title: string) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`  ${title}`)
  console.log(`${'='.repeat(60)}\n`)
}

/**
 * Test all suggested stacks
 */
async function testSuggestedStacks(matrix: MergedSkillsMatrix) {
  logSection('Testing Suggested Stacks')

  for (const stack of matrix.suggestedStacks) {
    stats.total++

    // Check that all skill IDs in the stack exist
    const missingSkills: string[] = []
    for (const skillId of stack.allSkillIds) {
      if (!matrix.skills[skillId]) {
        missingSkills.push(skillId)
      }
    }

    if (missingSkills.length > 0) {
      stats.failed++
      logError(`Stack "${stack.name}" (${stack.id}): Missing skills: ${missingSkills.join(', ')}`)
      results.push({
        path: `stack/${stack.id}`,
        success: false,
        error: `Missing skills: ${missingSkills.join(', ')}`,
      })
      continue
    }

    // Validate the stack's skill selection
    const validation = validateSelection(stack.allSkillIds, matrix)

    if (!validation.valid) {
      stats.failed++
      const errors = validation.errors.map(e => e.message).join('; ')
      logError(`Stack "${stack.name}" (${stack.id}): Validation errors: ${errors}`)
      results.push({
        path: `stack/${stack.id}`,
        success: false,
        error: errors,
      })
      continue
    }

    if (validation.warnings.length > 0) {
      stats.warnings++
      const warnings = validation.warnings.map(w => w.message)
      logWarning(`Stack "${stack.name}" (${stack.id}): Warnings: ${warnings.join('; ')}`)
      results.push({
        path: `stack/${stack.id}`,
        success: true,
        warnings,
      })
    } else {
      results.push({
        path: `stack/${stack.id}`,
        success: true,
      })
    }

    stats.passed++
    logSuccess(`Stack "${stack.name}" (${stack.id}): Valid with ${stack.allSkillIds.length} skills`)
  }
}

/**
 * Test category/subcategory/skill navigation
 */
async function testCategoryNavigation(matrix: MergedSkillsMatrix) {
  logSection('Testing Category Navigation')

  const topCategories = getTopLevelCategories(matrix)
  log(`Found ${topCategories.length} top-level categories: ${topCategories.join(', ')}`)

  for (const topCatId of topCategories) {
    const topCat = matrix.categories[topCatId]
    log(`\n--- ${topCat.name} (${topCatId}) ---`)

    const subcategories = getSubcategories(topCatId, matrix)
    log(`  Subcategories: ${subcategories.length}`)

    if (subcategories.length === 0) {
      logWarning(`  Category ${topCatId} has no subcategories`)
      continue
    }

    for (const subCatId of subcategories) {
      const subCat = matrix.categories[subCatId]
      const skills = getAvailableSkills(subCatId, [], matrix)

      stats.total++

      if (skills.length === 0) {
        stats.failed++
        logError(`  ${subCat.name} (${subCatId}): No skills found`)
        results.push({
          path: `category/${topCatId}/${subCatId}`,
          success: false,
          error: 'No skills found in subcategory',
        })
      } else {
        stats.passed++
        const skillNames = skills.map(s => s.name).join(', ')
        logSuccess(`  ${subCat.name} (${subCatId}): ${skills.length} skills - ${skillNames}`)
        results.push({
          path: `category/${topCatId}/${subCatId}`,
          success: true,
        })
      }
    }
  }
}

/**
 * Test skill requirements and conflicts
 */
async function testSkillRequirements(matrix: MergedSkillsMatrix) {
  logSection('Testing Skill Requirements')

  const skillsWithRequirements = Object.values(matrix.skills).filter(s => s.requires.length > 0)
  log(`Found ${skillsWithRequirements.length} skills with requirements`)

  for (const skill of skillsWithRequirements) {
    stats.total++

    // Test that skill is disabled when requirements not met
    const disabledWithoutReqs = isDisabled(skill.id, [], matrix)

    if (!disabledWithoutReqs) {
      stats.failed++
      logError(`${skill.name}: Should be disabled when requirements not met`)
      results.push({
        path: `requirement/${skill.alias || skill.id}`,
        success: false,
        error: 'Skill should be disabled when requirements not met',
      })
      continue
    }

    // Test that skill is enabled when ANY requirement is met (for needs_any)
    let canBeEnabled = false
    for (const req of skill.requires) {
      if (req.needsAny) {
        // Test each option individually
        for (const reqSkillId of req.skillIds) {
          const enabledWithOneReq = !isDisabled(skill.id, [reqSkillId], matrix)
          if (enabledWithOneReq) {
            canBeEnabled = true
            break
          }
        }
      } else {
        // Test with all required skills
        const enabledWithAllReqs = !isDisabled(skill.id, req.skillIds, matrix)
        if (enabledWithAllReqs) {
          canBeEnabled = true
        }
      }
    }

    if (!canBeEnabled) {
      stats.failed++
      const reqInfo = skill.requires.map(r =>
        `needs ${r.needsAny ? 'any of' : 'all of'}: ${r.skillIds.map(id => matrix.skills[id]?.name || id).join(', ')}`
      ).join('; ')
      logError(`${skill.name}: Cannot be enabled even with requirements - ${reqInfo}`)
      results.push({
        path: `requirement/${skill.alias || skill.id}`,
        success: false,
        error: `Cannot be enabled: ${reqInfo}`,
      })
      continue
    }

    stats.passed++
    const reason = getDisableReason(skill.id, [], matrix)
    logSuccess(`${skill.name}: Correctly disabled without requirements (${reason})`)
    results.push({
      path: `requirement/${skill.alias || skill.id}`,
      success: true,
    })
  }
}

/**
 * Test skill conflicts
 */
async function testSkillConflicts(matrix: MergedSkillsMatrix) {
  logSection('Testing Skill Conflicts')

  const skillsWithConflicts = Object.values(matrix.skills).filter(s => s.conflictsWith.length > 0)
  log(`Found ${skillsWithConflicts.length} skills with conflicts`)

  const testedPairs = new Set<string>()

  for (const skill of skillsWithConflicts) {
    for (const conflict of skill.conflictsWith) {
      // Avoid testing the same pair twice
      const pairKey = [skill.id, conflict.skillId].sort().join('|')
      if (testedPairs.has(pairKey)) continue
      testedPairs.add(pairKey)

      stats.total++

      const conflictSkill = matrix.skills[conflict.skillId]
      if (!conflictSkill) {
        stats.failed++
        logError(`${skill.name}: Conflicts with non-existent skill ${conflict.skillId}`)
        results.push({
          path: `conflict/${skill.alias || skill.id}/${conflict.skillId}`,
          success: false,
          error: `Conflicts with non-existent skill: ${conflict.skillId}`,
        })
        continue
      }

      // Test that selecting one disables the other
      const skillBDisabled = isDisabled(conflict.skillId, [skill.id], matrix)
      const skillADisabled = isDisabled(skill.id, [conflict.skillId], matrix)

      if (!skillBDisabled || !skillADisabled) {
        stats.failed++
        logError(`${skill.name} <-> ${conflictSkill.name}: Conflict not enforced bidirectionally`)
        results.push({
          path: `conflict/${skill.alias || skill.id}/${conflictSkill.alias || conflictSkill.id}`,
          success: false,
          error: 'Conflict not enforced bidirectionally',
        })
        continue
      }

      stats.passed++
      logSuccess(`${skill.name} <-> ${conflictSkill.name}: Conflict enforced (${conflict.reason})`)
      results.push({
        path: `conflict/${skill.alias || skill.id}/${conflictSkill.alias || conflictSkill.id}`,
        success: true,
      })
    }
  }
}

/**
 * Test React ecosystem combinations
 */
async function testReactEcosystem(matrix: MergedSkillsMatrix) {
  logSection('Testing React Ecosystem Combinations')

  const reactSkillId = matrix.aliases['react']
  const combinations = [
    { name: 'React + SCSS Modules', skills: ['react', 'scss-modules'] },
    { name: 'React + Tailwind', skills: ['react', 'tailwind'] },
    { name: 'React + Zustand', skills: ['react', 'zustand'] },
    { name: 'React + Redux Toolkit', skills: ['react', 'redux-toolkit'] },
    { name: 'React + MobX', skills: ['react', 'mobx'] },
    { name: 'React + Jotai', skills: ['react', 'jotai'] },
    { name: 'React + React Query', skills: ['react', 'react-query'] },
    { name: 'React + SWR', skills: ['react', 'swr'] },
    { name: 'React + Next.js', skills: ['react', 'nextjs-app-router'] },
    { name: 'React + Remix', skills: ['react', 'remix'] },
    { name: 'React + React Hook Form', skills: ['react', 'react-hook-form'] },
    { name: 'React + RTL', skills: ['react', 'react-testing-library'] },
    { name: 'React + Tailwind + shadcn', skills: ['react', 'tailwind', 'shadcn-ui'] },
    { name: 'React + Next.js + next-intl', skills: ['react', 'nextjs-app-router', 'next-intl'] },
    { name: 'React Full Stack', skills: ['react', 'scss-modules', 'zustand', 'react-query', 'react-hook-form', 'vitest', 'react-testing-library', 'playwright-e2e', 'msw'] },
  ]

  for (const combo of combinations) {
    stats.total++
    const skillIds = combo.skills.map(s => matrix.aliases[s] || s)
    const validation = validateSelection(skillIds, matrix)

    if (!validation.valid) {
      stats.failed++
      const errors = validation.errors.map(e => e.message).join('; ')
      logError(`${combo.name}: ${errors}`)
      results.push({
        path: `ecosystem/react/${combo.name.replace(/\s+/g, '-').toLowerCase()}`,
        success: false,
        error: errors,
      })
    } else {
      stats.passed++
      logSuccess(`${combo.name}: Valid`)
      results.push({
        path: `ecosystem/react/${combo.name.replace(/\s+/g, '-').toLowerCase()}`,
        success: true,
        warnings: validation.warnings.map(w => w.message),
      })
    }
  }
}

/**
 * Test Vue ecosystem combinations
 */
async function testVueEcosystem(matrix: MergedSkillsMatrix) {
  logSection('Testing Vue Ecosystem Combinations')

  const combinations = [
    { name: 'Vue + SCSS Modules', skills: ['vue', 'scss-modules'] },
    { name: 'Vue + Tailwind', skills: ['vue', 'tailwind'] },
    { name: 'Vue + Pinia', skills: ['vue', 'pinia'] },
    { name: 'Vue + VeeValidate', skills: ['vue', 'vee-validate'] },
    { name: 'Vue + vue-i18n', skills: ['vue', 'vue-i18n'] },
    { name: 'Vue + Vue Test Utils', skills: ['vue', 'vue-test-utils'] },
    { name: 'Vue + Nuxt', skills: ['vue', 'nuxt'] },
    { name: 'Vue Full Stack', skills: ['vue', 'tailwind', 'pinia', 'vee-validate', 'vue-i18n', 'vue-test-utils', 'vitest', 'playwright-e2e'] },
    { name: 'Vue + Nuxt Full', skills: ['vue', 'nuxt', 'tailwind', 'pinia', 'vee-validate', 'vue-i18n'] },
  ]

  for (const combo of combinations) {
    stats.total++
    const skillIds = combo.skills.map(s => matrix.aliases[s] || s)
    const validation = validateSelection(skillIds, matrix)

    if (!validation.valid) {
      stats.failed++
      const errors = validation.errors.map(e => e.message).join('; ')
      logError(`${combo.name}: ${errors}`)
      results.push({
        path: `ecosystem/vue/${combo.name.replace(/\s+/g, '-').toLowerCase()}`,
        success: false,
        error: errors,
      })
    } else {
      stats.passed++
      logSuccess(`${combo.name}: Valid`)
      results.push({
        path: `ecosystem/vue/${combo.name.replace(/\s+/g, '-').toLowerCase()}`,
        success: true,
        warnings: validation.warnings.map(w => w.message),
      })
    }
  }
}

/**
 * Test Angular ecosystem combinations
 */
async function testAngularEcosystem(matrix: MergedSkillsMatrix) {
  logSection('Testing Angular Ecosystem Combinations')

  const combinations = [
    { name: 'Angular + SCSS Modules', skills: ['angular', 'scss-modules'] },
    { name: 'Angular + Tailwind', skills: ['angular', 'tailwind'] },
    { name: 'Angular + NgRx SignalStore', skills: ['angular', 'ngrx-signalstore'] },
    { name: 'Angular Full', skills: ['angular', 'scss-modules', 'ngrx-signalstore', 'vitest', 'playwright-e2e'] },
  ]

  for (const combo of combinations) {
    stats.total++
    const skillIds = combo.skills.map(s => matrix.aliases[s] || s)
    const validation = validateSelection(skillIds, matrix)

    if (!validation.valid) {
      stats.failed++
      const errors = validation.errors.map(e => e.message).join('; ')
      logError(`${combo.name}: ${errors}`)
      results.push({
        path: `ecosystem/angular/${combo.name.replace(/\s+/g, '-').toLowerCase()}`,
        success: false,
        error: errors,
      })
    } else {
      stats.passed++
      logSuccess(`${combo.name}: Valid`)
      results.push({
        path: `ecosystem/angular/${combo.name.replace(/\s+/g, '-').toLowerCase()}`,
        success: true,
        warnings: validation.warnings.map(w => w.message),
      })
    }
  }
}

/**
 * Test SolidJS ecosystem combinations
 */
async function testSolidJSEcosystem(matrix: MergedSkillsMatrix) {
  logSection('Testing SolidJS Ecosystem Combinations')

  const combinations = [
    { name: 'SolidJS + SCSS Modules', skills: ['solidjs', 'scss-modules'] },
    { name: 'SolidJS + Tailwind', skills: ['solidjs', 'tailwind'] },
    { name: 'SolidJS + Vitest', skills: ['solidjs', 'vitest'] },
    { name: 'SolidJS Full', skills: ['solidjs', 'tailwind', 'vitest', 'playwright-e2e'] },
  ]

  for (const combo of combinations) {
    stats.total++
    const skillIds = combo.skills.map(s => matrix.aliases[s] || s)
    const validation = validateSelection(skillIds, matrix)

    if (!validation.valid) {
      stats.failed++
      const errors = validation.errors.map(e => e.message).join('; ')
      logError(`${combo.name}: ${errors}`)
      results.push({
        path: `ecosystem/solidjs/${combo.name.replace(/\s+/g, '-').toLowerCase()}`,
        success: false,
        error: errors,
      })
    } else {
      stats.passed++
      logSuccess(`${combo.name}: Valid`)
      results.push({
        path: `ecosystem/solidjs/${combo.name.replace(/\s+/g, '-').toLowerCase()}`,
        success: true,
        warnings: validation.warnings.map(w => w.message),
      })
    }
  }
}

/**
 * Test Backend combinations
 */
async function testBackendCombinations(matrix: MergedSkillsMatrix) {
  logSection('Testing Backend Combinations')

  const combinations = [
    { name: 'Hono only', skills: ['hono'] },
    { name: 'Hono + Drizzle', skills: ['hono', 'drizzle'] },
    { name: 'Hono + Drizzle + Better Auth', skills: ['hono', 'drizzle', 'better-auth'] },
    { name: 'Hono + Prisma', skills: ['hono', 'prisma'] },
    { name: 'Express only', skills: ['express'] },
    { name: 'Express + Drizzle', skills: ['express', 'drizzle'] },
    { name: 'Express + Prisma', skills: ['express', 'prisma'] },
    { name: 'Fastify only', skills: ['fastify'] },
    { name: 'Fastify + Drizzle', skills: ['fastify', 'drizzle'] },
    { name: 'Fastify + Prisma', skills: ['fastify', 'prisma'] },
    { name: 'Full Observability', skills: ['hono', 'drizzle', 'axiom-pino-sentry', 'posthog'] },
  ]

  for (const combo of combinations) {
    stats.total++
    const skillIds = combo.skills.map(s => matrix.aliases[s] || s)
    const validation = validateSelection(skillIds, matrix)

    if (!validation.valid) {
      stats.failed++
      const errors = validation.errors.map(e => e.message).join('; ')
      logError(`${combo.name}: ${errors}`)
      results.push({
        path: `ecosystem/backend/${combo.name.replace(/\s+/g, '-').toLowerCase()}`,
        success: false,
        error: errors,
      })
    } else {
      stats.passed++
      logSuccess(`${combo.name}: Valid`)
      results.push({
        path: `ecosystem/backend/${combo.name.replace(/\s+/g, '-').toLowerCase()}`,
        success: true,
        warnings: validation.warnings.map(w => w.message),
      })
    }
  }
}

/**
 * Test Mobile combinations
 */
async function testMobileCombinations(matrix: MergedSkillsMatrix) {
  logSection('Testing Mobile Combinations')

  const combinations = [
    { name: 'React Native only', skills: ['react-native'] },
    { name: 'React Native + Zustand', skills: ['react-native', 'zustand'] },
    { name: 'React Native + React Query', skills: ['react-native', 'react-query'] },
    { name: 'React Native + Redux Toolkit', skills: ['react-native', 'redux-toolkit'] },
    { name: 'React Native Full', skills: ['react-native', 'zustand', 'react-query', 'react-hook-form', 'zod-validation'] },
    // Note: Expo skill does not exist yet
    // { name: 'Expo only', skills: ['expo'] },
    // { name: 'Expo + Zustand', skills: ['expo', 'zustand'] },
  ]

  for (const combo of combinations) {
    stats.total++
    const skillIds = combo.skills.map(s => matrix.aliases[s] || s)
    const validation = validateSelection(skillIds, matrix)

    if (!validation.valid) {
      stats.failed++
      const errors = validation.errors.map(e => e.message).join('; ')
      logError(`${combo.name}: ${errors}`)
      results.push({
        path: `ecosystem/mobile/${combo.name.replace(/\s+/g, '-').toLowerCase()}`,
        success: false,
        error: errors,
      })
    } else {
      stats.passed++
      logSuccess(`${combo.name}: Valid`)
      results.push({
        path: `ecosystem/mobile/${combo.name.replace(/\s+/g, '-').toLowerCase()}`,
        success: true,
        warnings: validation.warnings.map(w => w.message),
      })
    }
  }
}

/**
 * Test invalid combinations that SHOULD fail
 */
async function testInvalidCombinations(matrix: MergedSkillsMatrix) {
  logSection('Testing Invalid Combinations (should fail)')

  const invalidCombinations = [
    { name: 'React + Vue (framework conflict)', skills: ['react', 'vue'] },
    { name: 'React + Angular (framework conflict)', skills: ['react', 'angular'] },
    { name: 'Next.js + Remix (meta-framework conflict)', skills: ['react', 'nextjs-app-router', 'remix'] },
    { name: 'SCSS + Tailwind (styling conflict)', skills: ['scss-modules', 'tailwind'] },
    { name: 'Zustand + Redux (state conflict)', skills: ['react', 'zustand', 'redux-toolkit'] },
    { name: 'Zustand without React (missing requirement)', skills: ['zustand'] },
    { name: 'Pinia without Vue (missing requirement)', skills: ['pinia'] },
    { name: 'NgRx without Angular (missing requirement)', skills: ['ngrx-signalstore'] },
    { name: 'Better Auth without Drizzle (missing requirement)', skills: ['hono', 'better-auth'] },
    { name: 'Drizzle without API (missing requirement)', skills: ['drizzle'] },
    // Note: next-intl skill does not exist yet
    // { name: 'next-intl without Next.js (missing requirement)', skills: ['react', 'next-intl'] },
    { name: 'shadcn without Tailwind (missing requirement)', skills: ['react', 'shadcn-ui'] },
    { name: 'Playwright + Cypress (E2E conflict)', skills: ['playwright-e2e', 'cypress-e2e'] },
    { name: 'Hono + Express (API conflict)', skills: ['hono', 'express'] },
    { name: 'Drizzle + Prisma (ORM conflict)', skills: ['hono', 'drizzle', 'prisma'] },
  ]

  for (const combo of invalidCombinations) {
    stats.total++
    const skillIds = combo.skills.map(s => matrix.aliases[s] || s)
    const validation = validateSelection(skillIds, matrix)

    if (validation.valid) {
      stats.failed++
      logError(`${combo.name}: Should have failed validation but passed`)
      results.push({
        path: `invalid/${combo.name.replace(/\s+/g, '-').toLowerCase()}`,
        success: false,
        error: 'Should have failed validation but passed',
      })
    } else {
      stats.passed++
      const errors = validation.errors.map(e => e.message).join('; ')
      logSuccess(`${combo.name}: Correctly rejected (${errors})`)
      results.push({
        path: `invalid/${combo.name.replace(/\s+/g, '-').toLowerCase()}`,
        success: true,
      })
    }
  }
}

/**
 * Test that all aliases map to existing skills
 */
async function testAliasMapping(matrix: MergedSkillsMatrix) {
  logSection('Testing Alias Mapping')

  const missingMappings: string[] = []

  for (const [alias, fullId] of Object.entries(matrix.aliases)) {
    stats.total++

    if (!matrix.skills[fullId]) {
      stats.failed++
      missingMappings.push(`${alias} -> ${fullId}`)
      logError(`Alias "${alias}" maps to non-existent skill: ${fullId}`)
      results.push({
        path: `alias/${alias}`,
        success: false,
        error: `Maps to non-existent skill: ${fullId}`,
      })
    } else {
      stats.passed++
      results.push({
        path: `alias/${alias}`,
        success: true,
      })
    }
  }

  if (missingMappings.length === 0) {
    logSuccess(`All ${Object.keys(matrix.aliases).length} aliases map to existing skills`)
  }
}

/**
 * Main test runner
 */
async function main() {
  console.log('\n' + '='.repeat(60))
  console.log('  CLI Permutation Tester')
  console.log('='.repeat(60))

  // Load the matrix
  log('\nLoading skills matrix...')
  let matrix: MergedSkillsMatrix

  try {
    matrix = await loadAndMergeSkillsMatrix(MATRIX_PATH, PROJECT_ROOT)
    log(`Loaded ${Object.keys(matrix.skills).length} skills, ${matrix.suggestedStacks.length} stacks`)
  } catch (error) {
    console.error('Failed to load matrix:', error)
    process.exit(1)
  }

  // Run all tests
  await testAliasMapping(matrix)
  await testSuggestedStacks(matrix)
  await testCategoryNavigation(matrix)
  await testSkillRequirements(matrix)
  await testSkillConflicts(matrix)
  await testReactEcosystem(matrix)
  await testVueEcosystem(matrix)
  await testAngularEcosystem(matrix)
  await testSolidJSEcosystem(matrix)
  await testBackendCombinations(matrix)
  await testMobileCombinations(matrix)
  await testInvalidCombinations(matrix)

  // Print summary
  logSection('Test Summary')
  console.log(`Total tests: ${stats.total}`)
  console.log(`Passed: ${stats.passed}`)
  console.log(`Failed: ${stats.failed}`)
  console.log(`With warnings: ${stats.warnings}`)

  if (stats.failed > 0) {
    console.log('\n--- Failed Tests ---')
    for (const result of results) {
      if (!result.success) {
        console.log(`  ${result.path}: ${result.error}`)
      }
    }
  }

  // Exit with appropriate code
  process.exit(stats.failed > 0 ? 1 : 0)
}

main()
