# PlanetScale -- Branching & Schema Changes

> Database branching, deploy requests, safe migrations, and CI/CD workflows. See [SKILL.md](../SKILL.md) for core concepts.

**Prerequisites:** Understand connection setup and query patterns from [core.md](core.md) first.

---

## Pattern 1: Dev Branch Workflow

### Good Example -- Feature Development Branch

```bash
# Create a branch for a feature
pscale branch create my-database feat-user-profiles

# Open interactive MySQL shell on the branch
pscale shell my-database feat-user-profiles

# In the shell: make schema changes directly (DDL allowed on dev branches)
# mysql> CREATE TABLE user_profiles (
# mysql>   id BIGINT AUTO_INCREMENT PRIMARY KEY,
# mysql>   user_id BIGINT NOT NULL,
# mysql>   bio TEXT,
# mysql>   avatar_url VARCHAR(512),
# mysql>   created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
# mysql>   INDEX idx_user_id (user_id)
# mysql> );

# When ready: create a deploy request to merge into main
pscale deploy-request create my-database feat-user-profiles --into main

# Review the diff
pscale deploy-request diff my-database 1

# Deploy
pscale deploy-request deploy my-database 1

# Clean up the branch
pscale branch delete my-database feat-user-profiles
```

**Why good:** Schema changes are isolated on the development branch, deploy request provides a reviewable diff before touching production, `pscale shell` gives a MySQL-compatible prompt for interactive DDL, clean deletion after merge

---

## Pattern 2: Safe Column Rename (Three-Step Pattern)

PlanetScale's online DDL via Vitess does not safely support `ALTER TABLE ... RENAME COLUMN`. The safe approach uses three deploy requests.

### Good Example -- Renaming `name` to `full_name`

```bash
# Step 1: Add the new column
pscale branch create my-database rename-step-1
pscale shell my-database rename-step-1
# mysql> ALTER TABLE users ADD COLUMN full_name VARCHAR(255);
pscale deploy-request create my-database rename-step-1 --into main
pscale deploy-request deploy my-database 1

# Step 2: Migrate data and update application to write to both columns
# In your application code:
#   INSERT INTO users (name, full_name, ...) VALUES (?, ?, ...)
#   UPDATE users SET full_name = name WHERE full_name IS NULL;
# Deploy application changes, then backfill:
pscale branch create my-database rename-step-2
pscale shell my-database rename-step-2
# mysql> UPDATE users SET full_name = name WHERE full_name IS NULL;
pscale deploy-request create my-database rename-step-2 --into main
pscale deploy-request deploy my-database 2

# Step 3: Drop the old column (after application no longer reads from it)
pscale branch create my-database rename-step-3
pscale shell my-database rename-step-3
# mysql> ALTER TABLE users DROP COLUMN name;
pscale deploy-request create my-database rename-step-3 --into main
pscale deploy-request deploy my-database 3
```

**Why good:** Each step is independently deployable and revertable, no data loss at any point, application can be updated between steps, backward-compatible at every stage

**When to use:** Any column rename on a production branch with safe migrations enabled. This is the Vitess-safe pattern.

---

## Pattern 3: PR Preview Branches with GitHub Actions

### Good Example -- Create Branch on PR Open, Delete on Close

