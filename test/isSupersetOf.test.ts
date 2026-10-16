import BTree from '../b+tree';
import BTreeEx from '../extended';
import isSupersetOf from '../extended/isSupersetOf';
import { comparatorErrorMsg } from '../extended/shared';
import { compareNumbers } from './shared';

const entries = (keys: number[]): Array<[number, number]> => keys.map(key => [key, key * 10]);
const range = (size: number): number[] => Array.from({ length: size }, (_, i) => i);

function expectSuperset<K, V, VOther>(
  tree: BTreeEx<K, V>, other: BTree<K, VOther>, expected: boolean, compareValues?: boolean
): void {
  expect(isSupersetOf(tree, other, compareValues)).toBe(expected);
  expect(tree.isSupersetOf(other, compareValues)).toBe(expected);
}

describe.each([4, 5, 32])('isSupersetOf with fanout %i', maxNodeSize => {
  const buildTree = (keys: number[]) => new BTreeEx(entries(keys), compareNumbers, maxNodeSize);

  const cases: Array<{ name: string, left: number[], right: number[], expected: boolean }> = [
    { name: 'two empty trees', left: [], right: [], expected: true },
    { name: 'empty subset', left: [1], right: [], expected: true },
    { name: 'empty superset', left: [], right: [1], expected: false },
    { name: 'identical singleton', left: [1], right: [1], expected: true },
    { name: 'different singletons', left: [1], right: [2], expected: false },
    { name: 'identical keys', left: [1, 2, 3], right: [1, 2, 3], expected: true },
    { name: 'strict superset', left: [0, 1, 2, 3, 4], right: [1, 3], expected: true },
    { name: 'too few keys', left: [1, 3], right: [0, 1, 2, 3, 4], expected: false },
    { name: 'missing first key', left: [2, 3, 4], right: [1, 3], expected: false },
    { name: 'missing middle key', left: [1, 3, 4], right: [1, 2, 4], expected: false },
    { name: 'missing last key', left: [1, 2, 3], right: [1, 4], expected: false },
    { name: 'disjoint before subset', left: [1, 2, 3], right: [4, 5], expected: false },
    { name: 'disjoint after subset', left: [4, 5, 6], right: [1, 2], expected: false },
    { name: 'interleaved disjoint keys', left: [0, 2, 4], right: [1, 3, 5], expected: false },
  ];

  cases.forEach(({ name, left, right, expected }) => {
    it(name, () => {
      expectSuperset(buildTree(left), buildTree(right), expected);
      expectSuperset(buildTree(left), buildTree(right), expected, false);
    });
  });

  it('supports different value types and can ignore undefined and NaN values', () => {
    const tree = new BTreeEx<number, number | undefined>(
      [[1, undefined], [2, NaN], [3, 30]], compareNumbers, maxNodeSize
    );
    const other = new BTree<number, string>(
      [[1, 'one'], [2, 'two'], [3, 'three']], compareNumbers, maxNodeSize
    );
    expectSuperset(tree, other, false);
    expectSuperset(tree, other, true, false);
    expect(isSupersetOf(other, tree)).toBe(false);
    expect(isSupersetOf(other, tree, false)).toBe(true);
  });

  it('supports different heights and max node sizes without modifying either input', () => {
    const tree = buildTree(range(4096));
    const other = new BTree(entries([0, 31, 32, 1024, 2048, 4095]), compareNumbers, 10);
    const beforeTree = tree.toArray();
    const beforeOther = other.toArray();
    expect(tree.height).toBeGreaterThan(other.height);
    tree.freeze();
    other.freeze();
    expectSuperset(tree, other, true);
    expect(tree.toArray()).toEqual(beforeTree);
    expect(other.toArray()).toEqual(beforeOther);
    tree.checkValid();
    other.checkValid();
  });

  it('finds a missing key across leaf and internal-node boundaries', () => {
    const tree = buildTree(range(300));
    const other = tree.greedyClone(true);
    for (const missing of [0, 4, 31, 32, 150, 299]) {
      tree.delete(missing);
      // Keep the potential superset larger so the cursor walk must find the missing key.
      tree.set(400, 4000);
      tree.set(401, 4010);
      expectSuperset(tree, other, false);
      tree.set(missing, missing * 10);
    }
  });

  it('handles clones that diverge after sharing a root', () => {
    const tree = buildTree(range(300));
    const other = tree.clone();
    expectSuperset(tree, other, true);
    other.set(50, -1);
    expectSuperset(tree, other, false);
    expectSuperset(tree, other, true, false);
    other.set(50, 500);
    other.delete(10);
    expectSuperset(tree, other, true);
    expectSuperset(other, tree, false);
    other.set(301, 3010);
    expectSuperset(tree, other, false);
    expectSuperset(other, tree, false);
  });
});

