var B = Symbol.for("immer-nothing"),
	v = Symbol.for("immer-draftable"),
	y = Symbol.for("immer-state")
function b(e, ...t) {
	throw new Error(
		`[Immer] minified error nr: ${e}. Full error at: https://bit.ly/3cXEKWf`
	)
}
var F = Object,
	L = F.getPrototypeOf,
	ee = "constructor",
	te = "prototype",
	me = "configurable",
	ce = "enumerable",
	se = "writable",
	re = "value",
	w = e => !!e && !!e[y]
function _(e) {
	return e ? Re(e) || $(e) || !!e[v] || !!e[ee]?.[v] || q(e) || Y(e) : !1
}
var $e = F[te][ee].toString(),
	Ce = new WeakMap()
function Re(e) {
	if (!e || !H(e)) return !1
	let t = L(e)
	if (t === null || t === F[te]) return !0
	let r = F.hasOwnProperty.call(t, ee) && t[ee]
	if (r === Object) return !0
	if (!j(r)) return !1
	let n = Ce.get(r)
	return (
		n === void 0 && ((n = Function.toString.call(r)), Ce.set(r, n)), n === $e
	)
}
function qe(e) {
	return w(e) || b(15, e), e[y].t
}
function z(e, t, r = !0) {
	K(e) === 0
		? (r ? Reflect.ownKeys(e) : F.keys(e)).forEach(o => {
				t(o, e[o], e)
		  })
		: e.forEach((n, o) => t(o, n, e))
}
function K(e) {
	let t = e[y]
	return t ? t.r : $(e) ? 1 : q(e) ? 2 : Y(e) ? 3 : 0
}
var G = (e, t, r = K(e)) =>
		r === 2 ? e.has(t) : F[te].hasOwnProperty.call(e, t),
	U = (e, t, r = K(e)) => (r === 2 ? e.get(t) : e[t]),
	ne = (e, t, r, n = K(e)) => {
		n === 2 ? e.set(t, r) : n === 3 ? e.add(r) : (e[t] = r)
	}
function ze(e, t) {
	return e === t ? e !== 0 || 1 / e === 1 / t : e !== e && t !== t
}
var $ = Array.isArray,
	q = e => e instanceof Map,
	Y = e => e instanceof Set,
	H = e => typeof e == "object",
	j = e => typeof e == "function",
	Se = e => typeof e == "boolean"
function ke(e) {
	let t = +e
	return Number.isInteger(t) && String(t) === e
}
var Te = e => (H(e) ? e?.[y] : null),
	O = e => e.e || e.t,
	Ue = e => {
		let t = Te(e)
		return t ? t.e ?? t.t : e
	},
	Pe = e => (e.s ? e.e : e.t)
function fe(e, t) {
	if (q(e)) return new Map(e)
	if (Y(e)) return new Set(e)
	if ($(e)) return Array[te].slice.call(e)
	let r = Re(e)
	if (t === !0 || (t === "class_only" && !r)) {
		let n = F.getOwnPropertyDescriptors(e)
		delete n[y]
		let o = Reflect.ownKeys(n)
		for (let i = 0; i < o.length; i++) {
			let d = o[i],
				S = n[d]
			S[se] === !1 && ((S[se] = !0), (S[me] = !0)),
				(S.get || S.set) &&
					(n[d] = {[me]: !0, [se]: !0, [ce]: S[ce], [re]: e[d]})
		}
		return F.create(L(e), n)
	} else {
		let n = L(e)
		if (n !== null && r) return {...e}
		let o = F.create(n)
		return F.assign(o, e)
	}
}
function ae(e, t = !1) {
	return (
		oe(e) ||
			w(e) ||
			!_(e) ||
			(K(e) > 1 &&
				F.defineProperties(e, {set: he, add: he, clear: he, delete: he}),
			F.freeze(e),
			t &&
				z(
					e,
					(r, n) => {
						ae(n, !0)
					},
					!1
				)),
		e
	)
}
function Ye() {
	b(2)
}
var he = {[re]: Ye}
function oe(e) {
	return e === null || !H(e) ? !0 : F.isFrozen(e)
}
var W = "MapSet",
	J = "Patches",
	le = "ArrayMethods",
	ge = {}
