---
name: web-maps-leaflet
description: Leaflet interactive maps. Use when building a 2D map with tile layers, markers, popups, GeoJSON, layer control, custom controls or marker clustering.
---

# Leaflet Interactive Map Patterns

> **Quick Guide:** Leaflet is a small 2D mapping library: `L.map` initializes against a DOM element,
> `L.tileLayer` supplies the base map, and everything drawn on top — markers, popups, GeoJSON,
> controls — is a layer added to and removed from the map independently. `L.geoJSON` does most of
> the data work through its `pointToLayer`, `onEachFeature`, `style` and `filter` callbacks. Marker
> count is the decision that shapes the rest: past a hundred, DOM markers stop scaling and the work
> moves to clustering or the canvas renderer. **Current: v1.9.4**, with types in `@types/leaflet`.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — map setup, tile providers, markers and icons, GeoJSON, layer groups and control, events
- [examples/advanced.md](examples/advanced.md) — custom controls, clustering, TypeScript, canvas rendering, bounds and viewport
- [reference.md](reference.md) — `L.map` methods, `L.geoJSON` and cluster options, event table, install checklist

---

<critical_requirements>

## Before writing Leaflet code

**Call `map.remove()` when the map goes away.** It is the one call that tears down the resize
observers, animation frames and DOM listeners Leaflet attached; without it a re-mount on the same
element throws "Map container is already initialized".

**Give every tile layer an `attribution`.** OpenStreetMap and most other providers require it in
their terms, and there is no default.

**Move past DOM markers at around a hundred points** — `L.markerClusterGroup`, or `L.circleMarker`
on the canvas renderer. Each `L.marker` is an element in the document, and the page slows in
proportion.

</critical_requirements>

---

**Auto-detection:** Leaflet, `L.map`, `L.tileLayer`, `L.marker`, `L.popup`, `L.geoJSON`, `L.control.layers`, `L.layerGroup`, `L.featureGroup`, `L.icon`, `L.divIcon`, `L.circleMarker`, `L.polyline`, `L.polygon`, `L.Control.extend`, `L.DomUtil`, `L.DomEvent`, markerClusterGroup, leaflet.markercluster, `@types/leaflet`, leaflet.css, addTo(map), bindPopup, bindTooltip, onEachFeature, pointToLayer, invalidateSize, flyTo, fitBounds, latLngBounds

**Applies to:**

- Interactive 2D maps with markers, popups, tooltips and overlays
- GeoJSON points, lines and polygons, styled and filtered from their own properties
- Base-layer switching and overlay toggling through a layer control
- Custom controls built on `L.Control.extend`
- Large marker datasets, through clustering or the canvas renderer
- Map, marker and layer events, and camera movement

**Handled elsewhere:**

- Where the tiles come from — Leaflet renders any XYZ raster endpoint, and choosing a provider and
  meeting its terms is a separate decision
- Where the GeoJSON comes from — the layer takes an object, and fetching, caching and paging it are
  not the map's concern
- How markers, popups and controls look — the map hands you class names and containers, and the CSS
  inside them is settled by whatever owns styling
- 3D terrain, globe projection and GPU-rendered vector tiles — this is a 2D raster library with an
  SVG or canvas vector layer over it

---

<philosophy>

**Everything on the map is a layer.** Tiles, markers, GeoJSON, even controls — each is added and
removed independently, which is why toggling a dataset is `map.removeLayer(group)` rather than a
rebuild.

**The core is deliberately small** (~42KB gzipped) and covers the common map. Clustering, heatmaps,
drawing and vector tiles are plugins, and a plugin is how the library expects those needs to be met.

**Methods return `this`**, so setup reads as a chain: `L.marker(pos).addTo(map).bindPopup(html)`.

**Interaction is events.** Maps, markers and layers all emit; `.on()` subscribes and `.off()`
unsubscribes, and `map.off()` with no arguments is part of teardown.

</philosophy>

---

<decision_framework>

### Marker strategy, by count

