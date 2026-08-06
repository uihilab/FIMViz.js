[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [ui/infoWindow](../README.md) / bindFeatureInfo

# Function: bindFeatureInfo()

> **bindFeatureInfo**(`layer`, `opts?`): `object`

Defined in: [ui/infoWindow.js:77](https://github.com/uihilab/FIMViz.js/blob/9e18afac2775f0224216af175bd5a318723bb4c9/src/ui/infoWindow.js#L77)

Wire a VectorLayer's feature clicks to an info window. The per-layer `click` fires only over a
feature (dispatch hitTest), so this opens on the clicked feature. Requires `fim.enableMapEvents()`.

## Parameters

### layer

[`VectorLayer`](../../../package/layer/classes/VectorLayer.md)

### opts?

#### infoWindow?

\{ `close`: () => `void`; `destroy`: () => `void`; `el`: `Element`; `open`: (`evt`, `html`) => `void`; \}

#### infoWindow.close

() => `void`

#### infoWindow.destroy

() => `void`

#### infoWindow.el

`Element`

#### infoWindow.open

(`evt`, `html`) => `void`

#### render?

(`feature`) => `string` \| `Node`

## Returns

`object`

### infoWindow

> **infoWindow**: `object`

#### infoWindow.close

> **close**: () => `void`

##### Returns

`void`

#### infoWindow.destroy

> **destroy**: () => `void`

##### Returns

`void`

#### infoWindow.el

> **el**: `Element`

#### infoWindow.open

> **open**: (`evt`, `html`) => `void`

##### Parameters

###### evt

`any`

###### html

`string` \| `Node`

##### Returns

`void`

### off

> **off**: () => `void`

#### Returns

`void`
