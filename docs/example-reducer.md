---
id: example-reducer
title: Example Reducer
---

<div id="codefund"></div>

Here is a simple example of the difference that Immer can make in practice.

```javascript
// Standard Redux reducer
const myReducer = (state, action) => {
	switch (action.type) {
		case SET_MY_PROPERTY:
			return {
				...state,
				myProperty: action.myProperty,
			}
		default:
			return state
	}
}
```

After using Immer, our reducer can be expressed simply as:

```javascript
// Redux reducer with Immer
import produce from "immer"

const myReducer = produce((draft, action) => {
	switch (action.type) {
		case SET_MY_PROPERTY:
			draft.myProperty = action.myProperty
			break
	}
})
```

Notice that it is not necessary to handle the default case, a producer that doesn't do anything will simply return the original state.

Creating Redux reducer is just a sample application of the Immer package. Immer is not just designed to simplify Redux reducers. It can be used in any context where you have an immutable data tree that you want to clone and modify (with structural sharing).

_Note: it might be tempting after using producers for a while, to just place `produce` in your root reducer and then pass the draft to each reducer and work directly over said draft. Don't do that. It removes the benefit of using Redux as a system where each reducer is testable as a pure function. Immer is best used when applied to small, individual pieces of logic._
