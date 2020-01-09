---
id: original
title: Extracting the original object from a proxied instance
sidebar_label: Original
---

<div id="codefund"><!-- fallback content --></div>

Immer exposes a named export `original` that will get the original object from the proxied instance inside `produce` (or return `undefined` for unproxied values). A good example of when this can be useful is when searching for nodes in a tree-like state using strict equality.

```js
import {original, produce} from "immer"

const baseState = {users: [{name: "Richie"}]}
const nextState = produce(baseState, draftState => {
	original(draftState.users) // is === baseState.users
})
```

Just want to know if a value is a proxied instance? Use the `isDraft` function!

```js
import {isDraft, produce} from "immer"

const baseState = {users: [{name: "Bobby"}]}
const nextState = produce(baseState, draft => {
	isDraft(draft) // => true
	isDraft(draft.users) // => true
	isDraft(draft.users[0]) // => true
})
isDraft(nextState) // => false
```
