# ColorScale — usage reference

`ColorScale` (barrel-exported) is the mutable value→color engine behind every `RasterLayer`. This is
a task-oriented guide; the exhaustive per-parameter signatures live in the generated reference —
[docs/api/package/colorScale/](../api/package/colorScale/).

A `RasterLayer` owns at most one `ColorScale`, attached via `layer.set({ colorScale: cs })` (see
"Attaching to a layer" below). Reading `layer.colorScale` gives you the live instance.

> **One knob writer.** Both `ColorScale` and `Layer` write through a single `set(patch)`, which is
> **synchronous and chainable** — it returns the object. A batch fires `onChange` **once** for the
> whole patch, not once per key, and an unrecognised key throws rather than being ignored.
> `continuous` is a **boolean getter** (`cs.continuous → true`); write it with `set({ continuous })`.
> The index-addressed edits (`setColor(i, c)`, `setRange(i, r)`, `setLabel(i, s)`) address one band
> rather than the whole scale, so they keep their own verbs.

## Contents

[The three coloring modes](#the-three-coloring-modes) · [1. Palette mode](#1-palette-mode) ·
[2. Classed / discrete stops](#2-classed--discrete-stops-setstops-and-per-band-edits) ·
[3. Continuous color stops](#3-continuous-color-stops-setcolorstops) ·
[Values that aren't values](#values-that-arent-values-missingcolor) ·
[The override callback](#the-override-callback-colorfor) ·
[Reacting to changes](#reacting-to-changes-onchangeoffchange) ·
[Attaching to a layer](#attaching-to-a-layer) ·
[Precedence when a RasterLayer renders](#precedence-when-a-rasterlayer-renders)

## The three coloring modes

`ColorScale` has three **mutually exclusive** internal representations — setting one clears the
others:

1. **Palette mode** (the default) — a named or custom color ramp, scaled across a numeric
   `[min, max]` domain, either smoothly (`continuous: true`) or sliced into discrete bands.
2. **Classed / discrete stops** (`setStops`) — explicit, flat colors per exact value or range. No
   interpolation between them; used for GDAL-embedded legends and similar categorical data.
3. **Continuous color stops** (`setColorStops`) — explicit breakpoint *values* (not necessarily
   evenly spaced), each with its own color, interpolated smoothly between the nearest bracketing
   pair. The middle ground between the other two: continuous like palette mode, but with
   caller-chosen control-point positions instead of an even split of `[min, max]`.

`layer.colorScale.kind` reports `'continuous'` or `'classed'`; `layer.colorScale.isExplicit` is true
once you've moved off plain palette mode.

## 1. Palette mode

Assuming a rendered `RasterLayer` `l1` with a palette-mode `ColorScale` already attached (e.g. the
auto-attached default, or `l1.set({ colorScale: new ColorScale({ palette: 'blues', min: 0, max: 10,
continuous: true }) })`):

```js
// palette — swap which colors the ramp uses; keeps the same domain/mode
l1.set({ palette: 'viridis' });                          // any ColorScale.palettes() name, built-in or registered
l1.set({ palette: ['#000033', '#3366ff', '#ffffff'] });  // or a custom hex color array (>= 2 colors)

// continuous — same palette/domain, toggle smooth interpolation vs. discrete bands
l1.set({ continuous: true });    // smooth gradient across the domain
l1.set({ continuous: false });   // sliced into N discrete bands (N = the palette's color count)

// min / max — same palette/mode, remap which data values the colors span
l1.set({ min: 0, max: 5 });
// A common real use: derive it from the layer's actual pixel stats rather than guessing —
const stats = await l1.getStats();
l1.set({ min: stats.min, max: stats.max });
```

Set them together — **one call, one repaint**, and `onChange` fires once rather than three times:

```js
l1.set({ palette: 'plasma', continuous: true, min: 0, max: 100 });
```

`set()` returns the object, so calls also chain
(`l1.set({ palette: 'plasma' }).set({ min: 0, max: 100 })`) — but prefer the single batch above.

## 2. Classed / discrete stops (`setStops`, and per-band edits)

```js
// setStops(stops) — REPLACE the whole stops array at once. Each entry is either
// { value, color, label } (exact match) or { range: [lo, hi], color, label } (flat band; the LAST
// entry's upper bound is treated as unbounded — matches a legend's ">7.5 ft" convention).
l1.colorScale.setStops([
  { range: [0, 2],        color: '#08306b', label: 'low'  },
  { range: [2, 5],        color: '#4292c6', label: 'mid'  },
  { range: [5, Infinity], color: '#deebf7', label: 'high' },
]);

// setRange(i, {min, max}) / setColor(i, color) / setLabel(i, label) — edit ONE band by index.
// These auto-"materialize" first: if the scale is currently in palette mode (no explicit stops
// yet), the FIRST call converts the palette's implied bands into a real stops array before editing
// band i — so you can start from a continuous palette and incrementally carve out a custom classed
// scale one band at a time, rather than needing setStops with the whole array up front.
l1.colorScale.setRange(0, { min: 0, max: 3 });
l1.colorScale.setColor(0, '#ff0000');
l1.colorScale.setLabel(0, 'Shallow');
```

`ColorScale.fromGdalLegend(legend, unit)` is sugar for `new ColorScale({ stops: legend, unit, source:
'gdal' })` — what `RasterLayer` uses when it auto-detects a GDAL-embedded legend (see "Auto-detected
legends" below).

Editing one band of a **continuous** scale keeps it continuous: value-keyed stops under
`continuous: true` interpolate between the bracketing pair (the same mechanism `setColorStops` uses
below) rather than matching exactly. For flat, exact-match bands, set `{ continuous: false }` first.

## 3. Continuous color stops (`setColorStops`)

```js
// setColorStops(values, colors) — arbitrary (not necessarily evenly spaced) breakpoint VALUES, each
// with its own color, interpolated continuously between the nearest bracketing pair.
l1.colorScale.setColorStops([-1, 0, 1], ['#015498', '#ffffff', '#21bf90']);
l1.set({ continuous: true });
// -> a diverging blue→white→green gradient skewed however the control points are spaced — NOT an
//    even 3-way split of some [min, max]. Use this when your data's interesting range isn't evenly
//    distributed (e.g. quantile/percentile breakpoints computed from real pixel stats).

l1.colorScale.getRgb(-0.5);   // interpolated between the blue and white control points
l1.colorScale.getRgb(-5);    // clamped to the first control point's color (no extrapolation)
l1.colorScale.getRgb(5);     // clamped to the last control point's color

l1.set({ continuous: false });
l1.colorScale.getRgb(-0.9);   // NEAREST control point's color instead of interpolating (still a
                               // point lookup, not a flat range — use setStops() for real bands)
```

Colors must be 6-digit hex (`#rrggbb`) — CSS names like `'blue'` are not supported and throw a clear
error, as does a `values`/`colors` length mismatch.

`set({ min, max })`'s domain keeps governing peripheral things (a legend axis label, a stats-classification
range) but the actual color mapping is driven entirely by the control points, not by min/max — the
two are complementary: set both if you want a labeled axis range that differs from where the color
control points themselves sit.

## Values that aren't values (`missingColor`)

The three modes above all answer "what colour is this number?". `missingColor` answers the one they
can't: **what colour is a value that isn't there** — `null`, `undefined`, `NaN`, `''`, or a
non-numeric property.

```js
new ColorScale({ palette: 'viridis', min: 0, max: 10, missingColor: '#cccccc' });
cs.set({ missingColor: '#cccccc' });   // or after the fact — fires onChange like any other write
cs.set({ missingColor: null });         // the default: no colour at all
```

`null` means **"the consumer decides what absent looks like"**, and each does something sensible: a
`VectorLayer` leaves the feature at its base style, and a raster leaves the pixel transparent (a
grid's `noData` is a separate, earlier decision — see [LAYER_SUBTYPES.md](./LAYER_SUBTYPES.md)).
Set it when "no data here" is information the reader should see rather than a gap.

`getColor`/`getRgb` apply this **before** any arithmetic, which is the whole point: numeric coercion
turns `null` and `''` into `0`, so an absent value would otherwise take the colour of the domain
minimum — "no data" rendering as "the lowest reading". With no `missingColor` set, both return
`null`; with one set, `getColor` returns it **verbatim** (so any CSS colour works) and `getRgb`
parses it (6-digit hex). Note `0` is a *value* and still colours normally.

### Reading the domain back

`getValues()` returns the breakpoints — `[min, …, max]` — for **both** kinds of scale, so
`getValues()[0]` and `.at(-1)` are the public way to read a scale's domain. There are deliberately no
`min`/`max` getters; `set({ min, max })` writes them and this reads them back.

Because it is orthogonal to the modes, switching palette/stops/colorStops leaves it in place.

## The override callback (`colorFor`)

A plain **property**, not a method — checked first by `getColor()`/`getRgb()`, bypassing whichever
mode (palette/stops/colorStops) is otherwise active:

```js
l1.colorScale.colorFor = (value) => (value < 0 ? '#000000' : null);   // null falls through to the normal scale
```

**Gotcha:** assigning `colorFor` is a raw property write, not one of the setters above — it does
**not** fire `onChange`, so it won't trigger `RasterLayer`'s live in-place repaint on its own. Follow
it with `l1.render({ render: 'in-place' })`, or with a real setter call, to force the redraw.

## Reacting to changes (`onChange`/`offChange`)

Every write above ends by notifying registered listeners — a `set(patch)` batch notifies **once** for
the whole batch, not once per key. This is the seam `RasterLayer` hooks for its live-repaint
behavior, and you can hook it too:

```js
const onEdit = (cs) => console.log('scale changed:', cs.palette);
l1.colorScale.onChange(onEdit);
l1.colorScale.offChange(onEdit);
```

## Attaching to a layer

```js
// Replace the whole ColorScale object outright (vs. mutating the existing one in place)
l1.set({ colorScale: new ColorScale({ palette: 'plasma', min: 0, max: 10, continuous: true }) });
```

This validates `cs` **before** mutating anything — passing something that isn't a real `ColorScale`
instance (or `null`) throws immediately with an actionable message, rather than leaving
`layer.colorScale` in a half-set, corrupted state.

`layer.set()` is also where you mix scale knobs with the layer's own, in one call:

```js
l1.set({ palette: 'viridis', continuous: false, opacity: 0.7 });
```

`palette`/`continuous` route to the attached `colorScale` internally — a no-op if none is attached
yet. `set` applies each key independently: one invalid key (e.g. an
unknown palette name) does not block the others in the same call — every other key still gets
applied, and a single aggregate error at the end names exactly which key(s) failed and why, alongside
which ones succeeded despite it.

## Precedence when a `RasterLayer` renders

When a `RasterLayer` draws and no `ColorScale` is attached yet, it resolves one automatically, in
order:

1. **Explicit** — already attached (you called `set({ colorScale })`, or passed `{ colorScale }` to the
   `"raster"` layer factory). Left untouched.
2. **GDAL-embedded legend** — if the raster's `GDAL_METADATA` tag parses to a real legend, a
   `ColorScale.fromGdalLegend(...)` is built and attached automatically.
3. **Default** — a continuous scale, `ColorScale`'s own default palette (`"blues"`), ranged to the
   grid's own min/max.

Whichever is chosen is **stored** on the layer — not just used once and discarded — so
`layer.colorScale`, `layer.getLegend()`, and `layer.getStats()`'s classification always reflect what's
actually on screen, in every case.
