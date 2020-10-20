---
id: complex-objects
title: Classes
---

<center>
<div data-ea-publisher="immerjs" data-ea-type="image" class="horizontal bordered"></div>
</center>

Plain objects (objects without a prototype), arrays, `Map`s and `Set`s are always drafted by Immer. Every other object must use the `immerable` symbol to mark itself as compatible with Immer. When one of these objects is mutated within a producer, its prototype is preserved between copies.

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

### Example

```js
import {immerable, produce} from "immer"

class Clock {
	[immerable] = true

	constructor(hour, minute) {
		this.hour = hour
		this.minute = minute
	}

	get time() {
		return `${this.hour}:${this.minute}`
	}

	tick() {
		return produce(this, draft => {
			draft.minute++
		})
	}
}

const clock1 = new Clock(12, 10)
const clock2 = clock1.tick()
console.log(clock1.time) // 12:10
console.log(clock2.time) // 12:11
console.log(clock2 instanceof Clock) // true
```

### Semantics in detail

The semantics on how classes are drafted are as follows:

1. A draft of a class is a fresh object but with the same prototype as the original object.
2. When creating a draft, Immer will copy all _own_ properties from the base to the draft.This includes non-enumerable and symbolic properties.
3. _Own_ getters will be invoked during the copy process, just like `Object.assign` would.
4. Inherited getters and methods will remain as is and be inherited by the draft.
5. Immer will not invoke constructor functions.
6. The final instance will be constructed with the same mechanism as the draft was created.
7. Only getters that have a setter as well will be writable in the draft, as otherwise the value can't be copied back.

Because Immer will dereference own getters of objects into normal properties, it is possible to use objects that use getter/setter traps on their fields, like MobX and Vue do.

Immer does not support exotic objects such as DOM Nodes or Buffers.

So when working for example with `Date` objects, you should always create a new `Date` instance instead of mutating an existing `Date` object.
