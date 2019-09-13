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

## Immer on older JavaScript environments?

By default `produce` tries to use proxies for optimal performance. However, on older JavaScript engines `Proxy` is not available. For example, when running Microsoft Internet Explorer or React Native (if < v0.59 or when using the Hermes engine) on Android. In such cases, Immer will fallback to an ES5 compatible implementation which works identical, but is a bit slower.
