# Core Web Vitals

> LCP, INP, CLS patterns and real-user monitoring. See [core.md](core.md) for React runtime patterns.

---

## LCP (Largest Contentful Paint)

### Good Example - Optimize Hero Image for LCP

```html
<!-- Preload hero image, serve modern format, set dimensions -->
<link rel="preload" as="image" href="/hero.webp" type="image/webp" />

<img
  src="/hero.webp"
  alt="Hero image"
  width="1200"
  height="600"
  loading="eager"
  fetchpriority="high"
  decoding="async"
/>
```

**Why good:** `fetchpriority="high"` tells browser to prioritize this image, explicit dimensions prevent CLS, `loading="eager"` (default) ensures immediate fetch, preload link starts fetch before HTML parser reaches the `<img>`

### Bad Example - Large Hero Image Without Optimization

```html
<img src="/hero-4k.jpg" alt="Hero" />
<!-- No optimization, no preload, no dimensions, blocks LCP -->
```

**Why bad:** Large unoptimized image (2-5MB) blocks LCP, no format optimization, no dimensions (causes CLS), no priority hint

---

## INP (Interaction to Next Paint)

INP replaced FID (First Input Delay) as a Core Web Vital in March 2024. It measures ALL interactions, not just the first.

### Good Example - Web Worker for Heavy Computation

```typescript
// workers/process-data.ts
import type { ProcessDataMessage } from './types';

self.onmessage = (e: MessageEvent<ProcessDataMessage>) => {
  const { data } = e.data;

  // Heavy computation doesn't block main thread
  const result = processLargeDataset(data);

  self.postMessage({ result });
};

// Component using web worker
import { useEffect, useState } from 'react';

const WORKER_TIMEOUT_MS = 5000;

export function DataProcessor({ data }: Props) {
  const [result, setResult] = useState(null);

  useEffect(() => {
    const worker = new Worker(new URL('./workers/process-data.ts', import.meta.url));

    worker.postMessage({ data });

    worker.onmessage = (e) => {
      setResult(e.data.result);
    };

    const timeout = setTimeout(() => worker.terminate(), WORKER_TIMEOUT_MS);

    return () => {
      clearTimeout(timeout);
      worker.terminate();
    };
  }, [data]);

  return <div>{result}</div>;
}
```

**Why good:** Heavy computation runs off main thread, main thread stays responsive to user input, prevents INP issues

### Good Example - Breaking Up Long Tasks

```typescript
const LONG_TASK_THRESHOLD_MS = 50;

async function processItems(items: Item[]) {
  for (const item of items) {
    processItem(item);

    // Yield to main thread between items to keep UI responsive
    if ("scheduler" in globalThis && "yield" in scheduler) {
      await scheduler.yield(); // Chromium browsers
    } else {
      await new Promise((resolve) => setTimeout(resolve, 0)); // Fallback
    }
  }
}
```

**Why good:** Breaks long tasks (> 50ms) into smaller chunks, keeps main thread responsive between iterations, `scheduler.yield()` preserves task priority (falls back to `setTimeout` in unsupported browsers)

### Bad Example - Heavy Computation on Main Thread

```typescript
export function DataProcessor({ data }: Props) {
  // Blocks main thread for seconds
  const result = processLargeDataset(data);

  return <div>{result}</div>;
}
```

**Why bad:** Blocks main thread during computation, user interactions delayed by processing time, causes high INP scores

---

## CLS (Cumulative Layout Shift)

### Good Example - Image with Explicit Dimensions

```html
<img
  src="/product.jpg"
  alt="Product"
  width="800"
  height="400"
  loading="lazy"
  decoding="async"
/>
```

**Why good:** Explicit dimensions reserve space before image loads, prevents layout shift when image appears

### Bad Example - No Dimensions, Causes Layout Shift

```html
<!-- No dimensions, causes layout shift -->
<img src="/product.jpg" alt="Product" />
```

**Why bad:** No space reserved for image, content jumps when image loads, causes CLS score increase

### Good Example - Font Loading with size-adjust

```css
/* Font loading with size-adjust to prevent CLS */
@font-face {
  font-family: "CustomFont";
  src: url("/fonts/custom-font.woff2") format("woff2");
  font-display: swap;
  size-adjust: 95%; /* Match fallback font metrics */
}

body {
  font-family: "CustomFont", Arial, sans-serif;
}
```

**Why good:** `size-adjust` prevents layout shift when custom font loads, `font-display: swap` shows fallback immediately, prevents invisible text (FOIT)

### Bad Example - Font Loading Without size-adjust

```css
@font-face {
  font-family: "CustomFont";
  src: url("/fonts/custom-font.woff2") format("woff2");
  /* No font-display - defaults to block (invisible text) */
  /* No size-adjust - causes layout shift on swap */
}
```

**Why bad:** Text invisible while font loads (FOIT), layout shifts when custom font loads with different metrics

---

## Production Monitoring with web-vitals

### Good Example - Web Vitals Analytics

```typescript
// lib/web-vitals.ts
import { onCLS, onINP, onFCP, onLCP, onTTFB } from "web-vitals";
import type { Metric } from "web-vitals";

function sendToAnalytics(metric: Metric) {
  const body = JSON.stringify({
    name: metric.name,
    value: metric.value,
    id: metric.id,
    delta: metric.delta,
    rating: metric.rating, // "good" | "needs-improvement" | "poor"
  });

  // Use sendBeacon for reliability on page unload
  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/analytics", body);
  } else {
    fetch("/api/analytics", {
      method: "POST",
      body,
      headers: { "Content-Type": "application/json" },
      keepalive: true,
    }).catch(() => {});
  }
}

// Initialize - call once on app mount
export function initWebVitals() {
  onCLS(sendToAnalytics);
  onINP(sendToAnalytics);
  onFCP(sendToAnalytics);
  onLCP(sendToAnalytics);
  onTTFB(sendToAnalytics);
}
```

**Why good:** Tracks real user performance (not lab metrics), measures all Core Web Vitals, `sendBeacon` ensures data sent even on page unload, `rating` field gives instant pass/fail

**Note:** web-vitals v5 removed `onFID` entirely. Use `onINP` instead. Do not call these functions more than once per page load -- each creates a PerformanceObserver that persists for the page lifetime.
