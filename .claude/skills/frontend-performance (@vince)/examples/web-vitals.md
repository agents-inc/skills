# Core Web Vitals

> LCP, INP (formerly FID), CLS patterns and real-user monitoring. See [core.md](core.md) for React runtime patterns.

---

## LCP (Largest Contentful Paint)

### Good Example - Optimize LCP with Next.js Image Priority

```typescript
import Image from 'next/image';

export function Hero() {
  return (
    <Image
      src="/hero.jpg"
      alt="Hero image"
      width={1200}
      height={600}
      priority  // Preload for LCP
      placeholder="blur"
      blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRg..."
    />
  );
}
```

**Why good:** Priority flag preloads image for faster LCP, automatic WebP/AVIF format selection reduces file size by 30-50%, blur placeholder improves perceived performance

### Bad Example - Large Hero Image Without Optimization

```typescript
export function Hero() {
  return (
    <img src="/hero-4k.jpg" alt="Hero" />
    // No optimization, no preload, blocks LCP
  );
}
```

**Why bad:** Large unoptimized image (2-5MB) blocks LCP, no format optimization, no lazy loading, no preload

---

## INP (Interaction to Next Paint)

**Note:** INP replaced FID (First Input Delay) as a Core Web Vital on March 12, 2024. FID is now deprecated.

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

### Good Example - Image with Dimensions

```typescript
import Image from 'next/image';

export function ProductImage({ src, alt }: Props) {
  return (
    <Image
      src={src}
      alt={alt}
      width={1200}
      height={600}
      placeholder="blur"
      blurDataURL="data:image/jpeg;base64,..."
    />
  );
}
```

**Why good:** Explicit dimensions reserve space before image loads, prevents layout shift when image appears, blur placeholder improves perceived performance

### Bad Example - No Dimensions, Causes Layout Shift

```html
<!-- No dimensions, causes layout shift -->
<img src="/hero.jpg" alt="Hero" />
```

**Why bad:** No space reserved for image, content jumps when image loads, causes CLS score increase

### Good Example - Font Loading with size-adjust

```css
/* Font loading with size-adjust to prevent CLS */
@font-face {
  font-family: 'CustomFont';
  src: url('/fonts/custom-font.woff2') format('woff2');
  font-display: swap;
  size-adjust: 95%; /* Match fallback font metrics */
}

body {
  font-family: 'CustomFont', Arial, sans-serif;
}
```

**Why good:** Size-adjust prevents layout shift when custom font loads, font-display swap shows fallback immediately, prevents invisible text (FOIT)

### Bad Example - Font Loading Without size-adjust

```css
/* Font loading without size-adjust */
@font-face {
  font-family: 'CustomFont';
  src: url('/fonts/custom-font.woff2') format('woff2');
  /* No font-display - defaults to block */
  /* No size-adjust - causes layout shift */
}
```

**Why bad:** Text invisible while font loads (FOIT), layout shifts when custom font loads with different metrics, poor perceived performance

---

## Production Monitoring with web-vitals

### Good Example - Web Vitals Analytics

```typescript
// lib/analytics.ts
import { onCLS, onINP, onFCP, onLCP, onTTFB } from 'web-vitals';
import type { Metric } from 'web-vitals';

interface AnalyticsEvent {
  name: string;
  value: number;
  id: string;
  delta: number;
  rating: 'good' | 'needs-improvement' | 'poor';
}

function sendToAnalytics(metric: Metric) {
  const event: AnalyticsEvent = {
    name: metric.name,
    value: metric.value,
    id: metric.id,
    delta: metric.delta,
    rating: metric.rating,
  };

  // Send to Google Analytics
  if (typeof gtag === 'function') {
    gtag('event', metric.name, {
      value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
      metric_id: metric.id,
      metric_value: metric.value,
      metric_delta: metric.delta,
      metric_rating: metric.rating,
    });
  }

  // Send to custom analytics endpoint
  fetch('/api/analytics', {
    method: 'POST',
    body: JSON.stringify(event),
    headers: { 'Content-Type': 'application/json' },
    keepalive: true, // Ensures request completes even if page unloads
  }).catch(console.error);
}

// Initialize Web Vitals tracking
// Note: onINP replaced onFID - FID was deprecated March 2024
export function initWebVitals() {
  onCLS(sendToAnalytics);
  onINP(sendToAnalytics);  // INP replaced FID as Core Web Vital
  onFCP(sendToAnalytics);
  onLCP(sendToAnalytics);
  onTTFB(sendToAnalytics);
}
```

**Why good:** Tracks real user performance (not lab metrics), measures all Core Web Vitals (LCP, INP, CLS), sends to analytics for trend analysis, keepalive ensures data sent even on page unload

**Note:** The `onFID` function is deprecated. INP (Interaction to Next Paint) replaced FID (First Input Delay) as a Core Web Vital on March 12, 2024. Use `onINP` instead.

### Usage in App

```typescript
// pages/_app.tsx
import { useEffect } from 'react';
import { initWebVitals } from '../lib/analytics';

export default function App({ Component, pageProps }) {
  useEffect(() => {
    initWebVitals();
  }, []);

  return <Component {...pageProps} />;
}
```

**Why good:** Initializes on app mount, tracks metrics throughout session, runs in production to measure real users
