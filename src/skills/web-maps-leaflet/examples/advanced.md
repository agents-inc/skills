# Leaflet Advanced Patterns

> Related: [core.md](core.md) for map setup, markers, GeoJSON, and events

---

## Pattern 1: Custom Controls

### Interactive Control with Button

```typescript
interface InfoControlOptions extends L.ControlOptions {
  title?: string;
}

const InfoControl = L.Control.extend({
  options: {
    position: "topright" as L.ControlPosition,
    title: "Info",
  } as InfoControlOptions,

  onAdd(map: L.Map): HTMLElement {
    const container = L.DomUtil.create(
      "div",
      "leaflet-bar leaflet-control info-control",
    );

    const button = L.DomUtil.create("a", "info-button", container);
    button.innerHTML = "i";
    button.href = "#";
    button.title = this.options.title;
    button.setAttribute("role", "button");

    // Prevent map interaction when clicking the control
    L.DomEvent.disableClickPropagation(container);
    L.DomEvent.disableScrollPropagation(container);

    L.DomEvent.on(button, "click", (e: Event) => {
      L.DomEvent.preventDefault(e);
      this._togglePanel();
    });

    this._container = container;
    return container;
  },

  onRemove(_map: L.Map): void {
    // Remove event listeners if necessary
  },

  _togglePanel(): void {
    const panel = this._container.querySelector(".info-panel");
    if (panel) {
      panel.classList.toggle("visible");
    }
  },
});

// Factory function (Leaflet convention)
function infoControl(options?: InfoControlOptions): L.Control {
  return new InfoControl(options);
}

infoControl({ position: "topright", title: "Details" }).addTo(map);
```

**Key rules:**

- Call `L.DomEvent.disableClickPropagation(container)` to prevent map clicks through the control
- Call `L.DomEvent.disableScrollPropagation(container)` if the control has scrollable content
- Use `L.DomEvent.on()` / `L.DomEvent.off()` for control event binding (not native addEventListener)
- Use `L.DomUtil.create(tagName, className, parent)` to build the DOM hierarchy

### Control with Updatable Content

```typescript
const LegendControl = L.Control.extend({
  options: { position: "bottomright" as L.ControlPosition },

  onAdd(_map: L.Map): HTMLElement {
    this._div = L.DomUtil.create("div", "legend-control");
    this.update();
    return this._div;
  },

  update(props?: { label: string; color: string }[]): void {
    if (!this._div) return;

    const items = props ?? [];
    this._div.innerHTML =
      "<h4>Legend</h4>" +
      items
        .map(
          ({ label, color }) =>
            `<div><span style="background:${color};width:12px;height:12px;display:inline-block;margin-right:4px;"></span>${label}</div>`,
        )
        .join("");
  },

  onRemove(_map: L.Map): void {
    // no-op
  },
});

const legend = new LegendControl();
legend.addTo(map);

// Update legend content later
legend.update([
  { label: "Low", color: "#2ecc71" },
  { label: "Medium", color: "#f39c12" },
  { label: "High", color: "#e74c3c" },
]);
```

---

## Pattern 2: Marker Clustering

### Basic Cluster Setup

```typescript
import L from "leaflet";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

const MAX_CLUSTER_RADIUS = 50;
const DISABLE_CLUSTERING_ZOOM = 18;
const CHUNK_INTERVAL_MS = 200;
const CHUNK_DELAY_MS = 50;

const clusterGroup = L.markerClusterGroup({
  maxClusterRadius: MAX_CLUSTER_RADIUS,
  disableClusteringAtZoom: DISABLE_CLUSTERING_ZOOM,
  chunkedLoading: true,
  chunkInterval: CHUNK_INTERVAL_MS,
  chunkDelay: CHUNK_DELAY_MS,
  showCoverageOnHover: false,
  spiderfyOnMaxZoom: true,
  zoomToBoundsOnClick: true,
  animate: true,
});

// Bulk add is more efficient than individual addLayer calls
const markers = locations.map((loc) =>
  L.marker([loc.lat, loc.lng]).bindPopup(loc.name),
);
clusterGroup.addLayers(markers);
map.addLayer(clusterGroup);
```

### Custom Cluster Icons

```typescript
const SMALL_CLUSTER_THRESHOLD = 10;
const MEDIUM_CLUSTER_THRESHOLD = 100;

function getClusterClass(count: number): string {
  if (count < SMALL_CLUSTER_THRESHOLD) return "cluster-small";
  if (count < MEDIUM_CLUSTER_THRESHOLD) return "cluster-medium";
  return "cluster-large";
}

const clusterGroup = L.markerClusterGroup({
  iconCreateFunction: (cluster: L.MarkerCluster) => {
    const count = cluster.getChildCount();
    const size =
      count < SMALL_CLUSTER_THRESHOLD
        ? 30
        : count < MEDIUM_CLUSTER_THRESHOLD
          ? 40
          : 50;

    return L.divIcon({
      html: `<div><span>${count}</span></div>`,
      className: `custom-cluster ${getClusterClass(count)}`,
      iconSize: L.point(size, size),
    });
  },
});
```

### Cluster Events

```typescript
clusterGroup.on("clusterclick", (e: L.LeafletEvent) => {
  const cluster = e.layer as L.MarkerCluster;
  const childMarkers = cluster.getAllChildMarkers();
  console.log(`Cluster with ${childMarkers.length} markers`);
});

clusterGroup.on("animationend", () => {
  console.log("Cluster animation finished");
});
```

### Refresh Clusters After Data Change

