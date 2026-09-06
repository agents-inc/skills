# Playwright E2E Testing — Modifying Real Responses

> Letting the request through and changing the answer. See [core.md](core.md) Pattern 3 for
> replacing a response outright.

---

## Intercept, fetch, modify, fulfill

```typescript
// tests/e2e/api-mocking/response-modification.spec.ts
import { test, expect } from "@playwright/test";

const DISCOUNT = 0.2;

test("shows a discount badge on every product", async ({ page }) => {
  await page.route("**/api/products", async (route) => {
    const response = await route.fetch(); // the real request
    const data = await response.json();

    await route.fulfill({
      response, // keeps status and headers
      json: {
        ...data,
        products: data.products.map((product: { price: number }) => ({
          ...product,
          originalPrice: product.price,
          price: product.price * (1 - DISCOUNT),
          hasDiscount: true,
        })),
      },
    });
  });

  await page.goto("/products");
  await expect(page.getByTestId("discount-badge").first()).toBeVisible();
});
```

**Why good:** the response keeps every field the real API returns, so the test exercises a shape
nobody had to maintain by hand — and only the field under test is invented.

**When to prefer a full stub instead:** where the test is about an error path, an empty state, or a
value the API cannot be made to produce on demand.
