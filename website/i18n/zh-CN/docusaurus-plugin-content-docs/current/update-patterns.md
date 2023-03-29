---
id: update-patterns
title: 更新模式
---

<center>
<div data-ea-publisher="immerjs" data-ea-type="image" class="horizontal bordered"></div>
</center>

在 Immer 之前，使用不可变数据意味着学习所有不可变的更新模式。

为了帮助“忘记”这些模式，这里概述了如何利用内置 JavaScript API 来更新对象和集合

### 更新对象

```javascript
import {produce} from "immer"

const todosObj = {
	id1: {done: false, body: "Take out the trash"},
	id2: {done: false, body: "Check Email"}
}

// 添加
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
```

### 更新数组

```javascript
import {produce} from "immer"

const todosArray = [
	{id: "id1", done: false, body: "Take out the trash"},
	{id: "id2", done: false, body: "Check Email"}
]

// 添加
const addedTodosArray = produce(todosArray, draft => {
	draft.push({id: "id3", done: false, body: "Buy bananas"})
})

// 索引删除
const deletedTodosArray = produce(todosArray, draft => {
	draft.splice(3 /*索引 */, 1)
})

// 索引更新
const updatedTodosArray = produce(todosArray, draft => {
	draft[3].done = true
})

// 索引插入
const updatedTodosArray = produce(todosArray, draft => {
	draft.splice(3, 0, {id: "id3", done: false, body: "Buy bananas"})
})

// 删除最后一个元素
const updatedTodosArray = produce(todosArray, draft => {
	draft.pop()
})

// 删除第一个元素
const updatedTodosArray = produce(todosArray, draft => {
	draft.shift()
})

// 数组开头添加元素
const addedTodosArray = produce(todosArray, draft => {
	draft.unshift({id: "id3", done: false, body: "Buy bananas"})
})

// 根据 id 删除
const deletedTodosArray = produce(todosArray, draft => {
	const index = draft.findIndex(todo => todo.id === "id1")
	if (index !== -1) draft.splice(index, 1)
})

// 根据 id 更新
const updatedTodosArray = produce(todosArray, draft => {
	const index = draft.findIndex(todo => todo.id === "id1")
	if (index !== -1) draft[index].done = true
})

// 过滤
const updatedTodosArray = produce(todosArray, draft => {
	// 过滤器实际上会返回一个不可变的状态，但是如果过滤器不是处于对象的顶层，这个依然很有用
	return draft.filter(todo => todo.done)
})
```

### 嵌套数据结构

```javascript
import {produce} from "immer"

// 复杂数据结构例子
const store = {
	users: new Map([
		[
			"17",
			{
				name: "Michel",
				todos: [
					{
						title: "Get coffee",
						done: false
					}
				]
			}
		]
	])
}

// 深度更新
const nextStore = produce(store, draft => {
	draft.users.get("17").todos[0].done = true
})

// 过滤
const nextStore = produce(store, draft => {
	const user = draft.users.get("17")

	user.todos = user.todos.filter(todo => todo.done)
})
```

请注意，许多数组操作可用于通过传递多个参数或使用展开操作来一次插入多个元素：`todos.unshift(...items)`。

请注意，当处理包含通常由某个 id 标识的对象的数组时，我们建议使用基于 `Map` 或索引的对象（如上所示）而不是执行频繁的查找操作，查找表通常执行效率更高。
