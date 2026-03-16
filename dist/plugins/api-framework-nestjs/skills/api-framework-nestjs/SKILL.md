---
name: api-framework-nestjs
description: NestJS backend framework - modules, controllers, services, DI, guards, pipes, interceptors, exception filters, middleware, DTOs with class-validator
---

# NestJS Patterns

> **Quick Guide:** NestJS is an opinionated, modular Node.js framework built on TypeScript. Use modules to organize features, controllers for HTTP routing, services for business logic with dependency injection, DTOs with class-validator for validation, guards for auth, and exception filters for error handling. NestJS 11 is the current stable version.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST use `@Injectable()` on every service and register it in the module `providers` array)**

**(You MUST enable `ValidationPipe` globally with `whitelist: true` and `forbidNonWhitelisted: true`)**

**(You MUST use DTOs with class-validator decorators for ALL request body validation — never validate manually in controllers)**

**(You MUST throw NestJS built-in HTTP exceptions (`NotFoundException`, `BadRequestException`, etc.) — never send raw status codes)**

**(You MUST use constructor injection for dependencies — never instantiate services manually with `new`)**

</critical_requirements>

---

**Auto-detection:** NestJS, @nestjs/common, @nestjs/core, @Module, @Controller, @Injectable, @Get, @Post, @Body, @Param, @Query, @UseGuards, @UseInterceptors, @UsePipes, @UseFilters, CanActivate, NestInterceptor, PipeTransform, ExceptionFilter, ValidationPipe, class-validator, class-transformer

**When to use:**

- Building structured backend APIs with TypeScript
- Applications requiring dependency injection and modular architecture
- REST APIs with validation, authentication, and role-based access
- Projects needing guards, interceptors, pipes, or middleware
- Enterprise-grade applications with clear separation of concerns

**Key patterns covered:**

- Module system (root, feature, dynamic modules)
- Controllers (routing decorators, params, query, body, response)
- Services and dependency injection (Injectable, constructor injection, custom providers)
- DTOs and validation (class-validator, ValidationPipe)
- Exception handling (built-in exceptions, exception filters)
- Guards and middleware (auth, roles, request lifecycle)

**When NOT to use:**

- Simple scripts or serverless functions that don't need a framework
- Projects where Express/Fastify alone is sufficient (no DI, no modules needed)
- Frontend code (use React, Svelte, etc.)

**Detailed Resources:**

- For decision frameworks and anti-patterns, see [reference.md](reference.md)

**Core Patterns:**

- [examples/core.md](examples/core.md) — Detailed module, controller, service, DTO, and exception patterns with code

**Database Integration:**

- [examples/database.md](examples/database.md) — TypeORM and Prisma integration, repository pattern

**Authentication:**

- [examples/auth.md](examples/auth.md) — Passport.js integration, JWT strategy, auth guards

**Testing:**

- [examples/testing.md](examples/testing.md) — Unit testing services with mocks, e2e with supertest

**Advanced:**

- [examples/advanced.md](examples/advanced.md) — Interceptors, pipes, custom decorators, CQRS patterns

---

<philosophy>

## Philosophy

NestJS enforces a **modular, decorator-driven architecture** inspired by Angular. Every feature is organized into modules containing controllers (HTTP layer), services (business logic), and supporting infrastructure (guards, pipes, interceptors, filters).

**Core principles:**

1. **Modularity** — Group related controllers, services, and providers into feature modules. Modules are the primary organizational unit.
2. **Dependency injection** — Never instantiate services manually. Declare them as `@Injectable()` and let NestJS resolve the dependency graph via constructor injection.
3. **Decorator-driven** — Decorators (`@Controller`, `@Get`, `@Body`, `@UseGuards`) attach metadata that NestJS uses to build routing, validation, and middleware pipelines.
4. **Separation of concerns** — Controllers handle HTTP request/response. Services handle business logic. Guards handle authorization. Pipes handle validation/transformation. Filters handle exceptions.
5. **Convention over configuration** — Follow NestJS conventions (one module per feature, one controller per resource, DTOs for validation) to get batteries-included functionality.

**When to use NestJS:**

- Enterprise-grade APIs with complex business logic
- Projects with multiple developers needing enforced structure
- Applications requiring authentication, authorization, and validation
- APIs that benefit from dependency injection and testability

**When NOT to use:**

- Small serverless functions or simple CRUD endpoints
- Projects where framework overhead is unacceptable
- Teams unfamiliar with decorator-based or Angular-style patterns

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Module System

Modules are the organizational unit of a NestJS application. Every application has a root `AppModule`, and features are organized into feature modules.

