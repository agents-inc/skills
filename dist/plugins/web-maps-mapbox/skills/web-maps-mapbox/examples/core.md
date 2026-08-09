# Mapbox GL JS - Core Examples

> Map initialization, markers, popups, controls, events, and camera animation. See [SKILL.md](../SKILL.md) for concepts and [reference.md](../reference.md) for decision frameworks.

**Related examples:**

- [layers.md](layers.md) - Sources, layers, expressions, clustering
- [interaction.md](interaction.md) - 3D terrain, fog, fill-extrusion, geocoding, directions

---

## Pattern 1: Map Initialization

### Good Example - Full Setup with Cleanup

```typescript
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const DEFAULT_CENTER: [number, number] = [-74.006, 40.7128];
const DEFAULT_ZOOM = 12;
const DEFAULT_PITCH = 0;
const DEFAULT_BEARING = 0;

mapboxgl.accessToken = process.env.MAPBOX_ACCESS_TOKEN!;

const map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/mapbox/standard",
  center: DEFAULT_CENTER,
  zoom: DEFAULT_ZOOM,
  pitch: DEFAULT_PITCH,
  bearing: DEFAULT_BEARING,
  projection: "mercator",
});

map.on("load", () => {
  // Sources and layers go here
});

// Cleanup on unmount (framework-agnostic)
function cleanup() {
  map.remove(); // Releases GPU resources, removes event listeners
}
```

**Why good:** Named constants for all map options, explicit projection, cleanup function prevents memory leaks, load event guard for safe source/layer operations

### Bad Example - Missing Load Guard

```typescript
const map = new mapboxgl.Map({
  container: "map",
  center: [-74.006, 40.7128], // Bad: magic numbers
  zoom: 12, // Bad: magic number
});

// Bad: addSource before style is loaded -- throws error
map.addSource("data", { type: "geojson", data: myData });
map.addLayer({ id: "layer", type: "circle", source: "data" });
// Bad: no cleanup -- leaks GPU memory
```

**Why bad:** Magic numbers, addSource/addLayer called before `load` event throws "Style is not done loading", no cleanup causes WebGL context leaks

---

## Pattern 2: Markers, Popups, and Controls

### Good Example - Marker with Popup

```typescript
const MARKER_COLOR = "#e74c3c";
const POPUP_MAX_WIDTH = "300px";
const POPUP_OFFSET_PX = 25;

const popup = new mapboxgl.Popup({
  offset: POPUP_OFFSET_PX,
  maxWidth: POPUP_MAX_WIDTH,
  closeButton: true,
  closeOnClick: true,
}).setHTML("<h3>Central Park</h3><p>843 acres of green space</p>");

const marker = new mapboxgl.Marker({ color: MARKER_COLOR })
  .setLngLat([-73.9654, 40.7829])
  .setPopup(popup)
  .addTo(map);
```

**Why good:** Named constants, popup options explicit, marker-popup binding (click to open/close automatically)

### Good Example - Custom HTML Marker Element

```typescript
const el = document.createElement("div");
el.className = "custom-marker";
el.style.width = "30px";
el.style.height = "30px";
el.style.backgroundImage = "url(/icons/pin.svg)";
el.style.backgroundSize = "cover";

new mapboxgl.Marker({ element: el, anchor: "bottom" })
  .setLngLat([-73.9857, 40.7484])
  .addTo(map);
```

**Why good:** Custom element for unique marker designs, `anchor: "bottom"` places the point of the pin at the coordinate

### Good Example - Controls

```typescript
// Navigation (zoom + compass)
map.addControl(
  new mapboxgl.NavigationControl({
    showCompass: true,
    showZoom: true,
    visualizePitch: true,
  }),
  "top-right",
);

// Geolocation
map.addControl(
  new mapboxgl.GeolocateControl({
    positionOptions: { enableHighAccuracy: true },
    trackUserLocation: true,
    showUserHeading: true,
  }),
  "top-right",
);

// Scale bar
map.addControl(new mapboxgl.ScaleControl({ unit: "metric" }), "bottom-left");

// Fullscreen
map.addControl(new mapboxgl.FullscreenControl(), "top-right");
```

**Why good:** Each control positioned explicitly, geolocation with high accuracy and heading, scale in metric units

### Good Example - Programmatic Popup on Map Location

```typescript
// Popup not attached to a marker -- positioned at coordinates
new mapboxgl.Popup({ closeOnClick: false, closeOnMove: true })
  .setLngLat([-73.9857, 40.7484])
  .setText("Empire State Building") // setText is XSS-safe
  .addTo(map);
```

**Why good:** `setText` instead of `setHTML` prevents XSS, `closeOnMove` auto-dismisses when user pans

### Bad Example - setHTML with User Input

```typescript
const userInput = getUserInput(); // Untrusted data

// Bad: XSS vulnerability -- setHTML does not sanitize
new mapboxgl.Popup()
  .setLngLat(coords)
  .setHTML(`<p>${userInput}</p>`)
  .addTo(map);
```

**Why bad:** `setHTML` renders raw HTML, user input could contain `<script>` tags. Use `setText()` for plain text or `setDOMContent()` with sanitized elements

---

## Pattern 3: Multiple Markers from Data

### Good Example - Markers from Array with Cleanup

