# D3.js Reference

> Lookup tables for D3 v7. See [SKILL.md](SKILL.md) for decisions and red flags, and [examples/](examples/) for code.

---

## Modules

Install only what you import:

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

## Scale by data type

| Data                  | Scale             | Use case                     |
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

## Shape generators

| Generator | Input               | Output            | Key Accessors                                                      |
| --------- | ------------------- | ----------------- | ------------------------------------------------------------------ |
| `line()`  | Array of points     | SVG path string   | `.x()`, `.y()`, `.curve()`                                         |
| `area()`  | Array of points     | SVG path string   | `.x()`, `.y0()`, `.y1()`, `.curve()`                               |
| `arc()`   | Angle + radius data | SVG path string   | `.innerRadius()`, `.outerRadius()`, `.startAngle()`, `.endAngle()` |
| `pie()`   | Array of values     | Array of arc data | `.value()`, `.sort()`, `.padAngle()`                               |
| `stack()` | Tabular data        | Array of series   | `.keys()`, `.order()`, `.offset()`                                 |

---

## Geographic projections

| Projection         | Character                                     |
| ------------------ | --------------------------------------------- |
| `geoMercator`      | Web maps; conformal, preserves local shape    |
| `geoNaturalEarth1` | World maps; compromise between shape and area |
| `geoEqualEarth`    | World maps; equal-area                        |
| `geoAlbersUsa`     | US maps with Alaska and Hawaii insets         |
| `geoOrthographic`  | Globe view                                    |

---

## Easing functions

| Easing           | Motion                                         |
| ---------------- | ---------------------------------------------- |
| `easeLinear`     | Constant speed; reads as mechanical            |
| `easeCubicOut`   | Fast start, slow end — the data-update default |
| `easeCubicInOut` | Slow, fast, slow                               |
| `easeExpOut`     | Very fast deceleration; snappy                 |
| `easeElasticOut` | Springy overshoot                              |
| `easeBounceOut`  | Bounce at the end                              |

---

## TypeScript type names

| Concept   | Type                                                    |
| --------- | ------------------------------------------------------- |
| Selection | `Selection<Element, Datum, ParentElement, ParentDatum>` |
| Scales    | `ScaleLinear`, `ScaleBand`, `ScaleTime`, `ScaleOrdinal` |
| Pie datum | `PieArcDatum<T>`                                        |
| Force     | `SimulationNodeDatum`, `SimulationLinkDatum<T>`         |
| Events    | `D3ZoomEvent`, `D3BrushEvent`, `D3DragEvent`            |
