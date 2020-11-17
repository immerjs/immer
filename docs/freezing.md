---
id: freezing
title: Auto freezing
---

<center>
<div data-ea-publisher="immerjs" data-ea-type="image" class="horizontal bordered"></div>
</center>

<details>
    <summary style="color: white; background:#c200c2;padding:5px;margin:5px;border-radius:2px">egghead.io lesson 7: Immer automatically freezes data</summary>
    <br>
    <div style="padding:5px;">
        <iframe style="border: none;" width=760 height=427 scrolling="no" src="https://egghead.io/lessons/javascript-produces-immutable-data-and-avoid-unnecessary-creation-of-new-data-trees-with-immer/embed" ></iframe>
    </div>
    <a style="font-style:italic;padding:5px;margin:5px;"  href="https://egghead.io/lessons/javascript-produces-immutable-data-and-avoid-unnecessary-creation-of-new-data-trees-with-immer">Hosted on egghead.io</a>
</details>

Immer automatically freezes any state trees that are modified using `produce`. This protects against accidental modifications of the state tree outside of a producer. In most cases this provides the most optimal behavior, but `setAutoFreeze(true / false)` can be used to explicitly turn this feature on or off.

Immer will never freeze (the contents of) non-enumerable, non-own or symbolic properties, unless their content was drafted.

_⚠️ Immer freezes everything recursively, for large data objects that won't be changed in the future this might be over-kill, in that case it can be more efficient to shallowly pre-freeze data using the `freeze` utility.⚠️_

_⚠️ If auto freezing is enabled, recipes are not entirely side-effect free: Any plain object or array that ends up in the produced result, will be frozen, even when these objects were not frozen before the start of the producer! ⚠️_
