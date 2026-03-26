# Core Patterns

> Two-tier orchestrator pattern, guard clauses, named predicates, named constants, discriminated unions, async orchestrators, and pure function extraction. See [SKILL.md](../SKILL.md) for decision frameworks and [reference.md](../reference.md) for quick lookup tables.

---

## The Two-Tier Pattern: Before/After

### Before: Mixed-Concern Function

This function validates, transforms, deduplicates, and assembles results -- all inline. A reader must simulate every step to understand the flow.

```typescript
function processDiffOutput(rawDiff: string): DiffSummary {
  const lines = rawDiff.split("\n");
  const changes: FileChange[] = [];
  let currentFile: string | null = null;
  let additions = 0;
  let deletions = 0;

  for (const line of lines) {
    if (line.startsWith("diff --git")) {
      const match = line.match(/b\/(.+)$/);
      if (match) currentFile = match[1];
    } else if (line.startsWith("+") && !line.startsWith("+++")) {
      additions++;
      if (currentFile && !changes.some((c) => c.file === currentFile)) {
        changes.push({ file: currentFile, type: "modified" });
      }
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      deletions++;
    }
  }

  const summary = changes
    .map((c) => `  ${c.type === "modified" ? "M" : "?"} ${c.file}`)
    .join("\n");

  return {
    changes,
    additions,
    deletions,
    summary,
    hasChanges: changes.length > 0,
  };
}
```

**Why bad:** Guard logic, parsing, counting, deduplication, and formatting are all interleaved. To understand what this function produces, you must trace through the loop line by line.

### After: Two-Tier Decomposition

```typescript
// ORCHESTRATOR: reads like a plan
function processDiffOutput(rawDiff: string): DiffSummary {
  const lines = rawDiff.split("\n");
  if (!lines.length) return EMPTY_DIFF_SUMMARY;

  const parsedLines = lines.map(parseDiffLine);
  const fileChanges = extractUniqueFileChanges(parsedLines);
  const counts = countAdditionsAndDeletions(parsedLines);

  return {
    changes: fileChanges,
    ...counts,
    summary: formatChangeSummary(fileChanges),
    hasChanges: fileChanges.length > 0,
  };
}

// PURE FUNCTIONS: each does one thing

interface ParsedDiffLine {
  readonly type: "file-header" | "addition" | "deletion" | "context";
  readonly file?: string;
}

const EMPTY_DIFF_SUMMARY: DiffSummary = {
  changes: [],
  additions: 0,
  deletions: 0,
  summary: "",
  hasChanges: false,
};

function parseDiffLine(line: string): ParsedDiffLine {
  if (line.startsWith("diff --git")) {
    const match = line.match(/b\/(.+)$/);
    return { type: "file-header", file: match?.[1] };
  }
  if (isContentAddition(line)) return { type: "addition" };
  if (isContentDeletion(line)) return { type: "deletion" };
  return { type: "context" };
}

function isContentAddition(line: string): boolean {
  return line.startsWith("+") && !line.startsWith("+++");
}

function isContentDeletion(line: string): boolean {
  return line.startsWith("-") && !line.startsWith("---");
}

function extractUniqueFileChanges(lines: ParsedDiffLine[]): FileChange[] {
  const seen = new Set<string>();
  const changes: FileChange[] = [];
  for (const line of lines) {
    if (line.file && !seen.has(line.file)) {
      seen.add(line.file);
      changes.push({ file: line.file, type: "modified" });
    }
  }
  return changes;
}

function countAdditionsAndDeletions(lines: ParsedDiffLine[]): {
  additions: number;
  deletions: number;
} {
  let additions = 0;
  let deletions = 0;
  for (const line of lines) {
    if (line.type === "addition") additions++;
    if (line.type === "deletion") deletions++;
  }
  return { additions, deletions };
}

function formatChangeSummary(changes: FileChange[]): string {
  return changes.map(formatSingleChange).join("\n");
}

function formatSingleChange(change: FileChange): string {
  const prefix = change.type === "modified" ? "M" : "?";
  return `  ${prefix} ${change.file}`;
}
```

**Why good:** The orchestrator reads as: "parse lines, extract unique file changes, count additions/deletions, format summary." Each pure function has a single responsibility and can be tested independently. A reader understands the flow without reading any function body.

---

## Named Predicates: Before/After

### Before: Inline Complex Conditions

```typescript
// Requires simulation: what does this filter actually select?
const relevantSkills = skills.filter(
  (skill) =>
    skill.category !== "deprecated" &&
    skill.scope === currentScope &&
    (skill.tags.includes(selectedTag) || selectedTag === "all"),
);
```

### After: Named Predicate