```
< 100     → L.marker with L.icon or L.divIcon
100 – 10K → L.markerClusterGroup
10K – 50K → L.markerClusterGroup with chunkedLoading, and L.circleMarker rather than L.marker
50K+      → canvas rendering, or pre-tiled vector data
```

### Which layer type

```
One coordinate               → L.marker (with an icon) or L.circleMarker (for data viz)
A path                       → L.polyline
An area                      → L.polygon, or L.circle for a radius in metres
A GeoJSON dataset            → L.geoJSON, which handles every geometry type
A group you need to toggle   → L.layerGroup, or L.featureGroup where you need getBounds()/bindPopup()
```

### Which icon

```
The default pin          → L.marker() with no icon option
A custom image           → L.icon({ iconUrl, iconSize, iconAnchor })
Several image variants   → L.Icon.extend({ options }), then construct per variant
HTML or CSS content      → L.divIcon({ html, className, iconSize })
A data point, many of    → L.circleMarker — a vector shape, not a DOM element
```

</decision_framework>

---

<patterns>

## Core patterns

### Pattern 1: Map initialization and tile layers

Target a DOM element, set the view, add a base layer with its attribution.

```typescript
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const map = L.map("map").setView([51.505, -0.09], 13);

L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);
```

The CSS import is not optional — without it controls, popups and markers render unpositioned.

Full code: [examples/core.md](examples/core.md)

---

### Pattern 2: Markers, popups and tooltips

```typescript
const marker = L.marker([51.5, -0.09]).addTo(map);
marker.bindPopup("<b>Hello</b><br>I am a popup.");
marker.bindTooltip("Hover text", { direction: "top" });

L.popup().setLatLng([51.513, -0.09]).setContent("Standalone").openOn(map);
```

`openOn(map)` closes whatever popup was open; `addTo(map)` leaves it, which is the difference
between one-at-a-time and several.

Full code: [examples/core.md](examples/core.md)

---

### Pattern 3: GeoJSON layers

Four callbacks cover most of what a dataset needs, and none of them requires touching the data.

```typescript
const geoLayer = L.geoJSON(geojsonData, {
  pointToLayer: (feature, latlng) => L.circleMarker(latlng, { radius: 8 }),
  onEachFeature: (feature, layer) => layer.bindPopup(feature.properties?.name),
  style: (feature) => ({ color: feature?.properties?.color ?? "#3388ff" }),
  filter: (feature) => feature?.properties?.visible !== false,
}).addTo(map);
```

`filter` excludes a feature before it is rendered, which is cheaper than rendering and hiding it.

Full code: [examples/core.md](examples/core.md)

---

### Pattern 4: Layer groups and layer control

```typescript
const overlays = { Cities: L.layerGroup([markerA, markerB]), Parks: parkGroup };
L.control.layers({ Street: osm, Satellite: satellite }, overlays).addTo(map);
```

Base layers are radio buttons and overlays are checkboxes. `L.featureGroup` where the group needs
`getBounds()`, `bindPopup()` or `setStyle()`; `L.layerGroup` where it is only a container.

Full code: [examples/core.md](examples/core.md)

---

### Pattern 5: Events and interaction

```typescript
map.on("click", (e: L.LeafletMouseEvent) => {
  const { lat, lng } = e.latlng;
});

map.on("moveend", () => map.getBounds()); // load data for the new viewport

const handler = () => {};
map.on("zoomend", handler);
map.off("zoomend", handler); // .off() needs the same reference
```

Full code: [examples/core.md](examples/core.md)

---

### Pattern 6: Custom controls

`L.Control.extend` returns a constructor; `onAdd` builds and returns the container element.

```typescript
const InfoControl = L.Control.extend({
  options: { position: "bottomleft" as L.ControlPosition },
  onAdd(): HTMLElement {
    const container = L.DomUtil.create("div", "info-control");
    L.DomEvent.disableClickPropagation(container);
    return container;
  },
});

new InfoControl().addTo(map);
```

`disableClickPropagation` is what stops a click on the control also being a click on the map, and
`disableScrollPropagation` does the same for a scrollable control.

Full code: [examples/advanced.md](examples/advanced.md)

