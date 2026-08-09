# D3.js Quick Reference

> Decision frameworks, module reference, and anti-patterns for D3.js v7 development. See [SKILL.md](SKILL.md) for core concepts and red flags, and [examples/](examples/) for code examples.

---

## D3 Module Reference

D3 v7 is fully modular. Install only what you need:

| Module               | Purpose                        | Key Exports                                                                                    |
| -------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------- |
| `d3-selection`       | DOM manipulation, data binding | `select`, `selectAll`, `create`                                                                |
| `d3-scale`           | Data-to-visual mapping         | `scaleLinear`, `scaleBand`, `scaleTime`, `scaleOrdinal`, `scaleLog`, `scaleSqrt`, `scalePoint` |
| `d3-axis`            | Axis rendering                 | `axisTop`, `axisRight`, `axisBottom`, `axisLeft`                                               |
| `d3-shape`           | SVG path generators            | `line`, `area`, `arc`, `pie`, `stack`, `curveMonotoneX`                                        |
| `d3-array`           | Data utilities                 | `max`, `min`, `extent`, `mean`, `sum`, `group`, `sort`, `ascending`, `descending`              |
| `d3-transition`      | Animated interpolation         | Side-effect import extends selection prototype                                                 |
| `d3-ease`            | Easing functions               | `easeCubicOut`, `easeLinear`, `easeElasticOut`                                                 |
| `d3-force`           | Force-directed layouts         | `forceSimulation`, `forceLink`, `forceManyBody`, `forceCenter`, `forceCollide`                 |
| `d3-geo`             | Geographic projections         | `geoMercator`, `geoNaturalEarth1`, `geoAlbersUsa`, `geoPath`                                   |
| `d3-zoom`            | Pan and zoom behavior          | `zoom`, `zoomIdentity`, `zoomTransform`                                                        |
| `d3-brush`           | Rectangle selection            | `brush`, `brushX`, `brushY`                                                                    |
| `d3-drag`            | Drag behavior                  | `drag`                                                                                         |
| `d3-format`          | Number formatting              | `format` (e.g., `format(",.0f")`)                                                              |
| `d3-time-format`     | Date formatting                | `timeFormat`, `timeParse`                                                                      |
| `d3-scale-chromatic` | Color schemes                  | `schemeCategory10`, `interpolateBlues`, `interpolateViridis`                                   |
| `d3-interpolate`     | Custom interpolators           | `interpolate`, `interpolateRgb`, `interpolateNumber`                                           |
| `d3-hierarchy`       | Tree/hierarchy layouts         | `hierarchy`, `treemap`, `partition`, `pack`                                                    |

---

## Scale Selection Guide

| Data Type             | Scale             | Use Case                     |
| --------------------- | ----------------- | ---------------------------- |
| Continuous numbers    | `scaleLinear`     | Revenue, temperature, counts |
| Dates/times           | `scaleTime`       | Time series x-axis           |
| Categories (bars)     | `scaleBand`       | Bar chart category axis      |
| Categories (points)   | `scalePoint`      | Scatter plot category axis   |
| Exponential data      | `scaleLog`        | Wide-range data (1 to 1M)    |
| Area/radius encoding  | `scaleSqrt`       | Bubble chart radius          |
| Category to color     | `scaleOrdinal`    | Color-coding categories      |
| Sequential color ramp | `scaleSequential` | Heatmaps, choropleths        |

---

## Shape Generator Quick Reference

| Generator | Input               | Output            | Key Accessors                                                      |
| --------- | ------------------- | ----------------- | ------------------------------------------------------------------ |
| `line()`  | Array of points     | SVG path string   | `.x()`, `.y()`, `.curve()`                                         |
| `area()`  | Array of points     | SVG path string   | `.x()`, `.y0()`, `.y1()`, `.curve()`                               |
| `arc()`   | Angle + radius data | SVG path string   | `.innerRadius()`, `.outerRadius()`, `.startAngle()`, `.endAngle()` |
| `pie()`   | Array of values     | Array of arc data | `.value()`, `.sort()`, `.padAngle()`                               |
| `stack()` | Tabular data        | Array of series   | `.keys()`, `.order()`, `.offset()`                                 |

---

## Common Patterns Checklist

- [ ] Margin convention applied (`MARGIN` object, `innerWidth`/`innerHeight`)
- [ ] `viewBox` on SVG for responsive scaling
- [ ] Scales derived from data with `max()`/`extent()`
- [ ] `.nice()` on continuous scales for clean tick values
- [ ] Key function in `.data(array, keyFn)` when identity matters
- [ ] `d3-transition` imported (side effect) before calling `.transition()`
- [ ] Force simulation stopped on unmount (`.stop()`)
- [ ] Zoom transform applied to inner `<g>`, not SVG root
- [ ] TypeScript generics on selections, scales, and events

---

> **Anti-patterns and gotchas:** See [SKILL.md RED FLAGS section](SKILL.md) for the complete list.
