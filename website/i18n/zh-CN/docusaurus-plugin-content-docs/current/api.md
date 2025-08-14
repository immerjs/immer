---
id: api
title: API 概览
---

<center>
<div data-ea-publisher="immerjs" data-ea-type="image" class="horizontal bordered"></div>
</center>

| 导出名称 | 描述 | 章节 |
| --- | --- | --- |
| `(default)` | Immer 核心 API，通常命名为 `produce`: `import {produce} from "immer"` | [Produce](./produce.mdx) |
| `applyPatches` | 给定一个基本 state 或 draft，以及一组 patches ，应用 patches | [Patches](./patches.mdx) |
| `castDraft` | 将任何不可变类型转换为其可变对应物。这只是一个转换，实际上并没有做任何事情。 | [TypeScript](./typescript.mdx) |
| `castImmutable` | 将任何可变类型转换为其不可变对应物。这只是一个转换，实际上并没有做任何事情。 | [TypeScript](./typescript.mdx) |
| `createDraft` | 给定一个基本 state，创建一个可变 draft，任何修改都将被记录下来 | [Async](./async.mdx) |
| `current` | 给定一个 draft 对象（不必是对象的根结点），对 draft 的当前状态进行快照 | [Current](./current.md) |
| `Draft<T>` | 暴露的 TypeScript 类型以将不可变类型转换为可变类型 | [TypeScript](./typescript.mdx) |
| `enableMapSet()` | 启用对 `Map` 和 `Set` 集合的支持。 | [Installation](./installation.mdx#pick-your-immer-version) |
| `enablePatches()` | 启用对 JSON patches 的支持 | [Installation](./installation#pick-your-immer-version) |
| `finishDraft` | 给定使用 `createDraft` 创建的 draft，冻结 draft 并生成并返回下一个不可变状态，该状态捕获所有更改 | [Async](./async.mdx) |
| `freeze(obj, deep?)` | 冻结可 draft 对象。返回原始对象。默认情况下浅冻结，但如果第二个参数为真，它将递归冻结。 |
| `Immer` | 可用于创建第二个“immer”实例（暴露此实例中列出的所有 API）的构造函数，它不与全局实例共享其设置 |
| `immerable` | 可以添加到构造函数或原型的符号，表示 Immer 应该将类视为可以安全 draft 的东西 | [Classes](./complex-objects.md) |
| `Immutable<T>` | 暴露的 TypeScript 类型以将可变类型转换为不可变类型 |  |
| `isDraft` | 如果给定对象是 draft 对象，则返回 true |  |
| `isDraftable` | 如果 Immer 能够将此对象变成 draft，则返回 true。这适用于：数组、没有原型的对象、以 `Object` 为原型的对象、在其构造函数或原型上具有 `immerable` 符号的对象 |  |
| `nothing` | 可以从 recipe 返回的值，以指示应生成 `undefined` | [Return](./return.mdx) |
| `original` | 给定一个 draft 对象（不必是对象的根结点），返回原始状态树中相同路径的原始对象（如果存在） | [Original](./original.md) |
| `Patch` | 暴露的 TypeScript 类型，描述（反向）patches 对象的形状 | [Patches](./patches.mdx) |
| `produce` | Immer 的核心 API，也暴露为 `default` 导出 | [Produce](./produce.mdx) |
| `produceWithPatches` | 与 `produce` 相同，但它不仅返回生成的对象，还返回一个由 `[result, patch, inversePatches]` 组成的元组 | [Patches](./patches.mdx) |
| `setAutoFreeze` | 启用/禁用递归的自动冻结。默认启用 | [Freezing](./freezing.mdx) |
| `setUseStrictShallowCopy` | 可用于启用严格的浅拷贝。 如果启用，immer 会尽可能多地拷贝不可枚举属性 | [Classes](./complex-objects.md) |

## 导入 immer

`produce` 作为默认导出，但也可以选择将其用作名称导入，因为这有利于一些较旧的项目设置。所以下面的导入都是正确的，这里推荐第一个：

```javascript
import {produce} from "immer"
import {produce} from "immer"

const {produce} = require("immer")
const produce = require("immer").produce
const produce = require("immer").default

import unleashTheMagic from "immer"
import {produce as unleashTheMagic} from "immer"
```
