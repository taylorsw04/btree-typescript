"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var parallelWalk_1 = require("./parallelWalk");
var shared_1 = require("./shared");
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
function isSupersetOf(tree, other, compareValues) {
    if (compareValues === void 0) { compareValues = true; }
    var _tree = tree;
    var _other = other;
    (0, shared_1.checkCanDoSetOperation)(_tree, _other, true);
    if (tree.size < other.size)
        return false;
    if (other.size === 0 || _tree._root === _other._root)
        return true;
    var makePayload = function () { return undefined; };
    var cursor = (0, parallelWalk_1.createCursor)(_tree, makePayload, parallelWalk_1.noop, parallelWalk_1.noop, parallelWalk_1.noop, parallelWalk_1.noop, parallelWalk_1.noop);
    var cursorOther = (0, parallelWalk_1.createCursor)(_other, makePayload, parallelWalk_1.noop, parallelWalk_1.noop, parallelWalk_1.noop, parallelWalk_1.noop, parallelWalk_1.noop);
    var order = tree._compare((0, parallelWalk_1.getKey)(cursorOther), (0, parallelWalk_1.getKey)(cursor));
    while (true) {
        if (order < 0)
            return false;
        if (order > 0) {
            var _a = (0, parallelWalk_1.moveTo)(cursor, cursorOther, (0, parallelWalk_1.getKey)(cursorOther), true, false), out = _a[0], equal = _a[1];
            if (out || !equal)
                return false;
        }
        if (compareValues && !Object.is(cursor.leaf.values[cursor.leafIndex], cursorOther.leaf.values[cursorOther.leafIndex]))
            return false;
        if ((0, parallelWalk_1.moveForwardOne)(cursorOther, cursor))
            return true;
        order = 1; // The other cursor advanced past the matching key; this cursor is now behind.
    }
}
exports.default = isSupersetOf;
