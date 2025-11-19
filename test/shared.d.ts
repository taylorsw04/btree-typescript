import BTree, { IMap } from '../b+tree';
import SortedArray from '../sorted-array';
import MersenneTwister from 'mersenne-twister';
export declare type TreeNodeStats = {
    total: number;
    shared: number;
    newUnderfilled: number;
    averageLoadFactor: number;
};
export declare function countTreeNodeStats<K, V>(tree: BTree<K, V>): TreeNodeStats;
export declare function logTreeNodeStats(label: string, stats: TreeNodeStats): void;
export declare function randInt(max: number): number;
export declare function expectTreeEqualTo<K, V>(tree: BTree<K, V>, list: SortedArray<K, V>): void;
export declare function addToBoth<K, V>(a: IMap<K, V>, b: IMap<K, V>, k: K, v: V): void;
export declare function makeArray(size: number, randomOrder: boolean, spacing?: number, collisionChance?: number, rng?: MersenneTwister): number[];
export declare const randomInt: (rng: MersenneTwister, maxExclusive: number) => number;
