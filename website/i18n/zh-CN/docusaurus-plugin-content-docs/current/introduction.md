---
id: introduction
title: Immer 入门
sidebar_label: 入门
slug: /
---

<center>
<div data-ea-publisher="immerjs" data-ea-type="image" class="horizontal bordered"></div>
</center>

<img src="/immer/img/immer-logo.svg" height="200px" align="right"/>

# Immer

2019 年 “年度突破”[React 开源奖](https://osawards.com/react/)和“最有影响的贡献”[JavaScript 开源奖](https://osawards.com/javascript/)的获得者

- 介绍博客: [Immer: Immutability the easy way](https://medium.com/@mweststrate/introducing-immer-immutability-the-easy-way-9d73d8f71cb3)
- Egghead.io 简短课程，涵盖 Immer 的基本知识: [Simplify creating immutable data trees with Immer (7 分钟)](https://egghead.io/lessons/redux-simplify-creating-immutable-data-trees-with-immer)
- Egghead.io 免费深入课程: [Immutable JavaScript Data Structures with Immer (58 分钟)](https://egghead.io/courses/immutable-javascript-data-structures-with-immer)

---

Immer（德语为：always）是一个小型包，可让您以更方便的方式使用不可变状态。

### Immer 简化了不可变数据结构的处理

Immer 可以在需要使用不可变数据结构的任何上下文中使用。例如与 React state、React 或 Redux reducers 或者 configuration management 结合使用。不可变的数据结构允许（高效）的变化检测：如果对对象的引用没有改变，那么对象本身也没有改变。此外，它使克隆对象相对便宜：数据树的未更改部分不需要复制，并且在内存中与相同状态的旧版本共享

一般来说，这些好处可以通过确保您永远不会更改对象、数组或映射的任何属性来实现，而是始终创建一个更改后的副本。在实践中，这可能会导致代码编写起来非常麻烦，并且很容易意外违反这些约束。 Immer 将通过解决以下痛点来帮助您遵循不可变数据范式：

1. Immer 将检测到意外 mutations 并抛出错误。
2. Immer 将不再需要创建对不可变对象进行深度更新时所需的典型样板代码：如果没有 Immer，则需要在每个级别手动制作对象副本。通常通过使用大量 `...` 展开操作。使用 Immer 时，会对 `draft` 对象进行更改，该对象会记录更改并负责创建必要的副本，而不会影响原始对象。
3. 使用 Immer 时，您无需学习专用 API 或数据结构即可从范例中受益。使用 Immer，您将使用纯 JavaScript 数据结构，并使用众所周知的安全地可变 JavaScript API。

### 一个简单的比较示例

```javascript
const baseState = [
	{
		title: "Learn TypeScript",
		done: true
	},
	{
		title: "Try Immer",
		done: false
	}
]
```

假设我们有上述基本状态，我们需要更新第二个 todo，并添加第三个。但是，我们不想改变原始的 baseState，我们也想避免深度克隆（以保留第一个 todo）

#### 不使用 Immer

如果没有 Immer，我们将不得不小心地浅拷贝每层受我们更改影响的 state 结构

```javascript
const nextState = baseState.slice() // 浅拷贝数组
nextState[1] = {
	// 替换第一层元素
	...nextState[1], // 浅拷贝第一层元素
	done: true // 期望的更新
}
// 因为 nextState 是新拷贝的, 所以使用 push 方法是安全的,
// 但是在未来的任意时间做相同的事情会违反不变性原则并且导致 bug！
nextState.push({title: "Tweet about it"})
```

#### 使用 Immer

使用 Immer，这个过程更加简单。我们可以利用 `produce` 函数，它将我们要更改的 state 作为第一个参数，对于第二个参数，我们传递一个名为 recipe 的函数，该函数传递一个 `draft` 参数，我们可以对其应用直接的 `mutations`。一旦 `recipe` 执行完成，这些 `mutations` 被记录并用于产生下一个状态。 `produce` 将负责所有必要的复制，并通过冻结数据来防止未来的意外修改。

```javascript
import {produce} from "immer"

const nextState = produce(baseState, draft => {
	draft[1].done = true
	draft.push({title: "Tweet about it"})
})
```

正在寻找结合 React 的 Immer？跳到 [React + Immer](example-setstate) 页面

### Immer 如何工作

基本思想是，使用 Immer，您会将所有更改应用到临时 _draft_，它是 _currentState_ 的代理。一旦你完成了所有的 _mutations_，Immer 将根据对 _draft state_ 的 _mutations_ 生成 nextState。这意味着您可以通过简单地修改数据来与数据交互，同时保留不可变数据的所有好处。

![immer-hd.png](/img/immer.png)

使用 Immer 就像拥有一个私人助理。助手拿一封信（当前状态）并给您一份副本（草稿）以记录更改。完成后，助手将接受您的草稿并为您生成真正不变的最终字母（下一个状态）。

前往 [下一章节](./produce.mdx) 以进一步深入了解 `produce`

## 好处

- 遵循不可变数据范式，同时使用普通的 JavaScript 对象、数组、Sets 和 Maps。无需学习新的 API 或 "mutations patterns"！
- 强类型，无基于字符串的路径选择器等
- 开箱即用的结构共享
- 开箱即用的对象冻结
- 深度更新轻而易举
- 样板代码减少。更少的噪音，更简洁的代码
- 对 JSON 补丁的一流支持
- 小：3KB gzip
