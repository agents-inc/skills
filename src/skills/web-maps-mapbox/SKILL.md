---
name: web-maps-mapbox
description: Mapbox GL JS interactive vector maps. Use when building a map with sources and layers, expressions, clustering, 3D terrain, geocoding or directions.
---

# Mapbox GL JS Patterns

> **Quick Guide:** Mapbox GL JS renders vector tiles on the GPU, and the whole mental model is
> **sources hold data, layers visualize them, expressions make the visualization data-driven**. One
> source can feed several layers, and a layer's appearance is decided by a JSON expression rather
> than by JavaScript touching features. Everything that adds data waits for the style — `load` or
> `style.load` — because the map has no style at construction. Clustering is a flag on a GeoJSON
> source, not a plugin. **Current: v3**, where the Standard style is the default and custom layers
> are placed into named slots rather than before a layer id.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — map setup and cleanup, markers, popups, controls, camera animation, feature-state hover, custom controls
- [examples/layers.md](examples/layers.md) — sources, every layer type, expressions, filters, clustering, safe removal
- [examples/interaction.md](examples/interaction.md) — 3D terrain, fog, fill-extrusion, heatmaps, geocoder and directions plugins, `queryRenderedFeatures`, image sources
- [reference.md](reference.md) — v3 migration, slots and configuration, layer and source tables, the full expression operator list, event table, performance tuning

---

## Which path applies