```typescript
// app.module.ts
import { Module } from "@nestjs/common";
import { UsersModule } from "./users/users.module";
import { AuthModule } from "./auth/auth.module";
import { ConfigModule } from "@nestjs/config";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), UsersModule, AuthModule],
})
export class AppModule {}
```

**Why good:** Root module imports feature modules, `ConfigModule.forRoot()` makes config globally available, no controllers or providers at root level keeps it clean

```typescript
// users/users.module.ts
import { Module } from "@nestjs/common";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService], // Available to other modules that import UsersModule
})
export class UsersModule {}
```

**Why good:** Feature module groups related controller and service, exports service for use by other modules (e.g., AuthModule)

```typescript
// BAD: Everything in one module
@Module({
  controllers: [
    UsersController,
    AuthController,
    OrdersController,
    ProductsController,
  ],
  providers: [UsersService, AuthService, OrdersService, ProductsService],
})
export class AppModule {}
```

**Why bad:** Monolithic module defeats the purpose of modular architecture, hard to test features in isolation, no encapsulation

---

### Pattern 2: Controllers

Controllers handle incoming HTTP requests. Use decorators for routing, parameter extraction, and response configuration.

```typescript
// users/users.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { UsersService } from "./users.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll(
    @Query("page", new ParseIntPipe({ optional: true })) page = DEFAULT_PAGE,
    @Query("limit", new ParseIntPipe({ optional: true })) limit = DEFAULT_LIMIT,
  ) {
    return this.usersService.findAll(page, limit);
  }

  @Get(":id")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Put(":id")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.usersService.remove(id);
  }
}
```

**Why good:** Named constants for defaults, `ParseIntPipe` validates and transforms params, `HttpCode` for explicit status codes, thin controller delegates to service

```typescript
// BAD: Business logic in controller
@Controller("users")
export class UsersController {
  @Post()
  async create(@Body() body: any) {
    // BAD: Manual validation in controller
    if (!body.email || !body.email.includes("@")) {
      throw new Error("Invalid email");
    }
    // BAD: Database access in controller
    const user = await this.db.query("INSERT INTO users...");
    return user;
  }
}
```

**Why bad:** Business logic belongs in services, manual validation should use DTOs + ValidationPipe, raw `Error` instead of NestJS exceptions, `any` type loses safety

---

### Pattern 3: Services and Dependency Injection

Services contain business logic. Decorate with `@Injectable()` and inject via constructor.

```typescript
// users/users.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import type { CreateUserDto } from "./dto/create-user.dto";
import type { UpdateUserDto } from "./dto/update-user.dto";

interface User {
  id: number;
  email: string;
  name: string;
}

@Injectable()
export class UsersService {
  private readonly users: User[] = [];
  private nextId = 1;

  findAll(page: number, limit: number): User[] {
    const start = (page - 1) * limit;
    return this.users.slice(start, start + limit);
  }

  findOne(id: number): User {
    const user = this.users.find((u) => u.id === id);
    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }
    return user;
  }

  create(dto: CreateUserDto): User {
    const existing = this.users.find((u) => u.email === dto.email);
    if (existing) {
      throw new ConflictException(
        `User with email ${dto.email} already exists`,
      );
    }
    const user: User = { id: this.nextId++, ...dto };
    this.users.push(user);
    return user;
  }

  update(id: number, dto: UpdateUserDto): User {
    const user = this.findOne(id);
    Object.assign(user, dto);
    return user;
  }

  remove(id: number): void {
    const index = this.users.findIndex((u) => u.id === id);
    if (index === -1) {
      throw new NotFoundException(`User with id ${id} not found`);
    }
    this.users.splice(index, 1);
  }
}
```

**Why good:** `@Injectable()` enables DI, throws NestJS HTTP exceptions (NotFoundException, ConflictException), pure business logic with no HTTP concerns, typed DTO parameters

#### Custom Providers

```typescript
// For token-based injection when you need interfaces or runtime selection
import { Module } from "@nestjs/common";

const DATABASE_CONNECTION = "DATABASE_CONNECTION";

const databaseProvider = {
  provide: DATABASE_CONNECTION,
  useFactory: async (configService: ConfigService) => {
    const config = configService.get("database");
    return createConnection(config);
  },
  inject: [ConfigService],
};

@Module({
  providers: [databaseProvider],
  exports: [DATABASE_CONNECTION],
})
export class DatabaseModule {}

// Inject with @Inject token
@Injectable()
export class UsersService {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Connection) {}
}
```

