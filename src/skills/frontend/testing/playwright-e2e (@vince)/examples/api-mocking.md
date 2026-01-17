# Playwright E2E Testing - API Mocking

> Advanced API mocking patterns including response interception and modification. See [core.md](core.md) for foundational patterns.

**Prerequisites**: Understand [Pattern 3: Network Mocking](core.md#pattern-3-network-mocking) from core examples first.

---

## Pattern: Intercepting and Modifying Responses

```typescript
// tests/e2e/api-mocking/response-modification.spec.ts
import { test, expect } from "@playwright/test";

const API_PRODUCTS = "**/api/products";
const DISCOUNT_PERCENTAGE = 0.2;

test("applies discount to all product prices", async ({ page }) => {
  await page.route(API_PRODUCTS, async (route) => {
    // Fetch real response
    const response = await route.fetch();
    const data = await response.json();

    // Modify prices
    const discountedProducts = data.products.map(
      (product: { price: number }) => ({
        ...product,
        price: product.price * (1 - DISCOUNT_PERCENTAGE),
        originalPrice: product.price,
        hasDiscount: true,
      })
    );

    // Return modified response
    await route.fulfill({
      response,
      json: { ...data, products: discountedProducts },
    });
  });

  await page.goto("/products");

  // Verify discount badges are shown
  const discountBadges = page.getByTestId("discount-badge");
  await expect(discountBadges.first()).toBeVisible();
});
```

**Why good:** Combines real API behavior with controlled modifications, useful for testing features that depend on specific data states, preserves response structure while modifying values

---

_See [core.md](core.md) for foundational patterns: User Flows, Basic Page Objects, Network Mocking, and Configuration._
