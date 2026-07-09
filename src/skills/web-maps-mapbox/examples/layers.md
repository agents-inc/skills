# Mapbox GL JS - Layers, Sources, and Expressions

> Sources, layers, expressions, data-driven styling, and clustering. See [SKILL.md](../SKILL.md) for concepts and [reference.md](../reference.md) for expression operator reference.

**Related examples:**

- [core.md](core.md) - Map setup, markers, popups, controls, events
- [interaction.md](interaction.md) - 3D terrain, fog, fill-extrusion, geocoding, directions

---

## Pattern 1: GeoJSON Source

### Good Example - Inline and URL Data

```typescript
// Inline GeoJSON
map.addSource("stores", {
  type: "geojson",
  data: {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [-73.9857, 40.7484] },
        properties: { name: "Store A", revenue: 50000, category: "retail" },
      },
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [-73.9712, 40.7614] },
        properties: { name: "Store B", revenue: 120000, category: "food" },
      },
    ],
  },
  generateId: true, // Auto-assign IDs for feature-state support
});

// URL-based GeoJSON (fetched by Mapbox GL JS)
map.addSource("parks", {
  type: "geojson",
  data: "/api/parks.geojson",
});
```

**Why good:** `generateId: true` enables feature-state for hover/selection without manually adding IDs, URL source lets Mapbox handle fetch

### Good Example - Updating GeoJSON Data

```typescript
function updateStoreData(newFeatures: GeoJSON.FeatureCollection) {
  const source = map.getSource("stores");
  if (source && source.type === "geojson") {
    source.setData(newFeatures);
  }
}
```

**Why good:** Guard check on source existence, type narrowing before calling `setData`

### Bad Example - No Source Guard

```typescript
// Bad: getSource may return undefined if source doesn't exist
map.getSource("stores").setData(newData); // Runtime error if source missing
```

**Why bad:** `getSource` returns `undefined` for nonexistent sources, no type narrowing

---

## Pattern 2: Layer Types

### Good Example - Common Layer Types

```typescript
// Circle layer -- for point data
map.addLayer({
  id: "stores-circles",
  type: "circle",
  source: "stores",
  slot: "top",
  paint: {
    "circle-radius": 8,
    "circle-color": "#3498db",
    "circle-stroke-width": 2,
    "circle-stroke-color": "#ffffff",
  },
});

// Symbol layer -- for icons and text labels
map.addLayer({
  id: "stores-labels",
  type: "symbol",
  source: "stores",
  slot: "top",
  layout: {
    "text-field": ["get", "name"],
    "text-size": 12,
    "text-offset": [0, 1.5],
    "text-anchor": "top",
  },
  paint: {
    "text-color": "#333333",
    "text-halo-color": "#ffffff",
    "text-halo-width": 1,
  },
});

// Line layer -- for routes and paths
map.addLayer({
  id: "route-line",
  type: "line",
  source: "route",
  slot: "middle",
  layout: {
    "line-join": "round",
    "line-cap": "round",
  },
  paint: {
    "line-color": "#e74c3c",
    "line-width": 4,
    "line-opacity": 0.8,
  },
});

// Fill layer -- for polygons
map.addLayer({
  id: "zones-fill",
  type: "fill",
  source: "zones",
  slot: "bottom",
  paint: {
    "fill-color": "#2ecc71",
    "fill-opacity": 0.3,
  },
});
```

**Why good:** Each layer type matched to its geometry, slot placement appropriate (labels on top, fills on bottom), text halo for readability

---

## Pattern 3: Data-Driven Expressions

### Good Example - match Expression (Categorical)

```typescript
const RETAIL_COLOR = "#e74c3c";
const FOOD_COLOR = "#2ecc71";
const OFFICE_COLOR = "#3498db";
const DEFAULT_CATEGORY_COLOR = "#95a5a6";

map.addLayer({
  id: "stores-by-category",
  type: "circle",
  source: "stores",
  paint: {
    "circle-color": [
      "match",
      ["get", "category"],
      "retail",
      RETAIL_COLOR,
      "food",
      FOOD_COLOR,
      "office",
      OFFICE_COLOR,
      DEFAULT_CATEGORY_COLOR, // Fallback for unknown categories
    ],
    "circle-radius": 8,
  },
});
```

**Why good:** Named color constants, fallback value handles unknown categories, `["get", "category"]` reads feature property

### Good Example - interpolate Expression (Continuous)

