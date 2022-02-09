---
id: map-set
title: Map 和 Set
---

<center>
<div data-ea-publisher="immerjs" data-ea-type="image" class="horizontal bordered"></div>
</center>

_⚠ 从版本6开始，对 `Map` 和 `Set` 的支持必须在启动应用程序时通过显式调用 [`enableMapSet()`](./installation.mdx#pick-your-immer-version)来开启_

普通对象、数组、`Map` 和 `Set` 总是可以用 Immer 更新。一个使用 `Map` 和 Immer 的示例:

```javascript
test("Producers can update Maps", () => {
	const usersById_v1 = new Map()

	const usersById_v2 = produce(usersById_v1, draft => {
		// 修改 map 会生成一个新的 map
		draft.set("michel", {name: "Michel Weststrate", country: "NL"})
	})

	const usersById_v3 = produce(usersById_v2, draft => {
		// 在 map 深处进行修改，同样会生成一个新的 map!
		draft.get("michel").country = "UK"
	})

	// 我们每次都会得到一个新的 map
	expect(usersById_v2).not.toBe(usersById_v1)
	expect(usersById_v3).not.toBe(usersById_v2)
	// 显然它们的内容不同
	expect(usersById_v1).toMatchInlineSnapshot(`Map {}`)
	expect(usersById_v2).toMatchInlineSnapshot(`
		Map {
		  "michel" => Object {
		    "country": "NL",
		    "name": "Michel Weststrate",
		  },
		}
	`)
	expect(usersById_v3).toMatchInlineSnapshot(`
		Map {
		  "michel" => Object {
		    "country": "UK",
		    "name": "Michel Weststrate",
		  },
		}
	`)
	// 旧的从来不会被更改
	expect(usersById_v1.size).toBe(0)
	// 试图在 produce 之外修改 map 对象是不行的！
	expect(() => usersById_v3.clear()).toThrowErrorMatchingInlineSnapshot(
		`"This object has been frozen and should not be mutated"`
	)
})
```

Immer 生成的 Map 和 Set 将被人为地设置为不可变。这意味着在 `produce` 之外尝试 `set`、`clear`等可变方法时，它们将抛出异常。

注意：map 的**键**永远不会被更改！这样做是为了避免混淆语义并保持键始终引用相等
