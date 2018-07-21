# Immer

[![npm](https://img.shields.io/npm/v/immer.svg)](https://www.npmjs.com/package/immer) [![size](http://img.badgesize.io/https://cdn.jsdelivr.net/npm/immer/dist/immer.umd.js?compression=gzip)](http://img.badgesize.io/https://cdn.jsdelivr.net/npm/immer/dist/immer.umd.js) [![install size](https://packagephobia.now.sh/badge?p=immer)](https://packagephobia.now.sh/result?p=immer) [![Build Status](https://travis-ci.org/mweststrate/immer.svg?branch=master)](https://travis-ci.org/mweststrate/immer) [![Coverage Status](https://coveralls.io/repos/github/mweststrate/immer/badge.svg?branch=master)](https://coveralls.io/github/mweststrate/immer?branch=master) [![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://github.com/prettier/prettier) [![Donate](https://img.shields.io/badge/Donate-PayPal-green.svg)](https://www.paypal.me/michelweststrate)

_通过简单的修改当前的状态树来创建下一个不可变的状态树_

---

* NPM: `npm install immer`
* Yarn: `yarn add immer`
* CDN: 全局引用 `immer`
  * Unpkg: `<script src="https://unpkg.com/immer/dist/immer.umd.js"></script>`
  * JSDelivr: `<script src="https://cdn.jsdelivr.net/npm/immer/dist/immer.umd.js"></script>`

---

* 通过 Egghead 课程来学习 immer (7m): [Simplify creating immutable data trees with Immer](https://egghead.io/lessons/redux-simplify-creating-immutable-data-trees-with-immer)
* 博客介绍: [Immer: Immutability the easy way](https://medium.com/@mweststrate/introducing-immer-immutability-the-easy-way-9d73d8f71cb3)
* Michel Weststrate 在 2018 年芬兰的 React 会议上对 immer的 [演讲](https://www.youtube.com/watch?v=-gJbS7YjcSo) + [PPT](http://immer.surge.sh/)

Immer (德语为: always) 是一个轻量级的库,允许您更加方便的使用不可变状态. 它基于 [_copy-on-write_](https://en.wikipedia.org/wiki/Copy-on-write) 的机制运行.

其基本思想是将您的所有更改应用于临时的 _draftState_, 它代理了 _currentState_. 当所有的改变都完成了, Immer 将根据 _draftState_ 变化生成 _nextState_. 这意味这您可以通过简单的修改,即可达到目的,同时保留了不可变数据的所有优点.

![immer-hd.png](images/hd/immer.png)

使用 Immer 就像是拥有了一个私人助理,他接到了一封信 (current state), 并给了你一个副本(draft) 来记录改变,当你完成修改, 你的私人助理根据你的改变制作最终不可变的一封信(next state).

有心的读者可能会意识到这与 ImmutableJS 的 `withMutations` 非常相似. 事实上确实如此,但是 Immer 通用于普通的原生 JavaScript 数据结构 (arrays 和 object),而不需要任何其他的库.

## API

Immer 暴露了一个可以完成所有工作的默认函数.

`produce(currentState, producer: (draftState) => void): nextState`

还有一个柯里化后的重载,相关介绍 [currying](#currying).

## 例子

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
    draftState.push({todo: "Tweet about it"})
    draftState[1].done = true
})
```

关于 immer 有趣之处在于 `baseState` 不会被更改,而 `nextState` 将应用 `draftState` 的所有更改. 

```javascript
// 新增的数据将会添加到nextState,
// 而原有的数据将不会被更改
expect(baseState.length).toBe(2)
expect(nextState.length).toBe(3)

// 修改的 done 属性也是一样
expect(baseState[1].done).toBe(false)
expect(nextState[1].done).toBe(true)

// 而没有修改的数据在结构上是共享的
expect(nextState[0]).toBe(baseState[0])
// 修改后的数据不是 (dûh)
expect(nextState[1]).not.toBe(baseState[1])
```

## 优势

* 使用普通的 JavaScript 对象和数组即可实现 Immutability (不可变性),不需要学习新的 API!
* 强类型, 没有字符串路径选择器等.
* 开箱即用的结构共享
* 开箱即用的对象freezing
* 轻而易举的深度更新
* Boilerplate reduction. Less noise, more concise code.
* 小: 打包后体积只有: 2KB.

进一步阅读以了解所有这些好处.

## Reducer 例子

这是 Immer 在实践中对差异的简单例子.

```javascript
// Redux reducer
// 代码片段来自: https://github.com/reactjs/redux/blob/master/examples/shopping-cart/src/reducers/products.js
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

使用 Immer 之后,可以改为这样达成同样的效果:

```javascript
import produce from "immer"

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

请注意,不需要处理switch的默认情况, 没有任何更改的 producer 只会返回原始状态.

创建 Redux reducer 只是 Immer 包的示例应用程序, Immer 不仅仅是为了简化 Redux reducer 而设计的. 您可以在你需要克隆或者修改的不可变数据树的任何上下文中使用(结构共享).

_注意: 在使用一段时间 produce 后会很吸引人, 只需要将 `produce` 放在根 reducer 中, 之后将要修改的 draft 传递给每个 reducer, 直接在这个 draft 上工作. 但是不要这么做,它杀死了 Redux, 因为每个 reducer 都可以作为纯 reducer 进行测试, 在编写小型逻辑时,可以使用 Immer ._

## React.setState 例子

通过使用 Immer, 可以大大简化 React 组件 state 的深度更新,以下面的 onClick处理程序为例 (在[codesandbox](https://codesandbox.io/s/m4yp57632j)尝试):

```javascript
/**
 * 经典的 React.setState 深度合并示例
 */
onBirthDayClick1 = () => {
    this.setState(prevState => ({
        user: {
            ...prevState.user,
            age: prevState.user.age + 1
        }
    }))
}

/**
 * ...但是, 由于 setState 可以接收一个函数作为参数,
 * 我们可以创建一个柯里化后的 produce 进一步简化!
 */
onBirthDayClick2 = () => {
    this.setState(
        produce(draft => {
            draft.user.age += 1
        })
    )
}
```

## Currying(柯里化)

将函数做为第一个参数传递给 `produce` 旨在用于 currying. 这意味着你得到了一个预先绑定的 producer, 这个 produce 通过 state 来生成值. producer 函数在 draft 中传递, 以及传递给柯里化后的函数任何其他参数.

例如:

```javascript
// mapper will be of signature (state, index) => state
const mapper = produce((draft, index) => {
    draft.index = index
})

// 使用示例
console.dir([{}, {}, {}].map(mapper))
//[{index: 0}, {index: 1}, {index: 2}])
```

这个机制也可以很好的利用来进一步简化示例 reducer:

```javascript
import produce from 'immer'

const byId = produce((draft, action) => {
  switch (action.type) {
    case RECEIVE_PRODUCTS:
      action.products.forEach(product => {
        draft[product.id] = product
      })
      return
    })
  }
})
```

注意  `state` 已经被分解了 (创建的 reducer 将接收一个 sate, 并使用它来调用 producer).

如果你想使用这种结构初始化一个未初始化的 state, 你可以将初始化状态作为第二个参数传递给 `produce`:

```javascript
import produce from "immer"

const byId = produce(
    (draft, action) => {
        switch (action.type) {
            case RECEIVE_PRODUCTS:
                action.products.forEach(product => {
                    draft[product.id] = product
                })
                return
        }
    },
    {
        1: {id: 1, name: "product-1"}
    }
)
```

## Auto freezing

Immer Auto freezing使用`produce`修改的任何状态树. 这可以防止对 producer 之外的状态树的以外修改. 这会带来性能影响,因此建议在生产中禁用此选项. 在默认情况下在 development 环境下打开,并在 production 环境下关闭. 您可以使用 `setAutoFreeze(true / false)` 来显式的打开或者关闭此项功能.

## 返回数据的 producers

不需要从 producer 返回任何东西,因为 Immer 将会返回(最终版本)的`draft`, 但是允许只`return draft`.

它允许从 producer 函数中任意返回其他数据. 但是 _只有_ 你没修改 draft, 这对于产生一个全新的 state 很有用, 可以看下面的例子:

```javascript
const userReducer = produce((draft, action) => {
    switch (action.type) {
        case "renameUser":
            // OK: 我们修改当前的状态
            draft.users[action.payload.id].name = action.payload.name
            return draft // 和刚刚一样 'return'
        case "loadUsers":
            // OK: 返回一个全新的 state
            return action.payload
        case "adduser-1":
            // NOT OK: 这个不会改变 draft 也不会返回新的 state!
            // 不会修改  draft (它只是重新声明了它)
            // 事实上这根本不会起作用
            draft = {users: [...draft.users, action.payload]}
            return
        case "adduser-2":
            // NOT OK: 修改 draft *和* 返回一个新的 state
            draft.userCount += 1
            return {users: [...draft.users, action.payload]}
        case "adduser-3":
            // OK: 返回一个新的 state. 但是, 是不必要的复杂和昂贵的
            return {
                userCount: draft.userCount + 1,
                users: [...draft.users, action.payload]
            }
        case "adduser-4":
            // OK: immer 的方法
            draft.userCount += 1
            draft.users.push(action.payload)
            return
    }
})
```

## 使用 `this`

将始终使用 `draft` 作为 `this` 上下文.

这意味这对以下结构也是有效的:

```javascript
const base = {counter: 0}

const next = produce(base, function() {
    this.counter++
})
console.log(next.counter) // 1

// OR
const increment = produce(function() {
    this.counter++
})
console.log(increment(base).counter) // 1
```

## TypeScript or Flow

Immer 包附带了包内的类型定义, TypeScript 和 Flow 开箱即用无需额外的配置 .

## 是否可以在比较老的 JavaScript 环境下使用 Immer ?

在默认情况下 `produce` 尝试使用 `Proxy` 来获取最佳性能. 例如,运行在 Microsoft Internet Explorer 或 React Native 或 Android. 在在这种情况下 Immer 将回退到 ES5 进行兼容他的工作方式相同,但是速度稍慢.

## 陷阱

1. 不要像 `draft = myCoolNewState` 一样重新定义 draft .相反要么修改 `draft` 或者返回一个新的 state . 请参阅 [Returning data from producers](#returning-data-from-producers).
2. 目前, Immer 仅支持普通的 objects and arrays. 欢迎 PR 提供更更多内置类型,例如 `Map` 和 `Set`.
3. Immer 只处理原生数组和普通对象 (prototype 为 `null` 或 `Object`). 其他任何类型的值将被逐字处理! 因此您要求改 `Map` 或 `Buffer` (或 draft state 中的任何复杂对象),则更改将保持不变. 但是, 无论是在新旧 state! 因此, 这种情况下, 如果您希望保持您的状态真正不可变,请确保始终生成新的实例.
4. 例如, 使用 `Date` 对象是没有问题的, 只要确保你的永远不会修改他们(通过在现有实例上使用`setYear`这样的方法). 相反, 始终创建新的`Date` 实例. 这可能是无意识的做的事情.
5. 由于 Immer 使用代理, 从 state 中读取大量数据会带来性能开销(特别是在 ES5 中的实现). 如果这成为一个问题(优化之前的测量!), 应该 producer 函数中从`currentState`中读取数据,而不是从`draftState`中读取数据.
6. 一些调试器 (至少在 Node 6 中一直) 在 Proxies 运行时无法调试. 已知 Node 8 中工作正常.

## 使用 immer 制作的炫酷项目

* [react-copy-write](https://github.com/aweary/react-copy-write) _Immutable state with a mutable API_
* [redux-starter-kit](https://github.com/markerikson/redux-starter-kit) _A simple set of tools to make using Redux easier_
* [immer based handleActions](https://gist.github.com/kitze/fb65f527803a93fb2803ce79a792fff8) _Boilerplate free actions for Redux_
* [redux-box](https://github.com/anish000kumar/redux-box) _Modular and easy-to-grasp redux based state management, with least boilerplate_
* [quick-redux](https://github.com/jeffreyyoung/quick-redux) _tools to make redux developement quicker and easier_
* [bey](https://github.com/jamiebuilds/bey) _Simple immutable state for React using Immer_
* ... and [many more](https://www.npmjs.com/browse/depended/immer)

## Immer 是如何进行工作的?

阅读 (第二部分) [介绍博客](https://medium.com/@mweststrate/introducing-immer-immutability-the-easy-way-9d73d8f71cb3).

## 实例模式.

_对于那些不得不重新考虑对象更新的人 :-)_

```javascript
import produce from "immer"

// 对象转变
const todosObj = {
    id1: {done: false, body: "Take out the trash"},
    id2: {done: false, body: "Check Email"}
}

// 增加
const addedTodosObj = produce(todosObj, draft => {
    draft["id3"] = {done: false, body: "Buy bananas"}
})

// 删除
const deletedTodosObj = produce(todosObj, draft => {
    delete draft["id1"]
})

// 更新
const updatedTodosObj = produce(todosObj, draft => {
    draft["id1"].done = true
})

// array 更变
const todosArray = [
    {id: "id1", done: false, body: "Take out the trash"},
    {id: "id2", done: false, body: "Check Email"}
]

// 新增
const addedTodosArray = produce(todosArray, draft => {
    draft.push({id: "id3", done: false, body: "Buy bananas"})
})

// 删除
const deletedTodosArray = produce(todosArray, draft => {
    draft.splice(draft.findIndex(todo => todo.id === "id1"), 1)
    // or (slower):
    // return draft.filter(todo => todo.id !== "id1")
})

// 更新
const updatedTodosArray = produce(todosArray, draft => {
    draft[draft.findIndex(todo => todo.id === "id1")].done = true
})
```

## 性能

这是一个关于 Immer 性能的[简单基准测试](__performance_tests__/todo.js). 这个测试测试 100.000 todo items, 更新其中的 10.000 them. _Freeze_ 表示状态树在生成后已经被freezing. 这是一个 _development_ 最佳实践, 因为他可以防止开发人员以外的修改状态树.

这个测试实在 Node 8.4.0 进行的. 使用 `yarn test:perf` 在本地进行重现.

![performance.png](images/performance.png)

一些观察结果:

* 从 `immer` 的角度来看, 这个基准测试是一个 _worst case_(最坏清空) 场景, 因为他必须代理的根集合相对其余的数据来说真的很大.
* 这个 _mutate_, 和 _deepclone, mutate_ 基准确定了更改数据的成本的基线,没有不可变性 (或深度可伶情况下的结构共享).
* 这个 _reducer_ 和 _naive reducer_ 在典型的 Redux reducer 中实现, "smart" 实现对集合进行切片,然后仅映射和freezing相关的代办事项, "naive"的实现只是映射并处理整个集合.
* 使用代理的 Immer 粗略的说, 他的速度是手写的 reducer 的两倍, 这在实践中可以忽略不计.
* Immer 和 ImmutableJS 一样块. 但是,  _immutableJS + toJS_ 明确了以后需要经常支付的成本;  将 immutableJS 对象转化回普通对象, 以便能够通过网络等将它们传递给组件... (而且还有将从服务器接收的数据转化为 immutable JS 的成本)
* Immer 的 ES5 实现速度明显变慢. 对于大多数 reducer 而言,这无关紧要,但是处理大数据的 reducer 可能会从不使用(或部分使用) Immer producer 中受益,辛运的是, Immer 是完全可选的.
* 在 _frozen_ 的 _just mutate_ 版本中的峰值, _deepclone_ 和 _naive reducer_ 来自于他们递归freezing完整树的事实,而其他测试用例至freezing树修改部分.

## FAQ

_(给那些没有阅读上面内容的人)_

**Q:Immer 是否使用了结构共享? 这样我的选择器就可以被记忆化了?**

A: Yes

**Q: Immer 是否支持深度更新?**

A: Yes

**Q: 我不确定我的目标环境中是否支持 Proxy. 我是否可以使用 Immer?**

A: Yes

**Q: 我可以在使用 Immer 时检查我的数据结构吗?**

A: Yes

**Q: 我是用 Immer 时, 是否可以在 store 中储存 `Date` 对象, 函数等?**

A: Yes

**Q: 它快吗?**

A: Yes

**Q: Idea! Immer 可以为我freezing state?**

A: Yes

## Credits

特别感谢 @Mendix, 支持员工每月两天完全自由的进行实验,为这个项目奠定了基础.

## Donations

我的开源工作是无偿的. 所以 [捐款](https://mobx.js.org/donate.html) 真的非常感谢:)
