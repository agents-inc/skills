# Mapbox GL JS Reference

> v3 migration, slots and configuration, layer and source tables, the full expression operator list,
> the event table and performance tuning. See [SKILL.md](SKILL.md) for the decisions and the red
> flags, [examples/](examples/) for code.

---

## v3 Migration Notes

### Breaking Changes from v2

- **WebGL 2 required** -- WebGL 1 support removed
- **Standard style default** -- `mapbox://styles/mapbox/standard` is the new default style
- **Slot system** -- Custom layers placed via `slot: "bottom" | "middle" | "top"` instead of `beforeId`
- **Configuration API** -- `setConfigProperty(importId, key, value)` customizes Standard style
- **TypeScript built-in** -- Types included in `mapbox-gl` package, `@types/mapbox-gl` is a deprecated stub
- **`optimizeForTerrain` removed** -- Terrain rendering is always optimized

### Standard Style Slots

| Slot      | Position                        | Use For                        |
| --------- | ------------------------------- | ------------------------------ |
| `bottom`  | Above land/water, below roads   | Fill layers, polygons          |
| `middle`  | Above roads, below 3D buildings | Data overlays, custom features |
| `top`     | Behind place/transit labels     | Symbol layers, labels          |
| (omitted) | Above all existing layers       | Overlay layers                 |

### Standard Style Configuration Properties

```typescript
// Configuration via constructor
new mapboxgl.Map({
  config: {
    basemap: {
      lightPreset: "dawn" | "day" | "dusk" | "night",
      showPointOfInterestLabels: boolean,
      showPlaceLabels: boolean,
      showRoadLabels: boolean,
      showTransitLabels: boolean,
    },
  },
});

// Runtime configuration
map.setConfigProperty("basemap", "lightPreset", "night");
map.getConfigProperty("basemap", "lightPreset"); // "night"
```

---

## Layer Types Reference

| Type             | Geometry     | Key Paint Properties                                                            |
| ---------------- | ------------ | ------------------------------------------------------------------------------- |
| `fill`           | Polygon      | `fill-color`, `fill-opacity`, `fill-outline-color`, `fill-pattern`              |
| `line`           | LineString   | `line-color`, `line-width`, `line-opacity`, `line-dasharray`, `line-gap-width`  |
| `circle`         | Point        | `circle-radius`, `circle-color`, `circle-opacity`, `circle-stroke-*`            |
| `symbol`         | Point/Line   | `icon-image`, `icon-size`, `text-color`, `text-size`, `text-halo-*`             |
| `fill-extrusion` | Polygon      | `fill-extrusion-height`, `fill-extrusion-base`, `fill-extrusion-color`          |
| `heatmap`        | Point        | `heatmap-weight`, `heatmap-intensity`, `heatmap-color`, `heatmap-radius`        |
| `raster`         | Raster tiles | `raster-opacity`, `raster-brightness-*`, `raster-contrast`, `raster-saturation` |
| `hillshade`      | Raster-DEM   | `hillshade-illumination-direction`, `hillshade-exaggeration`                    |

---

## Source Types Reference

| Type         | Data Format         | Key Options                                      |
| ------------ | ------------------- | ------------------------------------------------ |
| `geojson`    | GeoJSON object/URL  | `data`, `cluster`, `clusterRadius`, `generateId` |
| `vector`     | Mapbox tileset URL  | `url`, `tiles`, `minzoom`, `maxzoom`             |
| `raster`     | Raster tile URL     | `url`, `tiles`, `tileSize`                       |
| `raster-dem` | Elevation tiles     | `url`, `tileSize`, `maxzoom`                     |
| `image`      | Georeferenced image | `url`, `coordinates` (4 corners)                 |
| `video`      | Georeferenced video | `urls`, `coordinates` (4 corners)                |

---

## Expression Operators Reference

### Data Access

| Operator        | Purpose                   | Example                      |
| --------------- | ------------------------- | ---------------------------- |
| `get`           | Read feature property     | `["get", "name"]`            |
| `has`           | Check property exists     | `["has", "population"]`      |
| `id`            | Feature ID                | `["id"]`                     |
| `geometry-type` | Geometry type string      | `["geometry-type"]`          |
| `properties`    | All properties as object  | `["properties"]`             |
| `feature-state` | Read feature-state value  | `["feature-state", "hover"]` |
| `accumulated`   | Accumulated cluster value | `["accumulated"]`            |

### Decision / Logic

