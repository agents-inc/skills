# Configurable Source: Edge Cases & Potential Issues

> **Purpose**: Comprehensive analysis of why the "simple configurable source" approach might fail
> **Created**: 2026-01-21
> **Status**: Research Complete

---

## Proposed Solution

```bash
# Simple: just override the default source URL
cc init --source github.com/mycompany/private-skills

# Or via config
# ~/.claude-collective/config.yaml
source: github.com/mycompany/private-skills
```

Authentication via environment variables (`GITHUB_TOKEN`, `GIGET_AUTH`, etc.)

---

## Executive Summary

### CRITICAL BLOCKERS (Must solve or document as unsupported)

| Issue | Severity | Workaround |
|-------|----------|------------|
| **Private Bitbucket repos broken** | CRITICAL | None - giget bug |
| **GitLab subgroups broken** | CRITICAL | Use full HTTPS URL |
| **Bitbucket Server (self-hosted) not supported** | CRITICAL | None |
| **Azure DevOps not supported** | CRITICAL | None |
| **Node 20+ proxy bug in giget** | HIGH | Set `FORCE_NODE_FETCH=true` |

### HIGH PRIORITY (Will cause significant friction)

| Issue | Severity | Mitigation |
|-------|----------|------------|
| Cryptic error messages | HIGH | Custom error wrapper |
| GitHub 404 masquerade (private repo = 404) | HIGH | Pre-flight auth check |
| Token in shell config security concerns | HIGH | Document alternatives |
| Self-signed SSL certificates | HIGH | Document `NODE_EXTRA_CA_CERTS` |
| No retry logic in giget | HIGH | Accept or fork giget |

### MEDIUM PRIORITY (Enterprise friction)

| Issue | Severity | Mitigation |
|-------|----------|------------|
| Corporate proxy authentication | MEDIUM | Documentation |
| Credential manager integration | MEDIUM | Script wrappers |
| Air-gapped environments | MEDIUM | Cache seeding docs |
| Multi-account token conflicts | MEDIUM | Namespaced env vars |

---

## Research Areas

### 1. Authentication & Security Concerns

#### 1.1 Token Storage Concerns

**Shell Configuration Risks:**
- Tokens in `~/.zshrc`, `~/.bashrc`, or `~/.profile` are readable by any process running as the user
- Shell history may log `export GITHUB_TOKEN=...` commands (security leak)
- Backup tools (Time Machine, rsync, cloud sync) may capture shell config files containing tokens
- Shared machines (pair programming, conference demos) expose tokens to other users via `env` or `printenv`
- SSH into shared servers means tokens persist in shell configs accessible to other users
- dotfiles repos (common among developers) may accidentally commit tokens

**Token Leakage Vectors:**
- Process inspection: Other processes can read environment variables via `/proc/[pid]/environ` on Linux
- Error logs: Stack traces and crash dumps may capture environment variables
- Child process inheritance: All spawned processes inherit the token
- IDE/editor plugins: May log or transmit environment variables for debugging
- `npm install` scripts: Malicious packages could exfiltrate environment variables (supply chain attack)

**CI/CD Token Injection:**
- GitHub Actions: Use `secrets.GITHUB_TOKEN` or repository/organization secrets
- GitLab CI: Use masked CI/CD variables with `protected` flag
- **Edge case**: Fork PRs in public repos cannot access secrets (security feature, but breaks private repo fetching)

**Docker Container Considerations:**
- `docker run -e GITHUB_TOKEN=...` exposes token in `docker inspect`
- Multi-stage builds may leak tokens in intermediate layers
- Docker build logs capture `ARG` values (use `--secret` instead in Docker 18.09+)

#### 1.2 Token Scope & Permission Issues

**GitHub Token Scope Requirements:**
- `repo` scope: Full private repository access (too broad for just reading)
- Fine-grained tokens (2022+): Can scope to specific repositories
  - `contents: read` - Minimum for fetching
  - `metadata: read` - Required for repository visibility checks
- **Problem**: Classic tokens are all-or-nothing; if leaked, full repo access is compromised

**Token Expiration Edge Cases:**
- GitHub fine-grained tokens: Configurable expiration (7 days to 1 year)
- Classic tokens: No expiration unless manually set
- **Failure mode**: CLI silently fails when token expires; error message may be cryptic ("401 Unauthorized")
- **User confusion**: Token worked yesterday, fails today with no clear reason

#### 1.3 Corporate Security Policies

**Token Storage Prohibitions:**
- Many companies prohibit storing secrets in shell configuration files
- Security audits flag `grep -r "TOKEN\|SECRET\|PASSWORD" ~/` as compliance violations
- SOX compliance: Requires audit trails for credential access
- PCI-DSS: Prohibits storing secrets in plaintext on workstations

