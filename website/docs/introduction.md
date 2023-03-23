---
id: introduction
title: Introduction to Immer
sidebar_label: Introduction
slug: /
---

<center>
<div data-ea-publisher="immerjs" data-ea-type="image" className="horizontal bordered"></div>
</center>

<img src="/immer/img/immer-logo.svg" style={{maxHeight:200}} align="right"/>

# Immer

Immer (German for: always) is a tiny package that allows you to work with immutable state in a more convenient way.

> Immer is life-changing as a JS dev, and I'm not even exaggerating :) Like, it's right up there with Prettier in terms of "wow this package is amazing, how did I ever live without it?" --Mark Erikson, (the) Redux Maintainer, @replayio

Winner of the "Breakthrough of the year" [React open source award](https://osawards.com/react/) and "Most impactful contribution" [JavaScript open source award](https://osawards.com/javascript/) in 2019.

---

- Introduction blogpost: [Immer: Immutability the easy way](https://medium.com/@mweststrate/introducing-immer-immutability-the-easy-way-9d73d8f71cb3)
- Short Egghead.io lesson covering the Immer essentials: [Simplify creating immutable data trees with Immer (7m)](https://egghead.io/lessons/redux-simplify-creating-immutable-data-trees-with-immer)
- Free in-depth Egghead.io course: [Immutable JavaScript Data Structures with Immer (58m)](https://egghead.io/courses/immutable-javascript-data-structures-with-immer)

---

### Immer simplifies handling immutable data structures

Immer can be used in any context in which immutable data structures need to be used. For example in combination with React state, React or Redux reducers, or configuration management. Immutable data structures allow for (efficient) change detection: if the reference to an object didn't change, the object itself did not change. In addition, it makes cloning relatively cheap: Unchanged parts of a data tree don't need to be copied and are shared in memory with older versions of the same state.

Generally speaking, these benefits can be achieved by making sure you never change any property of an object, array or map, but by always creating an altered copy instead. In practice this can result in code that is quite cumbersome to write, and it is easy to accidentally violate those constraints. Immer will help you to follow the immutable data paradigm by addressing these pain points:

1. Immer will detect accidental mutations and throw an error.
2. Immer will remove the need for the typical boilerplate code that is needed when creating deep updates to immutable objects: Without Immer, object copies need to be made by hand at every level. Typically by using a lot of `...` spread operations. When using Immer, changes are made to a `draft` object, that records the changes and takes care of creating the necessary copies, without ever affecting the original object.
3. When using Immer, you don't need to learn dedicated APIs or data structures to benefit from the paradigm. With Immer you'll use plain JavaScript data structures, and use the well-known mutable JavaScript APIs, but safely.

### A quick example for comparison

```javascript
const baseState = [
	{
		title: "Learn TypeScript",
		done: true
	},
	{
		title: "Try Immer",
		done: false
	}
]
```

Imagine we have the above base state, and we'll need to update the second todo, and add a third one. However, we don't want to mutate the original `baseState`, and we want to avoid deep cloning as well (to preserve the first todo).

#### Without Immer

Without Immer, we'll have to carefully shallow copy every level of the state structure that is affected by our change:

```javascript
const nextState = baseState.slice() // shallow clone the array
nextState[1] = {
	// replace element 1...
	...nextState[1], // with a shallow clone of element 1
	done: true // ...combined with the desired update
}
// since nextState was freshly cloned, using push is safe here,
// but doing the same thing at any arbitrary time in the future would
// violate the immutability principles and introduce a bug!
nextState.push({title: "Tweet about it"})
```

#### With Immer

With Immer, this process is more straightforward. We can leverage the `produce` function, which takes as first argument the state we want to start from, and as second argument we pass a function, called the _recipe_, that is passed a `draft` to which we can apply straightforward mutations. Those mutations are recorded and used to produce the next state once the recipe is done. `produce` will take care of all the necessary copying, and protect against future accidental modifications as well by freezing the data.

```javascript
import {produce} from "immer"

const nextState = produce(baseState, draft => {
	draft[1].done = true
	draft.push({title: "Tweet about it"})
})
```

Looking for Immer in combination with React? Feel free to skip ahead to the [React + Immer](example-setstate) page.

### How Immer works

The basic idea is that with Immer you will apply all your changes to a temporary _draft_, which is a proxy of the _currentState_. Once all your mutations are completed, Immer will produce the _nextState_ based on the mutations to the draft state. This means that you can interact with your data by simply modifying it while keeping all the benefits of immutable data.

![immer-hd.png](/img/immer.png)

Using Immer is like having a personal assistant. The assistant takes a letter (the current state) and gives you a copy (draft) to jot changes onto. Once you are done, the assistant will take your draft and produce the real immutable, final letter for you (the next state).

Head to the [next section](./produce.mdx) to further dive into `produce`.

## Benefits

- Follow the immutable data paradigm, while using normal JavaScript objects, arrays, Sets and Maps. No new APIs or "mutation patterns" to learn!
- Strongly typed, no string based paths selectors etc.
- Structural sharing out of the box
- Object freezing out of the box
- Deep updates are a breeze
- Boilerplate reduction. Less noise, more concise code.
- First class support for JSON patches
- Small: 3KB gzipped
