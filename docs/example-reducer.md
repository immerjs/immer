---
id: example-reducer
title: Example Reducer
---

<div id="codefund"><!-- fallback content --></div>

<details>
    <summary style="color: white; background:#c200c2;padding:5px;margin:5px;border-radius:2px">egghead.io lesson 13: Using Immer in a (React) reducer</summary>
    <br>
    <div style="padding:5px;">
        <iframe style="border: none;" width=760 height=427 scrolling="no" src="https://egghead.io/lessons/react-update-immutable-state-with-react-usereducer-through-immer/embed" ></iframe>
    </div>
    <a style="font-style:italic;padding:5px;margin:5px;"  href="https://egghead.io/lessons/react-update-immutable-state-with-react-usereducer-through-immer">Hosted on egghead.io</a>
</details>

Here is a simple example of the difference that Immer could make in practice.

```javascript
// Redux reducer
// Shortened, based on: https://github.com/reactjs/redux/blob/master/examples/shopping-cart/src/reducers/products.js
const byId = (state = {}, action) => {
	switch (action.type) {
		case RECEIVE_PRODUCTS:
			return {
				...state,
				...action.products.reduce((obj, product) => {
					obj[product.id] = product
					return obj
				}, {})
			}
		default:
			return state
	}
}
```

After using Immer, our reducer can be expressed as:

```javascript
import produce from "immer"

const byId = produce((draft, action) => {
	switch (action.type) {
		case RECEIVE_PRODUCTS:
			action.products.forEach(product => {
				draft[product.id] = product
			})
	}
}, {})
```

Notice that it is not necessary to handle the default case, a producer that doesn't do anything will return the original state.

Creating Redux reducer is just a sample application of the Immer package. Immer is not just designed to simplify Redux reducers. It can be used in any context where you have an immutable data tree that you want to clone and modify (with structural sharing).

_Note: it might be tempting after using producers for a while, to just place `produce` in your root reducer and then pass the draft to each reducer and work directly over said draft. Don't do that. It removes the benefit of using Redux as a system where each reducer is testable as a pure function. Immer is best used when applied to small, individual pieces of logic._
