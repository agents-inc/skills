# NestJS Testing Examples

> Unit testing services with mocks, e2e testing with supertest. See [SKILL.md](../SKILL.md) for core concepts.

---

## Pattern 1: Unit Testing Services

Use NestJS `Test.createTestingModule()` to create an isolated testing module with mocked dependencies.

### Good Example — Testing a Service

```typescript
// users/users.service.spec.ts
import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException, ConflictException } from "@nestjs/common";
import { UsersService } from "./users.service";
import { PrismaService } from "../prisma/prisma.service";

const MOCK_USER = {
  id: 1,
  email: "alice@example.com",
  name: "Alice",
  role: "user",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const MOCK_CREATE_DTO = {
  email: "bob@example.com",
  name: "Bob",
  password: "hashed_password",
};

describe("UsersService", () => {
  let service: UsersService;
  let prisma: PrismaService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get<PrismaService>(PrismaService);

    // Reset mocks between tests
    jest.clearAllMocks();
  });

  describe("findOne", () => {
    it("should return a user when found", async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(MOCK_USER);

      const result = await service.findOne(1);

      expect(result).toEqual(MOCK_USER);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: { posts: true },
      });
    });

    it("should throw NotFoundException when user not found", async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe("create", () => {
    it("should create and return a new user", async () => {
      const newUser = {
        id: 2,
        ...MOCK_CREATE_DTO,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrismaService.user.create.mockResolvedValue(newUser);

      const result = await service.create(MOCK_CREATE_DTO);

      expect(result).toEqual(newUser);
      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: MOCK_CREATE_DTO,
      });
    });

    it("should throw ConflictException on duplicate email", async () => {
      const prismaError = new Error("Unique constraint failed");
      Object.assign(prismaError, { code: "P2002" });
      mockPrismaService.user.create.mockRejectedValue(prismaError);

      await expect(service.create(MOCK_CREATE_DTO)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe("remove", () => {
    it("should delete a user", async () => {
      mockPrismaService.user.delete.mockResolvedValue(MOCK_USER);

      await service.remove(1);

      expect(mockPrismaService.user.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it("should throw NotFoundException when deleting non-existent user", async () => {
      const prismaError = new Error("Record not found");
      Object.assign(prismaError, { code: "P2025" });
      mockPrismaService.user.delete.mockRejectedValue(prismaError);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });
});
```

**Why good:** `Test.createTestingModule` mirrors the real module, mock Prisma methods with `jest.fn()`, test both happy path and error cases, `jest.clearAllMocks()` prevents test pollution, named constants for test data

### Bad Example — Testing with Real Database

```typescript
// BAD: Unit test hitting real database
describe("UsersService", () => {
  let service: UsersService;

  beforeAll(async () => {
    // BAD: Using real PrismaService connects to database
    const module = await Test.createTestingModule({
      providers: [UsersService, PrismaService],
    }).compile();

    service = module.get(UsersService);
  });

  it("should find users", async () => {
    // BAD: Depends on database state
    const users = await service.findAll();
    expect(users).toBeDefined();
  });
});
```

**Why bad:** Unit tests should not hit real databases, tests become flaky depending on database state, slow execution, not isolated

---

## Pattern 2: Unit Testing Controllers

### Good Example — Testing Controller with Mocked Service

