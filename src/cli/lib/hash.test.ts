import { describe, it, expect } from 'vitest'
import { hashContent } from './hash'

describe('hashContent', () => {
  it('should return a 7-character hex string', () => {
    const result = hashContent('test content')
    expect(result).toMatch(/^[a-f0-9]{7}$/)
  })

  it('should return consistent hashes for the same content', () => {
    const content = 'hello world'
    const hash1 = hashContent(content)
    const hash2 = hashContent(content)
    expect(hash1).toBe(hash2)
  })

  it('should return different hashes for different content', () => {
    const hash1 = hashContent('content A')
    const hash2 = hashContent('content B')
    expect(hash1).not.toBe(hash2)
  })

  it('should handle empty string', () => {
    const result = hashContent('')
    expect(result).toMatch(/^[a-f0-9]{7}$/)
  })

  it('should handle unicode content', () => {
    const result = hashContent('你好世界 🌍')
    expect(result).toMatch(/^[a-f0-9]{7}$/)
  })

  it('should handle multiline content', () => {
    const content = `line 1
line 2
line 3`
    const result = hashContent(content)
    expect(result).toMatch(/^[a-f0-9]{7}$/)
  })

  it('should produce known hash for known input', () => {
    // SHA-256 of "test" is 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08
    // First 7 chars: 9f86d08
    const result = hashContent('test')
    expect(result).toBe('9f86d08')
  })
})
