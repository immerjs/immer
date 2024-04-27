---
id: complex-objects
title: Classes
---

<center>
<div data-ea-publisher="immerjs" data-ea-type="image" className="horizontal bordered"></div>
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
1. When creating a draft, Immer will copy all _own_ properties from the base to the draft.This includes (in strict mode) non-enumerable and symbolic properties.
1. _Own_ getters will be invoked during the copy process, just like `Object.assign` would.
1. Inherited getters and methods will remain as is and be inherited by the draft, as they are stored on the prototype which is untouched.
1. Immer will not invoke constructor functions.
1. The final instance will be constructed with the same mechanism as the draft was created.
1. Only getters that have a setter as well will be writable in the draft, as otherwise the value can't be copied back.

Because Immer will dereference own getters of objects into normal properties, it is possible to use objects that use getter/setter traps on their fields, like MobX and Vue do.

Note that, by default, Immer does not strictly handle object's non-enumerable properties such as getters/setters for performance reason. If you want this behavior to be strict, you can opt-in with `useStrictShallowCopy(config)`. Use `true` to always copy strict, or `"class_only"` to only copy class instances strictly but use the faster loose copying for plain objects. The default is `false`. (Remember, regardless of strict mode, own getters / setters are always copied _by value_. There is currently no config to copy descriptors as-is. Feature request / PR welcome).

Immer does not support exotic / engine native objects such as DOM Nodes or Buffers, nor is subclassing Map, Set or arrays supported and the `immerable` symbol can't be used on them.

So when working for example with `Date` objects, you should always create a new `Date` instance instead of mutating an existing `Date` object.
