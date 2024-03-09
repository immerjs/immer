/**
 * This file is literally copied from https://github.com/aleclarson/spec.ts/blob/master/index.d.ts.
 * For the sole reason, that the package somehow fails to install in our GitHub workflow.
 * It is unclear why, but all credits to @aleclarson!
 */

// Give "any" its own class
export class Any {
	// @ts-ignore
	private _: true
}

// Conditional returns can enforce identical types.
// See here: https://github.com/Microsoft/TypeScript/issues/27024#issuecomment-421529650
// prettier-ignore
type TestExact<Left, Right> =
    (<U>() => U extends Left ? 1 : 0) extends (<U>() => U extends Right ? 1 : 0) ? Any : never;

type IsAny<T> = Any extends T ? ([T] extends [Any] ? 1 : 0) : 0

export type Test<Left, Right> = IsAny<Left> extends 1
	? IsAny<Right> extends 1
		? 1
		: "❌ Left type is 'any' but right type is not"
	: IsAny<Right> extends 1
	? "❌ Right type is 'any' but left type is not"
	: [Left] extends [Right]
	? [Right] extends [Left]
		? Any extends TestExact<Left, Right>
			? 1
			: "❌ Unexpected or missing 'readonly' property"
		: "❌ Right type is not assignable to left type"
	: "❌ Left type is not assignable to right type"

type Assert<T, U> = U extends 1
	? T // No error.
	: IsAny<T> extends 1
	? never // Ensure "any" is refused.
	: U // Return the error message.

/**
 * Raise a compiler error when both argument types are not identical.
 */
export const assert: <Left, Right>(
	left: Assert<Left, Test<Left, Right>>,
	right: Assert<Right, Test<Left, Right>>
) => Right = x => x as any

/**
 * Placeholder value followed by "as T"
 */
export const _: any = Symbol("spec.ts placeholder")

test("empty test to silence jest", () => {
	expect(true).toBeTruthy()
})
