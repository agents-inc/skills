# Gel (formerly EdgeDB) Advanced Schema Examples

> Access policies, backlinks, abstract types, polymorphism, and triggers. See [SKILL.md](../SKILL.md) for core concepts.

**Core patterns:** See [core.md](core.md). **Query builder:** See [query-builder.md](query-builder.md).

---

## Pattern 1: Backlinks

### Good Example -- Computed Backlinks for Bidirectional Traversal

```
# Backlinks let you traverse relationships in reverse without storing data twice
module default {
  type Author {
    required name: str;
    required email: str {
      constraint exclusive;
    };

    # Computed backlink: all posts where this Author is the author
    multi posts := .<author[is Post];

    # Count of published posts (computed from backlink)
    published_count := count(
      (select .posts filter .status = Status.published)
    );
  }

  type Post {
    required title: str;
    required author: Author;  # forward link
    required status: Status;
  }

  scalar type Status extending enum<draft, published, archived>;
}
```

**Why good:** `.<author[is Post]` traverses the `author` link backwards to find all Posts, `[is Post]` type filter ensures only Post objects are returned (other types with an `author` link are excluded), `published_count` composes on the backlink

```
# BAD: Storing the reverse link manually (data duplication)
type Author {
  required name: str;
  multi posts: Post;  # Forward multi link stored on Author
}

type Post {
  required title: str;
  required author: Author;
}
# Now posts exist in TWO places -- Author.posts and Post.author
# They can get out of sync!
```

**Why bad:** Forward multi link on Author duplicates the relationship data, `Author.posts` and `Post.author` can become inconsistent, use computed backlinks (`.<author[is Post]`) instead

### Backlink Syntax Reference

```
# Syntax: .<link_name[is TargetType]

# All objects linking to this object via 'author'
multi written_items := .<author;  # Returns mixed types

# Only Posts (not Comments or other types with 'author' link)
multi posts := .<author[is Post];

# Only Comments
multi comments := .<author[is Comment];

# Single backlink (one-to-one reverse)
single profile := .<user[is Profile];
```

---

## Pattern 2: Abstract Types and Polymorphism

### Good Example -- Abstract Type Hierarchy

```
module default {
  # Abstract type -- cannot be instantiated directly
  abstract type Timestamped {
    created_at: datetime {
      default := datetime_of_statement();
      readonly := true;
    };
    updated_at: datetime {
      default := datetime_of_statement();
      rewrite insert, update using (datetime_of_statement());
    };
  }

  abstract type Auditable extending Timestamped {
    required created_by: User;
    modified_by: User;
  }

  # Concrete types extend abstract types
  type Post extending Auditable {
    required title: str;
    required body: str;
    required status: Status;
  }

  type Comment extending Auditable {
    required body: str;
    required post: Post;
  }

  type User extending Timestamped {
    required name: str;
    required email: str {
      constraint exclusive;
    };
  }

  scalar type Status extending enum<draft, published, archived>;
}
```

**Why good:** `Timestamped` adds created/updated timestamps to any type, `Auditable` extends it with audit fields, `rewrite` trigger auto-updates `updated_at`, multiple inheritance via `extending`, DRY schema definition

### Good Example -- Polymorphic Queries

```edgeql
# Select all Auditable objects (polymorphic query)
select Auditable {
  created_at,
  created_by: { name },

  # Type-specific fields via type intersection
  [is Post].title,
  [is Post].status,
  [is Comment].body,
  [is Comment].post: { title },
}
order by .created_at desc
limit 50;
```

**Why good:** Querying abstract type returns all concrete subtypes, `[is Post].title` extracts type-specific fields without separate queries, single query for activity feed across types

---

## Pattern 3: Access Policies

### Good Example -- Row-Level Security with Globals

```
module default {
  # Global variable -- set at connection time via client.withGlobals()
  global current_user_id: uuid;

  # Computed global for convenience
  global current_user := (
    select User filter .id = global current_user_id
  );

  type User {
    required name: str;
    required email: str {
      constraint exclusive;
    };
    required role: Role;
    required organization: Organization;
  }

  type Organization {
    required name: str;
    multi members := .<organization[is User];
  }

  type Document {
    required title: str;
    required body: str;
    required owner: User;
    required organization: Organization;
    is_public: bool {
      default := false;
    };

    # Access policies -- enforced at the database level
    access policy owner_full_access
      allow all
      using (.owner = global current_user);

    access policy org_members_can_read
      allow select
      using (.organization = global current_user.organization);

    access policy public_documents_readable
      allow select
      using (.is_public = true);
  }

  scalar type Role extending enum<admin, user, viewer>;
}
```

