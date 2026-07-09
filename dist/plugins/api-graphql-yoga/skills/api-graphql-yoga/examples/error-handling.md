# Error Handling

> Error masking, intentional GraphQLError, custom masking, development mode. Referenced from [SKILL.md](../SKILL.md).

---

## Pattern 1: Default Error Masking

Yoga masks all unexpected errors by default. Clients see a generic "Unexpected error." message -- internals (DB errors, stack traces) never leak.

```typescript
import { createYoga, createSchema } from "graphql-yoga";

const schema = createSchema({
  typeDefs: /* GraphQL */ `
    type Query {
      secretData: String!
    }
  `,
  resolvers: {
    Query: {
      secretData: () => {
        // This error message will NOT reach the client
        throw new Error("Connection to database failed: password incorrect");
      },
    },
  },
});

// Client receives:
// { "errors": [{ "message": "Unexpected error." }], "data": null }
```

**Why good:** sensitive information (connection strings, passwords, internal paths) never reaches clients

---

## Pattern 2: Intentional Client-Facing Errors with GraphQLError

Throw `GraphQLError` (imported from `graphql`, NOT `graphql-yoga`) to bypass masking and send structured errors to clients.

```typescript
import { GraphQLError } from "graphql";

const NOT_FOUND_CODE = "USER_NOT_FOUND";
const FORBIDDEN_CODE = "FORBIDDEN";
const VALIDATION_CODE = "VALIDATION_ERROR";

// Simple error with code extension
throw new GraphQLError("User not found", {
  extensions: { code: NOT_FOUND_CODE },
});

// Error with multiple extensions
throw new GraphQLError("You do not have permission to access this resource", {
  extensions: {
    code: FORBIDDEN_CODE,
    requiredRole: "admin",
    currentRole: "viewer",
  },
});

// Validation error with field details
throw new GraphQLError("Invalid input", {
  extensions: {
    code: VALIDATION_CODE,
    fields: {
      email: "Invalid email format",
      name: "Name is required",
    },
  },
});
```

**Why good:** `GraphQLError` from `graphql` bypasses masking, extensions carry machine-parseable error codes for client-side `switch` handling

```typescript
// Bad: importing GraphQLError from wrong package
import { GraphQLError } from "graphql-yoga"; // Wrong package

// Bad: throwing plain Error expecting client to see message
throw new Error("User not found"); // Will be masked to "Unexpected error."
```

**Why bad:** `GraphQLError` must come from `graphql` package; plain `Error` is always masked in production

---

## Pattern 3: Custom Error Masking

Override the default masking behavior for selective error exposure.

```typescript
import { createYoga, maskError } from "graphql-yoga";

const yoga = createYoga({
  schema,
  maskedErrors: {
    maskError(error, message, isDev) {
      // Let downstream service errors through
      if (error?.extensions?.code === "DOWNSTREAM_SERVICE_ERROR") {
        return error;
      }
      // Use default masking for everything else
      return maskError(error, message, isDev);
    },
  },
});
```

**Why good:** selective exposure without disabling masking entirely, `maskError` fallback preserves safe defaults

---

## Pattern 4: Development Mode

Set `NODE_ENV=development` to see original error messages and stack traces in extensions -- without disabling masking in production.

```typescript
// In development (NODE_ENV=development):
// {
//   "errors": [{
//     "message": "Connection failed",
//     "extensions": {
//       "originalError": {
//         "message": "Connection failed",
//         "stack": "Error: Connection failed\n    at ..."
//       }
//     }
//   }]
// }

// In production (NODE_ENV=production):
// { "errors": [{ "message": "Unexpected error." }] }
```

---

## Pattern 5: Disabling Masking (Use Cautiously)

```typescript
const yoga = createYoga({
  schema,
  maskedErrors: false, // ALL errors pass through, including stack traces
});
```

**When to use:** Internal-only APIs behind a VPN where all consumers are trusted. Never for public-facing APIs.

**Why cautious:** `maskedErrors: false` exposes stack traces, database errors, and internal paths to any client -- use custom `maskError` for selective exposure instead.
