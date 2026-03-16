# CLI Reviewing - Core Examples

> Review output format and test patterns to look for during CLI code reviews. See [../SKILL.md](../SKILL.md) for checklists and decision frameworks.

---

## Example Review Output

Use this format when writing CLI code review feedback. Separate findings by severity to help authors prioritize.

````markdown
# CLI Code Review: init command

## Summary

The init command implementation has good structure but is missing critical
cancellation handling that would leave users stuck if they press Ctrl+C.

---

## Must Fix (3 issues)

### 1. Missing p.isCancel() check

**File:** src/cli/commands/init.ts:45
**Issue:** p.select() result not checked for cancellation
**Impact:** If user presses Ctrl+C, code continues with Symbol value causing crash
**Fix:** Add isCancel check:

```typescript
const framework = await p.select({ ... });
if (p.isCancel(framework)) {
  p.cancel("Setup cancelled");
  process.exit(EXIT_CODES.CANCELLED);
}
```

### 2. Magic number exit code

**File:** src/cli/commands/init.ts:78
**Issue:** `process.exit(1)` uses magic number
**Impact:** Exit codes become undocumented and unmaintainable
**Fix:** Use `process.exit(EXIT_CODES.ERROR)`

### 3. Using parse() instead of parseAsync()

**File:** src/cli/index.ts:42
**Issue:** `program.parse()` used with async action handlers
**Impact:** Errors in async actions are silently swallowed
**Fix:** Change to `await program.parseAsync(process.argv)`

---

## Should Fix (2 issues)

### 1. Missing spinner for network call

**File:** src/cli/commands/init.ts:52
**Issue:** `fetchTemplates()` has no visual feedback
**Impact:** Users see no progress during network operation
**Fix:** Wrap in spinner:

```typescript
const s = p.spinner();
s.start("Fetching templates...");
const templates = await fetchTemplates();
s.stop(`Found ${templates.length} templates`);
```

### 2. Error message not actionable

**File:** src/cli/commands/init.ts:67
**Issue:** Error says "Config invalid" but not how to fix
**Impact:** Users don't know what's wrong with their config
**Fix:** Include specific validation error and example of correct format

---

## Nice to Have (1 item)

### 1. Add --json output option

**File:** src/cli/commands/init.ts
**Suggestion:** Add `--json` flag for CI/script integration
**Benefit:** Enables automation and tooling integration

---

## What Was Done Well

- Clean command structure with separate files per command
- Good use of picocolors for consistent styling
- SIGINT handler present in entry point
- Config hierarchy follows correct precedence
- Tests cover happy path scenarios

---

## Verdict: REQUEST CHANGES

The Must Fix issues (cancellation handling, magic exit codes, parseAsync)
must be addressed before approval. These are safety issues that affect
all users of the CLI.
````

---

## CLI Test Patterns to Look For

When reviewing CLI test files, look for these patterns that indicate well-tested CLI code.

### Good: exitOverride to catch exits

```typescript
describe("init command", () => {
  beforeEach(() => {
    program.exitOverride();
  });

  it("exits with INVALID_ARGS for missing required option", async () => {
    await expect(
      program.parseAsync(["node", "test", "init"]),
    ).rejects.toThrow();
    // Verify error handling without actually exiting
  });
});
```

### Good: Prompts properly mocked

```typescript
vi.mock("@clack/prompts", () => ({
  select: vi.fn(),
  confirm: vi.fn(),
  text: vi.fn(),
  spinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })),
  isCancel: vi.fn((val) => val === Symbol.for("cancel")),
  cancel: vi.fn(),
  intro: vi.fn(),
  outro: vi.fn(),
  log: { info: vi.fn(), error: vi.fn(), success: vi.fn() },
}));
```

### Good: File system isolated with in-memory FS

```typescript
// Use an in-memory filesystem to isolate file operations
beforeEach(() => {
  // Reset filesystem state between tests
});
```

### Minimum Test Coverage Expectations

**Each Command:**

- [ ] Success path with valid arguments
- [ ] Failure path with invalid arguments
- [ ] Help output accessible

**Each Prompt Flow:**

- [ ] Successful completion
- [ ] User cancellation (Ctrl+C)
- [ ] Validation rejection

**Configuration:**

- [ ] Loads from each source (flag, env, project, global)
- [ ] Precedence is correct
- [ ] Missing files handled gracefully

**Exit Codes:**

- [ ] Success returns 0
- [ ] Each error type returns correct code
- [ ] Cancellation exits with CANCELLED code
