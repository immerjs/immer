# Immer

_Create the next immutable state tree by simply modifying the current tree_

---

[![Build Status](https://travis-ci.org/mweststrate/immer.svg?branch=master)](https://travis-ci.org/mweststrate/immer)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://github.com/prettier/prettier)

![npm install immer](https://nodei.co/npm/immer.png?downloadRank=true&downloads=true)

* CDN:
- https://unpkg.com/immer/immer.js

Immer (German for: always) is a tiny package that allows you to work with immutable state in a more convenient way.
It is based on the [_copy-on-write_](https://en.wikipedia.org/wiki/Copy-on-write) mechanism.

The basic idea is that you will apply all your changes to a temporarily _draftState_, which is a proxy of the _currentState_.
Once all your mutations are completed, immer will produce the _nextState_ based on the mutations to the draft state.
This means that you can interact with your data by simply modifying it, while keeping all the benefits of immutable data.

![immer.png](immer.png)

Using immer is like having a personal assistant; he takes a letter (the current state), and gives you a copy (draft) to jot changes onto. Once you are done, the assistant will take your draft and produce the real immutable, final letter for you (the next state).

A mindful reader might notice that this is quite similar to `withMutations` of ImmutableJS. It is indeed, but generalized and applicable to plain, native JavaScript data structures (arrays and objects) without further needing any library.

## Installation

`npm install immer`

## API

The immer package exposes a single function:

`immer(currentState, fn: (draftState) => void): nextState`

## Example

```javascript
import immer from "immer"

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

const nextState = immer(baseState, draftState => {
    draftState.push({ todo: "Tweet about it" })
    draftState[1].done = true
})
```

The interesting thing about `immer` is that, the `baseState` will be untouched, but the `nextState` will reflect all changes made to `draftState`.

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

## Using immer on older JavaScript environments

By default `immer` tries to use proxies for optimal performance.
However, on older JavaScript engines `Proxy` is not available.
For example, Microsoft Internet Explorer or React Native on Android.
In these cases, import the ES5 compatibile implementation first, which is a bit slower (see below) but semantically equivalent:

```javascript
import immer from "immer/es5"
```

## Benefits

* Use the language© to construct create your next state
* Use JavaScript native arrays and object
* Automatic immutability; any state tree produced by `immer` will by defualt be deeply frozen
* Strongly typed, no string based paths etc
* Deep updates are trivial
* Small, dependency free library with minimal api surface
* No accidental mutations of current state, but intentional mutations of a draft state

## Auto freezing

 Immer automatically freezes any state trees that are modified using `immer.
 This protects against accidental modifications of the state tree outside of an immer function.
 This comes with a performance impact, so it is recommended to disable this option in production.
 It is by default enabled.

 Use `setAutoFreeze(true / false)` to turn this feature on or off.

## Reducer Example

Here is a simple example of the difference that this approach could make in practice.
The todo reducers from the official Redux [todos-with-undo example](https://codesandbox.io/s/github/reactjs/redux/tree/master/examples/todos-with-undo)

_Note, this is just a sample application of the `immer` package. Immer is not just designed to simplify Redux reducers. It can be used in any context where you have an immutable data tree that you want to clone and modify (with structural sharing)_

```javascript
const todo = (state, action) => {
  switch (action.type) {
    case 'ADD_TODO':
      return {
        id: action.id,
        text: action.text,
        completed: false
      }
    case 'TOGGLE_TODO':
      if (state.id !== action.id) {
        return state
      }

      return {
        ...state,
        completed: !state.completed
      }
    default:
      return state
  }
}

const todos = (state = [], action) => {
  switch (action.type) {
    case 'ADD_TODO':
      return [
        ...state,
        todo(undefined, action)
      ]
    case 'TOGGLE_TODO':
      return state.map(t =>
        todo(t, action)
      )
    default:
      return state
  }
}
```

After using immer, that simply [becomes](https://codesandbox.io/s/xl11qpo9mp):

```javascript
import immer from 'immer'

const todos = (state = [], action) =>
  // immer produces nextState from draftState and returns it
  immer(state, draftState => {
    switch (action.type) {
      case 'ADD_TODO':
        draftState.push({
          id: action.id,
          text: action.text,
          completed: false
        })
        return
      case 'TOGGLE_TODO':
        const todo = draftState.find(todo => todo.id === action.id)
        todo.completed = !todo.completed
        return
    }
  })
```

Creating middleware or a reducer wrapper that applies `immer` automatically is left as exercise for the reader :-).

---

Here are some typical reducer examples, take from the Redux [Immutable Update Patterns](https://redux.js.org/docs/recipes/reducers/ImmutableUpdatePatterns.html) page, and their immer counter part.
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
    return immer(array, draft => {
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
    return immer(array, draft => {
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
    return immer(array, draft => {
        draft[action.index] = { ...item, ...action.item}
        // Alternatively, since arbitrarily deep updates are supported:
        // Object.assign(draft[action.index], action.item)
    })
}
```

## Performance

Here is a [simple benchmark](__tests__/performance.js) on the performance of `immer`.
This test takes 100.000 todo items, and updates 10.000 of them.
These tests were executed on Node 8.4.0.

Use `yarn test:perf`  to reproduce them locally

```
    ✓ just mutate (3ms)
       (No immutability at all)
    ✓ deepclone, then mutate (409ms)
       (Clone entire tree, then mutate (no structural sharing!))
    ✓ handcrafted reducer (17ms)
       (Implement it as typical Redux reducer, with slices and spread operator)
    ✓ immutableJS (60ms)
       (Use immutableJS and leverage `withMutations` for best performance)
    ✓ immer (proxy) - with autofreeze (305ms)
       (Immer, with auto freeze enabled, default implementation)
    ✓ immer (proxy) - without autofreeze (149ms)
       (Immer, with auto freeze disabled, default implementation)
    ✓ immer (es5) - with autofreeze (436ms)
       (Immer, with auto freeze enabled, compatibility implementation)
    ✓ immer (es5) - without autofreeze (336ms)
       (Immer, with auto freeze disabled, default implementation)
```

## Limitations

* Currently, only tree shaped states are supported. Cycles could potentially be supported as well (PR's welcome)
* Currently, only supports plain objects and arrays. Non-plain data structures (like `Map`, `Set`) not (yet). (PR's welcome)

## Pitfalls:

* Make sure to modify the draft state you get passed in in the callback function, not the original current state that was passed as the first argument to `immer`!
* Since immer uses proxies, reading huge amounts of data from state comes with an overhead. If this ever becomes an issue (measure before you optimize!), do the current state analysis before entering the `immer` block or read from the `currentState` rather than the `draftState`

## Credits

Special thanks goes to @Mendix, which supports it's employees to experiment completely freely two full days a month, which formed the kick-start for this project.