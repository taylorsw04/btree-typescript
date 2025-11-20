import BTreeEx from '../extended';
import intersect from '../extended/intersect';
import { comparatorErrorMsg } from '../extended/shared';
import MersenneTwister from 'mersenne-twister';
import {
  applyRemovalRunsToTree,
  buildEntriesFromMap,
  expectTreeMatchesEntries,
  forEachFuzzCase,
  makeArray,
  SetOperationFuzzSettings,
  TreeEntries
} from './shared';

var test: (name: string, f: () => void) => void = it;

type SharedCall = { key: number, leftValue: number, rightValue: number };

const runForEachKeyInBothAndIntersect = (
  left: BTreeEx<number, number>,
  right: BTreeEx<number, number>,
  assertion: (calls: SharedCall[]) => void
) => {
  const forEachCalls: SharedCall[] = [];
  left.forEachKeyInBoth(right, (key, leftValue, rightValue) => {
    forEachCalls.push({ key, leftValue, rightValue });
  });
  assertion(forEachCalls);

  const intersectionCalls: SharedCall[] = [];
  const resultTree = intersect<BTreeEx<number, number>, number, number>(left, right, (key, leftValue, rightValue) => {
    intersectionCalls.push({ key, leftValue, rightValue });
    return leftValue;
  });
  const expectedEntries = intersectionCalls.map(({ key, leftValue }) => [key, leftValue] as [number, number]);
  expect(resultTree.toArray()).toEqual(expectedEntries);
  resultTree.checkValid();
  assertion(intersectionCalls);
};

const expectForEachKeyInBothAndIntersectCalls = (
  left: BTreeEx<number, number>,
  right: BTreeEx<number, number>,
  expected: SharedCall[]
) => {
  runForEachKeyInBothAndIntersect(left, right, (calls) => {
    expect(calls).toEqual(expected);
  });
};

const tuplesToRecords = (entries: Array<[number, number, number]>): SharedCall[] =>
  entries.map(([key, leftValue, rightValue]) => ({ key, leftValue, rightValue }));

const tuples = (...pairs: Array<[number, number]>) => pairs;

describe('BTree forEachKeyInBoth/intersect tests with fanout 32', testForEachKeyInBoth.bind(null, 32));
describe('BTree forEachKeyInBoth/intersect tests with fanout 10', testForEachKeyInBoth.bind(null, 10));
describe('BTree forEachKeyInBoth/intersect tests with fanout 4', testForEachKeyInBoth.bind(null, 4));

