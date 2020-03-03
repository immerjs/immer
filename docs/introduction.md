---
id: introduction
title: Introduction to Immer
sidebar_label: Introduction
---

<div id="codefund"><!-- fallback content --></div>

<img src="/immer/img/immer-logo.svg" height="200px" align="right"/>

# Immer

Winner of the "Breakthrough of the year" [React open source award](https://osawards.com/react/) and "Most impactful contribution" [JavaScript open source award](https://osawards.com/javascript/) in 2019.

- Introduction blogpost: [Immer: Immutability the easy way](https://medium.com/@mweststrate/introducing-immer-immutability-the-easy-way-9d73d8f71cb3)
- Short Egghead.io lesson covering the Immer essentials: [Simplify creating immutable data trees with Immer (7m)](https://egghead.io/lessons/redux-simplify-creating-immutable-data-trees-with-immer)
- Free in-depth Egghead.io course: [Immutable JavaScript Data Structures with Immer (58m)](https://egghead.io/courses/immutable-javascript-data-structures-with-immer)

---

Immer (German for: always) is a tiny package that allows you to work with immutable state in a more convenient way. It is based on the [_copy-on-write_](https://en.wikipedia.org/wiki/Copy-on-write) mechanism.

The basic idea is that you will apply all your changes to a temporary _draftState_, which is a proxy of the _currentState_. Once all your mutations are completed, Immer will produce the _nextState_ based on the mutations to the draft state. This means that you can interact with your data by simply modifying it while keeping all the benefits of immutable data.

![immer-hd.png](/immer/img/immer.png)

Using Immer is like having a personal assistant; he takes a letter (the current state) and gives you a copy (draft) to jot changes onto. Once you are done, the assistant will take your draft and produce the real immutable, final letter for you (the next state).

## Quick Example

```javascript
import produce from "immer"

const baseState = [
	{
		todo: "Learn typescript",
		done: true
	},
	{
		todo: "Try immer",
		done: false
	}
]

const nextState = produce(baseState, draftState => {
	draftState.push({todo: "Tweet about it"})
	draftState[1].done = true
})
```

The interesting thing about Immer is that the `baseState` will be untouched, but the `nextState` will be a new immutable tree that reflects all changes made to `draftState` (and structurally sharing the things that weren't changed).

Head to the [next section](produce) to further dive into `produce`.

## Benefits

- Immutability with normal JavaScript objects, arrays, Sets and Maps. No new APIs to learn!
- Strongly typed, no string based paths selectors etc.
- Structural sharing out of the box
- Object freezing out of the box
- Deep updates are a breeze
- Boilerplate reduction. Less noise, more concise code.
- First class support for patches
- Small: 3KB gzipped
