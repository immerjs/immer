---
id: freezing
title: Auto freezing
---

<div id="codefund"><!-- fallback content --></div>

<details>
    <summary style="color: white; background:#c200c2;padding:5px;margin:5px;border-radius:2px">egghead.io lesson 7: Immer automatically freezes data</summary>
    <br>
    <div style="padding:5px;">
        <iframe style="border: none;" width=760 height=427 scrolling="no" src="https://egghead.io/lessons/javascript-produces-immutable-data-and-avoid-unnecessary-creation-of-new-data-trees-with-immer/embed" ></iframe>
    </div>
    <a style="font-style:italic;padding:5px;margin:5px;"  href="https://egghead.io/lessons/javascript-produces-immutable-data-and-avoid-unnecessary-creation-of-new-data-trees-with-immer">Hosted on egghead.io</a>
</details>

Immer automatically freezes any state trees that are modified using `produce`. This protects against accidental modifications of the state tree outside of a producer. This comes with a performance impact, so it is recommended to disable this option in production. By default, it is turned on during local development and turned off in production. Use `setAutoFreeze(true / false)` to explicitly turn this feature on or off.

_⚠️ If auto freezing is enabled, recipes are not entirely side-effect free: Any plain object or array that ends up in the produced result, will be frozen, even when these objects were not frozen before the start of the producer! ⚠️_