```yaml
# .github/workflows/preview-db.yml
name: Preview Database Branch

on:
  pull_request:
    types: [opened, reopened, closed]

env:
  PLANETSCALE_SERVICE_TOKEN: ${{ secrets.PLANETSCALE_SERVICE_TOKEN }}
  PLANETSCALE_SERVICE_TOKEN_ID: ${{ secrets.PLANETSCALE_SERVICE_TOKEN_ID }}
  DATABASE_NAME: my-database

jobs:
  create-branch:
    if: github.event.action != 'closed'
    runs-on: ubuntu-latest
    steps:
      - name: Install pscale CLI
        run: |
          curl -sL https://github.com/planetscale/cli/releases/latest/download/pscale_linux_amd64.tar.gz | tar xz
          sudo mv pscale /usr/local/bin/

      - name: Create preview branch
        run: |
          pscale branch create $DATABASE_NAME preview-pr-${{ github.event.number }} \
            --org ${{ secrets.PLANETSCALE_ORG }} \
            || echo "Branch may already exist"

      - name: Get connection credentials
        id: creds
        run: |
          CREDS=$(pscale password create $DATABASE_NAME preview-pr-${{ github.event.number }} \
            ci-password-${{ github.run_id }} \
            --org ${{ secrets.PLANETSCALE_ORG }} \
            --format json)
          echo "host=$(echo $CREDS | jq -r '.access_host_url')" >> $GITHUB_OUTPUT
          echo "username=$(echo $CREDS | jq -r '.username')" >> $GITHUB_OUTPUT
          echo "password=$(echo $CREDS | jq -r '.plain_text')" >> $GITHUB_OUTPUT

      - name: Run migrations
        env:
          DATABASE_HOST: ${{ steps.creds.outputs.host }}
          DATABASE_USERNAME: ${{ steps.creds.outputs.username }}
          DATABASE_PASSWORD: ${{ steps.creds.outputs.password }}
        run: npx your-migration-tool migrate

  delete-branch:
    if: github.event.action == 'closed'
    runs-on: ubuntu-latest
    steps:
      - name: Install pscale CLI
        run: |
          curl -sL https://github.com/planetscale/cli/releases/latest/download/pscale_linux_amd64.tar.gz | tar xz
          sudo mv pscale /usr/local/bin/

      - name: Delete preview branch
        run: |
          pscale branch delete $DATABASE_NAME preview-pr-${{ github.event.number }} \
            --org ${{ secrets.PLANETSCALE_ORG }} \
            --force \
            || echo "Branch may already be deleted"
```

**Why good:** Branch lifecycle tied to PR lifecycle, `reopened` event handles re-opened PRs, `--force` on delete avoids confirmation prompts in CI, `|| echo` prevents failures if branch already exists/deleted, service token auth for non-interactive CI, unique password name per run prevents collisions

---

## Pattern 4: Gated Deployment Workflow

### Good Example -- Coordinated Schema + Application Deploy

```bash
# 1. Create and deploy schema change with manual cutover
pscale deploy-request create my-database add-user-roles --into main --disable-auto-apply
pscale deploy-request deploy my-database 1
# Schema migration runs in background (online DDL) but table swap is held

# 2. Deploy application code that handles both old and new schema
# ... deploy your application ...

# 3. When ready, apply the cutover (table swap happens)
pscale deploy-request apply my-database 1

# 4. If issues found within 30 minutes, revert
pscale deploy-request revert my-database 1

# 5. If all good, skip the revert period to finalize
pscale deploy-request skip-revert my-database 1
```

**Why good:** Schema migration completes in background without blocking reads/writes, manual cutover lets you coordinate with application deployment, 30-minute revert window provides a safety net, skip-revert releases resources early when confident

**When to use:** Large schema changes (adding indexes, altering column types) that need coordination with application code changes. Also useful for high-traffic databases where you want control over cutover timing.

---

## Pattern 5: Safe Migrations Setup

### Good Example -- Enabling Safe Migrations on Production

```bash
# Enable safe migrations on your production branch
pscale branch safe-migrations enable my-database main

# Now, direct DDL on main is rejected:
pscale shell my-database main
# mysql> ALTER TABLE users ADD COLUMN age INT;
# ERROR: DDL statements are not allowed on branches with safe migrations enabled.
# Use deploy requests to make schema changes.

# Verify safe migrations status
pscale branch show my-database main
# Look for: safe_migrations: true
```

**Why good:** Prevents accidental DDL on production, forces all schema changes through the deploy request review workflow

#### What Safe Migrations Block

- `CREATE TABLE`
- `ALTER TABLE`
- `DROP TABLE`
- `CREATE INDEX` / `DROP INDEX`
- `TRUNCATE TABLE`

#### What Still Works