**Why good:** Factory providers for complex initialization, token-based injection for non-class providers, explicit dependency declaration

---

### Pattern 4: DTOs and Validation

Use class-validator decorators on DTOs and enable `ValidationPipe` globally.

```typescript
// users/dto/create-user.dto.ts
import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsEnum,
} from "class-validator";

const MIN_PASSWORD_LENGTH = 8;
const MAX_NAME_LENGTH = 100;

enum UserRole {
  User = "user",
  Admin = "admin",
}

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(MIN_PASSWORD_LENGTH)
  password: string;

  @IsString()
  @MaxLength(MAX_NAME_LENGTH)
  name: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
```

```typescript
// users/dto/update-user.dto.ts
import { PartialType } from "@nestjs/mapped-types";
import { CreateUserDto } from "./create-user.dto";

// All fields from CreateUserDto become optional
export class UpdateUserDto extends PartialType(CreateUserDto) {}
```

**Why good:** Named constants for limits, class-validator decorators for declarative validation, `PartialType` reuses create DTO for updates, enum for constrained values

```typescript
// main.ts — Enable validation globally
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";

const PORT = 3000;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip properties not in DTO
      forbidNonWhitelisted: true, // Reject requests with unknown properties
      transform: true, // Auto-transform payloads to DTO instances
    }),
  );
  await app.listen(PORT);
}
bootstrap();
```

**Why good:** `whitelist` prevents mass-assignment attacks, `forbidNonWhitelisted` catches typos in payloads, `transform` converts plain objects to class instances

```typescript
// BAD: Manual validation
@Post()
create(@Body() body: any) {
  if (!body.email) throw new BadRequestException('Email required');
  if (!body.password || body.password.length < 8) {
    throw new BadRequestException('Password too short');
  }
  // 20 more lines of manual validation...
}
```

**Why bad:** Manual validation is verbose, error-prone, inconsistent, and doesn't benefit from class-transformer auto-transformation

---

### Pattern 5: Exception Handling

NestJS provides built-in HTTP exceptions and a customizable exception filter layer.

#### Built-in Exceptions

```typescript
import {
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
  InternalServerErrorException,
} from "@nestjs/common";

// Use in services — NestJS auto-converts to proper HTTP responses
throw new NotFoundException("Resource not found");
throw new BadRequestException("Invalid input");
throw new UnauthorizedException("Authentication required");
throw new ForbiddenException("Insufficient permissions");
throw new ConflictException("Resource already exists");
```

**Why good:** Built-in exceptions produce consistent JSON error responses with correct status codes, no manual response formatting needed

#### Custom Exception Filter

```typescript
// filters/http-exception.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Request, Response } from "express";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : "Internal server error";

    this.logger.error(
      `${request.method} ${request.url} ${status}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      ...(typeof message === "object" ? message : { message }),
    });
  }
}
```

**Why good:** Catches all exceptions (not just HttpException), logs with stack trace, consistent error response shape, separates known HTTP errors from unexpected errors

---

### Pattern 6: Guards and Middleware

Guards decide whether a request can proceed (authorization). Middleware runs before the route handler (logging, CORS, etc.).

#### Auth Guard

```typescript
// auth/guards/jwt-auth.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import { AuthService } from "../auth.service";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      throw new UnauthorizedException(
        "Missing or invalid authorization header",
      );
    }

    const token = authHeader.split(" ")[1];
    const user = await this.authService.validateToken(token);

    if (!user) {
      throw new UnauthorizedException("Invalid token");
    }

    request["user"] = user;
    return true;
  }
}
```

#### Role Guard with Custom Decorator

```typescript
// auth/decorators/roles.decorator.ts
import { SetMetadata } from "@nestjs/common";

const ROLES_KEY = "roles";

export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
```

```typescript
// auth/guards/roles.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

const ROLES_KEY = "roles";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles) {
      return true; // No roles required, allow access
    }

    const { user } = context.switchToHttp().getRequest();
    const hasRole = requiredRoles.some((role) => user.roles?.includes(role));

    if (!hasRole) {
      throw new ForbiddenException("Insufficient permissions");
    }

    return true;
  }
}
```

```typescript
// Usage in controller
@Controller("admin")
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  @Get("users")
  @Roles("admin")
  findAllUsers() {
    return this.usersService.findAll();
  }

  @Delete("users/:id")
  @Roles("admin", "moderator")
  removeUser(@Param("id", ParseIntPipe) id: number) {
    return this.usersService.remove(id);
  }
}
```

**Why good:** Guards are injectable (can use services), `Reflector` reads decorator metadata, guards compose (JwtAuthGuard runs before RolesGuard), custom `@Roles()` decorator is clean and reusable

#### Middleware

```typescript
// middleware/logger.middleware.ts
import { Injectable, NestMiddleware, Logger } from "@nestjs/common";
import type { Request, Response, NextFunction } from "express";

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger("HTTP");

  use(req: Request, _res: Response, next: NextFunction) {
    const { method, originalUrl } = req;
    const start = Date.now();

    _res.on("finish", () => {
      const duration = Date.now() - start;
      this.logger.log(
        `${method} ${originalUrl} ${_res.statusCode} - ${duration}ms`,
      );
    });

    next();
  }
}

