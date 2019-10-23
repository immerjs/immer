---
id: complex-objects
title: Working with classes
---

<div id="codefund"><!-- fallback content --></div>

Plain objects and arrays are always drafted by Immer.

Every other object must use the `immerable` symbol to mark itself as compatible with Immer. When one of these objects is mutated within a producer, its prototype is preserved between copies.

```js
import {immerable} from "immer"

class Foo {
	[immerable] = true // Option 1

	constructor() {
		this[immerable] = true // Option 2
	}
}

Foo[immerable] = true // Option 3
```

For arrays, only numeric properties and the `length` property can be mutated. Custom properties are not preserved on arrays.

When working with `Date` objects, you should always create a new `Date` instance instead of mutating an existing `Date` object.

Built-in classes like `Map` and `Set` are not yet supported (they might be if there is popular demand). As a workaround, you should clone them before mutating them in a producer:

```js
const state = {
	set: new Set(),
	map: new Map()
}
const nextState = produce(state, draft => {
	// Don't use any Set methods, as that mutates the instance!
	draft.set.add("foo") // ❌

	// 1. Instead, clone the set (just once)
	const newSet = new Set(draft.set) // ✅

	// 2. Mutate the clone (just in this producer)
	newSet.add("foo")

	// 3. Update the draft with the new set
	draft.set = newSet

	// Similarly, don't use any Map methods.
	draft.map.set("foo", "bar") // ❌

	// 1. Instead, clone the map (just once)
	const newMap = new Map(draft.map) // ✅

	// 2. Mutate it
	newMap.set("foo", "bar")

	// 3. Update the draft
	draft.map = newMap
})
```
