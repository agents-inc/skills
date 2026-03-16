# NestJS Core Examples

> Complete code examples for NestJS modules, controllers, services, DTOs, and exception handling. See [SKILL.md](../SKILL.md) for core concepts.

**More examples:** See [database.md](database.md), [auth.md](auth.md), [testing.md](testing.md), and [advanced.md](advanced.md).

---

## Pattern 1: Feature Module — Complete CRUD

A complete feature module with controller, service, DTOs, and proper error handling.

### Module

```typescript
// products/products.module.ts
import { Module } from "@nestjs/common";
import { ProductsController } from "./products.controller";
import { ProductsService } from "./products.service";

@Module({
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
```

### DTOs

```typescript
// products/dto/create-product.dto.ts
import {
  IsString,
  IsNumber,
  IsPositive,
  IsOptional,
  IsArray,
  MaxLength,
  Min,
} from "class-validator";
import { Type } from "class-transformer";

const MAX_NAME_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 2000;
const MIN_PRICE = 0.01;

export class CreateProductDto {
  @IsString()
  @MaxLength(MAX_NAME_LENGTH)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_DESCRIPTION_LENGTH)
  description?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Min(MIN_PRICE)
  price: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  stock?: number;
}
```

```typescript
// products/dto/update-product.dto.ts
import { PartialType } from "@nestjs/mapped-types";
import { CreateProductDto } from "./create-product.dto";

export class UpdateProductDto extends PartialType(CreateProductDto) {}
```

```typescript
// products/dto/query-products.dto.ts
import { IsOptional, IsString, IsNumber, Min, IsEnum } from "class-validator";
import { Type } from "class-transformer";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

enum SortOrder {
  Asc = "asc",
  Desc = "desc",
}

export class QueryProductsDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = DEFAULT_PAGE;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = DEFAULT_LIMIT;

  @IsOptional()
  @IsEnum(SortOrder)
  sort?: SortOrder = SortOrder.Desc;
}
```

**Why good:** Named constants for limits, `@Type(() => Number)` converts query string params, enum for sort order, defaults in class properties, `PartialType` reuses create DTO

### Service

```typescript
// products/products.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from "@nestjs/common";
import type { CreateProductDto } from "./dto/create-product.dto";
import type { UpdateProductDto } from "./dto/update-product.dto";
import type { QueryProductsDto } from "./dto/query-products.dto";

interface Product {
  id: number;
  name: string;
  description?: string;
  price: number;
  tags: string[];
  stock: number;
  createdAt: Date;
  updatedAt: Date;
}

const DEFAULT_STOCK = 0;

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);
  private readonly products: Product[] = [];
  private nextId = 1;

  findAll(query: QueryProductsDto) {
    let results = [...this.products];

    // Filter by search
    if (query.search) {
      const searchLower = query.search.toLowerCase();
      results = results.filter(
        (p) =>
          p.name.toLowerCase().includes(searchLower) ||
          p.description?.toLowerCase().includes(searchLower),
      );
    }

    // Sort
    results.sort((a, b) => {
      const modifier = query.sort === "asc" ? 1 : -1;
      return (a.createdAt.getTime() - b.createdAt.getTime()) * modifier;
    });

    // Paginate
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const start = (page - 1) * limit;
    const items = results.slice(start, start + limit);

    return {
      items,
      total: results.length,
      page,
      limit,
      totalPages: Math.ceil(results.length / limit),
    };
  }

  findOne(id: number): Product {
    const product = this.products.find((p) => p.id === id);
    if (!product) {
      throw new NotFoundException(`Product with id ${id} not found`);
    }
    return product;
  }

  create(dto: CreateProductDto): Product {
    const existing = this.products.find((p) => p.name === dto.name);
    if (existing) {
      throw new ConflictException(`Product "${dto.name}" already exists`);
    }

    const now = new Date();
    const product: Product = {
      id: this.nextId++,
      name: dto.name,
      description: dto.description,
      price: dto.price,
      tags: dto.tags ?? [],
      stock: dto.stock ?? DEFAULT_STOCK,
      createdAt: now,
      updatedAt: now,
    };

    this.products.push(product);
    this.logger.log(`Created product: ${product.name} (id: ${product.id})`);
    return product;
  }

  update(id: number, dto: UpdateProductDto): Product {
    const product = this.findOne(id);
    Object.assign(product, dto, { updatedAt: new Date() });
    this.logger.log(`Updated product: ${product.name} (id: ${product.id})`);
    return product;
  }

  remove(id: number): void {
    const index = this.products.findIndex((p) => p.id === id);
    if (index === -1) {
      throw new NotFoundException(`Product with id ${id} not found`);
    }
    const [removed] = this.products.splice(index, 1);
    this.logger.log(`Removed product: ${removed.name} (id: ${removed.id})`);
  }
}
```

