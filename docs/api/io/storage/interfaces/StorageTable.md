[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [io/storage](../README.md) / StorageTable

# Interface: StorageTable

Defined in: io/storage.js:41

## Properties

### clear

> **clear**: () => `Promise`\<`boolean`\>

Defined in: io/storage.js:47

#### Returns

`Promise`\<`boolean`\>

***

### delete

> **delete**: (`key`) => `Promise`\<`boolean`\>

Defined in: io/storage.js:46

#### Parameters

##### key

`IDBValidKey`

#### Returns

`Promise`\<`boolean`\>

***

### get

> **get**: (`key`) => `Promise`\<`any`\>

Defined in: io/storage.js:44

#### Parameters

##### key

`IDBValidKey`

#### Returns

`Promise`\<`any`\>

***

### has

> **has**: (`key`) => `Promise`\<`boolean`\>

Defined in: io/storage.js:45

#### Parameters

##### key

`IDBValidKey`

#### Returns

`Promise`\<`boolean`\>

***

### list

> **list**: (`opts?`) => `Promise`\<`any`[]\>

Defined in: io/storage.js:48

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

Defined in: io/storage.js:49

#### Parameters

##### fn

(`key`, `value`) => `any`

#### Returns

`Promise`\<`number`\>

***

### name

> **name**: `string`

Defined in: io/storage.js:42

***

### put

> **put**: (`key`, `value`) => `Promise`\<`IDBValidKey`\>

Defined in: io/storage.js:43

#### Parameters

##### key

`IDBValidKey`

##### value

`any`

#### Returns

`Promise`\<`IDBValidKey`\>
