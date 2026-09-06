# Leaflet Core Patterns

> Map setup, tile providers, markers and icons, GeoJSON, layer groups and control, events. See
> [SKILL.md](../SKILL.md) for the decisions, [advanced.md](advanced.md) for custom controls,
> clustering, TypeScript and canvas rendering.

---

## Pattern 1: Map Initialization and Tile Layers

### Basic Setup

```typescript
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const INITIAL_CENTER: L.LatLngExpression = [51.505, -0.09];
const INITIAL_ZOOM = 13;
const MAX_ZOOM = 19;
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const map = L.map("map").setView(INITIAL_CENTER, INITIAL_ZOOM);

L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: MAX_ZOOM,
  attribution: OSM_ATTRIBUTION,
}).addTo(map);
```

### Alternative Tile Providers

Any XYZ raster endpoint works. `{s}` is a subdomain placeholder and `{r}` expands to `@2x` on retina
displays; check the provider's own terms for what attribution and what usage they require.

```typescript
const CARTO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, ' +
  '&copy; <a href="https://carto.com/attributions">CARTO</a>';

L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
  attribution: CARTO_ATTRIBUTION,
  subdomains: "abcd",
  maxZoom: 20,
}).addTo(map);
```

### Handling Container Resize

Leaflet caches the container's size, so a resize it did not observe leaves the map rendering to the
old dimensions — grey tiles and clicks landing off-target:

```typescript
// After container CSS transition completes
container.addEventListener("transitionend", () => {
  map.invalidateSize();
});
```

### Map Options Reference

```typescript
const map = L.map("map", {
  center: [51.505, -0.09],
  zoom: 13,
  minZoom: 2,
  maxZoom: 18,
  zoomControl: true, // show +/- buttons
  scrollWheelZoom: true, // zoom with scroll
  dragging: true, // pan with mouse/touch
  preferCanvas: true, // render vector layers on canvas (better for many circles/polylines)
  attributionControl: true, // show attribution
});
```

---

## Pattern 2: Markers, Popups, Tooltips, and Custom Icons

### Standard Marker with Popup and Tooltip

```typescript
const MARKER_POSITION: L.LatLngExpression = [51.5, -0.09];

const marker = L.marker(MARKER_POSITION).addTo(map);

marker.bindPopup("<b>London</b><br>A great city.");
marker.bindTooltip("London", { permanent: false, direction: "top" });
```

### Custom Icon with L.icon

```typescript
const ICON_SIZE: L.PointExpression = [38, 95];
const SHADOW_SIZE: L.PointExpression = [50, 64];
const ICON_ANCHOR: L.PointExpression = [22, 94];
const POPUP_ANCHOR: L.PointExpression = [-3, -76];

const customIcon = L.icon({
  iconUrl: "/icons/marker-green.png",
  shadowUrl: "/icons/marker-shadow.png",
  iconSize: ICON_SIZE,
  shadowSize: SHADOW_SIZE,
  iconAnchor: ICON_ANCHOR,
  popupAnchor: POPUP_ANCHOR,
});

L.marker([51.5, -0.09], { icon: customIcon }).addTo(map);
```

### Reusable Icon Class

```typescript
const CustomIcon = L.Icon.extend({
  options: {
    shadowUrl: "/icons/marker-shadow.png",
    iconSize: [25, 41] as L.PointExpression,
    iconAnchor: [12, 41] as L.PointExpression,
    popupAnchor: [1, -34] as L.PointExpression,
    shadowSize: [41, 41] as L.PointExpression,
  },
});

const greenIcon = new CustomIcon({ iconUrl: "/icons/green.png" });
const redIcon = new CustomIcon({ iconUrl: "/icons/red.png" });
```

### L.divIcon for HTML/CSS Markers

```typescript
const BADGE_ICON_SIZE: L.PointExpression = [30, 30];

const badgeIcon = L.divIcon({
  className: "custom-badge",
  html: `<span class="badge">42</span>`,
  iconSize: BADGE_ICON_SIZE,
  iconAnchor: [15, 15],
});

L.marker([51.5, -0.09], { icon: badgeIcon }).addTo(map);
```

