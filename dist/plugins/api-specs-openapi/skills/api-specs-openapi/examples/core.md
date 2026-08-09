# OpenAPI Core Patterns

> Related: [codegen.md](codegen.md) for TypeScript generation, [validation.md](validation.md) for request/response validation

---

## Pattern 1: Complete Spec Structure

A production-ready OpenAPI 3.1 document with all major sections.

```yaml
openapi: "3.1.0"
info:
  title: Jobs API
  version: "1.0.0"
  description: |
    REST API for job listings, applications, and company profiles.
  contact:
    name: API Support
    email: api@example.com
  license:
    name: MIT
    identifier: MIT

servers:
  - url: https://api.example.com/v1
    description: Production
  - url: https://staging-api.example.com/v1
    description: Staging

tags:
  - name: Jobs
    description: Job listing operations
  - name: Companies
    description: Company profile operations

paths:
  /jobs:
    get:
      operationId: listJobs
      tags: [Jobs]
      summary: List job postings
      description: Returns a paginated list of active job postings.
      parameters:
        - $ref: "#/components/parameters/PageParam"
        - $ref: "#/components/parameters/LimitParam"
        - name: country
          in: query
          schema:
            type: string
            minLength: 2
            maxLength: 2
            description: ISO 3166-1 alpha-2 country code
        - name: status
          in: query
          schema:
            type: string
            enum: [active, closed, draft]
            default: active
      responses:
        "200":
          description: Paginated list of jobs
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/JobListResponse"
        "400":
          $ref: "#/components/responses/BadRequest"

    post:
      operationId: createJob
      tags: [Jobs]
      summary: Create a job posting
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/CreateJobInput"
      responses:
        "201":
          description: Job created
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Job"
        "400":
          $ref: "#/components/responses/BadRequest"
        "401":
          $ref: "#/components/responses/Unauthorized"
      security:
        - bearerAuth: []

  /jobs/{jobId}:
    get:
      operationId: getJob
      tags: [Jobs]
      summary: Get job details
      parameters:
        - $ref: "#/components/parameters/JobIdParam"
      responses:
        "200":
          description: Job details
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Job"
        "404":
          $ref: "#/components/responses/NotFound"

    put:
      operationId: updateJob
      tags: [Jobs]
      summary: Update a job posting
      parameters:
        - $ref: "#/components/parameters/JobIdParam"
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/UpdateJobInput"
      responses:
        "200":
          description: Job updated
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Job"
        "404":
          $ref: "#/components/responses/NotFound"
      security:
        - bearerAuth: []

    delete:
      operationId: deleteJob
      tags: [Jobs]
      summary: Delete a job posting
      parameters:
        - $ref: "#/components/parameters/JobIdParam"
      responses:
        "204":
          description: Job deleted
        "404":
          $ref: "#/components/responses/NotFound"
      security:
        - bearerAuth: []

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  parameters:
    JobIdParam:
      name: jobId
      in: path
      required: true
      schema:
        type: string
        format: uuid

    PageParam:
      name: page
      in: query
      schema:
        type: integer
        minimum: 1
        default: 1

    LimitParam:
      name: limit
      in: query
      schema:
        type: integer
        minimum: 1
        maximum: 100
        default: 20

  responses:
    BadRequest:
      description: Validation error
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/Error"
    Unauthorized:
      description: Authentication required
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/Error"
    NotFound:
      description: Resource not found
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/Error"

  schemas:
    # --- Base schemas ---
    Pagination:
      type: object
      required: [page, limit, total, totalPages]
      properties:
        page:
          type: integer
        limit:
          type: integer
        total:
          type: integer
        totalPages:
          type: integer

    Error:
      type: object
      required: [code, message]
      properties:
        code:
          type: string
          description: Machine-readable error code
          examples: ["validation_error", "not_found"]
        message:
          type: string
          description: Human-readable error description
        details:
          type: array
          items:
            type: object
            properties:
              field:
                type: string
              message:
                type: string

    # --- Domain schemas ---
    Job:
      type: object
      required: [id, title, companyId, status, createdAt]
      properties:
        id:
          type: string
          format: uuid
        title:
          type: string
          minLength: 1
          maxLength: 200
        description:
          type: ["string", "null"]
        companyId:
          type: string
          format: uuid
        salary:
          $ref: "#/components/schemas/Salary"
        status:
          type: string
          enum: [active, closed, draft]
        tags:
          type: array
          items:
            type: string
          default: []
        createdAt:
          type: string
          format: date-time
        updatedAt:
          type: ["string", "null"]
          format: date-time

    Salary:
      type: object
      required: [min, max, currency]
      properties:
        min:
          type: integer
          minimum: 0
        max:
          type: integer
          minimum: 0
        currency:
          type: string
          minLength: 3
          maxLength: 3
          description: ISO 4217 currency code

    CreateJobInput:
      type: object
      required: [title, companyId]
      properties:
        title:
          type: string
          minLength: 1
          maxLength: 200
        description:
          type: ["string", "null"]
        companyId:
          type: string
          format: uuid
        salary:
          $ref: "#/components/schemas/Salary"
        tags:
          type: array
          items:
            type: string

    UpdateJobInput:
      type: object
      properties:
        title:
          type: string
          minLength: 1
          maxLength: 200
        description:
          type: ["string", "null"]
        salary:
          $ref: "#/components/schemas/Salary"
        status:
          type: string
          enum: [active, closed, draft]
        tags:
          type: array
          items:
            type: string

    JobListResponse:
      type: object
      required: [data, pagination]
      properties:
        data:
          type: array
          items:
            $ref: "#/components/schemas/Job"
        pagination:
          $ref: "#/components/schemas/Pagination"
```