```typescript
const MIN_REVENUE = 10000;
const MAX_REVENUE = 200000;
const MIN_CIRCLE_RADIUS = 4;
const MAX_CIRCLE_RADIUS = 25;
const LOW_REVENUE_COLOR = "#3498db";
const HIGH_REVENUE_COLOR = "#e74c3c";

map.addLayer({
  id: "stores-by-revenue",
  type: "circle",
  source: "stores",
  paint: {
    "circle-radius": [
      "interpolate",
      ["linear"],
      ["get", "revenue"],
      MIN_REVENUE,
      MIN_CIRCLE_RADIUS,
      MAX_REVENUE,
      MAX_CIRCLE_RADIUS,
    ],
    "circle-color": [
      "interpolate",
      ["linear"],
      ["get", "revenue"],
      MIN_REVENUE,
      LOW_REVENUE_COLOR,
      MAX_REVENUE,
      HIGH_REVENUE_COLOR,
    ],
  },
});
```

**Why good:** Named range constants, linear interpolation scales smoothly between stops, both size and color driven by same property

### Good Example - case Expression (Conditional)

```typescript
const ACTIVE_OPACITY = 0.8;
const INACTIVE_OPACITY = 0.3;

map.addLayer({
  id: "stores-visibility",
  type: "circle",
  source: "stores",
  paint: {
    "circle-opacity": [
      "case",
      ["boolean", ["get", "isActive"], false],
      ACTIVE_OPACITY,
      INACTIVE_OPACITY,
    ],
  },
});
```

**Why good:** Named opacity constants, `["boolean", ..., false]` provides safe fallback if property is missing

### Good Example - Zoom-Dependent Styling

```typescript
const ZOOM_SMALL = 8;
const ZOOM_LARGE = 14;
const RADIUS_AT_SMALL_ZOOM = 3;
const RADIUS_AT_LARGE_ZOOM = 12;

map.addLayer({
  id: "zoom-responsive-circles",
  type: "circle",
  source: "stores",
  paint: {
    "circle-radius": [
      "interpolate",
      ["linear"],
      ["zoom"],
      ZOOM_SMALL,
      RADIUS_AT_SMALL_ZOOM,
      ZOOM_LARGE,
      RADIUS_AT_LARGE_ZOOM,
    ],
  },
});
```

**Why good:** Circles grow as user zooms in, preventing visual clutter at low zoom and providing detail at high zoom

---

## Pattern 4: Filter Expressions

### Good Example - Filtering Layers

```typescript
// Show only retail stores
map.setFilter("stores-circles", ["==", ["get", "category"], "retail"]);

// Show stores with revenue above threshold
const REVENUE_THRESHOLD = 50000;
map.setFilter("stores-circles", [">", ["get", "revenue"], REVENUE_THRESHOLD]);

// Combine conditions (AND)
map.setFilter("stores-circles", [
  "all",
  ["==", ["get", "category"], "retail"],
  [">", ["get", "revenue"], REVENUE_THRESHOLD],
]);

// Multiple values (OR)
map.setFilter("stores-circles", [
  "any",
  ["==", ["get", "category"], "retail"],
  ["==", ["get", "category"], "food"],
]);

// Alternative: "in" for multiple values
map.setFilter("stores-circles", [
  "in",
  ["get", "category"],
  ["literal", ["retail", "food"]],
]);

// Clear filter (show all)
map.setFilter("stores-circles", null);
```

**Why good:** Named threshold constant, `"all"` for AND, `"any"` for OR, `"in"` for set membership, null to clear

---

## Pattern 5: Clustering

### Good Example - Complete Cluster Implementation

