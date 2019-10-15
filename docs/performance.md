---
id: performance
title: Immer performance
---

<div id="codefund"><!-- fallback content --></div>

Here is a [simple benchmark](https://github.com/immerjs/immer/blob/master/__performance_tests__/todo.js) on the performance of Immer. This test takes 50,000 todo items and updates 5,000 of them. _Freeze_ indicates that the state tree has been frozen after producing it. This is a _development_ best practice, as it prevents developers from accidentally modifying the state tree.

Something that isn't reflected in the numbers above, but in reality, Immer is sometimes significantly _faster_ than a hand written reducer. The reason for that is that Immer will detect "no-op" state changes, and return the original state if nothing actually changed, which can avoid a lot of re-renderings for example. Cases are known where simply applying immer solved critical performance issues.

These tests were executed on Node 10.15.1. Use `yarn test:perf` to reproduce them locally.

![performance.png](/immer/img/performance.png)

Most important observation:

- Immer with proxies is roughly speaking twice to three times slower as a handwritten reducer (the above test case is worst case, see `yarn test:perf` for more tests). This is in practice negligible.
- Immer is roughly as fast as ImmutableJS. However, the _immutableJS + toJS_ makes clear the cost that often needs to be paid later; converting the immutableJS objects back to plain objects, to be able to pass them to components, over the network etc... (And there is also the upfront cost of converting data received from e.g. the server to immutable JS)
- Generating patches doesn't significantly slow down immer
- The ES5 fallback implementation is roughly twice as slow as the proxy implementation, in some cases worse.
