# NestJS Reference

> CLI commands, project structure, decorator reference, and decision frameworks. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## CLI Commands

### Project Scaffolding

```bash
# Create new project
nest new my-project

# Create with specific package manager
nest new my-project --package-manager pnpm
```

### Code Generation

```bash
# Generate a complete CRUD resource (module + controller + service + DTOs)
nest generate resource users
nest g res users

# Generate individual components
nest generate module users          # nest g mo users
nest generate controller users      # nest g co users
nest generate service users         # nest g s users
nest generate guard auth            # nest g gu auth
nest generate interceptor logging   # nest g itc logging
nest generate pipe validation       # nest g pi validation
nest generate filter http-exception # nest g f http-exception
nest generate middleware logger     # nest g mi logger
nest generate decorator roles       # nest g d roles
nest generate class dto/create-user # nest g cl dto/create-user
```

### Build and Run

```bash
# Development
nest start --watch

# Debug mode
nest start --debug --watch

# Production build
nest build

# Run production
node dist/main.js
```

---

## Standard Project Structure

```
src/
├── main.ts                          # App entry point, bootstrap
├── app.module.ts                    # Root module
├── app.controller.ts                # Root controller (health check)
├── app.service.ts                   # Root service
│
├── config/                          # Configuration
│   ├── app.config.ts                # App config (registerAs)
│   └── database.config.ts           # Database config
│
├── common/                          # Shared utilities
│   ├── decorators/                  # Custom decorators
│   ├── filters/                     # Exception filters
│   ├── guards/                      # Auth/role guards
│   ├── interceptors/                # Response/logging interceptors
│   ├── middleware/                   # HTTP middleware
│   └── pipes/                       # Custom pipes
│
├── prisma/                          # Database (Prisma)
│   ├── prisma.module.ts
│   └── prisma.service.ts
│
├── auth/                            # Auth feature module
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── dto/
│   │   └── login.dto.ts
│   ├── guards/
│   │   ├── jwt-auth.guard.ts
│   │   └── roles.guard.ts
│   ├── strategies/
│   │   ├── jwt.strategy.ts
│   │   └── local.strategy.ts
│   └── decorators/
│       ├── current-user.decorator.ts
│       ├── public.decorator.ts
│       └── roles.decorator.ts
│
├── users/                           # Users feature module
│   ├── users.module.ts
│   ├── users.controller.ts
│   ├── users.service.ts
│   ├── dto/
│   │   ├── create-user.dto.ts
│   │   ├── update-user.dto.ts
│   │   └── query-users.dto.ts
│   └── entities/
│       └── user.entity.ts           # TypeORM entity (if using TypeORM)
│
└── orders/                          # Orders feature module
    ├── orders.module.ts
    ├── orders.controller.ts
    ├── orders.service.ts
    └── dto/
        └── create-order.dto.ts

test/
├── app.e2e-spec.ts                  # E2E tests
└── jest-e2e.json                    # E2E test config
```

---

## Decorator Quick Reference

### Class Decorators

| Decorator               | Purpose                        | Example                                             |
| ----------------------- | ------------------------------ | --------------------------------------------------- |
| `@Module({...})`        | Define a module                | `@Module({ controllers: [...], providers: [...] })` |
| `@Controller(path?)`    | Define a controller            | `@Controller('users')`                              |
| `@Injectable()`         | Mark class for DI              | `@Injectable() export class UsersService {}`        |
| `@Global()`             | Make module globally available | `@Global() @Module({...})`                          |
| `@Catch(...exceptions)` | Exception filter               | `@Catch(HttpException)`                             |

### Route Decorators

| Decorator        | HTTP Method | Example          |
| ---------------- | ----------- | ---------------- |
| `@Get(path?)`    | GET         | `@Get(':id')`    |
| `@Post(path?)`   | POST        | `@Post()`        |
| `@Put(path?)`    | PUT         | `@Put(':id')`    |
| `@Patch(path?)`  | PATCH       | `@Patch(':id')`  |
| `@Delete(path?)` | DELETE      | `@Delete(':id')` |
| `@All(path?)`    | All methods | `@All('*')`      |

### Parameter Decorators

| Decorator        | Extracts         | Example                                           |
| ---------------- | ---------------- | ------------------------------------------------- |
| `@Body(key?)`    | Request body     | `@Body() dto: CreateUserDto`                      |
| `@Param(key?)`   | Route params     | `@Param('id', ParseIntPipe) id: number`           |
| `@Query(key?)`   | Query string     | `@Query('page') page: string`                     |
| `@Headers(key?)` | Request headers  | `@Headers('authorization') auth: string`          |
| `@Req()`         | Express Request  | `@Req() req: Request`                             |
| `@Res()`         | Express Response | `@Res() res: Response` (disables NestJS response) |
| `@Ip()`          | Client IP        | `@Ip() ip: string`                                |
| `@Session()`     | Session object   | `@Session() session: Record<string, any>`         |

### Handler Decorators

| Decorator                 | Purpose                 | Example                                 |
| ------------------------- | ----------------------- | --------------------------------------- |
| `@HttpCode(status)`       | Set response status     | `@HttpCode(HttpStatus.NO_CONTENT)`      |
| `@Header(name, value)`    | Set response header     | `@Header('Cache-Control', 'none')`      |
| `@Redirect(url, code?)`   | Redirect response       | `@Redirect('https://example.com', 301)` |
| `@UseGuards(...guards)`   | Apply guards            | `@UseGuards(AuthGuard)`                 |
| `@UseInterceptors(...i)`  | Apply interceptors      | `@UseInterceptors(LoggingInterceptor)`  |
| `@UsePipes(...pipes)`     | Apply pipes             | `@UsePipes(new ValidationPipe())`       |
| `@UseFilters(...filters)` | Apply exception filters | `@UseFilters(HttpExceptionFilter)`      |

