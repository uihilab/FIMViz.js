[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [ui/tooltip](../README.md) / bindHoverValue

# Function: bindHoverValue()

> **bindHoverValue**(`layer`, `opts?`): `object`

Defined in: [ui/tooltip.js:48](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/ui/tooltip.js#L48)

Wire a RasterLayer's hover value to a tooltip. Uses the UNFILTERED `map:hover` bus event so the
tooltip hides the moment the cursor leaves the raster footprint (valueAt → null). Requires
`fim.enableMapEvents()`.

## Parameters

### layer

[`RasterLayer`](../../../package/layer/classes/RasterLayer.md)

### opts?

#### format?

(`v`) => `string`

#### tooltip?

\{ `destroy`: () => `void`; `el`: `Element`; `hide`: () => `void`; `show`: (`evt`, `html`) => `void`; \}

#### tooltip.destroy

() => `void`

#### tooltip.el

`Element`

#### tooltip.hide

() => `void`

#### tooltip.show

(`evt`, `html`) => `void`

## Returns

`object`

### off

> **off**: () => `void`

#### Returns

`void`

### tooltip

> **tooltip**: `object`

#### tooltip.destroy

> **destroy**: () => `void`

##### Returns

`void`

#### tooltip.el

> **el**: `Element`

#### tooltip.hide

> **hide**: () => `void`

##### Returns

`void`

#### tooltip.show

> **show**: (`evt`, `html`) => `void`

##### Parameters

###### evt

`any`

###### html

`string`

##### Returns

`void`
