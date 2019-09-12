---
id: installation
title: Installation
---

<div id="codefund"><!-- fallback content --></div>

Immer can be installed as a direct dependency, and will work in any ES5 environment:

- Yarn: `yarn add immer`
- NPM: `npm install immer`
- CDN: Exposed global is `immer`
  - Unpkg: `<script src="https://unpkg.com/immer/dist/immer.umd.js"></script>`
  - JSDelivr: `<script src="https://cdn.jsdelivr.net/npm/immer/dist/immer.umd.js"></script>`

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

## Immer on older JavaScript environments?

By default `produce` tries to use proxies for optimal performance. However, on older JavaScript engines `Proxy` is not available. For example, when running Microsoft Internet Explorer or React Native (if < v0.59 or when using the Hermes engine) on Android. In such cases, Immer will fallback to an ES5 compatible implementation which works identical, but is a bit slower.