**Credential Manager Integration Challenges:**
- 1Password CLI (`op`): Requires biometric/password for each session
- macOS Keychain: `security find-generic-password` works but is macOS-specific
- Windows Credential Manager: PowerShell-only access, not portable to WSL
- **Problem**: giget doesn't support credential helpers natively; requires wrapper

**Enterprise Single Sign-On (SSO/SAML) Issues:**
- GitHub Enterprise with SAML: Personal Access Tokens must be SSO-authorized
- **Edge case**: Token created before SSO enforcement becomes invalid
- **Problem**: CLI can't prompt for SSO re-authentication interactively

#### 1.4 Multi-Account Scenarios

**Personal vs Work Account Conflicts:**
- Developer has `personal@gmail.com` GitHub and `work@company.com` GitHub
- Only one `GITHUB_TOKEN` can be set at a time
- **Edge case**: Token for wrong account silently fails with 404 (repo not found, not 403 unauthorized)
- **User confusion**: "I can see the repo in my browser but CLI says not found"

#### 1.5 Failure Mode Catalog

| Scenario | Error Message | User Experience |
|----------|---------------|-----------------|
| Token not set | Connection refused / 401 | Cryptic error |
| Token expired | 401 Unauthorized | Looks like wrong token |
| Token wrong scope | 403 Forbidden | Confusing |
| Token for wrong account | 404 Not Found | Very confusing |
| SSO not authorized | 403 with SSO message | Requires browser action |
| VPN blocking | Timeout | Looks like network issue |
| Rate limited | 429 Too Many Requests | Temporary |

---

### 2. Enterprise/Corporate Environment Issues

#### 2.1 Network Restrictions

**Corporate Proxy Issues:**
- giget uses `node-fetch-native/proxy` which respects `HTTP_PROXY` and `HTTPS_PROXY`
- **CRITICAL BUG**: Node 20's built-in `fetch` (undici) does NOT support traditional proxy configuration
- **Workaround**: Set `FORCE_NODE_FETCH=true` to force giget to use node-fetch instead

| Scenario | Detection | Failure Mode |
|----------|-----------|--------------|
| Proxy requires authentication | HTTP 407 response | Token sent to wrong server |
| Proxy uses NTLM/Kerberos auth | Connection hangs | node-fetch doesn't support NTLM |
| Proxy terminates SSL (MITM) | Certificate error | Self-signed proxy cert rejected |
| Proxy has IP allowlist | Connection refused | GitHub IPs not whitelisted |

**Air-Gapped Environments:**
- CLI cannot fetch from any external URL
- No network fallback possible - cache is the ONLY option
- Initial bootstrap is impossible without manual intervention
- **Required**: Pre-seeded cache documentation, offline-only mode

**VPN Split Tunneling:**
- Full-tunnel VPN causes slow downloads, timeouts
- VPN drops during download = corrupted tarball
- VPN reconnects mid-operation = different exit IP, rate limit issues

#### 2.2 Self-Hosted Git Servers

**GitHub Enterprise Server:**
- **Supported** via `GIGET_GITHUB_URL` environment variable
- Self-signed certificates require `NODE_EXTRA_CA_CERTS=/path/to/ca.pem`

**GitLab Self-Managed:**
- **Partially Supported** via `GIGET_GITLAB_URL`
- Known issues with environment variable not being read correctly

**Bitbucket Data Center:**
- **NOT SUPPORTED** - No environment variable exists
- Different API structure from Bitbucket Cloud

**Self-Signed SSL Certificates:**
- **DANGEROUS workaround**: `NODE_TLS_REJECT_UNAUTHORIZED=0` (disables ALL verification)
- **Secure alternative**: `NODE_EXTRA_CA_CERTS=/path/to/corporate-ca.pem`

#### 2.3 Corporate IT Policies

**Mandatory Credential Managers:**
| System | Integration Complexity |
|--------|----------------------|
| CyberArk Conjur | HIGH - Requires SDK |
| HashiCorp Vault | MEDIUM - CLI available |
| AWS Secrets Manager | MEDIUM - AWS SDK required |
| 1Password for Business | LOW - CLI available |

**No Personal Tokens Policy:**
- Company policy may prohibit personal access tokens
- Single service account token shared across team (security risk)
- Token tied to service account, not individual (audit trail issues)

#### 2.4 Compliance Requirements

**SOC 2 Audit Trail:**
- All access to data must be logged
- CLI should not log tokens (security risk)
- Token usage should be auditable on the git server side