---

### Pattern 7: Marker clustering

`leaflet.markercluster` replaces one DOM element per point with one per visible cluster.

```typescript
const clusterGroup = L.markerClusterGroup({
  maxClusterRadius: 50,
  disableClusteringAtZoom: 18,
  chunkedLoading: true,
});

clusterGroup.addLayers(markers); // bulk add, not one addLayer per marker
map.addLayer(clusterGroup);
```

`chunkedLoading` keeps a bulk add off the main thread long enough for the UI to stay responsive, and
`disableClusteringAtZoom` hands back individual markers once the user is close enough to want them.

Full code: [examples/advanced.md](examples/advanced.md)

---

### Pattern 8: TypeScript

Types ship separately, in `@types/leaflet` and `@types/leaflet.markercluster`.

```typescript
import L, { type LatLngExpression, type MapOptions } from "leaflet";

const options: MapOptions = { center: [51.505, -0.09], zoom: 13 };
const map = L.map("map", options);
```

Full code: [examples/advanced.md](examples/advanced.md)

---

### Pattern 9: Teardown

```typescript
function destroyMap(map: L.Map): void {
  map.off(); // every listener
  map.remove(); // the map, its layers, and the DOM Leaflet created
}
```

Skipping this leaves listeners and animation frames alive, and a second `L.map()` call against the
same element throws.

</patterns>

---

<performance>

## Performance

**GeoJSON:** use `filter` rather than rendering and hiding; simplify geometry server-side for
overview zooms; add large datasets in chunks with `addData()`; and where a dataset changes entirely,
`clearLayers()` and re-add rather than restyling feature by feature.

**Vector layers:** `preferCanvas: true` on the map, or a per-layer `L.canvas()` renderer, moves
circles and polylines off SVG — worth it past about a thousand shapes. Canvas-rendered layers take
no CSS styling and no SVG filters, so hover effects have to come from Leaflet events.

**Markers:** `L.circleMarker` is a vector shape rather than a DOM element, so it costs far less than
`L.marker` for a data point that does not need an icon.

**Popups:** set large popup content lazily on the `popupopen` event rather than building it for
every marker up front.

**Containers:** call `map.invalidateSize()` after the container changes size — a CSS transition, an
accordion, a tab switch — or the map keeps rendering to its old dimensions.

</performance>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- No `map.remove()` on teardown — listeners and animation frames survive, and re-initializing on the
  same element throws "Map container is already initialized"
- `map.fitBounds` on an empty `FeatureGroup` — throws — check `bounds.isValid()` first
- `leaflet/dist/leaflet.css` not imported — controls, popups and markers render unpositioned, which
  looks like a layout bug rather than a missing import
- Default marker icons under a bundler — the CSS-relative image paths no longer resolve and markers
  render broken — set them explicitly through `L.Icon.Default.mergeOptions`
- A tile layer with no `attribution` — breaches the terms of OpenStreetMap and most other providers
- `L.marker` for a few hundred points — one DOM element each, and the page degrades steadily —
  cluster, or use `L.circleMarker`

**Surprising behaviour:**

- A container that changed size renders grey tiles and mis-targeted clicks until `invalidateSize()`
  is called
- `openOn(map)` closes the previously open popup; only `addTo(map)` leaves several open
- Clicks on a custom control also reach the map unless the container went through
  `L.DomEvent.disableClickPropagation`
- GeoJSON coordinates are `[longitude, latitude]` while `L.latLng` takes `[latitude, longitude]` —
  the commonest coordinate bug, and `L.geoJSON` flips them for you so only hand-built coordinates
  are at risk
- `flyTo` and `panTo` cancel each other when called in quick succession
- `L.Control.extend({...})` returns a constructor rather than an instance — Leaflet's own class
  system, not ES classes, so it is `new` at the call site
- A tile layer's `maxZoom` limits tile availability and the map's `maxZoom` limits the user; set the
  map higher than the tiles and the extra zoom levels are grey
- `refreshClusters()` has to be called after changing a marker's icon or data — clusters do not
  notice on their own

</red_flags>
