# NestJS Database Integration Examples

> NestJS DI integration patterns for database access. These examples show how to wrap your ORM in NestJS modules and services — not the ORM API itself. See [SKILL.md](../SKILL.md) for core concepts.

---

## Pattern 1: Prisma Integration

NestJS integrates Prisma via a custom service that wraps `PrismaClient` with lifecycle hooks.

### PrismaService

```typescript
// prisma/prisma.service.ts
import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    await this.$connect();
    this.logger.log("Prisma connected to database");
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log("Prisma disconnected from database");
  }
}
```

### PrismaModule

```typescript
// prisma/prisma.module.ts
import { Module, Global } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

**Why good:** `@Global()` makes PrismaService available everywhere without importing PrismaModule, lifecycle hooks handle connect/disconnect, extends PrismaClient for full API access

### Service Using Prisma

```typescript
// users/users.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Prisma } from "@prisma/client";
import type { CreateUserDto } from "./dto/create-user.dto";
import type { UpdateUserDto } from "./dto/update-user.dto";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(page = DEFAULT_PAGE, limit = DEFAULT_LIMIT) {
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
        },
      }),
      this.prisma.user.count(),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { posts: true },
    });

    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }

    return user;
  }

  async create(dto: CreateUserDto) {
    try {
      return await this.prisma.user.create({
        data: dto,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException(
          `User with email ${dto.email} already exists`,
        );
      }
      throw error;
    }
  }

  async update(id: number, dto: UpdateUserDto) {
    try {
      return await this.prisma.user.update({
        where: { id },
        data: dto,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw new NotFoundException(`User with id ${id} not found`);
      }
      throw error;
    }
  }

  async remove(id: number) {
    try {
      await this.prisma.user.delete({ where: { id } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw new NotFoundException(`User with id ${id} not found`);
      }
      throw error;
    }
  }
}
```

**Why good:** Handles Prisma-specific error codes (P2002 for unique constraint, P2025 for not found), `select` for query optimization, `Promise.all` for parallel count + data queries, paginated response

---

## Pattern 2: TypeORM Integration

TypeORM provides decorator-based entity definitions and a repository pattern.

### Entity

```typescript
// users/entities/user.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from "typeorm";
import { Post } from "../../posts/entities/post.entity";

@Entity("users")
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column()
  name: string;

  @Column({ select: false })
  password: string;

  @Column({ default: "user" })
  role: string;

  @OneToMany(() => Post, (post) => post.author)
  posts: Post[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

### Module with TypeORM

```typescript
// users/users.module.ts
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "./entities/user.entity";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

### Service with Repository

```typescript
// users/users.service.ts
import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "./entities/user.entity";
import type { CreateUserDto } from "./dto/create-user.dto";

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async findAll(): Promise<User[]> {
    return this.usersRepository.find({
      order: { createdAt: "DESC" },
    });
  }

  async findOne(id: number): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: ["posts"],
    });

    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }

    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email },
      select: ["id", "email", "name", "password", "role"],
    });
  }

  async create(dto: CreateUserDto): Promise<User> {
    const user = this.usersRepository.create(dto);
    return this.usersRepository.save(user);
  }

  async update(id: number, dto: Partial<CreateUserDto>): Promise<User> {
    const user = await this.findOne(id);
    Object.assign(user, dto);
    return this.usersRepository.save(user);
  }

  async remove(id: number): Promise<void> {
    const result = await this.usersRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`User with id ${id} not found`);
    }
  }
}
```

**Why good:** `@InjectRepository` for DI-friendly repository access, `select` for sensitive fields (password), relation loading, `create()` + `save()` pattern for proper entity lifecycle

### Root Module with TypeORM Config

```typescript
// app.module.ts
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConfigModule, ConfigService } from "@nestjs/config";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: "postgres",
        host: configService.get("DB_HOST"),
        port: configService.get<number>("DB_PORT"),
        username: configService.get("DB_USER"),
        password: configService.get("DB_PASSWORD"),
        database: configService.get("DB_NAME"),
        autoLoadEntities: true,
        synchronize: configService.get("NODE_ENV") !== "production",
      }),
    }),
  ],
})
export class AppModule {}
```

**Why good:** Async config from environment variables, `autoLoadEntities` avoids manual entity registration, `synchronize` disabled in production (use migrations)

---

## Pattern 3: Transactions

### Prisma Transaction

```typescript
// orders/orders.service.ts
@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async createOrder(dto: CreateOrderDto) {
    return this.prisma.$transaction(async (tx) => {
      // Create order
      const order = await tx.order.create({
        data: {
          userId: dto.userId,
          status: "pending",
        },
      });

      // Create order items and update stock
      for (const item of dto.items) {
        await tx.orderItem.create({
          data: {
            orderId: order.id,
            productId: item.productId,
            quantity: item.quantity,
          },
        });

        // Decrement stock
        const product = await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });

        if (product.stock < 0) {
          throw new BadRequestException(
            `Insufficient stock for product ${item.productId}`,
          );
        }
      }

      return order;
    });
  }
}
```

**Why good:** Interactive transaction ensures atomicity, stock check inside transaction prevents race conditions, error rolls back all changes

### TypeORM Transaction

```typescript
@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    private readonly dataSource: DataSource,
  ) {}

  async createOrder(dto: CreateOrderDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const order = queryRunner.manager.create(Order, {
        userId: dto.userId,
        status: "pending",
      });
      await queryRunner.manager.save(order);

      for (const item of dto.items) {
        const orderItem = queryRunner.manager.create(OrderItem, {
          orderId: order.id,
          ...item,
        });
        await queryRunner.manager.save(orderItem);
      }

      await queryRunner.commitTransaction();
      return order;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
```

**Why good:** Explicit transaction control with commit/rollback, `finally` ensures queryRunner release, manager operations within transaction scope

---

_For auth patterns, see [auth.md](auth.md). For testing, see [testing.md](testing.md). For advanced patterns, see [advanced.md](advanced.md)._
