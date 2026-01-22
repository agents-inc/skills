import { describe, it, expect } from 'vitest'
import {
  resolveAlias,
  isDisabled,
  isDiscouraged,
  isRecommended,
  getDisableReason,
  getDiscourageReason,
  getRecommendReason,
  validateSelection,
  getSkillsByCategory,
  getTopLevelCategories,
  getSubcategories,
} from './matrix-resolver'
import type { MergedSkillsMatrix, ResolvedSkill } from '../types-matrix'

/**
 * Create a minimal ResolvedSkill for testing
 */
function createSkill(
  id: string,
  overrides: Partial<ResolvedSkill> = {}
): ResolvedSkill {
  return {
    id,
    name: id,
    description: `Description for ${id}`,
    category: 'framework',
    categoryExclusive: true,
    tags: [],
    author: '@test',
    version: '1',
    conflictsWith: [],
    recommends: [],
    recommendedBy: [],
    requires: [],
    requiredBy: [],
    alternatives: [],
    discourages: [],
    requiresSetup: [],
    providesSetupFor: [],
    path: `skills/${id}/`,
    ...overrides,
  }
}

/**
 * Create a minimal MergedSkillsMatrix for testing
 */
function createMatrix(
  skills: Record<string, ResolvedSkill>,
  aliases: Record<string, string> = {},
  categories: MergedSkillsMatrix['categories'] = {}
): MergedSkillsMatrix {
  return {
    version: '1.0.0',
    categories,
    skills,
    suggestedStacks: [],
    aliases,
    aliasesReverse: Object.fromEntries(
      Object.entries(aliases).map(([alias, fullId]) => [fullId, alias])
    ),
    generatedAt: new Date().toISOString(),
  }
}

describe('resolveAlias', () => {
  it('should resolve an alias to full ID', () => {
    const matrix = createMatrix({}, { react: 'frontend/react (@vince)' })
    const result = resolveAlias('react', matrix)
    expect(result).toBe('frontend/react (@vince)')
  })

  it('should return unchanged if already a full ID', () => {
    const matrix = createMatrix({}, { react: 'frontend/react (@vince)' })
    const result = resolveAlias('frontend/react (@vince)', matrix)
    expect(result).toBe('frontend/react (@vince)')
  })

  it('should return unchanged if alias not found', () => {
    const matrix = createMatrix({}, {})
    const result = resolveAlias('unknown', matrix)
    expect(result).toBe('unknown')
  })
})

describe('isDisabled', () => {
  it('should return false for skill with no conflicts or requirements', () => {
    const skill = createSkill('skill-a')
    const matrix = createMatrix({ 'skill-a': skill })

    const result = isDisabled('skill-a', [], matrix)
    expect(result).toBe(false)
  })

  it('should return true if skill conflicts with a selected skill', () => {
    const skillA = createSkill('skill-a', {
      conflictsWith: [{ skillId: 'skill-b', reason: 'Incompatible' }],
    })
    const skillB = createSkill('skill-b')
    const matrix = createMatrix({ 'skill-a': skillA, 'skill-b': skillB })

    const result = isDisabled('skill-a', ['skill-b'], matrix)
    expect(result).toBe(true)
  })

  it('should return true if selected skill conflicts with this skill', () => {
    const skillA = createSkill('skill-a')
    const skillB = createSkill('skill-b', {
      conflictsWith: [{ skillId: 'skill-a', reason: 'Incompatible' }],
    })
    const matrix = createMatrix({ 'skill-a': skillA, 'skill-b': skillB })

    const result = isDisabled('skill-a', ['skill-b'], matrix)
    expect(result).toBe(true)
  })

  it('should return true if required skills are not selected (AND logic)', () => {
    const skillA = createSkill('skill-a', {
      requires: [
        { skillIds: ['skill-b', 'skill-c'], needsAny: false, reason: 'Needs both' },
      ],
    })
    const skillB = createSkill('skill-b')
    const skillC = createSkill('skill-c')
    const matrix = createMatrix({
      'skill-a': skillA,
      'skill-b': skillB,
      'skill-c': skillC,
    })

    // Only skill-b selected, but needs both
    const result = isDisabled('skill-a', ['skill-b'], matrix)
    expect(result).toBe(true)
  })

  it('should return false if required skills are selected (AND logic)', () => {
    const skillA = createSkill('skill-a', {
      requires: [
        { skillIds: ['skill-b', 'skill-c'], needsAny: false, reason: 'Needs both' },
      ],
    })
    const skillB = createSkill('skill-b')
    const skillC = createSkill('skill-c')
    const matrix = createMatrix({
      'skill-a': skillA,
      'skill-b': skillB,
      'skill-c': skillC,
    })

    const result = isDisabled('skill-a', ['skill-b', 'skill-c'], matrix)
    expect(result).toBe(false)
  })

  it('should return true if none of the required skills are selected (OR logic)', () => {
    const skillA = createSkill('skill-a', {
      requires: [
        { skillIds: ['skill-b', 'skill-c'], needsAny: true, reason: 'Needs one' },
      ],
    })
    const matrix = createMatrix({
      'skill-a': skillA,
      'skill-b': createSkill('skill-b'),
      'skill-c': createSkill('skill-c'),
    })

    const result = isDisabled('skill-a', [], matrix)
    expect(result).toBe(true)
  })

  it('should return false if any required skill is selected (OR logic)', () => {
    const skillA = createSkill('skill-a', {
      requires: [
        { skillIds: ['skill-b', 'skill-c'], needsAny: true, reason: 'Needs one' },
      ],
    })
    const matrix = createMatrix({
      'skill-a': skillA,
      'skill-b': createSkill('skill-b'),
      'skill-c': createSkill('skill-c'),
    })

    const result = isDisabled('skill-a', ['skill-c'], matrix)
    expect(result).toBe(false)
  })
})

