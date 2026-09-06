---
name: web-dataviz-recharts
description: Recharts composable chart components - LineChart, BarChart, AreaChart, PieChart, ComposedChart, responsive sizing, custom tooltips, animations
---

# Recharts Patterns

> **Quick Guide:** A Recharts chart is an assembly of independent child components — `XAxis`, `YAxis`, `Tooltip`, `Legend`, `CartesianGrid` and one or more data series — rather than one component taking a config object. Features are added and removed by adding and removing children. Charts render nothing without dimensions, so every chart needs `ResponsiveContainer`, the `responsive` prop, or explicit `width`/`height`. Data and callback props are compared by reference, so an inline `.map()` recomputes the whole chart every render. In v3 `accessibilityLayer` defaults to `true` and internal state is read through hooks rather than cloned props.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — line, bar, area and pie charts, responsive sizing, custom tooltips, multi-axis, stacking
- [examples/advanced.md](examples/advanced.md) — ComposedChart, Brush, reference lines, synchronized charts, real-time updates, scatter shapes, radar
- [reference.md](reference.md) — chart type table and prop cheat sheets for every component

---

<critical_requirements>

## Before writing Recharts code

**Give every chart dimensions** — `ResponsiveContainer`, the `responsive` prop, or explicit `width` and `height`. A chart with none renders an empty SVG and no error.

**Give `ResponsiveContainer` a parent with a resolved height.** It measures its parent, so a parent at `height: 0` or `display: none` measures zero and the chart never appears.

**Hold data arrays and callback props stable across renders** with `useMemo` and `useCallback`. Recharts compares them by reference, so a fresh array or arrow function each render re-derives every point.

**Return HTML from a custom `Tooltip` `content` component.** The tooltip renders into an HTML overlay positioned above the SVG, so SVG elements inside it do not display.

</critical_requirements>

---

**Auto-detection:** recharts, LineChart, BarChart, AreaChart, PieChart, ComposedChart, ScatterChart, RadarChart, RadialBarChart, FunnelChart, Treemap, ResponsiveContainer, XAxis, YAxis, CartesianGrid, dataKey, yAxisId, stackId, syncId, LabelList, ReferenceLine, ReferenceArea, Brush, PolarAngleAxis, isAnimationActive, throttleDelay, accessibilityLayer

**Applies to:**

- Line, bar, area, pie, scatter, radar, radial, funnel and treemap charts
- Composing several series, or several chart types, into one plot
- Multi-axis charts where series carry different units or scales
- Custom tooltips, legends, axis tick formatting and data labels
- Reference lines and areas, brush range selection, cross-chart tooltip sync
- Animation control and real-time update strategies

**Handled elsewhere:**

- Visualizations with no standard chart shape — building marks from scales and path generators is a different job from composing chart components
- Canvas or WebGL rendering for very large point counts — Recharts emits SVG, so every mark is a DOM node
- Physics-based or gesture-driven motion — a series animates between two data states on a duration and an easing, and there is no spring model and no drag-to-animate
- Geographic projections and 3D scenes
- Which colours the series use — `stroke` and `fill` take whatever values a product's visual language supplies
- Accessibility conformance targets — `accessibilityLayer` supplies keyboard navigation and ARIA on the chart, and which level a product must meet is settled elsewhere

---

<philosophy>

Recharts is composition rather than configuration. Adding a `<Tooltip />` adds tooltips; deleting it removes them. There is no options object, and no feature flag — the child list is the configuration.

Two consequences follow. **JSX order is z-order**, because SVG has no `z-index`: an `Area` written before a `Bar` renders behind it. And **`dataKey` is the whole binding contract** — the chart takes one `data` array and each child names the field it reads, so a series without a `dataKey` has nothing to draw.

</philosophy>

---

<decision_framework>

## Which chart type

```
Change over time?
  Continuous trend        -> LineChart or AreaChart
  Discrete periods        -> BarChart
  Trend over totals       -> ComposedChart (Bar + Line)
Part of a whole?
  Few categories (< 8)    -> PieChart; innerRadius > 0 for a donut
Correlation?
  Two variables           -> ScatterChart; encode a third in the shape's radius
Multi-dimensional?
  3+ measures per item    -> RadarChart
Stages of a process?
  Successive drop-off     -> FunnelChart
Hierarchy?
  Nested proportions      -> Treemap
```

## Which responsive approach

`ResponsiveContainer` where `debounce`, `aspect`, `onResize`, `minWidth` or `maxHeight` is needed — it measures with a ResizeObserver. The `responsive` prop otherwise, which takes the size from the parent's CSS box and saves a wrapper element.

## When to turn animation off

Data updating more than once a second, point counts in the thousands, print and export, and dashboards rendering many charts at once. Animation redraws the series on every data change.

</decision_framework>

---

<patterns>

## Core patterns

### Pattern 1: Chart composition

A container holding grid, axes, overlays and one child per series. Each child is an independent feature.

```tsx
<ResponsiveContainer width="100%" height={CHART_HEIGHT}>
  <LineChart data={data}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="month" />
    <YAxis />
    <Tooltip />
    <Legend />
    <Line type="monotone" dataKey="revenue" stroke="#8884d8" />
    <Line type="monotone" dataKey="expenses" stroke="#82ca9d" />
  </LineChart>
</ResponsiveContainer>
```

Full code: [examples/core.md](examples/core.md)

---

### Pattern 2: Responsive sizing

`ResponsiveContainer` measures its parent and passes concrete pixel dimensions down. The `responsive` prop uses the parent's CSS box directly.

