# NestJS Advanced Patterns

> Interceptors, pipes, custom decorators, and CQRS patterns. See [SKILL.md](../SKILL.md) for core concepts.

---

## Pattern 1: Interceptors

Interceptors wrap the handler execution pipeline. They can transform the response, add logging, implement caching, or handle errors.

### Good Example — Response Wrapping Interceptor

```typescript
// interceptors/transform-response.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

interface ApiResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
}

@Injectable()
export class TransformResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => ({
        success: true,
        data,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
```

**Why good:** Wraps all responses in a consistent envelope, uses RxJS `map` operator, typed with generics, implements `NestInterceptor` interface properly

### Good Example — Logging and Timing Interceptor

```typescript
// interceptors/logging.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import type { Request } from "express";

const SLOW_REQUEST_THRESHOLD_MS = 3000;

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url } = request;
    const now = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - now;
        const logMessage = `${method} ${url} — ${duration}ms`;

        if (duration > SLOW_REQUEST_THRESHOLD_MS) {
          this.logger.warn(`SLOW: ${logMessage}`);
        } else {
          this.logger.log(logMessage);
        }
      }),
    );
  }
}
```

**Why good:** Named constant for slow threshold, warns on slow requests, uses `tap` (side effect without transforming data), scoped Logger

### Good Example — Cache Interceptor

```typescript
// interceptors/cache.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable, of } from "rxjs";
import { tap } from "rxjs/operators";
import type { Request } from "express";

const CACHE_TTL_MS = 60_000; // 1 minute

interface CacheEntry {
  data: unknown;
  expiry: number;
}

@Injectable()
export class SimpleCacheInterceptor implements NestInterceptor {
  private readonly cache = new Map<string, CacheEntry>();

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();

    // Only cache GET requests
    if (request.method !== "GET") {
      return next.handle();
    }

    const cacheKey = request.url;
    const cached = this.cache.get(cacheKey);

    if (cached && cached.expiry > Date.now()) {
      return of(cached.data);
    }

    return next.handle().pipe(
      tap((data) => {
        this.cache.set(cacheKey, {
          data,
          expiry: Date.now() + CACHE_TTL_MS,
        });
      }),
    );
  }
}
```

**Why good:** Only caches GET requests, TTL-based expiry, `of()` returns cached value as Observable, named constant for TTL

### Applying Interceptors

```typescript
// Apply to a single route
@UseInterceptors(LoggingInterceptor)
@Get()
findAll() { /* ... */ }

// Apply to all routes in a controller
@UseInterceptors(LoggingInterceptor)
@Controller('users')
export class UsersController { /* ... */ }

// Apply globally in main.ts
app.useGlobalInterceptors(new TransformResponseInterceptor());

// Apply globally with DI (can inject dependencies)
@Module({
  providers: [
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}
```

---

## Pattern 2: Custom Pipes

Pipes transform and validate input data before it reaches the handler.

### Good Example — Using Built-in ParseDatePipe (NestJS 11+)

```typescript
// NestJS 11 includes ParseDatePipe — no custom pipe needed
import { ParseDatePipe } from '@nestjs/common';

@Get('events')
findByDate(@Query('date', ParseDatePipe) date: Date) {
  return this.eventsService.findByDate(date);
}
```

**Why good:** Built-in pipe handles validation and transformation, throws `BadRequestException` for invalid dates, no custom code needed

### Good Example — Custom Pipe (for domain-specific validation)

```typescript
// pipes/parse-positive-int.pipe.ts
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class ParsePositiveIntPipe implements PipeTransform<string, number> {
  transform(value: string): number {
    const num = parseInt(value, 10);

    if (isNaN(num) || num <= 0) {
      throw new BadRequestException(
        `"${value}" is not a valid positive integer.`,
      );
    }

    return num;
  }
}

// Usage
@Get('items')
findByPage(@Query('page', ParsePositiveIntPipe) page: number) {
  return this.itemsService.findPage(page);
}
```

**Why good:** Custom pipe for domain validation beyond built-ins, typed input/output with `PipeTransform<string, number>`, descriptive error

### Good Example — Enum Validation Pipe