describe('isDiscouraged', () => {
  it('should return false for skill with no discourages', () => {
    const skill = createSkill('skill-a')
    const matrix = createMatrix({ 'skill-a': skill })

    const result = isDiscouraged('skill-a', [], matrix)
    expect(result).toBe(false)
  })

  it('should return true if selected skill discourages this skill', () => {
    const skillA = createSkill('skill-a')
    const skillB = createSkill('skill-b', {
      discourages: [{ skillId: 'skill-a', reason: 'Not recommended' }],
    })
    const matrix = createMatrix({ 'skill-a': skillA, 'skill-b': skillB })

    const result = isDiscouraged('skill-a', ['skill-b'], matrix)
    expect(result).toBe(true)
  })

  it('should return true if this skill discourages a selected skill', () => {
    const skillA = createSkill('skill-a', {
      discourages: [{ skillId: 'skill-b', reason: 'Not recommended' }],
    })
    const skillB = createSkill('skill-b')
    const matrix = createMatrix({ 'skill-a': skillA, 'skill-b': skillB })

    const result = isDiscouraged('skill-a', ['skill-b'], matrix)
    expect(result).toBe(true)
  })
})

describe('isRecommended', () => {
  it('should return false for skill with no recommendations', () => {
    const skill = createSkill('skill-a')
    const matrix = createMatrix({ 'skill-a': skill })

    const result = isRecommended('skill-a', [], matrix)
    expect(result).toBe(false)
  })

  it('should return true if selected skill recommends this skill', () => {
    const skillA = createSkill('skill-a')
    const skillB = createSkill('skill-b', {
      recommends: [{ skillId: 'skill-a', reason: 'Works well together' }],
    })
    const matrix = createMatrix({ 'skill-a': skillA, 'skill-b': skillB })

    const result = isRecommended('skill-a', ['skill-b'], matrix)
    expect(result).toBe(true)
  })

  it('should return false if no selected skill recommends this skill', () => {
    const skillA = createSkill('skill-a')
    const skillB = createSkill('skill-b')
    const skillC = createSkill('skill-c', {
      recommends: [{ skillId: 'skill-a', reason: 'Works well' }],
    })
    const matrix = createMatrix({
      'skill-a': skillA,
      'skill-b': skillB,
      'skill-c': skillC,
    })

    // skill-b is selected, but it doesn't recommend skill-a
    const result = isRecommended('skill-a', ['skill-b'], matrix)
    expect(result).toBe(false)
  })
})

describe('getDisableReason', () => {
  it('should return undefined for enabled skill', () => {
    const skill = createSkill('skill-a')
    const matrix = createMatrix({ 'skill-a': skill })

    const result = getDisableReason('skill-a', [], matrix)
    expect(result).toBeUndefined()
  })

  it('should return conflict reason', () => {
    const skillA = createSkill('skill-a', {
      conflictsWith: [{ skillId: 'skill-b', reason: 'Cannot use together' }],
    })
    const skillB = createSkill('skill-b')
    const matrix = createMatrix({ 'skill-a': skillA, 'skill-b': skillB })

    const result = getDisableReason('skill-a', ['skill-b'], matrix)
    expect(result).toContain('Cannot use together')
    expect(result).toContain('conflicts with')
  })
})

