import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getCurrentDate, hashString } from './versioning'

describe('getCurrentDate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should return date in YYYY-MM-DD format', () => {
    vi.setSystemTime(new Date('2026-01-22T12:00:00Z'))
    const result = getCurrentDate()
    expect(result).toBe('2026-01-22')
  })

  it('should handle different dates', () => {
    vi.setSystemTime(new Date('2025-12-31T23:59:59Z'))
    const result = getCurrentDate()
    expect(result).toBe('2025-12-31')
  })

  it('should handle new year', () => {
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    const result = getCurrentDate()
    expect(result).toBe('2026-01-01')
  })
})

describe('hashString', () => {
  it('should return a 7-character hex string', () => {
    const result = hashString('test content')
    expect(result).toMatch(/^[a-f0-9]{7}$/)
  })

  it('should return consistent hashes for the same content', () => {
    const content = 'hello world'
    const hash1 = hashString(content)
    const hash2 = hashString(content)
    expect(hash1).toBe(hash2)
  })

  it('should return different hashes for different content', () => {
    const hash1 = hashString('content A')
    const hash2 = hashString('content B')
    expect(hash1).not.toBe(hash2)
  })

  it('should handle empty string', () => {
    const result = hashString('')
    expect(result).toMatch(/^[a-f0-9]{7}$/)
  })

  it('should produce known hash for known input', () => {
    // SHA-256 of "test" is 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08
    // First 7 chars: 9f86d08
    const result = hashString('test')
    expect(result).toBe('9f86d08')
  })
})
