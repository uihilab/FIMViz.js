[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/layer](../README.md) / createLayer

# Function: createLayer()

> **createLayer**(`fim`, `type?`, `opts?`): [`Layer`](../classes/Layer.md) \| `Promise`\<[`Layer`](../classes/Layer.md)\>

Defined in: [package/layer.js:1103](https://github.com/uihilab/FIMViz.js/blob/fa826b69548017771e1f4e174a9441d835478f4f/src/package/layer.js#L1103)

Construct a Layer of `type` for `fim`. `type` is normally a registry string ('vector', 'raster',
…), but a bare source works too: pass a Dataset (or anything else) in the `type` slot and it is
treated as `{ source: type }` — `fim.addLayer(ds)` needs no type argument at all. Either way, when
a type ends up unresolved it is inferred from `opts.source`/`opts.sources[0]`'s `Dataset.kind`
('raster'|'vector') — only when there is EXACTLY one source, since a multi-source type
(comparison/ensemble) can't be guessed. Throws a clear error if a type can't be resolved, or if
the resolved type has no registered factory.

## Parameters

### fim

[`FimMap`](../../fimMap/classes/FimMap.md)

### type?

`any`

a registry name, OR a bare source (Dataset) to infer from

### opts?

`any` = `{}`

## Returns

[`Layer`](../classes/Layer.md) \| `Promise`\<[`Layer`](../classes/Layer.md)\>
