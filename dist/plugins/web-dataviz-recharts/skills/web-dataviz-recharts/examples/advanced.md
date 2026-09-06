# Recharts — Advanced Examples

> ComposedChart, brushing, reference lines, chart sync, real-time updates, custom scatter shapes, radar. See [SKILL.md](../SKILL.md) for decisions, [reference.md](../reference.md) for prop tables, [core.md](core.md) for the basic chart types.

---

## Pattern 1: ComposedChart with Mixed Types

```tsx
import {
  ComposedChart,
  Line,
  Bar,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface SalesTrendData {
  month: string;
  sales: number;
  trend: number;
  forecast: number;
}

const CHART_HEIGHT = 400;
const FORECAST_OPACITY = 0.3;

interface SalesTrendChartProps {
  data: SalesTrendData[];
}

export function SalesTrendChart({ data }: SalesTrendChartProps) {
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <ComposedChart
        data={data}
        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" />
        <YAxis
          yAxisId="left"
          label={{ value: "Sales ($)", angle: -90, position: "insideLeft" }}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          label={{ value: "Trend", angle: 90, position: "insideRight" }}
        />
        <Tooltip />
        <Legend />
        <Area
          yAxisId="left"
          type="monotone"
          dataKey="forecast"
          fill="#82ca9d"
          stroke="#82ca9d"
          fillOpacity={FORECAST_OPACITY}
          name="Forecast"
        />
        <Bar
          yAxisId="left"
          dataKey="sales"
          fill="#8884d8"
          name="Actual Sales"
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="trend"
          stroke="#ff7300"
          strokeWidth={2}
          dot={false}
          name="Trend Line"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
```

**Why good:** three visual types share one x-axis while sales and trend keep separate y-scales, and the `label` props say what each axis measures — which two unlabelled axes on opposite sides cannot.

**Ordering is z-order.** SVG has no `z-index`, so `Area` written before `Bar` is what puts the bars on top of the fill. Swap them and the translucent area covers the bars.

---

## Pattern 2: Brush for Range Selection

```tsx
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Brush,
  ResponsiveContainer,
} from "recharts";

const CHART_HEIGHT = 400;
const BRUSH_HEIGHT = 30;
const BRUSH_START = 0;
const BRUSH_END_OFFSET = 30; // Show last 30 data points initially

interface TimeSeriesWithBrushProps {
  data: Array<{ date: string; value: number }>;
}

export function TimeSeriesWithBrush({ data }: TimeSeriesWithBrushProps) {
  const initialEndIndex = Math.min(BRUSH_END_OFFSET, data.length - 1);

  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip />
        <Area type="monotone" dataKey="value" stroke="#8884d8" fill="#8884d8" />
        <Brush
          dataKey="date"
          height={BRUSH_HEIGHT}
          stroke="#8884d8"
          startIndex={BRUSH_START}
          endIndex={initialEndIndex}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
```

**Why good:** the brush windows a long series without filtering the data — `startIndex`/`endIndex` are positions in the array, so clamping `endIndex` against `data.length - 1` keeps a short series from opening on an empty window.

**Gotcha:** the brush renders a second miniature copy of the series, so it roughly doubles the chart's DOM. That is heavy on a dashboard of several charts.

---

## Pattern 3: Reference Lines and Areas

```tsx
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
  ResponsiveContainer,
} from "recharts";

const CHART_HEIGHT = 350;
const TARGET_VALUE = 5000;
const DANGER_ZONE_MIN = 0;
const DANGER_ZONE_MAX = 1000;

interface MetricsChartProps {
  data: Array<{ date: string; value: number }>;
}

export function MetricsChart({ data }: MetricsChartProps) {
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip />
        {/* Horizontal reference line for target */}
        <ReferenceLine
          y={TARGET_VALUE}
          label={{ value: "Target", position: "right" }}
          stroke="green"
          strokeDasharray="3 3"
        />
        {/* Danger zone highlight */}
        <ReferenceArea
          y1={DANGER_ZONE_MIN}
          y2={DANGER_ZONE_MAX}
          fill="red"
          fillOpacity={0.1}
          label="Danger Zone"
        />
        <Line type="monotone" dataKey="value" stroke="#8884d8" />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

**Why good:** both are annotations in chart coordinates rather than data — a target line drawn as an extra flat series would appear in the legend and the tooltip, which is not what a threshold is.

---

## Pattern 4: Synchronized Charts

```tsx
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const CHART_HEIGHT = 200;
const SYNC_GROUP = "dashboard-sync";

interface DashboardData {
  time: string;
  cpu: number;
  memory: number;
}

interface SyncedDashboardProps {
  data: DashboardData[];
}

