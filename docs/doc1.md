---
id: doc1
title: Latin-ish
sidebar_label: Example Page
---

<div id="codefund"><!-- fallback content --></div>

- NPM: `npm install immer`
- Yarn: `yarn add immer`
- CDN: Exposed global is `immer`
  - Unpkg: `<script src="https://unpkg.com/immer/dist/immer.umd.js"></script>`
  - JSDelivr: `<script src="https://cdn.jsdelivr.net/npm/immer/dist/immer.umd.js"></script>`

---

## External resources

- Blog: [The Rise of Immer in React](https://www.netlify.com/blog/2018/09/12/the-rise-of-immer-in-react/)
- Blog: by Workday Prism on why they picked Immer to manage immutable state [The Search for a Strongly-Typed, Immutable State](https://medium.com/workday-engineering/workday-prism-analytics-the-search-for-a-strongly-typed-immutable-state-a09f6768b2b5)
- Blog: [Immutability in React and Redux: The Complete Guide](https://daveceddia.com/react-redux-immutability-guide/)
- Video tutorial: [Using Immer with React.setState](https://codedaily.io/screencasts/86/Immutable-Data-with-Immer-and-React-setState)
- [Talk](https://www.youtube.com/watch?v=-gJbS7YjcSo) + [slides](http://immer.surge.sh/) on Immer at React Finland 2018 by Michel Weststrate
- [ForwardJS 2019: Immutability is Changing - From Immutable.js to Immer](https://www.youtube.com/watch?v=bFuRvcAEiHg&feature=youtu.be) by [shawn swyx wang](https://twitter.com/swyx/)

# Pitfalls

1. Don't redefine draft like, `draft = myCoolNewState`. Instead, either modify the `draft` or return a new state. See [Returning data from producers](#returning-data-from-producers).
1. Immer assumes your state to be a unidirectional tree. That is, no object should appear twice in the tree, and there should be no circular references.
1. Since Immer uses proxies, reading huge amounts of data from state comes with an overhead (especially in the ES5 implementation). If this ever becomes an issue (measure before you optimize!), do the current state analysis before entering the producer function or read from the `currentState` rather than the `draftState`. Also, realize that immer is opt-in everywhere, so it is perfectly fine to manually write super performance critical reducers, and use immer for all the normal ones. Also note that `original` can be used to get the original state of an object, which is cheaper to read.
1. Always try to pull `produce` 'up', for example `for (let x of y) produce(base, d => d.push(x))` is exponentially slower than `produce(base, d => { for (let x of y) d.push(x)})`
1. It is possible to return values from producers, except, it is not possible to return `undefined` that way, as it is indistinguishable from not updating the draft at all! If you want to replace the draft with `undefined`, just return `nothing` from the producer.

## Cool things built with immer

- [react-copy-write](https://github.com/aweary/react-copy-write) _Immutable state with a mutable API_
- [redux-starter-kit](https://github.com/markerikson/redux-starter-kit) _A simple set of tools to make using Redux easier_
- [immer based handleActions](https://gist.github.com/kitze/fb65f527803a93fb2803ce79a792fff8) _Boilerplate free actions for Redux_
- [redux-box](https://github.com/anish000kumar/redux-box) _Modular and easy-to-grasp redux based state management, with least boilerplate_
- [quick-redux](https://github.com/jeffreyyoung/quick-redux) _tools to make redux development quicker and easier_
- [bey](https://github.com/jamiebuilds/bey) _Simple immutable state for React using Immer_
- [immer-wieder](https://github.com/drcmda/immer-wieder#readme) _State management lib that combines React 16 Context and immer for Redux semantics_
- [robodux](https://github.com/neurosnap/robodux) _flexible way to reduce redux boilerplate_
- [immer-reducer](https://github.com/epeli/immer-reducer) _Type-safe and terse React (useReducer()) and Redux reducers with Typescript_
- [redux-ts-utils](https://github.com/knpwrs/redux-ts-utils) _Everything you need to create type-safe applications with Redux with a strong emphasis on simplicity_
- [react-state-tree](https://github.com/suchipi/react-state-tree) _Drop-in replacement for useState that persists your state into a redux-like state tree_
- [redux-immer](https://github.com/salvoravida/redux-immer) _is used to create an equivalent function of Redux combineReducers that works with `immer` state. Like `redux-immutable` but for `immer`_
- ... and [many more](https://www.npmjs.com/browse/depended/immer)

## How does Immer work?

Read the (second part of the) [introduction blog](https://medium.com/@mweststrate/introducing-immer-immutability-the-easy-way-9d73d8f71cb3).

## Example patterns.

_For those who have to go back to thinking in object updates :-)_

```javascript
import produce from "immer"

// object mutations
const todosObj = {
	id1: {done: false, body: "Take out the trash"},
	id2: {done: false, body: "Check Email"}
}

// add
const addedTodosObj = produce(todosObj, draft => {
	draft["id3"] = {done: false, body: "Buy bananas"}
})

// delete
const deletedTodosObj = produce(todosObj, draft => {
	delete draft["id1"]
})

// update
const updatedTodosObj = produce(todosObj, draft => {
	draft["id1"].done = true
})

// array mutations
const todosArray = [
	{id: "id1", done: false, body: "Take out the trash"},
	{id: "id2", done: false, body: "Check Email"}
]

// add
const addedTodosArray = produce(todosArray, draft => {
	draft.push({id: "id3", done: false, body: "Buy bananas"})
})

// delete
const deletedTodosArray = produce(todosArray, draft => {
	draft.splice(draft.findIndex(todo => todo.id === "id1"), 1)
	// or (slower):
	// return draft.filter(todo => todo.id !== "id1")
})

// update
const updatedTodosArray = produce(todosArray, draft => {
	draft[draft.findIndex(todo => todo.id === "id1")].done = true
})
```

## Migration

**Immer 2.\* -> 3.0**

In your producers, make sure you're not treating `this` as the draft. (see here: https://github.com/immerjs/immer/issues/308)

Upgrade to `typescript@^3.4` if you're a TypeScript user.

**Immer 1.\* -> 2.0**

Make sure you don't return any promises as state, because `produce` will actually invoke the promise and wait until it settles.

**Immer 2.1 -> 2.2**

When using TypeScript, for curried reducers that are typed in the form `produce<Type>((arg) => { })`, rewrite this to `produce((arg: Type) => { })` or `produce((arg: Draft<Type>) => { })` for correct inference.

## FAQ

## Credits

Special thanks to @Mendix, which supports its employees to experiment completely freely two full days a month, which formed the kick-start for this project.

## Donations

A significant part of my OSS work is unpaid. So [donations](https://mobx.js.org/donate.html) are greatly appreciated :)
