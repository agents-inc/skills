# Turborepo CI - Remote Cache Examples

> Remote Cache setup, self-hosted options, signature verification, and cache permission tuning. See [SKILL.md](../SKILL.md) for core concepts and [core.md](core.md) for turbo.json task configuration.

---

## Pattern 1: Vercel Remote Cache Setup

### Local Development

```bash
# Authenticate with Vercel account
turbo login

# For SSO-enabled teams
turbo login --sso-team=my-team

# Link local repo to Remote Cache
turbo link

# Verify: delete local cache and rebuild
rm -rf .turbo/cache
turbo run build
# Should download from Remote Cache instead of rebuilding
```

### CI Environment

```bash
# Set as CI secrets (not in turbo.json)
TURBO_TOKEN=<vercel-token>
TURBO_TEAM=<team-slug>

# That's it -- turbo auto-detects and uses Remote Cache
turbo run build test lint
```

**Why good:** Two environment variables enable Remote Cache across all CI runs. No turbo.json changes needed. Vercel-hosted projects get this automatically.

---

## Pattern 2: Self-Hosted Remote Cache

### Environment Variables

```bash
# Point to custom Remote Cache server
TURBO_API=https://cache.internal.example.com
TURBO_TOKEN=<server-auth-token>
TURBO_TEAM=my-team
```

### Manual Login for Self-Hosted

```bash
# Authenticate with custom server
turbo login --manual

# Enter the URL and token when prompted
```

**Community implementations:**

- `ducktors/turborepo-remote-cache` -- Node.js, supports S3/GCS/Azure Blob storage
- `brunojppb/turbo-cache-server` -- Lightweight Rust implementation

---

## Pattern 3: Signature Verification

### Enable in turbo.json

```jsonc
{
  "remoteCache": {
    "signature": true,
  },
}
```

### Set Signing Key

```bash
# Set as CI secret -- HMAC-SHA256 key
TURBO_REMOTE_CACHE_SIGNATURE_KEY=<your-secret-key>
```

**Behavior:**

- Artifacts are signed on upload with HMAC-SHA256
- Signature verified on download
- Failed verification = treated as cache miss (task re-executes)
- Missing key = all Remote Cache reads fail silently (treated as misses)

**When to enable:** Shared caches where multiple teams or CI systems push artifacts. Prevents tampered artifacts from being served to other consumers.

---

## Pattern 4: Cache Permission Tuning

### Read-Only Remote Cache in CI

```bash
# CI reads from Remote Cache but doesn't push (prevents CI from overwriting known-good cache)
turbo run build --cache=local:rw,remote:r
```

### Local-Only for Debugging

```bash
# Disable Remote Cache for this run (debug local behavior)
turbo run build --cache=local:rw,remote:off
```

### Full Control

```bash
# Default behavior (read + write to both)
turbo run build --cache=local:rw,remote:rw

# No caching at all
turbo run build --cache=off

# Remote read-only, no local cache
turbo run build --cache=local:off,remote:r
```

---

## Pattern 5: Remote Cache Configuration in turbo.json

```jsonc
{
  "remoteCache": {
    "enabled": true,
    "signature": false,
    "preflight": false,
    "timeout": 30,
    "uploadTimeout": 60,
  },
}
```

| Key             | Default | Purpose                                 |
| --------------- | ------- | --------------------------------------- |
| `enabled`       | `true`  | Toggle Remote Cache                     |
| `signature`     | `false` | HMAC-SHA256 artifact signing            |
| `preflight`     | `false` | Send preflight request before cache ops |
| `timeout`       | `30`    | Download timeout in seconds             |
| `uploadTimeout` | `60`    | Upload timeout in seconds               |

**When to increase timeouts:** Large monorepos with many packages produce large cache artifacts. If CI logs show timeout errors during cache upload/download, increase these values.