```typescript
const relevantSkills = skills.filter(isRelevantForSelection);

function isRelevantForSelection(skill: Skill): boolean {
  if (skill.category === "deprecated") return false;
  if (skill.scope !== currentScope) return false;
  return selectedTag === "all" || skill.tags.includes(selectedTag);
}
```

**Why good:** The filter's intent is immediately clear from `isRelevantForSelection`. The predicate body uses early-return guard clauses for each condition, making the logic scannable. Closure over `currentScope` and `selectedTag` is fine -- the predicate is defined in the same scope.

---

### When a Predicate Needs Parameters

When a predicate depends on runtime values, use a factory function or an explicit lambda:

```typescript
// Option A: factory function (reusable)
function createScopeFilter(scope: string) {
  return (skill: Skill): boolean => skill.scope === scope;
}
const inProjectScope = skills.filter(createScopeFilter("project"));

// Option B: explicit lambda (one-off, clear enough)
const inProjectScope = skills.filter((skill) => skill.scope === "project");
```

**When to choose:** If the predicate has complex logic or appears in multiple places, use the factory. If it is a single clear comparison, the inline lambda is fine.

---

## Named Constants: Before/After

### Before: Anonymous Test Fixtures

```typescript
describe("conflict detection", () => {
  it("detects mutual conflicts", () => {
    const matrix = createMockMatrix(
      createMockSkill("react", {
        conflictsWith: ["vue", "angular"],
        requires: ["typescript"],
      }),
      createMockSkill("vue", {
        conflictsWith: ["react"],
      }),
    );
    // ... test body uses matrix
  });
});
```

**Why bad:** The reader must trace through the `createMockSkill` calls to understand what this test is checking. The fixture's purpose is hidden in its construction.

### After: Named Constants

```typescript
const REACT_WITH_FRAMEWORK_CONFLICTS = createMockSkill("react", {
  conflictsWith: ["vue", "angular"],
  requires: ["typescript"],
});

const VUE_CONFLICTS_REACT = createMockSkill("vue", {
  conflictsWith: ["react"],
});

describe("conflict detection", () => {
  it("detects mutual conflicts", () => {
    const matrix = createMockMatrix(
      REACT_WITH_FRAMEWORK_CONFLICTS,
      VUE_CONFLICTS_REACT,
    );
    // ... test body uses matrix
  });
});
```

**Why good:** The constant names encode the relevant characteristics. When reading the test, `REACT_WITH_FRAMEWORK_CONFLICTS` immediately communicates what matters about this fixture. The reader never needs to look at the construction.

---

## Pure Function Extraction: Before/After

### Before: Formatting Logic Mixed Into Orchestrator

```typescript
function generateReport(results: TestResult[]): string {
  const passed = results.filter((r) => r.status === "passed");
  const failed = results.filter((r) => r.status === "failed");

  let report = `# Test Report\n\n`;
  report += `**${passed.length}** passed, **${failed.length}** failed\n\n`;

  if (failed.length > 0) {
    report += `## Failures\n\n`;
    for (const result of failed) {
      report += `### ${result.name}\n\n`;
      report += `**File:** ${result.file}:${result.line}\n`;
      report += `**Expected:** ${result.expected}\n`;
      report += `**Received:** ${result.received}\n\n`;
    }
  }

  if (passed.length > 0) {
    report += `## Passed\n\n`;
    report += passed.map((r) => `- ${r.name}`).join("\n");
  }

  return report;
}
```

**Why bad:** String assembly, conditional sections, and iteration are all mixed together. The reader must simulate the entire function to know what the report looks like.

### After: Orchestrator + Pure Functions

```typescript
function generateReport(results: TestResult[]): string {
  const { passed, failed } = partitionByStatus(results);

  const sections = [
    formatReportHeader(passed.length, failed.length),
    formatFailureSection(failed),
    formatPassedSection(passed),
  ].filter(Boolean);

  return sections.join("\n");
}

function partitionByStatus(results: TestResult[]): {
  passed: TestResult[];
  failed: TestResult[];
} {
  const passed = results.filter((r) => r.status === "passed");
  const failed = results.filter((r) => r.status === "failed");
  return { passed, failed };
}

function formatReportHeader(passedCount: number, failedCount: number): string {
  return `# Test Report\n\n**${passedCount}** passed, **${failedCount}** failed\n`;
}

function formatFailureSection(failed: TestResult[]): string | null {
  if (!failed.length) return null;
  const entries = failed.map(formatFailureEntry).join("\n");
  return `## Failures\n\n${entries}`;
}

function formatFailureEntry(result: TestResult): string {
  return [
    `### ${result.name}\n`,
    `**File:** ${result.file}:${result.line}`,
    `**Expected:** ${result.expected}`,
    `**Received:** ${result.received}`,
  ].join("\n");
}

