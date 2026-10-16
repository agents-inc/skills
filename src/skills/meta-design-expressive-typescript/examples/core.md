# Expressive TypeScript — Core Examples

> Full code for Patterns 1–6 in [SKILL.md](../SKILL.md). Pattern 7, collection operations, is in [data-transforms.md](data-transforms.md); what each compiler check needs is in [reference.md](../reference.md).

---

## Pattern 1: Orchestrator Over Pure Functions

### Before — parsing, deduplicating, counting and formatting in one loop

```typescript
function processDiffOutput(rawDiff: string): DiffSummary {
  const files: string[] = [];
  let additions = 0;
  let deletions = 0;

  for (const line of rawDiff.split("\n")) {
    if (line.startsWith("diff --git")) {
      const file = line.match(/ b\/(.+)$/)?.[1];
      if (file && !files.includes(file)) files.push(file);
    } else if (line.startsWith("+") && !line.startsWith("+++")) {
      additions++;
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      deletions++;
    }
  }

  const summary = files.map((file) => `  M ${file}`).join("\n");
  return { files, additions, deletions, summary };
}
```

**Why bad:** Four jobs share one loop and three mutable variables, so learning what the function returns means tracing the loop line by line.

### After — an orchestrator over named steps

```typescript
type FileHeaderLine = { readonly kind: "file-header"; readonly file: string };

type DiffLine =
  | FileHeaderLine
  | { readonly kind: "addition" | "deletion" | "context" };

const FILE_HEADER_PATH = / b\/(.+)$/;

const EMPTY_DIFF_SUMMARY: DiffSummary = {
  files: [],
  additions: 0,
  deletions: 0,
  summary: "",
};

function processDiffOutput(rawDiff: string): DiffSummary {
  if (rawDiff.trim() === "") return EMPTY_DIFF_SUMMARY;

  const diffLines = rawDiff.split("\n").map(parseDiffLine);
  const files = listChangedFiles(diffLines);

  return {
    files,
    additions: countLinesOfKind(diffLines, "addition"),
    deletions: countLinesOfKind(diffLines, "deletion"),
    summary: formatFileList(files),
  };
}

function parseDiffLine(line: string): DiffLine {
  if (line.startsWith("diff --git")) return parseFileHeader(line);
  if (isContentAddition(line)) return { kind: "addition" };
  if (isContentDeletion(line)) return { kind: "deletion" };
  return { kind: "context" };
}

function parseFileHeader(line: string): DiffLine {
  const file = line.match(FILE_HEADER_PATH)?.[1];
  return file ? { kind: "file-header", file } : { kind: "context" };
}

function isContentAddition(line: string): boolean {
  return line.startsWith("+") && !line.startsWith("+++");
}

function isContentDeletion(line: string): boolean {
  return line.startsWith("-") && !line.startsWith("---");
}

function listChangedFiles(lines: readonly DiffLine[]): string[] {
  const headers = lines.filter(isFileHeader);
  return [...new Set(headers.map((header) => header.file))];
}

function isFileHeader(line: DiffLine): line is FileHeaderLine {
  return line.kind === "file-header";
}

function countLinesOfKind(
  lines: readonly DiffLine[],
  kind: DiffLine["kind"],
): number {
  return lines.filter((line) => line.kind === kind).length;
}

function formatFileList(files: readonly string[]): string {
  return files.map((file) => `  M ${file}`).join("\n");
}
```

**Why good:** The orchestrator reads as its plan — parse each line, list the changed files, count additions and deletions, format the list — and returns the same summary as the loop. Each helper takes its input as an argument, so each is tested with a literal. The helpers sit below the orchestrator as `function` declarations, which are hoisted, so their position never matters; only the constants have to be declared before the first call.

### The helpers behind `processUserImport`