```tsx
<ResponsiveContainer width="100%" aspect={16 / 9} minWidth={MIN_WIDTH}>
  <LineChart data={data}>{/* ... */}</LineChart>
</ResponsiveContainer>

// Or, with the parent sized in CSS:
<BarChart data={data} responsive>{/* ... */}</BarChart>
```

Server rendering has no ResizeObserver, so `initialDimension` supplies the first paint's size.

Full code: [examples/core.md](examples/core.md)

---

### Pattern 3: Custom tooltips

`content` takes an element or a function. The component receives `active`, `payload` and `label`, and `payload` is empty until a mark is hovered.

```tsx
function CustomTooltip({
  active,
  payload,
  label,
}: TooltipProps<ValueType, NameType>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="custom-tooltip">
      <p>{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  );
}

<Tooltip content={<CustomTooltip />} />;
```

Passing an element rather than the component is how extra props reach it: `content={<CustomTooltip currencySymbol="EUR " />}`.

Full code: [examples/core.md](examples/core.md)

---

### Pattern 4: Axis configuration

`domain` accepts literals, `"auto"`, `"dataMin"`, `"dataMax"` and arithmetic on those. `tickFormatter` owns label text.

```tsx
<XAxis dataKey="date" tickFormatter={DATE_FORMATTER} angle={-45} textAnchor="end" height={60} />
<YAxis tickFormatter={CURRENCY_FORMATTER} domain={[0, "dataMax + 1000"]} width={80} />
```

`XAxis` defaults to `type="category"` and `YAxis` to `type="number"` — a numeric x-axis needs `type="number"` set explicitly, or the values are treated as labels and spaced evenly.

Full code: [examples/core.md](examples/core.md)

---

### Pattern 5: Pie and donut charts

`PieChart` is the container and `Pie` the series. `Cell` children colour slices individually; `innerRadius` above zero makes it a donut.

```tsx
<PieChart width={CHART_SIZE} height={CHART_SIZE}>
  <Pie
    data={data}
    dataKey="value"
    nameKey="name"
    cx="50%"
    cy="50%"
    outerRadius={OUTER_RADIUS}
    innerRadius={INNER_RADIUS}
    label
  >
    {data.map((_, index) => (
      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
    ))}
  </Pie>
  <Tooltip />
</PieChart>
```

Full code: [examples/core.md](examples/core.md)

---

### Pattern 6: Multiple axes and multiple series

`yAxisId` pairs a series with an axis. Two axes without distinct ids collide on the default id `0`.

```tsx
<ComposedChart data={data}>
  <XAxis dataKey="month" />
  <YAxis yAxisId="left" />
  <YAxis yAxisId="right" orientation="right" />
  <Bar dataKey="sales" yAxisId="left" fill="#8884d8" />
  <Line type="monotone" dataKey="trend" yAxisId="right" stroke="#ff7300" />
</ComposedChart>
```

`stackId` is the equivalent for stacking — bars sharing one `stackId` stack rather than group.

Full code: [examples/advanced.md](examples/advanced.md)

---

### Pattern 7: Animation control

Series animate on mount and on data change. The three props are per series.

```tsx
<Line
  dataKey="value"
  isAnimationActive
  animationDuration={ANIMATION_DURATION}
  animationEasing="ease-in-out"
  animationBegin={0}
/>
```

`animationBegin` staggers series that would otherwise all start together.

Full code: [examples/advanced.md](examples/advanced.md)

---

### Pattern 8: Keeping large or fast-changing charts responsive

Reference stability first, then node count, then event rate.

```tsx
const chartData = useMemo(() => aggregate(rawData), [rawData]); // stable identity
const formatTick = useCallback((value: number) => `$${value}`, []);

<LineChart data={chartData} throttleDelay={THROTTLE_DELAY_MS}>
  <Line dataKey="value" isAnimationActive={false} dot={false} />
</LineChart>;
```

`dot={false}` removes one DOM node per point, which is usually the largest single win — aggregating 50,000 rows to 500 before rendering is the next.

Full code: [examples/advanced.md](examples/advanced.md)

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- A series with no `dataKey` — `Line`, `Bar`, `Area` and `Pie` each need one to know which field to read
- A custom tooltip with no `active`/`payload` guard — `payload` is empty before the first hover, so `payload[0].value` throws
- `data={rawData.map(...)}` written inline — a new array identity every render, so the chart re-derives everything
- An arrow function as `dataKey` or `tickFormatter` written inline — same reference churn, per tick
- Two `YAxis` elements without distinct `yAxisId` — both claim id `0` and the series bind ambiguously
- `CartesianGrid` left on the default ids while the axes use custom `xAxisId`/`yAxisId` — no grid lines drawn

**Surprising behaviour:**

- SVG has no `z-index` — stacking follows JSX order, so a series written later draws on top
- `ResponsiveContainer` measures with a ResizeObserver, which has not fired during server rendering; `initialDimension` covers the first paint
- `domain` on an axis re-derives when data changes unless `allowDataOverflow` is set
- `syncId` couples every chart carrying the same value — hover and brush state are shared, including with charts elsewhere in the tree
- `Brush` adds a second miniature chart's worth of DOM, which is heavy on a dashboard of many charts
- Pie `label` accepts `true`, an element or a function, and the default labels overlap on small slices — a label function returning `null` below a percentage threshold is the usual fix
- All slices render the same colour until `Cell` children are added
- `accessibilityLayer` is on by default in v3, so keyboard navigation and ARIA attributes are present without being asked for
- Animation redraws the series on every data change, so a chart updating each second is redrawing continuously

</red_flags>
