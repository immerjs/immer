---
id: freezing
title: Auto freezing
---

Immer automatically freezes any state trees that are modified using `produce`. This protects against accidental modifications of the state tree outside of a producer. This comes with a performance impact, so it is recommended to disable this option in production. By default, it is turned on during local development and turned off in production. Use `setAutoFreeze(true / false)` to explicitly turn this feature on or off.

_⚠️ If auto freezing is enabled, recipes are not entirely side-effect free: Any plain object or array that ends up in the produced result, will be frozen, even when these objects were not frozen before the start of the producer! ⚠️_
