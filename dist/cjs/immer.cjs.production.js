"use strict"
var be = Object.defineProperty
var Xe = Object.getOwnPropertyDescriptor
var Ze = Object.getOwnPropertyNames
var et = Object.prototype.hasOwnProperty
var tt = (e, t) => {
		for (var r in t) be(e, r, {get: t[r], enumerable: !0})
	},
	rt = (e, t, r, n) => {
		if ((t && typeof t == "object") || typeof t == "function")
			for (let a of Ze(t))
				!et.call(e, a) &&
					a !== r &&
					be(e, a, {
						get: () => t[a],
						enumerable: !(n = Xe(t, a)) || n.enumerable
					})
		return e
	}
var nt = e => rt(be({}, "__esModule", {value: !0}), e)
var It = {}
tt(It, {
	Immer: () => he,
	applyPatches: () => mt,
	castDraft: () => gt,
	castImmutable: () => xt,
	createDraft: () => St,
	current: () => Me,
	enableArrayMethods: () => Qe,
	enableMapSet: () => Je,
	enablePatches: () => Ye,
	finishDraft: () => Pt,
	freeze: () => J,
	immerable: () => j,
	isDraft: () => w,
	isDraftable: () => D,
	isNothing: () => At,
	nothing: () => L,
	original: () => ke,
	produce: () => lt,
	produceWithPatches: () => yt,
	setAutoFreeze: () => dt,
	setUseStrictIteration: () => ht,
	setUseStrictShallowCopy: () => pt
})
module.exports = nt(It)
var L = Symbol.for("immer-nothing"),
	j = Symbol.for("immer-draftable"),
	y = Symbol.for("immer-state")
function b(e, ...t) {
	throw new Error(
		`[Immer] minified error nr: ${e}. Full error at: https://bit.ly/3cXEKWf`
	)
}
var F = Object,
	V = F.getPrototypeOf,
	te = "constructor",
	re = "prototype",
	Se = "configurable",
	ce = "enumerable",
	se = "writable",
	ne = "value",
	w = e => !!e && !!e[y]
function D(e) {
	return e ? ze(e) || $(e) || !!e[j] || !!e[te]?.[j] || q(e) || Y(e) : !1
}
var at = F[re][te].toString(),
	Re = new WeakMap()
function ze(e) {
	if (!e || !H(e)) return !1
	let t = V(e)
	if (t === null || t === F[re]) return !0
	let r = F.hasOwnProperty.call(t, te) && t[te]
	if (r === Object) return !0
	if (!B(r)) return !1
	let n = Re.get(r)
	return (
		n === void 0 && ((n = Function.toString.call(r)), Re.set(r, n)), n === at
	)
}
function ke(e) {
	return w(e) || b(15, e), e[y].t
}
function z(e, t, r = !0) {
	K(e) === 0
		? (r ? Reflect.ownKeys(e) : F.keys(e)).forEach(a => {
				t(a, e[a], e)
		  })
		: e.forEach((n, a) => t(a, n, e))
}
function K(e) {
	let t = e[y]
	return t ? t.r : $(e) ? 1 : q(e) ? 2 : Y(e) ? 3 : 0
}
var G = (e, t, r = K(e)) =>
		r === 2 ? e.has(t) : F[re].hasOwnProperty.call(e, t),
	U = (e, t, r = K(e)) => (r === 2 ? e.get(t) : e[t]),
	ae = (e, t, r, n = K(e)) => {
		n === 2 ? e.set(t, r) : n === 3 ? e.add(r) : (e[t] = r)
	}
function Ue(e, t) {
	return e === t ? e !== 0 || 1 / e === 1 / t : e !== e && t !== t
}
var $ = Array.isArray,
	q = e => e instanceof Map,
	Y = e => e instanceof Set,
	H = e => typeof e == "object",
	B = e => typeof e == "function",
	Pe = e => typeof e == "boolean"