```typescript
const CLUSTER_RADIUS = 50;
const CLUSTER_MAX_ZOOM = 14;
const SMALL_CLUSTER_THRESHOLD = 100;
const LARGE_CLUSTER_THRESHOLD = 750;
const SMALL_CLUSTER_SIZE = 20;
const MEDIUM_CLUSTER_SIZE = 30;
const LARGE_CLUSTER_SIZE = 40;
const SMALL_CLUSTER_COLOR = "#51bbd6";
const MEDIUM_CLUSTER_COLOR = "#f1f075";
const LARGE_CLUSTER_COLOR = "#f28cb1";
const UNCLUSTERED_POINT_SIZE = 6;
const UNCLUSTERED_POINT_COLOR = "#11b4da";

// Source with clustering enabled
map.addSource("earthquakes", {
  type: "geojson",
  data: "/data/earthquakes.geojson",
  cluster: true,
  clusterMaxZoom: CLUSTER_MAX_ZOOM,
  clusterRadius: CLUSTER_RADIUS,
});

// Cluster circle layer -- size and color by point_count
map.addLayer({
  id: "clusters",
  type: "circle",
  source: "earthquakes",
  filter: ["has", "point_count"],
  paint: {
    "circle-color": [
      "step",
      ["get", "point_count"],
      SMALL_CLUSTER_COLOR,
      SMALL_CLUSTER_THRESHOLD,
      MEDIUM_CLUSTER_COLOR,
      LARGE_CLUSTER_THRESHOLD,
      LARGE_CLUSTER_COLOR,
    ],
    "circle-radius": [
      "step",
      ["get", "point_count"],
      SMALL_CLUSTER_SIZE,
      SMALL_CLUSTER_THRESHOLD,
      MEDIUM_CLUSTER_SIZE,
      LARGE_CLUSTER_THRESHOLD,
      LARGE_CLUSTER_SIZE,
    ],
  },
});

// Cluster count label
map.addLayer({
  id: "cluster-count",
  type: "symbol",
  source: "earthquakes",
  filter: ["has", "point_count"],
  layout: {
    "text-field": ["get", "point_count_abbreviated"],
    "text-size": 12,
  },
});

// Unclustered individual points
map.addLayer({
  id: "unclustered-point",
  type: "circle",
  source: "earthquakes",
  filter: ["!", ["has", "point_count"]],
  paint: {
    "circle-color": UNCLUSTERED_POINT_COLOR,
    "circle-radius": UNCLUSTERED_POINT_SIZE,
    "circle-stroke-width": 1,
    "circle-stroke-color": "#ffffff",
  },
});

// Click cluster to zoom in and expand
map.on("click", "clusters", (e) => {
  const features = map.queryRenderedFeatures(e.point, { layers: ["clusters"] });
  if (!features.length) return;

  const clusterId = features[0].properties?.cluster_id;
  if (clusterId === undefined) return;

  const source = map.getSource("earthquakes");
  if (!source || source.type !== "geojson") return;

  source.getClusterExpansionZoom(clusterId, (err, zoom) => {
    if (err || zoom === undefined || zoom === null) return;

    map.easeTo({
      center: (features[0].geometry as GeoJSON.Point).coordinates as [
        number,
        number,
      ],
      zoom,
    });
  });
});

// Cursor feedback
map.on("mouseenter", "clusters", () => {
  map.getCanvas().style.cursor = "pointer";
});
map.on("mouseleave", "clusters", () => {
  map.getCanvas().style.cursor = "";
});
```

**Why good:** Named constants for all thresholds and sizes, three-layer pattern (clusters, labels, individual points), `step` expression for discrete size/color breaks, click handler expands clusters, guards on source and clusterId existence

### Bad Example - No Clustering for Large Datasets

```typescript
// Bad: 10,000+ DOM markers -- freezes the browser
locations.forEach((loc) => {
  new mapboxgl.Marker().setLngLat([loc.lng, loc.lat]).addTo(map);
});
```

**Why bad:** DOM markers don't scale -- each one is an HTML element. Use a circle layer with clustering enabled for large datasets

---

## Pattern 6: Updating Paint and Layout Properties

### Good Example - Dynamic Property Changes

```typescript
// Update paint property at runtime
map.setPaintProperty("stores-circles", "circle-color", "#e74c3c");
map.setPaintProperty("stores-circles", "circle-radius", 12);

// Update layout property
map.setLayoutProperty("stores-labels", "text-size", 14);

// Toggle layer visibility
map.setLayoutProperty("stores-circles", "visibility", "visible");
map.setLayoutProperty("stores-circles", "visibility", "none");
```

**Why good:** Targeted property updates without removing/re-adding layers, visibility toggle without removing the layer

---

## Pattern 7: Vector Tile Source

### Good Example - Mapbox Vector Tiles

```typescript
map.addSource("terrain-data", {
  type: "vector",
  url: "mapbox://mapbox.mapbox-terrain-v2",
});

map.addLayer({
  id: "contours",
  type: "line",
  source: "terrain-data",
  "source-layer": "contour", // Required for vector sources
  paint: {
    "line-color": "#877b59",
    "line-width": 1,
  },
  filter: ["==", ["get", "index"], 5], // Major contours only
});
```

**Why good:** `source-layer` is required for vector tile sources (specifies which layer within the tileset), filter reduces visual clutter

---

## Pattern 8: Removing Sources and Layers

### Good Example - Safe Removal

```typescript
function removeLayerAndSource(layerId: string, sourceId: string) {
  // Must remove layers before their source
  if (map.getLayer(layerId)) {
    map.removeLayer(layerId);
  }
  if (map.getSource(sourceId)) {
    map.removeSource(sourceId);
  }
}
```

**Why good:** Checks existence before removing (avoids errors), removes layer before source (source can't be removed while layers reference it)

### Bad Example - Wrong Removal Order

```typescript
// Bad: can't remove source while layers still reference it
map.removeSource("stores"); // Throws error
map.removeLayer("stores-fill"); // Too late
```

**Why bad:** Removing a source while layers reference it throws "Source 'stores' cannot be removed while layer 'stores-fill' is using it"
