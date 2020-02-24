---
id: pitfalls
title: Pitfalls
---

<div id="codefund"><!-- fallback content --></div>

1. Don't redefine draft like, `draft = myCoolNewState`. Instead, either modify the `draft` or return a new state. See [Returning data from producers](https://immerjs.github.io/immer/docs/return).
1. Immer assumes your state to be a unidirectional tree. That is, no object should appear twice in the tree, and there should be no circular references.
1. Since Immer uses proxies, reading huge amounts of data from state comes with an overhead (especially in the ES5 implementation). If this ever becomes an issue (measure before you optimize!), do the current state analysis before entering the producer function or read from the `currentState` rather than the `draftState`. Also, realize that immer is opt-in everywhere, so it is perfectly fine to manually write super performance critical reducers, and use immer for all the normal ones. Also note that `original` can be used to get the original state of an object, which is cheaper to read.
1. Always try to pull `produce` 'up', for example `for (let x of y) produce(base, d => d.push(x))` is exponentially slower than `produce(base, d => { for (let x of y) d.push(x)})`
1. It is possible to return values from producers, except, it is not possible to return `undefined` that way, as it is indistinguishable from not updating the draft at all! If you want to replace the draft with `undefined`, just return `nothing` from the producer.
1. Immer [does not support exotic objects](https://github.com/immerjs/immer/issues/504) such as window.location.
1. You will need to enable your own classes to work properly with Immer. For docs on the topic, check out the section on [working with complex objects](https://immerjs.github.io/immer/docs/complex-objects).
1. Note that data that comes from the closure, and not from the base state, will never be drafted, even when the data has become part of the new draft:

```javascript
function onReceiveTodo(todo) {
	const nextTodos = produce(todos, draft => {
		draft.todos[todo.id] = todo
		// Note, because 'todo' is coming from external, and not from the 'draft',
		// it isn't draft so the following modification affects the original todo!
		draft.todos[todo.id].done = true

		// The reason for this, is that it means that the behavior of the 2 lines above
		// is equivalent to code, making this whole process more consistent
		todo.done = true
		draft.todos[todo.id] = todo
	})
}
```
