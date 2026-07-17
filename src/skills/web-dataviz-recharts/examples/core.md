# Core Recharts Patterns

> Related: [SKILL.md](../SKILL.md) for decision frameworks, [advanced.md](advanced.md) for composed charts and animations.

---

## Pattern 1: Basic Line Chart with TypeScript

```tsx
import { useMemo } from "react";
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

export function RevenueChart({ data }: RevenueChartProps) {
  // Memoize data to prevent unnecessary recalculation
  const chartData = useMemo(() => data, [data]);

  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <LineChart
        data={chartData}
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

**Why good:** TypeScript interface for data shape, memoized data prop, `ResponsiveContainer` handles sizing, named constants for dimensions.

```tsx
// BAD: Common mistakes
function BadChart({ data }) {
  return (
    // No ResponsiveContainer, no width/height -- renders nothing
    <LineChart data={data.map((d) => ({ ...d, value: d.value * 2 }))}>
      {/* Inline .map() creates new array every render */}
      <Line dataKey="value" />
      {/* Missing XAxis, YAxis, Tooltip -- chart is barely functional */}
    </LineChart>
  );
}
```

**Why bad:** No dimensions (renders nothing), inline `.map()` creates unstable reference, missing essential components.

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

**Why good:** `tickFormatter` and `Tooltip formatter` keep values consistent, `name` prop gives human-readable legend labels, `CURRENCY_FORMAT` defined once and reused.

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

**Why good:** SVG `<defs>` for gradient fills, gradient ID as named constant to avoid string duplication, clean area chart with visual depth.

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

**Why good:** Typed with Recharts types, handles `active`/`payload` guards, returns HTML elements (not SVG), custom props via element or function pattern.

```tsx
// BAD: Untyped, returns SVG
function BadTooltip({ active, payload }) {
  // No null check -- crashes when tooltip is not active
  return (
    <svg>
      {/* SVG elements cause rendering errors in Tooltip content */}
      <text>{payload[0].value}</text>
    </svg>
  );
}
```

**Why bad:** No TypeScript types, no `active`/`payload` guard, returns SVG (must return HTML), crashes on empty payload.

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

**Why good:** Custom `label` function skips tiny slices, `Cell` per slice for colors, donut style via `innerRadius`, percentage labels positioned inside slices.

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

**Why good:** Dual Y-axes with unique IDs, right-side axis for second metric, matching `yAxisId` between axes and lines, tick formatters show units.

```tsx
// BAD: Missing yAxisId coordination
<YAxis /> {/* default ID: 0 */}
<YAxis orientation="right" /> {/* also default ID: 0 -- collision */}
<Line dataKey="temperature" /> {/* which axis? ambiguous */}
```

**Why bad:** Duplicate default axis IDs cause rendering issues, lines don't specify which axis to use.

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

**Why good:** Same `stackId` on all bars creates a stacked bar chart. Each `Bar` is an independent component with its own color and legend entry.

---

## Pattern 8: Responsive Approaches

### ResponsiveContainer with aspect ratio

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

**Key difference:** `ResponsiveContainer` uses ResizeObserver with optional debounce. The `responsive` prop uses standard CSS sizing rules from the parent element.

### SSR fallback

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

**Why good:** `initialDimension` provides fallback sizes for SSR where ResizeObserver hasn't fired yet.
