---
id: performance
title: Immer performance
---

<div id="codefund"><!-- fallback content --></div>

<details>
    <summary style="color: white; background:#c200c2;padding:5px;margin:5px;border-radius:2px">egghead.io lesson 5: Leveraging Immer's structural sharing in React</summary>
    <br>
    <div style="padding:5px;">
        <iframe style="border: none;" width=760 height=427 scrolling="no" src="https://egghead.io/lessons/react-profile-react-rendering-and-optimize-with-memo-to-leverage-structural-sharing/embed" ></iframe>
    </div>
    <a style="font-style:italic;padding:5px;margin:5px;"  href="https://egghead.io/lessons/react-profile-react-rendering-and-optimize-with-memo-to-leverage-structural-sharing">Hosted on egghead.io</a>
</details>

<details>
    <summary style="color: white; background:#c200c2;padding:5px;margin:5px;border-radius:2px">egghead.io lesson 7: Immer will try to re-cycle data if there was no semantic change</summary>
    <br>
    <div style="padding:5px;">
        <iframe style="border: none;" width=760 height=427 scrolling="no" src="https://egghead.io/lessons/javascript-produces-immutable-data-and-avoid-unnecessary-creation-of-new-data-trees-with-immer/embed" ></iframe>
    </div>
    <a style="font-style:italic;padding:5px;margin:5px;"  href="https://egghead.io/lessons/javascript-produces-immutable-data-and-avoid-unnecessary-creation-of-new-data-trees-with-immer">Hosted on egghead.io</a>
</details>

Here is a [simple benchmark](https://github.com/immerjs/immer/blob/master/__performance_tests__/todo.js) on the performance of Immer. This test takes 50,000 todo items and updates 5,000 of them. _Freeze_ indicates that the state tree has been frozen after producing it. This is a _development_ best practice, as it prevents developers from accidentally modifying the state tree.

Something that isn't reflected in the numbers above, but in reality, Immer is sometimes significantly _faster_ than a hand written reducer. The reason for that is that Immer will detect "no-op" state changes, and return the original state if nothing actually changed, which can avoid a lot of re-renderings for example. Cases are known where simply applying immer solved critical performance issues.

These tests were executed on Node 10.16.3. Use `yarn test:perf` to reproduce them locally.

![performance.png](/immer/img/performance.png)

Most important observation:

- Immer with proxies is roughly speaking twice to three times slower as a handwritten reducer (the above test case is worst case, see `yarn test:perf` for more tests). This is in practice negligible.
- Immer is roughly as fast as ImmutableJS. However, the _immutableJS + toJS_ makes clear the cost that often needs to be paid later; converting the immutableJS objects back to plain objects, to be able to pass them to components, over the network etc... (And there is also the upfront cost of converting data received from e.g. the server to immutable JS)
- Generating patches doesn't significantly slow down immer
- The ES5 fallback implementation is roughly twice as slow as the proxy implementation, in some cases worse.

## Performance tips

- When adding a large data set to the state tree in an Immer producer (for example data received from a JSON endpoint), it is worth to cool `Object.freeze(json)` on the root of the data to be added first. This will allow Immer to add the new data to the tree faster, as it will skeeping freezing it, or searching the tree for any changes (drafts) that might be made.
- Immer will convert anything you read in a draft recursively into a draft as well. If you have expensive side effect free operations on a draft that involves a lot of reading, for example finding an index using `find(Index)` in a very large array, you can speed this up by first doing the search, and only call the `produce` function once you know the index. Thereby preventing Immer to turn everything that was searched for in a draft. Or, perform the search on the original value of a draft, by using `original(someDraft)`, which boils to the same thing.
- Always try to pull produce 'up', for example `for (let x of y) produce(base, d => d.push(x))` is exponentially slower than `produce(base, d => { for (let x of y) d.push(x)})`
