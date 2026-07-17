# D3.js - Advanced Examples

> Force layouts, geographic projections, and framework integration. See [SKILL.md](../SKILL.md) for concepts and [reference.md](../reference.md) for decision frameworks.

**Related examples:**

- [core.md](core.md) - Selections, data joins, scales, axes, shapes
- [interaction.md](interaction.md) - Transitions, zoom, brush, drag, tooltips

---

## Pattern 1: Force-Directed Graph Layout

### Good Example - Complete Force Graph with Drag

```typescript
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
} from "d3-force";
import { drag } from "d3-drag";
import { select } from "d3-selection";
import type { SimulationNodeDatum, SimulationLinkDatum } from "d3-force";
import type { D3DragEvent } from "d3-drag";

interface GraphNode extends SimulationNodeDatum {
  id: string;
  group: string;
}

interface GraphLink extends SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
  weight: number;
}

const CHARGE_STRENGTH = -300;
const LINK_DISTANCE = 80;
const COLLISION_RADIUS = 20;
const NODE_RADIUS = 8;
const ALPHA_DECAY = 0.02;

function renderForceGraph(
  svgEl: SVGSVGElement,
  nodes: GraphNode[],
  links: GraphLink[],
  width: number,
  height: number,
): () => void {
  const svg = select(svgEl);

  // Create simulation
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
    .alphaDecay(ALPHA_DECAY);

  // Render links
  const linkElements = svg
    .selectAll<SVGLineElement, GraphLink>("line")
    .data(links)
    .join("line")
    .attr("stroke", "#999")
    .attr("stroke-opacity", 0.6)
    .attr("stroke-width", (d) => Math.sqrt(d.weight));

  // Render nodes
  const nodeElements = svg
    .selectAll<SVGCircleElement, GraphNode>("circle")
    .data(nodes)
    .join("circle")
    .attr("r", NODE_RADIUS)
    .attr("fill", (d) => colorScale(d.group));

  // Drag behavior
  type NodeDragEvent = D3DragEvent<SVGCircleElement, GraphNode, GraphNode>;

  const dragBehavior = drag<SVGCircleElement, GraphNode>()
    .on("start", (event: NodeDragEvent) => {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    })
    .on("drag", (event: NodeDragEvent) => {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    })
    .on("end", (event: NodeDragEvent) => {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    });

  nodeElements.call(dragBehavior);

  // Tick: update positions
  simulation.on("tick", () => {
    linkElements
      .attr("x1", (d) => (d.source as GraphNode).x!)
      .attr("y1", (d) => (d.source as GraphNode).y!)
      .attr("x2", (d) => (d.target as GraphNode).x!)
      .attr("y2", (d) => (d.target as GraphNode).y!);

    nodeElements.attr("cx", (d) => d.x!).attr("cy", (d) => d.y!);
  });

  // Return cleanup function — MUST be called on unmount
  return () => simulation.stop();
}
```

**Why good:** typed `SimulationNodeDatum` and `SimulationLinkDatum` generics, `.alphaTarget()` warms simulation during drag, `fx`/`fy` pins nodes during drag (released on drag end), cleanup function stops the async simulation on unmount

### Key Force Types

```typescript
// Repulsion between all nodes (negative = repel, positive = attract)
forceManyBody().strength(-300);

// Attract connected nodes together
forceLink(links)
  .id((d) => d.id)
  .distance(80);

// Pull everything toward a center point
forceCenter(width / 2, height / 2);

// Prevent node overlap
forceCollide(nodeRadius);

// Pull nodes toward specific x/y positions
forceX(targetX).strength(0.1);
forceY(targetY).strength(0.1);
```

### Bad Example - No Simulation Cleanup

```typescript
// Bad: simulation keeps running after component unmounts
function renderGraph(svg, nodes, links) {
  const simulation = forceSimulation(nodes)
    .force("charge", forceManyBody())
    .on("tick", () => {
      /* update positions */
    });
  // No cleanup — simulation runs indefinitely via requestAnimationFrame
}
```

**Why bad:** `forceSimulation` uses `requestAnimationFrame` internally — without `.stop()` on unmount, it causes memory leaks and updates to detached DOM elements

---

