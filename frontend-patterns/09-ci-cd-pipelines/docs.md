# 09. CI/CD Pipelines

> **Quick Guide:** Pipeline setup? See §9.1. Affected detection? See §9.2. Remote caching? See §9.3. Quality gates? See §9.4.

## 9.1 Pipeline Configuration

- CI platform (GitHub Actions, GitLab CI, CircleCI)
- Workflow structure
- Job dependencies
- Caching strategies

## 9.2 Affected Detection

- How changes are detected (git diff, Turborepo filter)
- Filter strategies (--filter=[HEAD^1])
- Optimization for monorepos
- Only building/testing changed packages

## 9.3 Remote Caching

- Cache provider (Vercel, S3, custom)
- Authentication
- Cache hit optimization
- Cache invalidation strategies

## 9.4 Quality Gates

- Required checks before merge:
  - All tests pass
  - Coverage thresholds met
  - No linting errors
  - No TypeScript errors
  - Build succeeds
- Automated vs manual gates

## 9.5 Deployment Workflows

- Branch deployment strategy (main → prod, develop → staging)
- Environment promotion
- Rollback procedures
- Preview deployments for PRs