```typescript
// After changing a marker's icon or popup content
marker.setIcon(newIcon);
clusterGroup.refreshClusters(marker);

// Refresh all clusters
clusterGroup.refreshClusters();
```

### Zoom to Show a Specific Marker

```typescript
// Zooms and spiderfies as needed to reveal the marker
clusterGroup.zoomToShowLayer(targetMarker, () => {
  targetMarker.openPopup();
});
```

---

## Pattern 3: TypeScript Patterns

### Typed GeoJSON Features

```typescript
import type {
  Feature,
  FeatureCollection,
  Point,
  Polygon,
  GeoJsonProperties,
} from "geojson";

// Strongly typed properties
interface CityProperties extends GeoJsonProperties {
  name: string;
  population: number;
  country: string;
}

type CityFeature = Feature<Point, CityProperties>;
type CityCollection = FeatureCollection<Point, CityProperties>;

const POPULATION_THRESHOLD = 1_000_000;
const LARGE_CITY_RADIUS = 12;
const SMALL_CITY_RADIUS = 6;

const cityLayer = L.geoJSON<CityProperties>(cityData as CityCollection, {
  pointToLayer: (feature: CityFeature, latlng: L.LatLng) => {
    const radius =
      feature.properties.population > POPULATION_THRESHOLD
        ? LARGE_CITY_RADIUS
        : SMALL_CITY_RADIUS;
    return L.circleMarker(latlng, { radius });
  },
  onEachFeature: (feature: CityFeature, layer: L.Layer) => {
    layer.bindPopup(
      `<strong>${feature.properties.name}</strong><br>` +
        `Pop: ${feature.properties.population.toLocaleString()}`,
    );
  },
});
```

### Typed Event Handlers

```typescript
function handleMapClick(e: L.LeafletMouseEvent): void {
  const { lat, lng } = e.latlng;
  console.log(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
}

function handleDragEnd(e: L.DragEndEvent): void {
  const marker = e.target as L.Marker;
  const position = marker.getLatLng();
  console.log("Dragged to:", position);
}

function handleZoomEnd(): void {
  console.log("Zoom level:", map.getZoom());
}

map.on("click", handleMapClick);
marker.on("dragend", handleDragEnd);
map.on("zoomend", handleZoomEnd);
```

### Typed Custom Control

```typescript
interface SearchControlOptions extends L.ControlOptions {
  placeholder?: string;
  onSearch?: (query: string) => void;
}

const SearchControl = L.Control.extend({
  options: {
    position: "topleft",
    placeholder: "Search...",
  } as SearchControlOptions,

  onAdd(_map: L.Map): HTMLElement {
    const container = L.DomUtil.create("div", "leaflet-bar search-control");
    const input = L.DomUtil.create(
      "input",
      "search-input",
      container,
    ) as HTMLInputElement;

    input.type = "text";
    input.placeholder = this.options.placeholder ?? "Search...";

    L.DomEvent.disableClickPropagation(container);

    L.DomEvent.on(input, "keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter" && this.options.onSearch) {
        this.options.onSearch(input.value);
      }
    });

    return container;
  },

  onRemove(_map: L.Map): void {
    // cleanup
  },
});
```

---

## Pattern 4: Canvas Rendering for Vector Layers

When displaying many vector shapes (circles, polylines, polygons), use the canvas renderer instead of the default SVG renderer for better performance.

### Enable Canvas Globally

```typescript
const map = L.map("map", {
  preferCanvas: true, // All vector layers use canvas renderer
});
```

### Per-Layer Canvas Renderer

```typescript
const canvasRenderer = L.canvas({ padding: 0.5 });

// Only these layers use canvas; others use default SVG
locations.forEach((loc) => {
  L.circleMarker([loc.lat, loc.lng], {
    renderer: canvasRenderer,
    radius: 5,
    fillColor: loc.color,
    fillOpacity: 0.8,
    weight: 1,
  }).addTo(map);
});
```

**When to use canvas:**

- Rendering 1000+ circles, polylines, or polygons
- Data visualization with many overlapping shapes
- Performance is more important than crisp SVG rendering

**Limitation:** Canvas-rendered layers do not support CSS styling or SVG filters. Hover styles must be applied via Leaflet events, not CSS pseudo-classes.

---

## Pattern 5: Bounds and Viewport Management

### Fit Map to Content

```typescript
const FIT_PADDING: L.PointExpression = [50, 50];
const MAX_FIT_ZOOM = 16;

const group = L.featureGroup([...markers, ...geoLayers]);

// Always check bounds validity before fitting
const bounds = group.getBounds();
if (bounds.isValid()) {
  map.fitBounds(bounds, {
    padding: FIT_PADDING,
    maxZoom: MAX_FIT_ZOOM,
  });
}
```

### Restrict Map to Geographic Area

```typescript
const WORLD_BOUNDS = L.latLngBounds(L.latLng(-90, -180), L.latLng(90, 180));

const REGION_BOUNDS = L.latLngBounds(
  L.latLng(49.5, -8.2), // SW corner
  L.latLng(59.0, 2.0), // NE corner
);

const map = L.map("map", {
  maxBounds: REGION_BOUNDS,
  maxBoundsViscosity: 1.0, // 1.0 = hard stop at boundary
  minZoom: 5,
});
```

### Loading Data Based on Viewport

```typescript
map.on("moveend", () => {
  const bounds = map.getBounds();
  const bbox = {
    south: bounds.getSouth(),
    west: bounds.getWest(),
    north: bounds.getNorth(),
    east: bounds.getEast(),
  };
  // Fetch data within visible bounds
  loadFeaturesInBounds(bbox);
});
```
