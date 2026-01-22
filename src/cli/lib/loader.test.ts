import { describe, it, expect } from 'vitest'
import { parseFrontmatter } from './loader'

describe('parseFrontmatter', () => {
  it('should parse valid frontmatter with name and description', () => {
    const content = `---
name: frontend/react (@vince)
description: React component patterns and hooks
---

# React Skill

Content here...`

    const result = parseFrontmatter(content)

    expect(result).not.toBeNull()
    expect(result?.name).toBe('frontend/react (@vince)')
    expect(result?.description).toBe('React component patterns and hooks')
  })

  it('should return null for content without frontmatter', () => {
    const content = `# Just a markdown file

No frontmatter here.`

    const result = parseFrontmatter(content)

    expect(result).toBeNull()
  })

  it('should return null for invalid frontmatter (missing name)', () => {
    const content = `---
description: Missing name field
---

Content`

    const result = parseFrontmatter(content)

    expect(result).toBeNull()
  })

  it('should return null for invalid frontmatter (missing description)', () => {
    const content = `---
name: skill-name
---

Content`

    const result = parseFrontmatter(content)

    expect(result).toBeNull()
  })

  it('should handle frontmatter with additional fields', () => {
    const content = `---
name: backend/api
description: API patterns
version: 1
author: "@test"
tags:
  - api
  - backend
---

Content`

    const result = parseFrontmatter(content)

    expect(result).not.toBeNull()
    expect(result?.name).toBe('backend/api')
    expect(result?.description).toBe('API patterns')
  })

  it('should handle multiline description', () => {
    const content = `---
name: complex-skill
description: >
  This is a multiline
  description that spans
  multiple lines
---

Content`

    const result = parseFrontmatter(content)

    expect(result).not.toBeNull()
    expect(result?.name).toBe('complex-skill')
    expect(result?.description).toContain('multiline')
  })

  it('should handle frontmatter at the very start', () => {
    const content = `---
name: skill
description: desc
---`

    const result = parseFrontmatter(content)

    expect(result).not.toBeNull()
    expect(result?.name).toBe('skill')
  })

  it('should not parse frontmatter that is not at the start', () => {
    const content = `Some text before

---
name: skill
description: desc
---`

    const result = parseFrontmatter(content)

    expect(result).toBeNull()
  })

  it('should handle empty content between frontmatter delimiters', () => {
    const content = `---
---

Content`

    const result = parseFrontmatter(content)

    expect(result).toBeNull()
  })

  it('should not handle frontmatter with Windows line endings (current limitation)', () => {
    const content = "---\r\nname: skill\r\ndescription: desc\r\n---\r\n\r\nContent"

    const result = parseFrontmatter(content)

    // The current regex expects \n only, not \r\n
    // This is a known limitation - SKILL.md files should use Unix line endings
    expect(result).toBeNull()
  })
})
