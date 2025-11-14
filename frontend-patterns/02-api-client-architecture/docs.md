# 02. API Client Architecture

> **Quick Guide:** Using OpenAPI? See §2.1. Need type safety? See §2.3. Integrating with React Query? See §2.5.

## 2.1 OpenAPI/Swagger Integration

- Schema-first development approach
- **Using hey-api (@hey-api/client-fetch)** or openapi-typescript
- Type generation from OpenAPI specs
- Keeping schemas in sync with backend
- Automated client regeneration in CI

## 2.2 Client Configuration

- Base URL configuration (environment-specific)
- Authentication handling (tokens, refresh logic)
- Request/response interceptors
- Timeout configuration
- Retry logic for failed requests
- Rate limiting handling

## 2.3 Type Safety

- **Generated types from OpenAPI** (never manual)
- Type guards for runtime validation (zod, yup)
- Discriminated unions for response types
- Error type definitions
- Type inference from API client methods

## 2.4 Error Handling

- Consistent error response structure
- Error mapping (API errors → UI-friendly messages)
- Network error handling
- Timeout handling
- Retry strategies (exponential backoff)
- Global error handlers

## 2.5 Integration with React Query

- Query function patterns using API client
- Mutation patterns
- Error handling in queries/mutations
- Type inference from API client
- Query key factories matching API structure

**RED FLAGS:**

- ❌ Manual API type definitions (should be generated from OpenAPI)
- ❌ Inconsistent error handling across endpoints
- ❌ No request/response interceptors
- ❌ Hardcoded API URLs
- ❌ Missing retry logic for network failures
- ❌ API client methods not typed properly
