import BTree, { BNode, BNodeInternal, IMap } from '../b+tree';
import SortedArray from '../sorted-array';
import MersenneTwister from 'mersenne-twister';
import type { BTreeWithInternals } from '../extended/shared';

const rand = new MersenneTwister(1234);

export type TreeNodeStats = {
  total: number;
  shared: number;
  newUnderfilled: number;
  averageLoadFactor: number;
};

export function countTreeNodeStats<K, V>(tree: BTree<K, V>): TreeNodeStats {
  const root = (tree as unknown as BTreeWithInternals<K, V>)._root;
  if (tree.size === 0 || !root)
    return { total: 0, shared: 0, newUnderfilled: 0, averageLoadFactor: 0 };

  const maxNodeSize = tree.maxNodeSize;
  const minNodeSize = Math.floor(maxNodeSize / 2);

  type StatsAccumulator = {
    total: number;
    shared: number;
    newUnderfilled: number;
    loadFactorSum: number;
  };

  const visit = (node: BNode<K, V>, ancestorShared: boolean, isRoot: boolean): StatsAccumulator => {
    if (!node)
      return { total: 0, shared: 0, newUnderfilled: 0, loadFactorSum: 0 };
    const selfShared = node.isShared === true || ancestorShared;
    const children: BNode<K, V>[] | undefined = (node as BNodeInternal<K, V>).children;
    const occupancy = children ? children.length : node.keys.length;
    const isUnderfilled = !isRoot && occupancy < minNodeSize;
    const loadFactor = occupancy / maxNodeSize;
    let shared = selfShared ? 1 : 0;
    let total = 1;
    let newUnderfilled = !selfShared && isUnderfilled ? 1 : 0;
    let loadFactorSum = loadFactor;
    if (children) {
      for (const child of children) {
        const stats = visit(child, selfShared, false);
        total += stats.total;
        shared += stats.shared;
        newUnderfilled += stats.newUnderfilled;
        loadFactorSum += stats.loadFactorSum;
      }
    }
    return { total, shared, newUnderfilled, loadFactorSum };
  };

  const result = visit(root, false, true);
  const averageLoadFactor = result.total === 0 ? 0 : result.loadFactorSum / result.total;
  return {
    total: result.total,
    shared: result.shared,
    newUnderfilled: result.newUnderfilled,
    averageLoadFactor
  };
}

export function logTreeNodeStats(label: string, stats: TreeNodeStats): void {
  console.log(`\tShared nodes (${label}): ${stats.shared}/${stats.total}`);
  console.log(`\tUnderfilled nodes (${label}): ${stats.newUnderfilled}/${stats.total}`);
  const percent = (stats.averageLoadFactor * 100).toFixed(2);
  console.log(`\tAverage load factor (${label}): ${percent}%`);
}

export function randInt(max: number): number {
  return rand.random_int() % max;
}

export function expectTreeEqualTo<K, V>(tree: BTree<K, V>, list: SortedArray<K, V>): void {
  tree.checkValid();
  expect(tree.toArray()).toEqual(list.getArray());
}

export function addToBoth<K, V>(a: IMap<K, V>, b: IMap<K, V>, k: K, v: V): void {
  expect(a.set(k, v)).toEqual(b.set(k, v));
}

export function makeArray(
  size: number,
  randomOrder: boolean,
  spacing = 10,
  collisionChance = 0,
  rng?: MersenneTwister
): number[] {
  const randomizer = rng ?? rand;
  const useGlobalRand = rng === undefined;

  const randomFloat = () => {
    if (typeof randomizer.random === 'function')
      return randomizer.random();
    return Math.random();
  };

  const randomIntWithMax = (max: number) => {
    if (max <= 0)
      return 0;
    if (useGlobalRand)
      return randInt(max);
    return Math.floor(randomFloat() * max);
  };

  const keys: number[] = [];
  let current = 0;
  for (let i = 0; i < size; i++) {
    if (i > 0 && collisionChance > 0 && randomFloat() < collisionChance) {
      keys[i] = keys[i - 1];
    } else {
      current += 1 + randomIntWithMax(spacing);
      keys[i] = current;
    }
  }
  if (randomOrder) {
    for (let i = 0; i < size; i++)
      swap(keys, i, randomIntWithMax(size));
  }
  return keys;
}

export const randomInt = (rng: MersenneTwister, maxExclusive: number) =>
  Math.floor(rng.random() * maxExclusive);

function swap(keys: any[], i: number, j: number) {
  const tmp = keys[i];
  keys[i] = keys[j];
  keys[j] = tmp;
}
