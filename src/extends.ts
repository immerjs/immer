/* istanbul ignore next */
var extendStatics = function(d: any, b: any): any {
	extendStatics =
		Object.setPrototypeOf ||
		({__proto__: []} instanceof Array &&
			function(d, b) {
				d.__proto__ = b
			}) ||
		function(d, b) {
			for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]
		}
	return extendStatics(d, b)
}

// Ugly hack to resolve #502 and inherit built in Map / Set
export function __extends(d: any, b: any): any {
	extendStatics(d, b)
	function __(this: any): any {
		this.constructor = d
	}
	d.prototype =
		// @ts-ignore
		((__.prototype = b.prototype), new __())
}
