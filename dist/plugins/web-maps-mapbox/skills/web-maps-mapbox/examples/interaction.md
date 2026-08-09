# Mapbox GL JS - 3D, Geocoding, and Directions

> 3D terrain, fog, fill-extrusion, drawing tools, geocoding, and directions. See [SKILL.md](../SKILL.md) for concepts and [reference.md](../reference.md) for decision frameworks.

**Related examples:**

- [core.md](core.md) - Map setup, markers, popups, controls, events
- [layers.md](layers.md) - Sources, layers, expressions, clustering

---

## Pattern 1: 3D Terrain

### Good Example - Terrain with Raster-DEM Source

```typescript
const TERRAIN_TILE_SIZE = 512;
const TERRAIN_MAX_ZOOM = 14;
const TERRAIN_EXAGGERATION = 1.5;
const TERRAIN_PITCH = 60;
const MOUNTAIN_CENTER: [number, number] = [-118.7, 36.55];
const MOUNTAIN_ZOOM = 12;

const map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/mapbox/standard",
  center: MOUNTAIN_CENTER,
  zoom: MOUNTAIN_ZOOM,
  pitch: TERRAIN_PITCH,
});

map.on("style.load", () => {
  map.addSource("mapbox-dem", {
    type: "raster-dem",
    url: "mapbox://mapbox.mapbox-terrain-dem-v1",
    tileSize: TERRAIN_TILE_SIZE,
    maxzoom: TERRAIN_MAX_ZOOM,
  });

  map.setTerrain({
    source: "mapbox-dem",
    exaggeration: TERRAIN_EXAGGERATION,
  });
});
```

**Why good:** Named constants for terrain config, uses `style.load` (survives style changes), exaggeration enhances elevation visibility, high pitch for 3D perspective

---

## Pattern 2: Fog and Atmosphere

### Good Example - Day and Night Fog Presets

```typescript
const FOG_RANGE: [number, number] = [-1, 2];
const HORIZON_BLEND = 0.3;
const STAR_INTENSITY_DAY = 0.0;
const STAR_INTENSITY_NIGHT = 0.8;

interface FogPreset {
  range: [number, number];
  "horizon-blend": number;
  color: string;
  "high-color": string;
  "space-color": string;
  "star-intensity": number;
}

const DAY_FOG: FogPreset = {
  range: FOG_RANGE,
  "horizon-blend": HORIZON_BLEND,
  color: "white",
  "high-color": "#add8e6",
  "space-color": "#d8f2ff",
  "star-intensity": STAR_INTENSITY_DAY,
};

const NIGHT_FOG: FogPreset = {
  range: FOG_RANGE,
  "horizon-blend": HORIZON_BLEND,
  color: "#242B4B",
  "high-color": "#161B36",
  "space-color": "#0B1026",
  "star-intensity": STAR_INTENSITY_NIGHT,
};

map.on("style.load", () => {
  map.setFog(DAY_FOG);
});

// Switch to night
function setNightMode() {
  map.setFog(NIGHT_FOG);
}
```

**Why good:** Typed fog preset interface, named constants for shared values, presets are reusable and switchable

---

## Pattern 3: Fill-Extrusion (3D Buildings)

### Good Example - Extruded Buildings from Vector Source

```typescript
const MIN_BUILDING_ZOOM = 14;
const BUILDING_COLOR = "#aaa";
const BUILDING_OPACITY = 0.6;

map.on("style.load", () => {
  const layers = map.getStyle()?.layers ?? [];
  // Find label layer for insertion point (if not using Standard style slots)
  const labelLayerId = layers.find(
    (layer) => layer.type === "symbol" && layer.layout?.["text-field"],
  )?.id;

  map.addLayer(
    {
      id: "3d-buildings",
      source: "composite",
      "source-layer": "building",
      type: "fill-extrusion",
      minzoom: MIN_BUILDING_ZOOM,
      paint: {
        "fill-extrusion-color": BUILDING_COLOR,
        "fill-extrusion-height": ["get", "height"],
        "fill-extrusion-base": ["get", "min_height"],
        "fill-extrusion-opacity": BUILDING_OPACITY,
      },
    },
    labelLayerId, // Insert below labels
  );
});
```

**Why good:** Named constants, minzoom avoids rendering at low zoom, height from data properties, placed below labels for readability

### Good Example - Custom Fill-Extrusion from GeoJSON

```typescript
const DEFAULT_HEIGHT_M = 20;
const HEIGHT_MULTIPLIER = 0.01;

map.addSource("zones", {
  type: "geojson",
  data: zonesGeoJSON,
});

map.addLayer({
  id: "zone-extrusions",
  type: "fill-extrusion",
  source: "zones",
  slot: "middle",
  paint: {
    "fill-extrusion-color": [
      "interpolate",
      ["linear"],
      ["get", "density"],
      0,
      "#2ecc71",
      500,
      "#f39c12",
      1000,
      "#e74c3c",
    ],
    "fill-extrusion-height": ["*", ["get", "density"], HEIGHT_MULTIPLIER],
    "fill-extrusion-base": 0,
    "fill-extrusion-opacity": 0.7,
  },
});
```

**Why good:** Height and color driven by data property, expression-based extrusion scales with density

---

## Pattern 4: Heatmap Layer

### Good Example - Density Heatmap