- **The Standard style** (v3's default, `mapbox://styles/mapbox/standard`) — place custom layers with
  `slot: "bottom" | "middle" | "top"`, and change the basemap's own appearance through
  `setConfigProperty` rather than by editing its layers.
- **A classic or custom style** — there are no slots; `addLayer(layer, beforeId)` positions a layer
  relative to an existing one, which means reading `map.getStyle().layers` to find the id.
- **Terrain, fog or anything that must survive a style switch** — register it on `style.load`, which
  fires again on every `setStyle`, rather than on `load`, which fires once. See
  [examples/interaction.md](examples/interaction.md).

---

<critical_requirements>

## Before writing Mapbox GL JS code

**Add a source before any layer that references it.** A layer naming a source that does not exist
throws, and layers cannot be reordered around that.

**Do source and layer work inside a `load` or `style.load` handler.** The map has no style when the
constructor returns, so `addSource` immediately after `new mapboxgl.Map()` fails with "Style is not
done loading".

**Call `map.remove()` when the map goes away.** It releases the WebGL context, and browsers cap how
many can exist at once — a leaked map makes the next one fail to initialize.

**Style with expressions rather than by looping over features.** An expression runs on the GPU for
every feature at once; a JavaScript loop that sets styles individually gives up the rendering model
the library exists for.

**Put untrusted content through `setText()` or `setDOMContent()`.** `Popup.setHTML()` renders what
it is given without sanitizing it.

</critical_requirements>

---

**Auto-detection:** Mapbox, mapbox-gl, mapboxgl, `mapboxgl.Map`, `mapboxgl.Marker`, `mapboxgl.Popup`, NavigationControl, GeolocateControl, ScaleControl, addSource, addLayer, setPaintProperty, setLayoutProperty, setFilter, setFeatureState, queryRenderedFeatures, querySourceFeatures, getClusterExpansionZoom, fill-extrusion, raster-dem, setTerrain, setFog, setConfigProperty, `mapbox://styles/mapbox/standard`, `@mapbox/mapbox-gl-geocoder`, `@mapbox/mapbox-gl-directions`, `@mapbox/mapbox-gl-draw`

**Applies to:**

- Interactive vector maps with custom styling
- Point, line and polygon data styled from its own properties
- Markers, popups and map controls, including custom ones through `IControl`
- Large datasets through clustering, heatmaps and GPU-rendered layers
- 3D — terrain, fog, extruded buildings
- Camera animation and layer-scoped event handling
- The Standard style's slot system and configuration API

**Handled elsewhere:**

- Where the GeoJSON comes from — a source takes an object or a URL, and fetching, caching and paging
  it are not the map's concern
- Sanitizing content before it reaches `setHTML` — the popup renders raw markup and cleans nothing
- Provisioning and restricting the access token — the map reads a token, and where it is stored and
  what it is scoped to is a deployment decision
- How markers, popups and controls look — the library supplies elements and class names, and the CSS
  in them is settled by whatever owns styling
- Rendering a map as a static image server-side — this is a WebGL client

---

<philosophy>

**Sources, layers, expressions**, and the separation between them is the point:

1. **Sources** hold data — GeoJSON, vector tiles, raster tiles, elevation, images
2. **Layers** decide how a source is drawn — fill, line, circle, symbol, fill-extrusion, heatmap,
   raster
3. **Expressions** make a layer data-driven — colour by property, size by zoom, filter by attribute

So one GeoJSON source can be a fill layer and a line layer at once, and restyling is a change to a
layer's paint properties with the data untouched.

**Styling is declarative and runs on the GPU.** An expression is a JSON array evaluated per feature
per frame by the renderer, which is why the same expression costs the same on ten features and on a
hundred thousand.

**The style is a document the map loads**, and the Standard style in v3 is a live one: slots are the
insertion points it publishes for your layers, and `setConfigProperty` is how you change what it
draws without knowing what is inside it.

</philosophy>

---

<decision_framework>

### Which layer type

```
Points
├─ Fewer than ~100, with custom HTML?   → Markers (DOM elements)
├─ Many, or styled from data?           → circle layer, or symbol for icons and labels
└─ Density rather than individuals?     → heatmap layer

Lines and routes                        → line layer
Polygons
├─ Flat areas?                          → fill layer
└─ Extruded?                            → fill-extrusion layer
Imagery                                 → raster layer
```

### Which source type

```
GeoJSON, local or from an API   → type: "geojson"; setData() to replace, cluster: true past ~500 points
A tileset or third-party tiles  → type: "vector"; every layer needs "source-layer"
Elevation                       → type: "raster-dem", consumed by setTerrain
A georeferenced image           → type: "image", with its four corner coordinates
```

### Markers or a circle layer

```
< 100, needing custom HTML or their own interaction   → Markers
100 – 10,000                                          → circle layer
10,000+                                               → circle layer, cluster: true on the source
```

### Which expression

```
Same for every feature?         → a literal paint value
Discrete categories?            → "match"
A continuous range?             → "interpolate"
Conditional logic?              → "case"
Changing with zoom?             → "interpolate" over ["zoom"]
Hover or selection state?       → "case" over ["feature-state", ...], updated by setFeatureState
```

</decision_framework>

---

<patterns>

## Core patterns

### Pattern 1: Map initialization

```typescript
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

mapboxgl.accessToken = process.env.MAPBOX_ACCESS_TOKEN!;

const map = new mapboxgl.Map({
  container: "map", // element id or the element itself
  style: "mapbox://styles/mapbox/standard",
  center: [-74.006, 40.7128], // [lng, lat]
  zoom: 12,
});

map.on("load", () => {
  // sources and layers from here
});
```

Full code, including teardown: [examples/core.md](examples/core.md)

---

### Pattern 2: Markers, popups and controls

A Marker is a DOM element pinned to a coordinate; a Popup is content anchored to one.

```typescript
const popup = new mapboxgl.Popup({ offset: 25 }).setText("Description");

new mapboxgl.Marker({ color: "#e74c3c" })
  .setLngLat([-74.006, 40.7128])
  .setPopup(popup)
  .addTo(map);

map.addControl(new mapboxgl.NavigationControl(), "top-right");
```

Binding the popup to the marker is what makes it open and close on click without a handler.

Full code: [examples/core.md](examples/core.md)

---

### Pattern 3: Sources and layers

Add the source once; add as many layers over it as the visualization needs.

```typescript
map.on("load", () => {
  map.addSource("parks", { type: "geojson", data: parksGeoJSON });

  map.addLayer({
    id: "parks-fill",
    type: "fill",
    source: "parks",
    slot: "middle", // Standard style placement
    paint: { "fill-color": "#2ecc71", "fill-opacity": 0.5 },
  });

  map.addLayer({
    id: "parks-outline",
    type: "line",
    source: "parks",
    slot: "middle",
    paint: { "line-color": "#27ae60", "line-width": 2 },
  });
});
```

Full code: [examples/layers.md](examples/layers.md)

---

### Pattern 4: Data-driven styling with expressions

An expression is a JSON array the renderer evaluates per feature.

```typescript
paint: {
  "circle-radius": ["interpolate", ["linear"], ["get", "population"],
    10_000, 5, 1_000_000, 30],
  "circle-color": ["match", ["get", "type"],
    "capital", "#e74c3c",
    "major", "#3498db",
    "#95a5a6"],  // the fallback is required, and covers missing properties
}
```

Full operator list in [reference.md](reference.md). Full code:
[examples/layers.md](examples/layers.md)

---

### Pattern 5: Clustering

Clustering is a property of the source, and the three layers over it split by whether a feature is a
cluster.

```typescript
map.addSource("earthquakes", {
  type: "geojson",
  data: "/data/earthquakes.geojson",
  cluster: true,
  clusterMaxZoom: 14,
  clusterRadius: 50,
});
```

The source then adds `point_count` and `cluster_id` to every cluster feature, which is what
`filter: ["has", "point_count"]` selects on.

Full code, all three layers and click-to-expand: [examples/layers.md](examples/layers.md)

---

### Pattern 6: Camera animation

```typescript
map.flyTo({ center: [-122.4194, 37.7749], zoom: 15, essential: true });
map.easeTo({ center, zoom, duration: 2000, bearing: 45, pitch: 60 });
map.fitBounds([sw, ne], { padding: 50 });
```

`flyTo` arcs, `easeTo` is a direct transition, and `fitBounds` derives the camera from data extent.
`essential: true` makes the animation ignore `prefers-reduced-motion`, so it belongs on navigation
the user asked for and nowhere else.

Full code: [examples/core.md](examples/core.md)

---

### Pattern 7: Layer-scoped events

Passing a layer id scopes the handler to features in that layer and puts them on the event.

```typescript
map.on("click", "parks-fill", (e) => {
  const feature = e.features?.[0];
  if (!feature) return;
  new mapboxgl.Popup()
    .setLngLat(e.lngLat)
    .setText(feature.properties?.name ?? "")
    .addTo(map);
});

map.on(
  "mouseenter",
  "parks-fill",
  () => (map.getCanvas().style.cursor = "pointer"),
);
map.on("mouseleave", "parks-fill", () => (map.getCanvas().style.cursor = ""));
```

Without the cursor change nothing tells the user the feature is clickable.

Full code, including feature-state hover: [examples/core.md](examples/core.md)

---

### Pattern 8: 3D terrain and fog

Elevation is a `raster-dem` source consumed by `setTerrain`; fog is what makes the horizon read as
distance rather than as a cut-off.

```typescript
map.on("style.load", () => {
  map.addSource("mapbox-dem", {
    type: "raster-dem",
    url: "mapbox://mapbox.mapbox-terrain-dem-v1",
    tileSize: 512,
    maxzoom: 14,
  });
  map.setTerrain({ source: "mapbox-dem", exaggeration: 1.5 });
  map.setFog({ range: [-1, 2], "horizon-blend": 0.3, color: "white" });
});
```

`style.load` rather than `load`, so terrain survives a `setStyle`.

Full code: [examples/interaction.md](examples/interaction.md)

---

### Pattern 9: Standard style configuration

Change what the basemap draws without replacing it or reaching into its layers.

```typescript
new mapboxgl.Map({
  style: "mapbox://styles/mapbox/standard",
  config: {
    basemap: { lightPreset: "dusk", showPointOfInterestLabels: false },
  },
});

map.setConfigProperty("basemap", "lightPreset", "night");
```

Full property list in [reference.md](reference.md).

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- `addSource`/`addLayer` called before the style loads — "Style is not done loading" — move them into
  a `load` or `style.load` handler
- A layer naming a source that has not been added — throws — add the source first
- `map.getSource(id)` used without a guard — it returns `undefined` for an unknown id — check it, and
  narrow on `source.type` before calling `setData`
- `removeSource` before `removeLayer` — a source cannot be removed while a layer references it —
  remove the layers first
- No `map.remove()` on unmount — leaks the WebGL context, and browsers cap how many can exist, so a
  later map silently fails to initialize
- `Popup.setHTML()` with user input — the content is rendered unsanitized — use `setText()`, or
  `setDOMContent()` with elements you built
- A `fill-extrusion` layer with no `fill-extrusion-height` — the extrusions render flat, so the layer
  looks like it is not working

**Surprising behaviour:**

- Coordinates are `[longitude, latitude]`, the reverse of the `[lat, lng]` order most mapping code
  uses — a swapped pair lands in the wrong hemisphere rather than erroring
- `queryRenderedFeatures` only sees what is currently drawn in the viewport; `querySourceFeatures`
  reaches the rest
- `setData()` replaces the entire dataset and re-parses it — for visual state per feature use
  `setFeatureState` instead
- `style.load` fires on every `setStyle`; `load` fires once — anything that has to survive a style
  switch belongs on the first
- An expression reading a missing property yields `null`, so `match`, `case` and `coalesce` need
  their fallback branch
- `essential: true` overrides `prefers-reduced-motion` — correct for navigation, wrong for
  decoration
- A clustered source writes `point_count` and `cluster_id` onto cluster features; do not add
  properties by those names
- `getClusterExpansionZoom` answers through a callback, so handle its error and check the map still
  exists before animating
- `slot` is ignored outside the Standard style — a classic style positions layers with `beforeId`
- Markers past a hundred or so points are DOM elements and cost like DOM elements; a circle layer
  renders on the GPU
- `map.on("click", handler)` with no layer id fires on every click anywhere on the map, including
  clicks the user meant for a feature
- `@types/mapbox-gl` is a deprecated stub — types ship inside `mapbox-gl` from v3

</red_flags>
