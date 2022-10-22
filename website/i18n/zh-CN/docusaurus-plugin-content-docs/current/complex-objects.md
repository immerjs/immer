---
id: complex-objects
title: 类
---

<center>
<div data-ea-publisher="immerjs" data-ea-type="image" class="horizontal bordered"></div>
</center>

普通对象（没有原型的对象）、数组、`Map` 和 `Set` 总是可以用 Immer 更新。所有其他对象都必须使用 `immerable` 符号将自己标记为与 Immer 兼容。当这些对象之一在 `produce` 中进行更改时，它的原型将保留在副本之间


```js
import {immerable} from "immer"

class Foo {
	[immerable] = true // 方式一

	constructor() {
		this[immerable] = true // 方式二
	}
}

Foo[immerable] = true // 方式三
```

### 例子

```js
import {immerable, produce} from "immer"

class Clock {
	[immerable] = true

	constructor(hour, minute) {
		this.hour = hour
		this.minute = minute
	}

	get time() {
		return `${this.hour}:${this.minute}`
	}

	tick() {
		return produce(this, draft => {
			draft.minute++
		})
	}
}

const clock1 = new Clock(12, 10)
const clock2 = clock1.tick()
console.log(clock1.time) // 12:10
console.log(clock2.time) // 12:11
console.log(clock2 instanceof Clock) // true
```

### 语义细节

关于类的 `draft` 对象语义如下：

1. 类的 `draft` 是一个新对象，但与原始对象具有相同的原型。
2. 创建 `draft` 时，Immer 会将所有拥有的的属性从源对象复制到 `draft`。这包括不可枚举和符号属性。
3. 源对象拥有的 getter 将在复制过程中被调用，就像 `Object.assign` 方法一样
4. 继承的 getter 和方法将保持原样并被 `draft` 继承
5. Immer 不会调用构造函数
6. 最终实例将使用与创建 `draft` 相同的机制构建。
7. 只有具有 setter 的 getter 才能在 `draft` 中写入，否则无法将值复制回来。

因为 Immer 会将对象拥有的 getter 解引用到普通属性中，所以可以使用在其字段上使用 getter/setter 获得的对象，就像MobX 和 Vue。

Immer 不支持外来/引擎原生对象，例如 DOM 节点或 Buffers，也不支持继承的 Map、Set 或数组，并且不能在它们上使用 immerable 符号。

因此，例如在使用 `Date` 对象时，您应该始终创建一个新的 `Date` 实例，而不是改变现有的 `Date` 对象。
