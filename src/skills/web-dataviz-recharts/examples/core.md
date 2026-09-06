# Recharts — Core Examples

> Line, bar, area and pie charts, responsive sizing, custom tooltips, multi-axis, stacking. See [SKILL.md](../SKILL.md) for decisions, [reference.md](../reference.md) for prop tables, [advanced.md](advanced.md) for composed charts, brushing and real-time data.

---

## Pattern 1: Line Chart with TypeScript

```tsx
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface MonthlyRevenue {
  month: string;
  revenue: number;
  expenses: number;
}

const CHART_HEIGHT = 400;
const STROKE_WIDTH = 2;

interface RevenueChartProps {
  data: MonthlyRevenue[];
}

// `data` arrives from the caller with a stable identity, so there is nothing to memoize here.
// Memoize where the array is DERIVED — `useMemo(() => aggregate(raw), [raw])`.
export function RevenueChart({ data }: RevenueChartProps) {
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <LineChart
        data={data}
        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Line
          type="monotone"
          dataKey="revenue"
          stroke="#8884d8"
          strokeWidth={STROKE_WIDTH}
          dot={{ r: 4 }}
          activeDot={{ r: 6 }}
        />
        <Line
          type="monotone"
          dataKey="expenses"
          stroke="#82ca9d"
          strokeWidth={STROKE_WIDTH}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

**Why good:** the data interface types every `dataKey` against a real field, `ResponsiveContainer` supplies the dimensions, and `activeDot` gives the hovered point a larger marker than the resting `dot`.

```tsx
// BAD
function BadChart({ data }) {
  return (
    <LineChart data={data.map((d) => ({ ...d, value: d.value * 2 }))}>
      <Line dataKey="value" />
    </LineChart>
  );
}
```

**Why bad:** no `ResponsiveContainer` and no `width`/`height`, so the SVG renders empty with no error to explain it. The inline `.map()` produces a new array on every render, which re-derives every point. And with no `XAxis` or `YAxis` there is nothing to read the line against.

---

## Pattern 2: Bar Chart with Formatting

```tsx
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const CHART_HEIGHT = 350;
const CURRENCY_FORMAT = (value: number) => `$${value.toLocaleString()}`;

interface SalesData {
  quarter: string;
  online: number;
  inStore: number;
}

interface SalesChartProps {
  data: SalesData[];
}

export function SalesChart({ data }: SalesChartProps) {
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="quarter" />
        <YAxis tickFormatter={CURRENCY_FORMAT} />
        <Tooltip formatter={CURRENCY_FORMAT} />
        <Legend />
        <Bar dataKey="online" fill="#8884d8" name="Online Sales" />
        <Bar dataKey="inStore" fill="#82ca9d" name="In-Store Sales" />
      </BarChart>
    </ResponsiveContainer>
  );
}
```

**Why good:** one formatter feeds both the axis ticks and the tooltip, so the same number never appears in two notations; `name` supplies the legend text, which otherwise falls back to the raw `dataKey`.

---

## Pattern 3: Area Chart with Gradient Fill

```tsx
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const CHART_HEIGHT = 300;
const GRADIENT_ID = "colorValue";

interface TimeSeriesData {
  date: string;
  value: number;
}

interface TimeSeriesChartProps {
  data: TimeSeriesData[];
}

export function TimeSeriesChart({ data }: TimeSeriesChartProps) {
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id={GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
            <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip />
        <Area
          type="monotone"
          dataKey="value"
          stroke="#8884d8"
          fill={`url(#${GRADIENT_ID})`}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
```

**Why good:** the gradient is an ordinary SVG `<defs>` child, referenced by `fill="url(#id)"`. The id is global to the document, so a constant per chart keeps two charts on one page from claiming the same one.

---

## Pattern 4: Custom Tooltip

```tsx
import type { TooltipProps } from "recharts";
import type { ValueType, NameType } from "recharts/types/component/DefaultTooltipContent";

interface CustomTooltipProps extends TooltipProps<ValueType, NameType> {
  currencySymbol?: string;
}

const DEFAULT_CURRENCY = "$";

export function CustomTooltip({
  active,
  payload,
  label,
  currencySymbol = DEFAULT_CURRENCY,
}: CustomTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div style={{ background: "#fff", border: "1px solid #ccc", padding: "10px" }}>
      <p style={{ fontWeight: "bold", marginBottom: "4px" }}>{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color, margin: "2px 0" }}>
          {entry.name}: {currencySymbol}
          {Number(entry.value).toLocaleString()}
        </p>
      ))}
    </div>
  );
}

// Usage -- pass as element to receive extra props
<Tooltip content={<CustomTooltip currencySymbol="EUR " />} />

// Usage -- pass as function for inline customization
<Tooltip content={(props) => <CustomTooltip {...props} currencySymbol="$" />} />
```

**Why good:** the `active`/`payload` guard covers the render before the first hover, extending `TooltipProps` keeps the extra prop typed alongside the injected ones, and passing an element rather than the component is what lets `currencySymbol` through.

```tsx
// BAD
function BadTooltip({ active, payload }) {
  return (
    <svg>
      <text>{payload[0].value}</text>
    </svg>
  );
}
```

**Why bad:** `payload` is empty until a mark is hovered, so `payload[0].value` throws on the first render. And the tooltip is an HTML overlay positioned above the chart, so the `<svg>` returned here renders nothing even once the crash is fixed.

---

## Pattern 5: PieChart with Custom Labels

```tsx
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface CategoryData {
  name: string;
  value: number;
}

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];
const CHART_SIZE = 400;
const OUTER_RADIUS = 130;
const INNER_RADIUS = 70;
const RADIAN = Math.PI / 180;
const LABEL_THRESHOLD_PERCENT = 5;

