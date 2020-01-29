---
id: async
title: Async producers & createDraft / finishDraft
sidebar_label: Async produce / createDraft
---

<div id="codefund"><!-- fallback content --></div>

<details>
    <summary style="color: white; background:#c200c2;padding:5px;margin:5px;border-radius:2px">egghead.io lesson 11: Creating _async_ producers (and why you shouldn’t)</summary>
    <br>
    <div style="padding:5px;">
        <iframe style="border: none;" width=760 height=427 scrolling="no" src="https://egghead.io/lessons/react-write-asynchronous-producers-in-immer-and-why-you-shouldn-t/embed" ></iframe>
    </div>
    <a style="font-style:italic;padding:5px;margin:5px;"  href="https://egghead.io/lessons/react-write-asynchronous-producers-in-immer-and-why-you-shouldn-t">Hosted on egghead.io</a>
</details>

It is allowed to return Promise objects from recipes. Or, in other words, to use `async / await`. This can be pretty useful for long running processes, that only produce the new object once the promise chain resolves. Note that `produce` itself (even in the curried form) will return a promise if the producer is async. Example:

```javascript
import produce from "immer"

const user = {
	name: "michel",
	todos: []
}

const loadedUser = await produce(user, async function(draft) {
	draft.todos = await (await window.fetch("http://host/" + draft.name)).json()
})
```

_Warning: please note that the draft shouldn't be 'leaked' from the async process and stored else where. The draft will still be revoked as soon as the async process completes._

## `createDraft` and `finishDraft`

`createDraft` and `finishDraft` are two low-level functions that are mostly useful for libraries that build abstractions on top of immer. It avoids the need to always create a function in order to work with drafts. Instead, one can create a draft, modify it, and at some time in the future finish the draft, in which case the next immutable state will be produced. We could for example rewrite our above example as:

```javascript
import {createDraft, finishDraft} from "immer"

const user = {
	name: "michel",
	todos: []
}

const draft = createDraft(user)
draft.todos = await (await window.fetch("http://host/" + draft.name)).json()
const loadedUser = finishDraft(draft)
```

Note: `finishDraft` takes a `patchListener` as second argument, which can be used to record the patches, similarly to `produce`.

_Warning: in general, we recommend to use `produce` instead of the `createDraft` / `finishDraft` combo, `produce` is less error prone in usage, and more clearly separates the concepts of mutability and immutability in your code base._