function V(e) {
	let t = ge[e]
	return t || b(0, e), t
}
var be = e => !!ge[e]
function ie(e, t) {
	ge[e] || (ge[e] = t)
}
var ye,
	Q = () => ye,
	Je = (e, t) => ({
		o: [],
		i: e,
		l: t,
		F: !0,
		m: 0,
		A: new Set(),
		T: new Set(),
		I: be(W) ? V(W) : void 0,
		E: be(le) ? V(le) : void 0
	})
function Oe(e, t) {
	t && ((e.P = V(J)), (e.p = []), (e.d = []), (e.C = t))
}
function de(e) {
	xe(e), e.o.forEach(Qe), (e.o = null)
}
function xe(e) {
	e === ye && (ye = e.i)
}
var De = e => (ye = Je(ye, e))
function Qe(e) {
	let t = e[y]
	t.r === 0 || t.r === 1 ? t.b() : (t.x = !0)
}
function _e(e, t) {
	t.m = t.o.length
	let r = t.o[0]
	if (e !== void 0 && e !== r) {
		r[y].s && (de(t), b(4)), _(e) && (e = Le(t, e))
		let {P: o} = t
		o && o.M(r[y].t, e, t)
	} else e = Le(t, r)
	return Xe(t, e, !0), de(t), t.p && t.C(t.p, t.d), e !== B ? e : void 0
}
function Le(e, t) {
	if (oe(t)) return t
	let r = t[y]
	if (!r) return Ee(t, e.A, e)
	if (!Ae(r, e)) return t
	if (!r.s) return r.t
	if (!r.u) {
		let {f: n} = r
		if (n) for (; n.length > 0; ) n.pop()(e)
		ve(r, e)
	}
	return r.e
}
function Xe(e, t, r = !1) {
	!e.i && e.l.h && e.F && ae(t, r)
}
function je(e) {
	;(e.u = !0), e.n.m--
}
var Ae = (e, t) => e.n === t,
	Ze = []
