# D3.js — Advanced Examples

> Force layouts, geographic projections, framework integration, TypeScript typing. See [SKILL.md](../SKILL.md) for decisions, [reference.md](../reference.md) for lookup tables, [core.md](core.md) for selections and scales, [interaction.md](interaction.md) for transitions and behaviours.

---

## Pattern 1: Force-Directed Graph Layout

### Good — force graph with drag and cleanup

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
import { scaleOrdinal } from "d3-scale";
import { schemeCategory10 } from "d3-scale-chromatic";
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
  const colorScale = scaleOrdinal(nodes.map((d) => d.group), schemeCategory10);

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

**Why good:** extending `SimulationNodeDatum` is what gives the nodes their `x`/`y`/`fx`/`fy` fields; `.alphaTarget(0.3).restart()` keeps the simulation warm while a node is held, and setting `fx`/`fy` pins it until drag end releases them to `null`; the returned cleanup stops the animation frame loop

### The forces

```typescript
forceManyBody().strength(-300); // repulsion between every pair; positive attracts
forceLink(links)
  .id((d) => d.id)
  .distance(80); // springs along the edges
forceCenter(width / 2, height / 2); // translates the whole graph to a centre
forceCollide(nodeRadius); // hard radius, stops overlap
forceX(targetX).strength(0.1); // pull toward a position — useful for grouping
forceY(targetY).strength(0.1);
```

### Bad — no cleanup

```typescript
function renderGraph(svg, nodes, links) {
  forceSimulation(nodes)
    .force("charge", forceManyBody())
    .on("tick", () => {
      /* write positions */
    });
}
```

**Why bad:** the simulation drives itself with `requestAnimationFrame` and only stops when `alpha` decays or `.stop()` is called. Unmount the component and the tick handler keeps writing attributes on detached elements, holding the whole node array and its DOM alive.

---

## Pattern 2: Geographic Projections and Choropleth Maps

### Good — choropleth map

```typescript
import { geoNaturalEarth1, geoPath } from "d3-geo";
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

**Why good:** `fitSize()` derives scale and translate from the data's own bounding box, so the map fits without hand-tuned constants; the distinct grey for a region absent from the map keeps "no data" visually separate from "lowest value", which the colour ramp's own light end would not

### Configuring a projection

```typescript
const projection = geoMercator()
  .center([longitude, latitude]) // geographic centre
  .scale(150) // zoom level
  .translate([width / 2, height / 2]); // pixel centre

// fitSize computes all three from the data — it overrides whatever was set above
projection.fitSize([width, height], geoJson);
```

Projection characters are tabulated in [reference.md](../reference.md).

### Interactive map with tooltips

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

### Strategy: D3 computes, the framework renders

D3 supplies scales, layouts, path strings, axis ticks, force positions and projections; the framework owns elements, listeners and lifecycle.

```typescript
import { scaleLinear, scaleBand } from "d3-scale";
import { max } from "d3-array";

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

**Why good:** nothing is imperative, so there is no cleanup and no ordering problem between D3 and the framework's render — and the datum type flows into the template, where the framework type-checks it

### Strategy: D3 owns the DOM, behind a ref

Zoom, brush, drag and force tick all write attributes on their own schedule, so D3 needs the element.

```typescript
function setupChart(svgEl: SVGSVGElement, data: DataPoint[]): () => void {
  const svg = select(svgEl);
  const simulation = /* ... bind data, render marks, attach zoom or brush ... */;

  return () => {
    simulation.stop();
    svg.selectAll("*").remove();
  };
}

// Lifecycle: on mount, cleanup = setupChart(svgRef.current, data)
//            on unmount, cleanup()
```

**Why good:** the ref is the boundary — D3 owns everything inside that SVG and the framework owns everything outside, so neither re-renders over the other. The returned function is what the framework calls on unmount.

### Bad — both systems writing the same elements

```typescript
// The framework's template renders the bars:
// <svg>{data.map((d) => <rect key={d.id} width={d.value} />)}</svg>

// ...and D3 also joins against them:
select(svgRef.current).selectAll("rect").data(data).join("rect");
```

**Why bad:** the framework re-renders from its own state and overwrites D3's attributes, while D3's `.join()` appends elements the framework's reconciler does not know about and will not remove. Which one wins depends on render timing.

---

## Pattern 4: TypeScript Patterns for D3

### Typing selections

```typescript
import type { Selection } from "d3-selection";

// Selection<ElementType, Datum, ParentElementType, ParentDatum>
type ChartSelection = Selection<SVGGElement, unknown, HTMLElement, unknown>;
type BarSelection = Selection<SVGRectElement, BarData, SVGGElement, unknown>;

function styleBar(bar: BarSelection): BarSelection {
  return bar.attr("fill", "steelblue").attr("rx", 2);
}
```

### Typing scales

```typescript
import type { ScaleLinear, ScaleBand, ScaleTime, ScaleOrdinal } from "d3-scale";

type XScale = ScaleLinear<number, number>; // <Range, Output>
type YScale = ScaleBand<string>; // <Domain>
type TimeScale = ScaleTime<number, number>;
type ColorScale = ScaleOrdinal<string, string>; // <Domain, Range>
```

### Typing event handlers

```typescript
import type { D3ZoomEvent } from "d3-zoom";
import type { D3BrushEvent } from "d3-brush";
import type { D3DragEvent } from "d3-drag";

// v7 handlers receive (event, datum) — v5 and earlier received (datum, index, group)
svg.on("click", (event: MouseEvent, d: BarData) => {
  /* event is the native DOM event, d the bound datum */
});
```

### Bad — untyped selections

```typescript
const svg = select("#chart"); // Selection<any, any, any, any>
const bars = svg.selectAll("rect").data(data);
bars.join("rect").attr("width", (d) => d.value); // d is any
```

**Why bad:** the datum type is `any` from the first untyped `selectAll` onward, so every accessor in the chain is unchecked — a renamed field on the data reads `undefined` and the chart renders blank rather than failing to compile.
