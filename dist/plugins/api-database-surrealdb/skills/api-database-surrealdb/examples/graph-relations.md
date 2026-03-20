# SurrealDB Graph & Relations Examples

> Record links, RELATE edges, graph traversal patterns, and relationship modeling. See [SKILL.md](../SKILL.md) for core concepts.

**Core patterns:** See [core.md](core.md). **Schema & auth:** See [schema-auth.md](schema-auth.md). **Live queries:** See [live-queries.md](live-queries.md).

---

## Pattern 1: Record Links (Simple Pointers)

Record links are fields that store a `RecordId` pointing directly to another record. SurrealDB fetches linked records from disk via dot notation -- no JOIN required.

### Good Example -- Record Link Fields

```surql
-- Create records with link fields
CREATE person:alice SET
  name = "Alice",
  company = company:acme,
  manager = person:bob,
  skills = [skill:typescript, skill:surrealdb];

CREATE company:acme SET
  name = "Acme Corp",
  founded = d"2020-01-01";

-- Traverse links with dot notation (automatic remote fetch)
SELECT name, company.name AS company_name FROM person:alice;
-- Returns: [{ name: "Alice", company_name: "Acme Corp" }]

-- Multi-level traversal
SELECT name, manager.company.name AS manager_company FROM person:alice;

-- Array link traversal
SELECT skills.name AS skill_names FROM person:alice;
-- Returns skill names from all linked skill records
```

**Why good:** Links are direct disk lookups (no table scan), dot notation traverses transparently across tables, works on single values and arrays

### Bad Example -- Storing ID as String

```surql
-- BAD: Storing the ID as a plain string instead of a record link
CREATE person:alice SET
  name = "Alice",
  company = "company:acme";  -- This is a STRING, not a record link

-- Dot notation won't work on strings
SELECT company.name FROM person:alice;
-- Returns: NONE (string has no .name property)
```

**Why bad:** String values are not record links -- dot notation traversal fails silently, returning NONE instead of the linked record's data

---

## Pattern 2: Graph Edges with RELATE

Graph edges are full records stored in a relation table. They support metadata, bidirectional traversal, and type constraints via `DEFINE TABLE TYPE RELATION`.

### Good Example -- Creating Edges

```surql
-- Simple edge
RELATE person:alice->follows->person:bob;

-- Edge with metadata
RELATE person:alice->follows->person:carol SET
  followed_at = time::now(),
  notifications = true;

-- Multiple edges in one statement
RELATE person:alice->likes->post:hello_world SET
  liked_at = time::now();

RELATE person:alice->likes->post:surrealdb_guide SET
  liked_at = time::now();

-- Typed relation table (enforces valid endpoints)
DEFINE TABLE follows TYPE RELATION IN person OUT person;
DEFINE TABLE likes TYPE RELATION IN person OUT post;

-- ENFORCED ensures referenced records exist
DEFINE TABLE follows TYPE RELATION IN person OUT person ENFORCED;
```

**Why good:** `RELATE` creates edge records with `in`/`out` fields automatically, `SET` adds metadata, `TYPE RELATION` constrains valid endpoints, `ENFORCED` prevents dangling references

### Good Example -- Forward and Reverse Traversal

```surql
-- Forward: who does Alice follow?
SELECT ->follows->person.name AS following FROM person:alice;
-- Returns: [{ following: ["Bob", "Carol"] }]

-- Reverse: who follows Bob?
SELECT <-follows<-person.name AS followers FROM person:bob;
-- Returns: [{ followers: ["Alice"] }]

-- Bidirectional (for symmetric relationships like "knows")
DEFINE TABLE knows TYPE RELATION IN person OUT person;
RELATE person:alice->knows->person:bob;
SELECT <->knows<->person.name AS connections FROM person:alice;
-- Returns: [{ connections: ["Bob"] }]

-- Filter during traversal
SELECT ->follows->person.* AS following
  FROM person:alice
  WHERE ->follows->person.role = "admin";

-- Multi-hop traversal (friends of friends)
SELECT ->follows->person->follows->person.name AS fof FROM person:alice;
```

**Why good:** Arrow syntax for direction, dot notation on target for field selection, bidirectional with `<->`, multi-hop in a single query without separate joins

### Good Example -- Querying Edge Metadata

```surql
-- Query the edge table directly
SELECT *, in.name AS follower, out.name AS followed
  FROM follows
  WHERE in = person:alice;

-- Filter edges by metadata
SELECT ->follows[WHERE notifications = true]->person.name AS notified_following
  FROM person:alice;

-- Aggregate on edges
SELECT
  out.name AS followed,
  count() AS follower_count
  FROM follows
  GROUP BY out
  ORDER BY follower_count DESC
  LIMIT 10;
```

