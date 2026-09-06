---
name: web-dataviz-d3
description: D3.js data visualization — selections, data joins, scales, axes, shapes, transitions, force layouts, geo projections, framework integration
---

# D3.js Patterns

> **Quick Guide:** D3 v7 is pure ES modules, so import from the individual packages (`d3-selection`, `d3-scale`, `d3-shape`) rather than the `d3` bundle. `selection.join()` replaces manual enter/update/exit chains. Scales map a data domain to a visual range, axes render tick marks from a scale, and shape generators turn data arrays into SVG path strings. `d3-transition` extends the selection prototype by side effect, so `.transition()` does not exist until it is imported. The largest decision is who owns the DOM — D3, or the component framework around it.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — selections, data joins, scales, axes, shape generators, responsive SVG, the margin convention
- [examples/interaction.md](examples/interaction.md) — transitions, zoom, brush, drag, tooltips
- [examples/advanced.md](examples/advanced.md) — force layouts, geo projections, framework integration, TypeScript typing
- [reference.md](reference.md) — module table, scale selection guide, shape generator signatures

---

## Which path applies

- **D3 owns the DOM.** Needed for zoom, brush, drag and force tick, which all attach listeners and write attributes on their own schedule. Hand D3 a ref to one SVG element, call it from a mount hook, and return a cleanup that stops simulations and behaviours. Follow [examples/core.md](examples/core.md) and [examples/interaction.md](examples/interaction.md).
- **D3 computes, the framework renders.** For static charts, D3 supplies scales, layouts and path strings while the framework emits the SVG declaratively. Cleaner, and nothing has to be cleaned up. Follow [examples/advanced.md](examples/advanced.md) Pattern 3.

Two systems writing the same elements is the failure both branches avoid — pick one owner per SVG subtree.

---

<critical_requirements>

## Before writing D3 code

**Join data with `selection.join()`.** One call covers enter, update and exit, where the manual `enter().append().merge()` chain silently drops updates whenever `.merge()` is forgotten.

**Import from the individual modules — `d3-selection`, `d3-scale`, `d3-shape`.** `import * as d3 from "d3"` pulls 240KB+ of packages the chart never calls, and none of it tree-shakes.

**Pass a key function to `.data(array, key)` whenever elements have identity.** Without one D3 binds by index, so a sort or a removal re-binds every element to the wrong datum.

**Type selections and scales through their generics** — `Selection<SVGRectElement, Datum, ...>`, `ScaleLinear<number, number>`. D3's defaults widen to `any` at the first untyped `selectAll`, and the datum type is what makes accessor callbacks checkable.

</critical_requirements>

---

**Auto-detection:** d3, d3-selection, d3-scale, d3-shape, d3-axis, d3-transition, d3-force, d3-geo, d3-zoom, d3-brush, d3-drag, d3-array, d3-scale-chromatic, d3-hierarchy, selection.join, scaleLinear, scaleBand, scaleTime, scaleOrdinal, axisBottom, axisLeft, forceSimulation, forceManyBody, geoPath, geoMercator, curveMonotoneX, PieArcDatum, D3ZoomEvent

**Applies to:**

- Custom SVG and Canvas visualizations built from primitives
- Binding data arrays to DOM elements — the data join
- Mapping data domains to pixel ranges, and rendering axes from those scales
- Generating SVG path strings from data: lines, areas, arcs, pies, stacks
- Animating attribute changes with interpolation and easing
- Force-directed graph layouts and geographic projections
- Zoom, brush and drag behaviours
- Giving a component framework computed geometry to render

**Handled elsewhere:**

- Standard bar, line and pie charts with little customization — a component layer that ships chart types out of the box settles those, and this skill is the primitive toolkit underneath it
- Dashboard composition and widget layout — arranging many charts on a page is not a visualization primitive
- Which colours a product uses — `d3-scale-chromatic` supplies interpolators and schemes, and the palette they are fed is settled by whatever owns the visual language
- Accessibility conformance targets — an SVG takes `role`, `aria-label` and `<title>` like any element, and which level a product must meet is settled elsewhere

---

<philosophy>

D3 is a visualization grammar rather than a charting library: primitives for binding data to elements and deriving visual attributes from it. Maximum control, more code.

The pipeline is **select → bind → join → encode → annotate → animate**. Scales are the hinge — everything visual is a function of data through a scale, so a chart that hardcodes pixel arithmetic has skipped the one abstraction D3 exists to provide.

</philosophy>

---

<decision_framework>

## Which modules to install

```
Bar / line / area chart  -> d3-selection, d3-scale, d3-axis, d3-shape, d3-array
Pie / donut chart        -> d3-shape (pie + arc), d3-scale
Force-directed graph     -> d3-force, d3-selection, d3-drag
Geographic map           -> d3-geo, d3-selection, d3-scale
Animated updates         -> d3-transition, d3-ease, d3-interpolate
Zoom or brush            -> d3-zoom or d3-brush, d3-selection
Tree / treemap / pack    -> d3-hierarchy, d3-selection
```

Scale-by-data-type is a lookup rather than a decision — see [reference.md](reference.md).

