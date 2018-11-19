# Changelog

### 1.8.0 (19-Nov-2018)

* Introduce the `isDraft` function to check if a value is a proxy created by Immer.
* Several minor code & performance improvements [#249](https://github.com/mweststrate/immer/pull/249) [#237](https://github.com/mweststrate/immer/pull/237)
* Functions are now also acceptable as primitive base state, see [#236](https://github.com/mweststrate/immer/pull/236) [#233](https://github.com/mweststrate/immer/pull/233)
* Improved test coverage [#250](https://github.com/mweststrate/immer/pull/250)

Credits for this release go to [@aleclarson](https://github.com/aleclarson), who made all these improvements!

### 1.7.3 (24-Oct-2018)

-   improve `Draft<T>` type for TypeScript users ([see here](https://github.com/mweststrate/immer/commit/512256bbde4ea1e2b6a75399d6ad59925752ad6b))
-   remove unused function
-   better test coverage
-   Use proxies only if both `Proxy` and `Reflect` global APIs exist (fixes [#226](https://github.com/mweststrate/immer/issues/226))

### 1.7.2 (20-Sep-2018)

-   Disabled `sideEffects` module flag, it somehow breaks the Angular build, fixes [#198](https://github.com/mweststrate/immer/issues/198)

### 1.7.1 (18-Sep-2018)

-   Fixed issue in the flow type for `nothing`

### 1.7.0 (18-Sep-2018)

-   Introduced the [`nothing`](https://github.com/mweststrate/immer#producing-undefined-using-nothing) token to be able to produce the `undefined` value (which would otherwise be indistinguishable from not updating the draft at all).

### 1.6.0 (4-Sep-2018)

-   Introduced the `original(draft)` function, that, given an object from the draft, returns the original object from the base state. This can be useful if you need to do reference equality checks, or comparisons with the base state. See [#179](https://github.com/mweststrate/immer/pull/179) by [@RichieAHB](https://github.com/RichieAHB).
-   Writing or removing non-numeric properties on arrays is now strictly forbidden (Immer didn't throw before, but correct behavior wasn't guaranteed either)

### 1.5.0 (25-July-2018)

-   Added support for patches, through [#168](https://github.com/mweststrate/immer/pull/168). See the [patches](https://github.com/mweststrate/immer#patches) section for details

### 1.4.0 (25-July-2018)

-   Improved TypeScript typings; if the base state is declared as `readonly`, the `draft` object will be upcasted to a writeable version. Fixes [#97](https://github.com/mweststrate/immer/issues/97) through [#161](https://github.com/mweststrate/immer/pull/161) by [@knpwrs](https://github.com/knpwrs)
-   It is now possible to use both `import produce from "immer"` and `import {produce} from "immer"`. Implements [#136](https://github.com/mweststrate/immer/issues/136)
-   Added several performance tests to the repository

### 1.3.1 (28-May-2018)

-   Fixed bug [#148](https://github.com/mweststrate/immer/issues/148) where original state was not always returned if the producer returned undefined and the original state was a primitive. By @stefanwille through [#157](https://github.com/mweststrate/immer/pull/157)

### 1.3.0 (4-May-2018)

-   Improved the behavior of recursive producer calls. A producer that is called from another producer is now a no-op; that is, the draft will only be finalized once the outer-most producer completes. Pro and cons of this approach are discussed in [here](https://github.com/mweststrate/immer/issues/100#issuecomment-375216607). Fixes [#100](https://github.com/mweststrate/immer/issues/100)
-   Immer no longer relies on `Object.assign` to be present / polyfilled. See[#139](https://github.com/mweststrate/immer/pull/139) by @celebro
-   Improved some error messages, see [#144](https://github.com/mweststrate/immer/pull/144) by @btnwtn

### 1.2.1 (26-Mar-2018)

-   Improved TypeScript and Flow typings to support return a new state from a producer. Trough [#131](https://github.com/mweststrate/immer/pull/131) by [dmorosinotto](https://github.com/mweststrate/immer/issues?q=is%3Apr+author%3Admorosinotto) resp [#127](https://github.com/mweststrate/immer/pull/127) by [bugzpodder](https://github.com/mweststrate/immer/pull/127)

### 1.2.0 (17-Mar-2018)

-   It is now possible to pass an _initial state_ to a _curried producer_. This makes it simpler to write Redux reducers that have a default initial state. See [#121](https://github.com/mweststrate/immer/pull/121) by (@pkerschbaum)[https://github.com/pkerschbaum]. Implements [#111](https://github.com/mweststrate/immer/issues/111).
-   Improved TypeScript & Flow typings. See [#109]](https://github.com/mweststrate/immer/pull/109) by [ogwh](https://github.com/ogwh).

### 1.1.2 (6-Mar-2018)

-   Fixed [#117](https://github.com/mweststrate/immer/issues/117), proxy was not finalized when returning a subset of the state
-   Fixed [#116](https://github.com/mweststrate/immer/issues/116), changes to arrays that ended up with the same length were not properly detected.

### 1.1.1 (22-Feb-2018)

-   Fixed curried reducers not return new states correctly. Fixes [#105](https://github.com/mweststrate/immer/issues/105)

### 1.1.0 (20-Feb-2018)

-   It is now possible to return an entirely new state from a producer as well. Immer will verify that you didn't both change the draft and returned a new state. Implements [#103](https://github.com/mweststrate/immer/issues/103)
-   Improved TypeScript typings. See [#99](https://github.com/mweststrate/immer/pull/99) by [Anton Fedchenko](https://github.com/kompot)

### 1.0.3 (15-Feb-2018)

-   Fixed detection of production mode. Fixes [#95](https://github.com/mweststrate/immer/issues/95)

### 1.0.2 (13-Feb-2018)

-   `flow-bin` and `cpx` were accidentally dependencies instead of dev-dependencies. Fixed

### 1.0.1 (2-Feb-2018)

-   Fixed an issue in checking property existence. See [#86](https://github.com/mweststrate/immer/pull/88) by [iruca3](https://github.com/iruca3). Also fixes [#89](https://github.com/mweststrate/immer/issues/89)

### 1.0.0 (31-Jan-2018)

-   Producer functions will now always be invoked with the draft as context (`this`). See the [readme](https://github.com/mweststrate/immer#using-this).
-   Freezing the data will now be automatically (by default) be disabled in production builds. By [Gregory Assasie](https://github.com/Gregjarvez)
-   Fixed Flow typings. Fixes [#80](https://github.com/mweststrate/immer/issues/80). By [Marcin Szczepanski](https://github.com/mweststrate/immer/issues?q=is%3Apr+author%3Amarcins) in [#85](https://github.com/mweststrate/immer/pull/85)
-   Fixed issue where constructor type was not preserved. By [iruca3](https://github.com/iruca3) through [#81](https://github.com/mweststrate/immer/pull/81)

### 0.8.5

-   Immer will automatically turn auto-freezing of in production. Use `setAutoFreeze` to manually control it. See [#46](https://github.com/mweststrate/immer/issues/78), [#76](https://github.com/mweststrate/immer/pull/76)
-   Fixed issue where objects were unnecessary proxied, causing exceptions. See [#78](https://github.com/mweststrate/immer/issues/78)

### 0.8.4

-   Added flow typings
-   Added polyfill for `Object.is`, fixes [#77](https://github.com/mweststrate/immer/issues/77)

### 0.8.3

-   Added 'polyfill' for `Symbol`, fixes [#75](https://github.com/mweststrate/immer/issues/75)

### 0.8.2

-   Fixed: TS typings were no longer exposed

### 0.8.2

-   Several general improvements: if an instances of an object are in the tree they will now be one instance in the resulting tree as well, also in the ES5 impl
-   Always freeze data that is newly added to the draft
-   Fixed [#75](https://github.com/mweststrate/immer/issues/75), don't use Symbols if not available.

### 0.8.1

-   Fixed [#66](https://github.com/mweststrate/immer/pull/66), assigning an already frozen object to a state threw resulting in exceptions being thrown as Immer unnecessarily tried to rewrite them.

### 0.8.0

-   The built is now being rolled up [#64](https://github.com/mweststrate/immer/pull/64) by [Arthur Denner](https://github.com/arthurdenner). A minified gzipped built is only 2kb!
-   There are no longer separate builds available for the proxy and es5 implementation. The sources where merged to allow for more code reuse.
-   The package now exposes an ES module as well.

### 0.7.0

-   Immer will now use `Object.is` instead of `===` for equality checks

### 0.6.1

-   Fixed issue where proxies inside new objects where not cleaned up. Fixes Fixes [#53](https://github.com/mweststrate/immer/issues/53)

### 0.6.0

-   The default import now bundles both the es5 and proxy implementation as a convenient default. For more optimal bundle sizes, import `immer/proxy` or `immer/es5`

### 0.5.0

-   Make sure es5.js is transpiled

### 0.4.2

-   Fixed generating a wrong property descriptor for the `length` property of arrays. Fixes [#50](https://github.com/mweststrate/immer/issues/50)
-   Defining custom properties on drafts is no longer supported

### 0.4.1

-   Added UMD build

### 0.4.0

-   Introduce support for [currying](https://github.com/mweststrate/immer#currying). [#37](https://github.com/mweststrate/immer/pull/37)
-   Added argument checking
-   The name of the immer import is now idiomatically `produce`. So the recommend import statement is: `import produce from "immer"`.

### 0.3.1

-   Republished, somehow NPM still returned 0.2.2

### 0.3.0 (8-1-2018)

-   Increased performance of the proxy-based implementation by a factor 2x - 3x. [#38](https://github.com/mweststrate/immer/pull/38)
-   Improved typescript typings [#40](https://github.com/mweststrate/immer/pull/40) by [Julien Cavaleiro](https://github.com/Julienng)
-   Added badges, coverage and typical project shizzle. [#25](https://github.com/mweststrate/immer/pull/25) by [Gregory Assasie](https://github.com/Gregjarvez) and [#39](https://github.com/mweststrate/immer/pull/39) by [Fadi Khadra](https://github.com/fkhadra)

### 0.2.2

-   Fixed [#32](https://github.com/mweststrate/immer/issue/32): changes are not properly reflected in proxies when using for example `console.dir`

### 0.2.1

-   Fixed: `immer/es5.js` was not packed into the package. PR [#28](https://github.com/mweststrate/immer/pull/28) by [Nicolas Lepage](https://github.com/nlepage)

### 0.2.0

-   Immer now supports JavaScript engines without Proxies as well! Just require `immer` from `"immer/es5"`. See [#22](https://github.com/mweststrate/immer/pull/22)

### 0.1.2 (2-1-2018)

-   Fixed issue where trailing commas could break consumers. Fixes [#21](https://github.com/mweststrate/immer/pull/21).

### 0.1.1 (2-1-2018)

-   Fixed issue where TypeScript typings were not correctly exposed. Fixes [#18](https://github.com/mweststrate/immer/issue/18).

### 0.1.0 (1-1-2018)

-   Fixed `immer` function export, it is now properly exposed as the `default` export. So `import immer from "immer"`. See [#15](https://github.com/mweststrate/immer/pull/15)
-   Immer now automatically freezes any state modifications made. Turn this is using `setAutoFreeze(false)` for more efficiency in production builds. See [#15](https://github.com/mweststrate/immer/pull/15)
-   Added support for frozen state trees in strict mode. See [#15](https://github.com/mweststrate/immer/pull/15)
-   `immer` will now warn if you accidentally return something from the _thunk_. Fixes [#] through [#16](https://github.com/mweststrate/immer/pull/16/). By [Gregory Assasie](https://github.com/Gregjarvez).
-   Proxies are now automatically cleaned up. This makes it impossible to read proxies after the `immer` function has finished. This prevents users from accidentally reading stale date. [#14](https://github.com/mweststrate/immer/pull/14) by [@benbraou](https://github.com/benbraou)

### 0.0.4 (31-12-2017)

-   Added typescript typings [#11](https://github.com/mweststrate/immer/pull/11) by [@benbraou](https://github.com/benbraou)
-   Fixed bug when setting properties to `undefined`. Fixes [#12](https://github.com/mweststrate/immer/issues/12) through [#13](https://github.com/mweststrate/immer/pull/13) by [@benbraou](https://github.com/benbraou)
