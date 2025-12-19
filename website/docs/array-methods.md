---
id: array-methods
title: Array Methods Plugin
---

<center>
<div data-ea-publisher="immerjs" data-ea-type="image" className="horizontal bordered"></div>
</center>

## Overview

The Array Methods Plugin (`enableArrayMethods()`) optimizes array operations within Immer producers by avoiding unnecessary Proxy creation during iteration. This provides significant performance improvements for array-heavy operations.

**Why does this matter?** Without the plugin, every array element access during iteration (e.g., in `filter`, `find`, `slice`) creates a Proxy object. For a 1000-element array, this means 1000+ proxy trap invocations just to iterate. With the plugin enabled, callbacks receive base (non-proxied) values, and proxies are only created as needed for mutation tracking.

## Installation

Enable the plugin once at your application's entry point:

```javascript
import {enableArrayMethods} from "immer"

enableArrayMethods()
```

This adds approximately **2KB** to your bundle size.

## Mutating Methods

These methods modify the array in-place and operate directly on the draft's internal copy without creating per-element proxies:

| Method      | Returns          | Description                           |
| ----------- | ---------------- | ------------------------------------- |
| `push()`    | New length       | Adds elements to the end              |
| `pop()`     | Removed element  | Removes and returns the last element  |
| `shift()`   | Removed element  | Removes and returns the first element |
| `unshift()` | New length       | Adds elements to the beginning        |
| `splice()`  | Removed elements | Adds/removes elements at any position |
| `sort()`    | The draft array  | Sorts elements in place               |
| `reverse()` | The draft array  | Reverses the array in place           |

```javascript
import {produce, enableArrayMethods} from "immer"

enableArrayMethods()

const base = {items: [3, 1, 4, 1, 5]}

const result = produce(base, draft => {
	draft.items.push(9) // Adds 9 to end
	draft.items.sort() // Sorts: [1, 1, 3, 4, 5, 9]
	draft.items.reverse() // Reverses: [9, 5, 4, 3, 1, 1]
})
```

## Non-Mutating Methods

Non-mutating methods are categorized based on what they return:

### Subset Operations (Return Drafts)

These methods select items that exist in the original array and **create draft proxies** for the returned items. The callbacks receive **base values** (the optimization), but the **returned array** contains newly created draft proxies that point back to the original positions. **Mutations to returned items WILL affect the draft state.**

| Method       | Returns                            | Drafts? |
| ------------ | ---------------------------------- | ------- |
| `filter()`   | Array of matching items            | ✅ Yes  |
| `slice()`    | Array of items in range            | ✅ Yes  |
| `find()`     | First matching item or `undefined` | ✅ Yes  |
| `findLast()` | Last matching item or `undefined`  | ✅ Yes  |

```javascript
const base = {
	items: [
		{id: 1, value: 10},
		{id: 2, value: 20},
		{id: 3, value: 30}
	]
}

const result = produce(base, draft => {
	// filter returns drafts - mutations track back to original
	const filtered = draft.items.filter(item => item.value > 15)
	filtered[0].value = 999 // This WILL affect draft.items[1]

	// find returns a draft - mutations track back
	const found = draft.items.find(item => item.id === 3)
	if (found) {
		found.value = 888 // This WILL affect draft.items[2]
	}

	// slice returns drafts
	const sliced = draft.items.slice(0, 2)
	sliced[0].value = 777 // This WILL affect draft.items[0]
})

console.log(result.items[0].value) // 777
console.log(result.items[1].value) // 999
console.log(result.items[2].value) // 888
```

### Transform Operations (Return Base Values)

These methods create **new arrays** that may include external items or restructured data. They return **base values**, NOT drafts. **Mutations to returned items will NOT track back to the draft state.**

| Method     | Returns             | Drafts? |
| ---------- | ------------------- | ------- |
| `concat()` | New combined array  | ❌ No   |
| `flat()`   | New flattened array | ❌ No   |

```javascript
const base = {items: [{id: 1, value: 10}]}

const result = produce(base, draft => {
	// concat returns base values - mutations DON'T track
	const concatenated = draft.items.concat([{id: 2, value: 20}])
	concatenated[0].value = 999 // This will NOT affect draft.items[0]

	// To actually use concat results, assign them:
	draft.items = draft.items.concat([{id: 2, value: 20}])
})

// Original unchanged because concat result wasn't assigned
console.log(result.items[0].value) // 10 (unchanged)
```

**Why the distinction?**