| Operator   | Purpose              | Example                                              |
| ---------- | -------------------- | ---------------------------------------------------- |
| `case`     | if/else chain        | `["case", cond1, val1, cond2, val2, fallback]`       |
| `match`    | Switch on value      | `["match", input, val1, out1, val2, out2, fallback]` |
| `coalesce` | First non-null value | `["coalesce", ["get", "name_en"], ["get", "name"]]`  |
| `all`      | AND                  | `["all", cond1, cond2]`                              |
| `any`      | OR                   | `["any", cond1, cond2]`                              |
| `!`        | NOT                  | `["!", cond]`                                        |
| `==`       | Equals               | `["==", ["get", "type"], "park"]`                    |
| `!=`       | Not equals           | `["!=", ["get", "status"], "closed"]`                |
| `>`/`<`    | Comparison           | `[">", ["get", "pop"], 100000]`                      |
| `in`       | Set membership       | `["in", ["get", "type"], ["literal", ["a", "b"]]]`   |

### Interpolation

| Operator      | Purpose         | Example                                                         |
| ------------- | --------------- | --------------------------------------------------------------- |
| `interpolate` | Smooth scaling  | `["interpolate", ["linear"], ["zoom"], 8, 3, 14, 12]`           |
| `step`        | Discrete breaks | `["step", ["get", "count"], "blue", 100, "yellow", 750, "red"]` |

Interpolation types: `["linear"]`, `["exponential", base]`, `["cubic-bezier", x1, y1, x2, y2]`

### Type / Conversion

| Operator     | Purpose            | Example                                  |
| ------------ | ------------------ | ---------------------------------------- |
| `to-boolean` | Convert to boolean | `["to-boolean", ["get", "active"]]`      |
| `to-number`  | Convert to number  | `["to-number", ["get", "population"]]`   |
| `to-string`  | Convert to string  | `["to-string", ["get", "id"]]`           |
| `to-color`   | Convert to color   | `["to-color", ["get", "color"]]`         |
| `typeof`     | Type of value      | `["typeof", ["get", "value"]]`           |
| `boolean`    | Assert boolean     | `["boolean", ["get", "flag"], false]`    |
| `number`     | Assert number      | `["number", ["get", "pop"], 0]`          |
| `string`     | Assert string      | `["string", ["get", "name"], "unknown"]` |

### Math

`+`, `-`, `*`, `/`, `%`, `^`, `abs`, `ceil`, `floor`, `round`, `min`, `max`, `sqrt`, `log2`, `ln`, `sin`, `cos`, `tan`, `asin`, `acos`, `atan`, `pi`, `e`

### String

`concat`, `downcase`, `upcase`, `length`, `index-of`, `slice`, `format`, `number-format`, `resolved-locale`

---

## Map Events Reference

| Event        | Fires When                              | Has `.features`? |
| ------------ | --------------------------------------- | ---------------- |
| `load`       | Map fully loaded (once)                 | No               |
| `style.load` | Style loaded (fires on each `setStyle`) | No               |
| `click`      | Map clicked (or layer-specific)         | Yes (with layer) |
| `dblclick`   | Map double-clicked                      | Yes (with layer) |
| `mouseenter` | Cursor enters a layer feature           | Yes              |
| `mouseleave` | Cursor leaves a layer feature           | No               |
| `mousemove`  | Cursor moves over map/layer             | Yes (with layer) |
| `moveend`    | Camera movement ends                    | No               |
| `zoomend`    | Zoom change ends                        | No               |
| `pitchend`   | Pitch change ends                       | No               |
| `rotateend`  | Bearing change ends                     | No               |
| `idle`       | Map enters idle state (all rendered)    | No               |
| `render`     | Every render frame                      | No               |
| `error`      | Error occurred                          | No               |
| `data`       | Any data event                          | No               |
| `sourcedata` | Source data loaded/changed              | No               |

---

## Performance Optimization

### GeoJSON Source Optimization

| Strategy                    | When to Use                                 |
| --------------------------- | ------------------------------------------- |
| Enable clustering           | Point datasets > 500 features               |
| Lower `maxzoom` on source   | Point data, default 18 is overkill (try 12) |
| Use `generateId: true`      | When using feature-state for hover/select   |
| Use `setFeatureState`       | Updating visual state without re-parsing    |
| Use vector tilesets         | Datasets > 50MB or > 100K features          |
| Reduce coordinate precision | Max 6 decimal places (~0.1m accuracy)       |
| Prune unused properties     | Remove data properties not used in styling  |

### Rendering Performance

| Strategy                               | Impact                              |
| -------------------------------------- | ----------------------------------- |
| Fewer layers                           | Each layer = 1 draw call            |
| `minzoom`/`maxzoom` on layers          | Skip rendering at irrelevant zooms  |
| `visibility: "none"` for hidden layers | Cheaper than removing and re-adding |
| Avoid animating on `render` event      | 60fps callback is expensive         |
| `queryRenderedFeatures` with `layers`  | Filter reduces work significantly   |
