# 10. Environment Management

> **Quick Guide:** File hierarchy? See §10.1. Naming conventions? See §10.2 (SCREAMING_SNAKE_CASE). Templates? See §10.3. Secrets? See §10.4.

## 10.1 File Hierarchy

- `.env.defaults` - Default values (committed)
- `.env` - Local overrides (gitignored)
- `.env.local` - Package-specific (gitignored)
- `.env.production` - Production values (in CI secrets)
- Loading order and precedence

## 10.2 Naming Conventions

- **Public variables:** `NEXT_PUBLIC_`, `VITE_`, `PUBLIC_`
- **Secret variables:** Never prefixed with public markers
- Consistent naming: `SCREAMING_SNAKE_CASE`
- Descriptive names

## 10.3 Template

- Maintain `.env.template` with all variables (no values)
- Documentation for each variable
- Required vs optional variables
- Onboarding process for new developers

## 10.4 Security

- Secret management (never commit secrets)
- Rotation strategies
- Access control
- Audit logging
