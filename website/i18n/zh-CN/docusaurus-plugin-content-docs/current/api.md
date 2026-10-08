---
id: api
title: API 概览
---

<center>
<div data-ea-publisher="immerjs" data-ea-type="image" class="horizontal bordered"></div>
</center>

| 导出名称 | 描述 | 章节 |
| --- | --- | --- |
| `produce` | Immer 核心 API：`import {produce} from "immer"` | [Produce](./produce.mdx) |
| `applyPatches` | 给定一个基本 state 或 draft，以及一组 patches ，应用 patches | [Patches](./patches.mdx) |
| `castDraft` | 将任何不可变类型转换为其可变对应物。这只是一个转换，实际上并没有做任何事情。 | [TypeScript](./typescript.mdx) |
| `castImmutable` | 将任何可变类型转换为其不可变对应物。这只是一个转换，实际上并没有做任何事情。 | [TypeScript](./typescript.mdx) |
| `createDraft` | 给定一个基本 state，创建一个可变 draft，任何修改都将被记录下来 | [Async](./async.mdx) |
| `current` | 给定一个 draft 对象（不必是对象的根结点），对 draft 的当前状态进行快照 | [Current](./current.md) |
| `Draft<T>` | 暴露的 TypeScript 类型以将不可变类型转换为可变类型 | [TypeScript](./typescript.mdx) |
| `enableArrayMethods()` | 启用优化的数组方法处理，改善大量数组操作的性能。 | [Array Methods](./array-methods.md) |
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
| `produceWithPatches` | 与 `produce` 相同，但它不仅返回生成的对象，还返回一个由 `[result, patch, inversePatches]` 组成的元组 | [Patches](./patches.mdx) |
| `setAutoFreeze` | 启用/禁用递归的自动冻结。默认启用 | [Freezing](./freezing.mdx) |
| `setUseStrictShallowCopy` | 可用于启用严格的浅拷贝。 如果启用，immer 会尽可能多地拷贝不可枚举属性 | [Classes](./complex-objects.md) |
| `setUseStrictIteration` | 控制遍历行为：传入 `false` 使用宽松遍历（仅处理可枚举属性，性能更好），传入 `true` 使用严格遍历（包括 symbol 和不可枚举属性）。默认禁用（宽松遍历）。 |  |

## 导入 immer

大多数情况下，只需从 Immer 导入 `produce`：

```javascript
import {produce} from "immer"
```

旧版本也提供 `produce` 的默认导出（例如 `import produce from "immer"`）。为了改善生态系统兼容性，当前版本不再提供默认导出。
