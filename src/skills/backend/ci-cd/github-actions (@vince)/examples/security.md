# GitHub Actions - Security Examples

> OIDC authentication and secrets rotation. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for decision frameworks.

**Additional Examples:**
- [core.md](core.md) - Pipeline config, jobs, caching basics
- [testing.md](testing.md) - Affected detection, quality gates
- [caching.md](caching.md) - Remote caching, Turborepo
- [deployment.md](deployment.md) - Multi-env, rollback
- [monitoring.md](monitoring.md) - Datadog, GitHub Insights

---

## Pattern 5: OIDC Authentication Examples

### AWS OIDC Authentication

```typescript
// aws-oidc-config.ts
export const AWS_OIDC_CONFIG = {
  ROLE_SESSION_NAME: "github-actions-deployment",
  ROLE_DURATION_SECONDS: 3600,
  AWS_REGION: "us-east-1",
} as const;
```

```yaml
# Good Example - AWS OIDC authentication (no access keys)
name: Deploy to AWS

on:
  push:
    branches: [main]

permissions:
  id-token: write # CRITICAL: Required for OIDC token
  contents: read

jobs:
  deploy-aws:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials via OIDC
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/GitHubActionsDeployRole
          role-session-name: github-actions-deployment
          aws-region: us-east-1
          # No AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY needed!

      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: 1.2.2

      - name: Build
        run: bun run build

      - name: Deploy to S3
        run: |
          aws s3 sync ./dist s3://my-production-bucket --delete

      - name: Invalidate CloudFront
        run: |
          aws cloudfront create-invalidation \
            --distribution-id EDFDVBD6EXAMPLE \
            --paths "/*"
```

**Why good:** No static AWS credentials to rotate or leak, temporary credentials auto-expire after 1 hour reducing blast radius, GitHub's OIDC token proves identity without secrets, auditable in AWS CloudTrail with GitHub metadata (repo commit SHA)

**Setup (AWS side):**

```bash
# 1. Create IAM OIDC identity provider
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1

# 2. Create IAM role with trust policy
```

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:your-org/your-repo:ref:refs/heads/main"
        }
      }
    }
  ]
}
```

```yaml
# Bad Example - Static AWS credentials (security risk)
jobs:
  deploy:
    steps:
      - name: Configure AWS
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }} # Long-lived secret
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }} # Never expires
          aws-region: us-east-1

      - name: Deploy
        run: aws s3 sync ./dist s3://bucket
```

**Why bad:** Static AWS credentials never expire creating permanent security risk, compromised credentials grant full access until manually rotated, no audit trail linking deployment to specific GitHub commit or actor, manual rotation burden often leads to credentials never being rotated

---

### Vercel Token Authentication

> **Note:** Vercel does not yet support OIDC authentication for GitHub Actions deployments. Token-less deployments via OIDC is an [open feature request](https://community.vercel.com/t/feature-request-token-less-github-actions-deployments-via-oidc/15908). Use static Vercel tokens stored in GitHub Secrets until OIDC support is available.

```yaml
# Good Example - Vercel token-based deployment
name: Deploy to Vercel

on:
  push:
    branches: [main]

jobs:
  deploy-vercel:
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://example.com

    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: 1.2.2

      - name: Install Vercel CLI
        run: bun add -g vercel

      - name: Pull Vercel Environment Information
        run: vercel pull --yes --environment=production --token=${{ secrets.VERCEL_TOKEN }}

      - name: Build Project Artifacts
        run: vercel build --prod --token=${{ secrets.VERCEL_TOKEN }}

      - name: Deploy to Vercel
        run: vercel deploy --prebuilt --prod --token=${{ secrets.VERCEL_TOKEN }}
