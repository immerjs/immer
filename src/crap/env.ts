// Should be no imports here!

// SOme things that should be evaluated before all else...
const hasSymbol = typeof Symbol !== "undefined"
export const hasMap = typeof Map !== "undefined"
export const hasSet = typeof Set !== "undefined"

/**
 * The sentinel value returned by producers to replace the draft with undefined.
 */
export const NOTHING: Nothing = hasSymbol
	? Symbol("immer-nothing")
	: ({["immer-nothing"]: true} as any)

/**
 * To let Immer treat your class instances as plain immutable objects
 * (albeit with a custom prototype), you must define either an instance property
 * or a static property on each of your custom classes.
 *
 * Otherwise, your class instance will never be drafted, which means it won't be
 * safe to mutate in a produce callback.
 */
export const DRAFTABLE: unique symbol = hasSymbol
	? Symbol("immer-draftable")
	: ("__$immer_draftable" as any)

export const DRAFT_STATE: unique symbol = hasSymbol
	? Symbol("immer-state")
	: ("__$immer_state" as any)

export const iteratorSymbol: typeof Symbol.iterator = hasSymbol
	? Symbol.iterator
	: ("@@iterator" as any)

/** Use a class type for `nothing` so its type is unique */
export class Nothing {
	// This lets us do `Exclude<T, Nothing>`
	// @ts-ignore
	private _!: unique symbol
}
