---
id: api
title: API overview
---

<div id="codefund"><!-- fallback content --></div>

| Exported name | Description | Section |
| --- | --- | --- |
| `applyPatches` | Given a base state or draft, and a set of patches, applies the patches | [Patches](patches.md) |
| `castDraft` | Converts any immutable type to its mutable counterpart. This is just a cast and doesn't actually do anything. | [TypeScript](typescript.md) |
| `castImmutable` | Converts any mutable type to its immutable counterpart. This is just a cast and doesn't actually do anything. | [TypeScript](typescript.md) |
| `createDraft` | Given a base state, creates a mutable draft for which any modifications will be recorded | [Async](async.md) |
| `Draft<T>` | Exposed TypeScript type to convert an immutable type to a mutable type | [TypeScript](typescript.md) |
| `finishDraft` | Given an draft created using `createDraft`, seals the draft and produces and returns the next immutable state that captures all the changes | [Async](async.md) |
| `Immer` | constructor that can be used to create a second "immer" instance (exposing all APIs listed in this instance), that doesn't share its settings with global instance. Can also be used to attach further hooks that are triggered during object finalization, such as `onAssign`, `onDelete` and `onCopy`. | [See source](https://github.com/immerjs/immer/blob/cb1c6dd8a33073aaa0a4d881c94ec7ab1c1be7f6/src/immer.d.ts#L224-L233) |
| `immerable` | Symbol that can be added to a constructor or prototype, to indicate that Immer should treat the class as something that can be safely drafted | [Classes](complex-objects.md) |
| `Immutable<T>` | Exposed TypeScript type to convert mutable types to immutable types |  |
| `isDraft` | Returns true if the given object is a draft object |  |
| `isDraftable` | Returns true if Immer is capable of turning this object into a draft. Which is true for: arrays, objects without prototype, objects with `Object` as their prototype, objects that have the `immerable` symbol on their constructor or prototype |  |
| `nothing` | Value that can be returned from a recipe, to indicate that the value `undefined` should be produced | [Return](return.md) |
| `original` | Given a draft object (doesn't have to be a tree root), returns the the original object at the same path in the original state tree, if present | [Original](original.md) |
| `Patch` | Exposed TypeScript type, describes the shape of an (inverse) patch object | [Patches](patches.md) |
| `produce` | The core API of Immer, also exposed as the `default` export | [Produce](produce.md) |
| `produceWithPatches` | Works the same as `produce`, but instead of just returning the produced object, it returns a tuple, consisting of `[result, patches, inversePatches]`. | [Patches](patches.md) |
| `setAutoFreeze` | Enables / disables automatic freezing of the trees produces. By default enabled in development builds | [Freezing](freezing.md) |
| `setUseProxies` | Can be used to disable or force the use of `Proxy` objects. Useful when filing bug reports. |  |

## Importing immer

`produce` is exposed as the default export, but optionally it can be used as name import as well, as this benefits some older project setups. So the following imports are all correct, where the first is recommended:

```javascript
import produce from "immer"
import {produce} from "immer"

const {produce} = require("immer")
const produce = require("immer").produce
const produce = require("immer").default

import unleashTheMagic from "immer"
import {produce as unleashTheMagic} from "immer"
```