it('supports a subset with greater height than the superset', () => {
  const tree = new BTreeEx(entries(range(1024)), compareNumbers, 32);
  const other = new BTree(entries(range(512).map(key => key * 2)), compareNumbers, 4);
  expect(other.height).toBeGreaterThan(tree.height);
  expectSuperset(tree, other, true);
  other.set(1022, -1);
  expectSuperset(tree, other, false);
  expectSuperset(tree, other, true, false);
  other.set(1024, 10240);
  expectSuperset(tree, other, false, false);
});

describe('isSupersetOf comparators', () => {
  it('uses comparator equality rather than key identity', () => {
    const compare = (a: { id: number }, b: { id: number }) => a.id - b.id;
    const tree = new BTreeEx<{ id: number }, number>([[{ id: 1 }, 10], [{ id: 2 }, 20]], compare);
    const other = new BTree<{ id: number }, string>([[{ id: 1 }, 'different value']], compare);
    expectSuperset(tree, other, false);
    expectSuperset(tree, other, true, false);
    other.set({ id: 3 }, 'missing');
    expectSuperset(tree, other, false, false);
  });

  it('supports reverse sort order', () => {
    const compare = (a: number, b: number) => b - a;
    const tree = new BTreeEx(entries(range(300)), compare, 4);
    const other = new BTree(entries([0, 31, 32, 150, 299]), compare, 32);
    expectSuperset(tree, other, true);
    other.set(151.5, 0);
    expectSuperset(tree, other, false);
  });

  it('supports undefined and NaN keys with the default comparator', () => {
    const tree = new BTreeEx<number | undefined, number>([[undefined, 1], [NaN, 2], [1, 3]]);
    const other = new BTree<number | undefined, number>([[undefined, 1], [NaN, 2]]);
    expectSuperset(tree, other, true);
    other.set(2, 4);
    expectSuperset(tree, other, false);
  });

  it('rejects different comparators before taking size or empty-tree shortcuts', () => {
    const compare = (a: number, b: number) => a - b;
    for (const left of [[], [1], [1, 2]]) {
      for (const right of [[], [1], [1, 2]]) {
        const tree = new BTreeEx(entries(left), compareNumbers);
        const other = new BTree(entries(right), compare);
        expect(() => isSupersetOf(tree, other)).toThrow(comparatorErrorMsg);
        expect(() => tree.isSupersetOf(other)).toThrow(comparatorErrorMsg);
        expect(() => isSupersetOf(tree, other, false)).toThrow(comparatorErrorMsg);
        expect(() => tree.isSupersetOf(other, false)).toThrow(comparatorErrorMsg);
      }
    }
  });
});