**When to use `L.divIcon`:** markers whose content is dynamic — counts, status badges, inline SVG.
It is also lighter than an image icon for a simple shape, since there is no request.

### Fix Default Icon Path (Bundler Issue)

Leaflet's default icon resolves its images relative to the stylesheet, and a bundler moves the CSS
somewhere those paths no longer reach — markers render as broken images. Point at the assets
explicitly:

```typescript
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// Fix default icon for bundled environments
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});
```

---

## Pattern 3: GeoJSON Layers

### Full-Featured GeoJSON Setup

```typescript
import type {
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  Geometry,
} from "geojson";

const CIRCLE_MARKER_RADIUS = 8;
const CIRCLE_MARKER_WEIGHT = 1;
const FILL_OPACITY = 0.8;
const STROKE_WEIGHT = 2;
const DEFAULT_COLOR = "#3388ff";

const geoLayer = L.geoJSON(featureCollection, {
  // Customize how points are rendered (default is L.marker)
  pointToLayer: (
    feature: Feature<Geometry, GeoJsonProperties>,
    latlng: L.LatLng,
  ) =>
    L.circleMarker(latlng, {
      radius: CIRCLE_MARKER_RADIUS,
      fillColor: feature.properties?.color ?? DEFAULT_COLOR,
      color: "#000",
      weight: CIRCLE_MARKER_WEIGHT,
      fillOpacity: FILL_OPACITY,
    }),

  // Called once per feature -- bind popups, tooltips, event listeners
  onEachFeature: (feature: Feature, layer: L.Layer) => {
    if (feature.properties?.name) {
      layer.bindPopup(`<strong>${feature.properties.name}</strong>`);
    }
  },

  // Style for line/polygon features (function for dynamic, object for static)
  style: (feature?: Feature) => ({
    color: feature?.properties?.color ?? DEFAULT_COLOR,
    weight: STROKE_WEIGHT,
    opacity: 0.7,
  }),

  // Exclude features before they are rendered
  filter: (feature: Feature) => feature.properties?.visible !== false,
}).addTo(map);
```

### Dynamic Style Updates

```typescript
// Update all features at once
geoLayer.setStyle({ color: "red", weight: 3 });

// Reset to original style function
geoLayer.resetStyle();

// Highlight on hover, reset on mouseout
geoLayer.eachLayer((layer) => {
  layer.on("mouseover", () => {
    (layer as L.Path).setStyle({ weight: 5, color: "#666" });
  });
  layer.on("mouseout", () => {
    geoLayer.resetStyle(layer as L.Path);
  });
});
```

### Adding Data Incrementally

```typescript
// Add more features to an existing GeoJSON layer
geoLayer.addData(newFeature);
geoLayer.addData(newFeatureCollection);

// Clear and reload
geoLayer.clearLayers();
geoLayer.addData(freshData);
```

### GeoJSON Coordinate Order

The GeoJSON spec is `[longitude, latitude]` and `L.latLng` is `[latitude, longitude]`. `L.geoJSON`
flips them for you, so the bug only appears in coordinates written by hand:

```typescript
// GeoJSON feature -- longitude first
const point = { type: "Point", coordinates: [-0.09, 51.5] }; // [lng, lat]

// Leaflet API -- latitude first
const marker = L.marker([51.5, -0.09]); // [lat, lng]

// L.geoJSON handles the conversion automatically
L.geoJSON(point).addTo(map); // correct -- Leaflet flips internally
```

---

## Pattern 4: Layer Groups and Layer Control

### LayerGroup for Logical Grouping

```typescript
const restaurants = L.layerGroup();
const parks = L.layerGroup();

// Add markers to groups
L.marker([51.5, -0.09]).bindPopup("Restaurant A").addTo(restaurants);
L.marker([51.51, -0.1]).bindPopup("Restaurant B").addTo(restaurants);
L.marker([51.49, -0.08]).bindPopup("Park A").addTo(parks);

// Add groups to map
restaurants.addTo(map);
parks.addTo(map);
```

