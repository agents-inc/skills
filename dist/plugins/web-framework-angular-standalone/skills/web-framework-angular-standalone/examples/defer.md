# @defer Lazy Loading Examples

> Deferred loading patterns for Angular 17+ standalone components. See [core.md](core.md) for standalone basics.

---

## Pattern: Comprehensive @defer

### Good Example - Multiple defer triggers

```typescript
// analytics-dashboard.component.ts
import { Component, signal } from "@angular/core";
import { KeyMetricsComponent } from "./key-metrics.component";
import { RevenueChartComponent } from "./revenue-chart.component";
import { UserActivityTableComponent } from "./user-activity-table.component";
import { AdvancedAnalyticsComponent } from "./advanced-analytics.component";
import { ExportOptionsComponent } from "./export-options.component";
import { RelatedReportsComponent } from "./related-reports.component";

@Component({
  selector: "app-analytics-dashboard",
  standalone: true,
  // Deferred components still go in imports. Angular only splits out the ones
  // that are standalone AND never referenced outside a @defer block in this
  // file — KeyMetricsComponent is used eagerly, so it stays in the main bundle.
  imports: [
    KeyMetricsComponent,
    RevenueChartComponent,
    UserActivityTableComponent,
    AdvancedAnalyticsComponent,
    ExportOptionsComponent,
    RelatedReportsComponent,
  ],
  template: `
    <div class="dashboard">
      <h1>Analytics Dashboard</h1>

      <!-- Critical content loads immediately -->
      <app-key-metrics />

      <!-- Heavy chart deferred until in viewport -->
      @defer (on viewport) {
        <app-revenue-chart />
      } @placeholder (minimum 200ms) {
        <div class="chart-placeholder" style="height: 400px;">
          <div class="skeleton-chart"></div>
        </div>
      } @loading (after 150ms; minimum 500ms) {
        <div class="chart-loading">
          <div class="spinner"></div>
          <p>Loading revenue data...</p>
        </div>
      } @error {
        <div class="chart-error">
          <p>Failed to load chart. Please refresh.</p>
        </div>
      }

      <!-- User table with prefetch on hover -->
      @defer (on viewport; prefetch on hover) {
        <app-user-activity-table />
      } @placeholder {
        <div class="table-placeholder">
          <div class="skeleton-row"></div>
          <div class="skeleton-row"></div>
          <div class="skeleton-row"></div>
        </div>
      }

      <!-- Feature gated by toggle -->
      @defer (when showAdvancedAnalytics()) {
        <app-advanced-analytics />
      } @placeholder {
        <button (click)="showAdvancedAnalytics.set(true)">
          Show Advanced Analytics
        </button>
      }

      <!-- Interactive section - loads on click -->
      @defer (on interaction) {
        <app-export-options />
      } @placeholder {
        <button class="export-trigger">Export Data</button>
      }

      <!-- Idle loading for non-critical content -->
      @defer (on idle) {
        <app-related-reports />
      } @placeholder {
        <p>Related reports will load shortly...</p>
      }
    </div>
  `,
})
export class AnalyticsDashboardComponent {
  showAdvancedAnalytics = signal(false);
}
```

**Why good:** `on viewport` for below-the-fold content, a placeholder sized like the final layout to prevent CLS, `after` on `@loading` to stop a fast load flashing a spinner, an `@error` block for failures, `prefetch on hover` to start the download before the click, and `when` for feature flags.

**Two rules the compiler enforces:** a deferred dependency must be standalone, and it must not be referenced anywhere outside a `@defer` block in the same file — a `viewChild` query or an eager usage pulls it back into the main bundle with no warning.

---

## Defer Trigger Reference

| Trigger            | Use Case                             |
| ------------------ | ------------------------------------ |
| `on viewport`      | Below-the-fold content               |
| `on interaction`   | Click-to-load features               |
| `on idle`          | Non-critical background loading      |
| `on immediate`     | Load ASAP after initial render       |
| `on hover`         | Loads on mouseover or focusin        |
| `on timer(Xms)`    | Delayed loading after X milliseconds |
| `when condition()` | Conditional/feature-flagged content  |

Every one of these also has a `prefetch on …` form, which starts the download without swapping the content in — `@defer (on viewport; prefetch on hover)` fetches on hover and renders on scroll. `on hover` on its own is a trigger, not a prefetch.
