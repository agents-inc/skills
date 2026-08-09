# Vercel Quick Reference

## vercel.json Property Reference

| Property                  | Type             | Description                                                  |
| ------------------------- | ---------------- | ------------------------------------------------------------ |
| `$schema`                 | `string`         | `"https://openapi.vercel.sh/vercel.json"` for IDE validation |
| `buildCommand`            | `string \| null` | Override framework build command                             |
| `installCommand`          | `string \| null` | Override package install command                             |
| `outputDirectory`         | `string \| null` | Override build output directory                              |
| `framework`               | `string \| null` | Framework preset (`"nextjs"`, `"remix"`, `null` for Other)   |
| `regions`                 | `string[]`       | Default function regions (e.g., `["iad1"]`)                  |
| `functionFailoverRegions` | `string[]`       | Failover regions for outages (Enterprise)                    |
| `functions`               | `object`         | Per-function config (maxDuration, regions, runtime)          |
| `headers`                 | `object[]`       | Custom response headers                                      |
| `redirects`               | `object[]`       | URL redirect rules                                           |
| `rewrites`                | `object[]`       | URL rewrite rules (no browser URL change)                    |
| `crons`                   | `object[]`       | Scheduled function invocations                               |
| `cleanUrls`               | `boolean`        | Remove `.html` extensions (default: false)                   |
| `trailingSlash`           | `boolean`        | Add/remove trailing slashes                                  |
| `fluid`                   | `boolean`        | Enable Fluid compute (default: true for new projects)        |
| `images`                  | `object`         | Image optimization configuration                             |
| `ignoreCommand`           | `string \| null` | Custom build skip logic (exit 0 = skip)                      |
| `public`                  | `boolean`        | Make deployment logs/source public                           |
| `bunVersion`              | `string`         | Use Bun runtime (`"1.x"`)                                    |

## functions Object Properties

| Property                  | Type       | Description                                      |
| ------------------------- | ---------- | ------------------------------------------------ |
| `maxDuration`             | `number`   | Max execution time in seconds                    |
| `memory`                  | `number`   | Memory in MB (ignored with Fluid, use dashboard) |
| `runtime`                 | `string`   | Community runtime npm package                    |
| `regions`                 | `string[]` | Override project-level regions                   |
| `functionFailoverRegions` | `string[]` | Override project-level failover                  |
| `includeFiles`            | `string`   | Glob for files to include                        |
| `excludeFiles`            | `string`   | Glob for files to exclude                        |
| `supportsCancellation`    | `boolean`  | Enable request cancellation (Node.js only)       |

## Plan Limits

| Resource              | Hobby         | Pro           | Enterprise    |
| --------------------- | ------------- | ------------- | ------------- |
| maxDuration (default) | 10s           | 15s           | 15s           |
| maxDuration (max)     | 60s           | 300s          | 900s          |
| Memory (default)      | 2 GB / 1 vCPU | 2 GB / 1 vCPU | 2 GB / 1 vCPU |
| Memory (max)          | 2 GB / 1 vCPU | 4 GB / 2 vCPU | 4 GB / 2 vCPU |
| Edge code size (gzip) | 1 MB          | 2 MB          | 4 MB          |
| Node.js code size     | 250 MB        | 250 MB        | 250 MB        |
| Cron jobs             | 2             | 40            | 100+          |
| Cron min interval     | Daily         | 1 minute      | 1 minute      |

## Common Region IDs

| Region           | ID     | Location          |
| ---------------- | ------ | ----------------- |
| Washington, D.C. | `iad1` | US East (default) |
| San Francisco    | `sfo1` | US West           |
| Portland         | `pdx1` | US West           |
| Paris            | `cdg1` | Europe            |
| London           | `lhr1` | Europe            |
| Frankfurt        | `fra1` | Europe            |
| Tokyo            | `hnd1` | Asia              |
| Singapore        | `sin1` | Asia              |
| Sydney           | `syd1` | Oceania           |
| Sao Paulo        | `gru1` | South America     |

## Built-in Environment Variables

| Variable                    | Description                  | Example                                      |
| --------------------------- | ---------------------------- | -------------------------------------------- |
| `VERCEL_ENV`                | Deployment environment       | `"production"`, `"preview"`, `"development"` |
| `VERCEL_URL`                | Deployment URL (no protocol) | `"my-app-abc123.vercel.app"`                 |
| `VERCEL_REGION`             | Function execution region    | `"iad1"`                                     |
| `VERCEL_GIT_COMMIT_SHA`     | Full commit hash             | `"abc123..."`                                |
| `VERCEL_GIT_COMMIT_REF`     | Git branch name              | `"main"`                                     |
| `VERCEL_GIT_COMMIT_MESSAGE` | Commit message               | `"fix: update..."`                           |
| `VERCEL_GIT_PROVIDER`       | Git provider                 | `"github"`                                   |
| `VERCEL_GIT_REPO_SLUG`      | Repository name              | `"my-app"`                                   |
| `VERCEL_GIT_REPO_OWNER`     | Repository owner             | `"my-org"`                                   |

## Vercel CLI Commands

```bash
vercel link            # Link to Vercel project
vercel dev             # Local development
vercel build           # Local build
vercel                 # Deploy to preview
vercel --prod          # Deploy to production
vercel env pull        # Pull env vars to .env.local
vercel env add KEY     # Add environment variable
vercel env ls          # List environment variables
vercel env rm KEY      # Remove environment variable
vercel ls              # List deployments
vercel inspect <url>   # Inspect deployment details
vercel promote <url>   # Promote preview to production
vercel logs <url>      # View deployment logs
vercel domains ls      # List domains
vercel domains add     # Add custom domain
```

## Runtime Comparison

| Feature             | Node.js (default)           | Edge                                 |
| ------------------- | --------------------------- | ------------------------------------ |
| Deployment          | Single/multi region         | Global (closest to user)             |
| Cold starts         | Higher (mitigated by Fluid) | Near-zero                            |
| API access          | Full Node.js                | Web Standards only                   |
| Code size           | 250 MB                      | 1-4 MB (by plan)                     |
| Duration            | Plan-based maxDuration      | 25s initial response, 300s streaming |
| File system         | Yes (`/tmp` writable)       | No                                   |
| eval / new Function | Yes                         | No (security restriction)            |
| npm packages        | All                         | ES Modules only, no native deps      |

## Redirect/Rewrite Pattern Syntax

| Pattern                 | Matches            | Example                               |
| ----------------------- | ------------------ | ------------------------------------- |
| `/path`                 | Exact path         | `/about`                              |
| `/:param`               | Named parameter    | `/users/:id` matches `/users/123`     |
| `/:param*`              | Wildcard (0+)      | `/blog/:path*` matches `/blog/a/b/c`  |
| `/(regex)`              | Regex group        | `/post/:id(\\d+)` matches digits only |
| `/:path((?!prefix/).*)` | Negative lookahead | Exclude paths starting with prefix    |
