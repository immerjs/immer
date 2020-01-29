---
id: return
title: Returning new data from producers
---

<div id="codefund"><!-- fallback content --></div>

<details>
    <summary style="color: white; background:#c200c2;padding:5px;margin:5px;border-radius:2px">egghead.io lesson 9: Returning completely new state</summary>
    <br>
    <div style="padding:5px;">
        <iframe style="border: none;" width=760 height=427 scrolling="no" src="https://egghead.io/lessons/react-return-completely-new-state-from-an-immer-producer/embed" ></iframe>
    </div>
    <a style="font-style:italic;padding:5px;margin:5px;"  href="https://egghead.io/lessons/react-return-completely-new-state-from-an-immer-producer">Hosted on egghead.io</a>
</details>

It is not needed to return anything from a producer, as Immer will return the (finalized) version of the `draft` anyway. However, it is allowed to just `return draft`.

It is also allowed to return arbitrarily other data from the producer function. But _only_ if you didn't modify the draft. This can be useful to produce an entirely new state. Some examples:

```javascript
const userReducer = produce((draft, action) => {
	switch (action.type) {
		case "renameUser":
			// OK: we modify the current state
			draft.users[action.payload.id].name = action.payload.name
			return draft // same as just 'return'
		case "loadUsers":
			// OK: we return an entirely new state
			return action.payload
		case "adduser-1":
			// NOT OK: This doesn't do change the draft nor return a new state!
			// It doesn't modify the draft (it just redeclares it)
			// In fact, this just doesn't do anything at all
			draft = {users: [...draft.users, action.payload]}
			return
		case "adduser-2":
			// NOT OK: modifying draft *and* returning a new state
			draft.userCount += 1
			return {users: [...draft.users, action.payload]}
		case "adduser-3":
			// OK: returning a new state. But, unnecessary complex and expensive
			return {
				userCount: draft.userCount + 1,
				users: [...draft.users, action.payload]
			}
		case "adduser-4":
			// OK: the immer way
			draft.userCount += 1
			draft.users.push(action.payload)
			return
	}
})
```

_Note: It is not possible to return `undefined` this way, as it is indistinguishable from *not* updating the draft! Read on..._

## Producing `undefined` using `nothing`

So, in general, one can replace the current state by just `return`ing a new value from the producer, rather than modifying the draft. There is a subtle edge case however: if you try to write a producer that wants to replace the current state with `undefined`:

```javascript
produce({}, draft => {
	// don't do anything
})
```

Versus:

```javascript
produce({}, draft => {
	// Try to return undefined from the producer
	return undefined
})
```

The problem is that in JavaScript a function that doesn't return anything also returns `undefined`! So immer cannot differentiate between those different cases. So, by default, Immer will assume that any producer that returns `undefined` just tried to modify the draft.

However, to make it clear to Immer that you intentionally want to produce the value `undefined`, you can return the built-in token `nothing`:

```javascript
import produce, {nothing} from "immer"

const state = {
	hello: "world"
}

produce(state, draft => {})
produce(state, draft => undefined)
// Both return the original state: { hello: "world"}

produce(state, draft => nothing)
// Produces a new state, 'undefined'
```

N.B. Note that this problem is specific for the `undefined` value, any other value, including `null`, doesn't suffer from this issue.

## Inline shortcuts using `void`

<details>
    <summary style="color: white; background:#c200c2;padding:5px;margin:5px;border-radius:2px">egghead.io lesson 10: Avoid accidental returns by using _void_</summary>
    <br>
    <div style="padding:5px;">
        <iframe style="border: none;" width=760 height=427 scrolling="no" src="https://egghead.io/lessons/react-avoid-accidental-returns-of-new-state-by-using-the-void-keyword/embed" ></iframe>
    </div>
    <a style="font-style:italic;padding:5px;margin:5px;"  href="https://egghead.io/lessons/react-avoid-accidental-returns-of-new-state-by-using-the-void-keyword">Hosted on egghead.io</a>
</details>

Draft mutations in Immer usually warrant a code block, since a return denotes an overwrite. Sometimes that can stretch code a little more than you might be comfortable with.

In such cases, you can use javascripts [`void`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/void) operator, which evaluates expressions and returns `undefined`.

```javascript
// Single mutation
produce(draft => void (draft.user.age += 1))

// Multiple mutations
produce(draft => void ((draft.user.age += 1), (draft.user.height = 186)))
```

Code style is highly personal, but for code bases that are to be understood by many, we recommend to stick to the classic `draft => { draft.user.age += 1}` to avoid cognitive overhead.
