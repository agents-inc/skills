import { describe, it, expect } from "vitest";
import { getCurrentDate, hashString } from "./versioning";

describe("getCurrentDate", () => {
  it("should return date in YYYY-MM-DD format", () => {
    const result = getCurrentDate();
    // Match pattern YYYY-MM-DD
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("should return a valid date", () => {
    const result = getCurrentDate();
    const parsed = new Date(result);
    expect(parsed.toString()).not.toBe("Invalid Date");
  });

  it("should return today's date", () => {
    const result = getCurrentDate();
    const expected = new Date().toISOString().split("T")[0];
    expect(result).toBe(expected);
  });
});

describe("hashString", () => {
  it("should return a 7-character hex string", () => {
    const result = hashString("test content");
    expect(result).toMatch(/^[a-f0-9]{7}$/);
  });

  it("should return consistent hashes for the same content", () => {
    const content = "hello world";
    const hash1 = hashString(content);
    const hash2 = hashString(content);
    expect(hash1).toBe(hash2);
  });

  it("should return different hashes for different content", () => {
    const hash1 = hashString("content A");
    const hash2 = hashString("content B");
    expect(hash1).not.toBe(hash2);
  });

  it("should handle empty string", () => {
    const result = hashString("");
    expect(result).toMatch(/^[a-f0-9]{7}$/);
  });

  it("should produce known hash for known input", () => {
    // SHA-256 of "test" is 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08
    // First 7 chars: 9f86d08
    const result = hashString("test");
    expect(result).toBe("9f86d08");
  });
});
