# 05. Testing Standards

> **Quick Guide:** Unit tests? See §5.2. API mocking? Use MSW (§5.3). E2E tests? See §5.4. Coverage requirements? See §5.5.

## 5.1 Test Organization

- Test file location (co-located vs separate tests/)
- Naming conventions (*.test.ts vs *.spec.ts)
- Directory structure

## 5.2 Unit Testing

- Testing framework (Vitest/Jest)
- What requires unit tests:
  - Business logic functions
  - Custom hooks
  - Utility functions
  - Complex component behavior
- What doesn't need tests:
  - Type definitions
  - Simple presentational components
  - Third-party library wrappers
- Test structure patterns (Arrange-Act-Assert)
- Mock strategies

## 5.3 Integration Testing

- **API mocking with MSW (Mock Service Worker)**
- MSW handler patterns
- Database testing approaches
- Component integration tests
- Testing API interactions

> See [examples.md](./examples.md#53-integration-testing) for MSW setup examples

**RED FLAGS:**

- ❌ Mocking at the module level instead of network level
- ❌ Inconsistent mock data across tests
- ❌ Mocks that don't match actual API responses
- ❌ No MSW setup for consistent API mocking

## 5.4 E2E Testing

- Framework (Playwright/Cypress)
- Test organization
- What to test end-to-end (critical user flows only)
- Test data management
- CI integration
- Parallel test execution

## 5.5 Coverage Requirements

- Minimum thresholds:
  - Branches: 80%
  - Functions: 80%
  - Lines: 80%
  - Statements: 80%
- Per-package requirements
- Quality gates in CI

## 5.6 Mock Data Patterns

- **MSW for API mocking** (preferred)
- Mock data location (`__mocks/`, `fixtures/`)
- Factory functions vs static mocks
- Realistic vs minimal mocks
- Mock data reuse across tests
- **Keeping mocks in sync with OpenAPI spec**
- Test data builders
