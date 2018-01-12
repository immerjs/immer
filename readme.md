# Immer

[![Build Status](https://travis-ci.org/mweststrate/immer.svg?branch=master)](https://travis-ci.org/mweststrate/immer)
[![Coverage Status](https://coveralls.io/repos/github/mweststrate/immer/badge.svg?branch=master)](https://coveralls.io/github/mweststrate/immer?branch=master)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://github.com/prettier/prettier)
[![Donate](https://img.shields.io/badge/Donate-PayPal-green.svg)](https://mobx.js.org/donate.html)

_Create the next immutable state tree by simply modifying the current tree_

---

* NPM / Yarn: `npm install immer`
* CDN: https://unpkg.com/immer/dist/immer.umd.js or https://unpkg.com/immer/dist/es5.umd.js. Exposed global is `immer`.

---

* Egghead lesson covering all of immer (7m): [Simplify creating immutable data trees with Immer](https://egghead.io/lessons/redux-simplify-creating-immutable-data-trees-with-immer)
* Introduction blogpost: [Immer: Immutability the easy way](https://medium.com/@mweststrate/introducing-immer-immutability-the-easy-way-9d73d8f71cb3)

Immer (German for: always) is a tiny package that allows you to work with immutable state in a more convenient way.
It is based on the [_copy-on-write_](https://en.wikipedia.org/wiki/Copy-on-write) mechanism.

The basic idea is that you will apply all your changes to a temporarily _draftState_, which is a proxy of the _currentState_.
Once all your mutations are completed, Immer will produce the _nextState_ based on the mutations to the draft state.
This means that you can interact with your data by simply modifying it, while keeping all the benefits of immutable data.

![immer-hd.png](images/hd/immer.png)

Using Immer is like having a personal assistant; he takes a letter (the current state), and gives you a copy (draft) to jot changes onto. Once you are done, the assistant will take your draft and produce the real immutable, final letter for you (the next state).

A mindful reader might notice that this is quite similar to `withMutations` of ImmutableJS. It is indeed, but generalized and applied to plain, native JavaScript data structures (arrays and objects) without further needing any library.

## API

The Immer package exposes a default function that does all the work.

`produce(currentState, producer: (draftState) => void): nextState`

There is also a curried overload that is explained [below](#currying)

## Example

```javascript
import produce from "immer"

const baseState = [
    {
        todo: "Learn typescript",
        done: true
    },
    {
        todo: "Try immer",
        done: false
    }
]

const nextState = produce(baseState, draftState => {
    draftState.push({ todo: "Tweet about it" })
    draftState[1].done = true
})
```

The interesting thing about Immer is that the `baseState` will be untouched, but the `nextState` will reflect all changes made to `draftState`.

```javascript
// the new item is only added to the next state,
// base state is unmodified
expect(baseState.length).toBe(2)
expect(nextState.length).toBe(3)

// same for the changed 'done' prop
expect(baseState[1].done).toBe(false)
expect(nextState[1].done).toBe(true)

// unchanged data is structurally shared
expect(nextState[0]).toBe(baseState[0])
// changed data not (dûh)
expect(nextState[1]).not.toBe(baseState[1])
```

## Benefits

* Immutability with normal JavaScript objects and arrays. No new APIs to learn!
* Strongly typed, no string based paths selectors etc.
* Structural sharing out of the box
* Object freezing out of the box
* Deep updates are a breeze
* Boilerplate reduction. Less noise, more concise code.

Read further to see all these benefits explained.

## Reducer Example

Here is a simple example of the difference that Immer could make in practice.

```javascript
// Redux reducer
// Shortened, based on: https://github.com/reactjs/redux/blob/master/examples/shopping-cart/src/reducers/products.js
const byId = (state, action) => {
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

After using Immer, that simply becomes:

```javascript
import produce from 'immer'

const byId = (state, action) =>
  produce(state, draft => {
    switch (action.type) {
      case RECEIVE_PRODUCTS:
        action.products.forEach(product => {
          draft[product.id] = product
        })
    }
  })
```

Notice that it is not needed to handle the default case, a producer that doesn't do anything will simply return the original state.

Creating Redux reducer is just a sample application of the Immer package.
Immer is not just designed to simplify Redux reducers.
It can be used in any context where you have an immutable data tree that you want to clone and modify (with structural sharing).

_Note: it might be tempting after using producers a while, to just put `produce` in your root reducer, and then past the draft along to each reducer and work on that. Don't do that. It kills the point of Redux where each reducer is testable as pure reducer. Immer is best used when applying it to small individual pieces of logic._

## Currying

`produce` can be called with one or two arguments.
The one argument version is intended to be used as currying. This means that you get a pre-pound producer, that only needs a state to produce the value from.
The producer function get's passed in the draft, and any further arguments that were passed to the curried function.

For example:

```javascript
// mapper will be of signature (state, index) => state
const mapper = produce((draft, index) => {
    draft.index = index
})

// example usage
console.dir([{}, {}, {}].map(mapper))
//[{index: 0}, {index: 1}, {index: 2}])
```

This mechanism can also nicely be leveraged to further simplify our example reducer:

```javascript
import produce from 'immer'

const byId = produce((draft, action) => {
  switch (action.type) {
    case RECEIVE_PRODUCTS:
    action.products.forEach(product => {
        draft[product.id] = product
    })
  }
})
```

Note that `state` is now factored out (the created reducer will accept a state, and invoke the bound producer with it).
One think to keep in mind; you cannot use this construction to initialize an uninitialized state. E.g. `draft = {}` doesn't do anything useful.


## Auto freezing

 Immer automatically freezes any state trees that are modified using `produce`.
 This protects against accidental modifications of the state tree outside of a producer.
 This comes with a performance impact, so it is recommended to disable this option in production.
 It is by default enabled.
 Use `setAutoFreeze(true / false)` to turn this feature on or off.

## Using Immer on older JavaScript environments

By default `produce` tries to use proxies for optimal performance.
However, on older JavaScript engines `Proxy` is not available.
For example, Microsoft Internet Explorer or React Native on Android.
In such cases Immer will fallback to an ES5 compatible implementation which works identical, but is a bit slower.
However, if you want to slim down your bundle, you could only include the Proxy based implementation by importing from `immer/proxy`.

An overview of the available builds:

Immer exposes its functionality in 3 different ways:
* `import produce from "immer"`, the default, ships with both the Proxy and ES5 compatible implementation, and picks at runtime the best matching one. This is the most convenient, but adds the most to the bundle size (~2KB)
* `import produce from "immer/proxy"`: This build is optimized for modern browser, which support Proxies and other modern language features, and doesn't polyfill things like `Symbol`. Use this if you are targetting a modern environment only
* `import produce from "immer/es5"`: Only bundle the ES5 compatible implementation (which of course also works for modern browsers)

## More reducer examples

Here are some typical reducer examples, take from the Redux [Immutable Update Patterns](https://redux.js.org/docs/recipes/reducers/ImmutableUpdatePatterns.html) page, and their Immer counter part.
These examples are semantically equivalent and produce the exact same state.

```javascript
// Plain reducer
function insertItem(array, action) {
    return [
        ...array.slice(0, action.index),
        action.item,
        ...array.slice(action.index)
    ]
}

// With immer
function insertItem(array, action) {
    return produce(array, draft => {
        draft.splice(action.index, 0, action.item)
    })
}

// Plain reducer
function removeItem(array, action) {
    return [
        ...array.slice(0, action.index),
        ...array.slice(action.index + 1)
    ];
}

// With immer
function removeItem(array, action) {
    return produce(array, draft => {
        draft.splice(action.index, 1)
    })
}

// Plain reducer
function updateObjectInArray(array, action) {
    return array.map( (item, index) => {
        if(index !== action.index) {
            // This isn't the item we care about - keep it as-is
            return item;
        }

        // Otherwise, this is the one we want - return an updated value
        return {
            ...item,
            ...action.item
        };
    });
}

// With immer
function updateObjectInArray(array, action) {
    return produce(array, draft => {
        draft[action.index] = { ...item, ...action.item}
        // Alternatively, since arbitrarily deep updates are supported:
        // Object.assign(draft[action.index], action.item)
    })
}
```

## Pitfalls

* Currently, Immer only supports plain objects and arrays. PRs are welcome for more language built-in types like `Map` and `Set`.
* Immer only processes native arrays and plain objects (with a prototype of `null` or `Object`). Any other type of value will be treated verbatim! So if you modify a `Map` or `Buffer`  or whatever complex object from the draft state, it will be that very same object in both the base state as the next state. In such cases, make sure to always produce fresh instances if you want to keep your state truly immutable.
* Since Immer uses proxies, reading huge amounts of data from state comes with an overhead (especially in the ES5 implementation). If this ever becomes an issue (measure before you optimize!), do the current state analysis before entering the producer function or read from the `currentState` rather than the `draftState`
* Some debuggers (at least Node 6 is known) have trouble debugging when Proxies are in play. Node 8 is known to work correctly.

## How does Immer work?

Read the (second part of the) [introduction blog](https://medium.com/@mweststrate/introducing-immer-immutability-the-easy-way-9d73d8f71cb3).

## Performance

Here is a [simple benchmark](__performance_tests__/todo.js) on the performance of Immer.
This test takes 100.000 todo items, and updates 10.000 of them.
_Freeze_ indicates that the state tree has been frozen after producing it. This is a _development_ best practice, as it prevents developers from accidentally modifying the state tree.

These tests were executed on Node 8.4.0.
Use `yarn test:perf`  to reproduce them locally.

![performance.png](images/performance.png)

Some observations:
* The _mutate_, and _deepclone, mutate_ benchmarks establish a baseline on how expensive changing the data is, without immutability (or structural sharing in the deep clone case).
* The _reducer_ and _naive reducer_ are implemented in typical Redux style reducers. The "smart" implementation slices the collection first, and then maps and freezes only the relevant todos. The "naive" implementation just maps over and processes the entire collection.
* Immer with proxies is roughly speaking twice as slow as a hand written reducer. This is in practice negligible.
* Immer is roughly as fast as ImmutableJS. However, the _immutableJS + toJS_ makes clear the cost that often needs to be paid later; converting the immutableJS objects back to plain objects, to be able to pass them to components, over the network etc... (And there is also the upfront cost of converting data received from e.g. the server to immutable JS)
* The ES5 implementation of Immer is significantly slower. For most reducers this won't matter, but reducers that process large amounts of data might benefit from not (or only partially) using an Immer producer. Luckily, Immer is fully opt-in.
* The peeks in the _frozen_ versions of _just mutate_, _deepclone_ and _naive reducer_ come from the fact that they recursively freeze the full state tree, while the other test cases only freeze the modified parts of the tree.

## Credits

Special thanks goes to @Mendix, which supports it's employees to experiment completely freely two full days a month, which formed the kick-start for this project.

## Donations

A significant part of my OSS work is unpaid. So [donations](https://mobx.js.org/donate.html) are greatly appreciated :)
