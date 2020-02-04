---
id: example-setstate
title: React setState example
---

<div id="codefund"><!-- fallback content --></div>

<details>
    <summary style="color: white; background:#c200c2;padding:5px;margin:5px;border-radius:2px">egghead.io lesson 8: Using Immer with _useState_. Or: _useImmer_</summary>
    <br>
    <div style="padding:5px;">
        <iframe style="border: none;" width=760 height=427 scrolling="no" src="https://egghead.io/lessons/react-immutable-update-state-inside-react-components-with-useimmer/embed" ></iframe>
    </div>
    <a style="font-style:italic;padding:5px;margin:5px;"  href="https://egghead.io/lessons/react-immutable-update-state-inside-react-components-with-useimmer">Hosted on egghead.io</a>
</details>

Deep updates in the state of React components can be greatly simplified as well by using immer. Take for example the following onClick handlers (Try in [codesandbox](https://codesandbox.io/s/m4yp57632j)):

```javascript
/**
 * Classic React.setState with a deep merge
 */
onBirthDayClick1 = () => {
	this.setState(prevState => ({
		user: {
			...prevState.user,
			age: prevState.user.age + 1
		}
	}))
}

/**
 * ...But, since setState accepts functions,
 * we can just create a curried producer and further simplify!
 */
onBirthDayClick2 = () => {
	this.setState(
		produce(draft => {
			draft.user.age += 1
		})
	)
}
```