```

**Why good:** Vercel token scoped to specific project limits blast radius, environment protection requires manual approval for production, prebuilt deployment separates build from deploy for consistency, url annotation links GitHub environment to live deployment

**Security best practices for Vercel tokens:**
- Generate project-scoped tokens (not account-level) at https://vercel.com/account/tokens
- Set token expiration (90 days recommended) and rotate before expiry
- Use GitHub environment secrets to isolate production tokens from preview deployments
- Consider storing in HashiCorp Vault or AWS Secrets Manager for automated rotation (see Pattern 6)

---

## Pattern 6: Automated Secrets Rotation Examples

### HashiCorp Vault Integration

```typescript
// vault-config.ts
export const VAULT_CONFIG = {
  VAULT_ADDR: process.env.VAULT_ADDR || "https://vault.example.com",
  VAULT_NAMESPACE: "production",
  SECRET_PATH_PREFIX: "secret/data/github-actions",
  TOKEN_TTL_SECONDS: 3600,
  TOKEN_RENEWABLE: true,
} as const;
```

```yaml
# Good Example - Fetch secrets from Vault at runtime
name: Deploy with Vault Secrets

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Import secrets from Vault
        uses: hashicorp/vault-action@v2
        with:
          url: https://vault.example.com
          method: jwt
          role: github-actions-role
          secrets: |
            secret/data/production/database DATABASE_URL ;
            secret/data/production/api API_KEY ;
            secret/data/production/vercel VERCEL_TOKEN

      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: 1.2.2

      - name: Build with secrets
        env:
          DATABASE_URL: ${{ env.DATABASE_URL }}
          API_KEY: ${{ env.API_KEY }}
        run: bun run build

      - name: Deploy
        env:
          VERCEL_TOKEN: ${{ env.VERCEL_TOKEN }}
        run: vercel deploy --prod
```

**Why good:** Secrets fetched at runtime always current (rotated in Vault propagates immediately), JWT authentication via OIDC means no static Vault tokens in GitHub, centralized secret management in Vault with audit logging, secrets never stored in GitHub reducing attack surface

---

### AWS Secrets Manager Rotation

```yaml
# Good Example - AWS Secrets Manager with automatic rotation
name: Deploy with AWS Secrets

on:
  push:
    branches: [main]

permissions:
  id-token: write
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials via OIDC
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/GitHubActionsRole
          aws-region: us-east-1

      - name: Retrieve secrets from AWS Secrets Manager
        run: |
          # Fetch database credentials (auto-rotated every 30 days)
          DB_SECRET=$(aws secretsmanager get-secret-value \
            --secret-id production/database \
            --query SecretString --output text)

          echo "DATABASE_URL=$(echo $DB_SECRET | jq -r .url)" >> $GITHUB_ENV
          echo "DATABASE_PASSWORD=$(echo $DB_SECRET | jq -r .password)" >> $GITHUB_ENV

          # Fetch API key
          API_KEY=$(aws secretsmanager get-secret-value \
            --secret-id production/api-key \
            --query SecretString --output text)

          echo "API_KEY=$API_KEY" >> $GITHUB_ENV

      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: 1.2.2

      - name: Build
        run: bun run build

      - name: Deploy
        run: bun run deploy
```

**Why good:** AWS Secrets Manager auto-rotates credentials on schedule (every 30 days), Lambda rotation function updates database passwords without manual intervention, OIDC authentication means no AWS keys to manage, secrets fetched just-in-time for each deployment minimizing exposure window

**Setup (AWS Secrets Manager rotation):**

```bash
# 1. Enable automatic rotation
aws secretsmanager rotate-secret \
  --secret-id production/database \
  --rotation-lambda-arn arn:aws:lambda:us-east-1:123456789012:function:RotateDatabasePassword \
  --rotation-rules AutomaticallyAfterDays=30
```

```yaml
# Bad Example - Static secrets in GitHub, never rotated
jobs:
  deploy:
    steps:
      - name: Deploy
        env:
          DATABASE_PASSWORD: ${{ secrets.DB_PASSWORD }} # Added 2 years ago, never rotated
          API_KEY: ${{ secrets.API_KEY }} # No rotation policy
        run: bun run deploy
```

**Why bad:** Static GitHub secrets never expire and rarely rotated in practice, compromised secrets remain valid indefinitely, no centralized audit trail of secret access, manual rotation process error-prone and often skipped
