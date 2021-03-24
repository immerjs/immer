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

### TypeScript and Structural Typing

Type compatibility in TypeScript is based on structural subtyping. Structural typing is a way of relating types based solely on their members.
For example:
```js
class Foo { bar: string }

function logBar(someFoo: Foo) { console.log(someFoo.bar); }

logBar({bar: 'Hello', someOtherProperty: 'ignore me'}); // OK in TypeScript
```

However, if a class is marked using a non-optional `[immerable]` property, the TypeScript compiler will throw an error related to this property missing in your otherwise structurally-compatible object literal:

```js
import {immerable} from "immer"

class Foo { [immerable] = true; constructor(public bar: string){} }

function logBar(someFoo: Foo) { console.log(someFoo.bar); }

logBar({bar: 'Hello', someOtherProperty: 'ignore me'}); // Error in TypeScript
/*
Argument of type '{bar: string, someOtherProperty: string}' is not assignable to parameter of type 'Foo'.
  Property '[immerable]' is missing in type '{bar: string, someOtherProperty: string}' but required in type 'Foo'.
*/
```

To resolve this particular issue, you mark the `[immerable]` property as optional or static in your class definition:

```js
class Foo { static [immerable] = true; constructor(public bar: string){} }
// Or
class Foo { [immerable]? = true; constructor(public bar: string){} }
```

This ensures that legitimate instances of `Foo` created via its constructor are marked `immerable`, while allowing structurally-compatible object literals (which would not require an `[immerable]` mark to be a valid `base` argument for `produce`) to omit it.

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
