[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [ui/toast](../README.md) / createToast

# Function: createToast()

> **createToast**(`root?`, `opts?`): `object`

Defined in: [ui/toast.js:17](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/ui/toast.js#L17)

Create a toast container and a `show()` to push messages into it.

## Parameters

### root?

`Element` = `null`

where to mount (default document.body)

### opts?

#### corner?

`"br"` \| `"tr"` \| `"bl"` \| `"tl"`

## Returns

`object`

### clear

> **clear**: () => `void`

#### Returns

`void`

### destroy

> **destroy**: () => `void`

#### Returns

`void`

### el

> **el**: `Element`

### show

> **show**: (`msg`, `o?`) => `Element`

#### Parameters

##### msg

`string`

##### o?

###### level?

`string`

###### timeout?

`number`

#### Returns

`Element`
