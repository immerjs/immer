---
id: patches
title: Patches
---

<div id="codefund"><!-- fallback content --></div>

<details>
    <summary style="color: white; background:#c200c2;padding:5px;margin:5px;border-radius:2px">egghead.io lesson 14: Capture patches using _produceWithPatches_</summary>
    <br>
    <div style="padding:5px;">
        <iframe style="border: none;" width=760 height=427 scrolling="no" src="https://egghead.io/lessons/react-capture-patches-to-distribute-changes-in-app-state-with-immer-producewithpatches/embed" ></iframe>
    </div>
    <a style="font-style:italic;padding:5px;margin:5px;"  href="https://egghead.io/lessons/react-capture-patches-to-distribute-changes-in-app-state-with-immer-producewithpatches">Hosted on egghead.io</a>
</details>

<details>
    <summary style="color: white; background:#c200c2;padding:5px;margin:5px;border-radius:2px">egghead.io lesson 16: Apply Patches using _applyPatches_</summary>
    <br>
    <div style="padding:5px;">
        <iframe style="border: none;" width=760 height=427 scrolling="no" src="https://egghead.io/lessons/react-apply-patches-using-immer-applypatches-to-synchronize-state-across-clients/embed" ></iframe>
    </div>
    <a style="font-style:italic;padding:5px;margin:5px;"  href="https://egghead.io/lessons/react-apply-patches-using-immer-applypatches-to-synchronize-state-across-clients">Hosted on egghead.io</a>
</details>

_⚠ Since version 6 support for Patches has to be enabled explicitly by calling [`enablePatches()`](installation#pick-your-immer-version) once when starting your application._

During the run of a producer, Immer can record all the patches that would replay the changes made by the reducer. This is a very powerful tool if you want to fork your state temporarily and replay the changes to the original.

Patches are useful in few scenarios:

- To exchange incremental updates with other parties, for example over websockets
- For debugging / traces, to see precisely how state is changed over time
- As basis for undo/redo or as an approach to replay changes on a slightly different state tree

To help with replaying patches, `applyPatches` comes in handy. Here is an example how patches could be used to record the incremental updates and (inverse) apply them:

```javascript
import produce, {applyPatches} from "immer"

let state = {
	name: "Micheal",
	age: 32
}

// Let's assume the user is in a wizard, and we don't know whether
// his changes should end up in the base state ultimately or not...
let fork = state
// all the changes the user made in the wizard
let changes = []
// the inverse of all the changes made in the wizard
let inverseChanges = []

fork = produce(
	fork,
	draft => {
		draft.age = 33
	},
	// The third argument to produce is a callback to which the patches will be fed
	(patches, inversePatches) => {
		changes.push(...patches)
		inverseChanges.push(...inversePatches)
	}
)

// In the meantime, our original state is replaced, as, for example,
// some changes were received from the server
state = produce(state, draft => {
	draft.name = "Michel"
})

// When the wizard finishes (successfully) we can replay the changes that were in the fork onto the *new* state!
state = applyPatches(state, changes)

// state now contains the changes from both code paths!
expect(state).toEqual({
	name: "Michel", // changed by the server
	age: 33 // changed by the wizard
})

// Finally, even after finishing the wizard, the user might change his mind and undo his changes...
state = applyPatches(state, inverseChanges)
expect(state).toEqual({
	name: "Michel", // Not reverted
	age: 32 // Reverted
})
```

The generated patches are similar (but not the same) to the [RFC-6902 JSON patch standard](http://tools.ietf.org/html/rfc6902), except that the `path` property is an array, rather than a string. This makes processing patches easier. If you want to normalize to the official specification, `patch.path = patch.path.join("/")` should do the trick. Anyway, this is what a bunch of patches and their inverse could look like:

```json
[
	{
		"op": "replace",
		"path": ["profile"],
		"value": {"name": "Veria", "age": 5}
	},
	{"op": "remove", "path": ["tags", 3]}
]
```

```json
[
	{"op": "replace", "path": ["profile"], "value": {"name": "Noa", "age": 6}},
	{"op": "add", "path": ["tags", 3], "value": "kiddo"}
]
```

### `produceWithPatches`

<details>
    <summary style="color: white; background:#c200c2;padding:5px;margin:5px;border-radius:2px">egghead.io lesson 19: Using inverse patches to build undo functionality</summary>
    <br>
    <div style="padding:5px;">
        <iframe style="border: none;" width=760 height=427 scrolling="no" src="https://egghead.io/lessons/react-use-immer-inversepatches-to-build-undo-functionality/embed" ></iframe>
    </div>
    <a style="font-style:italic;padding:5px;margin:5px;"  href="https://egghead.io/lessons/react-use-immer-inversepatches-to-build-undo-functionality">Hosted on egghead.io</a>
</details>

<details>
    <summary style="color: white; background:#c200c2;padding:5px;margin:5px;border-radius:2px">egghead.io lesson 20: Use patches to build redo functionality</summary>
    <br>
    <div style="padding:5px;">
        <iframe style="border: none;" width=760 height=427 scrolling="no" src="https://egghead.io/lessons/react-use-immer-patches-to-build-redo-functionality/embed" ></iframe>
    </div>
    <a style="font-style:italic;padding:5px;margin:5px;"  href="https://egghead.io/lessons/react-use-immer-patches-to-build-redo-functionality">Hosted on egghead.io</a>
</details>

Instead of setting up a patch listener, an easier way to obtain the patches is to use `produceWithPatches`, which has the same signature as `produce`, except that it doesn't return just the next state, but a tuple consisting of `[nextState, patches, inversePatches]`. Like `produce`, `produceWithPatches` supports currying as well.

```javascript
import {produceWithPatches} from "immer"

const [nextState, patches, inversePatches] = produceWithPatches(
	{
		age: 33
	},
	draft => {
		draft.age++
	}
)
```

Which produces:

```javascript
;[
	{
		age: 34
	},
	[
		{
			op: "replace",
			path: ["age"],
			value: 34
		}
	],
	[
		{
			op: "replace",
			path: ["age"],
			value: 33
		}
	]
]
```

For a more in-depth study, see [Distributing patches and rebasing actions using Immer](https://medium.com/@mweststrate/distributing-state-changes-using-snapshots-patches-and-actions-part-2-2f50d8363988)

Tip: Check this trick to [compress patches](https://medium.com/@david.b.edelstein/using-immer-to-compress-immer-patches-f382835b6c69) produced over time.
