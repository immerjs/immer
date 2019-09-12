---
id: curried-produce
title: Curried producers
---

<div id="codefund"><!-- fallback content --></div>

Passing a function as the first argument to `produce` is intended to be used for currying. This means that you get a pre-bound producer that only needs a state to produce the value from. The producer function gets passed in the draft and any further arguments that were passed to the curried function.

For example:

```javascript
// mapper will be of signature (state, index) => state
const mapper = produce((draft, index) => {
	draft.index = index
})

// example usage
console.dir([{}, {}, {}].map(mapper))
//[{index: 0}, {index: 1}, {index: 2}])
```

This mechanism can also nicely be leveraged to further simplify our example reducer:

```javascript
import produce from "immer"

const byId = produce((draft, action) => {
	switch (action.type) {
		case RECEIVE_PRODUCTS:
			action.products.forEach(product => {
				draft[product.id] = product
			})
			return
	}
})
```

Note that `state` is now factored out (the created reducer will accept a state, and invoke the bound producer with it).

If you want to initialize an uninitialized state using this construction, you can do so by passing the initial state as second argument to `produce`:

```javascript
import produce from "immer"

const byId = produce(
	(draft, action) => {
		switch (action.type) {
			case RECEIVE_PRODUCTS:
				action.products.forEach(product => {
					draft[product.id] = product
				})
				return
		}
	},
	{
		1: {id: 1, name: "product-1"}
	}
)
```

##### Fun with currying

A random fun example just for inspiration: a neat trick is to turn `Object.assign` into a producer to create a "spread" function that is smarter than the normal spread operator, as it doesn't produce a new state if the result doesn't actually change ([details & explanation](https://twitter.com/mweststrate/status/1045059430256119809)). Quick example:

```javascript
import produce from "immer"
const spread = produce(Object.assign)

const base = {x: 1, y: 1}

console.log({...base, y: 1} === base) // false
console.log(spread(base, {y: 1}) === base) // true! base is recycled as no actual new value was produced
console.log(spread(base, {y: 2}) === base)`` // false, produced a new object as it should
```
