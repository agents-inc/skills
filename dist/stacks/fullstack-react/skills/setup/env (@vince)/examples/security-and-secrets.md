# Security and Secrets Management

> Patterns for secure secret handling. See [SKILL.md](../SKILL.md) for core concepts and [core.md](core.md) for essential patterns.

**Related Examples:**

- [core.md](core.md) - Per-app .env, Zod validation
- [naming-and-templates.md](naming-and-templates.md) - Framework prefixes, .env.example
- [feature-flags-and-config.md](feature-flags-and-config.md) - Feature flags, centralized config

---

## Secret Management

### Good Example - Comprehensive .gitignore

```gitignore
# .gitignore

# Environment files
.env.local
.env.*.local

# Optional: ignore all .env files except example
# .env
# !.env.example

# Sensitive files
*.key
*.pem
*.p12
*.pfx
```

**Why good:** .env.local and .env._.local patterns prevent committing local secrets, sensitive file extensions (_.key, \*.pem) prevent accidental key commits, optional .env ignore with !.env.example allows flexibility

### Bad Example - Secrets committed to repository

```bash
# .env (committed with actual secrets)
DATABASE_URL=postgresql://admin:SuperSecret123@prod.example.com:5432/mydb
STRIPE_SECRET_KEY=sk_live_actual_secret_key
JWT_SECRET=my-production-jwt-secret

# Committed to git = security breach!
```

**Why bad:** Committing secrets to git exposes them permanently in history, anyone with repo access can extract production credentials, secret rotation requires coordinating with all developers

---

## Secret Distribution Patterns

### Good Example - CI/CD Secret Management

```yaml
# .github/workflows/deploy.yml
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          STRIPE_SECRET_KEY: ${{ secrets.STRIPE_SECRET_KEY }}
        run: |
          # Secrets available as environment variables
          npm run deploy
```

**Why good:** Secrets stored in CI/CD provider (GitHub Secrets, Vercel), never committed to repository, access controlled by repository permissions, easy to rotate without code changes

### Bad Example - Sharing secrets via chat

```
# Slack message (NEVER DO THIS)
Hey team, here's the database password: SuperSecret123
Just copy it into your .env file
```

**Why bad:** Secrets in chat logs are permanent and searchable, no access control or audit trail, impossible to rotate without coordinating with everyone, violates security compliance requirements

---

## Secret Rotation Checklist

When rotating secrets:

1. Generate new secret in the service dashboard
2. Update CI/CD secrets (GitHub, Vercel, etc.)
3. Deploy with new secret
4. Verify application works with new secret
5. Revoke old secret in service dashboard
6. Never store old secrets "just in case"
