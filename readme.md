# Immer

_Your personally assistance for creating your next immutable state_

---

Immer (German for: always) is a tiny package that allows you work with immutable state in a more convenient way.
It is based on [_copy-on-write_](https://en.wikipedia.org/wiki/Copy-on-write) mechanism.

The basic idea is that you will apply all your changes to a _draftState_. Which is a proxy of the _currentState_, and once all your mutations are completed, immer will produce the _nextState_ based on the mutations to the draft state. This means that you can interact with your data by simply modifying it, while keeping all the benefits of immutable data.

<center>

![immer.png](immer.png)

Using immer is like having a personal assistant; he takes a letter (the current state), and gives you a copy (draft) to jod changes onto. Once you are done the assistant will take your draft and produce the real immutable, final letter for you (the next state).
</center>

## API

The immer package exposes a single function:

`immer(currentState, fn: (draftState) => void): nextState`

## Example

```javascript
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

The interesting thing about `immer` is that `baseState` will be untouched, but that `nextState` will reflect all changes made to `draftState`.

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

* Use the language© to construct create your next state
* Strongly typed, no string based paths etc
* Deep updates are trivial
* Small, dependency free library with minimal api surface
* No accidental mutations of current state, but intentional mutations of a draft state

## Reducer Example

A lot of words; here is a simple example of what difference that could make in practice.
The todo reducers from the official Redux [todos-with-undo example](https://codesandbox.io/s/github/reactjs/redux/tree/master/examples/todos-with-undo)

_Note, this is just a sample application of the `immer` package. Immer is design to just simply Redux reducers. It can be used in any context where you have an immutable data tree that you want to clone and modify (with structural sharing)_

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

Creating middleware or reducer wrapper that applies `immer` automatically is left as exercise to the reader :-).

## Limitations

* This package requires Proxies, so Safari > 10, no Internet Explorer
* Currently only tree shaped states are supported. Cycles could potentially be supported as well (PR's welcome)
* Currently only supports plain objects and arrays. Non-plain data structures (like `Map`, `Set`) not (yet). (PR's welcome)

## Pitfalls:

* Make sure to modify the state you get passed in in the callback function, not the original base state that was passed as first argument to `immer`!
* Since immer uses proxies, reading huge amounts of data from state comes with an overhead. If this ever becomes an issue (measure before optimize!), do the current state analysis before entering the `immer` block or read form the `currentState` rather than the `draftState`

## Changelog

### 0.0.4 (31-12-2017)

* Added typescript typings [#11](https://github.com/mweststrate/immer/pull/11) by [@benbraou](https://github.com/benbraou)
* Fixed bug when setting properties to `undefined`. Fixes [#12](https://github.com/mweststrate/immer/issues/12) through [#13](https://github.com/mweststrate/immer/pull/13) by [@benbraou](https://github.com/benbraou)