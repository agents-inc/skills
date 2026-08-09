# Recharts Quick Reference

> Related: [SKILL.md](SKILL.md) for patterns and decision frameworks, [examples/core.md](examples/core.md) for basic charts, [examples/advanced.md](examples/advanced.md) for composed charts and animations.

---

## Chart Types

| Chart Type       | Import     | Use Case                                  |
| ---------------- | ---------- | ----------------------------------------- |
| `LineChart`      | `recharts` | Trends over time, continuous data         |
| `BarChart`       | `recharts` | Categorical comparisons, discrete periods |
| `AreaChart`      | `recharts` | Trends with volume emphasis               |
| `PieChart`       | `recharts` | Part-of-whole (< 8 categories)            |
| `ComposedChart`  | `recharts` | Mixed types (Bar + Line + Area)           |
| `ScatterChart`   | `recharts` | Correlation between two variables         |
| `RadarChart`     | `recharts` | Multi-dimensional comparison              |
| `RadialBarChart` | `recharts` | Circular bar comparison                   |
| `FunnelChart`    | `recharts` | Conversion funnels                        |
| `Treemap`        | `recharts` | Hierarchical data proportions             |

---

## Essential Component Props

### Chart Containers

| Prop            | Type                         | Default        | Notes                                |
| --------------- | ---------------------------- | -------------- | ------------------------------------ |
| `data`          | `object[]`                   | --             | Source data array                    |
| `width`         | `number \| string`           | --             | Required without ResponsiveContainer |
| `height`        | `number \| string`           | --             | Required without ResponsiveContainer |
| `margin`        | `{top, right, bottom, left}` | `{5,5,5,5}`    | Padding around chart area            |
| `layout`        | `"horizontal" \| "vertical"` | `"horizontal"` | Chart orientation                    |
| `responsive`    | `boolean`                    | `false`        | v3+: CSS-based responsive sizing     |
| `syncId`        | `string \| number`           | --             | Sync tooltip/brush across charts     |
| `throttleDelay` | `number \| "raf"`            | `"raf"`        | Mouse event throttling               |

### XAxis / YAxis

| Prop            | Type                                              | Default                                | Notes                                           |
| --------------- | ------------------------------------------------- | -------------------------------------- | ----------------------------------------------- |
| `dataKey`       | `string \| function`                              | --                                     | Data field to bind                              |
| `type`          | `"category" \| "number"`                          | XAxis: `"category"`, YAxis: `"number"` | Axis value type                                 |
| `domain`        | `[min, max]`                                      | `["auto", "auto"]`                     | Numeric range, accepts `"dataMin"`, `"dataMax"` |
| `tickFormatter` | `(value) => string`                               | --                                     | Format tick labels                              |
| `tickCount`     | `number`                                          | `5`                                    | Number of ticks (numeric axis only)             |
| `scale`         | `"auto" \| "log" \| "symlog"`                     | `"auto"`                               | Scale type                                      |
| `hide`          | `boolean`                                         | `false`                                | Hide axis                                       |
| `orientation`   | `"top" \| "bottom"` (X) / `"left" \| "right"` (Y) | `"bottom"` / `"left"`                  | Axis position                                   |
| `width`         | `number \| "auto"`                                | `60` (Y)                               | YAxis width; `"auto"` in v3                     |

### Tooltip

| Prop             | Type                             | Default                 | Notes                                      |
| ---------------- | -------------------------------- | ----------------------- | ------------------------------------------ |
| `content`        | `ReactNode \| function`          | `DefaultTooltipContent` | Custom tooltip (must return HTML, not SVG) |
| `formatter`      | `(value, name, props) => string` | --                      | Format individual values                   |
| `labelFormatter` | `(label) => string`              | --                      | Format the tooltip header                  |
| `trigger`        | `"hover" \| "click"`             | `"hover"`               | Activation method                          |
| `active`         | `boolean`                        | --                      | Control tooltip visibility                 |
| `defaultIndex`   | `number`                         | --                      | Default active data index                  |

### Data Series (Line / Bar / Area)

| Prop                | Type                           | Default                     | Notes                           |
| ------------------- | ------------------------------ | --------------------------- | ------------------------------- |
| `dataKey`           | `string \| function`           | --                          | Data field to render (required) |
| `yAxisId`           | `string \| number`             | `0`                         | Which YAxis to use              |
| `isAnimationActive` | `boolean`                      | `true`                      | Enable/disable animation        |
| `animationDuration` | `number`                       | `1500`                      | Animation duration (ms)         |
| `animationEasing`   | `string`                       | `"ease"`                    | Easing function                 |
| `dot`               | `boolean \| object \| element` | Line: `true`, Area: `false` | Data point markers              |
| `activeDot`         | `boolean \| object \| element` | `{r: 8}`                    | Hover marker                    |

### Pie

| Prop           | Type                             | Default   | Notes                          |
| -------------- | -------------------------------- | --------- | ------------------------------ |
| `data`         | `object[]`                       | --        | Data for this pie (required)   |
| `dataKey`      | `string`                         | `"value"` | Value field                    |
| `nameKey`      | `string`                         | `"name"`  | Label field for tooltip/legend |
| `cx` / `cy`    | `number \| string`               | `"50%"`   | Center position                |
| `innerRadius`  | `number \| string`               | `0`       | > 0 for donut style            |
| `outerRadius`  | `number \| string`               | `"80%"`   | Outer boundary                 |
| `label`        | `boolean \| element \| function` | `false`   | Sector labels                  |
| `paddingAngle` | `number`                         | `0`       | Gap between slices             |

### ResponsiveContainer

| Prop        | Type                      | Default  | Notes                 |
| ----------- | ------------------------- | -------- | --------------------- |
| `width`     | `number \| string`        | `"100%"` | Container width       |
| `height`    | `number \| string`        | `"100%"` | Container height      |
| `aspect`    | `number`                  | --       | Width-to-height ratio |
| `debounce`  | `number`                  | `0`      | Resize debounce (ms)  |
| `minWidth`  | `number \| string`        | `0`      | Minimum width         |
| `maxHeight` | `number`                  | --       | Maximum height        |
| `onResize`  | `(width, height) => void` | --       | Resize callback       |

---

## Anti-Patterns Checklist

| Anti-Pattern                                 | Fix                                                           |
| -------------------------------------------- | ------------------------------------------------------------- |
| Inline `data={rawData.map(...)}`             | `const data = useMemo(() => rawData.map(...), [rawData])`     |
| Missing dimensions, chart renders nothing    | Add `width`/`height` or wrap in `ResponsiveContainer`         |
| Custom tooltip returns SVG elements          | Return HTML `<div>`/`<p>` elements from tooltip content       |
| `dataKey` function defined inline            | Extract to `useCallback` or define outside component          |
| All pie slices same color                    | Add `Cell` components with `fill` for each slice              |
| `CartesianGrid` missing with custom axis IDs | Set `xAxisId`/`yAxisId` on `CartesianGrid` matching your axes |
| Animations on real-time data                 | Set `isAnimationActive={false}` and use `throttleDelay`       |
| Duplicate `XAxis`/`YAxis` without unique IDs | Add `xAxisId`/`yAxisId` to distinguish multiple axes          |
