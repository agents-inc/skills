# Neon -- Branching Examples

> Database branching for dev, preview, and CI environments. See [SKILL.md](../SKILL.md) for core concepts.

**Prerequisites:** Understand connection string setup and driver patterns from [core.md](core.md) first.

---

## Pattern 1: Dev Branch Workflow

### Good Example -- Feature Development Branch

```bash
# Create a branch for a feature (copies schema + data from parent via copy-on-write)
neonctl branches create --name dev/feat-user-profiles --project-id $NEON_PROJECT_ID

# Get the branch's pooled connection string
neonctl connection-string --project-id $NEON_PROJECT_ID --branch dev/feat-user-profiles --pooled

# Run migrations against the branch
DATABASE_URL=$(neonctl connection-string --project-id $NEON_PROJECT_ID --branch dev/feat-user-profiles) \
  npx your-migration-tool migrate

# When done: reset branch to re-sync with production, or delete it
neonctl branches reset dev/feat-user-profiles --parent --project-id $NEON_PROJECT_ID
neonctl branches delete dev/feat-user-profiles --project-id $NEON_PROJECT_ID
```

**Why good:** Branch naming convention (`dev/feat-*`) maps to git workflow, `--pooled` flag returns the pooled connection string, reset re-syncs with parent without recreating, clean deletion when feature is complete

---

## Pattern 2: PR Preview Branches with GitHub Actions

### Good Example -- Create Branch on PR Open, Delete on Close

```yaml
# .github/workflows/preview-branch.yml
name: Preview Database Branch

on:
  pull_request:
    types: [opened, synchronize, closed]

env:
  NEON_PROJECT_ID: ${{ secrets.NEON_PROJECT_ID }}
  NEON_API_KEY: ${{ secrets.NEON_API_KEY }}

jobs:
  create-branch:
    if: github.event.action != 'closed'
    runs-on: ubuntu-latest
    outputs:
      db_url: ${{ steps.branch.outputs.db_url }}
    steps:
      - uses: neondatabase/create-branch-action@v6
        id: branch
        with:
          project_id: ${{ env.NEON_PROJECT_ID }}
          api_key: ${{ env.NEON_API_KEY }}
          branch_name: preview/pr-${{ github.event.number }}
          role: neondb_owner

      - name: Run migrations
        env:
          DATABASE_URL: ${{ steps.branch.outputs.db_url }}
        run: npx your-migration-tool migrate

      - name: Comment PR with branch info
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `Database branch \`preview/pr-${context.issue.number}\` created.`
            })

  delete-branch:
    if: github.event.action == 'closed'
    runs-on: ubuntu-latest
    steps:
      - uses: neondatabase/delete-branch-action@v3
        with:
          project_id: ${{ env.NEON_PROJECT_ID }}
          api_key: ${{ env.NEON_API_KEY }}
          branch: preview/pr-${{ github.event.number }}
```

**Why good:** Branch lifecycle tied to PR lifecycle (create on open, delete on close), `synchronize` event handles force pushes, migration runs against branch, consistent naming convention `preview/pr-{number}`, official Neon GitHub Actions for reliability

---

## Pattern 3: Programmatic Branch Management (Neon API)

### Good Example -- TypeScript Branch Manager for CI/CD

```typescript
const NEON_API_BASE = "https://console.neon.tech/api/v2";

interface NeonBranch {
  id: string;
  name: string;
  parent_id: string;
  created_at: string;
}

interface NeonEndpoint {
  host: string;
}

interface CreateBranchResponse {
  branch: NeonBranch;
  endpoints: NeonEndpoint[];
  connection_uris: Array<{ connection_uri: string }>;
}

