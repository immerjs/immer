---
id: typescript
title: Using TypeScript or Flow
sidebar_label: TypeScript / Flow
---

<div id="codefund"><!-- fallback content --></div>

The Immer package ships with type definitions inside the package, which should be picked up by TypeScript and Flow out of the box and without further configuration.

The TypeScript typings automatically remove `readonly` modifiers from your draft types and return a value that matches your original type. See this practical example:

```ts
import produce from "immer"

interface State {
	readonly x: number
}

// `x` cannot be modified here
const state: State = {
	x: 0
}

const newState = produce(state, draft => {
	// `x` can be modified here
	draft.x++
})

// `newState.x` cannot be modified here
```

This ensures that the only place you can modify your state is in your produce callbacks. It even works recursively and with `ReadonlyArray`s!

For curried reducers, the type is inferred from the first argument of recipe function, so make sure to type it. The `Draft` utility type can be used if the state argument type is immutable:

```ts
import produce, {Draft} from "immer"

interface State {
	readonly x: number
}

// `x` cannot be modified here
const state: State = {
	x: 0
}

const increment = produce((draft: Draft<State>, inc: number) => {
	// `x` can be modified here
	draft.x += inc
})

const newState = increment(state, 2)
// `newState.x` cannot be modified here
```

**Note:** Immer v1.9+ supports TypeScript v3.1+ only.

**Note:** Immer v3.0+ supports TypeScript v3.4+ only.

**Note:** Flow support might be removed in future versions and we recommend TypeScript
