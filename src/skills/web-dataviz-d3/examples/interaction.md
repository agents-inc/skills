# D3.js — Interaction Examples

> Transitions, zoom, brush, drag, tooltips. See [SKILL.md](../SKILL.md) for decisions, [reference.md](../reference.md) for the easing table, [core.md](core.md) for selections and scales, [advanced.md](advanced.md) for force, geo and framework integration.

---

## Pattern 1: Transitions — Animated Updates

### Good — animated bar chart update

```typescript
import "d3-transition"; // side-effect import: adds .transition() to the selection prototype
import { select } from "d3-selection";
import { easeCubicOut } from "d3-ease";

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

**Why good:** entering bars grow from the baseline with an index-proportional `.delay()`, updating bars move directly, and exiting bars shrink back to the baseline before `.remove()` detaches them

### Chained transitions

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

**Why good:** a `.transition()` chained onto a transition starts when the previous one ends, so phases sequence without `setTimeout`

Easing functions are listed in [reference.md](../reference.md).

### Bad — transition without the import

```typescript
// import "d3-transition";  // omitted

select(svg)
  .selectAll("rect")
  .data(data)
  .join("rect")
  .transition() // TypeError: .transition is not a function
  .duration(TRANSITION_DURATION_MS)
  .attr("width", (d) => xScale(d.value));
```

**Why bad:** `d3-transition` adds `.transition()` to the selection prototype as a side effect, so it has to be imported even when nothing from it is named — and a bundler configured to drop side-effect-free imports will remove it if the package is misdeclared.

---

## Pattern 2: Zoom and Pan

### Good — geometric zoom on a chart

```typescript
import { zoom, zoomIdentity } from "d3-zoom";
import { select } from "d3-selection";
import type { ZoomBehavior, D3ZoomEvent } from "d3-zoom";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 20;

function setupZoom(
  svgEl: SVGSVGElement,
  chartGroup: SVGGElement,
): ZoomBehavior<SVGSVGElement, unknown> {
  const zoomBehavior = zoom<SVGSVGElement, unknown>()
    .scaleExtent([MIN_ZOOM, MAX_ZOOM])
    .on("zoom", (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
      // Transform the inner group, not the SVG root
      select(chartGroup).attr("transform", event.transform.toString());
    });

  select(svgEl).call(zoomBehavior);
  return zoomBehavior; // the caller needs it to drive zoom programmatically
}

function resetZoom(
  svgEl: SVGSVGElement,
  zoomBehavior: ZoomBehavior<SVGSVGElement, unknown>,
): void {
  select(svgEl)
    .transition()
    .duration(TRANSITION_DURATION_MS)
    .call(zoomBehavior.transform, zoomIdentity);
}
```

**Why good:** the transform lands on the inner `<g>` rather than the SVG root, `scaleExtent` bounds the range, and `setupZoom` returns the behaviour so `resetZoom` has the same instance to drive — `zoomBehavior.transform` on a different instance resets nothing

### Semantic zoom — rescale the axes

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

**Why good:** the tick labels update to the zoomed domain and the marks reposition at full resolution — geometric zoom instead scales the rendered pixels, so strokes thicken and text stretches

### Bad — transform on the SVG root

```typescript
const zoomBehavior = zoom().on("zoom", (event) => {
  select("svg").attr("transform", event.transform); // clips
});
```

**Why bad:** the root SVG establishes the viewport, so transforming it moves the whole element rather than its contents — panned content leaves the original bounds and is clipped away.

---

## Pattern 3: Brush Selection

### Good — brush for range selection

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

**Why good:** `.extent()` confines the brushable region to the plotting area, `.invert()` turns the pixel range back into data values, and the null check handles a cleared brush — which fires `end` with `event.selection === null` rather than not firing

### Clear the brush programmatically

```typescript
select(".brush").call(brush.move, null);
```

---

## Pattern 4: Drag Interaction

### Good — draggable elements

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

**Why good:** `.raise()` moves the dragged element to the end of its parent so it draws above its siblings, and the handlers use `function` because D3 binds the element to `this`

### Bad — arrow function where the handler needs `this`

```typescript
const dragBehavior = drag().on("drag", (event) => {
  select(this).attr("cx", event.x); // `this` is the enclosing scope
});
```

**Why bad:** D3 calls handlers with the element as `this`, and an arrow function keeps the lexical `this` instead — so `select(this)` selects the module scope or `undefined`, not the dragged element. Use `function`, or `select(event.currentTarget)`.

---

## Pattern 5: Tooltips

### Good — HTML tooltip positioned by the mouse

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

**Why good:** an HTML div takes rich markup where SVG `<text>` would need manual line breaking, and `pointer-events: none` stops the tooltip from sitting under the cursor and firing its own `mouseleave` on the mark beneath

### `<title>` — the no-CSS alternative

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

**When to use:** when the browser's own positioning and delay are acceptable. A `<title>` child is also what screen readers announce for the shape, which a positioned div is not.