```typescript
// users/users.controller.spec.ts
import { Test, TestingModule } from "@nestjs/testing";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

const MOCK_USER = {
  id: 1,
  email: "alice@example.com",
  name: "Alice",
  role: "user",
};

const MOCK_USERS_RESPONSE = {
  items: [MOCK_USER],
  total: 1,
  page: 1,
  limit: 20,
  totalPages: 1,
};

describe("UsersController", () => {
  let controller: UsersController;

  const mockUsersService = {
    findAll: jest.fn().mockResolvedValue(MOCK_USERS_RESPONSE),
    findOne: jest.fn().mockResolvedValue(MOCK_USER),
    create: jest.fn().mockResolvedValue(MOCK_USER),
    update: jest.fn().mockResolvedValue(MOCK_USER),
    remove: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    jest.clearAllMocks();
  });

  describe("findAll", () => {
    it("should return paginated users", async () => {
      const result = await controller.findAll({ page: 1, limit: 20 });

      expect(result).toEqual(MOCK_USERS_RESPONSE);
      expect(mockUsersService.findAll).toHaveBeenCalledWith(1, 20);
    });
  });

  describe("findOne", () => {
    it("should return a single user", async () => {
      const result = await controller.findOne(1);

      expect(result).toEqual(MOCK_USER);
      expect(mockUsersService.findOne).toHaveBeenCalledWith(1);
    });
  });

  describe("create", () => {
    it("should create a user", async () => {
      const dto = {
        email: "alice@example.com",
        name: "Alice",
        password: "password123",
      };
      const result = await controller.create(dto);

      expect(result).toEqual(MOCK_USER);
      expect(mockUsersService.create).toHaveBeenCalledWith(dto);
    });
  });
});
```

**Why good:** Controllers are thin, so tests verify delegation to service, mock service prevents testing business logic twice, tests verify correct arguments passed to service

---

## Pattern 3: Unit Testing Guards

### Good Example — Testing a Custom Guard

```typescript
// auth/guards/roles.guard.spec.ts
import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RolesGuard } from "./roles.guard";

function createMockExecutionContext(
  user: { role: string } | undefined,
  requiredRoles: string[] | undefined,
): ExecutionContext {
  const mockReflector = {
    getAllAndOverride: jest.fn().mockReturnValue(requiredRoles),
  };

  const context = {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
  } as unknown as ExecutionContext;

  return context;
}

describe("RolesGuard", () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it("should allow access when no roles are required", () => {
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(undefined);
    const context = createMockExecutionContext({ role: "user" }, undefined);

    expect(guard.canActivate(context)).toBe(true);
  });

  it("should allow access when user has required role", () => {
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(["admin"]);
    const context = createMockExecutionContext({ role: "admin" }, ["admin"]);

    expect(guard.canActivate(context)).toBe(true);
  });

  it("should deny access when user lacks required role", () => {
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(["admin"]);
    const context = createMockExecutionContext({ role: "user" }, ["admin"]);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
```

**Why good:** Tests all three paths (no roles required, role match, role mismatch), mock ExecutionContext matches NestJS interface, verifies guard throws correct exception type

---

## Pattern 4: E2E Testing with Supertest

### Good Example — Full API Integration Test

