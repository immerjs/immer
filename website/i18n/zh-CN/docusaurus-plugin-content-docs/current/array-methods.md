---
id: array-methods
title: 数组方法插件
---

<center>
<div data-ea-publisher="immerjs" data-ea-type="image" className="horizontal bordered"></div>
</center>

## 概述

数组方法插件（`enableArrayMethods()`）通过避免在迭代期间创建不必要的 Proxy，优化了 Immer producer 中的数组操作。这可以显著提升大量使用数组的操作的性能。

**为什么这一点很重要？** 如果不使用该插件，迭代期间每次访问数组元素（例如在 `filter`、`find`、`slice` 中）都会创建一个 Proxy 对象。对于包含 1000 个元素的数组，仅一次迭代就意味着 1000 次以上的 Proxy trap 调用。启用插件后，回调会接收基础值（未经 Proxy 包装的值），只有在追踪修改需要时才会创建 Proxy。

## 安装

在应用的入口处启用一次插件：

```javascript
import {enableArrayMethods} from "immer"

enableArrayMethods()
```

这会使你的打包体积增加约 **2KB**。

## 修改数组的方法

这些方法会就地修改数组，直接操作 draft 的内部副本，而不会为每个元素创建 Proxy：

| 方法        | 返回值       | 说明                         |
| ----------- | ------------ | ---------------------------- |
| `push()`    | 新长度       | 在末尾添加元素               |
| `pop()`     | 被移除的元素 | 移除并返回最后一个元素       |
| `shift()`   | 被移除的元素 | 移除并返回第一个元素         |
| `unshift()` | 新长度       | 在开头添加元素               |
| `splice()`  | 被移除的元素 | 在任意位置添加或移除元素     |
| `sort()`    | draft 数组   | 就地对元素排序               |
| `reverse()` | draft 数组   | 就地反转数组                 |

```javascript
import {produce, enableArrayMethods} from "immer"

enableArrayMethods()

const base = {items: [3, 1, 4, 1, 5]}

const result = produce(base, draft => {
	draft.items.push(9) // 在末尾添加 9
	draft.items.sort() // 排序：[1, 1, 3, 4, 5, 9]
	draft.items.reverse() // 反转：[9, 5, 4, 3, 1, 1]
})
```

## 不修改数组的方法

不修改数组的方法可以根据返回值分为以下几类：

### 子集操作（返回 draft）

这些方法选择原数组中已有的元素，并为返回的元素**创建 draft Proxy**。回调接收的是**基础值**（这正是优化所在），但**返回的数组**中包含新创建的 draft Proxy，它们仍指向原来的位置。**修改返回的元素会影响 draft 状态。**

| 方法         | 返回值                         | 是否为 draft？ |
| ------------ | ------------------------------ | -------------- |
| `filter()`   | 匹配元素组成的数组             | ✅ 是          |
| `slice()`    | 指定范围内的元素组成的数组     | ✅ 是          |
| `find()`     | 第一个匹配元素或 `undefined`   | ✅ 是          |
| `findLast()` | 最后一个匹配元素或 `undefined` | ✅ 是          |

```javascript
const base = {
	items: [
		{id: 1, value: 10},
		{id: 2, value: 20},
		{id: 3, value: 30}
	]
}

const result = produce(base, draft => {
	// filter 返回 draft，修改会追踪到原数组
	const filtered = draft.items.filter(item => item.value > 15)
	filtered[0].value = 999 // 这会影响 draft.items[1]

	// find 返回一个 draft，修改会被追踪
	const found = draft.items.find(item => item.id === 3)
	if (found) {
		found.value = 888 // 这会影响 draft.items[2]
	}

	// slice 返回 draft
	const sliced = draft.items.slice(0, 2)
	sliced[0].value = 777 // 这会影响 draft.items[0]
})

console.log(result.items[0].value) // 777
console.log(result.items[1].value) // 999
console.log(result.items[2].value) // 888
```

### 转换操作（返回基础值）

这些方法会创建可能包含外部元素或经过重新组织的数据的**新数组**。它们返回的是**基础值**，而不是 draft。**修改返回的元素不会追踪回 draft 状态。**

| 方法       | 返回值             | 是否为 draft？ |
| ---------- | ------------------ | -------------- |
| `concat()` | 合并后的新数组     | ❌ 否          |
| `flat()`   | 扁平化后的新数组   | ❌ 否          |

```javascript
const base = {items: [{id: 1, value: 10}]}

const result = produce(base, draft => {
	// concat 返回基础值，修改不会被追踪
	const concatenated = draft.items.concat([{id: 2, value: 20}])
	concatenated[0].value = 999 // 这不会影响 draft.items[0]

	// 如需真正使用 concat 的结果，请将其赋值：
	draft.items = draft.items.concat([{id: 2, value: 20}])
})

// 原值未改变，因为 concat 的结果没有被赋值给它
console.log(result.items[0].value) // 10（未改变）
```

**为什么要这样区分？**

- **子集操作**（`filter`、`slice`、`find`）选择原数组中已经存在的元素。返回 draft 可以让修改传播回数据源。
- **转换操作**（`concat`、`flat`）创建可能包含外部元素或经过重新组织的数据的新数据结构，因此无法进行实用的 draft 追踪。