```typescript
// pipes/parse-enum.pipe.ts
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class ParseEnumPipe<T extends Record<string, string>>
  implements PipeTransform<string, string>
{
  constructor(private readonly enumType: T) {}

  transform(value: string): string {
    const enumValues = Object.values(this.enumType);

    if (!enumValues.includes(value)) {
      throw new BadRequestException(
        `"${value}" is not valid. Expected one of: ${enumValues.join(', ')}`,
      );
    }

    return value;
  }
}

// Usage
enum OrderStatus {
  Pending = 'pending',
  Processing = 'processing',
  Shipped = 'shipped',
  Delivered = 'delivered',
}

@Get()
findByStatus(
  @Query('status', new ParseEnumPipe(OrderStatus)) status: string,
) {
  return this.ordersService.findByStatus(status);
}
```

**Why good:** Generic enum validation, descriptive error message lists valid values, reusable across different enums

---

## Pattern 3: Custom Decorators

### Good Example — Combined Decorators

```typescript
// decorators/api-paginated.decorator.ts
import { applyDecorators, Get, UseInterceptors } from '@nestjs/common';
import { TransformResponseInterceptor } from '../interceptors/transform-response.interceptor';

export function ApiPaginated(path?: string) {
  return applyDecorators(
    Get(path),
    UseInterceptors(TransformResponseInterceptor),
  );
}

// Usage — replaces @Get() + @UseInterceptors(...)
@ApiPaginated()
findAll(@Query() query: QueryProductsDto) {
  return this.productsService.findAll(query);
}
```

**Why good:** `applyDecorators` composes multiple decorators, reduces boilerplate on controller methods, single source of truth for endpoint configuration

### Good Example — Param Decorator with Validation

```typescript
// decorators/user-agent.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export const UserAgent = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.headers['user-agent'] ?? 'unknown';
  },
);

// Usage
@Get()
findAll(@UserAgent() userAgent: string) {
  this.logger.log(`Request from: ${userAgent}`);
  return this.productsService.findAll();
}
```

### Good Example — Method Decorator for Metadata

```typescript
// decorators/cache-ttl.decorator.ts
import { SetMetadata } from '@nestjs/common';

const CACHE_TTL_KEY = 'cacheTtl';
const DEFAULT_CACHE_TTL_MS = 60_000;

export const CacheTtl = (ttlMs: number = DEFAULT_CACHE_TTL_MS) =>
  SetMetadata(CACHE_TTL_KEY, ttlMs);

// Usage
@Get('popular')
@CacheTtl(300_000) // 5 minutes
getPopularProducts() {
  return this.productsService.getPopular();
}
```

**Why good:** Named constant for default TTL and metadata key, `SetMetadata` stores value for interceptor/guard to read via `Reflector`, clean API

---

## Pattern 4: Config Module Patterns

### Good Example — Typed Configuration

```typescript
// config/database.config.ts
import { registerAs } from "@nestjs/config";

export const databaseConfig = registerAs("database", () => ({
  host: process.env.DB_HOST ?? "localhost",
  port: parseInt(process.env.DB_PORT ?? "5432", 10),
  username: process.env.DB_USER ?? "postgres",
  password: process.env.DB_PASSWORD ?? "",
  name: process.env.DB_NAME ?? "app",
}));
```

```typescript
// config/app.config.ts
import { registerAs } from "@nestjs/config";

const DEFAULT_PORT = 3000;

export const appConfig = registerAs("app", () => ({
  port: parseInt(process.env.PORT ?? String(DEFAULT_PORT), 10),
  nodeEnv: process.env.NODE_ENV ?? "development",
  apiPrefix: process.env.API_PREFIX ?? "api/v1",
}));
```

```typescript
// app.module.ts
import { ConfigModule } from "@nestjs/config";
import { databaseConfig } from "./config/database.config";
import { appConfig } from "./config/app.config";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, appConfig],
    }),
  ],
})
export class AppModule {}
```

```typescript
// Usage with injection
import { Inject, Injectable } from "@nestjs/common";
import { ConfigType } from "@nestjs/config";
import { databaseConfig } from "../config/database.config";

@Injectable()
export class DatabaseService {
  constructor(
    @Inject(databaseConfig.KEY)
    private readonly dbConfig: ConfigType<typeof databaseConfig>,
  ) {
    // Fully typed: this.dbConfig.host, this.dbConfig.port, etc.
  }
}
```

**Why good:** `registerAs` creates namespaced config, `ConfigType` provides full type inference, `isGlobal: true` avoids importing ConfigModule everywhere, defaults for development

---

## Pattern 5: CQRS Pattern

For complex domains, separate read and write operations.

### Command

```typescript
// orders/commands/create-order.command.ts
export class CreateOrderCommand {
  constructor(
    public readonly userId: number,
    public readonly items: Array<{ productId: number; quantity: number }>,
  ) {}
}
```

