export type Objectish = any[] | Map<any, any> | Set<any> | {}

export type ObjectishNoSet = any[] | Map<any, any> | {}

export interface State<T = any> {
	copy: T
	base: T
}
