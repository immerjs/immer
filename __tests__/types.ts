import produce, { produce as produce2} from '../src/immer';

interface State {
  readonly num: number;
  readonly foo?: string;
  bar: string;
  readonly baz: {
    readonly x: number;
    readonly y: number;
  };
  readonly arr: ReadonlyArray<{ readonly value: string }>;
  readonly arr2: { readonly value: string }[];
}

const state: State = {
  num: 0,
  bar: 'foo',
  baz: {
    x: 1,
    y: 2,
  },
  arr: [{ value: 'asdf' }],
  arr2: [{ value: 'asdf' }],
};

const expectedState: State = {
  num: 1,
  foo: 'bar',
  bar: 'foo',
  baz: {
    x: 2,
    y: 3,
  },
  arr: [{ value: 'foo' }, { value: 'asf' }],
  arr2: [{ value: 'foo' }, { value: 'asf' }],
};

it('can update readonly state via standard api', () => {
  const newState = produce<State>(state, draft => {
    draft.num++;
    draft.foo = 'bar';
    draft.bar = 'foo';
    draft.baz.x++;
    draft.baz.y++;
    draft.arr[0].value = 'foo';
    draft.arr.push({ value: 'asf' });
    draft.arr2[0].value = 'foo';
    draft.arr2.push({ value: 'asf' });
  });
  expect(newState).not.toBe(state);
  expect(newState).toEqual(expectedState);
});

it('can update readonly state via curried api', () => {
  const newState = produce<State>(draft => {
    draft.num++;
    draft.foo = 'bar';
    draft.bar = 'foo';
    draft.baz.x++;
    draft.baz.y++;
    draft.arr[0].value = 'foo';
    draft.arr.push({ value: 'asf' });
    draft.arr2[0].value = 'foo';
    draft.arr2.push({ value: 'asf' });
  })(state);
  expect(newState).not.toBe(state);
  expect(newState).toEqual(expectedState);
});


it('can update use the non-default export', () => {
  const newState = produce2<State>(draft => {
    draft.num++;
    draft.foo = 'bar';
    draft.bar = 'foo';
    draft.baz.x++;
    draft.baz.y++;
    draft.arr[0].value = 'foo';
    draft.arr.push({ value: 'asf' });
    draft.arr2[0].value = 'foo';
    draft.arr2.push({ value: 'asf' });
  })(state);
  expect(newState).not.toBe(state);
  expect(newState).toEqual(expectedState);
});