## Pattern 2: Geographic Projections and Choropleth Maps

### Good Example - Choropleth Map

```typescript
import { geoNaturalEarth1, geoPath, geoMercator } from "d3-geo";
import { select } from "d3-selection";
import { scaleSequential } from "d3-scale";
import { interpolateBlues } from "d3-scale-chromatic";
import { max } from "d3-array";
import type { FeatureCollection, Feature, Geometry } from "geojson";

interface RegionProperties {
  id: string;
  name: string;
}

const CHART_WIDTH = 960;
const CHART_HEIGHT = 500;
const STROKE_COLOR = "#fff";
const STROKE_WIDTH = 0.5;

function renderChoropleth(
  svgEl: SVGSVGElement,
  geoData: FeatureCollection<Geometry, RegionProperties>,
  dataByRegion: Map<string, number>,
): void {
  const svg = select(svgEl);

  // Projection: auto-fit GeoJSON to SVG dimensions
  const projection = geoNaturalEarth1().fitSize(
    [CHART_WIDTH, CHART_HEIGHT],
    geoData,
  );

  const pathGenerator = geoPath().projection(projection);

  // Color scale: data value -> color
  const maxValue = max([...dataByRegion.values()]) ?? 0;
  const colorScale = scaleSequential(interpolateBlues).domain([0, maxValue]);

  // Render regions
  svg
    .selectAll<SVGPathElement, Feature<Geometry, RegionProperties>>("path")
    .data(geoData.features)
    .join("path")
    .attr("d", pathGenerator)
    .attr("fill", (d) => {
      const value = dataByRegion.get(d.properties.id);
      return value != null ? colorScale(value) : "#ccc";
    })
    .attr("stroke", STROKE_COLOR)
    .attr("stroke-width", STROKE_WIDTH);
}
```

**Why good:** `fitSize()` auto-scales projection to container (no manual scale/translate), `geoNaturalEarth1` is a good default for world maps, sequential color scale with `interpolateBlues`, fallback color for missing data, typed GeoJSON features

### Common Projections

```typescript
import {
  geoMercator, // web maps, conformal (shape-preserving)
  geoNaturalEarth1, // world maps, pleasant shape/area compromise
  geoAlbersUsa, // US maps with Alaska/Hawaii insets
  geoOrthographic, // globe view (3D appearance)
  geoEqualEarth, // world maps, equal-area
} from "d3-geo";

// All projections support:
const projection = geoMercator()
  .center([longitude, latitude]) // geographic center
  .scale(150) // zoom level
  .translate([width / 2, height / 2]) // pixel center
  .fitSize([width, height], geoJson); // auto-fit (overrides center/scale/translate)
```

### Interactive Map with Tooltips

```typescript
svg
  .selectAll("path")
  .data(geoData.features)
  .join("path")
  .attr("d", pathGenerator)
  .attr("fill", (d) => colorScale(dataByRegion.get(d.properties.id) ?? 0))
  .on("mouseenter", (event: MouseEvent, d) => {
    select(event.currentTarget as SVGPathElement)
      .attr("stroke", "black")
      .attr("stroke-width", 2);
    tooltip
      .style("opacity", 1)
      .html(
        `<strong>${d.properties.name}</strong><br/>Value: ${dataByRegion.get(d.properties.id) ?? "N/A"}`,
      );
  })
  .on("mouseleave", (event: MouseEvent) => {
    select(event.currentTarget as SVGPathElement)
      .attr("stroke", STROKE_COLOR)
      .attr("stroke-width", STROKE_WIDTH);
    tooltip.style("opacity", 0);
  });
```

---

## Pattern 3: Framework Integration

### Strategy: D3 for Computation, Framework for DOM

When using D3 with a component framework, separate concerns:

- **D3 computes:** scales, layouts, shape paths, axis ticks, force positions, projections
- **Framework renders:** DOM elements, event handlers, component lifecycle

