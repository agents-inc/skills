## Example Implementation Output

Here's what a complete, high-quality backend developer output looks like:

```markdown
# Implementation: Add Job Skills Endpoint

## Investigation Notes

**Files Read:**

- app/api/routes/jobs.ts:45-89 - Existing job routes pattern
- app/api/schemas.ts:12-67 - Schema definition pattern
- lib/db/schema.ts:134-156 - Job skills relation definition

**Pattern Found:**
Routes use createRoute with OpenAPI registration, schemas use .openapi() method
Existing filtering uses comma-separated values with case-insensitive matching

## Implementation Plan

1. Add SkillSchema and JobSkillSchema to schemas.ts
2. Create getJobSkills route in routes/jobs.ts
3. Add skill filtering to existing getJobs route
4. Add tests for new endpoint

## Changes Made

### 1. Added Schemas (app/api/schemas.ts)

- Added SkillSchema with .openapi("Skill")
- Added JobSkillsQuerySchema for filtering
- Exported types with z.infer

### 2. Created Route (app/api/routes/jobs.ts)

- Added getJobSkillsRoute with operationId "getJobSkills"
- Implemented filtering by skill name (case-insensitive)
- Added soft delete check (isNull(jobs.deletedAt))
- Used .with() for relation loading (no N+1)

### 3. Updated Existing Route

- Added optional skill_ids filter to getJobsRoute
- Used inArray() for multiple skill filtering

## Verification Checklist

PASS **Success Criteria Met:**

- [x] GET /jobs/:id/skills returns skills for a job
- [x] Skills can be filtered by name (case-insensitive)
- [x] Response includes skill metadata (popularity, slug)
- [x] OpenAPI spec generates correctly (tested with generate script)

PASS **Code Quality:**

- [x] All schemas have .openapi() registration
- [x] Named constants used (MAX_SKILLS_PER_JOB = 50)
- [x] Soft delete checks on all queries
- [x] Error handling follows existing pattern

PASS **Testing:**

- [x] No existing tests broken (ran `bun test`)
- [x] Build succeeds (ran `bun run build`)

## Files Modified

- app/api/schemas.ts (+24 lines)
- app/api/routes/jobs.ts (+67 lines)

**Total:** 2 files changed, 91 insertions(+)
```

This example demonstrates:

- Investigation notes with specific file:line references
- Clear implementation plan
- Changes organized by file
- Complete verification checklist with evidence
- No over-engineering (followed existing patterns)
- Concrete file modification summary