</decision_framework>

---

<patterns>

## Core patterns

### Pattern 1: Selections and the data join

Bind an array to elements, then let `.join()` create, update and remove them as the array changes.

```typescript
import { select } from "d3-selection";

select(svgElement)
  .selectAll<SVGRectElement, BarData>("rect")
  .data(data, (d) => d.id) // key function binds by identity, not index
  .join("rect")
  .attr("y", (_, i) => i * (BAR_HEIGHT + BAR_GAP))
  .attr("width", (d) => xScale(d.value))
  .attr("height", BAR_HEIGHT);
```

`.join()` also takes three callbacks when enter, update and exit need distinct animations.

Full code: [examples/core.md](examples/core.md)

---

### Pattern 2: Scales — mapping data to pixels

A scale is a function from a data domain to a visual range. Continuous data takes `scaleLinear`, categories take `scaleBand`, dates take `scaleTime`.

```typescript
import { scaleLinear, scaleBand } from "d3-scale";
import { max } from "d3-array";

const x = scaleLinear<number>()
  .domain([0, max(data, (d) => d.value) ?? 0])
  .range([0, innerWidth])
  .nice(); // rounds the domain to clean tick values

const y = scaleBand<string>()
  .domain(data.map((d) => d.label))
  .range([0, innerHeight])
  .padding(0.2); // y.bandwidth() is then the computed bar width
```

Full code: [examples/core.md](examples/core.md)

---

### Pattern 3: Axes — tick marks generated from a scale

An axis is a generator that renders into a `<g>` via `selection.call()`, so it stays in sync with the scale it was built from.

```typescript
import { axisBottom, axisLeft } from "d3-axis";
import { format } from "d3-format";

const xAxisGroup = svg
  .append("g")
  .attr("transform", `translate(0,${innerHeight})`)
  .call(axisBottom(xScale).ticks(TICK_COUNT).tickFormat(format(",.0f")));

// On update, call the axis on the SAME group — appending a new one duplicates ticks
xAxisGroup
  .transition()
  .duration(TRANSITION_DURATION_MS)
  .call(axisBottom(xScale));
```

Full code: [examples/core.md](examples/core.md)

---

### Pattern 4: Shape generators — SVG paths from data

`line`, `area`, `arc`, `pie` and `stack` are configured once with accessors, then called with data to produce a `d` string.

```typescript
import { line, arc, pie, curveMonotoneX } from "d3-shape";
import type { PieArcDatum } from "d3-shape";

const lineGen = line<TimeSeriesPoint>()
  .x((d) => xScale(d.date))
  .y((d) => yScale(d.value))
  .curve(curveMonotoneX);

const pieGen = pie<SliceData>()
  .value((d) => d.value)
  .sort(null);
const arcGen = arc<PieArcDatum<SliceData>>()
  .innerRadius(INNER_RADIUS)
  .outerRadius(OUTER_RADIUS);
```

Full code: [examples/core.md](examples/core.md)

---

### Pattern 5: The margin convention and responsive sizing

Reserve space for axes with a margin object and an offset inner `<g>`; size with `viewBox` so the SVG scales without a resize listener.

```typescript
const MARGIN = { top: 20, right: 30, bottom: 40, left: 50 } as const;
const innerWidth = SVG_WIDTH - MARGIN.left - MARGIN.right;
const innerHeight = SVG_HEIGHT - MARGIN.top - MARGIN.bottom;

const svg = select(container)
  .append("svg")
  .attr("viewBox", `0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`)
  .style("width", "100%");

const chart = svg
  .append("g")
  .attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);
```

`ResizeObserver` is the escalation, for charts that must re-layout rather than scale.

Full code: [examples/core.md](examples/core.md)

---

### Pattern 6: Transitions — animated updates

Transitions interpolate numeric attributes and colours over a duration. Give enter, update and exit their own behaviour.

```typescript
import "d3-transition"; // side-effect import: adds .transition() to selections
import { easeCubicOut } from "d3-ease";

selection.join(
  (enter) =>
    enter
      .append("rect")
      .attr("height", 0)
      .call((s) =>
        s
          .transition()
          .duration(TRANSITION_DURATION_MS)
          .ease(easeCubicOut)
          .delay((_, i) => i * STAGGER_DELAY_MS)
          .attr("height", (d) => innerHeight - yScale(d.value)),
      ),
  (update) =>
    update.call((s) =>
      s
        .transition()
        .duration(TRANSITION_DURATION_MS)
        .attr("height", (d) => innerHeight - yScale(d.value)),
    ),
  (exit) =>
    exit.call((s) =>
      s
        .transition()
        .duration(TRANSITION_DURATION_MS)
        .attr("height", 0)
        .remove(),
    ),
);
```

Full code: [examples/interaction.md](examples/interaction.md)

---

### Pattern 7: Zoom and pan

`zoom()` writes a transform on every wheel and drag. Apply it to an inner group — transforming the SVG root moves the viewport and clips panned content.