**Why good:** Logger scoped to class name, paginated results with metadata, NestJS exceptions for error cases, typed DTOs via `import type`, named constant for default stock

### Controller

```typescript
// products/products.controller.ts
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
import { ProductsService } from "./products.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { QueryProductsDto } from "./dto/query-products.dto";

@Controller("products")
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findAll(@Query() query: QueryProductsDto) {
    return this.productsService.findAll(query);
  }

  @Get(":id")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.productsService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  @Put(":id")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    return this.productsService.update(id, updateProductDto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.productsService.remove(id);
  }
}
```

**Why good:** Controller is thin (delegates all logic to service), query DTO handles pagination/search/sort, `ParseIntPipe` validates IDs, explicit HTTP status codes

---

## Pattern 2: Dynamic Modules

Dynamic modules accept configuration at import time.

### Good Example — Configurable Module

```typescript
// mailer/mailer.module.ts
import { Module, DynamicModule } from "@nestjs/common";
import { MailerService } from "./mailer.service";

const MAILER_OPTIONS = "MAILER_OPTIONS";

interface MailerOptions {
  host: string;
  port: number;
  from: string;
}

@Module({})
export class MailerModule {
  static forRoot(options: MailerOptions): DynamicModule {
    return {
      module: MailerModule,
      global: true,
      providers: [
        {
          provide: MAILER_OPTIONS,
          useValue: options,
        },
        MailerService,
      ],
      exports: [MailerService],
    };
  }
}
```

```typescript
// mailer/mailer.service.ts
import { Injectable, Inject } from "@nestjs/common";

const MAILER_OPTIONS = "MAILER_OPTIONS";

interface MailerOptions {
  host: string;
  port: number;
  from: string;
}

@Injectable()
export class MailerService {
  constructor(
    @Inject(MAILER_OPTIONS) private readonly options: MailerOptions,
  ) {}

  async sendEmail(to: string, subject: string, body: string) {
    // Use this.options.host, this.options.port, this.options.from
    console.log(`Sending email from ${this.options.from} to ${to}`);
  }
}
```

```typescript
// app.module.ts — Usage
@Module({
  imports: [
    MailerModule.forRoot({
      host: "smtp.example.com",
      port: 587,
      from: "noreply@example.com",
    }),
  ],
})
export class AppModule {}
```

**Why good:** `forRoot()` pattern for configurable modules, `global: true` makes it available everywhere, token-based injection for options, clear options interface

---

## Pattern 3: Global Exception Filter

### Good Example — Structured Error Responses

```typescript
// filters/all-exceptions.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Request, Response } from "express";

interface ErrorResponse {
  statusCode: number;
  message: string | string[];
  error: string;
  timestamp: string;
  path: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let message: string | string[];
    let error: string;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === "object" && exceptionResponse !== null) {
        const responseObj = exceptionResponse as Record<string, unknown>;
        message =
          (responseObj.message as string | string[]) ?? exception.message;
        error = (responseObj.error as string) ?? "Error";
      } else {
        message = exception.message;
        error = "Error";
      }
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = "Internal server error";
      error = "Internal Server Error";

      // Log unexpected errors with stack trace
      this.logger.error(
        `Unexpected error: ${exception instanceof Error ? exception.message : "Unknown"}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    const errorResponse: ErrorResponse = {
      statusCode: status,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(status).json(errorResponse);
  }
}
```

```typescript
// main.ts — Register globally
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./filters/all-exceptions.filter";

