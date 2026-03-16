# Naming Conventions and Templates

> Framework-specific naming and .env.example documentation patterns. See [SKILL.md](../SKILL.md) for core concepts and [core.md](core.md) for essential patterns.

**Related Examples:**

- [core.md](core.md) - Per-app .env, Zod validation
- [security-and-secrets.md](security-and-secrets.md) - Secret management
- [feature-flags-and-config.md](feature-flags-and-config.md) - Feature flags, centralized config

---

## Framework-Specific Naming Conventions

### Good Example - Framework-specific prefixes

```bash
# apps/client-next/.env

# Client-side variables (embedded in bundle)
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
NEXT_PUBLIC_ANALYTICS_ID=UA-123456789-1
NEXT_PUBLIC_ENVIRONMENT=development
NEXT_PUBLIC_FEATURE_NEW_DASHBOARD=true

# Server-side variables (not exposed to client)
DATABASE_URL=postgresql://localhost:5432/mydb
API_SECRET_KEY=super-secret-key-12345
STRIPE_SECRET_KEY=sk_test_...
JWT_SECRET=jwt-secret-key
```

**Why good:** NEXT*PUBLIC*\* prefix makes client-side variables explicit preventing accidental secret exposure, server-side variables never embedded in bundle, clear separation improves security

### Bad Example - Missing prefixes and poor naming

```bash
# .env

# No framework prefix - unclear if client-side
API_URL=http://localhost:3000/api/v1

# Inconsistent casing
apiUrl=https://api.example.com
Database_Url=postgresql://localhost/db

# Unclear names
URL=https://api.example.com
KEY=12345
FLAG=true
```

**Why bad:** Missing framework prefix makes it unclear if variable is client-side or server-side, inconsistent casing reduces readability, unclear names make purpose ambiguous

---

## .env.example Templates

### Good Example - Comprehensive .env.example

```bash
# .env.example

# ================================================================
# IMPORTANT: Copy this file to .env and fill in the values
# ================================================================
# cp .env.example .env

# ====================================
# API Configuration (Required)
# ====================================

# Base URL for API requests
# Development: http://localhost:3000/api/v1
# Production: https://api.example.com/api/v1
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1

# API request timeout in milliseconds (optional, default: 30000)
# Range: 1000-60000
NEXT_PUBLIC_API_TIMEOUT_MS=30000

# Number of retry attempts (optional, default: 3)
NEXT_PUBLIC_API_RETRY_ATTEMPTS=3

# ====================================
# Database Configuration (Server-side)
# ====================================

# PostgreSQL connection string (required for server)
# Format: postgresql://username:password@host:port/database
DATABASE_URL=

# Database pool size (optional, default: 10)
DATABASE_POOL_SIZE=10

# ====================================
# Feature Flags (Optional)
# ====================================

# Enable new dashboard (default: false)
NEXT_PUBLIC_FEATURE_NEW_DASHBOARD=false

# ====================================
# Third-Party Services (Optional)
# ====================================

# Stripe public key
# Get from: https://dashboard.stripe.com/apikeys
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=

# Stripe secret key (server-side only)
# WARNING: NEVER commit this to version control
STRIPE_SECRET_KEY=
```

**Why good:** Grouped related variables for easy navigation, comments explain purpose and format reducing onboarding friction, example values show expected format, links to third-party services speed up setup

### Bad Example - Poor .env.example

```bash
# .env.example

NEXT_PUBLIC_API_URL=
DATABASE_URL=
STRIPE_SECRET_KEY=
```

**Why bad:** No comments explaining purpose or format, no grouping makes it hard to find related variables, no example values leaving developers guessing, no links to get third-party keys