The orchestrator in [SKILL.md](../SKILL.md#pattern-1-orchestrator-over-pure-functions) calls these:

```typescript
function isValidUser(user: RawUser): boolean {
  return user.email.includes("@") && user.name.trim().length > 0;
}

function toUserRecord(user: RawUser): NormalizedUser {
  return {
    email: user.email.toLowerCase().trim(),
    name: user.name.trim(),
    role: user.role ?? DEFAULT_ROLE,
  };
}

function removeDuplicatesByEmail(users: NormalizedUser[]): NormalizedUser[] {
  const seen = new Set<string>();
  return users.filter((user) => {
    if (seen.has(user.email)) return false;
    seen.add(user.email);
    return true;
  });
}
```

**Why good:** Each does one thing, is named for it, and is tested with nothing but its arguments — no mocks, no state to set up first.

### Optional sections, each from its own formatter

A report built by appending to a string in `if` blocks becomes a list of sections, where each formatter returns `null` when it has nothing to say:

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

**Why good:** Adding a "Skipped" section is one function and one line in the list; nothing else in the orchestrator moves.

---

## Pattern 2: Named Predicates, Transforms and Constants

### Named predicate

```typescript
// Before: what does this select?
const relevantSkills = skills.filter(
  (skill) =>
    skill.category !== "deprecated" &&
    skill.scope === currentScope &&
    (skill.tags.includes(selectedTag) || selectedTag === "all"),
);
```

```typescript
// After: the selection is passed in, not closed over
const relevantSkills = skills.filter(isRelevantTo(selection));

function isRelevantTo(selection: Selection): (skill: Skill) => boolean {
  return (skill) => {
    if (skill.category === "deprecated") return false;
    if (skill.scope !== selection.scope) return false;
    return selection.tag === "all" || skill.tags.includes(selection.tag);
  };
}
```

**Why good:** The call reads as "skills relevant to the selection". Because the factory takes the selection as an argument, the predicate can live at the bottom of the file and be tested with a literal selection, and its body is one guard per condition.

A single comparison stays inline — a factory for it would add a name the expression already carries:

```typescript
const inProjectScope = skills.filter((skill) => skill.scope === "project");
```

### Named transform

```typescript
// Before: the ternary has to be run to see the two message shapes
const message = results
  .map((r) =>
    r.success ? `  Installed ${r.name}` : `  Failed ${r.name}: ${r.error}`,
  )
  .join("\n");
```

```typescript
// After
const message = results.map(formatInstallResult).join("\n");

function formatInstallResult(result: InstallResult): string {
  if (result.success) return `  Installed ${result.name}`;
  return `  Failed ${result.name}: ${result.error}`;
}
```

**Why good:** The orchestrator line reads as "format each result, join with newlines". `formatInstallResult` takes exactly the element, so passing it by reference to `map` is safe.

### Named constants

```typescript
// Before: the test's premise is buried in the construction
const account = createAccount({
  plan: "trial",
  trialEndsAt: YESTERDAY,
  seats: 3,
});
```

```typescript
// After: the name carries the one characteristic the test depends on
const EXPIRED_TRIAL_ACCOUNT = createAccount({
  plan: "trial",
  trialEndsAt: YESTERDAY,
  seats: 3,
});
```

**Why good:** At the point of use — `canCheckOut(EXPIRED_TRIAL_ACCOUNT)` — the test states its premise without a scroll back to the construction, and `seats: 3` is visibly incidental because the name leaves it out.

### When a name adds nothing

```typescript
// Already clear: a helper would only move one line
const ids = skills.map((skill) => skill.id);
const hasConflicts = conflicts.length > 0;
const displayName = `${firstName} ${lastName}`;
const isSelected = selectedIds.has(item.id);
```

**Why leave them:** `getIds`, `checkHasConflicts`, `buildDisplayName` or `isItemSelected(item, selectedIds)` would each be as long as the expression and say no more.

---

## Pattern 3: Guard Clauses

### Before: the arrow anti-pattern

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

**Why bad:** Five levels of nesting. The reader holds a stack of which conditions are true at each point, the happy path sits at the deepest indentation, and each `else` sends them scrolling up to find its `if`.

### After: guard clauses

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

**Why good:** Every guard exits at the top, so by `submitPayment` every precondition holds — and TypeScript has narrowed `user.paymentMethod` to match. The happy path runs straight down at zero nesting.

### The transformation rule

1. Find the outermost `if` and its `else` return
2. Invert it: move the `else` body to the top as a guard, and remove one nesting level
3. Repeat until no `else` remains
4. What is left at the bottom is the happy path

---

## Pattern 4: Discriminated Unions With an Exhaustive Switch

### Before: string-based status checks

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

**Why bad:** `status` is a `string`, so a typo compiles and a new status needs no handler. `data` and `error` are optional everywhere, though each exists for one status only.

### After: discriminated union and exhaustive switch

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
      const unhandled: never = response;
      return unhandled;
    }
  }
}
```

**Why good:** Each branch sees exactly the fields its status carries. Adding a fifth variant fails at the `never` line with the variant's name in the error, until a case handles it — and because this handler returns `void`, that line is the only check it has.

### Values the types did not check

For a value asserted into the union rather than validated — parsed JSON cast to `ApiResponse`, say — end the switch with `default: return assertUnhandled(response);`:

```typescript
function assertUnhandled(value: never): never {
  throw new Error(`Unhandled variant: ${JSON.stringify(value)}`);
}
```

### When to reach for a union

- A value has a fixed set of states, and different states carry different data
- Every state must be handled, and a missed one should fail compilation

Not for a plain yes/no, which a `boolean` says. Not for a type used in one place only, where declaring the union costs more ceremony than the narrowing saves. Not for an open set — codes a newer server may add — which wants a fallback branch rather than a `never` default that throws on the first value it has not seen.

---

## Pattern 5: Async Orchestrators

### Before: mixed async concerns

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

**Why bad:** Filtering, compiling, validating and deploying share one function. Three independent checks run one after another, so the wait is their sum, and the failure aggregation is inline.

### After: async orchestrator and named steps

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

**Why good:** The orchestrator reads as its plan: find files, compile, validate, bundle, upload. `Promise.all` tells the reader the three checks are independent, and the wait becomes the slowest check rather than all three.

`Promise.all` fits here because each check reports failure by resolving with `passed: false` rather than by rejecting.

---

## Pattern 6: `as const satisfies` for Configuration

```typescript
interface RouteConfig {
  path: string;
  auth: boolean;
}

// Annotated: any string is a key, and every path widens to `string`
const ANNOTATED_ROUTES: Record<string, RouteConfig> = {
  home: { path: "/", auth: false },
};

// Checked and kept: the shape is enforced, the keys and literals survive
const ROUTES = {
  home: { path: "/", auth: false },
  dashboard: { path: "/dashboard", auth: true },
} as const satisfies Record<string, RouteConfig>;

type RouteName = keyof typeof ROUTES; // "home" | "dashboard"
```

**Why good:** `ROUTES.dashbaord` fails to compile, where `ANNOTATED_ROUTES.dashbaord` compiles and is `undefined` at runtime. A misspelled field such as `{ pth: "/" }` fails against both, and `as const` on its own would accept it.
