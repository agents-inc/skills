# D3.js - Interaction Examples

> Transitions, zoom, brush, drag, and tooltips. See [SKILL.md](../SKILL.md) for concepts and [reference.md](../reference.md) for decision frameworks.

**Related examples:**

- [core.md](core.md) - Selections, data joins, scales, axes, shapes
- [advanced.md](advanced.md) - Force layouts, geo projections, framework integration

---

## Pattern 1: Transitions — Animated Updates

### Good Example - Animated Bar Chart Update

```typescript
import "d3-transition"; // MUST import for side-effect prototype extension
import { select } from "d3-selection";
import { easeCubicOut, easeExpOut } from "d3-ease";

const TRANSITION_DURATION_MS = 750;
const STAGGER_DELAY_MS = 30;

function updateBars(svgEl: SVGSVGElement, data: BarData[]): void {
  select(svgEl)
    .selectAll<SVGRectElement, BarData>("rect")
    .data(data, (d) => d.id)
    .join(
      (enter) =>
        enter
          .append("rect")
          .attr("fill", "steelblue")
          .attr("x", (d) => xScale(d.category)!)
          .attr("width", xScale.bandwidth())
          .attr("y", innerHeight) // start at baseline
          .attr("height", 0) // start invisible
          .call((s) =>
            s
              .transition()
              .duration(TRANSITION_DURATION_MS)
              .ease(easeCubicOut)
              .delay((_, i) => i * STAGGER_DELAY_MS)
              .attr("y", (d) => yScale(d.value))
              .attr("height", (d) => innerHeight - yScale(d.value)),
          ),
      (update) =>
        update.call((s) =>
          s
            .transition()
            .duration(TRANSITION_DURATION_MS)
            .ease(easeCubicOut)
            .attr("y", (d) => yScale(d.value))
            .attr("height", (d) => innerHeight - yScale(d.value)),
        ),
      (exit) =>
        exit.call((s) =>
          s
            .transition()
            .duration(TRANSITION_DURATION_MS)
            .attr("y", innerHeight)
            .attr("height", 0)
            .remove(),
        ),
    );
}
```

**Why good:** `d3-transition` imported for side effect, staggered enter with `.delay()`, exiting bars shrink to baseline before removal, easing makes motion feel natural

### Chained Transitions

```typescript
const FIRST_PHASE_MS = 300;
const SECOND_PHASE_MS = 500;

select(element)
  .transition()
  .duration(FIRST_PHASE_MS)
  .attr("fill", "orange")
  .transition() // chains after first completes
  .duration(SECOND_PHASE_MS)
  .attr("fill", "steelblue")
  .attr("r", FINAL_RADIUS);
```

**Why good:** chained `.transition()` runs sequentially — second transition starts after first ends, no manual setTimeout needed

### Common Easing Functions

```typescript
import {
  easeLinear,
  easeCubicOut,
  easeCubicInOut,
  easeElasticOut,
  easeBounceOut,
  easeExpOut,
} from "d3-ease";

// easeLinear      — constant speed (mechanical)
// easeCubicOut    — fast start, slow end (most common for data transitions)
// easeCubicInOut  — slow start, fast middle, slow end (page transitions)
// easeElasticOut  — springy overshoot (playful UI)
// easeBounceOut   — bounce at end (attention-grabbing)
// easeExpOut      — very fast deceleration (snappy)
```

### Bad Example - Transition Without Import

```typescript
// Bad: selection.transition() is undefined without the import
// import "d3-transition";  // forgot this import

select(svg)
  .selectAll("rect")
  .data(data)
  .join("rect")
  .transition() // TypeError: .transition is not a function
  .duration(500) // magic number
  .attr("width", (d) => d);
```

**Why bad:** `d3-transition` extends the selection prototype via side effect — must be imported even if no named exports are used, magic duration

---

## Pattern 2: Zoom and Pan

### Good Example - Geometric Zoom on Chart

```typescript
import { zoom, zoomIdentity } from "d3-zoom";
import { select } from "d3-selection";
import type { D3ZoomEvent } from "d3-zoom";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 20;

function setupZoom(svgEl: SVGSVGElement, chartGroup: SVGGElement): void {
  const zoomBehavior = zoom<SVGSVGElement, unknown>()
    .scaleExtent([MIN_ZOOM, MAX_ZOOM])
    .on("zoom", (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
      // Transform the inner group, not the SVG root
      select(chartGroup).attr("transform", event.transform.toString());
    });

  select(svgEl).call(zoomBehavior);
}

// Programmatic zoom reset
function resetZoom(svgEl: SVGSVGElement): void {
  select(svgEl)
    .transition()
    .duration(TRANSITION_DURATION_MS)
    .call(zoomBehavior.transform, zoomIdentity);
}
```

**Why good:** transform applied to inner `<g>` group (not SVG root — that would clip content), typed generics, `scaleExtent` prevents over-zoom, programmatic reset with smooth transition

### Semantic Zoom (Rescale Axes)

```typescript
const zoomBehavior = zoom<SVGSVGElement, unknown>()
  .scaleExtent([1, MAX_ZOOM])
  .on("zoom", (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
    // Rescale axes based on zoom transform
    const newXScale = event.transform.rescaleX(xScale);
    const newYScale = event.transform.rescaleY(yScale);

    // Update axes with new scales
    xAxisGroup.call(axisBottom(newXScale));
    yAxisGroup.call(axisLeft(newYScale));

    // Reposition data elements with new scales
    circles.attr("cx", (d) => newXScale(d.x)).attr("cy", (d) => newYScale(d.y));
  });
```

