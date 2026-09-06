# Remix — Resource Routes

> A route module with no default export renders nothing and returns whatever its loader or action
> does — JSON, binary data, or a redirect. Both `loader` (GET) and `action` (everything else) are
> available.

---

## Health Check API

```typescript
// app/routes/api.health.ts (no default export = resource route)
import { json } from "@remix-run/node";

const HTTP_OK = 200;
const HTTP_SERVICE_UNAVAILABLE = 503;

export async function loader() {
  const dbHealthy = await checkDatabaseConnection();
  const cacheHealthy = await checkCacheConnection();

  const status = dbHealthy && cacheHealthy ? "healthy" : "unhealthy";
  const statusCode = status === "healthy" ? HTTP_OK : HTTP_SERVICE_UNAVAILABLE;

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

**Why good:** A monitor reads the status code rather than the body, so returning 503 on a failed
dependency is what makes the endpoint useful to one — and the per-check breakdown says which
dependency to look at.

---

## Webhook Endpoint

```typescript
// app/routes/api.webhooks.payments.ts
import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

const HTTP_BAD_REQUEST = 400;

export async function action({ request }: ActionFunctionArgs) {
  const signature = request.headers.get("webhook-signature");

  if (!signature) {
    return json({ error: "Missing signature" }, { status: HTTP_BAD_REQUEST });
  }

  // Read the raw text, not request.json() — the signature covers the exact bytes sent
  const payload = await request.text();

  try {
    // Placeholder for the sending provider's own verification call. It has to be
    // theirs — the signing algorithm is defined at their end — and it throws on a
    // mismatch, which is what the catch below is for.
    const event = verifyWebhookSignature(
      payload,
      signature,
      process.env.WEBHOOK_SECRET,
    );

    switch (event.type) {
      case "checkout.completed":
        await handleCheckoutComplete(event.data);
        break;
      case "payment.failed":
        await handlePaymentFailed(event.data);
        break;
    }

    return json({ received: true });
  } catch (error) {
    return json({ error: "Invalid signature" }, { status: HTTP_BAD_REQUEST });
  }
}
```

**Why good:** The signature is verified before anything reads the payload, so a forged request never
reaches the handlers. Reading `request.text()` rather than parsing first matters — re-serialising
JSON changes the bytes and the signature stops matching. Unrecognised event types fall through and
still return 200, so the sender does not retry them forever.

---

## File Download Resource Route

```typescript
// app/routes/api.reports.$reportId.download.ts
import type { LoaderFunctionArgs } from "@remix-run/node";

const HTTP_UNAUTHORIZED = 401;
const HTTP_NOT_FOUND = 404;
const HTTP_FORBIDDEN = 403;

export async function loader({ params, request }: LoaderFunctionArgs) {
  const session = await getSession(request);

  if (!session.userId) {
    throw new Response("Unauthorized", { status: HTTP_UNAUTHORIZED });
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

**Why good:** A resource route can return a raw `Response`, which is what lets it serve a PDF at all.
`Content-Disposition: attachment` is the difference between the browser downloading the file and
rendering it, and the ownership check runs before the report is generated rather than after.

---

## Image Transformation Resource Route

```typescript
// app/routes/api.images.$imageId.ts
import type { LoaderFunctionArgs } from "@remix-run/node";

const HTTP_NOT_FOUND = 404;
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
    throw new Response("Image not found", { status: HTTP_NOT_FOUND });
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

**Why good:** The transformation options are in the URL, so each variant is a distinct cache key — and
`immutable` tells the browser never to revalidate it, which is safe precisely because a different
size is a different URL.

---

## Response Headers

| Header                | What it decides                          |
| --------------------- | ---------------------------------------- |
| `Content-Type`        | How the browser interprets the bytes     |
| `Content-Disposition` | Download versus render inline            |
| `Cache-Control`       | How long the browser and CDN may keep it |
| `Content-Length`      | Whether a progress bar can be drawn      |