function Le(e) {
	let t = +e
	return Number.isInteger(t) && String(t) === e
}
var Oe = e => (H(e) ? e?.[y] : null),
	O = e => e.e || e.t,
	je = e => {
		let t = Oe(e)
		return t ? t.e ?? t.t : e
	},
	ge = e => (e.s ? e.e : e.t)
function fe(e, t) {
	if (q(e)) return new Map(e)
	if (Y(e)) return new Set(e)
	if ($(e)) return Array[re].slice.call(e)
	let r = ze(e)
	if (t === !0 || (t === "class_only" && !r)) {
		let n = F.getOwnPropertyDescriptors(e)
		delete n[y]
		let a = Reflect.ownKeys(n)
		for (let i = 0; i < a.length; i++) {
			let d = a[i],
				S = n[d]
			S[se] === !1 && ((S[se] = !0), (S[Se] = !0)),
				(S.get || S.set) &&
					(n[d] = {[Se]: !0, [se]: !0, [ce]: S[ce], [ne]: e[d]})
		}
		return F.create(V(e), n)
	} else {
		let n = V(e)
		if (n !== null && r) return {...e}
		let a = F.create(n)
		return F.assign(a, e)
	}
}
function J(e, t = !1) {
	return (
		oe(e) ||
			w(e) ||
			!D(e) ||
			(K(e) > 1 &&
				F.defineProperties(e, {set: me, add: me, clear: me, delete: me}),
			F.freeze(e),
			t &&
				z(
					e,
					(r, n) => {
						J(n, !0)
					},
					!1
				)),
		e
	)
}
function ot() {
	b(2)
}
var me = {[ne]: ot}
function oe(e) {
	return e === null || !H(e) ? !0 : F.isFrozen(e)
}
var W = "MapSet",
	Q = "Patches",
	le = "ArrayMethods",
	xe = {}
function v(e) {
	let t = xe[e]
	return t || b(0, e), t
}
var De = e => !!xe[e]
function ie(e, t) {
	xe[e] || (xe[e] = t)
}
var ye,
	X = () => ye,
	it = (e, t) => ({
		o: [],
		i: e,
		l: t,
		F: !0,
		m: 0,
		A: new Set(),
		T: new Set(),
		I: De(W) ? v(W) : void 0,
		E: De(le) ? v(le) : void 0
	})
function _e(e, t) {
	t && ((e.P = v(Q)), (e.p = []), (e.d = []), (e.C = t))
}
function de(e) {
	Ae(e), e.o.forEach(st), (e.o = null)
}
function Ae(e) {
	e === ye && (ye = e.i)
}
var Ee = e => (ye = it(ye, e))
function st(e) {
	let t = e[y]
	t.r === 0 || t.r === 1 ? t.b() : (t.x = !0)
}
function we(e, t) {
	t.m = t.o.length
	let r = t.o[0]
	if (e !== void 0 && e !== r) {
		r[y].s && (de(t), b(4)), D(e) && (e = Ve(t, e))
		let {P: a} = t
		a && a.M(r[y].t, e, t)
	} else e = Ve(t, r)
	return ct(t, e, !0), de(t), t.p && t.C(t.p, t.d), e !== L ? e : void 0
}
function Ve(e, t) {
	if (oe(t)) return t
	let r = t[y]
	if (!r) return Ne(t, e.A, e)
	if (!Ie(r, e)) return t
	if (!r.s) return r.t
	if (!r.u) {
		let {f: n} = r
		if (n) for (; n.length > 0; ) n.pop()(e)
		He(r, e)
	}
	return r.e
}
function ct(e, t, r = !1) {
	!e.i && e.l.h && e.F && J(t, r)
}
function Be(e) {
	;(e.u = !0), e.n.m--
}
var Ie = (e, t) => e.n === t,
	ut = []