```typescript
import { zoom } from "d3-zoom";
import type { D3ZoomEvent } from "d3-zoom";

const zoomBehavior = zoom<SVGSVGElement, unknown>()
  .scaleExtent([MIN_ZOOM, MAX_ZOOM])
  .on("zoom", (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
    select(chartGroup).attr("transform", event.transform.toString());
  });

select(svgEl).call(zoomBehavior);
```

Semantic zoom rescales the axes instead — `event.transform.rescaleX(xScale)`.

Full code: [examples/interaction.md](examples/interaction.md)

---

### Pattern 8: Brush and drag

`brushX` returns a pixel range; `.invert()` turns it back into data values. `drag` reports positions and needs `function` rather than an arrow when the handler uses `this`.

```typescript
import { brushX } from "d3-brush";
import type { D3BrushEvent } from "d3-brush";

const brush = brushX<unknown>()
  .extent([
    [0, 0],
    [innerWidth, innerHeight],
  ])
  .on("end", (event: D3BrushEvent<unknown>) => {
    if (!event.selection) return; // brush was cleared
    const [x0, x1] = event.selection as [number, number];
    onBrush([xScale.invert(x0), xScale.invert(x1)]);
  });
```

Full code: [examples/interaction.md](examples/interaction.md)

---

### Pattern 9: Force-directed graph layout

A simulation mutates `x`/`y` on the node objects each tick; the tick handler copies them onto elements. It runs on `requestAnimationFrame` until stopped.

```typescript
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
} from "d3-force";

const simulation = forceSimulation<GraphNode>(nodes)
  .force(
    "link",
    forceLink<GraphNode, GraphLink>(links)
      .id((d) => d.id)
      .distance(LINK_DISTANCE),
  )
  .force("charge", forceManyBody().strength(CHARGE_STRENGTH))
  .force("center", forceCenter(width / 2, height / 2))
  .force("collide", forceCollide(COLLISION_RADIUS))
  .on("tick", () => {
    nodeElements.attr("cx", (d) => d.x!).attr("cy", (d) => d.y!);
  });

return () => simulation.stop(); // cleanup, called on unmount
```

Full code: [examples/advanced.md](examples/advanced.md)

---

### Pattern 10: Geographic projections

A projection converts longitude/latitude to pixels; `geoPath` turns projected GeoJSON into `d` strings. `fitSize` derives scale and translate from the data.

```typescript
import { geoNaturalEarth1, geoPath } from "d3-geo";

const projection = geoNaturalEarth1().fitSize(
  [CHART_WIDTH, CHART_HEIGHT],
  geoData,
);
const pathGenerator = geoPath().projection(projection);

svg
  .selectAll("path")
  .data(geoData.features)
  .join("path")
  .attr("d", pathGenerator)
  .attr("fill", (d) => colorScale(dataByRegion.get(d.properties.id) ?? 0));
```

Full code: [examples/advanced.md](examples/advanced.md)

---

### Pattern 11: Handing computed geometry to a framework

For static charts, expose the scales and path strings and let the framework emit the SVG. Nothing to clean up, and the datum types flow into the template.

```typescript
function chartGeometry(data: DataPoint[], width: number, height: number) {
  const xScale = scaleBand<string>()
    .domain(data.map((d) => d.label))
    .range([0, width])
    .padding(0.2);
  const yScale = scaleLinear<number>()
    .domain([0, max(data, (d) => d.value) ?? 0])
    .range([height, 0])
    .nice();
  return { xScale, yScale };
}

// The framework then renders: <rect x={xScale(d.label)} width={xScale.bandwidth()} />
```

Full code: [examples/advanced.md](examples/advanced.md)

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- `.transition()` without `import "d3-transition"` — TypeError, the method is added by side effect and does not exist otherwise
- Mutating an array already bound to a selection — D3 stores the reference, so the next render reads values that were never joined
- `svg.append("g").call(axis)` on every update — a new axis group each time, overlapping tick marks
- A force simulation left running after unmount — `requestAnimationFrame` keeps writing to detached nodes; return `simulation.stop()` as cleanup
- An arrow function in a handler that calls `select(this)` — `this` is the enclosing scope, not the element; use `function` or `event.currentTarget`
- Exit transitions without `.remove()` — elements finish animating and stay in the DOM

**Surprising behaviour:**

- `.join("rect")` returns the merged enter+update selection, so attributes chained after it apply to new and existing elements alike
- `max()` and `extent()` return `undefined` for an empty array — guard with `?? 0` before feeding a domain
- `.duration()` is per element, not total: 750ms across 100 elements is still 750ms
- A zoom transform on the SVG root moves the viewport and clips panned content; it belongs on an inner `<g>`
- `geoPath()` with no projection renders coordinates as-is, which is correct only for pre-projected GeoJSON
- `.datum()` binds one object to one element and computes no join; `.data()` is for arrays
- `scaleBand().bandwidth()` is the computed band width — reading it beats hardcoding a bar width that stops matching when the category count changes
- Without `.nice()` a linear domain ends wherever the data does, giving ticks like `[0, 473]`
- Only numbers and colours interpolate; class names and boolean attributes jump at the end of the transition

</red_flags>
