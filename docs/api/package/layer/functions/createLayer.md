[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/layer](../README.md) / createLayer

# Function: createLayer()

> **createLayer**(`fim`, `type?`, `opts?`): [`Layer`](../classes/Layer.md) \| `Promise`\<[`Layer`](../classes/Layer.md)\>

Defined in: [package/layer.js:1153](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L1153)

Constructs a Layer of `type` for `fim`. `type` is normally a registry string such as 'vector', but
a bare source works too: a Dataset in the `type` slot is read as `{ source: type }`, so
`fim.addLayer(ds)` needs no type at all. When the type is still unresolved it comes from
`opts.source` or `opts.sources[0]`'s `Dataset.kind`, raster or vector, and only when there is
exactly one source, since a multi-source type such as comparison cannot be guessed. Throws when
the type cannot be resolved, or when the resolved type has no registered factory.

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