### FeatureGroup for Bounds and Shared Popups

```typescript
const featureGroup = L.featureGroup([markerA, markerB, polygonA]);
featureGroup.addTo(map);

// Zoom to fit all features
const bounds = featureGroup.getBounds();
if (bounds.isValid()) {
  map.fitBounds(bounds);
}

// Bind a popup to the entire group
featureGroup.bindPopup("This group contains multiple features");
```

**Key difference:** `L.layerGroup` is a container and nothing more. `L.featureGroup` adds
`getBounds()`, `bindPopup()`, `bindTooltip()` and `setStyle()` — reach for it whenever the group has
to be fitted, styled or clicked as a unit.

### Layer Control (Base Layers + Overlays)

```typescript
const osm = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: OSM_ATTRIBUTION,
  maxZoom: MAX_ZOOM,
});

// Stand-in URL and attribution -- substitute your satellite provider's own
const satellite = L.tileLayer(
  "https://{s}.tile.provider.com/sat/{z}/{x}/{y}.png",
  {
    attribution: "Satellite Provider",
    maxZoom: MAX_ZOOM,
  },
);

// Base layers -- radio buttons (only one active)
const baseLayers = { Street: osm, Satellite: satellite };

// Overlays -- checkboxes (multiple active)
const overlays = { Restaurants: restaurants, Parks: parks };

// Add the first base layer to the map and show the control
osm.addTo(map);
L.control.layers(baseLayers, overlays).addTo(map);
```

### Programmatic Layer Toggle

```typescript
// Add/remove layers programmatically
if (map.hasLayer(parks)) {
  map.removeLayer(parks);
} else {
  map.addLayer(parks);
}
```

---

## Pattern 5: Events and Interaction

### Map Events

```typescript
// Click to get coordinates
map.on("click", (e: L.LeafletMouseEvent) => {
  console.log(`Clicked: ${e.latlng.lat}, ${e.latlng.lng}`);
});

// After zoom completes
map.on("zoomend", () => {
  console.log("Zoom:", map.getZoom());
});

// After pan/zoom settles
map.on("moveend", () => {
  const bounds = map.getBounds();
  console.log("Visible bounds:", bounds.toBBoxString());
});
```

### Marker Events

```typescript
const marker = L.marker([51.5, -0.09], { draggable: true }).addTo(map);

marker.on("click", () => {
  console.log("Marker clicked");
});

marker.on("dragend", (e: L.DragEndEvent) => {
  const position = (e.target as L.Marker).getLatLng();
  console.log("New position:", position);
});
```

### Map Navigation Methods

```typescript
const TARGET: L.LatLngExpression = [48.8566, 2.3522];
const FLY_ZOOM = 14;
const FLY_DURATION_S = 2;
const FIT_PADDING: L.PointExpression = [50, 50];

// Animated flight to coordinates
map.flyTo(TARGET, FLY_ZOOM, { duration: FLY_DURATION_S });

// Fit bounds with padding
map.fitBounds(featureGroup.getBounds(), { padding: FIT_PADDING });

// Instant (no animation)
map.setView(TARGET, FLY_ZOOM);
```

### Event Cleanup

```typescript
const handleMove = () => {
  /* ... */
};
map.on("moveend", handleMove);

// Later, remove the specific handler
map.off("moveend", handleMove);

// Remove ALL listeners (typically in teardown)
map.off();
```

### Common Event Types Reference

| Target        | Event        | Fires When                               |
| ------------- | ------------ | ---------------------------------------- |
| Map           | `click`      | User clicks the map                      |
| Map           | `moveend`    | Pan or zoom animation finishes           |
| Map           | `zoomend`    | Zoom animation finishes                  |
| Map           | `resize`     | Map container size changes               |
| Marker        | `click`      | Marker is clicked                        |
| Marker        | `dragend`    | Draggable marker is dropped              |
| Popup         | `popupopen`  | Popup opens                              |
| Popup         | `popupclose` | Popup closes                             |
| GeoJSON layer | `click`      | Feature is clicked (via `onEachFeature`) |