// Custom label that shows percentage
function renderLabel({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}: {
  cx: number;
  cy: number;
  midAngle: number;
  innerRadius: number;
  outerRadius: number;
  percent: number;
}) {
  // Skip labels for tiny slices
  const PERCENT_MULTIPLIER = 100;
  if (percent * PERCENT_MULTIPLIER < LABEL_THRESHOLD_PERCENT) return null;

  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
    >
      {`${(percent * PERCENT_MULTIPLIER).toFixed(0)}%`}
    </text>
  );
}

interface CategoryPieChartProps {
  data: CategoryData[];
}

export function CategoryPieChart({ data }: CategoryPieChartProps) {
  return (
    <ResponsiveContainer width="100%" height={CHART_SIZE}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={OUTER_RADIUS}
          innerRadius={INNER_RADIUS}
          label={renderLabel}
          labelLine={false}
        >
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
```

**Why good:** the label function returns `null` below a percentage threshold, which is what stops small slices' labels from piling up on each other; `labelLine={false}` removes the leader lines that make that pile worse. The label position is computed at the mid-radius from `midAngle`, so it sits inside the slice.

---

## Pattern 6: Multi-Axis Chart

```tsx
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const CHART_HEIGHT = 400;
const TEMPERATURE_FORMAT = (value: number) => `${value}\u00B0C`;
const HUMIDITY_FORMAT = (value: number) => `${value}%`;

interface WeatherData {
  time: string;
  temperature: number;
  humidity: number;
}

interface WeatherChartProps {
  data: WeatherData[];
}

export function WeatherChart({ data }: WeatherChartProps) {
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="time" />
        <YAxis yAxisId="temp" tickFormatter={TEMPERATURE_FORMAT} />
        <YAxis
          yAxisId="humidity"
          orientation="right"
          tickFormatter={HUMIDITY_FORMAT}
        />
        <Tooltip />
        <Legend />
        <Line
          yAxisId="temp"
          type="monotone"
          dataKey="temperature"
          stroke="#ff7300"
        />
        <Line
          yAxisId="humidity"
          type="monotone"
          dataKey="humidity"
          stroke="#387908"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

**Why good:** each `Line` names the axis it is scaled against, so two metrics in different units keep their own ranges instead of sharing one that flattens the smaller of them. The tick formatters carry the units, which the legend does not.

```tsx
// BAD
<YAxis />                      {/* id 0 */}
<YAxis orientation="right" />  {/* also id 0 — collision */}
<Line dataKey="temperature" /> {/* binds to id 0 — which one? */}
```

**Why bad:** `yAxisId` defaults to `0`, so both axes claim the same id and the series cannot say which it belongs to. Humidity on a 0–100 scale and temperature on a 0–40 one end up sharing whichever domain resolves first.

---

## Pattern 7: Stacked Bar Chart

```tsx
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const CHART_HEIGHT = 350;

interface TrafficData {
  page: string;
  organic: number;
  paid: number;
  referral: number;
}

interface TrafficChartProps {
  data: TrafficData[];
}

export function TrafficChart({ data }: TrafficChartProps) {
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="page" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar dataKey="organic" stackId="traffic" fill="#8884d8" />
        <Bar dataKey="paid" stackId="traffic" fill="#82ca9d" />
        <Bar dataKey="referral" stackId="traffic" fill="#ffc658" />
      </BarChart>
    </ResponsiveContainer>
  );
}
```

**Why good:** the shared `stackId` is the only difference between a stacked and a grouped bar chart — each `Bar` keeps its own colour and legend entry either way. Bars with different `stackId` values sit side by side.

---

## Pattern 8: Responsive Approaches

### ResponsiveContainer with an aspect ratio

```tsx
const ASPECT_RATIO = 16 / 9;
const MIN_WIDTH = 300;

<ResponsiveContainer width="100%" aspect={ASPECT_RATIO} minWidth={MIN_WIDTH}>
  <LineChart data={data}>{/* ... */}</LineChart>
</ResponsiveContainer>;
```

### v3 `responsive` prop (CSS-based)

```tsx
// Parent must have defined dimensions via CSS
<div style={{ width: "100%", height: "400px" }}>
  <LineChart data={data} responsive>
    {/* chart sizes itself to parent via CSS */}
  </LineChart>
</div>
```

**Key difference:** `ResponsiveContainer` measures with a ResizeObserver and can debounce; `responsive` takes the size from the parent's CSS box and saves a wrapper element.

### Server-rendered first paint

```tsx
const FALLBACK_WIDTH = 800;
const FALLBACK_HEIGHT = 400;

<ResponsiveContainer
  width="100%"
  height={FALLBACK_HEIGHT}
  initialDimension={{ width: FALLBACK_WIDTH, height: FALLBACK_HEIGHT }}
>
  <LineChart data={data}>{/* ... */}</LineChart>
</ResponsiveContainer>;
```

**Why good:** there is no ResizeObserver on the server, so the container measures nothing and the markup ships without a chart. `initialDimension` gives it a size to render at until the client measures for real.
