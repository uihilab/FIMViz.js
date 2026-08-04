# Legend — usage reference

`Legend` (barrel-exported) is the **display read-model** derived from a
`ColorScale` — data first (`{unit, kind, source, stops}`), with an HTML renderer. See
[COLOR_SCALE.md](./COLOR_SCALE.md) for the scale it's built from.

## Contents

[Construction](#construction) · [Reading](#reading) · [Rendering to HTML](#rendering-to-html) ·
[Label resolution](#label-resolution) · [On a RasterLayer](#on-a-rasterlayer)

## Construction

```js
new Legend({ unit='', kind='classed', source='palette', stops=[] })
// kind: 'classed' | 'continuous' · source: 'gdal' | 'palette' | 'default' | 'custom'
// stops: [{ value?, min?, max?, color, label? }]

Legend.fromColorScale(cs, { source? })   // the normal way to get one — derives unit/kind/stops
                                           // from a ColorScale; source override rarely needed
                                           // (defaults to cs.source)
```

```js
const legend = Legend.fromColorScale(layer.colorScale);
```

## Reading

```js
legend.unit     // string
legend.kind     // 'classed' | 'continuous'
legend.source   // 'gdal' | 'palette' | 'default' | 'custom'
legend.stops     // [{ value?|min?/max?, color, label? }] — a live reference to the array
legend.formatLabel   // null | (stop) => string — host hook for the WHOLE row label, wins over everything
legend.formatValue    // (value: number|string) => string — default: toFixed(2) for numbers, else String(v)
```

## Rendering to HTML

```js
legend.toHtml()   // → an HTML string; '' if legend.stops is empty
```

- **`kind: 'continuous'`** → a vertical gradient bar (`linear-gradient`) with min/max labels.
- **`kind: 'classed'`** → one colored row per stop, each row's label via `_label()` (below).

`ui/readModels.js`'s `renderLegend(legend, {html?})` is a thin wrapper for the common "give me data or
HTML" call — see [UI.md](./UI.md).

## Label resolution

Per-stop label priority (`legend._label(stop)`, called internally by `toHtml()`):

1. `formatLabel(stop)` if set — wins unconditionally.
2. **`source: 'gdal'` or `'custom'`** legends show their **own stored** `stop.label` as-is (an embedded
   legend already has real labels — don't reformat them).
3. **`source: 'palette'` or `'default'`** legends **auto-build** a `"lo–hi unit"` (or `"value unit"`
   for discrete) label from the numeric fields, since a plain palette ramp has no author-supplied
   labels to preserve.

```js
legend.formatLabel = (stop) => `${stop.label} (n=${stop.count ?? 0})`;   // e.g. annotate with a count
```

## On a `RasterLayer`

```js
layer.getLegend()   // → Legend.fromColorScale(layer.colorScale), or null until a ColorScale is attached
```

Since `RasterLayer._draw()`'s precedence chain always attaches *some* `ColorScale` before drawing
(explicit → GDAL-embedded → default — see [COLOR_SCALE.md](./COLOR_SCALE.md)), `getLegend()` is
non-null for any layer that has actually rendered at least once.
