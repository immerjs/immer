---
id: current
title: 从 draft 中提取当前 state
sidebar_label: Current
---

<center>
<div data-ea-publisher="immerjs" data-ea-type="image" class="horizontal bordered"></div>
</center>

Immer 暴露了一个命名导出的 `current`函数，可以创建 draft 对象当前状态的一个副本。
这对于调试非常有用（因为这些对象不会是代理对象，也不会被记录下来）。
此外，对 `current` 的引用可以安全地从 `produce` 函数中释放。换句话说，`current` 提供 draft 当前状态的快照。

`current` 工作生成的对象类似于 `produced` 本身创建的对象。


1. 未修改的对象将在结构上与原始对象共享。
2. 如果未对 draft 进行任何更改，通常它会保留 original(draft) === current(draft)，但这并不能保证。
3. 未来对 draft 的更改不会反映在 `current` 生成的对象中（不可被 draft 对象的引用除外）
4. 与 `produce` 创建的对象不同，`current` 创建的对象不会被冻结。

谨慎使用 `current`，这可能是一项潜在的昂贵操作，尤其是在使用 ES5 时。

请注意，不能在不是 draft 的对象上调用 `current`。

### 例子

以下示例显示了 `current`（和 `original` ）的效果：


```js
const base = {
	x: 0
}

const next = produce(base, draft => {
	draft.x++
	const orig = original(draft)
	const copy = current(draft)
	console.log(orig.x)
	console.log(copy.x)

	setTimeout(() => {
		// 将在 produce 完成后执行
		console.log(orig.x)
		console.log(copy.x)
	}, 100)

	draft.x++
	console.log(draft.x)
})
console.log(next.x)

// 将会打印
// 0 (orig.x)
// 1 (copy.x)
// 2 (draft.x)
// 2 (next.x)
// 0 (after timeout, orig.x)
// 1 (after timeout, copy.x)
```