// Register in module
import { Module, NestModule, MiddlewareConsumer } from "@nestjs/common";

@Module({ controllers: [UsersController], providers: [UsersService] })
export class UsersModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes("*");
  }
}
```

**Why good:** Class-based middleware is injectable, `NestModule.configure` registers middleware per module, response timing captured via `finish` event

</patterns>

---

<decision_framework>

## Decision Framework

### Request Lifecycle

```
Incoming Request
  → Middleware (logging, CORS, body parsing)
    → Guards (authentication, authorization)
      → Interceptors (pre-handler: transform request, start timing)
        → Pipes (validation, transformation)
          → Route Handler (controller method)
        → Interceptors (post-handler: transform response, log timing)
  → Exception Filters (catch and format errors)
→ Response
```

### Which Layer to Use

```
Need to process raw request before routing?
├─ YES → Middleware (logging, CORS, rate limiting)
└─ NO → Does it decide allow/deny for a route?
    ├─ YES → Guard (auth, roles, permissions)
    └─ NO → Does it transform/validate input data?
        ├─ YES → Pipe (validation, type coercion)
        └─ NO → Does it wrap handler execution?
            ├─ YES → Interceptor (timing, caching, response mapping)
            └─ NO → Does it handle errors?
                ├─ YES → Exception Filter
                └─ NO → Put it in the service layer
```

### Module Organization

```
Is this a cross-cutting concern (auth, config, logging)?
├─ YES → Global module or shared module
└─ NO → Is it a business feature (users, orders, products)?
    ├─ YES → Feature module (users.module.ts)
    └─ NO → Is it infrastructure (database, cache, queue)?
        ├─ YES → Infrastructure module
        └─ NO → Part of the closest feature module
```

</decision_framework>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Putting business logic in controllers instead of services
- Missing `@Injectable()` on services (DI fails silently)
- Not enabling `ValidationPipe` globally (DTOs not validated)
- Using `any` for request body instead of typed DTOs
- Instantiating services with `new` instead of constructor injection
- Throwing raw `Error` instead of NestJS HTTP exceptions

**Medium Priority Issues:**

- Not exporting services from modules (other modules can't import them)
- Importing the entire module when you only need one service
- Missing `whitelist: true` on ValidationPipe (mass-assignment vulnerability)
- Using `@Res()` decorator (opts out of NestJS response handling — use only when streaming)
- Not using `PartialType` / `PickType` / `OmitType` for update DTOs (duplicated validation)

**Common Mistakes:**

- Circular module dependencies — restructure to use `forwardRef()` or extract shared logic
- Forgetting to register providers in the module — service injection fails at runtime
- Using synchronous guards for async operations — return `Promise<boolean>` or `Observable<boolean>`
- Not handling all exception types in custom filters — always have a catch-all for unknown errors

**Gotchas and Edge Cases:**

- `@UseGuards(AuthGuard)` takes a class reference, not an instance — NestJS instantiates it via DI
- `ValidationPipe` with `transform: true` converts query params to their declared types automatically
- Guards execute AFTER middleware but BEFORE interceptors and pipes
- `@Catch()` with no arguments catches ALL exceptions, not just HttpException
- NestJS 11: Termination lifecycle hooks now execute in reverse order
- NestJS 11: Express v5 requires named wildcards (`/*splat` instead of `/*`)

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST use `@Injectable()` on every service and register it in the module `providers` array)**

**(You MUST enable `ValidationPipe` globally with `whitelist: true` and `forbidNonWhitelisted: true`)**

**(You MUST use DTOs with class-validator decorators for ALL request body validation — never validate manually in controllers)**

**(You MUST throw NestJS built-in HTTP exceptions (`NotFoundException`, `BadRequestException`, etc.) — never send raw status codes)**

**(You MUST use constructor injection for dependencies — never instantiate services manually with `new`)**

**Failure to follow these rules will produce unvalidated, untestable NestJS code with broken dependency injection.**

</critical_reminders>
