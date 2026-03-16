# NestJS Authentication Examples

> Passport.js integration, JWT strategy, and auth guards for NestJS. See [SKILL.md](../SKILL.md) for core concepts.

---

## Pattern 1: JWT Authentication with Passport

### Auth Module Setup

```typescript
// auth/auth.module.ts
import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { LocalStrategy } from "./strategies/local.strategy";
import { UsersModule } from "../users/users.module";

const JWT_EXPIRATION = "1h";

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>("JWT_SECRET"),
        signOptions: { expiresIn: JWT_EXPIRATION },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, LocalStrategy],
  exports: [AuthService],
})
export class AuthModule {}
```

**Why good:** Async JWT config reads secret from environment, named constant for expiration, imports `UsersModule` for user lookup, exports `AuthService` for use by other modules

### Auth Service

```typescript
// auth/auth.service.ts
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { UsersService } from "../users/users.service";

const BCRYPT_SALT_ROUNDS = 10;

interface JwtPayload {
  sub: number;
  email: string;
  role: string;
}

interface TokenResponse {
  accessToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    // Return user without password
    const { password: _password, ...result } = user;
    return result;
  }

  async login(user: {
    id: number;
    email: string;
    role: string;
  }): Promise<TokenResponse> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    return {
      accessToken: this.jwtService.sign(payload),
    };
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
  }
}
```

**Why good:** Named constant for salt rounds, generic error message ("Invalid credentials") prevents user enumeration, strips password from returned user, typed JWT payload

### Local Strategy (Username/Password)

```typescript
// auth/strategies/local.strategy.ts
import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-local";
import { AuthService } from "../auth.service";

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({ usernameField: "email" }); // Use email instead of username
  }

  async validate(email: string, password: string) {
    return this.authService.validateUser(email, password);
  }
}
```

**Why good:** `usernameField: 'email'` configures Passport to use email, `validate()` delegates to AuthService, return value is attached to `request.user`

### JWT Strategy (Token Verification)

```typescript
// auth/strategies/jwt.strategy.ts
import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";

interface JwtPayload {
  sub: number;
  email: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>("JWT_SECRET"),
    });
  }

  async validate(payload: JwtPayload) {
    // Return value is attached to request.user
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  }
}
```

**Why good:** Extracts token from `Authorization: Bearer <token>` header, secret from config (not hardcoded), `validate()` maps JWT claims to user object

### Auth Controller

```typescript
// auth/auth.controller.ts
import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  @UseGuards(AuthGuard("local"))
  @HttpCode(HttpStatus.OK)
  async login(
    @Request() req: { user: { id: number; email: string; role: string } },
  ) {
    return this.authService.login(req.user);
  }
}
```

### Login DTO

```typescript
// auth/dto/login.dto.ts
import { IsEmail, IsString, MinLength } from "class-validator";

const MIN_PASSWORD_LENGTH = 8;

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(MIN_PASSWORD_LENGTH)
  password: string;
}
```

---

## Pattern 2: Auth Guards for Route Protection

### JWT Auth Guard

```typescript
// auth/guards/jwt-auth.guard.ts
import { Injectable, ExecutionContext } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Reflector } from "@nestjs/core";

const IS_PUBLIC_KEY = "isPublic";

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // Check for @Public() decorator
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }
}
```

### Public Decorator

```typescript
// auth/decorators/public.decorator.ts
import { SetMetadata } from "@nestjs/common";

const IS_PUBLIC_KEY = "isPublic";

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

### Current User Decorator

```typescript
// auth/decorators/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from "@nestjs/common";

interface AuthUser {
  id: number;
  email: string;
  role: string;
}

export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthUser;
    return data ? user[data] : user;
  },
);
```

### Global Guard Registration

```typescript
// app.module.ts
import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { JwtAuthGuard } from "./auth/guards/jwt-auth.guard";

@Module({
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
```

### Usage in Controllers

```typescript
// users/users.controller.ts
import { Controller, Get, Param, ParseIntPipe } from "@nestjs/common";
import { Public } from "../auth/decorators/public.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";

@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // Public endpoint — no auth required
  @Public()
  @Get("count")
  getUserCount() {
    return this.usersService.count();
  }

  // Protected — requires valid JWT (global guard)
  @Get("me")
  getProfile(@CurrentUser() user: AuthUser) {
    return this.usersService.findOne(user.id);
  }

  // Protected — requires valid JWT + specific role
  @Get(":id")
  @Roles("admin")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }
}
```

**Why good:** Global guard protects all routes by default, `@Public()` opts out specific endpoints, `@CurrentUser()` extracts typed user from request, `@Roles()` adds role-based access control

---

## Pattern 3: Role-Based Access Control (RBAC)

### Roles Guard

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

    // No roles required — allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      throw new ForbiddenException("No user found on request");
    }

    const hasRole = requiredRoles.includes(user.role);
    if (!hasRole) {
      throw new ForbiddenException(
        `Required roles: ${requiredRoles.join(", ")}`,
      );
    }

    return true;
  }
}
```

### Roles Decorator

```typescript
// auth/decorators/roles.decorator.ts
import { SetMetadata } from "@nestjs/common";

const ROLES_KEY = "roles";

export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
```

### Register as Global Guard

```typescript
// app.module.ts
import { APP_GUARD } from "@nestjs/core";

@Module({
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
```

**Why good:** Global guards apply to all routes automatically, `Reflector` reads metadata from decorators, guards compose in order (JWT first, then roles), explicit error messages for debugging

---

_For database patterns, see [database.md](database.md). For testing, see [testing.md](testing.md). For advanced patterns, see [advanced.md](advanced.md)._