async function neonApi<T>(
  path: string,
  apiKey: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${NEON_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Neon API error (${response.status}): ${body}`);
  }

  return response.json() as Promise<T>;
}

// Create a preview branch with auto-expiration
const PREVIEW_BRANCH_TTL_DAYS = 7;

async function createPreviewBranch(
  projectId: string,
  prNumber: number,
  apiKey: string,
): Promise<{ branchId: string; connectionUri: string }> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + PREVIEW_BRANCH_TTL_DAYS);

  const result = await neonApi<CreateBranchResponse>(
    `/projects/${projectId}/branches`,
    apiKey,
    {
      method: "POST",
      body: JSON.stringify({
        branch: {
          name: `preview/pr-${prNumber}`,
          expires_at: expiresAt.toISOString(),
        },
        endpoints: [{ type: "read_write" }],
      }),
    },
  );

  return {
    branchId: result.branch.id,
    connectionUri: result.connection_uris[0].connection_uri,
  };
}

// Delete a preview branch
async function deletePreviewBranch(
  projectId: string,
  branchId: string,
  apiKey: string,
): Promise<void> {
  await neonApi(`/projects/${projectId}/branches/${branchId}`, apiKey, {
    method: "DELETE",
  });
}

// List all branches (for cleanup scripts)
async function listBranches(
  projectId: string,
  apiKey: string,
): Promise<NeonBranch[]> {
  const result = await neonApi<{ branches: NeonBranch[] }>(
    `/projects/${projectId}/branches`,
    apiKey,
  );
  return result.branches;
}
```

**Why good:** Generic `neonApi` helper with typed responses, TTL expiration ensures auto-cleanup even if delete fails, named constant for TTL, typed interfaces for API responses, error includes status code and body for debugging

---

## Pattern 4: Schema-Only Branches

### Good Example -- Branching Without Sensitive Data

```typescript
// Schema-only branches copy structure but NOT data
// Use for: CI testing with fixtures, sensitive data compliance

const NEON_API_BASE = "https://console.neon.tech/api/v2";

async function createSchemaOnlyBranch(
  projectId: string,
  branchName: string,
  apiKey: string,
): Promise<string> {
  const response = await fetch(
    `${NEON_API_BASE}/projects/${projectId}/branches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        branch: {
          name: branchName,
          init_source: "schema-only", // Key: copies DDL but not rows
        },
        endpoints: [{ type: "read_write" }],
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Failed to create schema-only branch: ${response.statusText}`,
    );
  }

  const result = await response.json();
  return result.branch.id;
}
```

**Why good:** `init_source: "schema-only"` creates branch with tables/indexes/constraints but no row data, useful for CI environments that seed their own test data, avoids copying sensitive production data

**When to use:** When you need the schema but not production data (e.g., compliance requirements, CI test runs with fixtures, staging environments with synthetic data).

---

## Pattern 5: Branch Reset for Development

### Good Example -- Syncing Dev Branch with Production

```bash
# Reset dev branch to match current state of parent (main)
neonctl branches reset dev-alice --parent --project-id $NEON_PROJECT_ID

# Reset with backup: saves current state under a new name before resetting
neonctl branches reset dev-alice --parent \
  --preserve-under-name dev-alice-backup-$(date +%Y%m%d) \
  --project-id $NEON_PROJECT_ID
```

**Why good:** `--parent` flag resets to parent's current state (not the state at branch creation), `--preserve-under-name` creates a backup in case you need to recover work, date-based backup naming prevents collisions

**When to use:** After production schema changes that you want reflected in your dev branch, or when your dev data becomes too divergent from production to be useful.

---

## Pattern 6: Branch Cleanup Script

### Good Example -- Delete Stale Preview Branches

```typescript
const STALE_BRANCH_THRESHOLD_DAYS = 14;
const PREVIEW_BRANCH_PREFIX = "preview/pr-";

async function cleanupStaleBranches(
  projectId: string,
  apiKey: string,
): Promise<string[]> {
  const branches = await listBranches(projectId, apiKey);
  const now = new Date();
  const deleted: string[] = [];

  for (const branch of branches) {
    // Only clean up preview branches
    if (!branch.name.startsWith(PREVIEW_BRANCH_PREFIX)) {
      continue;
    }

    const createdAt = new Date(branch.created_at);
    const ageInDays =
      (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

    if (ageInDays > STALE_BRANCH_THRESHOLD_DAYS) {
      await deletePreviewBranch(projectId, branch.id, apiKey);
      deleted.push(branch.name);
    }
  }

  return deleted;
}
```

**Why good:** Named constants for threshold and prefix, only targets preview branches (never dev or main), returns list of deleted branches for logging, safe to run repeatedly (idempotent for already-deleted branches)

**When to use:** As a scheduled CI job (weekly cron) to clean up preview branches from closed PRs that were not properly deleted, or as a cost-control measure.

---

_For driver setup and query patterns, see [core.md](core.md)._
