# Changelog

### 0.1.0 (1-1-2018)

* Fixed `immer` function export, it is now properly exposed as the `default` export. So `import immer from "immer"`. See [#15](https://github.com/mweststrate/immer/pull/15)
* Immer now automatically freezes any state modifications made. Turn this is using `setAutoFreeze(false)` for more efficiency in production builds. See [#15](https://github.com/mweststrate/immer/pull/15)
* Added support for frozen state trees in strict mode. See [#15](https://github.com/mweststrate/immer/pull/15)
* `immer` will now warn if you accidentally return something from the _thunk_. Fixes [#] through [#16](https://github.com/mweststrate/immer/pull/16/). By [Gregory Assasie](https://github.com/Gregjarvez).
* Proxies are now automatically cleaned up. This makes it impossible to read proxies after the `immer` function has finished. This prevents users from accidentally reading stale date. [#14](https://github.com/mweststrate/immer/pull/14) by [@benbraou](https://github.com/benbraou)

### 0.0.4 (31-12-2017)

* Added typescript typings [#11](https://github.com/mweststrate/immer/pull/11) by [@benbraou](https://github.com/benbraou)
* Fixed bug when setting properties to `undefined`. Fixes [#12](https://github.com/mweststrate/immer/issues/12) through [#13](https://github.com/mweststrate/immer/pull/13) by [@benbraou](https://github.com/benbraou)