**GDPR Data Residency:**
- Skills repository may need to be hosted in EU region
- GitHub.com servers are primarily US-based
- Self-hosted is the only guaranteed solution

**FedRAMP (Government Contractors):**
- GitHub Enterprise Cloud has FedRAMP authorization
- GitHub.com (free tier) does NOT have FedRAMP authorization

---

### 3. Git Hosting Platform Differences

#### 3.1 giget Supported Providers

| Platform | giget Format | Self-Hosted | Private Repos |
|----------|-------------|-------------|---------------|
| **GitHub** | `gh:org/repo` | YES (`GIGET_GITHUB_URL`) | YES |
| **GitLab** | `gitlab:org/repo` | PARTIAL | YES |
| **Bitbucket** | `bitbucket:org/repo` | NO | **BROKEN** |
| **Sourcehut** | `sourcehut:user/repo` | N/A | Unknown |
| **Azure DevOps** | NOT SUPPORTED | N/A | N/A |
| **AWS CodeCommit** | NOT SUPPORTED | N/A | N/A |
| **Gitea/Forgejo** | NOT SUPPORTED | N/A | N/A |

#### 3.2 Critical Platform Bugs

**Private Bitbucket Repos - BROKEN:**
- Bitbucket's archive download endpoint does not support repository access tokens
- giget sends Bearer token but Bitbucket rejects it
- **No workaround** - fundamental limitation

**GitLab Subgroups - BROKEN:**
- `gitlab:group/subgroup/project` incorrectly parsed
- Generates wrong URL: `gitlab.com/group/subgroup/-/archive/` instead of `gitlab.com/group/subgroup/project/-/archive/`
- **Workaround**: Use full HTTPS URL instead of shorthand

**Azure DevOps - NOT SUPPORTED:**
- Azure DevOps restricts downloads to ZIP format only
- giget expects TAR.GZ archives
- Would require custom provider implementation

#### 3.3 Authentication Differences

| Platform | Token Type | Env Var | Notes |
|----------|-----------|---------|-------|
| GitHub | PAT (Classic or Fine-grained) | `GIGET_AUTH` | Fine-grained needs Contents+Metadata |
| GitLab | Personal/Project/Group Access Token | `GIGET_AUTH` | `read_repository` scope |
| Bitbucket | App Passwords | N/A | **DOESN'T WORK** for archives |

#### 3.4 What Will FAIL

| Use Case | Status |
|----------|--------|
| GitHub public repos | WORKS |
| GitHub private repos (with PAT) | WORKS |
| GitHub Enterprise | WORKS |
| GitLab public repos | WORKS |
| GitLab private repos | WORKS |
| GitLab self-hosted | PARTIAL |
| **GitLab subgroups** | **BROKEN** |
| Bitbucket public repos | WORKS |
| **Bitbucket private repos** | **BROKEN** |
| **Bitbucket self-hosted** | **NOT SUPPORTED** |
| **Azure DevOps** | **NOT SUPPORTED** |
| **AWS CodeCommit** | **NOT SUPPORTED** |
| Repos with Git LFS | **DATA LOSS** (pointers only) |
| Repos with submodules | **DATA LOSS** (not included) |

---

### 4. Developer Experience & Usability Issues

#### 4.1 First-Time Setup Pain

**Discovery Problem:**
- No upfront token requirement check
- User runs `cc init`, gets cryptic error 5 minutes later
- Token discovery is documentation-dependent
- Different env var names across tools (GITHUB_TOKEN vs GIGET_AUTH vs GH_TOKEN)

**"It Works On My Machine" Syndrome:**
- Token becomes "ambient knowledge" that existing team members forget they have
- New developers have no idea they need to configure anything

#### 4.2 Error Messages & Debugging

**GitHub's 404 Masquerade - CRITICAL:**
GitHub returns `404 Not Found` for private repositories when the user lacks access:
- Typo in URL = 404
- Missing token = 404
- Wrong token = 404
- Repo actually doesn't exist = 404

**Impossible to distinguish without pre-flight check.**

**What Users Will See vs What They Need:**
```
# What they see:
Error: Failed to download template

# What they need:
Error: Authentication required for private repository
       github.com/company/private-skills

       Set GIGET_AUTH environment variable with a GitHub token:
         export GIGET_AUTH=ghp_your_token_here

       Create a token at: https://github.com/settings/tokens
```

#### 4.3 Configuration Confusion

**Precedence (if implemented):**
1. Command-line flags (`--source`)
2. Environment variables (`GIGET_AUTH`)
3. Project config (`.claude/cc.yaml`)
4. Global config (`~/.config/claude-collective/config.yaml`)
5. Default values

