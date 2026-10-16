import BTree from '../b+tree';
/**
 * Returns whether `tree` contains every key in `other`, with equal values by default. Extra keys are allowed.
 * Neither tree is modified. The cursor walk skips ranges unique to `tree` and stops at the first
 * missing key or unequal value.
 *
 * Time complexity is O(N + M) in the worst case, for input sizes N and M, with O(H) auxiliary space
 * for the cursor paths, where H is the larger tree height. Empty subsets, shared roots, and
 * insufficient size are handled without walking the trees.
 * @param tree The potential superset.
 * @param other The tree whose keys must all be present in `tree`.
 * @param compareValues Whether values for matching keys must be equal using `Object.is`. Defaults to true.
 * Pass false to compare keys only.
 * @returns True if every key in `other` is present in `tree` and any required value comparisons match.
 * Always true when `other` is empty.
 * @throws Error if the trees were built with different comparators, even if either tree is empty.
 */
export default function isSupersetOf<K, V, VOther>(tree: BTree<K, V>, other: BTree<K, VOther>, compareValues?: boolean): boolean;
