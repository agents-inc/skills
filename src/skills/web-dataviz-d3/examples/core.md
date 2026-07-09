# D3.js - Core Examples

> Selections, data joins, scales, axes, shape generators, and responsive SVG. See [SKILL.md](../SKILL.md) for concepts and [reference.md](../reference.md) for decision frameworks.

**Related examples:**

- [interaction.md](interaction.md) - Transitions, zoom, brush, drag, tooltips
- [advanced.md](advanced.md) - Force layouts, geo projections, framework integration

---

## Pattern 1: Selections and the Data Join

### Good Example - join() with Key Function

```typescript
import { select } from "d3-selection";
import { max } from "d3-array";
import { scaleLinear } from "d3-scale";

interface BarData {
  id: string;
  value: number;
}

const BAR_HEIGHT = 24;
const BAR_GAP = 4;
const CHART_WIDTH = 500;

function renderBars(svgEl: SVGSVGElement, data: BarData[]): void {
  const xScale = scaleLinear<number>()
    .domain([0, max(data, (d) => d.value) ?? 0])
    .range([0, CHART_WIDTH])
    .nice();

  select(svgEl)
    .selectAll<SVGRectElement, BarData>("rect")
    .data(data, (d) => d.id) // key function: bind by identity
    .join("rect")
    .attr("x", 0)
    .attr("y", (_, i) => i * (BAR_HEIGHT + BAR_GAP))
    .attr("width", (d) => xScale(d.value))
    .attr("height", BAR_HEIGHT)
    .attr("fill", "steelblue");
}
```

**Why good:** key function ensures correct element-data identity across updates, typed `selectAll` generics, `max()` with fallback for empty arrays, `.nice()` rounds domain to clean values

### Good Example - join() with Enter/Update/Exit Callbacks

```typescript
select(svgEl)
  .selectAll<SVGCircleElement, DataPoint>("circle")
  .data(points, (d) => d.id)
  .join(
    (enter) =>
      enter
        .append("circle")
        .attr("cx", (d) => xScale(d.x))
        .attr("cy", (d) => yScale(d.y))
        .attr("r", 0) // start invisible
        .attr("fill", "steelblue")
        .call((s) =>
          s.transition().duration(ENTER_DURATION_MS).attr("r", CIRCLE_RADIUS),
        ),
    (update) =>
      update.call((s) =>
        s
          .transition()
          .duration(UPDATE_DURATION_MS)
          .attr("cx", (d) => xScale(d.x))
          .attr("cy", (d) => yScale(d.y)),
      ),
    (exit) =>
      exit.call((s) =>
        s.transition().duration(EXIT_DURATION_MS).attr("r", 0).remove(),
      ),
  );
```

**Why good:** separate enter/update/exit animations, new elements grow from 0, exiting elements shrink before removal, `.call()` chains transitions cleanly

### Bad Example - Manual Enter/Merge/Exit

```typescript
// Bad: verbose and error-prone boilerplate
const bars = select(svg).selectAll("rect").data(data);

bars
  .enter()
  .append("rect")
  .merge(bars) // easy to forget, causes update bugs
  .attr("width", (d) => d.value * 5) // magic number
  .attr("height", 20); // magic number

bars.exit().remove();
```

**Why bad:** manual enter/merge/exit is verbose and forgetting `.merge()` means updates don't apply to existing elements, magic numbers for dimensions, no key function

---

## Pattern 2: Scales

### Good Example - Linear, Band, and Time Scales

```typescript
import { scaleLinear, scaleBand, scaleTime, scaleOrdinal } from "d3-scale";
import { max, extent } from "d3-array";
import { schemeCategory10 } from "d3-scale-chromatic";

const CHART_WIDTH = 800;
const CHART_HEIGHT = 400;
const MARGIN = { top: 20, right: 30, bottom: 40, left: 50 } as const;

const innerWidth = CHART_WIDTH - MARGIN.left - MARGIN.right;
const innerHeight = CHART_HEIGHT - MARGIN.top - MARGIN.bottom;

// Linear scale: continuous numbers -> pixel range
const xLinear = scaleLinear<number>()
  .domain([0, max(data, (d) => d.revenue) ?? 0])
  .range([0, innerWidth])
  .nice();

// Band scale: categorical strings -> pixel bands (bar charts)
const yBand = scaleBand<string>()
  .domain(data.map((d) => d.category))
  .range([0, innerHeight])
  .padding(0.2); // 20% gap between bars
// yBand("Electronics") -> pixel position
// yBand.bandwidth()    -> computed bar width

// Time scale: Date objects -> pixels
const xTime = scaleTime<number>()
  .domain(extent(data, (d) => d.date) as [Date, Date])
  .range([0, innerWidth]);

// Ordinal color scale: category -> color string
const colorScale = scaleOrdinal<string>()
  .domain(categories)
  .range(schemeCategory10);
```

