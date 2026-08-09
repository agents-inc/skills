# Netlify Quick Reference

## Netlify CLI Commands

### Development

```bash
# Start local dev server (functions + edge functions)
netlify dev

# Dev with mock geo data (default: San Francisco, CA)
netlify dev --geo=mock

# Dev with specific country mock
netlify dev --geo=mock --country=FR

# Invoke a function manually (useful for scheduled/background)
netlify functions:invoke function-name

# Create a new function from template
netlify functions:create function-name

# Build locally (test build plugins and output)
netlify build
```

### Deployment

```bash
# Deploy a preview (returns a unique preview URL)
netlify deploy

# Deploy to production
netlify deploy --prod

# Deploy a specific directory
netlify deploy --dir=dist --prod
```

### Environment Variables

```bash
# Set an env var (all contexts, all scopes)
netlify env:set API_KEY "value"

# Set for specific context
netlify env:set API_KEY "staging-value" --context deploy-preview

# Set for specific scope
netlify env:set API_KEY "value" --scope functions

# List all env vars
netlify env:list

# Get a specific env var
netlify env:get API_KEY

# Delete an env var
netlify env:unset API_KEY
```

### Site Management

```bash
# Link local directory to Netlify site
netlify link

# Unlink
netlify unlink

# Open site in browser
netlify open

# Open site admin in browser
netlify open:admin

# Check site status
netlify status
```

---

## Function Limits

| Type                  | Execution Time | Memory | Request Payload | Response Payload   |
| --------------------- | -------------- | ------ | --------------- | ------------------ |
| Serverless (buffered) | 60s            | 1 GB   | 6 MB            | 6 MB               |
| Serverless (streamed) | 60s            | 1 GB   | 6 MB            | 20 MB              |
| Background            | 15 min         | 1 GB   | 256 KB          | N/A (202 returned) |
| Scheduled             | 60s            | 1 GB   | N/A             | N/A                |
| Edge                  | 50ms CPU       | 512 MB | N/A             | N/A                |

**Edge function notes:**

- CPU time excludes I/O waiting (fetch, Blobs reads)
- Response header timeout: 40 seconds
- Code size limit: 20 MB (after compression)
- Cached responses do not count toward invocation limits

---

## Redirect Syntax

### Basic Redirects

```toml
# Permanent redirect (301)
[[redirects]]
  from = "/old-page"
  to = "/new-page"
  status = 301

# Temporary redirect (302)
[[redirects]]
  from = "/temp"
  to = "/new-temp"
  status = 302

# Rewrite (200) — URL stays the same, content served from target
[[redirects]]
  from = "/app/*"
  to = "/index.html"
  status = 200
```

### Proxy Rewrites

```toml
# Proxy to external API (avoids CORS)
[[redirects]]
  from = "/api/*"
  to = "https://api.example.com/:splat"
  status = 200
  force = true

  # Custom headers sent to the proxied destination
  [redirects.headers]
    X-Api-Key = "your-api-key"
```

### Conditional Redirects

```toml
# Country-based
[[redirects]]
  from = "/*"
  to = "/fr/:splat"
  status = 302
  conditions = { Country = ["FR"] }

# Language-based
[[redirects]]
  from = "/*"
  to = "/es/:splat"
  status = 302
  conditions = { Language = ["es"] }

# Role-based (requires Netlify Identity)
[[redirects]]
  from = "/admin/*"
  to = "/login"
  status = 302
  conditions = { Role = ["admin"] }
  force = true
```

### Redirect Placeholders

| Placeholder  | Description             | Example                                                 |
| ------------ | ----------------------- | ------------------------------------------------------- |
| `:splat`     | Wildcard match from `*` | `/api/*` -> `/:splat` captures everything after `/api/` |
| `:paramName` | Named capture           | `/users/:id` -> captures `id`                           |

---

## Custom Headers Syntax

```toml
# Security headers for all pages
[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "camera=(), microphone=(), geolocation=()"

# Cache static assets aggressively
[[headers]]
  for = "/assets/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

# No-cache for HTML pages
[[headers]]
  for = "/*.html"
  [headers.values]
    Cache-Control = "public, max-age=0, must-revalidate"

# Multi-value header (use triple quotes)
[[headers]]
  for = "/*"
  [headers.values]
    Content-Security-Policy = """
      default-src 'self';
      script-src 'self' 'unsafe-inline';
      style-src 'self' 'unsafe-inline';
      img-src 'self' data: https:"""
```

---

## Build Plugin Structure

Custom build plugins run Node.js code at specific points in the build lifecycle.

```
my-plugin/
├── index.js          # Plugin logic with lifecycle hooks
└── manifest.yml      # Plugin metadata and inputs
```

### manifest.yml

```yaml
name: my-custom-plugin
inputs:
  - name: threshold
    description: Performance score threshold
    default: 90
    required: false
```

### index.js

```javascript
// Available lifecycle hooks (in execution order):
// onPreBuild, onBuild, onPostBuild, onSuccess, onError, onEnd
export const onPreBuild = ({ inputs, utils, netlifyConfig }) => {
  console.log(`Threshold: ${inputs.threshold}`);
};

export const onPostBuild = ({ constants, utils }) => {
  // constants.PUBLISH_DIR — the publish directory
  // constants.FUNCTIONS_SRC — the functions source directory
  // utils.build.failBuild("message") — fail the build
  // utils.build.failPlugin("message") — fail just this plugin
  // utils.run.command("npm test") — run a shell command
  // utils.cache.save/restore — cache files between builds
};

export const onSuccess = () => {
  console.log("Build succeeded!");
};

export const onError = ({ error }) => {
  console.error("Build failed:", error.message);
};
```

### netlify.toml Registration

```toml
# Local plugin (from repo)
[[plugins]]
  package = "./my-plugin"

  [plugins.inputs]
    threshold = 85

# npm plugin
[[plugins]]
  package = "@netlify/plugin-lighthouse"

# Context-specific plugin config
[context.production]
  [[context.production.plugins]]
    package = "@netlify/plugin-lighthouse"
    [context.production.plugins.inputs]
      output_path = "reports/"
```

---

## Environment Variable Scopes

| Scope     | Available In                         |
| --------- | ------------------------------------ |
| Builds    | Site builds, build plugins           |
| Functions | Serverless functions, Edge functions |
| (Both)    | Default — available everywhere       |

### Context Overrides

| Context          | Applies To                         |
| ---------------- | ---------------------------------- |
| `production`     | Published production deploys       |
| `deploy-preview` | PR/MR deploy previews              |
| `branch-deploy`  | Non-production branch deploys      |
| `dev`            | Local `netlify dev`                |
| `branch-name`    | Specific branch (highest priority) |

### Access Patterns

```typescript
// In serverless functions and edge functions
const value = Netlify.env.get("MY_VAR");
const exists = Netlify.env.has("MY_VAR");
const all = Netlify.env.toObject();

// In build plugins
const value = process.env.MY_VAR; // Standard Node.js in build context
```

---

## File Structure

```
project-root/
├── netlify.toml                    # All Netlify configuration
├── netlify/
│   ├── functions/                  # Serverless functions
│   │   ├── hello.mts              # Direct file
│   │   ├── items.mts              # API endpoint
│   │   ├── daily-report.mts       # Scheduled function
│   │   └── process-background.mts # Background function (-background suffix)
│   └── edge-functions/             # Edge functions (Deno)
│       ├── geo-redirect.ts
│       └── auth-guard.ts
├── .netlify/
│   └── blobs/
│       └── deploy/                 # File-based blob uploads (build time)
└── public/                         # or dist/ — published static files
```