```typescript
interface Location {
  name: string;
  lng: number;
  lat: number;
  description: string;
}

const markers: mapboxgl.Marker[] = [];

function renderMarkers(locations: Location[]) {
  // Remove existing markers
  markers.forEach((m) => m.remove());
  markers.length = 0;

  for (const loc of locations) {
    const popup = new mapboxgl.Popup({ offset: 25 }).setText(
      `${loc.name}: ${loc.description}`,
    );

    const marker = new mapboxgl.Marker()
      .setLngLat([loc.lng, loc.lat])
      .setPopup(popup)
      .addTo(map);

    markers.push(marker);
  }
}

// Cleanup all markers
function removeAllMarkers() {
  markers.forEach((m) => m.remove());
  markers.length = 0;
}
```

**Why good:** Tracks markers for cleanup, removes previous markers before re-rendering, `setText` for XSS safety

---

## Pattern 4: Camera Animation

### Good Example - flyTo, easeTo, fitBounds

```typescript
const SF_CENTER: [number, number] = [-122.4194, 37.7749];
const FLY_ZOOM = 15;
const FLY_SPEED = 1.2;
const EASE_DURATION_MS = 2000;
const BOUNDS_PADDING_PX = 50;

// flyTo -- dramatic zoom with curve (default animation)
map.flyTo({
  center: SF_CENTER,
  zoom: FLY_ZOOM,
  speed: FLY_SPEED,
  essential: true, // Ignores prefers-reduced-motion (use for navigation)
});

// easeTo -- smooth linear transition
map.easeTo({
  center: SF_CENTER,
  zoom: FLY_ZOOM,
  duration: EASE_DURATION_MS,
  bearing: 45,
  pitch: 60,
});

// fitBounds -- fit data extent in view
const sw: [number, number] = [-122.5, 37.7]; // Southwest corner
const ne: [number, number] = [-122.3, 37.8]; // Northeast corner
map.fitBounds([sw, ne], {
  padding: BOUNDS_PADDING_PX,
  maxZoom: FLY_ZOOM,
});

// Listen for animation completion
map.on("moveend", () => {
  const center = map.getCenter();
  const zoom = map.getZoom();
  // Update URL or state with new position
});
```

**Why good:** Named constants, `essential: true` only on navigation (not decorative), `fitBounds` keeps data in view with padding, `moveend` listener for state sync

### Bad Example - Hardcoded Animation

```typescript
// Bad: magic numbers, no constants, no essential flag context
map.flyTo({ center: [-122.4194, 37.7749], zoom: 15, speed: 1.2 });
```

**Why bad:** Magic numbers for coordinates and zoom are unmaintainable, no documentation of whether `essential` should be true

---

## Pattern 5: Layer Event Handling with Feature State

### Good Example - Hover Highlight with Feature State

```typescript
let hoveredId: string | number | null = null;

map.on("mouseenter", "parks-fill", () => {
  map.getCanvas().style.cursor = "pointer";
});

map.on("mousemove", "parks-fill", (e) => {
  if (!e.features?.length) return;

  // Clear previous hover
  if (hoveredId !== null) {
    map.setFeatureState({ source: "parks", id: hoveredId }, { hover: false });
  }

  hoveredId = e.features[0].id ?? null;

  if (hoveredId !== null) {
    map.setFeatureState({ source: "parks", id: hoveredId }, { hover: true });
  }
});

map.on("mouseleave", "parks-fill", () => {
  map.getCanvas().style.cursor = "";

  if (hoveredId !== null) {
    map.setFeatureState({ source: "parks", id: hoveredId }, { hover: false });
    hoveredId = null;
  }
});

// Use feature-state in paint to react to hover
map.addLayer({
  id: "parks-fill",
  type: "fill",
  source: "parks",
  paint: {
    "fill-color": "#2ecc71",
    "fill-opacity": [
      "case",
      ["boolean", ["feature-state", "hover"], false],
      0.8,
      0.4,
    ],
  },
});
```

**Why good:** Feature-state updates are instant (no GeoJSON re-parsing), cursor changes signal interactivity, previous hover cleared before setting new one, null guard on feature id

### Good Example - Click to Show Popup

```typescript
map.on("click", "cities-layer", (e) => {
  const feature = e.features?.[0];
  if (!feature) return;

  const coordinates = e.lngLat;
  const name = feature.properties?.name ?? "Unknown";
  const population = feature.properties?.population ?? "N/A";

  new mapboxgl.Popup()
    .setLngLat(coordinates)
    .setHTML(
      `
      <strong>${name}</strong>
      <p>Population: ${population}</p>
    `,
    )
    .addTo(map);
});
```

**Why good:** Event scoped to layer, null checks on features and properties, popup positioned at click location

---

## Pattern 6: Custom Control

### Good Example - Implementing IControl

```typescript
class ResetViewControl implements mapboxgl.IControl {
  private container: HTMLDivElement | null = null;
  private map: mapboxgl.Map | null = null;

  onAdd(map: mapboxgl.Map): HTMLElement {
    this.map = map;
    this.container = document.createElement("div");
    this.container.className = "mapboxgl-ctrl mapboxgl-ctrl-group";

    const button = document.createElement("button");
    button.type = "button";
    button.title = "Reset view";
    button.textContent = "R";
    button.addEventListener("click", () => {
      this.map?.flyTo({
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        essential: true,
      });
    });

    this.container.appendChild(button);
    return this.container;
  }

  onRemove(): void {
    this.container?.remove();
    this.map = null;
  }
}

map.addControl(new ResetViewControl(), "top-right");
```

**Why good:** Implements `IControl` interface correctly, cleanup in `onRemove`, uses `mapboxgl-ctrl` class for consistent styling, button has accessible title attribute