function Ve(e, t, r, n) {
	let o = O(e),
		i = e.r
	if (n !== void 0 && U(o, n, i) === t) {
		ne(o, n, r, i)
		return
	}
	if (!e.D) {
		let S = (e.D = new Map())
		z(o, (p, M) => {
			if (w(M)) {
				let a = S.get(M) || []
				a.push(p), S.set(M, a)
			}
		})
	}
	let d = e.D.get(t) ?? Ze
	for (let S of d) ne(o, S, r, i)
}
function Be(e, t, r) {
	e.f.push(function(o) {
		let i = t
		if (!i || !Ae(i, o)) return
		o.I?.fixSetContents(i)
		let d = Pe(i)
		Ve(e, i.c ?? i, d, r), ve(i, o)
	})
}
function ve(e, t) {
	if (
		e.s &&
		!e.u &&
		(e.r === 3 || (e.r === 1 && e.R) || (e.a?.size ?? 0) > 0)
	) {
		let {P: n} = t
		if (n) {
			let o = n.getPath(e)
			o && n.O(e, o, t)
		}
		je(e)
	}
}
function Ke(e, t, r) {
	let {n} = e
	if (w(r)) {
		let o = r[y]
		Ae(o, n) &&
			o.f.push(function() {
				X(e)
				let d = Pe(o)
				Ve(e, r, d, t)
			})
	} else
		_(r) &&
			e.f.push(function() {
				let i = O(e)
				U(i, t, e.r) === r &&
					n.o.length > 1 &&
					(e.a.get(t) ?? !1) === !0 &&
					e.e &&
					Ee(U(e.e, t, e.r), n.A, n)
			})
}
function Ee(e, t, r) {
	return (
		(!r.l.h && r.m < 1) ||
			w(e) ||
			t.has(e) ||
			!_(e) ||
			oe(e) ||
			(t.add(e),
			z(e, (n, o) => {
				if (w(o)) {
					let i = o[y]
					if (Ae(i, r)) {
						let d = Pe(i)
						ne(e, n, d, e.r), je(i)
					}
				} else _(o) && Ee(o, t, r)
			})),
		e
	)
}
function He(e, t) {
	let r = $(e),
		n = {
			r: r ? 1 : 0,
			n: t ? t.n : Q(),
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
		o = n,
		i = Ne
	r && ((o = [n]), (i = pe))
	let {revoke: d, proxy: S} = Proxy.revocable(o, i)
	return (n.c = S), (n.b = d), [S, n]
}
var Ne = {
		get(e, t) {
			if (t === y) return e
			let r = e.n.E,
				n = e.r === 1 && typeof t == "string"
			if (n && r?.isArrayOperationMethod(t))
				return r.createMethodInterceptor(e, t)
			let o = O(e)
			if (!G(o, t, e.r)) return et(e, o, t)
			let i = o[t]
			if (
				e.u ||
				!_(i) ||
				(n &&
					e.operationMethod &&
					r?.isMutatingArrayMethod(e.operationMethod) &&
					ke(t))
			)
				return i
			if (i === we(e.t, t)) {
				X(e)
				let d = e.r === 1 ? +t : t,
					S = Z(e.n, i, e, d)
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
			let n = We(O(e), t)
			if (n?.set) return n.set.call(e.c, r), !0
			if (!e.s) {
				let o = we(O(e), t),
					i = o?.[y]
				if (i && i.t === r) return (e.e[t] = r), e.a.set(t, !1), !0
				if (ze(r, o) && (r !== void 0 || G(e.t, t, e.r))) return !0
				X(e), k(e)
			}
			return (
				(e.e[t] === r && (r !== void 0 || t in e.e)) ||
					(Number.isNaN(r) && Number.isNaN(e.e[t])) ||
					((e.e[t] = r), e.a.set(t, !0), Ke(e, t, r)),
				!0
			)
		},
		deleteProperty(e, t) {
			return (
				X(e),
				we(e.t, t) !== void 0 || t in e.t
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
					[me]: e.r !== 1 || t !== "length",
					[ce]: n[ce],
					[re]: r[t]
				}
			)
		},
		defineProperty() {
			b(11)
		},
		getPrototypeOf(e) {
			return L(e.t)
		},
		setPrototypeOf() {
			b(12)
		}
	},
	pe = {}
z(Ne, (e, t) => {
	pe[e] = function() {
		let r = arguments
		return (r[0] = r[0][0]), t.apply(this, r)
	}
})
pe.deleteProperty = function(e, t) {
	return pe.set.call(this, e, t, void 0)
}
pe.set = function(e, t, r) {
	return Ne.set.call(this, e[0], t, r, e[0])
}
function we(e, t) {
	let r = e[y]
	return (r ? O(r) : e)[t]
}
function et(e, t, r) {
	let n = We(t, r)
	return n ? (re in n ? n[re] : n.get?.call(e.c)) : void 0
}
function We(e, t) {
	if (!(t in e)) return
	let r = L(e)
	for (; r; ) {
		let n = Object.getOwnPropertyDescriptor(r, t)
		if (n) return n
		r = L(r)
	}
}
function k(e) {
	e.s || ((e.s = !0), e.i && k(e.i))
}
function X(e) {
	e.e || ((e.a = new Map()), (e.e = fe(e.t, e.n.l.g)))
}
var Ie = class {
	constructor(t) {
		this.h = !0
		this.g = !1
		this._ = !1
		this.produce = (t, r, n) => {
			if (j(t) && !j(r)) {
				let i = r
				r = t
				let d = this
				return function(p = i, ...M) {
					return d.produce(p, a => r.call(this, a, ...M))
				}
			}
			j(r) || b(6), n !== void 0 && !j(n) && b(7)
			let o
			if (_(t)) {
				let i = De(this),
					d = Z(i, t, void 0),
					S = !0
				try {
					;(o = r(d)), (S = !1)
				} finally {
					S ? de(i) : xe(i)
				}
				return Oe(i, n), _e(o, i)
			} else if (!t || !H(t)) {
				if (
					((o = r(t)),
					o === void 0 && (o = t),
					o === B && (o = void 0),
					this.h && ae(o, !0),
					n)
				) {
					let i = [],
						d = []
					V(J).M(t, o, {p: i, d}), n(i, d)
				}
				return o
			} else b(1, t)
		}
		this.produceWithPatches = (t, r) => {
			if (j(t)) return (d, ...S) => this.produceWithPatches(d, p => t(p, ...S))
			let n, o
			return [
				this.produce(t, r, (d, S) => {
					;(n = d), (o = S)
				}),
				n,
				o
			]
		}
		Se(t?.autoFreeze) && this.setAutoFreeze(t.autoFreeze),
			Se(t?.useStrictShallowCopy) &&
				this.setUseStrictShallowCopy(t.useStrictShallowCopy),
			Se(t?.useStrictIteration) &&
				this.setUseStrictIteration(t.useStrictIteration)
	}
	createDraft(t) {
		_(t) || b(8), w(t) && (t = Fe(t))
		let r = De(this),
			n = Z(r, t, void 0)
		return (n[y].S = !0), xe(r), n
	}
	finishDraft(t, r) {
		let n = t && t[y]
		;(!n || !n.S) && b(9)
		let {n: o} = n
		return Oe(o, r), _e(void 0, o)
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
		let o = V(J).N
		return w(t) ? o(t, r) : this.produce(t, i => o(i, r))
	}
}
function Z(e, t, r, n) {
	let [o, i] = q(t) ? V(W).w(t, r) : Y(t) ? V(W).v(t, r) : He(t, r)
	return (
		(r?.n ?? Q()).o.push(o),
		(i.f = r?.f ?? []),
		(i.y = n),
		r && n !== void 0
			? Be(r, i, n)
			: i.f.push(function(p) {
					p.I?.fixSetContents(i)
					let {P: M} = p
					i.s && M && M.O(i, [], p)
			  }),
		o
	)
}
function Fe(e) {
	return w(e) || b(10, e), Ge(e)
}
function Ge(e) {
	if (!_(e) || oe(e)) return e
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
			(o, i) => {
				ne(r, o, Ge(i))
			},
			n
		),
		t && (t.u = !1),
		r
	)
}
function tt() {
	function t(c, P = []) {
		if ("key_" in c && c.y !== void 0) {
			let m = c.i.e ?? c.i.t,
				x = Te(U(m, c.y)),
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
		o = "add",
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
				m.push({op: n, path: R, value: D(I)}),
					x.push({op: n, path: R, value: D(E)})
			}
		}
		for (let f = A.length; f < l.length; f++) {
			let I = P.concat([f])
			m.push({op: o, path: I, value: D(l[f])})
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
				T = f ? (G(A, h) ? n : o) : i
			if (I === E && T === n) return
			let C = P.concat(h)
			m.push(T === i ? {op: T, path: C} : {op: T, path: C, value: D(E)}),
				x.push(
					T === o
						? {op: i, path: C}
						: T === i
						? {op: o, path: C, value: D(I)}
						: {op: n, path: C, value: D(I)}
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
					x.unshift({op: o, path: f, value: h})
			}
			l++
		}),
			(l = 0),
			s.forEach(h => {
				if (!A.has(h)) {
					let f = P.concat([l])
					m.push({op: o, path: f, value: h}),
						x.unshift({op: i, path: f, value: h})
				}
				l++
			})
	}
	function a(c, P, m) {
		let {p: x, d: A} = m
		x.push({op: n, path: [], value: P === B ? void 0 : P}),
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
							(T === "__proto__" || T === ee) &&
							b(16 + 3),
						j(s) && T === te && b(16 + 3),
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
					case o:
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
		if (!_(c)) return c
		if ($(c)) return c.map(g)
		if (q(c)) return new Map(Array.from(c.entries()).map(([m, x]) => [m, g(x)]))
		if (Y(c)) return new Set(Array.from(c).map(g))
		let P = Object.create(L(c))
		for (let m in c) P[m] = g(c[m])
		return G(c, v) && (P[v] = c[v]), P
	}
	function D(c) {
		return w(c) ? g(c) : c
	}
	ie(J, {N: u, O: d, M: a, getPath: t})
}
function rt() {
	class e extends Map {
		constructor(a, u) {
			super()
			this[y] = {
				r: 2,
				i: u,
				n: u ? u.n : Q(),
				s: !1,
				u: !1,
				e: void 0,
				a: void 0,
				t: a,
				c: this,
				S: !1,
				x: !1,
				f: []
			}
		}
		get size() {
			return O(this[y]).size
		}
		has(a) {
			return O(this[y]).has(a)
		}
		set(a, u) {
			let g = this[y]
			return (
				d(g),
				(!O(g).has(a) || O(g).get(a) !== u) &&
					(r(g), k(g), g.a.set(a, !0), g.e.set(a, u), g.a.set(a, !0)),
				this
			)
		}
		delete(a) {
			if (!this.has(a)) return !1
			let u = this[y]
			return (
				d(u),
				r(u),
				k(u),
				u.t.has(a) ? u.a.set(a, !1) : u.a.delete(a),
				u.e.delete(a),
				!0
			)
		}
		clear() {
			let a = this[y]
			d(a),
				O(a).size &&
					(r(a),
					k(a),
					(a.a = new Map()),
					z(a.t, u => {
						a.a.set(u, !1)
					}),
					a.e.clear())
		}
		forEach(a, u) {
			let g = this[y]
			O(g).forEach((D, c, P) => {
				a.call(u, this.get(c), c, this)
			})
		}
		get(a) {
			let u = this[y]
			d(u)
			let g = O(u).get(a)
			if (u.u || !_(g) || g !== u.t.get(a)) return g
			let D = Z(u.n, g, u, a)
			return r(u), u.e.set(a, D), D
		}
		keys() {
			return O(this[y]).keys()
		}
		values() {
			let a = this.keys()
			return {
				[Symbol.iterator]: () => this.values(),
				next: () => {
					let u = a.next()
					return u.done ? u : {done: !1, value: this.get(u.value)}
				}
			}
		}
		entries() {
			let a = this.keys()
			return {
				[Symbol.iterator]: () => this.entries(),
				next: () => {
					let u = a.next()
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
		let a = new e(p, M)
		return [a, a[y]]
	}
	function r(p) {
		p.e || ((p.a = new Map()), (p.e = new Map(p.t)))
	}
	class n extends Set {
		constructor(a, u) {
			super()
			this[y] = {
				r: 3,
				i: u,
				n: u ? u.n : Q(),
				s: !1,
				u: !1,
				e: void 0,
				t: a,
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
		has(a) {
			let u = this[y]
			return (
				d(u),
				u.e ? !!(u.e.has(a) || (u.o.has(a) && u.e.has(u.o.get(a)))) : u.t.has(a)
			)
		}
		add(a) {
			let u = this[y]
			return d(u), this.has(a) || (i(u), k(u), u.e.add(a)), this
		}
		delete(a) {
			if (!this.has(a)) return !1
			let u = this[y]
			return (
				d(u),
				i(u),
				k(u),
				u.e.delete(a) || (u.o.has(a) ? u.e.delete(u.o.get(a)) : !1)
			)
		}
		clear() {
			let a = this[y]
			d(a), O(a).size && (i(a), k(a), a.e.clear())
		}
		values() {
			let a = this[y]
			return d(a), i(a), a.e.values()
		}
		entries() {
			let a = this[y]
			return d(a), i(a), a.e.entries()
		}
		keys() {
			return this.values()
		}
		[(y, Symbol.iterator)]() {
			return this.values()
		}
		forEach(a, u) {
			let g = this.values(),
				D = g.next()
			for (; !D.done; ) a.call(u, D.value, D.value, this), (D = g.next())
		}
	}
	function o(p, M) {
		let a = new n(p, M)
		return [a, a[y]]
	}
	function i(p) {
		p.e ||
			((p.e = new Set()),
			p.t.forEach(M => {
				if (_(M)) {
					let a = Z(p.n, M, p, M)
					p.o.set(M, a), p.e.add(a)
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
				M.forEach(a => {
					p.e.add(Ue(a))
				})
		}
	}
	ie(W, {w: t, v: o, fixSetContents: S})
}
function nt() {
	let e = new Set(["shift", "unshift"]),
		t = new Set(["push", "pop"]),
		r = new Set([...t, ...e]),
		n = new Set(["reverse", "sort"]),
		o = new Set([...r, ...n, "splice"]),
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
		return o.has(s)
	}
	function p(s) {
		return d.has(s)
	}
	function M(s) {
		return S(s) || p(s)
	}
	function a(s, l) {
		s.operationMethod = l
	}
	function u(s) {
		s.operationMethod = void 0
	}
	function g(s, l, h = !0) {
		X(s)
		let f = l()
		return k(s), h && s.a.set("length", !0), f
	}
	function D(s) {
		s.R = !0
	}
	function c(s, l) {
		return s < 0 ? Math.max(l + s, 0) : Math.min(s, l)
	}
	function P(s, l, h) {
		return g(s, () => {
			let f = s.e[l](...h)
			return e.has(l) && D(s), r.has(l) ? f : s.c
		})
	}
	function m(s, l, h) {
		return g(s, () => (s.e[l](...h), D(s), s.c), !1)
	}
	function x(s, l) {
		return function(...f) {
			let I = l
			a(s, I)
			try {
				if (S(I)) {
					if (r.has(I)) return P(s, I, f)
					if (n.has(I)) return m(s, I, f)
					if (I === "splice") {
						let E = g(s, () => s.e.splice(...f))
						return D(s), E
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
			for (let Me = T; Me < C; Me++) R.push(s.c[Me])
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
var N = new Ie(),
	Gr = N.produce,
	$r = N.produceWithPatches.bind(N),
	qr = N.setAutoFreeze.bind(N),
	Yr = N.setUseStrictShallowCopy.bind(N),
	Jr = N.setUseStrictIteration.bind(N),
	Qr = N.applyPatches.bind(N),
	Xr = N.createDraft.bind(N),
	Zr = N.finishDraft.bind(N),
	en = e => e,
	tn = e => e
function rn(e) {
	return e === B
}
export {
	Ie as Immer,
	Qr as applyPatches,
	en as castDraft,
	tn as castImmutable,
	Xr as createDraft,
	Fe as current,
	nt as enableArrayMethods,
	rt as enableMapSet,
	tt as enablePatches,
	Zr as finishDraft,
	ae as freeze,
	v as immerable,
	w as isDraft,
	_ as isDraftable,
	rn as isNothing,
	B as nothing,
	qe as original,
	Gr as produce,
	$r as produceWithPatches,
	qr as setAutoFreeze,
	Jr as setUseStrictIteration,
	Yr as setUseStrictShallowCopy
}
//# sourceMappingURL=immer.production.mjs.map