describe('validateSelection', () => {
  it('should return valid for empty selection', () => {
    const matrix = createMatrix({})
    const result = validateSelection([], matrix)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('should return valid for non-conflicting selection', () => {
    const matrix = createMatrix({
      'skill-a': createSkill('skill-a'),
      'skill-b': createSkill('skill-b'),
    })

    const result = validateSelection(['skill-a', 'skill-b'], matrix)
    expect(result.valid).toBe(true)
  })

  it('should return error for conflicting skills', () => {
    const skillA = createSkill('skill-a', {
      conflictsWith: [{ skillId: 'skill-b', reason: 'Incompatible' }],
    })
    const skillB = createSkill('skill-b')
    const matrix = createMatrix({ 'skill-a': skillA, 'skill-b': skillB })

    const result = validateSelection(['skill-a', 'skill-b'], matrix)
    expect(result.valid).toBe(false)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].type).toBe('conflict')
  })

  it('should return error for missing requirements', () => {
    const skillA = createSkill('skill-a', {
      requires: [{ skillIds: ['skill-b'], needsAny: false, reason: 'Needs B' }],
    })
    const skillB = createSkill('skill-b')
    const matrix = createMatrix({ 'skill-a': skillA, 'skill-b': skillB })

    const result = validateSelection(['skill-a'], matrix)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.type === 'missing_requirement')).toBe(true)
  })

  it('should return warning for missing recommendations', () => {
    const skillA = createSkill('skill-a', {
      recommends: [{ skillId: 'skill-b', reason: 'Works better together' }],
    })
    const skillB = createSkill('skill-b')
    const matrix = createMatrix({ 'skill-a': skillA, 'skill-b': skillB })

    const result = validateSelection(['skill-a'], matrix)
    expect(result.valid).toBe(true) // Warnings don't make it invalid
    expect(result.warnings.some((w) => w.type === 'missing_recommendation')).toBe(true)
  })

  it('should return error for category exclusivity violation', () => {
    const skillA = createSkill('skill-a', { category: 'framework', categoryExclusive: true })
    const skillB = createSkill('skill-b', { category: 'framework', categoryExclusive: true })
    const matrix = createMatrix(
      { 'skill-a': skillA, 'skill-b': skillB },
      {},
      {
        framework: {
          id: 'framework',
          name: 'Framework',
          description: 'Frameworks',
          exclusive: true,
          required: false,
          order: 1,
        },
      }
    )

    const result = validateSelection(['skill-a', 'skill-b'], matrix)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.type === 'category_exclusive')).toBe(true)
  })
})

describe('getSkillsByCategory', () => {
  it('should return skills in the specified category', () => {
    const matrix = createMatrix({
      'skill-a': createSkill('skill-a', { category: 'framework' }),
      'skill-b': createSkill('skill-b', { category: 'styling' }),
      'skill-c': createSkill('skill-c', { category: 'framework' }),
    })

    const result = getSkillsByCategory('framework', matrix)
    expect(result).toHaveLength(2)
    expect(result.map((s) => s.id)).toContain('skill-a')
    expect(result.map((s) => s.id)).toContain('skill-c')
  })

  it('should return empty array for category with no skills', () => {
    const matrix = createMatrix({
      'skill-a': createSkill('skill-a', { category: 'framework' }),
    })

    const result = getSkillsByCategory('nonexistent', matrix)
    expect(result).toHaveLength(0)
  })
})

describe('getTopLevelCategories', () => {
  it('should return categories without parents', () => {
    const matrix = createMatrix(
      {},
      {},
      {
        framework: {
          id: 'framework',
          name: 'Framework',
          description: 'Frameworks',
          exclusive: true,
          required: false,
          order: 1,
        },
        styling: {
          id: 'styling',
          name: 'Styling',
          description: 'Styling',
          exclusive: false,
          required: false,
          order: 2,
        },
        'styling-css': {
          id: 'styling-css',
          name: 'CSS',
          description: 'CSS styling',
          exclusive: false,
          required: false,
          order: 1,
          parent: 'styling',
        },
      }
    )

    const result = getTopLevelCategories(matrix)
    expect(result).toContain('framework')
    expect(result).toContain('styling')
    expect(result).not.toContain('styling-css')
  })

  it('should sort by order', () => {
    const matrix = createMatrix(
      {},
      {},
      {
        second: {
          id: 'second',
          name: 'Second',
          description: '',
          exclusive: false,
          required: false,
          order: 2,
        },
        first: {
          id: 'first',
          name: 'First',
          description: '',
          exclusive: false,
          required: false,
          order: 1,
        },
      }
    )

    const result = getTopLevelCategories(matrix)
    expect(result[0]).toBe('first')
    expect(result[1]).toBe('second')
  })
})

describe('getSubcategories', () => {
  it('should return subcategories of a parent', () => {
    const matrix = createMatrix(
      {},
      {},
      {
        styling: {
          id: 'styling',
          name: 'Styling',
          description: '',
          exclusive: false,
          required: false,
          order: 1,
        },
        'styling-css': {
          id: 'styling-css',
          name: 'CSS',
          description: '',
          exclusive: false,
          required: false,
          order: 1,
          parent: 'styling',
        },
        'styling-tailwind': {
          id: 'styling-tailwind',
          name: 'Tailwind',
          description: '',
          exclusive: false,
          required: false,
          order: 2,
          parent: 'styling',
        },
      }
    )

    const result = getSubcategories('styling', matrix)
    expect(result).toHaveLength(2)
    expect(result).toContain('styling-css')
    expect(result).toContain('styling-tailwind')
  })

  it('should return empty array if no subcategories', () => {
    const matrix = createMatrix(
      {},
      {},
      {
        framework: {
          id: 'framework',
          name: 'Framework',
          description: '',
          exclusive: true,
          required: false,
          order: 1,
        },
      }
    )

    const result = getSubcategories('framework', matrix)
    expect(result).toHaveLength(0)
  })
})