### Command Handler

```typescript
// orders/commands/handlers/create-order.handler.ts
import { CommandHandler, ICommandHandler, EventBus } from "@nestjs/cqrs";
import { CreateOrderCommand } from "../create-order.command";
import { OrderCreatedEvent } from "../../events/order-created.event";

@CommandHandler(CreateOrderCommand)
export class CreateOrderHandler implements ICommandHandler<CreateOrderCommand> {
  constructor(
    private readonly ordersRepository: OrdersRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: CreateOrderCommand) {
    const order = await this.ordersRepository.create({
      userId: command.userId,
      items: command.items,
      status: "pending",
    });

    this.eventBus.publish(new OrderCreatedEvent(order.id, command.userId));

    return order;
  }
}
```

### Event and Event Handler

```typescript
// orders/events/order-created.event.ts
export class OrderCreatedEvent {
  constructor(
    public readonly orderId: number,
    public readonly userId: number,
  ) {}
}
```

```typescript
// orders/events/handlers/order-created.handler.ts
import { EventsHandler, IEventHandler } from "@nestjs/cqrs";
import { OrderCreatedEvent } from "../order-created.event";
import { NotificationsService } from "../../../notifications/notifications.service";

@EventsHandler(OrderCreatedEvent)
export class OrderCreatedHandler implements IEventHandler<OrderCreatedEvent> {
  constructor(private readonly notificationsService: NotificationsService) {}

  async handle(event: OrderCreatedEvent) {
    await this.notificationsService.sendOrderConfirmation(
      event.userId,
      event.orderId,
    );
  }
}
```

### Controller Using CQRS

```typescript
// orders/orders.controller.ts
import { Controller, Post, Body } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { CreateOrderCommand } from "./commands/create-order.command";
import { GetOrderQuery } from "./queries/get-order.query";
import { CurrentUser } from "../auth/decorators/current-user.decorator";

@Controller("orders")
export class OrdersController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  createOrder(@CurrentUser("id") userId: number, @Body() dto: CreateOrderDto) {
    return this.commandBus.execute(new CreateOrderCommand(userId, dto.items));
  }

  @Get(":id")
  getOrder(@Param("id", ParseIntPipe) id: number) {
    return this.queryBus.execute(new GetOrderQuery(id));
  }
}
```

**Why good:** Clean separation of read/write concerns, event-driven side effects (notifications), controller doesn't know about business logic details, commands and queries are plain classes (easy to test)

**When to use:** Complex domains with many side effects, systems where read and write models differ significantly, event-sourced architectures

**When not to use:** Simple CRUD applications (overkill), small teams (unnecessary complexity)

---

## Pattern 6: Swagger/OpenAPI Documentation

### Setup

```typescript
// main.ts
import { NestFactory } from "@nestjs/core";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { AppModule } from "./app.module";

const PORT = 3000;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle("My API")
    .setDescription("API documentation")
    .setVersion("1.0")
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document);

  await app.listen(PORT);
}
bootstrap();
```

### DTO with Swagger Decorators

```typescript
// users/dto/create-user.dto.ts
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsString, MinLength, IsOptional } from "class-validator";

const MIN_PASSWORD_LENGTH = 8;

export class CreateUserDto {
  @ApiProperty({ example: "alice@example.com" })
  @IsEmail()
  email: string;

  @ApiProperty({ minLength: MIN_PASSWORD_LENGTH })
  @IsString()
  @MinLength(MIN_PASSWORD_LENGTH)
  password: string;

  @ApiProperty({ example: "Alice" })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: "user", enum: ["user", "admin"] })
  @IsOptional()
  @IsString()
  role?: string;
}
```

### Controller with Swagger Decorators

```typescript
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from "@nestjs/swagger";

@ApiTags("users")
@ApiBearerAuth()
@Controller("users")
export class UsersController {
  @ApiOperation({ summary: "Create a new user" })
  @ApiResponse({ status: 201, description: "User created successfully" })
  @ApiResponse({ status: 400, description: "Validation failed" })
  @ApiResponse({ status: 409, description: "Email already exists" })
  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }
}
```

**Why good:** Auto-generated API docs at `/api/docs`, `@ApiProperty` examples appear in Swagger UI, `@ApiResponse` documents all possible outcomes, `@ApiBearerAuth` adds auth to Swagger UI

---

_For core patterns, see [core.md](core.md). For database patterns, see [database.md](database.md). For auth patterns, see [auth.md](auth.md). For testing, see [testing.md](testing.md)._