**Why good:** Edges are full records (queryable with SELECT), bracket filters on traversal path, aggregation on edge tables for analytics

### Bad Example -- Using Record Links for Bidirectional Relationships

```surql
-- BAD: Manually maintaining bidirectional links
UPDATE person:alice SET friends += person:bob;
UPDATE person:bob SET friends += person:alice;
-- Must manually keep both sides in sync -- fragile
-- If one update fails, the relationship is inconsistent
```

**Why bad:** Manual bidirectional maintenance is error-prone, no atomicity guarantee, use `RELATE` with `<->` traversal instead

---

## Pattern 3: Relationship Modeling Decisions

### Good Example -- Social Graph

```surql
-- Define typed relation tables
DEFINE TABLE follows TYPE RELATION IN person OUT person SCHEMAFULL;
DEFINE FIELD followed_at ON follows TYPE datetime VALUE time::now();
DEFINE FIELD notifications ON follows TYPE bool DEFAULT true;

DEFINE TABLE blocks TYPE RELATION IN person OUT person SCHEMAFULL;
DEFINE FIELD blocked_at ON blocks TYPE datetime VALUE time::now();

-- Complex social query: mutual followers
SELECT
  ->follows->person AS i_follow,
  <-follows<-person AS follows_me
FROM person:alice;

-- Find mutual follows (both directions)
-- People Alice follows who also follow Alice
SELECT ->follows->person INTERSECT <-follows<-person AS mutuals
  FROM person:alice;
```

**Why good:** Typed relation tables enforce valid connections, metadata on edges (timestamps, preferences), `INTERSECT` for set operations on traversal results

### Good Example -- Access Control Graph

```surql
-- Model permission inheritance via graph
DEFINE TABLE member_of TYPE RELATION IN user OUT team SCHEMAFULL;
DEFINE FIELD role ON member_of TYPE string ASSERT $value IN ["viewer", "editor", "admin"];
DEFINE FIELD joined_at ON member_of TYPE datetime VALUE time::now();

DEFINE TABLE owns TYPE RELATION IN team OUT resource SCHEMAFULL;
DEFINE FIELD permission ON owns TYPE string ASSERT $value IN ["read", "write", "admin"];

-- Create team membership
RELATE user:alice->member_of->team:engineering SET role = "admin";
RELATE user:bob->member_of->team:engineering SET role = "viewer";

-- Create resource ownership
RELATE team:engineering->owns->resource:api_server SET permission = "admin";

-- Check if user has access to resource (graph traversal)
SELECT
  ->member_of->team->owns->resource AS accessible_resources,
  ->member_of[WHERE role = "admin"]->team.name AS admin_teams
FROM user:alice;
```

**Why good:** Graph models permission inheritance naturally, edge metadata stores role/permission level, traversal checks access without manual joins, bracket filters on edges

---

## Pattern 4: Recursive and Advanced Traversal

### Good Example -- Org Chart Traversal

```surql
-- Define hierarchical relationship
DEFINE TABLE reports_to TYPE RELATION IN employee OUT employee;

RELATE employee:alice->reports_to->employee:ceo;
RELATE employee:bob->reports_to->employee:alice;
RELATE employee:carol->reports_to->employee:alice;

-- Direct reports (one level)
SELECT <-reports_to<-employee.name AS direct_reports FROM employee:alice;

-- Full chain to top (recursive-style)
SELECT
  name,
  ->reports_to->employee.name AS manager,
  ->reports_to->employee->reports_to->employee.name AS skip_manager
FROM employee:bob;
```

**Why good:** Graph naturally models hierarchies, arrow syntax chains for multi-level traversal, each hop adds one `->edge->target` segment

### Good Example -- Wildcard Edge Traversal

```surql
-- Discover all outgoing relationships from a record (any edge type)
SELECT id, ->?->? AS all_connections FROM person:alice;

-- Discover all incoming relationships
SELECT id, <-?<-? AS all_referrers FROM resource:api_server;

-- Useful for debugging and schema discovery
SELECT id, ->?->?.id AS outgoing_ids FROM person:alice;
```

**Why good:** Wildcard `?` matches any edge table and target, useful for schema exploration and debugging, returns all connected records regardless of edge type

---

_For core patterns, see [core.md](core.md). For schema definitions, see [schema-auth.md](schema-auth.md). For live queries, see [live-queries.md](live-queries.md)._
