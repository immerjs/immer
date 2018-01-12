# Changelog

### 0.7.0

* Immer will now use `Object.is` instead of `===` for equality checks

### 0.6.1

* Fixed issue where proxies inside new objects where not cleaned up. Fixes Fixes [#53](https://github.com/mweststrate/immer/issues/53)

### 0.6.0

* The default import now bundles both the es5 and proxy implementation as a convenient default. For more optimal bundle sizes, import `immer/proxy` or `immer/es5`

### 0.5.0

* Make sure es5.js is transpiled

### 0.4.2

* Fixed generating a wrong property descriptor for the `length` property of arrays. Fixes [#50](https://github.com/mweststrate/immer/issues/50)
* Defining custom properties on drafts is no longer supported

### 0.4.1

* Added UMD build

### 0.4.0

* Introduce support for [currying](https://github.com/mweststrate/immer#currying). [#37](https://github.com/mweststrate/immer/pull/37)
* Added argument checking
* The name of the immer import is now idiomatically `produce`. So the recommend import statement is: `import produce from "immer"`.

### 0.3.1

* Republished, somehow NPM still returned 0.2.2

### 0.3.0 (8-1-2018)

* Increased performance of the proxy-based implementation by a factor 2x - 3x. [#38](https://github.com/mweststrate/immer/pull/38)
* Improved typescript typings [#40](https://github.com/mweststrate/immer/pull/40) by [Julien Cavaleiro](https://github.com/Julienng)
* Added badges, coverage and typical project shizzle. [#25](https://github.com/mweststrate/immer/pull/25) by [Gregory Assasie](https://github.com/Gregjarvez) and [#39](https://github.com/mweststrate/immer/pull/39) by [Fadi Khadra](https://github.com/fkhadra)

### 0.2.2

* Fixed [#32](https://github.com/mweststrate/immer/issue/32): changes are not properly reflected in proxies when using for example `console.dir`

### 0.2.1

* Fixed: `immer/es5.js` was not packed into the package. PR [#28](https://github.com/mweststrate/immer/pull/28) by [Nicolas Lepage](https://github.com/nlepage)

### 0.2.0

* Immer now supports JavaScript engines without Proxies as well! Just require `immer` from `"immer/es5"`. See [#22](https://github.com/mweststrate/immer/pull/22)

### 0.1.2 (2-1-2018)

* Fixed issue where trailing commas could break consumers. Fixes [#21](https://github.com/mweststrate/immer/pull/21).

### 0.1.1 (2-1-2018)

* Fixed issue where TypeScript typings were not correctly exposed. Fixes [#18](https://github.com/mweststrate/immer/issue/18).

### 0.1.0 (1-1-2018)

* Fixed `immer` function export, it is now properly exposed as the `default` export. So `import immer from "immer"`. See [#15](https://github.com/mweststrate/immer/pull/15)
* Immer now automatically freezes any state modifications made. Turn this is using `setAutoFreeze(false)` for more efficiency in production builds. See [#15](https://github.com/mweststrate/immer/pull/15)
* Added support for frozen state trees in strict mode. See [#15](https://github.com/mweststrate/immer/pull/15)
* `immer` will now warn if you accidentally return something from the _thunk_. Fixes [#] through [#16](https://github.com/mweststrate/immer/pull/16/). By [Gregory Assasie](https://github.com/Gregjarvez).
* Proxies are now automatically cleaned up. This makes it impossible to read proxies after the `immer` function has finished. This prevents users from accidentally reading stale date. [#14](https://github.com/mweststrate/immer/pull/14) by [@benbraou](https://github.com/benbraou)

### 0.0.4 (31-12-2017)

* Added typescript typings [#11](https://github.com/mweststrate/immer/pull/11) by [@benbraou](https://github.com/benbraou)
* Fixed bug when setting properties to `undefined`. Fixes [#12](https://github.com/mweststrate/immer/issues/12) through [#13](https://github.com/mweststrate/immer/pull/13) by [@benbraou](https://github.com/benbraou)