function formatPassedSection(passed: TestResult[]): string | null {
  if (!passed.length) return null;
  const list = passed.map((r) => `- ${r.name}`).join("\n");
  return `## Passed\n\n${list}`;
}
```

**Why good:** The orchestrator reads as: "partition results, format header, format failures, format passed, join sections." Each formatting function is independently testable and reusable. Adding a new section (e.g., "Skipped") means adding one function and one line in the orchestrator.

---

## The Thin Orchestrator Pattern

When orchestrators get too large, it usually means they are doing transformation work inline. The fix is to push more work into pure functions until the orchestrator is thin.

### Symptom: Fat Orchestrator

```typescript
function buildDashboard(config: Config): Dashboard {
  // 30+ lines of mixed logic
  const skills = loadSkills(config.source);
  const filtered = skills.filter(/* inline complex logic */);
  const mapped = filtered.map(/* inline complex transform */);
  // ... more inline work ...
  const grouped = mapped.reduce(/* inline grouping */);
  // ... more inline assembly ...
  return { sections: Object.entries(grouped).map(/* inline formatting */) };
}
```

### Fix: Push Logic Down

```typescript
function buildDashboard(config: Config): Dashboard {
  const skills = loadSkills(config.source);
  const displaySkills = selectDisplayableSkills(skills, config);
  const grouped = groupBySection(displaySkills);
  return assembleDashboard(grouped);
}
```

**Why good:** The orchestrator is four lines. Each line is a clear step. All complexity lives in testable pure functions below. If any step needs to change, you modify one focused function without touching the overall flow.

---

## Guard Clauses: Before/After

Guard clauses are the most direct way to flatten deeply nested conditionals. Invert the condition, return early, and the rest of the function body is the happy path at zero nesting.

### Before: The Arrow Anti-Pattern

```typescript
function processOrder(order: Order, user: User): OrderResult {
  if (user.isActive) {
    if (order.items.length > 0) {
      if (order.total >= MIN_ORDER_AMOUNT) {
        if (user.paymentMethod) {
          const discount = user.membership
            ? calculateMemberDiscount(user.membership, order.total)
            : 0;
          const finalTotal = order.total - discount;
          const confirmation = submitPayment(user.paymentMethod, finalTotal);
          if (confirmation.success) {
            return {
              status: "confirmed",
              total: finalTotal,
              discount,
              confirmationId: confirmation.id,
            };
          } else {
            return { status: "payment-failed", error: confirmation.error };
          }
        } else {
          return { status: "no-payment-method" };
        }
      } else {
        return { status: "below-minimum", minimum: MIN_ORDER_AMOUNT };
      }
    } else {
      return { status: "empty-cart" };
    }
  } else {
    return { status: "inactive-user" };
  }
}
```

**Why bad:** Five levels of nesting. The reader must maintain a mental stack of which conditions are true at any point. The happy path is buried at the deepest indentation level. Each `else` requires scrolling up to find which `if` it belongs to.

### After: Guard Clauses

```typescript
function processOrder(order: Order, user: User): OrderResult {
  if (!user.isActive) return { status: "inactive-user" };
  if (order.items.length === 0) return { status: "empty-cart" };
  if (order.total < MIN_ORDER_AMOUNT)
    return { status: "below-minimum", minimum: MIN_ORDER_AMOUNT };
  if (!user.paymentMethod) return { status: "no-payment-method" };

  const discount = calculateDiscount(user, order.total);
  const finalTotal = order.total - discount;
  const confirmation = submitPayment(user.paymentMethod, finalTotal);

  if (!confirmation.success) {
    return { status: "payment-failed", error: confirmation.error };
  }

  return {
    status: "confirmed",
    total: finalTotal,
    discount,
    confirmationId: confirmation.id,
  };
}

function calculateDiscount(user: User, total: number): number {
  if (!user.membership) return 0;
  return calculateMemberDiscount(user.membership, total);
}
```

**Why good:** Every guard exits early at the top. The happy path flows straight down with zero nesting. A reader knows that by the time they reach `submitPayment`, all preconditions have been validated. The discount calculation is extracted to keep the orchestrator thin.

### The Transformation Rule

To convert any nested block to guard clauses:

1. Find the outermost `if` and its `else` return
2. Invert: move the `else` body to the top as a guard, remove one nesting level
3. Repeat until no `else` blocks remain
4. The code remaining at the bottom is the happy path

---

## Discriminated Unions + Exhaustive Switch: Before/After

### Before: String-Based Status Checks

```typescript
function handleApiResponse(response: {
  status: string;
  data?: unknown;
  error?: string;
}) {
  if (response.status === "success") {
    return processData(response.data);
  } else if (response.status === "error") {
    return logError(response.error ?? "Unknown error");
  } else if (response.status === "loading") {
    return showSpinner();
  }
  // What about "timeout"? "unauthorized"? Nothing forces us to handle them.
}
```

**Why bad:** The `status` is typed as `string`, so any typo compiles. New statuses can be added without updating this handler. The `data` and `error` fields are optional everywhere even though they only exist for specific statuses.

### After: Discriminated Union + Exhaustive Switch

```typescript
type ApiResponse =
  | { status: "success"; data: ResponseData }
  | { status: "error"; message: string }
  | { status: "loading" }
  | { status: "timeout"; retryAfterMs: number };

