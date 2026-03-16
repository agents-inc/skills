# Remix - Resource Routes Examples

> Patterns for API endpoints, webhooks, and file downloads (no UI component).

---

## Health Check API

```typescript
// app/routes/api.health.ts (no default export = resource route)
import { json } from "@remix-run/node";

const HTTP_SERVICE_UNAVAILABLE = 503;

export async function loader() {
  const dbHealthy = await checkDatabaseConnection();
  const cacheHealthy = await checkCacheConnection();

  const status = dbHealthy && cacheHealthy ? "healthy" : "unhealthy";
  const statusCode = status === "healthy" ? 200 : HTTP_SERVICE_UNAVAILABLE;

  return json(
    {
      status,
      checks: {
        database: dbHealthy ? "ok" : "failed",
        cache: cacheHealthy ? "ok" : "failed",
      },
      timestamp: new Date().toISOString(),
    },
    { status: statusCode },
  );
}
```

**Why good:** No default export makes it a resource route (JSON API), returns proper status codes, includes timestamp for debugging

---

## Webhook Endpoint

```typescript
// app/routes/api.webhooks.stripe.ts
import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

const HTTP_BAD_REQUEST = 400;

export async function action({ request }: ActionFunctionArgs) {
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return json({ error: "Missing signature" }, { status: HTTP_BAD_REQUEST });
  }

  const payload = await request.text();

  try {
    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );

    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutComplete(event.data.object);
        break;
      case "invoice.payment_failed":
        await handlePaymentFailed(event.data.object);
        break;
    }

    return json({ received: true });
  } catch (err) {
    return json({ error: "Invalid signature" }, { status: HTTP_BAD_REQUEST });
  }
}
```

**Why good:** Validates webhook signature before processing, switch handles different event types, returns appropriate status codes

---

## File Download Resource Route

```typescript
// app/routes/api.reports.$reportId.download.ts
import type { LoaderFunctionArgs } from "@remix-run/node";

const HTTP_NOT_FOUND = 404;
const HTTP_FORBIDDEN = 403;

export async function loader({ params, request }: LoaderFunctionArgs) {
  const session = await getSession(request);

  if (!session.userId) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const report = await db.report.findUnique({
    where: { id: params.reportId },
    include: { owner: true },
  });

  if (!report) {
    throw new Response("Report not found", { status: HTTP_NOT_FOUND });
  }

  if (report.ownerId !== session.userId) {
    throw new Response("Access denied", { status: HTTP_FORBIDDEN });
  }

  const fileBuffer = await generateReportPDF(report);

  return new Response(fileBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${report.name}.pdf"`,
      "Content-Length": String(fileBuffer.length),
    },
  });
}
```

**Why good:** Auth and authorization checks, proper Content-Type and Content-Disposition headers for downloads, returns raw Response for binary data

---

## Image Transformation Resource Route

```typescript
// app/routes/api.images.$imageId.ts
import type { LoaderFunctionArgs } from "@remix-run/node";

const CACHE_MAX_AGE_DAYS = 365;
const SECONDS_PER_DAY = 86400;

export async function loader({ params, request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const width = Number(url.searchParams.get("w")) || 800;
  const quality = Number(url.searchParams.get("q")) || 80;
  const format = url.searchParams.get("f") || "webp";

  const image = await db.image.findUnique({
    where: { id: params.imageId },
  });

  if (!image) {
    throw new Response("Image not found", { status: 404 });
  }

  const transformedImage = await transformImage(image.url, {
    width,
    quality,
    format: format as "webp" | "jpeg" | "png",
  });

  return new Response(transformedImage, {
    headers: {
      "Content-Type": `image/${format}`,
      "Cache-Control": `public, max-age=${CACHE_MAX_AGE_DAYS * SECONDS_PER_DAY}, immutable`,
    },
  });
}
```

**Why good:** Query params for transformation options, long cache for immutable images, returns binary image data

---

## Key Concepts

### Resource Route Rules

- **No default export** = resource route (API endpoint)
- Returns JSON, binary data, or redirects
- Can have both `loader` (GET) and `action` (POST/PUT/DELETE)

### Common Headers

| Header                | Purpose                      |
| --------------------- | ---------------------------- |
| `Content-Type`        | MIME type of response        |
| `Content-Disposition` | Force download vs inline     |
| `Cache-Control`       | Browser/CDN caching          |
| `Content-Length`      | Size for progress indicators |