const PORT = 3000;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  await app.listen(PORT);
}
bootstrap();
```

**Why good:** Catches all exceptions (not just HttpException), preserves validation error arrays from ValidationPipe, logs unexpected errors with stack trace, consistent response shape

---

## Pattern 4: Nested DTOs and Validation Groups

### Good Example — Complex Validation

```typescript
// orders/dto/create-order.dto.ts
import {
  IsString,
  IsNumber,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  IsPositive,
  IsOptional,
} from "class-validator";
import { Type } from "class-transformer";

const MIN_ORDER_ITEMS = 1;

class OrderItemDto {
  @IsString()
  productId: string;

  @IsNumber()
  @IsPositive()
  quantity: number;
}

class ShippingAddressDto {
  @IsString()
  street: string;

  @IsString()
  city: string;

  @IsString()
  state: string;

  @IsString()
  zipCode: string;

  @IsOptional()
  @IsString()
  country?: string;
}

export class CreateOrderDto {
  @IsArray()
  @ArrayMinSize(MIN_ORDER_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shippingAddress: ShippingAddressDto;

  @IsOptional()
  @IsString()
  notes?: string;
}
```

**Why good:** `@ValidateNested` with `@Type()` validates nested objects, `{ each: true }` validates each array element, named constant for minimum items, complex real-world shape

### Bad Example — Flat DTO for Nested Data

```typescript
// BAD: Flattening nested data into one level
export class CreateOrderDto {
  @IsString()
  productId: string;

  @IsNumber()
  quantity: number;

  @IsString()
  shippingStreet: string;

  @IsString()
  shippingCity: string;
  // ... becomes unwieldy for complex data
}
```

**Why bad:** Flat DTOs don't represent the actual data shape, can't validate nested arrays, becomes unmanageable with complex payloads

---

## Pattern 5: Custom Providers

### Good Example — Factory, Value, and Class Providers

```typescript
// config/providers.ts
import { ConfigService } from "@nestjs/config";

// Value provider — static configuration
export const APP_NAME_PROVIDER = {
  provide: "APP_NAME",
  useValue: "My NestJS App",
};

// Class provider — swap implementations
export const LOGGER_PROVIDER = {
  provide: "LOGGER",
  useClass: process.env.NODE_ENV === "production" ? JsonLogger : ConsoleLogger,
};

// Factory provider — async initialization with dependencies
export const DATABASE_PROVIDER = {
  provide: "DATABASE_CONNECTION",
  useFactory: async (configService: ConfigService) => {
    const host = configService.get<string>("DB_HOST");
    const port = configService.get<number>("DB_PORT");
    return createDatabaseConnection({ host, port });
  },
  inject: [ConfigService],
};
```

```typescript
// Usage — Inject with @Inject token
import { Injectable, Inject } from "@nestjs/common";

@Injectable()
export class AppService {
  constructor(
    @Inject("APP_NAME") private readonly appName: string,
    @Inject("DATABASE_CONNECTION") private readonly db: DatabaseConnection,
  ) {}

  getAppInfo() {
    return { name: this.appName, dbConnected: this.db.isConnected() };
  }
}
```

**Why good:** Value providers for constants, class providers for environment-specific implementations, factory providers for async initialization with injected dependencies, string tokens for non-class providers

---

_For database patterns, see [database.md](database.md). For auth patterns, see [auth.md](auth.md). For testing, see [testing.md](testing.md). For advanced patterns, see [advanced.md](advanced.md)._