function handleApiResponse(response: ApiResponse): void {
  switch (response.status) {
    case "success":
      processData(response.data); // TypeScript knows `data` exists here
      return;
    case "error":
      logError(response.message); // TypeScript knows `message` exists here
      return;
    case "loading":
      showSpinner();
      return;
    case "timeout":
      scheduleRetry(response.retryAfterMs);
      return;
    default: {
      const _exhaustive: never = response;
      return _exhaustive;
    }
  }
}
```

**Why good:** Each branch has access to exactly the fields that exist for that status -- no optional chaining needed. The `never` default guarantees exhaustive handling: adding a fifth status variant to `ApiResponse` causes a compile error here until the new case is added.

### When to Use Discriminated Unions

- A value has a fixed set of states (API responses, form steps, task status)
- Different states carry different data (success has `data`, error has `message`)
- All states must be handled -- missing a case should be a compile error

### When NOT to Use

- A simple boolean (`isActive: true | false`) -- use a plain boolean
- The set of variants changes frequently -- the compile errors become noise
- The type only appears in one place -- the ceremony isn't worth it

---

## Async Orchestrators: Before/After

### Before: Mixed Async Concerns

```typescript
async function deployProject(config: DeployConfig): Promise<DeployResult> {
  const files = await fs.readdir(config.sourceDir);
  const buildFiles = files.filter(
    (f) => f.endsWith(".ts") || f.endsWith(".tsx"),
  );

  if (buildFiles.length === 0) {
    return { status: "skipped", reason: "No source files found" };
  }

  const compiled = await compile(buildFiles, config.tsconfig);

  // These don't depend on each other but are awaited sequentially
  const lintResult = await runLinter(compiled.outDir);
  const typeCheck = await runTypeCheck(config.tsconfig);
  const tests = await runTests(compiled.outDir);

  if (!lintResult.passed || !typeCheck.passed || !tests.passed) {
    const failures = [
      !lintResult.passed && "lint",
      !typeCheck.passed && "types",
      !tests.passed && "tests",
    ].filter(Boolean);
    return { status: "failed", failures };
  }

  const bundle = await createBundle(compiled.outDir, config.target);
  const uploaded = await uploadToCloud(bundle, config.environment);
  return { status: "deployed", url: uploaded.url };
}
```

**Why bad:** File filtering, compilation, validation, and deployment are all in one function. Three independent checks (`lint`, `typeCheck`, `tests`) are awaited sequentially -- wasting time. The failure aggregation logic is inline.

### After: Async Orchestrator + Named Steps

```typescript
async function deployProject(config: DeployConfig): Promise<DeployResult> {
  const sourceFiles = await findSourceFiles(config.sourceDir);
  if (sourceFiles.length === 0) {
    return { status: "skipped", reason: "No source files found" };
  }

  const compiled = await compile(sourceFiles, config.tsconfig);
  const validationErrors = await validateBuild(
    compiled.outDir,
    config.tsconfig,
  );

  if (validationErrors.length > 0) {
    return { status: "failed", failures: validationErrors };
  }

  const bundle = await createBundle(compiled.outDir, config.target);
  const { url } = await uploadToCloud(bundle, config.environment);
  return { status: "deployed", url };
}

// Pure async functions below

async function findSourceFiles(sourceDir: string): Promise<string[]> {
  const files = await fs.readdir(sourceDir);
  return files.filter(isSourceFile);
}

function isSourceFile(filename: string): boolean {
  return filename.endsWith(".ts") || filename.endsWith(".tsx");
}

async function validateBuild(
  outDir: string,
  tsconfig: string,
): Promise<string[]> {
  // Independent checks -- run in parallel
  const [lintResult, typeCheck, testResult] = await Promise.all([
    runLinter(outDir),
    runTypeCheck(tsconfig),
    runTests(outDir),
  ]);

  return collectFailures(lintResult, typeCheck, testResult);
}

function collectFailures(...checks: CheckResult[]): string[] {
  return checks.filter((check) => !check.passed).map((check) => check.name);
}
```

**Why good:** The orchestrator reads as a plan: find files, compile, validate, bundle, upload. Independent validation steps run in parallel via `Promise.all`, communicating to the reader that they don't depend on each other. Failure aggregation is a pure function. Each async helper has a single responsibility.