- **Subset operations** (`filter`, `slice`, `find`) select items that exist in the original array. Returning drafts allows mutations to propagate back to the source.
- **Transform operations** (`concat`, `flat`) create new data structures that may include external items or restructured data, making draft tracking impractical.

### Primitive-Returning Methods

These methods return primitive values (numbers, booleans, strings). No tracking issues since primitives aren't draftable:

| Method             | Returns              |
| ------------------ | -------------------- |
| `indexOf()`        | Number (index or -1) |
| `lastIndexOf()`    | Number (index or -1) |
| `includes()`       | Boolean              |
| `some()`           | Boolean              |
| `every()`          | Boolean              |
| `findIndex()`      | Number (index or -1) |
| `findLastIndex()`  | Number (index or -1) |
| `join()`           | String               |
| `toString()`       | String               |
| `toLocaleString()` | String               |

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

## Methods NOT Overridden

The following methods are **not** intercepted by the plugin and work through standard Proxy behavior. Callbacks receive drafts, and mutations track normally:

| Method          | Description                       |
| --------------- | --------------------------------- |
| `map()`         | Transform each element            |
| `flatMap()`     | Map then flatten                  |
| `forEach()`     | Execute callback for each element |
| `reduce()`      | Reduce to single value            |
| `reduceRight()` | Reduce from right to left         |

```javascript
const base = {
	items: [
		{id: 1, value: 10, nested: {count: 0}},
		{id: 2, value: 20, nested: {count: 0}}
	]
}

const result = produce(base, draft => {
	// forEach receives drafts - mutations work normally
	draft.items.forEach(item => {
		item.value *= 2
	})

	// map is NOT overridden - callbacks receive drafts
	// The returned array items are also drafts (extracted from draft.items)
	const mapped = draft.items.map(item => item.nested)
	// Mutations to the result array propagate back
	mapped[0].count = 999 // ✅ This affects draft.items[0].nested.count
})

console.log(result.items[0].nested.count) // 999
```

## Callback Behavior

For overridden methods, callbacks receive **base values** (not drafts). This is the core optimization - it avoids creating proxies for every element during iteration.

```javascript
const base = {
	items: [
		{id: 1, value: 10},
		{id: 2, value: 20}
	]
}

produce(base, draft => {
	draft.items.filter(item => {
		// `item` is a base value here, NOT a draft
		// Reading properties works fine
		return item.value > 15

		// But direct mutation here won't be tracked:
		// item.value = 999  // ❌ Won't affect draft
	})

	// Instead, use the returned draft:
	const filtered = draft.items.filter(item => item.value > 15)
	filtered[0].value = 999 // ✅ This works because filtered[0] is a draft
})
```

## Method Return Behavior Summary

| Category | Methods | Returns | Mutations Track? |
| --- | --- | --- | --- |
| **Subset** | `filter`, `slice`, `find`, `findLast` | Draft proxies | ✅ Yes |
| **Transform** | `concat`, `flat` | Base values | ❌ No |
| **Primitive** | `indexOf`, `includes`, `some`, `every`, `findIndex`, `findLastIndex`, `lastIndexOf`, `join`, `toString`, `toLocaleString` | Primitives | N/A |
| **Mutating** | `push`, `pop`, `shift`, `unshift`, `splice`, `sort`, `reverse` | Various | ✅ Yes (modifies draft) |
| **Not Overridden** | `map`, `flatMap`, `forEach`, `reduce`, `reduceRight` | Standard behavior | ✅ Yes (callbacks get drafts) |

## When to Use

Enable the Array Methods Plugin when:

- Your application has significant array iteration within producers
- You frequently use methods like `filter`, `find`, `some`, `every` on large arrays
- Performance profiling shows array operations as a bottleneck

The plugin is most beneficial for:

- Large arrays (100+ elements)
- Frequent producer calls with array operations
- Read-heavy operations (filtering, searching) where most elements aren't modified

## Performance Benefit

**Without the plugin:**

- Every array element access during iteration creates a Proxy
- A `filter()` on 1000 elements = 1000+ proxy creations

**With the plugin:**

- Callbacks receive base values directly
- Proxies only created for the specific elements you actually mutate, or that match filtering predicates

```javascript
// Without plugin: ~3000+ proxy trap invocations
// With plugin: ~10-20 proxy trap invocations
const result = produce(largeState, draft => {
	const filtered = draft.items.filter(x => x.value > threshold)
	// Only items you mutate get proxied
	filtered.forEach(item => {
		item.processed = true
	})
})
```
