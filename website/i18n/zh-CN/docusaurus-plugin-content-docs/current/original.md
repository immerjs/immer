---
id: original
title: 从 draft 中提取原始 state
sidebar_label: Original
---

<center>
<div data-ea-publisher="immerjs" data-ea-type="image" class="horizontal bordered"></div>
</center>

Immer中暴露了一个命名对象 `original`，将从 `produce` 内部的代理实例获取原始对象（对于未代理值返回 `undefined`。
一个好的例子是：当在一个树状 state 中使用严格相等搜索结点的时候它很有用。

```js
import {original, produce} from "immer"

const baseState = {users: [{name: "Richie"}]}
const nextState = produce(baseState, draftState => {
	original(draftState.users) // is === baseState.users
})
```

只是想知道一个值是否是代理实例？使用 `isDraft` 函数！请注意，不能在不是 draft 的对象上调用 `original`。


```js
import {isDraft, produce} from "immer"

const baseState = {users: [{name: "Bobby"}]}
const nextState = produce(baseState, draft => {
	isDraft(draft) // => true
	isDraft(draft.users) // => true
	isDraft(draft.users[0]) // => true
})
isDraft(nextState) // => false
```