- All DML: `SELECT`, `INSERT`, `UPDATE`, `DELETE`
- `SET` (session variables)
- `SHOW`, `DESCRIBE`, `EXPLAIN`

---

## Pattern 6: Foreign Key Constraints Setup

### Good Example -- Enabling and Using Foreign Keys

```bash
# Enable FK support in database settings (via dashboard or API)
# Dashboard: Database Settings > Enable foreign key constraints

# Then create tables with FKs on a development branch
pscale branch create my-database add-fk-constraints
pscale shell my-database add-fk-constraints
```

```sql
-- Create parent table
CREATE TABLE authors (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL
);

-- Create child table with foreign key
CREATE TABLE posts (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  author_id BIGINT NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT,
  CONSTRAINT fk_posts_author FOREIGN KEY (author_id) REFERENCES authors(id) ON DELETE CASCADE
);
```

```bash
# Deploy via deploy request
pscale deploy-request create my-database add-fk-constraints --into main
pscale deploy-request deploy my-database 1
```

**Why good:** FK constraint named explicitly (`fk_posts_author`), `ON DELETE CASCADE` handles cleanup, deployed through proper deploy request workflow

#### Foreign Key Limitations on PlanetScale

- **Opt-in only**: Must be enabled in database settings before use
- **Unsharded databases only**: Sharded databases do not support FK constraints
- **No referential integrity validation on ALTER TABLE ADD FK**: Adding a FK to an existing table does not check if orphaned rows already exist
- **Revert complications**: Reverting a deploy request that dropped a FK may fail if new non-conforming data was inserted
- **Performance trade-off**: FK enforcement adds overhead in high-concurrency workloads

---

## Pattern 7: Branch Cleanup Script

### Good Example -- Delete Stale Preview Branches via pscale CLI

```bash
#!/bin/bash
# cleanup-stale-branches.sh
# Run as a weekly cron job in CI

DATABASE_NAME="my-database"
STALE_DAYS=14
PREVIEW_PREFIX="preview-pr-"

# List branches and filter stale preview branches
pscale branch list "$DATABASE_NAME" --org "$PLANETSCALE_ORG" --format json \
  | jq -r --arg prefix "$PREVIEW_PREFIX" --argjson days "$STALE_DAYS" '
    .[] | select(.name | startswith($prefix))
    | select(
        (now - (.created_at | fromdateiso8601)) > ($days * 86400)
      )
    | .name
  ' \
  | while read -r branch_name; do
      echo "Deleting stale branch: $branch_name"
      pscale branch delete "$DATABASE_NAME" "$branch_name" --org "$PLANETSCALE_ORG" --force
    done
```

**Why good:** Only targets preview branches (never dev or main), configurable stale threshold, `--format json` enables programmatic filtering, `--force` skips confirmation in CI, safe to run repeatedly

**When to use:** As a scheduled CI job to clean up preview branches from closed PRs that were not properly deleted.

---

## Pattern 8: Instant Deployments

### Good Example -- Fast Schema Changes with ALGORITHM=INSTANT

```bash
# Instant deployments use MySQL's ALGORITHM=INSTANT for near-zero-time changes
# Supported operations:
# - Adding columns (at the end of the table)
# - Dropping columns
# - Modifying column defaults
# - Changing ENUM/SET definitions

pscale deploy-request create my-database add-settings-col --into main
pscale deploy-request deploy my-database 1 --instant

# WARNING: Instant deployments CANNOT be reverted
# The 30-minute revert window does not apply
```

**Why good:** Near-instantaneous schema changes for supported operations, no table copy or rebuild

```bash
# BAD: Using --instant for unsupported operations
pscale deploy-request deploy my-database 1 --instant
# Adding an index is NOT instant-eligible -- this will fail
# Changing column types is NOT instant-eligible -- this will fail
```

**Why bad:** Only a subset of DDL operations support `ALGORITHM=INSTANT`. The deploy will fail if the change requires a table rebuild.

**When to use:** Adding nullable columns, dropping columns, or changing column defaults where you don't need the revert safety net.

---

_For driver setup and query patterns, see [core.md](core.md)._
