# Performance Reference

> Thresholds, budgets and format comparisons. Decisions and red flags are in [SKILL.md](SKILL.md); code is in [examples/](examples/).

---

## Core Web Vitals thresholds

Measured at the 75th percentile of real sessions, split by device class.

| Metric | Good     | Needs improvement | Poor     | What it measures                         |
| ------ | -------- | ----------------- | -------- | ---------------------------------------- |
| LCP    | ≤ 2.5 s  | 2.5–4.0 s         | > 4.0 s  | When the largest visible element renders |
| INP    | ≤ 200 ms | 200–500 ms        | > 500 ms | Responsiveness across all interactions   |
| CLS    | ≤ 0.1    | 0.1–0.25          | > 0.25   | Unexpected layout movement               |

Supporting metrics, useful for diagnosis rather than as targets in themselves:

| Metric | Target   | Reads as                                           |
| ------ | -------- | -------------------------------------------------- |
| TTFB   | ≤ 800 ms | Server and network before anything can render      |
| FCP    | ≤ 1.8 s  | First pixel of content — LCP's lower bound         |
| TBT    | ≤ 200 ms | Main-thread blocking in a lab run; INP's lab proxy |

INP replaced FID as a Core Web Vital in March 2024, and covers every interaction rather than the
first. The `web-vitals` library dropped `onFID` entirely in v5, so an upgrade from v4 that still
imports it fails at build time — replace it with `onINP`.

## What moves each metric

| Metric | Remedies, in the order usually worth trying                                                                                                                     |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LCP    | Preload and right-size the LCP image; serve a modern format; remove render-blocking CSS and JS; cut TTFB; render critical content on the server                 |
| INP    | Break tasks over 50 ms; move computation to a worker; ship less JavaScript on the interactive path; yield between units of work                                 |
| CLS    | Set width and height on every image and video; reserve space for late content; use `font-display: swap` with `size-adjust`; never insert above existing content |

## Bundle budgets

| Artifact             | Budget, gzipped | Reasoning                                     |
| -------------------- | --------------- | --------------------------------------------- |
| Main bundle          | 200 KB          | Roughly one second of download on slow 3G     |
| Vendor bundle        | 150 KB          | Cached across deploys; still blocks the first |
| Per-route bundle     | 100 KB each     | Navigation should feel instant                |
| Total initial load   | 500 KB          | Everything before the page is usable          |
| Main CSS             | 50 KB           | Render-blocking by default                    |
| Inlined critical CSS | 14 KB           | Fits the first TCP round trip                 |

State the compression the budget is measured under, since raw, gzip and brotli figures for one file
differ by a factor of three or more.

## Image formats

| Format | Size against JPEG | Notes                                                 |
| ------ | ----------------- | ----------------------------------------------------- |
| AVIF   | 30–50% smaller    | Best compression; slowest to encode; needs a fallback |
| WebP   | 25–35% smaller    | Effectively universal support                         |
| JPEG   | baseline          | The fallback everything falls back to                 |

| Role       | Weight budget |
| ---------- | ------------- |
| Hero image | 200 KB        |
| Thumbnail  | 50 KB         |

## Memoisation thresholds

| Constant                 | Value     | Meaning                                              |
| ------------------------ | --------- | ---------------------------------------------------- |
| Expensive render         | 5 ms      | Below this, the memo comparison outweighs the saving |
| Virtualisation threshold | 100 items | Below this, the DOM is not the bottleneck            |
| Long task                | 50 ms     | Above this the main thread is blocking interaction   |
| Search debounce          | 500 ms    | Long enough to mean "stopped typing"                 |
| Scroll throttle          | 100 ms    | Roughly six frames — smooth without saturating       |
