---
id: pitfalls
title: 陷阱
---

<center>
<div data-ea-publisher="immerjs" data-ea-type="image" class="horizontal bordered"></div>
</center>

### 性能提示

对于性能提示，阅读 [性能提示](./performance.mdx#performance-tips).

### 不要重新分配 recipe 参数

永远不要重新分配 `draft` 参数（例如：`draft = myCoolNewState`）。相反，要么修改 draft，要么返回新状态。请参阅[从 producers 返回数据](./return.mdx)。

### Immer 只支持单向树

Immer 假设您的状态是单向树。也就是说，任何对象都不应该在树中出现两次，也不应该有循环引用。从根到树的任何节点应该只有一条路径。

### 永远不要从 producer 那里显式返回 `undefined`

可以从 producers 返回值，但不能以这种方式返回 `undefined`，因为它与根本不更新 draft 没有区别！如果你想用 `undefined` 替换 draft，只需从 producer 那里返回 `nothing`。

### 不要修改特殊对象

Immer [不支持特殊对象](https://github.com/immerjs/immer/issues/504) 比如 window.location.

### 类应该是可 draft 的或不可变的

您将需要使自己的类能与 Immer 一起正常工作。有关该主题的文档，请查看有关使用[复杂对象](./complex-objects.md)的部分。

### 只有有效的索引和长度可以在数组上改变

对于数组，只能改变数值属性和 `length` 属性。自定义属性不会保留在数组上。

### 只有来自 state 的数据会被 draft

请注意，来自闭包而不是来自基本 state 的数据将永远不会被 draft，即使数据已成为新 darft 的一部分。

```javascript
function onReceiveTodo(todo) {
	const nextTodos = produce(todos, draft => {
		draft.todos[todo.id] = todo
		// 注意，因为 todo 来自外部，而不是 draft，所以他不会被 draft，
		// 所以下面的修改会影响原来的 todo!
		draft.todos[todo.id].done = true

		// 上面的代码相当于
		todo.done = true
		draft.todos[todo.id] = todo
	})
}
```

### Immer patches 不一定是最优的

Immer 生成的 patches 应该是正确的，也就是说，将它们应用于相同的基础对象应该会导致相同的最终状态。然而，Immer 不保证生成的 patches 是最优的，即可能的最小 patches
### 始终使用嵌套 producers 的结果

支持嵌套调用 `produce` ，但请注意 `produce` 将_始终_产生新状态，因此即使将 draft 传递给嵌套 produce，内部 produce 所做的更改也不会在传递给它的 draft 中可见，只会反映在产生的输出中。换句话说，当使用嵌套 produce 时，您会得到 draft 的 draft，并且内部 produce 的结果应该合并回原始 draft（或返回）。例如，如果内部 produce 的输出没有被使用的话， `produce(state, draft => {produce(draft.user, userDraft => { userDraft.name += "!" })})` 将不会生效。使用嵌套 producers 的正确方法是：


```javascript
produce(state, draft => {
	draft.user = produce(draft.user, userDraft => {
		userDraft.name += "!"
	})
})
```

### Drafts 在引用上不相等

Immer 中的 draft 对象包装在 `Proxy` 中，因此您不能使用 `==` 或 `===` 来测试原始对象与其 draft 之间的相等性（例如，当匹配数组中的特定元素时）。相反，您可以使用 `original` 助手：


```javascript
const remove = produce((list, element) => {
	const index = list.indexOf(element) // 不会工作！
	const index = original(list).indexOf(element) // 用这个！
	if (index > -1) list.splice(index, 1)
})

const values = [a, b, c]
remove(values, a)
```

如果可以的话，建议在 `produce` 函数之外执行比较，或者使用 `.id` 之类的唯一标识符属性，以避免需要使用 `original`。