**Missing: "Which Config Am I Using?"**
No command to show effective configuration.

#### 4.4 Shell-Specific Setup Pain

| Shell | Set Env Var | Config File |
|-------|-------------|-------------|
| Bash | `export VAR=value` | `~/.bashrc` |
| Zsh | `export VAR=value` | `~/.zshrc` |
| Fish | `set -gx VAR value` | Different syntax! |
| PowerShell | `$env:VAR = "value"` | Different syntax! |

#### 4.5 Accumulated Paper Cuts

1. No `--help` example for private repos
2. Silent assumption of HTTPS (no SSH URL support)
3. No progress indicator during download
4. No checksum verification
5. No retry on transient failures
6. Token not validated before use (runs for 30 seconds then fails)
7. No interactive token prompt option

---

### 5. Technical Implementation Challenges

#### 5.1 giget Limitations

**URI Parsing Issues:**
- GitLab subgroups not supported (regex only handles `org/repo`)
- Nested subdirectory paths may be incorrectly parsed

**Sparse Checkout:**
- giget downloads the **entire tarball** then filters during extraction
- For monorepos, this means downloading potentially gigabytes for a single subdirectory

**Symlink Handling:**
- Windows requires admin privileges to create symlinks
- node-tar has Windows symlink issues

#### 5.2 Caching Issues

**Cache Location:**
- Default: `~/.cache/giget` (or `XDG_CACHE_HOME/giget`)
- Windows: Had issues, now uses `AppData\Local\Temp`

**Cache Invalidation:**
- ETag-based checking via HEAD request
- **No TTL**: Cache never expires automatically
- Force refresh only via `forceClean: true` (deletes extraction target, not cache)

**Disk Space:**
- Each version cached separately (no deduplication)
- No cache size limit or cleanup mechanism

#### 5.3 Concurrent Access - NO FILE LOCKING

- giget does NOT implement file locking
- Multiple CLI instances can:
  - Write to same cache file simultaneously
  - Extract to same directory simultaneously
  - Corrupt tarball mid-download

#### 5.4 Network Reliability - NO RETRY LOGIC

- giget has **zero retry logic**
- Single failure = complete failure
- No configurable timeout
- No resume capability for partial downloads

#### 5.5 Cross-Platform Issues

**Windows:**
- Symlinks require admin privileges
- Case insensitivity can cause issues
- Path separator handling

**WSL2:**
- Cross-filesystem performance issues
- Case sensitivity differences between NTFS and ext4

**macOS:**
- HFS+ is case-insensitive by default (unlike Linux)

#### 5.6 Node.js Version Compatibility

- giget requires Node >= 18
- Node 20+ has different fetch behavior (undici vs node-fetch)
- Proxy support differs between Node versions

---

## Recommendations

### For MVP (Do Now)

1. **Document limitations clearly**: Bitbucket private repos don't work, Azure DevOps not supported
2. **Add `FORCE_NODE_FETCH=true` to docs**: Required for corporate proxies on Node 20+
3. **Custom error wrapper**: Map HTTP errors to helpful messages
4. **Pre-flight auth check**: Validate token before attempting download
5. **Support local path as source**: Bypasses all giget issues for offline/air-gapped

### For V2 (Future)

1. **`cc doctor` command**: Diagnose connectivity, auth, proxy issues
2. **`cc auth check` command**: Validate token scopes and expiration
3. **`cc config show` command**: Display effective configuration
4. **Interactive token prompt**: `cc auth login` flow
5. **Consider degit or direct git clone**: More reliable than giget for enterprise

### Accept as Unsupported

1. Private Bitbucket repos (giget bug, not our problem)
2. Azure DevOps (different archive format)
3. AWS CodeCommit (no provider)
4. Gitea/Forgejo (no provider)
5. SSH URLs (giget is HTTPS-only)

---

## Sources

- [giget GitHub Repository](https://github.com/unjs/giget)
- [giget Issue #104 - Bitbucket private repos broken](https://github.com/unjs/giget/issues/104)
- [giget Issue #107 - GitLab subgroups broken](https://github.com/unjs/giget/issues/107)
- [giget Issue #120 - Node 20 proxy issues](https://github.com/unjs/giget/issues/120)
- [giget Issue #186 - Azure DevOps not supported](https://github.com/unjs/giget/issues/186)
- [giget Issue #188 - Bitbucket Server not supported](https://github.com/unjs/giget/issues/188)
- [GitHub SSO Authorization Docs](https://docs.github.com/en/enterprise-cloud@latest/authentication/authenticating-with-single-sign-on)
- [GitLab Self-signed Certificates](https://docs.gitlab.com/runner/configuration/tls-self-signed/)
