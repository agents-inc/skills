## Output Format

<output_format>
Provide your scaffolding output in this structure:

<summary>
**Application:** [app-name]
**Status:** [COMPLETE | PHASE X IN_PROGRESS | FAILED]
**Files Created:** [count] files across [Y] phases
**Tech Stack:** [Key technologies used]
</summary>

<investigation>
**Reference Applications Examined:**

| App                 | What Was Learned                                 |
| ------------------- | ------------------------------------------------ |
| [apps/existing-app] | [Patterns extracted - structure, auth, db, etc.] |

**Patterns Identified:**

- **Project structure:** [How apps are organized - from /path]
- **Configuration:** [Config patterns used - from /path]
- **Database:** [Schema patterns - from /path]
- **Auth:** [Auth setup patterns - from /path]
- **API:** [Route/handler patterns - from /path]

**Shared Packages Available:**

- `@repo/ui` - [UI components]
- `@repo/typescript-config` - [TS config base]
- [Other @repo/* packages]
  </investigation>

<structure_created>

## Directory Structure

```
apps/{app-name}/
├── src/
│   ├── app/                 # [Purpose]
│   ├── components/          # [Purpose]
│   ├── lib/
│   │   ├── api/            # [Purpose]
│   │   ├── auth/           # [Purpose]
│   │   ├── db/             # [Purpose]
│   │   └── env.ts          # [Purpose]
│   └── middleware.ts
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

**Files Created:** [count]
**Directories Created:** [count]

</structure_created>

<configuration_summary>

## Setup Phases Completed

| Phase | Component                   | Status | Notes                    |
| ----- | --------------------------- | ------ | ------------------------ |
| 1     | Directory structure         | PASS   | [Brief note]             |
| 2     | Package.json + dependencies | PASS   | [Dependencies installed] |
| 3     | TypeScript config           | PASS   | [Extends shared base]    |
| 4     | Database schema             | PASS   | [Tables created]         |
| 5     | Auth setup                  | PASS   | [Provider configured]    |
| 6     | API infrastructure          | PASS   | [Routes ready]           |
| 7     | Analytics                   | PASS   | [Provider integrated]    |
| 8     | Observability               | PASS   | [Logging/errors ready]   |
| 9     | Testing setup               | PASS   | [Test framework ready]   |
| 10    | Environment                 | PASS   | [.env.example complete]  |

</configuration_summary>

<verification_results>

## Build Verification

**Dependency Installation:**

```bash
bun install  # Result: [PASS/FAIL]
```

**Type Checking:**

```bash
bun tsc --noEmit  # Result: [PASS/FAIL]
# Errors if any: [list or "None"]
```

**Pattern Compliance:**

| Convention                | Status | Evidence                             |
| ------------------------- | ------ | ------------------------------------ |
| kebab-case file names     | PASS   | All [X] files checked                |
| Named exports only        | PASS   | No default exports found             |
| Zod env validation        | PASS   | `/src/lib/env.ts` validates all vars |
| Correlation ID middleware | PASS   | `/src/lib/api/middleware.ts:X`       |
| Error boundaries          | PASS   | `/src/components/error-boundary.tsx` |

</verification_results>

<environment_setup>

## Environment Variables

All variables documented in `.env.example`:

| Variable       | Required | Description                |
| -------------- | -------- | -------------------------- |
| `DATABASE_URL` | Yes      | Database connection string |
| `AUTH_SECRET`  | Yes      | Auth encryption key        |
| `POSTHOG_KEY`  | No       | Analytics API key          |
| [Other vars]   | [Yes/No] | [Description]              |

**Generation commands:**

```bash
# Generate AUTH_SECRET
openssl rand -base64 32
```

</environment_setup>

<handoff>

## Getting Started

**1. Environment Setup:**

```bash
cd apps/{app-name}
cp .env.example .env.local
# Fill required variables (see table above)
```

**2. Database Setup:**

```bash
bun db:push    # Push schema to database
bun db:studio  # (Optional) Open Drizzle Studio
```

**3. Development:**

```bash
bun dev        # Start development server
```

**4. Verification:**

```bash
bun test       # Run tests
bun build      # Verify production build
```

## Pattern Reference Files

When implementing features, reference these files:

| Pattern             | Reference File                  | Lines |
| ------------------- | ------------------------------- | ----- |
| Auth middleware     | `/src/lib/auth/server.ts`       | all   |
| API route handler   | `/src/lib/api/routes/health.ts` | all   |
| Database queries    | `/src/lib/db/queries/`          | all   |
| Environment access  | `/src/lib/env.ts`               | all   |
| Error handling      | `/src/lib/api/middleware.ts`    | [X-Y] |
| Component structure | `/src/components/[example].tsx` | all   |

## Next Steps

1. **Create specification:** Invoke PM agent for feature specs
2. **Implement features:** Use frontend-developer / backend-developer
3. **Write tests:** Invoke tester agent
4. **Code review:** Use frontend-reviewer / backend-reviewer

</handoff>

<rollback>

## Rollback Instructions

If scaffolding needs to be removed:

```bash
# Remove the application
rm -rf apps/{app-name}

# If committed, reset
git reset --soft HEAD~1
```

</rollback>

<notes>

## Technical Decisions

| Decision      | Rationale                         |
| ------------- | --------------------------------- |
| [Choice made] | [Why, based on existing patterns] |

## Known Limitations

- [Any deferred features]
- [Known technical debt]

## Session Resumption

If scaffolding was interrupted:

- **Last complete phase:** [X]
- **Resume from:** [Phase Y]
- **Progress file:** `apps/{app-name}/SCAFFOLD-PROGRESS.md`

</notes>

</output_format>

---

## Section Guidelines

### When to Include Each Section

| Section                   | When Required                           |
| ------------------------- | --------------------------------------- |
| `<summary>`               | Always                                  |
| `<investigation>`         | Always - shows patterns were researched |
| `<structure_created>`     | Always - visual confirmation            |
| `<configuration_summary>` | Always - phase completion tracking      |
| `<verification_results>`  | Always - proves build works             |
| `<environment_setup>`     | Always - documents env vars             |
| `<handoff>`               | Always - enables next steps             |
| `<rollback>`              | Always - recovery path                  |
| `<notes>`                 | When decisions or limitations exist     |

### Universal Scaffolding Verification

Every scaffolded app must verify:

- **Build succeeds:** `bun install` and `bun tsc --noEmit` pass
- **Naming conventions:** kebab-case files, SCREAMING_SNAKE_CASE env vars
- **Exports:** Named exports only (no default exports in libraries)
- **Environment:** All config externalized to .env, validated with Zod
- **Patterns:** Match existing applications in the monorepo

### Multi-Session Awareness

Complex scaffolding may span multiple sessions:

1. Create `SCAFFOLD-PROGRESS.md` in the app directory
2. Track completed phases with timestamps
3. Note any blockers or decisions made
4. Enable clean resumption of work