```typescript
const HEATMAP_MAX_ZOOM = 15;
const HEATMAP_TRANSITION_ZOOM = 14;

map.addLayer({
  id: "crime-heatmap",
  type: "heatmap",
  source: "crime-data",
  maxzoom: HEATMAP_MAX_ZOOM,
  paint: {
    // Weight by property value
    "heatmap-weight": [
      "interpolate",
      ["linear"],
      ["get", "severity"],
      0,
      0,
      10,
      1,
    ],
    // Intensity increases with zoom
    "heatmap-intensity": [
      "interpolate",
      ["linear"],
      ["zoom"],
      0,
      1,
      HEATMAP_MAX_ZOOM,
      3,
    ],
    // Color gradient
    "heatmap-color": [
      "interpolate",
      ["linear"],
      ["heatmap-density"],
      0,
      "rgba(33,102,172,0)",
      0.2,
      "rgb(103,169,207)",
      0.4,
      "rgb(209,229,240)",
      0.6,
      "rgb(253,219,199)",
      0.8,
      "rgb(239,138,98)",
      1,
      "rgb(178,24,43)",
    ],
    // Radius grows with zoom
    "heatmap-radius": [
      "interpolate",
      ["linear"],
      ["zoom"],
      0,
      2,
      HEATMAP_MAX_ZOOM,
      20,
    ],
    // Fade out at high zoom (transition to points)
    "heatmap-opacity": [
      "interpolate",
      ["linear"],
      ["zoom"],
      HEATMAP_TRANSITION_ZOOM - 1,
      1,
      HEATMAP_TRANSITION_ZOOM,
      0,
    ],
  },
});
```

**Why good:** Weight by property for meaningful density, zoom-responsive intensity/radius, color gradient from cool to hot, fade-out at high zoom to transition to individual points

---

## Pattern 5: Geocoder Plugin

### Good Example - Search Control

```typescript
import MapboxGeocoder from "@mapbox/mapbox-gl-geocoder";
import "@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css";

const geocoder = new MapboxGeocoder({
  accessToken: mapboxgl.accessToken,
  mapboxgl,
  marker: true, // Add marker at result
  placeholder: "Search for a place",
  proximity: {
    // Bias results toward current map center
    longitude: map.getCenter().lng,
    latitude: map.getCenter().lat,
  },
  countries: "us", // Limit to country
  types: "address,poi", // Limit result types
});

map.addControl(geocoder, "top-left");

// Listen for result selection
geocoder.on("result", (e: { result: MapboxGeocoder.Result }) => {
  const { center, place_name } = e.result;
  // center is [lng, lat]
});

// Listen for clear
geocoder.on("clear", () => {
  // Reset state
});
```

**Why good:** Proximity bias improves local search relevance, country and type filters reduce noise, event listeners for custom behavior

---

## Pattern 6: Directions Plugin

### Good Example - Route Display

```typescript
import MapboxDirections from "@mapbox/mapbox-gl-directions/dist/mapbox-gl-directions";
import "@mapbox/mapbox-gl-directions/dist/mapbox-gl-directions.css";

const directions = new MapboxDirections({
  accessToken: mapboxgl.accessToken,
  unit: "metric",
  profile: "mapbox/driving-traffic", // driving-traffic, driving, walking, cycling
  alternatives: true,
  controls: {
    inputs: true,
    instructions: true,
    profileSwitcher: true,
  },
});

map.addControl(directions, "top-left");

// Set origin and destination programmatically
directions.setOrigin([-73.9857, 40.7484]);
directions.setDestination([-73.9654, 40.7829]);

// Listen for route
directions.on(
  "route",
  (e: { route: Array<{ distance: number; duration: number }> }) => {
    const route = e.route[0];
    if (route) {
      const distanceKm = route.distance / 1000;
      const durationMin = route.duration / 60;
    }
  },
);
```

**Why good:** Profile includes traffic data, alternatives enabled for multiple route options, programmatic origin/destination for integration with app logic

---

## Pattern 7: queryRenderedFeatures

### Good Example - Identify Features at Point

```typescript
map.on("click", (e) => {
  // Query all visible features at click point
  const features = map.queryRenderedFeatures(e.point);

  // Query specific layers only
  const parkFeatures = map.queryRenderedFeatures(e.point, {
    layers: ["parks-fill", "parks-outline"],
  });

  // Query within a bounding box (rectangular area)
  const BBOX_SIZE_PX = 5;
  const bbox: [mapboxgl.PointLike, mapboxgl.PointLike] = [
    [e.point.x - BBOX_SIZE_PX, e.point.y - BBOX_SIZE_PX],
    [e.point.x + BBOX_SIZE_PX, e.point.y + BBOX_SIZE_PX],
  ];
  const nearbyFeatures = map.queryRenderedFeatures(bbox, {
    layers: ["stores-circles"],
  });

  if (parkFeatures.length > 0) {
    const name = parkFeatures[0].properties?.name;
    // Handle click on park
  }
});
```

**Why good:** Layer filter limits results to relevant features, bounding box for touch-friendly target, property access with optional chaining

---

## Pattern 8: Image and Raster Sources

### Good Example - Custom Image Overlay

```typescript
map.on("load", () => {
  // Image source -- overlay a georeferenced image
  map.addSource("radar-overlay", {
    type: "image",
    url: "/images/radar-snapshot.png",
    coordinates: [
      [-80.425, 46.437], // Top-left
      [-71.516, 46.437], // Top-right
      [-71.516, 37.936], // Bottom-right
      [-80.425, 37.936], // Bottom-left
    ],
  });

  map.addLayer({
    id: "radar-layer",
    type: "raster",
    source: "radar-overlay",
    paint: { "raster-opacity": 0.7 },
  });
});

// Update image dynamically
function updateRadarImage(newUrl: string) {
  const source = map.getSource("radar-overlay");
  if (source && source.type === "image") {
    source.updateImage({ url: newUrl });
  }
}
```

**Why good:** Coordinates define exact geographic bounds of image, opacity allows map to show through, type guard before updating
