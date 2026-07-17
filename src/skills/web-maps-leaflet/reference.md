# Leaflet Quick Reference

## Decision Frameworks

### Marker Strategy by Count

| Count     | Strategy                                  | Notes                  |
| --------- | ----------------------------------------- | ---------------------- |
| < 100     | `L.marker` / `L.divIcon`                  | Standard DOM markers   |
| 100 - 10K | `L.markerClusterGroup`                    | Clustering plugin      |
| 10K - 50K | `L.markerClusterGroup` + `chunkedLoading` | Batch with `addLayers` |
| 50K+      | Canvas plugin or vector tiles             | Beyond DOM/SVG limits  |

### Layer Type Selection

| Data                 | Layer            | Notes                            |
| -------------------- | ---------------- | -------------------------------- |
| Single point         | `L.marker`       | With icon/divIcon                |
| Data viz point       | `L.circleMarker` | Renders on vector layer          |
| Circle area          | `L.circle`       | Radius in meters                 |
| Line                 | `L.polyline`     | Array of LatLng                  |
| Area                 | `L.polygon`      | Closed array of LatLng           |
| Mixed GeoJSON        | `L.geoJSON`      | Handles all types                |
| Group (toggle)       | `L.layerGroup`   | Simple container                 |
| Group (bounds/popup) | `L.featureGroup` | Has `getBounds()`, `bindPopup()` |

### Icon Type Selection

| Use Case                | Icon Type                        |
| ----------------------- | -------------------------------- |
| Default pin             | `L.marker()` (no icon option)    |
| Custom image            | `L.icon({ iconUrl })`            |
| Reusable image variants | `L.Icon.extend({ options })`     |
| HTML/CSS content        | `L.divIcon({ html, className })` |
| Data point (many)       | `L.circleMarker`                 |

---

## API Quick Reference

### L.map Methods

| Method                      | Purpose                            |
| --------------------------- | ---------------------------------- |
| `setView(center, zoom)`     | Set center and zoom (instant)      |
| `flyTo(latlng, zoom, opts)` | Animated pan + zoom                |
| `panTo(latlng)`             | Animated pan                       |
| `fitBounds(bounds, opts)`   | Zoom to show bounds                |
| `invalidateSize()`          | Recalculate after container resize |
| `getCenter()`               | Get current center                 |
| `getZoom()`                 | Get current zoom                   |
| `getBounds()`               | Get visible bounds                 |
| `addLayer(layer)`           | Add layer                          |
| `removeLayer(layer)`        | Remove layer                       |
| `hasLayer(layer)`           | Check if layer is on map           |
| `remove()`                  | Destroy map instance               |

### L.geoJSON Options

| Option          | Type                            | Purpose                         |
| --------------- | ------------------------------- | ------------------------------- |
| `onEachFeature` | `(feature, layer) => void`      | Bind popups, events per feature |
| `pointToLayer`  | `(feature, latlng) => Layer`    | Customize point rendering       |
| `style`         | `object \| (feature) => object` | Style lines/polygons            |
| `filter`        | `(feature) => boolean`          | Exclude features before render  |

### L.markerClusterGroup Options

| Option                    | Default | Purpose                         |
| ------------------------- | ------- | ------------------------------- |
| `maxClusterRadius`        | 80      | Max clustering radius in px     |
| `disableClusteringAtZoom` | null    | Show individuals at this zoom   |
| `chunkedLoading`          | false   | Batch additions for performance |
| `showCoverageOnHover`     | true    | Show cluster bounds on hover    |
| `zoomToBoundsOnClick`     | true    | Zoom into cluster on click      |
| `spiderfyOnMaxZoom`       | true    | Spread overlapping markers      |
| `iconCreateFunction`      | default | Custom cluster icon factory     |
| `animate`                 | true    | Smooth cluster transitions      |

### Event Types

| Target | Event       | Event Object        |
| ------ | ----------- | ------------------- |
| Map    | `click`     | `LeafletMouseEvent` |
| Map    | `moveend`   | `LeafletEvent`      |
| Map    | `zoomend`   | `LeafletEvent`      |
| Map    | `resize`    | `ResizeEvent`       |
| Marker | `click`     | `LeafletMouseEvent` |
| Marker | `dragend`   | `DragEndEvent`      |
| Popup  | `popupopen` | `PopupEvent`        |
| Layer  | `add`       | `LeafletEvent`      |
| Layer  | `remove`    | `LeafletEvent`      |

---

## Install Checklist

```bash
# Core
npm install leaflet
npm install -D @types/leaflet

# Marker clustering (optional)
npm install leaflet.markercluster
npm install -D @types/leaflet.markercluster
```

**Required imports:**

```typescript
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// If using markercluster
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
```
