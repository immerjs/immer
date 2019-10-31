---
id: typescript
title: Using TypeScript or Flow
sidebar_label: TypeScript / Flow
---

<div id="codefund"><!-- fallback content --></div>

<details>
    <summary style="color: white; background:#c200c2;padding:5px;margin:5px;border-radius:2px">egghead.io lesson 12: Immer + TypeScript</summary>
    <br>
    <div style="padding:5px;">
        <iframe style="border: none;" width=760 height=427  src="https://egghead.io/lessons/react-type-immutable-immer-data-with-typescript/embed" ></iframe>
    </div>
    <a style="font-style:italic;padding:5px;margin:5px;"  href="https://egghead.io/lessons/react-type-immutable-immer-data-with-typescript">Hosted on egghead.io</a>
</details>

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