function ve(e, t, r, n) {
	let a = O(e),
		i = e.r
	if (n !== void 0 && U(a, n, i) === t) {
		ae(a, n, r, i)
		return
	}
	if (!e.D) {
		let S = (e.D = new Map())
		z(a, (p, M) => {
			if (w(M)) {
				let o = S.get(M) || []
				o.push(p), S.set(M, o)
			}
		})
	}
	let d = e.D.get(t) ?? ut
	for (let S of d) ae(a, S, r, i)
}
function Ke(e, t, r) {
	e.f.push(function(a) {
		let i = t
		if (!i || !Ie(i, a)) return
		a.I?.fixSetContents(i)
		let d = ge(i)
		ve(e, i.c ?? i, d, r), He(i, a)
	})
}
function He(e, t) {
	if (
		e.s &&
		!e.u &&
		(e.r === 3 || (e.r === 1 && e.R) || (e.a?.size ?? 0) > 0)
	) {
		let {P: n} = t
		if (n) {
			let a = n.getPath(e)
			a && n.O(e, a, t)
		}
		Be(e)
	}
}
function We(e, t, r) {
	let {n} = e
	if (w(r)) {
		let a = r[y]
		Ie(a, n) &&
			a.f.push(function() {
				Z(e)
				let d = ge(a)
				ve(e, r, d, t)
			})
	} else
		D(r) &&
			e.f.push(function() {
				let i = O(e)
				U(i, t, e.r) === r &&
					n.o.length > 1 &&
					(e.a.get(t) ?? !1) === !0 &&
					e.e &&
					Ne(U(e.e, t, e.r), n.A, n)
			})
}
function Ne(e, t, r) {
	return (
		(!r.l.h && r.m < 1) ||
			w(e) ||
			t.has(e) ||
			!D(e) ||
			oe(e) ||
			(t.add(e),
			z(e, (n, a) => {
				if (w(a)) {
					let i = a[y]
					if (Ie(i, r)) {
						let d = ge(i)
						ae(e, n, d, e.r), Be(i)
					}
				} else D(a) && Ne(a, t, r)
			})),
		e
	)
}
function Ge(e, t) {
	let r = $(e),
		n = {
			r: r ? 1 : 0,
			n: t ? t.n : X(),
			s: !1,
			u: !1,
			a: void 0,
			i: t,
			t: e,
			c: null,
			e: null,
			b: null,
			S: !1,
			f: void 0
		},
		a = n,
		i = Ce
	r && ((a = [n]), (i = pe))
	let {revoke: d, proxy: S} = Proxy.revocable(a, i)
	return (n.c = S), (n.b = d), [S, n]
}
var Ce = {
		get(e, t) {
			if (t === y) return e
			let r = e.n.E,
				n = e.r === 1 && typeof t == "string"
			if (n && r?.isArrayOperationMethod(t))
				return r.createMethodInterceptor(e, t)
			let a = O(e)
			if (!G(a, t, e.r)) return ft(e, a, t)
			let i = a[t]
			if (
				e.u ||
				!D(i) ||
				(n &&
					e.operationMethod &&
					r?.isMutatingArrayMethod(e.operationMethod) &&
					Le(t))
			)
				return i
			if (i === Fe(e.t, t)) {
				Z(e)
				let d = e.r === 1 ? +t : t,
					S = ee(e.n, i, e, d)
				return (e.e[d] = S)
			}
			return i
		},
		has(e, t) {
			return t in O(e)
		},
		ownKeys(e) {
			return Reflect.ownKeys(O(e))
		},
		set(e, t, r) {
			let n = $e(O(e), t)
			if (n?.set) return n.set.call(e.c, r), !0
			if (!e.s) {
				let a = Fe(O(e), t),
					i = a?.[y]
				if (i && i.t === r) return (e.e[t] = r), e.a.set(t, !1), !0
				if (Ue(r, a) && (r !== void 0 || G(e.t, t, e.r))) return !0
				Z(e), k(e)
			}
			return (
				(e.e[t] === r && (r !== void 0 || t in e.e)) ||
					(Number.isNaN(r) && Number.isNaN(e.e[t])) ||
					((e.e[t] = r), e.a.set(t, !0), We(e, t, r)),
				!0
			)
		},
		deleteProperty(e, t) {
			return (
				Z(e),
				Fe(e.t, t) !== void 0 || t in e.t
					? (e.a.set(t, !1), k(e))
					: e.a.delete(t),
				e.e && delete e.e[t],
				!0
			)
		},
		getOwnPropertyDescriptor(e, t) {
			let r = O(e),
				n = Reflect.getOwnPropertyDescriptor(r, t)
			return (
				n && {
					[se]: !0,
					[Se]: e.r !== 1 || t !== "length",
					[ce]: n[ce],
					[ne]: r[t]
				}
			)
		},
		defineProperty() {
			b(11)
		},
		getPrototypeOf(e) {
			return V(e.t)
		},
		setPrototypeOf() {
			b(12)
		}
	},
	pe = {}
