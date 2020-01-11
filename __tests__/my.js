import produce, {immerable, setUseProxies} from "../src/index"

setUseProxies(true)

describe("class with getters and methods", () => {
	class State {
		constructor() {
			this[immerable] = true
			this.word1 = "bar"
			this.word2 = "foo"
			this.foo = 0
			this._bar = {baz: 1}
		}
		get chars() {
			return this.word1.split("")
		}
		//set chars(v) {}
		get bar() {
			return this._bar
		}
		set barr(v) {
			this.foo = v
			console.log(v, "sdffs")
		}
		get barr() {}
		setWord2() {
			let mix = [...this.chars].slice(0, 3)
			mix[2] = "z"
			this.word2 = mix.join("")
		}
		syncFoo() {
			return produce(this, state => {
				state.foo = state.bar.baz
			})
		}
	}

	const state = new State()

	it("should work without creating a proxy for a getter property", () => {
		expect(state.chars).toEqual(["b", "a", "r"])
		const newState1 = produce(state, d => {
			d.setWord2()
		})
		const newState3 = produce(state, d => {
			d.barr = 2
		})
		expect(newState1.word2).toEqual("baz")
		//expect(newState3.foo).toEqual(2)

		/* expect(state.bar).toEqual({baz: 1})
		const newState2 = state.syncFoo()
		expect(newState2.foo).toEqual(1)
		expect(newState2.bar).toEqual({baz: 1}) */
	})
})