### Metadata Decorators

| Decorator                | Purpose            | Example                            |
| ------------------------ | ------------------ | ---------------------------------- |
| `@SetMetadata(key, val)` | Set route metadata | `@SetMetadata('roles', ['admin'])` |

---

## Built-in Pipes

| Pipe               | Purpose                             |
| ------------------ | ----------------------------------- |
| `ValidationPipe`   | Validates DTO with class-validator  |
| `ParseIntPipe`     | Converts string to integer          |
| `ParseFloatPipe`   | Converts string to float            |
| `ParseBoolPipe`    | Converts string to boolean          |
| `ParseUUIDPipe`    | Validates UUID format               |
| `ParseDatePipe`    | Converts string to Date (NestJS 11) |
| `ParseEnumPipe`    | Validates enum membership           |
| `ParseArrayPipe`   | Parses and validates arrays         |
| `DefaultValuePipe` | Sets default for undefined params   |

---

## Built-in HTTP Exceptions

| Exception                       | Status Code |
| ------------------------------- | ----------- |
| `BadRequestException`           | 400         |
| `UnauthorizedException`         | 401         |
| `ForbiddenException`            | 403         |
| `NotFoundException`             | 404         |
| `MethodNotAllowedException`     | 405         |
| `NotAcceptableException`        | 406         |
| `RequestTimeoutException`       | 408         |
| `ConflictException`             | 409         |
| `GoneException`                 | 410         |
| `PayloadTooLargeException`      | 413         |
| `UnsupportedMediaTypeException` | 415         |
| `UnprocessableEntityException`  | 422         |
| `InternalServerErrorException`  | 500         |
| `NotImplementedException`       | 501         |
| `BadGatewayException`           | 502         |
| `ServiceUnavailableException`   | 503         |
| `GatewayTimeoutException`       | 504         |

---

## Provider Scopes

| Scope                 | Lifetime      | Use Case                                    |
| --------------------- | ------------- | ------------------------------------------- |
| `DEFAULT` (Singleton) | App lifetime  | Most services, shared state                 |
| `REQUEST`             | Per request   | Request-specific data (user context)        |
| `TRANSIENT`           | Per injection | Stateful providers that shouldn't be shared |

```typescript
@Injectable({ scope: Scope.REQUEST })
export class RequestScopedService {
  // New instance per HTTP request
}
```

---

## Module Metadata

| Property      | Type                     | Purpose                          |
| ------------- | ------------------------ | -------------------------------- |
| `imports`     | `Module[]`               | Other modules to import          |
| `controllers` | `Controller[]`           | Controllers in this module       |
| `providers`   | `Provider[]`             | Services/providers for DI        |
| `exports`     | `(Provider \| string)[]` | Providers available to importers |

---

## Decision Framework

### Request Lifecycle (Execution Order)

```
1. Middleware
2. Guards
3. Interceptors (pre-handler)
4. Pipes
5. Route Handler
6. Interceptors (post-handler)
7. Exception Filters (on error)
```

### Which Layer For Your Logic

```
Is it request preprocessing (logging, CORS)?
├─ YES → Middleware

Does it decide allow/deny?
├─ YES → Guard (auth, roles, rate limiting)

Does it transform/validate input?
├─ YES → Pipe (ParseIntPipe, ValidationPipe, custom)

Does it wrap handler execution (timing, caching, response)?
├─ YES → Interceptor

Does it handle errors?
├─ YES → Exception Filter

Is it business logic?
├─ YES → Service (injected into controller)
```

### ORM Selection

```
Need type-safe queries with great DX?
├─ YES → Prisma (recommended for most NestJS projects)
└─ NO → Need decorator-based entities?
    ├─ YES → TypeORM (Angular-style, decorator-heavy)
    └─ NO → Need raw SQL performance?
        ├─ YES → Drizzle ORM (fastest, SQL-like API)
        └─ NO → Prisma (safe default)
```

---

## RED FLAGS

### High Priority Issues

- **Business logic in controllers** — Move to services, controllers should be thin
- **Missing `@Injectable()`** — Service won't be available for DI
- **No global `ValidationPipe`** — DTOs are not being validated
- **`any` type on `@Body()`** — Lose type safety and validation
- **`new ServiceClass()` instead of constructor injection** — Breaks DI, untestable
- **Raw `throw new Error()` instead of NestJS exceptions** — Produces 500 instead of proper HTTP status

### Medium Priority Issues

- **Not exporting services** — Other modules can't use them
- **Using `@Res()` when not streaming** — Disables NestJS response handling (interceptors, serialization)
- **Missing `whitelist: true` on ValidationPipe** — Mass-assignment vulnerability
- **Circular module dependencies** — Use `forwardRef()` or restructure
- **Not using `PartialType` for update DTOs** — Duplicated validation rules

### Gotchas and Edge Cases

- `@UseGuards(AuthGuard)` takes a class reference — NestJS creates the instance via DI
- `ValidationPipe` with `transform: true` auto-converts query params to declared types
- Guards run AFTER middleware but BEFORE interceptors and pipes
- `@Catch()` with no arguments catches ALL exceptions (including non-HTTP)
- NestJS 11: Termination hooks (`OnModuleDestroy`, `OnApplicationShutdown`) run in reverse order
- NestJS 11: Express v5 wildcards use `/*splat` syntax (not `/*`)
- NestJS 11: `ParseDatePipe` added as a built-in pipe
- Request-scoped providers (`Scope.REQUEST`) affect performance — use only when needed
- `forwardRef()` should be a last resort — circular deps usually signal a design issue