---

## Pattern 2: Schema Composition with $ref

### allOf -- Extending a Base Schema

Use `allOf` when a schema includes everything from a base plus additional fields.

```yaml
# Base entity with audit fields
BaseEntity:
  type: object
  required: [id, createdAt, updatedAt]
  properties:
    id:
      type: string
      format: uuid
    createdAt:
      type: string
      format: date-time
    updatedAt:
      type: string
      format: date-time

# Job extends BaseEntity
Job:
  allOf:
    - $ref: "#/components/schemas/BaseEntity"
    - type: object
      required: [title, status]
      properties:
        title:
          type: string
        status:
          type: string
          enum: [active, closed, draft]
```

**Why good:** base fields defined once, changes propagate to all extending schemas, generated types reflect inheritance

### oneOf with Discriminator -- Polymorphism

Use `oneOf` with `discriminator` when the same field can hold different shapes identified by a type field.

```yaml
Notification:
  oneOf:
    - $ref: "#/components/schemas/EmailNotification"
    - $ref: "#/components/schemas/SmsNotification"
    - $ref: "#/components/schemas/PushNotification"
  discriminator:
    propertyName: type
    mapping:
      email: "#/components/schemas/EmailNotification"
      sms: "#/components/schemas/SmsNotification"
      push: "#/components/schemas/PushNotification"

EmailNotification:
  type: object
  required: [type, email, subject]
  properties:
    type:
      type: string
      const: email
    email:
      type: string
      format: email
    subject:
      type: string

SmsNotification:
  type: object
  required: [type, phone, message]
  properties:
    type:
      type: string
      const: sms
    phone:
      type: string
    message:
      type: string

PushNotification:
  type: object
  required: [type, deviceId, title]
  properties:
    type:
      type: string
      const: push
    deviceId:
      type: string
    title:
      type: string
```

**Why good:** explicit mapping aids code generators, `const` on discriminator field enables TypeScript narrowing, each variant is independently referenceable

**Gotcha:** `discriminator` only works with `$ref` entries in `oneOf` -- inline schemas are ignored by the discriminator.

---

### anyOf -- Flexible Matching

Use `anyOf` when a value can match one or more schemas simultaneously.

```yaml
# Address can be domestic, international, or both (e.g., border zones)
Address:
  anyOf:
    - $ref: "#/components/schemas/DomesticAddress"
    - $ref: "#/components/schemas/InternationalAddress"
```