```typescript
// Example: compute in your component, render declaratively
import { scaleLinear, scaleBand } from "d3-scale";
import { line, curveMonotoneX } from "d3-shape";
import { max } from "d3-array";

interface ChartProps {
  data: DataPoint[];
  width: number;
  height: number;
}

// D3 computes scales and paths — no DOM manipulation
function useChartScales(data: DataPoint[], width: number, height: number) {
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

// Your framework renders SVG with computed values:
// <svg>
//   {data.map((d) => (
//     <rect
//       x={xScale(d.label)}
//       y={yScale(d.value)}
//       width={xScale.bandwidth()}
//       height={height - yScale(d.value)}
//     />
//   ))}
// </svg>
```

**Why good:** framework manages DOM lifecycle and reactivity, D3 provides the math, no imperative DOM manipulation, full type safety from framework's template system

### Strategy: D3 Owns the DOM (via Ref)

When D3 must own the DOM — zoom, brush, drag, force tick — use a ref and lifecycle hooks.

```typescript
// Generic pattern for any component framework:
// 1. Create a ref to an SVG element
// 2. In a mount/effect lifecycle hook, pass the ref to D3
// 3. D3 appends/modifies children of that SVG
// 4. On unmount, clean up simulations/behaviors

function setupChart(svgEl: SVGSVGElement, data: DataPoint[]): () => void {
  // D3 takes over this SVG element
  const svg = select(svgEl);

  // ... binddata, render elements, set up zoom/brush ...

  // Return cleanup function for your framework to call on unmount
  return () => {
    simulation?.stop();
    svg.selectAll("*").remove();
  };
}

// In your framework's lifecycle:
// onMount: cleanup = setupChart(svgRef.current, data)
// onUnmount: cleanup()
```

**Why good:** D3 controls DOM inside the ref boundary, framework controls everything outside, cleanup prevents memory leaks from simulations and event listeners

### Bad Example - D3 and Framework Fight Over DOM

```typescript
// Bad: framework renders elements AND D3 modifies them
// This causes conflicts where both systems overwrite each other

// Framework template renders bars
// <svg>{data.map((d) => <rect key={d.id} width={d.value} />)}</svg>

// Then D3 also tries to manage the same elements
// select(svgRef).selectAll("rect").data(data).join("rect")...
```

**Why bad:** two systems managing the same DOM elements causes unpredictable behavior — framework may re-render and destroy D3's changes, or D3 may add elements the framework doesn't track

### Decision: Which Strategy?

```
Does the visualization use zoom, brush, drag, or force simulation?
|
+-> NO  -> D3 for computation, framework for DOM
|          (cleanest, most maintainable)
|
+-> YES -> D3 owns the SVG via ref
           (necessary for D3 behaviors that need DOM control)
           Clean up on unmount!
```

---

## Pattern 4: TypeScript Patterns for D3

### Typing Selections

```typescript
import type { Selection } from "d3-selection";

// Selection<ElementType, Datum, ParentElementType, ParentDatum>
type ChartSelection = Selection<SVGGElement, unknown, HTMLElement, unknown>;
type BarSelection = Selection<SVGRectElement, BarData, SVGGElement, unknown>;

function styleBar(bar: BarSelection): BarSelection {
  return bar.attr("fill", "steelblue").attr("rx", 2);
}
```

### Typing Scales

```typescript
import type { ScaleLinear, ScaleBand, ScaleTime, ScaleOrdinal } from "d3-scale";

type XScale = ScaleLinear<number, number>;
type YScale = ScaleBand<string>;
type TimeScale = ScaleTime<number, number>;
type ColorScale = ScaleOrdinal<string, string>;
```

### Typing Event Handlers

```typescript
import type { D3ZoomEvent } from "d3-zoom";
import type { D3BrushEvent } from "d3-brush";
import type { D3DragEvent } from "d3-drag";

// D3 v7 event handlers receive (event, datum) — not (datum, index, group)
svg.on("click", (event: MouseEvent, d: BarData) => {
  // event is the native DOM event
  // d is the bound datum
});
```

### Bad Example - Untyped D3 Code

```typescript
// Bad: no generics, any-typed selections
const svg = d3.select("#chart"); // Selection<any, any, any, any>
const bars = svg.selectAll("rect").data(data); // no datum type
bars.join("rect").attr("width", (d) => d.value); // d is unknown/any
```

**Why bad:** no type safety on datum access, no autocomplete for datum properties, typos in attribute names not caught at compile time
