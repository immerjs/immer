---
id: complex-objects
title: Working with Map, Set and classes
---

<div id="codefund"><!-- fallback content --></div>

_⚠ Since version 6 support for `Map`s and `Set`s has to be enabled explicitly by calling [`enableMapSet()`](installation#pick-your-immer-version) once when starting your application._

Plain objects, arrays, `Map`s and `Set`s are always drafted by Immer. An example of using Maps with immer:

```javascript
test("Producers can update Maps", () => {
	const usersById_v1 = new Map()

	const usersById_v2 = produce(usersById_v1, draft => {
		// Modifying a map results in a new map
		draft.set("michel", {name: "Michel Weststrate", country: "NL"})
	})

	const usersById_v3 = produce(usersById_v2, draft => {
		// Making a change deep inside a map, results in a new map as well!
		draft.get("michel").country = "UK"
	})

	// We got a new map each time!
	expect(usersById_v2).not.toBe(usersById_v1)
	expect(usersById_v3).not.toBe(usersById_v2)
	// With different content obviously
	expect(usersById_v1).toMatchInlineSnapshot(`Map {}`)
	expect(usersById_v2).toMatchInlineSnapshot(`
		Map {
		  "michel" => Object {
		    "country": "NL",
		    "name": "Michel Weststrate",
		  },
		}
	`)
	expect(usersById_v3).toMatchInlineSnapshot(`
		Map {
		  "michel" => Object {
		    "country": "UK",
		    "name": "Michel Weststrate",
		  },
		}
	`)
	// The old one was never modified
	expect(usersById_v1.size).toBe(0)
	// And trying to change a Map outside a producers is going to: NO!
	expect(() => usersById_v3.clear()).toThrowErrorMatchingInlineSnapshot(
		`"This object has been frozen and should not be mutated"`
	)
})
```

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

Maps and Sets that are produced by Immer will be made artificially immutable. This means that they will throw an exception when trying mutative methods like `set`, `clear` etc. outside a producer.

_Note: The **keys** of a map are never drafted! This is done to avoid confusing semantics and keep keys always referentially equal_
