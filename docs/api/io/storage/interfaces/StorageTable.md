[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [io/storage](../README.md) / StorageTable

# Interface: StorageTable

Defined in: [io/storage.js:41](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/io/storage.js#L41)

## Properties

### clear

> **clear**: () => `Promise`\<`boolean`\>

Defined in: [io/storage.js:47](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/io/storage.js#L47)

#### Returns

`Promise`\<`boolean`\>

***

### delete

> **delete**: (`key`) => `Promise`\<`boolean`\>

Defined in: [io/storage.js:46](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/io/storage.js#L46)

#### Parameters

##### key

`IDBValidKey`

#### Returns

`Promise`\<`boolean`\>

***

### get

> **get**: (`key`) => `Promise`\<`any`\>

Defined in: [io/storage.js:44](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/io/storage.js#L44)

#### Parameters

##### key

`IDBValidKey`

#### Returns

`Promise`\<`any`\>

***

### has

> **has**: (`key`) => `Promise`\<`boolean`\>

Defined in: [io/storage.js:45](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/io/storage.js#L45)

#### Parameters

##### key

`IDBValidKey`

#### Returns

`Promise`\<`boolean`\>

***

### list

> **list**: (`opts?`) => `Promise`\<`any`[]\>

Defined in: [io/storage.js:48](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/io/storage.js#L48)

#### Parameters

##### opts?

###### keys?

`boolean`

###### range?

`IDBKeyRange`

#### Returns

`Promise`\<`any`[]\>

***

### map

> **map**: (`fn`) => `Promise`\<`number`\>

Defined in: [io/storage.js:49](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/io/storage.js#L49)

#### Parameters

##### fn

(`key`, `value`) => `any`

#### Returns

`Promise`\<`number`\>

***

### name

> **name**: `string`

Defined in: [io/storage.js:42](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/io/storage.js#L42)

***

### put

> **put**: (`key`, `value`) => `Promise`\<`IDBValidKey`\>

Defined in: [io/storage.js:43](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/io/storage.js#L43)

#### Parameters

##### key

`IDBValidKey`

##### value

`any`

#### Returns

`Promise`\<`IDBValidKey`\>
