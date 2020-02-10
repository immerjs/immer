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
        <iframe style="border: none;" width=760 height=427 scrolling="no" src="https://egghead.io/lessons/react-type-immutable-immer-data-with-typescript/embed" ></iframe>
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

This ensures that the only place you can modify your state is in your produce callbacks. It even works recursively and with `ReadonlyArray`!

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

_Note: Since TypeScript support for recursive types is limited, and there is no co- contravariance, it might the easiest to not type your state as `readonly` (Immer will still protect against accidental mutations)_

## Cast utilities

The types inside and outside a `produce` can be conceptually the same, but from a practical perspective different. For example, the `State` in the examples above should be considered immutable outside `produce`, but mutable inside `produce`.

Sometimes this leads to practical conflicts. Take the following example:

```typescript
type Todo = {readonly done: boolean}

type State = {
	readonly finishedTodos: readonly Todo[]
	readonly unfinishedTodos: readonly Todo[]
}

function markAllFinished(state: State) {
	produce(state, draft => {
		draft.finishedTodos = state.unfinishedTodos
	})
}
```

This will generate the error:

```
The type 'readonly Todo[]' is 'readonly' and cannot be assigned to the mutable type '{ done: boolean; }[]'
```

The reason for this error is that we assign our read only, immutable array to our draft, which expects a mutable type, with methods like `.push` etc etc. As far as TS is concerned, those are not exposed from our original `State`. To hint TypeScript that we want to upcast the collection here to a mutable array for draft purposes, we can use the utility `castDraft`:

`draft.finishedTodos = castDraft(state.unfinishedTodos)` will make the error disappear.

There is also the utility `castImmutable`, in case you ever need to achieve the opposite. Note that these utilities are for all practical purposes no-ops, they will just return their original value.

Tip: You can combine `castImmutable` with `produce` to type the return type of `produce` as something immutable, even when the original state was mutable:

```typescript
// a mutable data structure
const baseState = {
	todos: [{
		done: false
	}]
}

const nextState = castImmutable(produce(baseState, _draft => {}))

// inferred type of nextState is now:
{
	readonly todos: ReadonlyArray<{
		readonly done: boolean
	}>
})
```

## Compatibility

**Note:** Immer v5.3+ supports TypeScript v3.7+ only.

**Note:** Immer v1.9+ supports TypeScript v3.1+ only.

**Note:** Immer v3.0+ supports TypeScript v3.4+ only.

**Note:** Flow support might be removed in future versions and we recommend TypeScript