export function SyncedDashboard({ data }: SyncedDashboardProps) {
  return (
    <div>
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <LineChart data={data} syncId={SYNC_GROUP}>
          <XAxis dataKey="time" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="cpu" stroke="#8884d8" />
        </LineChart>
      </ResponsiveContainer>

      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <AreaChart data={data} syncId={SYNC_GROUP}>
          <XAxis dataKey="time" />
          <YAxis />
          <Tooltip />
          <Area
            type="monotone"
            dataKey="memory"
            fill="#82ca9d"
            stroke="#82ca9d"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
```

**Why good:** a shared `syncId` couples hover and brush state, so one cursor reads across both series — which is the point of stacking charts on a shared time axis. The id is global, so two unrelated dashboards must not reuse a value.

---

## Pattern 5: Real-Time Data Updates

```tsx
import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const CHART_HEIGHT = 300;
const MAX_DATA_POINTS = 50;
const UPDATE_INTERVAL_MS = 1000;
const THROTTLE_DELAY_MS = 100;

interface DataPoint {
  time: string;
  value: number;
}

export function RealTimeChart() {
  const [data, setData] = useState<DataPoint[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      setData((prev) => {
        const newPoint: DataPoint = {
          time: new Date().toLocaleTimeString(),
          value: Math.random() * 100,
        };
        // Fixed-size window: the chart's node count stays constant as time runs
        return [...prev, newPoint].slice(-MAX_DATA_POINTS);
      });
    }, UPDATE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <LineChart data={data} throttleDelay={THROTTLE_DELAY_MS}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="time" />
        <YAxis domain={[0, 100]} />
        <Tooltip />
        <Line
          type="monotone"
          dataKey="value"
          stroke="#8884d8"
          isAnimationActive={false}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

**Why good:** four things keep a once-a-second chart cheap — the animation is off so the series is not re-tweened each tick, `dot={false}` drops one DOM node per point, the sliding window bounds the total, and `throttleDelay` caps how often hover recomputes. The interval is cleared on unmount.

```tsx
// BAD
<Line dataKey="value" isAnimationActive dot />
```

**Why bad:** each update restarts a full animation that the next update interrupts a second later, so the line never settles; and 50 dot elements are torn down and rebuilt every tick.

---

## Pattern 6: ScatterChart with Custom Shapes

```tsx
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const CHART_HEIGHT = 400;

interface DataPoint {
  x: number;
  y: number;
  size: number;
}

interface ScatterPlotProps {
  data: DataPoint[];
}

// Custom shape -- render function receives each data point
function CustomDot(props: { cx: number; cy: number; payload: DataPoint }) {
  const { cx, cy, payload } = props;
  const radius = Math.sqrt(payload.size) * 2;

  return <circle cx={cx} cy={cy} r={radius} fill="#8884d8" fillOpacity={0.6} />;
}

export function ScatterPlot({ data }: ScatterPlotProps) {
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
        <CartesianGrid />
        <XAxis type="number" dataKey="x" name="X Value" />
        <YAxis type="number" dataKey="y" name="Y Value" />
        <Tooltip cursor={{ strokeDasharray: "3 3" }} />
        <Scatter
          name="Data Points"
          data={data}
          shape={<CustomDot cx={0} cy={0} payload={{ x: 0, y: 0, size: 0 }} />}
        />
      </ScatterChart>
    </ResponsiveContainer>
  );
}
```

**Why good:** the custom `shape` turns a scatter into a bubble chart by encoding a third field in the radius — via `Math.sqrt`, so area rather than radius carries the value. Both axes need `type="number"`, since `XAxis` defaults to `"category"` and would space the points evenly instead of by value.

---

## Pattern 7: LabelList for Data Labels

```tsx
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
} from "recharts";

const CHART_HEIGHT = 350;
const VALUE_FORMAT = (value: number) => `$${value.toLocaleString()}`;

interface SalesData {
  name: string;
  sales: number;
}

interface LabeledBarChartProps {
  data: SalesData[];
}

export function LabeledBarChart({ data }: LabeledBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <BarChart
        data={data}
        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis tickFormatter={VALUE_FORMAT} />
        <Bar dataKey="sales" fill="#8884d8">
          <LabelList
            dataKey="sales"
            position="top"
            formatter={VALUE_FORMAT}
            style={{ fontSize: "12px", fill: "#666" }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
```

**Why good:** the values are readable without hovering, which is what a printed or exported chart needs. `LabelList` is a child of the series it labels, so it inherits that series' data — and reusing the axis formatter keeps the two from disagreeing about notation.

---

## Pattern 8: RadarChart for Multi-Dimensional Data

```tsx
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";

const CHART_HEIGHT = 400;
const FILL_OPACITY = 0.3;

interface SkillData {
  skill: string;
  candidate: number;
  average: number;
  fullMark: number;
}

interface SkillRadarProps {
  data: SkillData[];
}

export function SkillRadar({ data }: SkillRadarProps) {
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <RadarChart data={data}>
        <PolarGrid />
        <PolarAngleAxis dataKey="skill" />
        <PolarRadiusAxis angle={30} domain={[0, "dataMax"]} />
        <Tooltip />
        <Legend />
        <Radar
          name="Candidate"
          dataKey="candidate"
          stroke="#8884d8"
          fill="#8884d8"
          fillOpacity={FILL_OPACITY}
        />
        <Radar
          name="Average"
          dataKey="average"
          stroke="#82ca9d"
          fill="#82ca9d"
          fillOpacity={FILL_OPACITY}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
```

**Why good:** the radar's polar equivalents of the cartesian parts — `PolarGrid`, `PolarAngleAxis` for the dimension labels, `PolarRadiusAxis` for the scale. Two series overlap deliberately, and `fillOpacity` below 1 is what keeps the lower one visible.
