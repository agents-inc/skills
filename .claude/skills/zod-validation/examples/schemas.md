# Zod Schema Examples

> Schema definition and composition patterns. See [SKILL.md](../SKILL.md) for core concepts.

---

## Schema Definition

### Good Example - Complete User Schema

```typescript
import { z } from "zod";

// Named constants for all validation limits
const MIN_USERNAME_LENGTH = 3;
const MAX_USERNAME_LENGTH = 30;
const MIN_PASSWORD_LENGTH = 8;
const MIN_AGE = 13;
const MAX_AGE = 120;
const MAX_BIO_LENGTH = 500;

// Reusable email schema
const EmailSchema = z
  .string()
  .email("Please enter a valid email address")
  .toLowerCase();

// Reusable password schema with refinements
const PasswordSchema = z
  .string()
  .min(
    MIN_PASSWORD_LENGTH,
    `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
  )
  .refine((pwd) => /[A-Z]/.test(pwd), {
    message: "Password must contain at least one uppercase letter",
  })
  .refine((pwd) => /[a-z]/.test(pwd), {
    message: "Password must contain at least one lowercase letter",
  })
  .refine((pwd) => /[0-9]/.test(pwd), {
    message: "Password must contain at least one number",
  });

// Complete user schema
const UserSchema = z.object({
  username: z
    .string()
    .min(
      MIN_USERNAME_LENGTH,
      `Username must be at least ${MIN_USERNAME_LENGTH} characters`,
    )
    .max(
      MAX_USERNAME_LENGTH,
      `Username cannot exceed ${MAX_USERNAME_LENGTH} characters`,
    )
    .regex(
      /^[a-zA-Z0-9_]+$/,
      "Username can only contain letters, numbers, and underscores",
    ),
  email: EmailSchema,
  password: PasswordSchema,
  age: z
    .number()
    .int("Age must be a whole number")
    .min(MIN_AGE, `You must be at least ${MIN_AGE} years old`)
    .max(MAX_AGE, `Age cannot exceed ${MAX_AGE}`)
    .optional(),
  bio: z
    .string()
    .max(MAX_BIO_LENGTH, `Bio cannot exceed ${MAX_BIO_LENGTH} characters`)
    .optional(),
  website: z.string().url("Please enter a valid URL").optional(),
  role: z.enum(["user", "admin", "moderator"]).default("user"),
});

// Derive type from schema
type User = z.infer<typeof UserSchema>;

// Named export
export { UserSchema, EmailSchema, PasswordSchema };
export type { User };
```

**Why good:** named constants for all limits, reusable sub-schemas, descriptive error messages, proper optional handling, type derived from schema

### Bad Example - Schema with Magic Numbers

```typescript
import { z } from "zod";

// Magic numbers everywhere
const userSchema = z.object({
  username: z.string().min(3).max(30), // What are these limits?
  email: z.string().email(),
  password: z.string().min(8),
  age: z.number().min(13).max(120),
  bio: z.string().max(500).optional(),
});

// Separate interface that will drift
interface User {
  username: string;
  email: string;
  password: string;
  age: number;
  bio?: string;
  avatarUrl?: string; // Not in schema!
}

export default userSchema; // Default export
```

**Why bad:** magic numbers are undocumented, interface has extra field not in schema, default export prevents tree-shaking, no custom error messages

---

## Schema Composition

### Good Example - Building CRUD Schemas from Base

```typescript
import { z } from "zod";

// Base entity schema (shared fields)
const BaseEntitySchema = z.object({
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// Article content schema
const ArticleContentSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  tags: z.array(z.string()).default([]),
  published: z.boolean().default(false),
});

// Full article schema (for reading)
const ArticleSchema = BaseEntitySchema.merge(ArticleContentSchema).extend({
  author: z.object({
    id: z.string().uuid(),
    name: z.string(),
  }),
});

// Create schema (no id, timestamps, or author)
const CreateArticleSchema = ArticleContentSchema;

// Update schema (all content fields optional)
const UpdateArticleSchema = ArticleContentSchema.partial();

// Summary schema (for lists)
const ArticleSummarySchema = ArticleSchema.pick({
  id: true,
  title: true,
  published: true,
  createdAt: true,
  author: true,
});

// Types
type Article = z.infer<typeof ArticleSchema>;
type CreateArticle = z.infer<typeof CreateArticleSchema>;
type UpdateArticle = z.infer<typeof UpdateArticleSchema>;
type ArticleSummary = z.infer<typeof ArticleSummarySchema>;

export {
  ArticleSchema,
  CreateArticleSchema,
  UpdateArticleSchema,
  ArticleSummarySchema,
};
export type { Article, CreateArticle, UpdateArticle, ArticleSummary };
```

**Why good:** base schema is reused, pick/partial create focused schemas for specific operations, merge combines schemas cleanly
