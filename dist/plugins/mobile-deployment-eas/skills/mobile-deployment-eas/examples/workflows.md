# EAS Workflows Patterns

> CI/CD automation with EAS Workflows YAML, custom build steps, and GitHub integration. See [SKILL.md](../SKILL.md) for decisions and philosophy.

---

## Workflow Basics

EAS Workflows are defined in `.eas/workflows/*.yaml` files. They orchestrate builds, tests, submissions, and notifications in a single pipeline.

### Directory Structure

```
my-app/
  .eas/
    workflows/
      deploy-production.yaml
      preview-build.yaml
      nightly.yaml
  eas.json
  app.config.ts
```

---

## Complete Production Deployment Workflow

```yaml
# .eas/workflows/deploy-production.yaml
name: Deploy Production

on:
  push:
    branches: [main]

jobs:
  build_ios:
    type: build
    params:
      platform: ios
      profile: production

  build_android:
    type: build
    params:
      platform: android
      profile: production

  submit_ios:
    needs: [build_ios]
    type: submit
    params:
      platform: ios

  submit_android:
    needs: [build_android]
    type: submit
    params:
      platform: android

  notify:
    needs: [submit_ios, submit_android]
    if: ${{ success() }}
    type: slack
    params:
      webhook_url: ${{ env.SLACK_HOOK_URL }}
      message: "Production build submitted for review"
```

**Why good:** `needs` enforces ordering (submit only after build succeeds), `if: ${{ success() }}` prevents notification on failure, both platforms build in parallel

---

## Preview Build on Pull Request

```yaml
# .eas/workflows/preview-build.yaml
name: Preview Build

on:
  pull_request:
    branches: [main]
    types: [opened, synchronize]

jobs:
  build_preview:
    type: build
    params:
      platform: all
      profile: preview
```

**Tip:** Add `[eas skip]` to a commit message to skip triggered workflow runs.

---

## Workflow with Custom Steps

Pre-packaged jobs use `type`. Custom jobs use `steps` with shell commands and built-in functions.

```yaml
# .eas/workflows/test-and-build.yaml
name: Test and Build

on:
  push:
    branches: [main]

defaults:
  tools:
    node: "20"
    pnpm: "9"

jobs:
  test:
    steps:
      - uses: eas/checkout
      - uses: eas/install_node_modules
      - name: Run type check
        run: pnpm tsc --noEmit
      - name: Run tests
        run: pnpm test

  build:
    needs: [test]
    type: build
    params:
      platform: all
      profile: production
```

**Key built-in functions:**

| Function                   | Purpose                                     |
| -------------------------- | ------------------------------------------- |
| `eas/checkout`             | Clone repository source                     |
| `eas/install_node_modules` | Install deps (auto-detects package manager) |
| `eas/prebuild`             | Run `expo prebuild`                         |
| `eas/download_build`       | Retrieve build artifacts                    |
| `eas/restore_cache`        | Restore cached files                        |
| `eas/save_cache`           | Save files to cache                         |
| `eas/use_npm_token`        | Configure private npm access                |
| `eas/send_slack_message`   | Post to Slack webhook                       |

---

## Sharing Data Between Jobs

Use `set-output` and `set-env` shell functions to pass data between steps and jobs.

```yaml
jobs:
  version:
    outputs:
      app_version: ${{ steps.get_version.outputs.value }}
    steps:
      - uses: eas/checkout
      - id: get_version
        name: Extract version
        run: |
          VERSION=$(node -p "require('./package.json').version")
          set-output value "$VERSION"

  build:
    needs: [version]
    type: build
    env:
      APP_VERSION: ${{ needs.version.outputs.app_version }}
    params:
      platform: all
      profile: production
```

**`set-output`** shares across steps and jobs (via `outputs`). **`set-env`** shares within the same job only.

---

## Scheduled Workflows

```yaml
# .eas/workflows/nightly.yaml
name: Nightly Build

on:
  schedule:
    - cron: "0 2 * * 1-5" # 2 AM UTC, Monday-Friday

jobs:
  build:
    type: build
    params:
      platform: all
      profile: preview
```

---

## Manual Trigger with Inputs

```yaml
# .eas/workflows/manual-deploy.yaml
name: Manual Deploy

on:
  workflow_dispatch:
    inputs:
      platform:
        type: choice
        options: [ios, android, all]
      profile:
        type: choice
        options: [preview, production]

jobs:
  build:
    type: build
    params:
      platform: ${{ inputs.platform }}
      profile: ${{ inputs.profile }}
```

---

## Concurrency Control

Prevent multiple workflow runs from overlapping:

```yaml
name: Deploy
on:
  push:
    branches: [main]

concurrency:
  group: deploy-${{ github.ref }}
  cancel-in-progress: true # Cancel previous run if new push arrives

jobs:
  build:
    type: build
    params:
      platform: all
      profile: production
```

---

## GitHub Actions Alternative

If you prefer GitHub Actions over EAS Workflows:

```yaml
# .github/workflows/eas-build.yml
name: EAS Build

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Setup EAS
        uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}

      - name: Build Preview
        if: github.event_name == 'pull_request'
        run: eas build --profile preview --platform all --non-interactive

      - name: Build and Submit Production
        if: github.ref == 'refs/heads/main'
        run: eas build --profile production --platform all --auto-submit --non-interactive
```

**Trade-offs:**

- **EAS Workflows:** Tightly integrated with EAS services, pre-packaged job types, less boilerplate
- **GitHub Actions:** More ecosystem tooling, familiar to most teams, works with non-EAS steps

Both approaches use `EXPO_TOKEN` for authentication and `--non-interactive` to prevent CI hangs.