function testForEachKeyInBoth(maxNodeSize: number) {
  const compare = (a: number, b: number) => a - b;

  const buildTree = (entries: Array<[number, number]>) =>
    new BTreeEx<number, number>(entries, compare, maxNodeSize);

  test('forEachKeyInBoth/intersect two empty trees', () => {
    const tree1 = buildTree([]);
    const tree2 = buildTree([]);
    expectForEachKeyInBothAndIntersectCalls(tree1, tree2, []);
  });

  test('forEachKeyInBoth/intersect empty tree with non-empty tree', () => {
    const tree1 = buildTree([]);
    const tree2 = buildTree(tuples([1, 10], [2, 20], [3, 30]));
    expectForEachKeyInBothAndIntersectCalls(tree1, tree2, []);
    expectForEachKeyInBothAndIntersectCalls(tree2, tree1, []);
  });

  test('forEachKeyInBoth/intersect with no overlapping keys', () => {
    const tree1 = buildTree(tuples([1, 10], [3, 30], [5, 50]));
    const tree2 = buildTree(tuples([2, 20], [4, 40], [6, 60]));
    expectForEachKeyInBothAndIntersectCalls(tree1, tree2, []);
  });

  test('forEachKeyInBoth/intersect with single overlapping key', () => {
    const tree1 = buildTree(tuples([1, 10], [2, 20], [3, 30]));
    const tree2 = buildTree(tuples([0, 100], [2, 200], [4, 400]));
    expectForEachKeyInBothAndIntersectCalls(tree1, tree2, [{ key: 2, leftValue: 20, rightValue: 200 }]);
  });

  test('forEachKeyInBoth/intersect with multiple overlapping keys maintains tree contents', () => {
    const leftEntries: Array<[number, number]> = [[1, 10], [2, 20], [3, 30], [4, 40], [5, 50]];
    const rightEntries: Array<[number, number]> = [[0, 100], [2, 200], [4, 400], [6, 600]];
    const tree1 = buildTree(leftEntries);
    const tree2 = buildTree(rightEntries);
    const leftBefore = tree1.toArray();
    const rightBefore = tree2.toArray();
    expectForEachKeyInBothAndIntersectCalls(tree1, tree2, [
      { key: 2, leftValue: 20, rightValue: 200 },
      { key: 4, leftValue: 40, rightValue: 400 },
    ]);
    expect(tree1.toArray()).toEqual(leftBefore);
    expect(tree2.toArray()).toEqual(rightBefore);
    tree1.checkValid();
    tree2.checkValid();
  });

  test('forEachKeyInBoth/intersect with contiguous overlap yields sorted keys', () => {
    const tree1 = buildTree(tuples([1, 1], [2, 2], [3, 3], [4, 4], [5, 5], [6, 6]));
    const tree2 = buildTree(tuples([3, 30], [4, 40], [5, 50], [6, 60], [7, 70]));
    runForEachKeyInBothAndIntersect(tree1, tree2, (calls) => {
      expect(calls.map(c => c.key)).toEqual([3, 4, 5, 6]);
      expect(calls.map(c => c.leftValue)).toEqual([3, 4, 5, 6]);
      expect(calls.map(c => c.rightValue)).toEqual([30, 40, 50, 60]);
    });
  });

  test('forEachKeyInBoth/intersect large overlapping range counts each shared key once', () => {
    const size = 1000;
    const overlapStart = 500;
    const leftEntries = Array.from({ length: size }, (_, i) => [i, i * 3] as [number, number]);
    const rightEntries = Array.from({ length: size }, (_, i) => {
      const key = i + overlapStart;
      return [key, key * 7] as [number, number];
    });
    const tree1 = buildTree(leftEntries);
    const tree2 = buildTree(rightEntries);
    runForEachKeyInBothAndIntersect(tree1, tree2, (calls) => {
      expect(calls.length).toBe(size - overlapStart);
      expect(calls[0]).toEqual({
        key: overlapStart,
        leftValue: overlapStart * 3,
        rightValue: overlapStart * 7
      });
      const lastCall = calls[calls.length - 1];
      expect(lastCall.key).toBe(size - 1);
      expect(lastCall.leftValue).toBe((size - 1) * 3);
      expect(lastCall.rightValue).toBe((size - 1) * 7);
    });
  });

  test('forEachKeyInBoth/intersect tree with itself visits each key once', () => {
    const entries = Array.from({ length: 20 }, (_, i) => [i, i * 2] as [number, number]);
    const tree = buildTree(entries);
    runForEachKeyInBothAndIntersect(tree, tree, (calls) => {
      expect(calls.length).toBe(entries.length);
      for (let i = 0; i < entries.length; i++) {
        const [key, value] = entries[i];
        expect(calls[i]).toEqual({ key, leftValue: value, rightValue: value });
      }
    });
  });

  test('forEachKeyInBoth/intersect arguments determine left/right values', () => {
    const tree1 = buildTree(tuples([1, 100], [2, 200], [4, 400]));
    const tree2 = buildTree(tuples([2, 20], [3, 30], [4, 40]));
    expectForEachKeyInBothAndIntersectCalls(tree1, tree2, [
      { key: 2, leftValue: 200, rightValue: 20 },
      { key: 4, leftValue: 400, rightValue: 40 },
    ]);
    expectForEachKeyInBothAndIntersectCalls(tree2, tree1, [
      { key: 2, leftValue: 20, rightValue: 200 },
      { key: 4, leftValue: 40, rightValue: 400 },
    ]);
  });
}

describe('BTree forEachKeyInBoth early exiting', () => {
  const compare = (a: number, b: number) => a - b;

  const buildTree = (entries: Array<[number, number]>) =>
    new BTreeEx<number, number>(entries, compare, 4);

  test('forEachKeyInBoth returns undefined when callback returns void', () => {
    const tree1 = buildTree(tuples([1, 10], [2, 20], [3, 30]));
    const tree2 = buildTree(tuples([0, 100], [2, 200], [3, 300], [4, 400]));
    const visited: number[] = [];
    const result = tree1.forEachKeyInBoth(tree2, key => {
      visited.push(key);
    });
    expect(result).toBeUndefined();
    expect(visited).toEqual([2, 3]);
  });

  test('forEachKeyInBoth ignores undefined break values and completes traversal', () => {
    const tree1 = buildTree(tuples([1, 10], [2, 20], [3, 30]));
    const tree2 = buildTree(tuples([2, 200], [3, 300], [5, 500]));
    const visited: number[] = [];
    const result = tree1.forEachKeyInBoth(tree2, key => {
      visited.push(key);
      return { break: undefined };
    });
    expect(result).toBeUndefined();
    expect(visited).toEqual([2, 3]);
  });

  test('forEachKeyInBoth breaks early when callback returns a value', () => {
    const tree1 = buildTree(tuples([1, 10], [2, 20], [3, 30], [4, 40]));
    const tree2 = buildTree(tuples([2, 200], [3, 300], [4, 400], [5, 500]));
    const visited: number[] = [];
    const breakResult = tree1.forEachKeyInBoth(tree2, (key, leftValue, rightValue) => {
      visited.push(key);
      if (key === 3) {
        return { break: { key, sum: leftValue + rightValue } };
      }
    });
    expect(breakResult).toEqual({ key: 3, sum: 330 });
    expect(visited).toEqual([2, 3]);
  });
});