**Why good:** `global current_user_id` set via `client.withGlobals()`, computed global resolves the full user object, policies are declarative and enforced by the database, multiple policies combine (any matching policy grants access), policies distinguish between `select`, `insert`, `update`, `delete`

### Using Access Policies from TypeScript

```typescript
import { createClient } from "gel";

const baseClient = createClient();

// Set the global for the current request
function getClientForUser(userId: string) {
  return baseClient.withGlobals({
    current_user_id: userId,
  });
}

// All queries through this client are filtered by access policies
async function getDocuments(userId: string) {
  const client = getClientForUser(userId);

  // This only returns documents the user is allowed to see
  const docs = await client.query(
    `select Document { title, body, owner: { name } }`,
  );

  return docs;
}

export { getClientForUser, getDocuments };
```

**Why good:** `withGlobals` creates a derived client (immutable, does not modify base), all queries automatically filtered by policies, no application-level authorization checks needed for basic access control

---

## Pattern 4: Custom Scalar Types

### Good Example -- Constrained Scalars

```
module default {
  # Enum scalar
  scalar type Priority extending enum<low, medium, high, critical>;

  # Constrained string scalars
  scalar type EmailAddress extending str {
    constraint regexp(r'^[^@]+@[^@]+\.[^@]+$');
    constraint min_len_value(5);
    constraint max_len_value(254);
  }

  scalar type SlugString extending str {
    constraint regexp(r'^[a-z0-9]+(-[a-z0-9]+)*$');
    constraint max_len_value(100);
  }

  # Constrained numeric
  scalar type PositiveInt extending int64 {
    constraint min_value(1);
  }

  # Use the custom scalars in types
  type User {
    required email: EmailAddress;
    required name: str;
  }

  type Post {
    required title: str;
    required slug: SlugString {
      constraint exclusive;
    };
    required priority: Priority {
      default := Priority.medium;
    };
  }
}
```

**Why good:** Custom scalars centralize validation logic, constraints enforced everywhere the scalar is used, DRY -- no need to repeat regex on every property

---

## Pattern 5: Triggers (v4+)

### Good Example -- Automatic Side Effects

```
module default {
  type Post {
    required title: str;
    required body: str;
    required author: User;
    required status: Status;
    published_at: datetime;

    # Trigger: auto-set published_at when status changes to published
    trigger set_published_at after update for each
      when (__new__.status = Status.published and
            __old__.status != Status.published)
      do (
        update Post
        filter .id = __new__.id
        set { published_at := datetime_of_statement() }
      );
  }

  type AuditLog {
    required action: str;
    required target_type: str;
    required target_id: uuid;
    required performed_by: User;
    created_at: datetime {
      default := datetime_of_statement();
    };
  }

  type User {
    required name: str;
    required email: str {
      constraint exclusive;
    };

    # Trigger: log deletion
    trigger log_deletion after delete for each do (
      insert AuditLog {
        action := 'deleted',
        target_type := 'User',
        target_id := __old__.id,
        performed_by := global current_user,
      }
    );
  }

  global current_user: User;
  scalar type Status extending enum<draft, published, archived>;
}
```

**Why good:** Triggers run inside the same transaction as the triggering operation, `__new__` and `__old__` reference the object before/after the change, `when` clause prevents unnecessary execution, audit logging as a database concern (not application concern)

---

## Pattern 6: Rewrite Rules

### Good Example -- Automatic Field Updates

```
module default {
  type Post {
    required title: str;
    required body: str;
    required status: Status;

    created_at: datetime {
      default := datetime_of_statement();
      readonly := true;
    };

    # Rewrite rule: auto-update on every insert and update
    updated_at: datetime {
      rewrite insert, update using (datetime_of_statement());
    };

    # Rewrite rule: normalize slug on insert
    required slug: str {
      constraint exclusive;
      rewrite insert using (
        str_lower(str_replace(__subject__.title, ' ', '-'))
      );
    };
  }

  scalar type Status extending enum<draft, published, archived>;
}
```

**Why good:** `rewrite` is more concise than triggers for simple field transformations, `__subject__` references the object being inserted/updated, slug auto-generated from title on insert, `updated_at` always reflects the latest modification

---

_For core patterns, see [core.md](core.md). For query builder, see [query-builder.md](query-builder.md)._
