---
id: pitfalls
title: Pitfalls
---

<div id="codefund"><!-- fallback content --></div>

1. Don't redefine draft like, `draft = myCoolNewState`. Instead, either modify the `draft` or return a new state. See [Returning data from producers](#returning-data-from-producers).
1. Immer assumes your state to be a unidirectional tree. That is, no object should appear twice in the tree, and there should be no circular references.
1. Since Immer uses proxies, reading huge amounts of data from state comes with an overhead (especially in the ES5 implementation). If this ever becomes an issue (measure before you optimize!), do the current state analysis before entering the producer function or read from the `currentState` rather than the `draftState`. Also, realize that immer is opt-in everywhere, so it is perfectly fine to manually write super performance critical reducers, and use immer for all the normal ones. Also note that `original` can be used to get the original state of an object, which is cheaper to read.
1. Always try to pull `produce` 'up', for example `for (let x of y) produce(base, d => d.push(x))` is exponentially slower than `produce(base, d => { for (let x of y) d.push(x)})`
1. It is possible to return values from producers, except, it is not possible to return `undefined` that way, as it is indistinguishable from not updating the draft at all! If you want to replace the draft with `undefined`, just return `nothing` from the producer.