describe('isSupersetOf value comparisons', () => {
  const shared = { value: 1 };
  const cases: Array<{ name: string, left: unknown, right: unknown, expected: boolean }> = [
    { name: 'equal numbers', left: 1, right: 1, expected: true },
    { name: 'unequal numbers', left: 1, right: 2, expected: false },
    { name: 'different types', left: 1, right: '1', expected: false },
    { name: 'undefined values', left: undefined, right: undefined, expected: true },
    { name: 'null values', left: null, right: null, expected: true },
    { name: 'null and undefined', left: null, right: undefined, expected: false },
    { name: 'NaN values', left: NaN, right: NaN, expected: true },
    { name: 'signed zeros', left: 0, right: -0, expected: false },
    { name: 'same object', left: shared, right: shared, expected: true },
    { name: 'distinct objects', left: { value: 1 }, right: { value: 1 }, expected: false },
  ];

  cases.forEach(({ name, left, right, expected }) => {
    it(name, () => {
      const tree = new BTreeEx<number, unknown>([[0, 'extra'], [1, left]]);
      const other = new BTree<number, unknown>([[1, right]]);
      expectSuperset(tree, other, expected);
      expectSuperset(tree, other, expected, true);
      expectSuperset(tree, other, true, false);
    });
  });

  it('checks values across multiple leaves', () => {
    const tree = new BTreeEx(entries(range(300)), compareNumbers, 4);
    const other = new BTree(entries(range(300)), compareNumbers, 32);
    for (const key of [0, 31, 32, 150, 299]) {
      other.set(key, -1);
      expectSuperset(tree, other, false);
      expectSuperset(tree, other, true, false);
      other.set(key, key * 10);
    }
    expectSuperset(tree, other, true);
  });
});

describe('isSupersetOf early exits', () => {
  it('does not compare keys for empty subsets, insufficient size, or shared roots', () => {
    let comparisons = 0;
    const compare = (a: number, b: number) => { comparisons++; return a - b; };
    const tree = new BTreeEx(entries(range(1000)), compare, 4);
    const clone = tree.clone();
    const smaller = new BTree(entries(range(999)), compare, 4);
    const empty = new BTree<number, number>([], compare, 4);
    comparisons = 0;
    expectSuperset(tree, tree, true);
    expectSuperset(tree, clone, true);
    expectSuperset(tree, empty, true);
    expect(isSupersetOf(smaller, tree)).toBe(false);
    expect(comparisons).toBe(0);
  });

  it('stops at the first missing key without visiting the remaining keys', () => {
    const compare = jest.fn(compareNumbers);
    const tree = new BTreeEx(entries(range(4096).map(key => key + 1)), compare, 4);
    const other = new BTree(entries(range(4096)), compare, 4);
    compare.mockClear();
    expect(isSupersetOf(tree, other)).toBe(false);
    expect(compare.mock.calls).toEqual([[0, 1]]);
    compare.mockClear();
    expect(tree.isSupersetOf(other)).toBe(false);
    expect(compare.mock.calls).toEqual([[0, 1]]);
  });

  it('stops at the first unequal value by default', () => {
    const compare = jest.fn(compareNumbers);
    const tree = new BTreeEx(entries(range(4096)), compare, 4);
    const other = new BTree(entries(range(4096)), compare, 4);
    other.set(0, -1);
    compare.mockClear();
    expect(isSupersetOf(tree, other)).toBe(false);
    expect(compare.mock.calls).toEqual([[0, 0]]);
    compare.mockClear();
    expect(tree.isSupersetOf(other)).toBe(false);
    expect(compare.mock.calls).toEqual([[0, 0]]);
    expectSuperset(tree, other, true, false);
  });

  it('skips long ranges unique to the superset instead of scanning every key', () => {
    let comparisons = 0;
    const compare = (a: number, b: number) => { comparisons++; return a - b; };
    const tree = new BTreeEx(entries(range(16384)), compare, 4);
    const other = new BTree(entries([0, 4096, 8192, 16383]), compare, 32);
    comparisons = 0;
    expect(isSupersetOf(tree, other)).toBe(true);
    expect(comparisons).toBeLessThan(200);
    comparisons = 0;
    expect(tree.isSupersetOf(other)).toBe(true);
    expect(comparisons).toBeLessThan(200);
  });
});
