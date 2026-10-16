import BTree from '../b+tree';
import { createCursor, getKey, moveForwardOne, moveTo, noop } from './parallelWalk';
import { type BTreeWithInternals, checkCanDoSetOperation } from './shared';

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
export default function isSupersetOf<K, V, VOther>(
  tree: BTree<K, V>,
  other: BTree<K, VOther>,
  compareValues = true
): boolean {
  const _tree = tree as unknown as BTreeWithInternals<K, V | VOther>;
  const _other = other as unknown as BTreeWithInternals<K, V | VOther>;
  checkCanDoSetOperation(_tree, _other, true);
  if (tree.size < other.size)
    return false;
  if (other.size === 0 || _tree._root === _other._root)
    return true;

  const makePayload = (): undefined => undefined;
  const cursor = createCursor(_tree, makePayload, noop, noop, noop, noop, noop);
  const cursorOther = createCursor(_other, makePayload, noop, noop, noop, noop, noop);
  let order = tree._compare(getKey(cursorOther), getKey(cursor));

  while (true) {
    if (order < 0)
      return false;
    if (order > 0) {
      const [out, equal] = moveTo(cursor, cursorOther, getKey(cursorOther), true, false);
      if (out || !equal)
        return false;
    }
    if (compareValues && !Object.is(
      cursor.leaf.values[cursor.leafIndex],
      cursorOther.leaf.values[cursorOther.leafIndex]
    ))
      return false;
    if (moveForwardOne(cursorOther, cursor))
      return true;
    order = 1; // The other cursor advanced past the matching key; this cursor is now behind.
  }
}