### 返回原始值的方法

这些方法返回原始值（数字、布尔值、字符串）。原始值不能成为 draft，因此不存在追踪问题：

| 方法               | 返回值               |
| ------------------ | -------------------- |
| `indexOf()`        | 数字（索引或 -1）    |
| `lastIndexOf()`    | 数字（索引或 -1）    |
| `includes()`       | 布尔值               |
| `some()`           | 布尔值               |
| `every()`          | 布尔值               |
| `findIndex()`      | 数字（索引或 -1）    |
| `findLastIndex()`  | 数字（索引或 -1）    |
| `join()`           | 字符串               |
| `toString()`       | 字符串               |
| `toLocaleString()` | 字符串               |

```javascript
const base = {
	items: [
		{id: 1, active: true},
		{id: 2, active: false}
	]
}

const result = produce(base, draft => {
	const index = draft.items.findIndex(item => item.id === 2)
	const hasActive = draft.items.some(item => item.active)
	const allActive = draft.items.every(item => item.active)

	console.log(index) // 1
	console.log(hasActive) // true
	console.log(allActive) // false
})
```

## 未被重写的方法

以下方法**不会**被插件拦截，而是继续按照标准 Proxy 行为工作。回调接收 draft，修改会正常追踪：

| 方法            | 说明                   |
| --------------- | ---------------------- |
| `map()`         | 转换每个元素           |
| `flatMap()`     | 映射后再扁平化         |
| `forEach()`     | 对每个元素执行回调     |
| `reduce()`      | 归并为单个值           |
| `reduceRight()` | 从右向左归并为单个值   |

```javascript
const base = {
	items: [
		{id: 1, value: 10, nested: {count: 0}},
		{id: 2, value: 20, nested: {count: 0}}
	]
}

const result = produce(base, draft => {
	// forEach 接收 draft，修改会正常工作
	draft.items.forEach(item => {
		item.value *= 2
	})

	// map 未被重写，回调接收 draft
	// 返回数组中的元素也是从 draft.items 中提取的 draft
	const mapped = draft.items.map(item => item.nested)
	// 对结果数组中元素的修改会传播回去
	mapped[0].count = 999 // ✅ 这会影响 draft.items[0].nested.count
})

console.log(result.items[0].nested.count) // 999
```

## 回调行为

对于被重写的方法，回调接收的是**基础值**（不是 draft）。这是优化的核心，因为它避免了在迭代期间为每个元素创建 Proxy。

```javascript
const base = {
	items: [
		{id: 1, value: 10},
		{id: 2, value: 20}
	]
}

produce(base, draft => {
	draft.items.filter(item => {
		// 这里的 item 是基础值，而不是 draft
		// 读取属性没有问题
		return item.value > 15

		// 但这里的直接修改不会被追踪：
		// item.value = 999  // ❌ 不会影响 draft
	})

	// 应当改用返回的 draft：
	const filtered = draft.items.filter(item => item.value > 15)
	filtered[0].value = 999 // ✅ 可以生效，因为 filtered[0] 是 draft
})
```

## 方法返回行为汇总

| 类别         | 方法                                                                                               | 返回值       | 是否追踪修改？          |
| ------------ | -------------------------------------------------------------------------------------------------- | ------------ | ----------------------- |
| **子集**     | `filter`、`slice`、`find`、`findLast`                                                             | draft Proxy  | ✅ 是                   |
| **转换**     | `concat`、`flat`                                                                                  | 基础值       | ❌ 否                   |
| **原始值**   | `indexOf`、`includes`、`some`、`every`、`findIndex`、`findLastIndex`、`lastIndexOf`、`join`、`toString`、`toLocaleString` | 原始值       | 不适用                  |
| **修改数组** | `push`、`pop`、`shift`、`unshift`、`splice`、`sort`、`reverse`                                    | 取决于方法   | ✅ 是（修改 draft）     |
| **未重写**   | `map`、`flatMap`、`forEach`、`reduce`、`reduceRight`                                              | 标准行为     | ✅ 是（回调接收 draft） |

## 何时使用

在以下情况下，可以启用数组方法插件：

- 应用的 producer 中包含大量数组迭代
- 经常对大型数组使用 `filter`、`find`、`some`、`every` 等方法
- 性能分析显示数组操作是性能瓶颈

该插件在以下场景中最有帮助：

- 大型数组（100 个以上元素）
- 频繁调用包含数组操作的 producer
- 大多数元素不会被修改的读取密集型操作（筛选、搜索）

## 性能收益

**不使用插件时：**

- 迭代期间每次访问数组元素都会创建一个 Proxy
- 对 1000 个元素执行一次 `filter()`，会创建 1000 个以上的 Proxy

**使用插件时：**

- 回调直接接收基础值
- 只为你实际修改的特定元素或符合筛选条件的元素创建 Proxy

```javascript
// 不使用插件：约 3000 次以上的 Proxy trap 调用
// 使用插件：约 10～20 次 Proxy trap 调用
const result = produce(largeState, draft => {
	const filtered = draft.items.filter(x => x.value > threshold)
	// 只有被修改的元素才会创建 Proxy
	filtered.forEach(item => {
		item.processed = true
	})
})
```