**Why good:** axes rescale with zoom level (labels update), data elements reposition precisely, no geometric distortion of shapes

### Bad Example - Transform on SVG Root

```typescript
// Bad: transforming the SVG root clips content when panning
const zoomBehavior = zoom().on("zoom", (event) => {
  select("svg").attr("transform", event.transform); // clips!
});
```

**Why bad:** transforming the SVG root moves the entire SVG viewport, clipping content outside the original bounds — use an inner `<g>` group instead

---

## Pattern 3: Brush Selection

### Good Example - Brush for Range Selection

```typescript
import { brushX } from "d3-brush";
import { select } from "d3-selection";
import type { D3BrushEvent } from "d3-brush";

function setupBrush(
  svgEl: SVGSVGElement,
  xScale: ScaleTime<number, number>,
  onBrush: (range: [Date, Date]) => void,
): void {
  const brush = brushX<unknown>()
    .extent([
      [0, 0],
      [innerWidth, innerHeight],
    ])
    .on("end", (event: D3BrushEvent<unknown>) => {
      if (!event.selection) return; // brush cleared
      const [x0, x1] = event.selection as [number, number];
      onBrush([xScale.invert(x0), xScale.invert(x1)]);
    });

  select(svgEl).append("g").attr("class", "brush").call(brush);
}
```

**Why good:** `.extent()` constrains brush to chart area, `.invert()` converts pixel range back to data domain, null check for cleared brush, callback pattern for decoupled filtering

### Clear Brush Programmatically

```typescript
// Clear brush selection
select(".brush").call(brush.move, null);
```

---

## Pattern 4: Drag Interaction

### Good Example - Draggable Elements

```typescript
import { drag } from "d3-drag";
import { select } from "d3-selection";
import type { D3DragEvent } from "d3-drag";

interface DraggableNode {
  x: number;
  y: number;
  id: string;
}

type NodeDragEvent = D3DragEvent<
  SVGCircleElement,
  DraggableNode,
  DraggableNode
>;

const DRAG_RADIUS = 10;

function setupDrag(svgEl: SVGSVGElement): void {
  const dragBehavior = drag<SVGCircleElement, DraggableNode>()
    .on("start", function (event: NodeDragEvent) {
      select(this).raise().attr("stroke", "black");
    })
    .on("drag", function (event: NodeDragEvent) {
      select(this).attr("cx", event.x).attr("cy", event.y);
    })
    .on("end", function (event: NodeDragEvent) {
      select(this).attr("stroke", null);
    });

  select(svgEl)
    .selectAll<SVGCircleElement, DraggableNode>("circle")
    .call(dragBehavior);
}
```

**Why good:** typed drag events and element generics, `.raise()` brings dragged element to front (prevents occlusion), visual feedback on drag start/end, `function` keyword required for `this` context in D3 event handlers

### Bad Example - Arrow Function in D3 Event Handler

```typescript
// Bad: arrow function loses `this` binding
const dragBehavior = drag().on("drag", (event) => {
  select(this) // `this` is lexical scope, not the DOM element!
    .attr("cx", event.x);
});
```

**Why bad:** D3 event handlers use `this` to reference the DOM element — arrow functions capture lexical `this` instead, causing `select(this)` to select the wrong element. Use `function` keyword or `select(event.currentTarget)`.

---

## Pattern 5: Tooltips

### Good Example - HTML Tooltip Positioned by Mouse

```typescript
const TOOLTIP_OFFSET_X = 12;
const TOOLTIP_OFFSET_Y = -10;

// Create tooltip div (once, outside SVG)
const tooltip = select(container)
  .append("div")
  .attr("class", "chart-tooltip")
  .style("position", "absolute")
  .style("pointer-events", "none")
  .style("opacity", 0);

// Attach to data elements
select(svgEl)
  .selectAll<SVGRectElement, BarData>("rect")
  .on("mouseenter", (event: MouseEvent, d: BarData) => {
    tooltip
      .style("opacity", 1)
      .html(`<strong>${d.label}</strong><br/>Value: ${d.value}`);
  })
  .on("mousemove", (event: MouseEvent) => {
    tooltip
      .style("left", `${event.pageX + TOOLTIP_OFFSET_X}px`)
      .style("top", `${event.pageY + TOOLTIP_OFFSET_Y}px`);
  })
  .on("mouseleave", () => {
    tooltip.style("opacity", 0);
  });
```

**Why good:** HTML tooltip (not SVG text) supports rich formatting, `pointer-events: none` prevents tooltip from intercepting mouse events, positioned with page coordinates, opacity toggle for show/hide

### SVG Title Tooltip (Simple Alternative)

```typescript
// Native browser tooltip via <title> element
svg
  .selectAll("rect")
  .data(data)
  .join("rect")
  .attr("width", (d) => xScale(d.value))
  .attr("height", BAR_HEIGHT)
  .append("title")
  .text((d) => `${d.label}: ${d.value}`);
```

**When to use:** quick prototyping where custom styling isn't needed — browser handles positioning and rendering
