# NestJS Reference

> CLI commands, project structure, decorator tables, pipes, exceptions, and provider scopes. See [SKILL.md](SKILL.md) for core concepts, decision frameworks, and red flags.

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

> For decision frameworks and red flags, see [SKILL.md](SKILL.md).
