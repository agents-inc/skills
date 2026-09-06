# D3.js — Core Examples

> Selections, data joins, scales, axes, shape generators, responsive SVG, the margin convention. See [SKILL.md](../SKILL.md) for decisions, [reference.md](../reference.md) for lookup tables, [interaction.md](interaction.md) for transitions and behaviours, [advanced.md](advanced.md) for force, geo and framework integration.

---

## Pattern 1: Selections and the Data Join

### Good — join() with a key function

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

**Why good:** the key function holds element-datum identity across updates, `max()` has a fallback for the empty array, `.nice()` rounds the domain to clean tick values

### Good — join() with enter/update/exit callbacks

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

**Why good:** enter, update and exit each animate differently; new elements grow from 0 and exiting ones shrink before removal; `.call()` keeps the transitions off the chained selection

### Bad — manual enter/merge/exit

```typescript
const bars = select(svg).selectAll("rect").data(data);

bars
  .enter()
  .append("rect")
  .merge(bars) // easy to forget
  .attr("width", (d) => xScale(d.value));

bars.exit().remove();
```

**Why bad:** dropping `.merge()` leaves updates applying to newly entered elements only, and the existing bars silently keep their old widths. No key function either, so the binding is by index.

---

## Pattern 2: Scales

### Good — linear, band, time and ordinal

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

**Why good:** the margin convention separates the outer SVG from the inner chart area, `extent()` gives min and max in one call, `.nice()` rounds to clean tick values, `.padding()` produces the bar gaps

### Bad — pixel arithmetic instead of scales

```typescript
svg
  .selectAll("rect")
  .data(data)
  .join("rect")
  .attr("x", (d) => d.value * 3.7)
  .attr("width", 40)
  .attr("fill", (d) => (d.type === "A" ? "red" : "blue"));
```

**Why bad:** the multiplier is tuned to one data range and overflows the chart when the data grows; the fixed width overlaps once there are more categories than fit; and the colour branch has to be edited every time a category is added. All three are what a scale computes.

---

## Pattern 3: Axes

### Good — formatted axes and grid lines

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

**Why good:** `d3-format` and `d3-time-format` control tick labels; grid lines come free from a second axis with a negative `tickSize` and empty labels, with the domain line removed

### Updating an axis without duplicating it

```typescript
// Call the axis on the SAME group the first render created
xAxisGroup.transition().duration(TRANSITION_DURATION_MS).call(xAxis);
yAxisGroup.transition().duration(TRANSITION_DURATION_MS).call(axisLeft(yScale));
```

**Why good:** `.call(axis)` on an existing `<g>` replaces its tick marks. `svg.append("g").call(axis)` inside an update function adds a fresh group each time, so the tick marks stack up and render on top of each other.

---

## Pattern 4: Shape Generators

### Good — line chart

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

**Why good:** `.datum()` for a single path against `.data()` + `.join()` for several, `.curve()` for smooth interpolation, and `fill: none` so the path is a line rather than a filled shape

### Good — pie / donut chart

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

**Why good:** the `PieArcDatum<SliceData>` generic flows into every accessor, `.sort(null)` keeps input order where the default would sort by value, and `arcGen.centroid()` gives the label position

### Good — area chart

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

**Why good:** `.y0()` is the baseline and `.y1()` the data edge — an area is a line with a second boundary

---

## Pattern 5: Responsive SVG

### Good — the viewBox pattern

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

**Why good:** the internal coordinate system stays fixed while the rendered size follows the container, so every scale keeps its range and no resize listener is needed

### Good — ResizeObserver, where the chart must re-layout

```typescript
function observeChartSize(container: HTMLElement): () => void {
  const observer = new ResizeObserver((entries) => {
    const { width, height } = entries[0].contentRect;
    renderChart(width, height); // recompute scales, then re-render
  });
  observer.observe(container);
  return () => observer.disconnect();
}
```

`viewBox` scales a chart uniformly, which stretches text and thins strokes. Reach for `ResizeObserver` when tick density or aspect ratio has to change with the container, and disconnect it on unmount.

### Bad — fixed pixel dimensions

```typescript
const svg = select("#chart")
  .append("svg")
  .attr("width", 960)
  .attr("height", 500);
```

**Why bad:** the chart overflows narrow containers and leaves whitespace in wide ones, with no way to adapt short of re-rendering on every resize.

---

## Pattern 6: The Margin Convention

### Good — margins reserved by an offset inner group

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

**Why good:** the margins reserve space for tick labels, the inner group makes every coordinate relative to the plotting area rather than to the SVG, and the y range is inverted because SVG y=0 is the top edge

### Bad — no margins

```typescript
const svg = select("#chart")
  .append("svg")
  .attr("width", 800)
  .attr("height", 500);
svg
  .selectAll("rect")
  .data(data)
  .join("rect")
  .attr("x", (d) => d.x);
svg.append("g").call(axisLeft(yScale));
```

**Why bad:** data starts at x=0, which is exactly where the y-axis and its tick labels render, so the axis draws on top of the bars and the leftmost values are unreadable.