**Why good:** margin convention separates outer SVG from inner chart area, `extent()` for min/max in one call, `.nice()` rounds to clean tick values, `.padding()` for bar gaps, typed generics on every scale

### Bad Example - Hardcoded Scale Values

```typescript
// Bad: no scales, hardcoded pixel math
svg
  .selectAll("rect")
  .data(data)
  .join("rect")
  .attr("x", (d) => d.value * 3.7) // magic multiplier
  .attr("width", 40) // hardcoded bar width
  .attr("fill", (d) => (d.type === "A" ? "red" : "blue")); // manual color logic
```

**Why bad:** magic multiplier breaks when data range changes, hardcoded width doesn't adapt to number of categories, manual color mapping doesn't scale

---

## Pattern 3: Axes

### Good Example - X and Y Axes with Formatting

```typescript
import { axisBottom, axisLeft } from "d3-axis";
import { format } from "d3-format";
import { timeFormat } from "d3-time-format";

const TICK_COUNT = 6;

// Numeric axis with comma formatting
const xAxis = axisBottom(xScale).ticks(TICK_COUNT).tickFormat(format(",.0f")); // "1,234"

// Time axis
const timeAxis = axisBottom(timeScale).tickFormat(timeFormat("%b %Y")); // "Jan 2025"

// Render axes
const xAxisGroup = svg
  .append("g")
  .attr("class", "x-axis")
  .attr("transform", `translate(0,${innerHeight})`)
  .call(xAxis);

const yAxisGroup = svg
  .append("g")
  .attr("class", "y-axis")
  .call(axisLeft(yScale));

// Grid lines: extend tick lines across chart
svg
  .append("g")
  .attr("class", "grid")
  .call(
    axisLeft(yScale)
      .tickSize(-innerWidth) // negative = extend rightward
      .tickFormat(() => ""), // no labels on grid
  )
  .call((g) => g.select(".domain").remove()) // remove axis line
  .call((g) => g.selectAll(".tick line").attr("stroke-opacity", 0.1));
```

**Why good:** `.ticks()` with named constant, `d3-format` for number formatting, `d3-time-format` for dates, grid lines via negative tick size with invisible labels

### Updating Axes (Not Duplicating)

```typescript
// On data update, select existing group and call axis again
xAxisGroup.transition().duration(TRANSITION_DURATION_MS).call(xAxis);
yAxisGroup.transition().duration(TRANSITION_DURATION_MS).call(axisLeft(yScale));
```

**Why good:** reuses existing `<g>` — calling `.call(axis)` on the same group replaces tick marks instead of duplicating them

### Bad Example - Appending Axes on Every Update

```typescript
// Bad: appends new axis group on every data update
function update(data) {
  svg
    .append("g") // duplicates axis every call
    .call(axisBottom(xScale));
}
```

**Why bad:** each update adds a new `<g>` with tick marks, creating duplicated overlapping axes

---

## Pattern 4: Shape Generators

### Good Example - Line Chart

```typescript
import { line, curveMonotoneX } from "d3-shape";

interface TimeSeriesPoint {
  date: Date;
  value: number;
}

const lineGen = line<TimeSeriesPoint>()
  .x((d) => xScale(d.date))
  .y((d) => yScale(d.value))
  .curve(curveMonotoneX); // smooth interpolation

// Single line: use .datum() (no join needed for one path)
svg
  .append("path")
  .datum(data)
  .attr("d", lineGen)
  .attr("fill", "none")
  .attr("stroke", "steelblue")
  .attr("stroke-width", 2);

// Multiple lines: use .data() + .join()
svg
  .selectAll<SVGPathElement, TimeSeriesPoint[]>("path.line")
  .data(seriesArray)
  .join("path")
  .attr("class", "line")
  .attr("d", lineGen)
  .attr("fill", "none")
  .attr("stroke", (_, i) => colorScale(String(i)));
```

**Why good:** typed line generator with `TimeSeriesPoint`, `.datum()` for single path vs `.data()` for multiple, `.curve()` for smooth lines, no fill on line paths

### Good Example - Pie/Donut Chart

```typescript
import { pie, arc } from "d3-shape";
import type { PieArcDatum } from "d3-shape";

interface SliceData {
  label: string;
  value: number;
}

const INNER_RADIUS = 60; // 0 for pie, > 0 for donut
const OUTER_RADIUS = 150;
const PAD_ANGLE = 0.02;

const pieGen = pie<SliceData>()
  .value((d) => d.value)
  .padAngle(PAD_ANGLE)
  .sort(null); // preserve data order (default sorts by value)

const arcGen = arc<PieArcDatum<SliceData>>()
  .innerRadius(INNER_RADIUS)
  .outerRadius(OUTER_RADIUS);

// Render slices
svg
  .selectAll<SVGPathElement, PieArcDatum<SliceData>>("path")
  .data(pieGen(sliceData))
  .join("path")
  .attr("d", arcGen)
  .attr("fill", (d) => colorScale(d.data.label));

// Centroid labels
svg
  .selectAll<SVGTextElement, PieArcDatum<SliceData>>("text")
  .data(pieGen(sliceData))
  .join("text")
  .attr("transform", (d) => `translate(${arcGen.centroid(d)})`)
  .attr("text-anchor", "middle")
  .text((d) => d.data.label);
```