describe('BTree forEachKeyInBoth and intersect input/output validation', () => {
  test('forEachKeyInBoth throws error when comparators differ', () => {
    const tree1 = new BTreeEx<number, number>([[1, 10]], (a, b) => b + a);
    const tree2 = new BTreeEx<number, number>([[2, 20]], (a, b) => b - a);
    expect(() => tree1.forEachKeyInBoth(tree2, () => { })).toThrow(comparatorErrorMsg);
    expect(() => intersect<BTreeEx<number, number>, number, number>(tree1, tree2, () => 0)).toThrow(comparatorErrorMsg);
  });
});

describe('BTree forEachKeyInBoth/intersect fuzz tests', () => {
  const compare = (a: number, b: number) => a - b;
  const FUZZ_SETTINGS: SetOperationFuzzSettings = {
    branchingFactors: [4, 5, 32],
    ooms: [2, 3],
    fractionsPerOOM: [0.1, 0.25, 0.5],
    removalChances: [0, 0.01, 0.1]
  };

  const FUZZ_TIMEOUT_MS = 30_000;
  jest.setTimeout(FUZZ_TIMEOUT_MS);

  const rng = new MersenneTwister(0xC0FFEE);

  forEachFuzzCase(FUZZ_SETTINGS, ({ maxNodeSize, size, fractionA, fractionB, removalChance, removalLabel }) => {
    test(`branch ${maxNodeSize}, size ${size}, fractionA ${fractionA.toFixed(2)}, fractionB ${fractionB.toFixed(2)}, removal ${removalLabel}`, () => {
      const treeA = new BTreeEx<number, number>([], compare, maxNodeSize);
      const treeB = new BTreeEx<number, number>([], compare, maxNodeSize);

      const entriesMapA = new Map<number, number>();
      const entriesMapB = new Map<number, number>();
      const keys = makeArray(size, true, 1, rng);

      for (const value of keys) {
        let assignToA = rng.random() < fractionA;
        let assignToB = rng.random() < fractionB;

        if (!assignToA && !assignToB) {
          if (rng.random() < 0.5)
            assignToA = true;
          else
            assignToB = true;
        }

        if (assignToA) {
          treeA.set(value, value);
          entriesMapA.set(value, value);
        }
        if (assignToB) {
          treeB.set(value, value);
          entriesMapB.set(value, value);
        }
      }

      let treeAEntries: TreeEntries = buildEntriesFromMap(entriesMapA, compare);
      let treeBEntries: TreeEntries = buildEntriesFromMap(entriesMapB, compare);
      treeAEntries = applyRemovalRunsToTree(treeA, treeAEntries, removalChance, maxNodeSize, rng);
      treeBEntries = applyRemovalRunsToTree(treeB, treeBEntries, removalChance, maxNodeSize, rng);

      const bMap = new Map<number, number>(treeBEntries);
      const expectedTuples: Array<[number, number, number]> = [];
      for (const [key, leftValue] of treeAEntries) {
        const rightValue = bMap.get(key);
        if (rightValue !== undefined)
          expectedTuples.push([key, leftValue, rightValue]);
      }

      const expectedRecords = tuplesToRecords(expectedTuples);
      expectForEachKeyInBothAndIntersectCalls(treeA, treeB, expectedRecords);
      const swappedExpected = expectedRecords.map(({ key, leftValue, rightValue }) => ({
        key,
        leftValue: rightValue,
        rightValue: leftValue,
      }));
      expectForEachKeyInBothAndIntersectCalls(treeB, treeA, swappedExpected);

      expectTreeMatchesEntries(treeA, treeAEntries);
      expectTreeMatchesEntries(treeB, treeBEntries);
      treeA.checkValid();
      treeB.checkValid();
    });
  });
});