```typescript
// test/users.e2e-spec.ts
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe, HttpStatus } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

describe("UsersController (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Mirror production configuration
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean database between tests
    await prisma.user.deleteMany();
  });

  describe("POST /users", () => {
    it("should create a user with valid data", () => {
      return request(app.getHttpServer())
        .post("/users")
        .send({
          email: "alice@example.com",
          name: "Alice",
          password: "securepassword",
        })
        .expect(HttpStatus.CREATED)
        .expect((res) => {
          expect(res.body).toHaveProperty("id");
          expect(res.body.email).toBe("alice@example.com");
          expect(res.body.name).toBe("Alice");
          // Password should NOT be in response
          expect(res.body).not.toHaveProperty("password");
        });
    });

    it("should reject invalid email", () => {
      return request(app.getHttpServer())
        .post("/users")
        .send({
          email: "not-an-email",
          name: "Alice",
          password: "securepassword",
        })
        .expect(HttpStatus.BAD_REQUEST)
        .expect((res) => {
          expect(res.body.message).toContain("email must be an email");
        });
    });

    it("should reject unknown properties", () => {
      return request(app.getHttpServer())
        .post("/users")
        .send({
          email: "alice@example.com",
          name: "Alice",
          password: "securepassword",
          isAdmin: true, // Unknown property
        })
        .expect(HttpStatus.BAD_REQUEST);
    });

    it("should reject duplicate email", async () => {
      // Create first user
      await request(app.getHttpServer())
        .post("/users")
        .send({
          email: "alice@example.com",
          name: "Alice",
          password: "securepassword",
        })
        .expect(HttpStatus.CREATED);

      // Try duplicate
      return request(app.getHttpServer())
        .post("/users")
        .send({
          email: "alice@example.com",
          name: "Alice 2",
          password: "securepassword",
        })
        .expect(HttpStatus.CONFLICT);
    });
  });

  describe("GET /users/:id", () => {
    it("should return a user", async () => {
      const createRes = await request(app.getHttpServer()).post("/users").send({
        email: "alice@example.com",
        name: "Alice",
        password: "securepassword",
      });

      return request(app.getHttpServer())
        .get(`/users/${createRes.body.id}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.email).toBe("alice@example.com");
        });
    });

    it("should return 404 for non-existent user", () => {
      return request(app.getHttpServer())
        .get("/users/99999")
        .expect(HttpStatus.NOT_FOUND);
    });
  });

  describe("DELETE /users/:id", () => {
    it("should delete a user", async () => {
      const createRes = await request(app.getHttpServer()).post("/users").send({
        email: "alice@example.com",
        name: "Alice",
        password: "securepassword",
      });

      await request(app.getHttpServer())
        .delete(`/users/${createRes.body.id}`)
        .expect(HttpStatus.NO_CONTENT);

      // Verify deleted
      return request(app.getHttpServer())
        .get(`/users/${createRes.body.id}`)
        .expect(HttpStatus.NOT_FOUND);
    });
  });
});
```

**Why good:** Mirrors production config (ValidationPipe), tests HTTP status codes and response shapes, cleans database between tests, verifies validation rejects invalid data, tests the full request-response cycle

### Bad Example — E2E Test Without Validation Setup

```typescript
// BAD: Missing ValidationPipe — validation not tested
describe("UsersController (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // BAD: No ValidationPipe — invalid data will pass through
    await app.init();
  });

  it("should validate input", () => {
    // This test PASSES even though email is invalid
    // because ValidationPipe is not configured
    return request(app.getHttpServer())
      .post("/users")
      .send({ email: "not-an-email" })
      .expect(201); // BAD: Should be 400
  });
});
```

**Why bad:** E2E tests without ValidationPipe don't test validation, invalid data passes through, tests give false confidence

---

## Pattern 5: Testing Auth-Protected Routes

### Good Example — E2E with Authentication

```typescript
// test/auth.e2e-spec.ts
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe, HttpStatus } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../src/app.module";

describe("Auth (e2e)", () => {
  let app: INestApplication;
  let accessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("should register a new user", () => {
    return request(app.getHttpServer())
      .post("/auth/register")
      .send({
        email: "test@example.com",
        name: "Test User",
        password: "securepassword",
      })
      .expect(HttpStatus.CREATED);
  });

  it("should login and receive JWT", async () => {
    const res = await request(app.getHttpServer())
      .post("/auth/login")
      .send({
        email: "test@example.com",
        password: "securepassword",
      })
      .expect(HttpStatus.OK);

    expect(res.body).toHaveProperty("accessToken");
    accessToken = res.body.accessToken;
  });

  it("should access protected route with token", () => {
    return request(app.getHttpServer())
      .get("/users/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(HttpStatus.OK)
      .expect((res) => {
        expect(res.body.email).toBe("test@example.com");
      });
  });

  it("should reject protected route without token", () => {
    return request(app.getHttpServer())
      .get("/users/me")
      .expect(HttpStatus.UNAUTHORIZED);
  });

  it("should reject invalid token", () => {
    return request(app.getHttpServer())
      .get("/users/me")
      .set("Authorization", "Bearer invalid-token")
      .expect(HttpStatus.UNAUTHORIZED);
  });
});
```

**Why good:** Tests full auth flow (register, login, access protected route), verifies both valid and invalid tokens, uses `.set('Authorization', ...)` for bearer token, tests guard behavior end-to-end

---

_For core patterns, see [core.md](core.md). For database patterns, see [database.md](database.md). For advanced patterns, see [advanced.md](advanced.md)._