**Why good:** typed `PieArcDatum<SliceData>` generic flows through, `.sort(null)` preserves input order, `.padAngle()` adds visual separation, `arcGen.centroid()` places labels at the arc midpoint

### Good Example - Area Chart

```typescript
import { area, curveMonotoneX } from "d3-shape";

const areaGen = area<TimeSeriesPoint>()
  .x((d) => xScale(d.date))
  .y0(innerHeight) // baseline at bottom
  .y1((d) => yScale(d.value))
  .curve(curveMonotoneX);

svg
  .append("path")
  .datum(data)
  .attr("d", areaGen)
  .attr("fill", "steelblue")
  .attr("fill-opacity", 0.3);
```

**Why good:** `.y0()` sets baseline, `.y1()` maps data values, opacity for layered area visibility

---

## Pattern 5: Responsive SVG

### Good Example - viewBox Pattern

```typescript
const VIEWBOX_WIDTH = 960;
const VIEWBOX_HEIGHT = 500;

function createResponsiveSvg(container: HTMLElement): SVGSVGElement {
  const svg = select(container)
    .append("svg")
    .attr("viewBox", `0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`)
    .attr("preserveAspectRatio", "xMidYMid meet")
    .style("width", "100%")
    .style("height", "auto")
    .node()!;

  return svg;
}
```

**Why good:** SVG scales automatically to container width, consistent internal coordinate system, no resize listeners needed

### Good Example - ResizeObserver for Dynamic Re-rendering

```typescript
function useChartDimensions(containerRef: { current: HTMLElement | null }) {
  // Track container dimensions, re-render chart when they change
  const observer = new ResizeObserver((entries) => {
    const { width, height } = entries[0].contentRect;
    // Recompute scales with new width/height and re-render
    renderChart(width, height);
  });

  if (containerRef.current) {
    observer.observe(containerRef.current);
  }

  // Cleanup: observer.disconnect() on unmount
  return () => observer.disconnect();
}
```

**When to use:** when the chart must re-layout (not just scale) on resize, or when aspect ratio should not be fixed

### Bad Example - Fixed Pixel Dimensions

```typescript
// Bad: chart doesn't resize
const svg = select("#chart")
  .append("svg")
  .attr("width", 960) // fixed pixels
  .attr("height", 500); // fixed pixels
```

**Why bad:** chart overflows or underflows its container on different screen sizes, no responsive behavior

---

## Pattern 6: The Margin Convention

### Good Example - Standard D3 Margin Convention

```typescript
const MARGIN = { top: 20, right: 30, bottom: 40, left: 50 } as const;
const SVG_WIDTH = 800;
const SVG_HEIGHT = 500;

const innerWidth = SVG_WIDTH - MARGIN.left - MARGIN.right;
const innerHeight = SVG_HEIGHT - MARGIN.top - MARGIN.bottom;

const svg = select(container)
  .append("svg")
  .attr("viewBox", `0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`);

// Inner group offset by margins — all chart content goes here
const chart = svg
  .append("g")
  .attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

// Scales use innerWidth/innerHeight
const xScale = scaleLinear().domain([0, maxVal]).range([0, innerWidth]);
const yScale = scaleLinear().domain([0, maxVal]).range([innerHeight, 0]); // inverted: SVG y=0 is top

// Axes positioned at edges of inner area
chart
  .append("g")
  .attr("transform", `translate(0,${innerHeight})`)
  .call(axisBottom(xScale));

chart.append("g").call(axisLeft(yScale));
```

**Why good:** margins reserve space for axes and labels, inner group simplifies all positioning (coordinates relative to chart area, not SVG), y-scale inverted because SVG origin is top-left

### Bad Example - No Margin Convention

```typescript
// Bad: axes and data compete for the same space
const svg = select("#chart")
  .append("svg")
  .attr("width", 800)
  .attr("height", 500);
svg
  .selectAll("rect")
  .data(data)
  .join("rect")
  .attr("x", (d) => d.x) // no offset for y-axis space
  .attr("y", (d) => d.y); // bars overlap with axis labels
svg.append("g").call(axisLeft(yScale)); // axis renders on top of bars
```

**Why bad:** axes overlap with data elements, no reserved space for tick labels, chart content starts at SVG origin instead of being offset