z(Ce, (e, t) => {
	pe[e] = function() {
		let r = arguments
		return (r[0] = r[0][0]), t.apply(this, r)
	}
})
pe.deleteProperty = function(e, t) {
	return pe.set.call(this, e, t, void 0)
}
pe.set = function(e, t, r) {
	return Ce.set.call(this, e[0], t, r, e[0])
}
function Fe(e, t) {
	let r = e[y]
	return (r ? O(r) : e)[t]
}
function ft(e, t, r) {
	let n = $e(t, r)
	return n ? (ne in n ? n[ne] : n.get?.call(e.c)) : void 0
}
function $e(e, t) {
	if (!(t in e)) return
	let r = V(e)
	for (; r; ) {
		let n = Object.getOwnPropertyDescriptor(r, t)
		if (n) return n
		r = V(r)
	}
}
function k(e) {
	e.s || ((e.s = !0), e.i && k(e.i))
}
function Z(e) {
	e.e || ((e.a = new Map()), (e.e = fe(e.t, e.n.l.g)))
}
var he = class {
	constructor(t) {
		this.h = !0
		this.g = !1
		this._ = !1
		this.produce = (t, r, n) => {
			if (B(t) && !B(r)) {
				let i = r
				r = t
				let d = this
				return function(p = i, ...M) {
					return d.produce(p, o => r.call(this, o, ...M))
				}
			}
			B(r) || b(6), n !== void 0 && !B(n) && b(7)
			let a
			if (D(t)) {
				let i = Ee(this),
					d = ee(i, t, void 0),
					S = !0
				try {
					;(a = r(d)), (S = !1)
				} finally {
					S ? de(i) : Ae(i)
				}
				return _e(i, n), we(a, i)
			} else if (!t || !H(t)) {
				if (
					((a = r(t)),
					a === void 0 && (a = t),
					a === L && (a = void 0),
					this.h && J(a, !0),
					n)
				) {
					let i = [],
						d = []
					v(Q).M(t, a, {p: i, d}), n(i, d)
				}
				return a
			} else b(1, t)
		}
		this.produceWithPatches = (t, r) => {
			if (B(t)) return (d, ...S) => this.produceWithPatches(d, p => t(p, ...S))
			let n, a
			return [
				this.produce(t, r, (d, S) => {
					;(n = d), (a = S)
				}),
				n,
				a
			]
		}
		Pe(t?.autoFreeze) && this.setAutoFreeze(t.autoFreeze),
			Pe(t?.useStrictShallowCopy) &&
				this.setUseStrictShallowCopy(t.useStrictShallowCopy),
			Pe(t?.useStrictIteration) &&
				this.setUseStrictIteration(t.useStrictIteration)
	}
	createDraft(t) {
		D(t) || b(8), w(t) && (t = Me(t))
		let r = Ee(this),
			n = ee(r, t, void 0)
		return (n[y].S = !0), Ae(r), n
	}
	finishDraft(t, r) {
		let n = t && t[y]
		;(!n || !n.S) && b(9)
		let {n: a} = n
		return _e(a, r), we(void 0, a)
	}
	setAutoFreeze(t) {
		this.h = t
	}
	setUseStrictShallowCopy(t) {
		this.g = t
	}
	setUseStrictIteration(t) {
		this._ = t
	}
	shouldUseStrictIteration() {
		return this._
	}
	applyPatches(t, r) {
		let n
		for (n = r.length - 1; n >= 0; n--) {
			let i = r[n]
			if (i.path.length === 0 && i.op === "replace") {
				t = i.value
				break
			}
		}
		n > -1 && (r = r.slice(n + 1))
		let a = v(Q).N
		return w(t) ? a(t, r) : this.produce(t, i => a(i, r))
	}
}
function ee(e, t, r, n) {
	let [a, i] = q(t) ? v(W).w(t, r) : Y(t) ? v(W).v(t, r) : Ge(t, r)
	return (
		(r?.n ?? X()).o.push(a),
		(i.f = r?.f ?? []),
		(i.y = n),
		r && n !== void 0
			? Ke(r, i, n)
			: i.f.push(function(p) {
					p.I?.fixSetContents(i)
					let {P: M} = p
					i.s && M && M.O(i, [], p)
			  }),
		a
	)
}
function Me(e) {
	return w(e) || b(10, e), qe(e)
}
function qe(e) {
	if (!D(e) || oe(e)) return e
	let t = e[y],
		r,
		n = !0
	if (t) {
		if (!t.s) return t.t
		;(t.u = !0), (r = fe(e, t.n.l.g)), (n = t.n.l.shouldUseStrictIteration())
	} else r = fe(e, !0)
	return (
		z(
			r,
			(a, i) => {
				ae(r, a, qe(i))
			},
			n
		),
		t && (t.u = !1),
		r
	)
}
function Ye() {
	function t(c, P = []) {
		if ("key_" in c && c.y !== void 0) {
			let m = c.i.e ?? c.i.t,
				x = Oe(U(m, c.y)),
				A = U(m, c.y)
			if (
				A === void 0 ||
				(A !== c.c && A !== c.t && A !== c.e) ||
				(x != null && x.t !== c.t)
			)
				return null
			let s = c.i.r === 3,
				l
			if (s) {
				let h = c.i
				l = Array.from(h.o.keys()).indexOf(c.y)
			} else l = c.y
			if (!((s && m.size > l) || G(m, l))) return null
			P.push(l)
		}
		if (c.i) return t(c.i, P)
		P.reverse()
		try {
			r(c.e, P)
		} catch {
			return null
		}
		return P
	}
	function r(c, P) {
		let m = c
		for (let x = 0; x < P.length - 1; x++) {
			let A = P[x]
			if (((m = U(m, A)), !H(m) || m === null))
				throw new Error(`Cannot resolve path at '${P.join("/")}'`)
		}
		return m
	}
	let n = "replace",
		a = "add",
		i = "remove"
	function d(c, P, m) {
		if (c.n.T.has(c)) return
		c.n.T.add(c)
		let {p: x, d: A} = m
		switch (c.r) {
			case 0:
			case 2:
				return p(c, P, x, A)
			case 1:
				return S(c, P, x, A)
			case 3:
				return M(c, P, x, A)
		}
	}
	function S(c, P, m, x) {
		let {t: A, a: s} = c,
			l = c.e
		l.length < A.length && (([A, l] = [l, A]), ([m, x] = [x, m]))
		let h = c.R === !0
		for (let f = 0; f < A.length; f++) {
			let I = l[f],
				E = A[f]
			if ((h || s?.get(f.toString())) && I !== E) {
				let C = I?.[y]
				if (C && C.s) continue
				let R = P.concat([f])
				m.push({op: n, path: R, value: _(I)}),
					x.push({op: n, path: R, value: _(E)})
			}
		}
		for (let f = A.length; f < l.length; f++) {
			let I = P.concat([f])
			m.push({op: a, path: I, value: _(l[f])})
		}
		for (let f = l.length - 1; A.length <= f; --f) {
			let I = P.concat([f])
			x.push({op: i, path: I})
		}
	}
	function p(c, P, m, x) {
		let {t: A, e: s, r: l} = c
		z(c.a, (h, f) => {
			let I = U(A, h, l),
				E = U(s, h, l),
				T = f ? (G(A, h) ? n : a) : i
			if (I === E && T === n) return
			let C = P.concat(h)
			m.push(T === i ? {op: T, path: C} : {op: T, path: C, value: _(E)}),
				x.push(
					T === a
						? {op: i, path: C}
						: T === i
						? {op: a, path: C, value: _(I)}
						: {op: n, path: C, value: _(I)}
				)
		})
	}
	function M(c, P, m, x) {
		let {t: A, e: s} = c,
			l = 0
		A.forEach(h => {
			if (!s.has(h)) {
				let f = P.concat([l])
				m.push({op: i, path: f, value: h}),
					x.unshift({op: a, path: f, value: h})
			}
			l++
		}),
			(l = 0),
			s.forEach(h => {
				if (!A.has(h)) {
					let f = P.concat([l])
					m.push({op: a, path: f, value: h}),
						x.unshift({op: i, path: f, value: h})
				}
				l++
			})
	}
	function o(c, P, m) {
		let {p: x, d: A} = m
		x.push({op: n, path: [], value: P === L ? void 0 : P}),
			A.push({op: n, path: [], value: c})
	}
	function u(c, P) {
		return (
			P.forEach(m => {
				let {path: x, op: A} = m,
					s = c
				for (let I = 0; I < x.length - 1; I++) {
					let E = K(s),
						T = x[I]
					typeof T != "string" && typeof T != "number" && (T = "" + T),
						(E === 0 || E === 1) &&
							(T === "__proto__" || T === te) &&
							b(16 + 3),
						B(s) && T === re && b(16 + 3),
						(s = U(s, T)),
						H(s) || b(16 + 2, x.join("/"))
				}
				let l = K(s),
					h = g(m.value),
					f = x[x.length - 1]
				switch (A) {
					case n:
						switch (l) {
							case 2:
								return s.set(f, h)
							case 3:
								b(16)
							default:
								return (s[f] = h)
						}
					case a:
						switch (l) {
							case 1:
								return f === "-" ? s.push(h) : s.splice(f, 0, h)
							case 2:
								return s.set(f, h)
							case 3:
								return s.add(h)
							default:
								return (s[f] = h)
						}
					case i:
						switch (l) {
							case 1:
								return s.splice(f, 1)
							case 2:
								return s.delete(f)
							case 3:
								return s.delete(m.value)
							default:
								return delete s[f]
						}
					default:
						b(16 + 1, A)
				}
			}),
			c
		)
	}
	function g(c) {
		if (!D(c)) return c
		if ($(c)) return c.map(g)
		if (q(c)) return new Map(Array.from(c.entries()).map(([m, x]) => [m, g(x)]))
		if (Y(c)) return new Set(Array.from(c).map(g))
		let P = Object.create(V(c))
		for (let m in c) P[m] = g(c[m])
		return G(c, j) && (P[j] = c[j]), P
	}
	function _(c) {
		return w(c) ? g(c) : c
	}
	ie(Q, {N: u, O: d, M: o, getPath: t})
}
function Je() {
	class e extends Map {
		constructor(o, u) {
			super()
			this[y] = {
				r: 2,
				i: u,
				n: u ? u.n : X(),
				s: !1,
				u: !1,
				e: void 0,
				a: void 0,
				t: o,
				c: this,
				S: !1,
				x: !1,
				f: []
			}
		}
		get size() {
			return O(this[y]).size
		}
		has(o) {
			return O(this[y]).has(o)
		}
		set(o, u) {
			let g = this[y]
			return (
				d(g),
				(!O(g).has(o) || O(g).get(o) !== u) &&
					(r(g), k(g), g.a.set(o, !0), g.e.set(o, u), g.a.set(o, !0)),
				this
			)
		}
		delete(o) {
			if (!this.has(o)) return !1
			let u = this[y]
			return (
				d(u),
				r(u),
				k(u),
				u.t.has(o) ? u.a.set(o, !1) : u.a.delete(o),
				u.e.delete(o),
				!0
			)
		}
		clear() {
			let o = this[y]
			d(o),
				O(o).size &&
					(r(o),
					k(o),
					(o.a = new Map()),
					z(o.t, u => {
						o.a.set(u, !1)
					}),
					o.e.clear())
		}
		forEach(o, u) {
			let g = this[y]
			O(g).forEach((_, c, P) => {
				o.call(u, this.get(c), c, this)
			})
		}
		get(o) {
			let u = this[y]
			d(u)
			let g = O(u).get(o)
			if (u.u || !D(g) || g !== u.t.get(o)) return g
			let _ = ee(u.n, g, u, o)
			return r(u), u.e.set(o, _), _
		}
		keys() {
			return O(this[y]).keys()
		}
		values() {
			let o = this.keys()
			return {
				[Symbol.iterator]: () => this.values(),
				next: () => {
					let u = o.next()
					return u.done ? u : {done: !1, value: this.get(u.value)}
				}
			}
		}
		entries() {
			let o = this.keys()
			return {
				[Symbol.iterator]: () => this.entries(),
				next: () => {
					let u = o.next()
					if (u.done) return u
					let g = this.get(u.value)
					return {done: !1, value: [u.value, g]}
				}
			}
		}
		[(y, Symbol.iterator)]() {
			return this.entries()
		}
	}
	function t(p, M) {
		let o = new e(p, M)
		return [o, o[y]]
	}
	function r(p) {
		p.e || ((p.a = new Map()), (p.e = new Map(p.t)))
	}
	class n extends Set {
		constructor(o, u) {
			super()
			this[y] = {
				r: 3,
				i: u,
				n: u ? u.n : X(),
				s: !1,
				u: !1,
				e: void 0,
				t: o,
				c: this,
				o: new Map(),
				x: !1,
				S: !1,
				a: void 0,
				f: []
			}
		}
		get size() {
			return O(this[y]).size
		}
		has(o) {
			let u = this[y]
			return (
				d(u),
				u.e ? !!(u.e.has(o) || (u.o.has(o) && u.e.has(u.o.get(o)))) : u.t.has(o)
			)
		}
		add(o) {
			let u = this[y]
			return d(u), this.has(o) || (i(u), k(u), u.e.add(o)), this
		}
		delete(o) {
			if (!this.has(o)) return !1
			let u = this[y]
			return (
				d(u),
				i(u),
				k(u),
				u.e.delete(o) || (u.o.has(o) ? u.e.delete(u.o.get(o)) : !1)
			)
		}
		clear() {
			let o = this[y]
			d(o), O(o).size && (i(o), k(o), o.e.clear())
		}
		values() {
			let o = this[y]
			return d(o), i(o), o.e.values()
		}
		entries() {
			let o = this[y]
			return d(o), i(o), o.e.entries()
		}
		keys() {
			return this.values()
		}
		[(y, Symbol.iterator)]() {
			return this.values()
		}
		forEach(o, u) {
			let g = this.values(),
				_ = g.next()
			for (; !_.done; ) o.call(u, _.value, _.value, this), (_ = g.next())
		}
	}
	function a(p, M) {
		let o = new n(p, M)
		return [o, o[y]]
	}
	function i(p) {
		p.e ||
			((p.e = new Set()),
			p.t.forEach(M => {
				if (D(M)) {
					let o = ee(p.n, M, p, M)
					p.o.set(M, o), p.e.add(o)
				} else p.e.add(M)
			}))
	}
	function d(p) {
		p.x && b(3, JSON.stringify(O(p)))
	}
	function S(p) {
		if (p.r === 3 && p.e) {
			let M = new Set(p.e)
			p.e.clear(),
				M.forEach(o => {
					p.e.add(je(o))
				})
		}
	}
	ie(W, {w: t, v: a, fixSetContents: S})
}
function Qe() {
	let e = new Set(["shift", "unshift"]),
		t = new Set(["push", "pop"]),
		r = new Set([...t, ...e]),
		n = new Set(["reverse", "sort"]),
		a = new Set([...r, ...n, "splice"]),
		i = new Set(["find", "findLast"]),
		d = new Set([
			"filter",
			"slice",
			"concat",
			"flat",
			...i,
			"findIndex",
			"findLastIndex",
			"some",
			"every",
			"indexOf",
			"lastIndexOf",
			"includes",
			"join",
			"toString",
			"toLocaleString"
		])
	function S(s) {
		return a.has(s)
	}
	function p(s) {
		return d.has(s)
	}
	function M(s) {
		return S(s) || p(s)
	}
	function o(s, l) {
		s.operationMethod = l
	}
	function u(s) {
		s.operationMethod = void 0
	}
	function g(s, l, h = !0) {
		Z(s)
		let f = l()
		return k(s), h && s.a.set("length", !0), f
	}
	function _(s) {
		s.R = !0
	}
	function c(s, l) {
		return s < 0 ? Math.max(l + s, 0) : Math.min(s, l)
	}
	function P(s, l, h) {
		return g(s, () => {
			let f = s.e[l](...h)
			return e.has(l) && _(s), r.has(l) ? f : s.c
		})
	}
	function m(s, l, h) {
		return g(s, () => (s.e[l](...h), _(s), s.c), !1)
	}
	function x(s, l) {
		return function(...f) {
			let I = l
			o(s, I)
			try {
				if (S(I)) {
					if (r.has(I)) return P(s, I, f)
					if (n.has(I)) return m(s, I, f)
					if (I === "splice") {
						let E = g(s, () => s.e.splice(...f))
						return _(s), E
					}
				} else return A(s, I, f)
			} finally {
				u(s)
			}
		}
	}
	function A(s, l, h) {
		let f = O(s)
		if (l === "filter") {
			let I = h[0],
				E = []
			for (let T = 0; T < f.length; T++) I(f[T], T, f) && E.push(s.c[T])
			return E
		}
		if (i.has(l)) {
			let I = h[0],
				E = l === "find",
				T = E ? 1 : -1,
				C = E ? 0 : f.length - 1
			for (let R = C; R >= 0 && R < f.length; R += T)
				if (I(f[R], R, f)) return s.c[R]
			return
		}
		if (l === "slice") {
			let I = h[0] ?? 0,
				E = h[1] ?? f.length,
				T = c(I, f.length),
				C = c(E, f.length),
				R = []
			for (let Te = T; Te < C; Te++) R.push(s.c[Te])
			return R
		}
		return f[l](...h)
	}
	ie(le, {
		createMethodInterceptor: x,
		isArrayOperationMethod: M,
		isMutatingArrayMethod: S
	})
}
var N = new he(),
	lt = N.produce,
	yt = N.produceWithPatches.bind(N),
	dt = N.setAutoFreeze.bind(N),
	pt = N.setUseStrictShallowCopy.bind(N),
	ht = N.setUseStrictIteration.bind(N),
	mt = N.applyPatches.bind(N),
	St = N.createDraft.bind(N),
	Pt = N.finishDraft.bind(N),
	gt = e => e,
	xt = e => e
function At(e) {
	return e === L
}
0 &&
	(module.exports = {
		Immer,
		applyPatches,
		castDraft,
		castImmutable,
		createDraft,
		current,
		enableArrayMethods,
		enableMapSet,
		enablePatches,
		finishDraft,
		freeze,
		immerable,
		isDraft,
		isDraftable,
		isNothing,
		nothing,
		original,
		produce,
		produceWithPatches,
		setAutoFreeze,
		setUseStrictIteration,
		setUseStrictShallowCopy
	})
//# sourceMappingURL=immer.cjs.production.js.map