**When to use `oneOf` vs `anyOf`:** Use `oneOf` when exactly one schema must match (mutually exclusive types). Use `anyOf` when multiple schemas could match simultaneously.

---

## Pattern 3: Reusable Parameters and Responses

Extract repeated parameters and error responses into `components`.

```yaml
components:
  parameters:
    # Reusable pagination params
    PageParam:
      name: page
      in: query
      schema:
        type: integer
        minimum: 1
        default: 1
    LimitParam:
      name: limit
      in: query
      schema:
        type: integer
        minimum: 1
        maximum: 100
        default: 20
    # Reusable sort param
    SortParam:
      name: sort
      in: query
      schema:
        type: string
        enum: [createdAt, updatedAt, title]
        default: createdAt
    SortOrderParam:
      name: order
      in: query
      schema:
        type: string
        enum: [asc, desc]
        default: desc

  responses:
    BadRequest:
      description: Validation error
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/Error"
    Unauthorized:
      description: Authentication required
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/Error"
    Forbidden:
      description: Insufficient permissions
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/Error"
    NotFound:
      description: Resource not found
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/Error"
    TooManyRequests:
      description: Rate limit exceeded
      headers:
        Retry-After:
          schema:
            type: integer
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/Error"
```

**Usage in paths:**

```yaml
paths:
  /jobs:
    get:
      parameters:
        - $ref: "#/components/parameters/PageParam"
        - $ref: "#/components/parameters/LimitParam"
        - $ref: "#/components/parameters/SortParam"
        - $ref: "#/components/parameters/SortOrderParam"
      responses:
        "400":
          $ref: "#/components/responses/BadRequest"
        "429":
          $ref: "#/components/responses/TooManyRequests"
```

**Why good:** error shapes are consistent across all endpoints, pagination params defined once, adding a new standard response is a single change

---

## Pattern 4: OpenAPI 3.1 vs 3.0 Syntax Differences

Key changes to be aware of when writing 3.1 specs.

### Nullable Fields

```yaml
# 3.1 (correct) -- type array with "null"
description:
  type: ["string", "null"]

# 3.0 (outdated) -- nullable keyword removed in 3.1
# description:
#   type: string
#   nullable: true
```

### Exclusive Min/Max

```yaml
# 3.1 -- exclusiveMinimum is a number
age:
  type: integer
  exclusiveMinimum: 0 # Must be > 0


# 3.0 (outdated) -- exclusiveMinimum was a boolean
# age:
#   type: integer
#   minimum: 0
#   exclusiveMinimum: true
```

### $ref with Siblings

```yaml
# 3.1 -- $ref can have sibling keywords (description overrides)
salary:
  $ref: "#/components/schemas/Salary"
  description: Override the referenced schema's description

# 3.0 -- siblings next to $ref were ignored
```

### const Keyword

```yaml
# 3.1 -- const for fixed values (from JSON Schema)
type:
  type: string
  const: email

# 3.0 -- had to use single-value enum
# type:
#   type: string
#   enum: [email]
```

### examples Keyword

```yaml
# 3.1 -- examples as array (JSON Schema standard)
email:
  type: string
  format: email
  examples: ["user@example.com", "admin@example.com"]

# 3.0 -- single example keyword
# email:
#   type: string
#   format: email
#   example: "user@example.com"
```

---

## Pattern 5: Security Schemes

Define authentication methods in `components/securitySchemes` and apply globally or per-operation.

```yaml
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

    apiKeyAuth:
      type: apiKey
      in: header
      name: X-API-Key

    oauth2:
      type: oauth2
      flows:
        authorizationCode:
          authorizationUrl: https://auth.example.com/authorize
          tokenUrl: https://auth.example.com/token
          scopes:
            read:jobs: Read job listings
            write:jobs: Create and update jobs

# Apply globally (all operations require auth)
security:
  - bearerAuth: []

# Override per-operation (public endpoint)
paths:
  /jobs:
    get:
      operationId: listJobs
      security: [] # No auth required
```

**Why good:** security defined once, applied consistently, per-operation overrides for public endpoints
