"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmptyBTree = exports.asSet = exports.simpleComparator = exports.defaultComparator = void 0;
/**
 * Compares DefaultComparables to form a strict partial ordering.
 *
 * Handles +/-0 and NaN like Map: NaN is equal to NaN, and -0 is equal to +0.
 *
 * Arrays are compared using '<' and '>', which may cause unexpected equality:
 * for example [1] will be considered equal to ['1'].
 *
 * Two objects with equal valueOf compare the same, but compare unequal to
 * primitives that have the same value.
 */
function defaultComparator(a, b) {
    // Special case finite numbers first for performance.
    // Note that the trick of using 'a - b' and checking for NaN to detect non-numbers
    // does not work if the strings are numeric (ex: "5"). This would leading most 
    // comparison functions using that approach to fail to have transitivity.
    if (Number.isFinite(a) && Number.isFinite(b)) {
        return a - b;
    }
    // The default < and > operators are not totally ordered. To allow types to be mixed
    // in a single collection, compare types and order values of different types by type.
    var ta = typeof a;
    var tb = typeof b;
    if (ta !== tb) {
        return ta < tb ? -1 : 1;
    }
    if (ta === 'object') {
        // standardized JavaScript bug: null is not an object, but typeof says it is
        if (a === null)
            return b === null ? 0 : -1;
        else if (b === null)
            return 1;
        a = a.valueOf();
        b = b.valueOf();
        ta = typeof a;
        tb = typeof b;
        // Deal with the two valueOf()s producing different types
        if (ta !== tb) {
            return ta < tb ? -1 : 1;
        }
    }
    // a and b are now the same type, and will be a number, string or array 
    // (which we assume holds numbers or strings), or something unsupported.
    if (a < b)
        return -1;
    if (a > b)
        return 1;
    if (a === b)
        return 0;
    // Order NaN less than other numbers
    if (Number.isNaN(a))
        return Number.isNaN(b) ? 0 : -1;
    else if (Number.isNaN(b))
        return 1;
    // This could be two objects (e.g. [7] and ['7']) that aren't ordered
    return Array.isArray(a) ? 0 : Number.NaN;
}
exports.defaultComparator = defaultComparator;
;
function simpleComparator(a, b) {
    return a > b ? 1 : a < b ? -1 : 0;
}
exports.simpleComparator = simpleComparator;
;
/**
 * A reasonably fast collection of key-value pairs with a powerful API.
 * Largely compatible with the standard Map. BTree is a B+ tree data structure,
 * so the collection is sorted by key.
 *
 * B+ trees tend to use memory more efficiently than hashtables such as the
 * standard Map, especially when the collection contains a large number of
 * items. However, maintaining the sort order makes them modestly slower:
 * O(log size) rather than O(1). This B+ tree implementation supports O(1)
 * fast cloning. It also supports freeze(), which can be used to ensure that
 * a BTree is not changed accidentally.
 *
 * Confusingly, the ES6 Map.forEach(c) method calls c(value,key) instead of
 * c(key,value), in contrast to other methods such as set() and entries()
 * which put the key first. I can only assume that the order was reversed on
 * the theory that users would usually want to examine values and ignore keys.
 * BTree's forEach() therefore works the same way, but a second method
 * `.forEachPair((key,value)=>{...})` is provided which sends you the key
 * first and the value second; this method is slightly faster because it is
 * the "native" for-each method for this class.
 *
 * Out of the box, BTree supports keys that are numbers, strings, arrays of
 * numbers/strings, Date, and objects that have a valueOf() method returning a
 * number or string. Other data types, such as arrays of Date or custom
 * objects, require a custom comparator, which you must pass as the second
 * argument to the constructor (the first argument is an optional list of
 * initial items). Symbols cannot be used as keys because they are unordered
 * (one Symbol is never "greater" or "less" than another).
 *
 * @example
 * Given a {name: string, age: number} object, you can create a tree sorted by
 * name and then by age like this:
 *
 *     var tree = new BTree(undefined, (a, b) => {
 *       if (a.name > b.name)
 *         return 1; // Return a number >0 when a > b
 *       else if (a.name < b.name)
 *         return -1; // Return a number <0 when a < b
 *       else // names are equal (or incomparable)
 *         return a.age - b.age; // Return >0 when a.age > b.age
 *     });
 *
 *     tree.set({name:"Bill", age:17}, "happy");
 *     tree.set({name:"Fran", age:40}, "busy & stressed");
 *     tree.set({name:"Bill", age:55}, "recently laid off");
 *     tree.forEachPair((k, v) => {
 *       console.log(`Name: ${k.name} Age: ${k.age} Status: ${v}`);
 *     });
 *
 * @description
 * The "range" methods (`forEach, forRange, editRange`) will return the number
 * of elements that were scanned. In addition, the callback can return {break:R}
 * to stop early and return R from the outer function.
 *
 * - TODO: Test performance of preallocating values array at max size
 * - TODO: Add fast initialization when a sorted array is provided to constructor
 *
 * For more documentation see https://github.com/qwertie/btree-typescript
 *
 * Are you a C# developer? You might like the similar data structures I made for C#:
 * BDictionary, BList, etc. See http://core.loyc.net/collections/
 *
 * @author David Piepgrass
 */
var BTree = /** @class */ (function () {
    /**
     * Initializes an empty B+ tree.
     * @param compare Custom function to compare pairs of elements in the tree.
     *   If not specified, defaultComparator will be used which is valid as long as K extends DefaultComparable.
     * @param entries A set of key-value pairs to initialize the tree
     * @param maxNodeSize Branching factor (maximum items or children per node)
     *   Must be in range 4..256. If undefined or <4 then default is used; if >256 then 256.
     */
    function BTree(entries, compare, maxNodeSize) {
        this._root = EmptyLeaf;
        this._maxNodeSize = maxNodeSize >= 4 ? Math.min(maxNodeSize, 256) : 32;
        this._compare = compare || defaultComparator;
        if (entries)
            this.setPairs(entries);
    }
    Object.defineProperty(BTree.prototype, "size", {
        /////////////////////////////////////////////////////////////////////////////
        // ES6 Map<K,V> methods /////////////////////////////////////////////////////
        /** Gets the number of key-value pairs in the tree. */
        get: function () { return nodeSize(this._root); },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(BTree.prototype, "length", {
        /** Gets the number of key-value pairs in the tree. */
        get: function () { return this.size; },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(BTree.prototype, "isEmpty", {
        /** Returns true iff the tree contains no key-value pairs. */
        get: function () { return this.size === 0; },
        enumerable: false,
        configurable: true
    });
    /** Releases the tree so that its size is 0. */
    BTree.prototype.clear = function () {
        this._root = EmptyLeaf;
    };
    /** Runs a function for each key-value pair, in order from smallest to
     *  largest key. For compatibility with ES6 Map, the argument order to
     *  the callback is backwards: value first, then key. Call forEachPair
     *  instead to receive the key as the first argument.
     * @param thisArg If provided, this parameter is assigned as the `this`
     *        value for each callback.
     * @returns the number of values that were sent to the callback,
     *        or the R value if the callback returned {break:R}. */
    BTree.prototype.forEach = function (callback, thisArg) {
        var _this = this;
        if (thisArg !== undefined)
            callback = callback.bind(thisArg);
        return this.forEachPair(function (k, v) { return callback(v, k, _this); });
    };
    /** Runs a function for each key-value pair, in order from smallest to
     *  largest key. The callback can return {break:R} (where R is any value
     *  except undefined) to stop immediately and return R from forEachPair.
     * @param onFound A function that is called for each key-value pair. This
     *        function can return {break:R} to stop early with result R.
     *        The reason that you must return {break:R} instead of simply R
     *        itself is for consistency with editRange(), which allows
     *        multiple actions, not just breaking.
     * @param initialCounter This is the value of the third argument of
     *        `onFound` the first time it is called. The counter increases
     *        by one each time `onFound` is called. Default value: 0
     * @returns the number of pairs sent to the callback (plus initialCounter,
     *        if you provided one). If the callback returned {break:R} then
     *        the R value is returned instead. */
    BTree.prototype.forEachPair = function (callback, initialCounter) {
        var low = this.minKey(), high = this.maxKey();
        return this.forRange(low, high, true, callback, initialCounter);
    };
    /**
     * Finds a pair in the tree and returns the associated value.
     * @param defaultValue a value to return if the key was not found.
     * @returns the value, or defaultValue if the key was not found.
     * @description Computational complexity: O(log size)
     */
    BTree.prototype.get = function (key, defaultValue) {
        return this._root.get(key, defaultValue, this);
    };
    /**
     * Adds or overwrites a key-value pair in the B+ tree.
     * @param key the key is used to determine the sort order of
     *        data in the tree.
     * @param value data to associate with the key (optional)
     * @param overwrite Whether to overwrite an existing key-value pair
     *        (default: true). If this is false and there is an existing
     *        key-value pair then this method has no effect.
     * @returns true if a new key-value pair was added.
     * @description Computational complexity: O(log size)
     * Note: when overwriting a previous entry, the key is updated
     * as well as the value. This has no effect unless the new key
     * has data that does not affect its sort order.
     */
    BTree.prototype.set = function (key, value, overwrite) {
        if (nodeIsShared(this._root))
            this._root = this._root.clone();
        var result = this._root.set(key, value, overwrite, this);
        if (result === true || result === false)
            return result;
        // Root node has split, so create a new root node.
        this._root = new BNodeInternal([this._root, result]);
        return true;
    };
    /**
     * Returns true if the key exists in the B+ tree, false if not.
     * Use get() for best performance; use has() if you need to
     * distinguish between "undefined value" and "key not present".
     * @param key Key to detect
     * @description Computational complexity: O(log size)
     */
    BTree.prototype.has = function (key) {
        return this.forRange(key, key, true, undefined) !== 0;
    };
    /**
     * Removes a single key-value pair from the B+ tree.
     * @param key Key to find
     * @returns true if a pair was found and removed, false otherwise.
     * @description Computational complexity: O(log size)
     */
    BTree.prototype.delete = function (key) {
        return this.editRange(key, key, true, DeleteRange) !== 0;
    };
    BTree.prototype.with = function (key, value, overwrite) {
        var nu = this.clone();
        return nu.set(key, value, overwrite) || overwrite ? nu : this;
    };
    /** Returns a copy of the tree with the specified key-value pairs set. */
    BTree.prototype.withPairs = function (pairs, overwrite) {
        var nu = this.clone();
        return nu.setPairs(pairs, overwrite) !== 0 || overwrite ? nu : this;
    };
    /** Returns a copy of the tree with the specified keys present.
     *  @param keys The keys to add. If a key is already present in the tree,
     *         neither the existing key nor the existing value is modified.
     *  @param returnThisIfUnchanged if true, returns this if all keys already
     *  existed. Performance note: due to the architecture of this class, all
     *  node(s) leading to existing keys are cloned even if the collection is
     *  ultimately unchanged.
    */
    BTree.prototype.withKeys = function (keys, returnThisIfUnchanged) {
        var nu = this.clone(), changed = false;
        for (var i = 0; i < keys.length; i++)
            changed = nu.set(keys[i], undefined, false) || changed;
        return returnThisIfUnchanged && !changed ? this : nu;
    };
    /** Returns a copy of the tree with the specified key removed.
     * @param returnThisIfUnchanged if true, returns this if the key didn't exist.
     *  Performance note: due to the architecture of this class, node(s) leading
     *  to where the key would have been stored are cloned even when the key
     *  turns out not to exist and the collection is unchanged.
     */
    BTree.prototype.without = function (key, returnThisIfUnchanged) {
        return this.withoutRange(key, key, true, returnThisIfUnchanged);
    };
    /** Returns a copy of the tree with the specified keys removed.
     * @param returnThisIfUnchanged if true, returns this if none of the keys
     *  existed. Performance note: due to the architecture of this class,
     *  node(s) leading to where the key would have been stored are cloned
     *  even when the key turns out not to exist.
     */
    BTree.prototype.withoutKeys = function (keys, returnThisIfUnchanged) {
        var nu = this.clone();
        return nu.deleteKeys(keys) || !returnThisIfUnchanged ? nu : this;
    };
    /** Returns a copy of the tree with the specified range of keys removed. */
    BTree.prototype.withoutRange = function (low, high, includeHigh, returnThisIfUnchanged) {
        var nu = this.clone();
        if (nu.deleteRange(low, high, includeHigh) === 0 && returnThisIfUnchanged)
            return this;
        return nu;
    };
    /** Returns a copy of the tree with pairs removed whenever the callback
     *  function returns false. `where()` is a synonym for this method. */
    BTree.prototype.filter = function (callback, returnThisIfUnchanged) {
        var nu = this.greedyClone();
        var del;
        nu.editAll(function (k, v, i) {
            if (!callback(k, v, i))
                return del = Delete;
        });
        if (!del && returnThisIfUnchanged)
            return this;
        return nu;
    };
    /** Returns a copy of the tree with all values altered by a callback function. */
    BTree.prototype.mapValues = function (callback) {
        var tmp = {};
        var nu = this.greedyClone();
        nu.editAll(function (k, v, i) {
            return tmp.value = callback(v, k, i), tmp;
        });
        return nu;
    };
    BTree.prototype.reduce = function (callback, initialValue) {
        var i = 0, p = initialValue;
        var it = this.entries(this.minKey(), ReusedArray), next;
        while (!(next = it.next()).done)
            p = callback(p, next.value, i++, this);
        return p;
    };
    /////////////////////////////////////////////////////////////////////////////
    // Iterator methods /////////////////////////////////////////////////////////
    /** Returns an iterator that provides items in order (ascending order if
     *  the collection's comparator uses ascending order, as is the default.)
     *  @param lowestKey First key to be iterated, or undefined to start at
     *         minKey(). If the specified key doesn't exist then iteration
     *         starts at the next higher key (according to the comparator).
     *  @param reusedArray Optional array used repeatedly to store key-value
     *         pairs, to avoid creating a new array on every iteration.
     */
    BTree.prototype.entries = function (lowestKey, reusedArray) {
        var info = this.findPath(lowestKey);
        if (info === undefined)
            return iterator();
        var nodequeue = info.nodequeue, nodeindex = info.nodeindex, leaf = info.leaf;
        var state = reusedArray !== undefined ? 1 : 0;
        var i = (lowestKey === undefined ? -1 : leaf.indexOf(lowestKey, 0, this._compare) - 1);
        return iterator(function () {
            jump: for (;;) {
                switch (state) {
                    case 0:
                        if (++i < leaf.keys.length)
                            return { done: false, value: [leaf.keys[i], leaf.values[i]] };
                        state = 2;
                        continue;
                    case 1:
                        if (++i < leaf.keys.length) {
                            reusedArray[0] = leaf.keys[i], reusedArray[1] = leaf.values[i];
                            return { done: false, value: reusedArray };
                        }
                        state = 2;
                    case 2:
                        // Advance to the next leaf node
                        for (var level = -1;;) {
                            if (++level >= nodequeue.length) {
                                state = 3;
                                continue jump;
                            }
                            if (++nodeindex[level] < nodequeue[level].length)
                                break;
                        }
                        for (; level > 0; level--) {
                            nodequeue[level - 1] = nodequeue[level][nodeindex[level]].children;
                            nodeindex[level - 1] = 0;
                        }
                        leaf = nodequeue[0][nodeindex[0]];
                        i = -1;
                        state = reusedArray !== undefined ? 1 : 0;
                        continue;
                    case 3:
                        return { done: true, value: undefined };
                }
            }
        });
    };
    /** Returns an iterator that provides items in reversed order.
     *  @param highestKey Key at which to start iterating, or undefined to
     *         start at maxKey(). If the specified key doesn't exist then iteration
     *         starts at the next lower key (according to the comparator).
     *  @param reusedArray Optional array used repeatedly to store key-value
     *         pairs, to avoid creating a new array on every iteration.
     *  @param skipHighest Iff this flag is true and the highestKey exists in the
     *         collection, the pair matching highestKey is skipped, not iterated.
     */
    BTree.prototype.entriesReversed = function (highestKey, reusedArray, skipHighest) {
        if (highestKey === undefined) {
            highestKey = this.maxKey();
            skipHighest = undefined;
            if (highestKey === undefined)
                return iterator(); // collection is empty
        }
        var _a = this.findPath(highestKey) || this.findPath(this.maxKey()), nodequeue = _a.nodequeue, nodeindex = _a.nodeindex, leaf = _a.leaf;
        check(!nodequeue[0] || leaf === nodequeue[0][nodeindex[0]], "wat!");
        var i = leaf.indexOf(highestKey, 0, this._compare);
        if (!skipHighest && i < leaf.keys.length && this._compare(leaf.keys[i], highestKey) <= 0)
            i++;
        var state = reusedArray !== undefined ? 1 : 0;
        return iterator(function () {
            jump: for (;;) {
                switch (state) {
                    case 0:
                        if (--i >= 0)
                            return { done: false, value: [leaf.keys[i], leaf.values[i]] };
                        state = 2;
                        continue;
                    case 1:
                        if (--i >= 0) {
                            reusedArray[0] = leaf.keys[i], reusedArray[1] = leaf.values[i];
                            return { done: false, value: reusedArray };
                        }
                        state = 2;
                    case 2:
                        // Advance to the next leaf node
                        for (var level = -1;;) {
                            if (++level >= nodequeue.length) {
                                state = 3;
                                continue jump;
                            }
                            if (--nodeindex[level] >= 0)
                                break;
                        }
                        for (; level > 0; level--) {
                            nodequeue[level - 1] = nodequeue[level][nodeindex[level]].children;
                            nodeindex[level - 1] = nodequeue[level - 1].length - 1;
                        }
                        leaf = nodequeue[0][nodeindex[0]];
                        i = leaf.keys.length;
                        state = reusedArray !== undefined ? 1 : 0;
                        continue;
                    case 3:
                        return { done: true, value: undefined };
                }
            }
        });
    };
    /* Used by entries() and entriesReversed() to prepare to start iterating.
     * It develops a "node queue" for each non-leaf level of the tree.
     * Levels are numbered "bottom-up" so that level 0 is a list of leaf
     * nodes from a low-level non-leaf node. The queue at a given level L
     * consists of nodequeue[L] which is the children of a BNodeInternal,
     * and nodeindex[L], the current index within that child list, such
     * such that nodequeue[L-1] === nodequeue[L][nodeindex[L]].children.
     * (However inside this function the order is reversed.)
     */
    BTree.prototype.findPath = function (key) {
        var nextnode = this._root;
        var nodequeue, nodeindex;
        if (nextnode.isLeaf) {
            nodequeue = EmptyArray, nodeindex = EmptyArray; // avoid allocations
        }
        else {
            nodequeue = [], nodeindex = [];
            for (var d = 0; !nextnode.isLeaf; d++) {
                nodequeue[d] = nextnode.children;
                nodeindex[d] = key === undefined ? 0 : nextnode.indexOf(key, 0, this._compare);
                if (nodeindex[d] >= nodequeue[d].length)
                    return; // first key > maxKey()
                nextnode = nodequeue[d][nodeindex[d]];
            }
            nodequeue.reverse();
            nodeindex.reverse();
        }
        return { nodequeue: nodequeue, nodeindex: nodeindex, leaf: nextnode };
    };
    /**
     * Computes the differences between `this` and `other`.
     * For efficiency, the diff is returned via invocations of supplied handlers.
     * The computation is optimized for the case in which the two trees have large amounts
     * of shared data (obtained by calling the `clone` or `with` APIs) and will avoid
     * any iteration of shared state.
     * The handlers can cause computation to early exit by returning {break: R}.
     * Neither of the collections should be changed during the comparison process (in your callbacks), as this method assumes they will not be mutated.
     * @param other The tree to compute a diff against.
     * @param onlyThis Callback invoked for all keys only present in `this`.
     * @param onlyOther Callback invoked for all keys only present in `other`.
     * @param different Callback invoked for all keys with differing values.
     */
    BTree.prototype.diffAgainst = function (other, onlyThis, onlyOther, different) {
        if (other._compare !== this._compare) {
            throw new Error("Tree comparators are not the same.");
        }
        if (this.isEmpty || other.isEmpty) {
            if (this.isEmpty && other.isEmpty)
                return undefined;
            // If one tree is empty, everything will be an onlyThis/onlyOther.
            if (this.isEmpty)
                return onlyOther === undefined ? undefined : BTree.stepToEnd(BTree.makeDiffCursor(other), onlyOther);
            return onlyThis === undefined ? undefined : BTree.stepToEnd(BTree.makeDiffCursor(this), onlyThis);
        }
        // Cursor-based diff algorithm is as follows:
        // - Until neither cursor has navigated to the end of the tree, do the following:
        //  - If the `this` cursor is "behind" the `other` cursor (strictly <, via compare), advance it.
        //  - Otherwise, advance the `other` cursor.
        //  - Any time a cursor is stepped, perform the following:
        //    - If either cursor points to a key/value pair:
        //      - If thisCursor === otherCursor and the values differ, it is a Different.
        //      - If thisCursor > otherCursor and otherCursor is at a key/value pair, it is an OnlyOther.
        //      - If thisCursor < otherCursor and thisCursor is at a key/value pair, it is an OnlyThis as long as the most recent 
        //        cursor step was *not* otherCursor advancing from a tie. The extra condition avoids erroneous OnlyOther calls 
        //        that would occur due to otherCursor being the "leader".
        //    - Otherwise, if both cursors point to nodes, compare them. If they are equal by reference (shared), skip
        //      both cursors to the next node in the walk.
        // - Once one cursor has finished stepping, any remaining steps (if any) are taken and key/value pairs are logged
        //   as OnlyOther (if otherCursor is stepping) or OnlyThis (if thisCursor is stepping).
        // This algorithm gives the critical guarantee that all locations (both nodes and key/value pairs) in both trees that 
        // are identical by value (and possibly by reference) will be visited *at the same time* by the cursors.
        // This removes the possibility of emitting incorrect diffs, as well as allowing for skipping shared nodes.
        var _compare = this._compare;
        var thisCursor = BTree.makeDiffCursor(this);
        var otherCursor = BTree.makeDiffCursor(other);
        // It doesn't matter how thisSteppedLast is initialized.
        // Step order is only used when either cursor is at a leaf, and cursors always start at a node.
        var thisSuccess = true, otherSuccess = true, prevCursorOrder = BTree.compare(thisCursor, otherCursor, _compare);
        while (thisSuccess && otherSuccess) {
            var cursorOrder = BTree.compare(thisCursor, otherCursor, _compare);
            var thisLeaf = thisCursor.leaf, thisInternalSpine = thisCursor.internalSpine, thisLevelIndices = thisCursor.levelIndices;
            var otherLeaf = otherCursor.leaf, otherInternalSpine = otherCursor.internalSpine, otherLevelIndices = otherCursor.levelIndices;
            if (thisLeaf || otherLeaf) {
                // If the cursors were at the same location last step, then there is no work to be done.
                if (prevCursorOrder !== 0) {
                    if (cursorOrder === 0) {
                        if (thisLeaf && otherLeaf && different) {
                            // Equal keys, check for modifications
                            var valThis = thisLeaf.values[thisLevelIndices[thisLevelIndices.length - 1]];
                            var valOther = otherLeaf.values[otherLevelIndices[otherLevelIndices.length - 1]];
                            if (!Object.is(valThis, valOther)) {
                                var result = different(thisCursor.currentKey, valThis, valOther);
                                if (result && result.break)
                                    return result.break;
                            }
                        }
                    }
                    else if (cursorOrder > 0) {
                        // If this is the case, we know that either:
                        // 1. otherCursor stepped last from a starting position that trailed thisCursor, and is still behind, or
                        // 2. thisCursor stepped last and leapfrogged otherCursor
                        // Either of these cases is an "only other"
                        if (otherLeaf && onlyOther) {
                            var otherVal = otherLeaf.values[otherLevelIndices[otherLevelIndices.length - 1]];
                            var result = onlyOther(otherCursor.currentKey, otherVal);
                            if (result && result.break)
                                return result.break;
                        }
                    }
                    else if (onlyThis) {
                        if (thisLeaf && prevCursorOrder !== 0) {
                            var valThis = thisLeaf.values[thisLevelIndices[thisLevelIndices.length - 1]];
                            var result = onlyThis(thisCursor.currentKey, valThis);
                            if (result && result.break)
                                return result.break;
                        }
                    }
                }
            }
            else if (!thisLeaf && !otherLeaf && cursorOrder === 0) {
                var lastThis = thisInternalSpine.length - 1;
                var lastOther = otherInternalSpine.length - 1;
                var nodeThis = thisInternalSpine[lastThis][thisLevelIndices[lastThis]];
                var nodeOther = otherInternalSpine[lastOther][otherLevelIndices[lastOther]];
                if (nodeOther === nodeThis) {
                    prevCursorOrder = 0;
                    thisSuccess = BTree.step(thisCursor, true);
                    otherSuccess = BTree.step(otherCursor, true);
                    continue;
                }
            }
            prevCursorOrder = cursorOrder;
            if (cursorOrder < 0) {
                thisSuccess = BTree.step(thisCursor);
            }
            else {
                otherSuccess = BTree.step(otherCursor);
            }
        }
        if (thisSuccess && onlyThis)
            return BTree.finishCursorWalk(thisCursor, otherCursor, _compare, onlyThis);
        if (otherSuccess && onlyOther)
            return BTree.finishCursorWalk(otherCursor, thisCursor, _compare, onlyOther);
    };
    ///////////////////////////////////////////////////////////////////////////
    // Helper methods for diffAgainst /////////////////////////////////////////
    BTree.finishCursorWalk = function (cursor, cursorFinished, compareKeys, callback) {
        var compared = BTree.compare(cursor, cursorFinished, compareKeys);
        if (compared === 0) {
            if (!BTree.step(cursor))
                return undefined;
        }
        else if (compared < 0) {
            check(false, "cursor walk terminated early");
        }
        return BTree.stepToEnd(cursor, callback);
    };
    BTree.stepToEnd = function (cursor, callback) {
        var canStep = true;
        while (canStep) {
            var leaf = cursor.leaf, levelIndices = cursor.levelIndices, currentKey = cursor.currentKey;
            if (leaf) {
                var value = leaf.values[levelIndices[levelIndices.length - 1]];
                var result = callback(currentKey, value);
                if (result && result.break)
                    return result.break;
            }
            canStep = BTree.step(cursor);
        }
        return undefined;
    };
    BTree.makeDiffCursor = function (tree) {
        var _root = tree._root, height = tree.height;
        return { height: height, internalSpine: [[_root]], levelIndices: [0], leaf: undefined, currentKey: _root.maxKey() };
    };
    /**
     * Advances the cursor to the next step in the walk of its tree.
     * Cursors are walked backwards in sort order, as this allows them to leverage maxKey() in order to be compared in O(1).
     * @param cursor The cursor to step
     * @param stepToNode If true, the cursor will be advanced to the next node (skipping values)
     * @returns true if the step was completed and false if the step would have caused the cursor to move beyond the end of the tree.
     */
    BTree.step = function (cursor, stepToNode) {
        var internalSpine = cursor.internalSpine, levelIndices = cursor.levelIndices, leaf = cursor.leaf;
        if (stepToNode === true || leaf) {
            var levelsLength = levelIndices.length;
            // Step to the next node only if:
            // - We are explicitly directed to via stepToNode, or
            // - There are no key/value pairs left to step to in this leaf
            if (stepToNode === true || levelIndices[levelsLength - 1] === 0) {
                var spineLength = internalSpine.length;
                // Root is leaf
                if (spineLength === 0)
                    return false;
                // Walk back up the tree until we find a new subtree to descend into
                var nodeLevelIndex = spineLength - 1;
                var levelIndexWalkBack = nodeLevelIndex;
                while (levelIndexWalkBack >= 0) {
                    if (levelIndices[levelIndexWalkBack] > 0) {
                        if (levelIndexWalkBack < levelsLength - 1) {
                            // Remove leaf state from cursor
                            cursor.leaf = undefined;
                            levelIndices.pop();
                        }
                        // If we walked upwards past any internal node, slice them out
                        if (levelIndexWalkBack < nodeLevelIndex)
                            cursor.internalSpine = internalSpine.slice(0, levelIndexWalkBack + 1);
                        // Move to new internal node
                        cursor.currentKey = internalSpine[levelIndexWalkBack][--levelIndices[levelIndexWalkBack]].maxKey();
                        return true;
                    }
                    levelIndexWalkBack--;
                }
                // Cursor is in the far left leaf of the tree, no more nodes to enumerate
                return false;
            }
            else {
                // Move to new leaf value
                var valueIndex = --levelIndices[levelsLength - 1];
                cursor.currentKey = leaf.keys[valueIndex];
                return true;
            }
        }
        else { // Cursor does not point to a value in a leaf, so move downwards
            var nextLevel = internalSpine.length;
            var currentLevel = nextLevel - 1;
            var node = internalSpine[currentLevel][levelIndices[currentLevel]];
            if (node.isLeaf) {
                // Entering into a leaf. Set the cursor to point at the last key/value pair.
                cursor.leaf = node;
                var valueIndex = levelIndices[nextLevel] = node.values.length - 1;
                cursor.currentKey = node.keys[valueIndex];
            }
            else {
                var children = node.children;
                internalSpine[nextLevel] = children;
                var childIndex = children.length - 1;
                levelIndices[nextLevel] = childIndex;
                cursor.currentKey = children[childIndex].maxKey();
            }
            return true;
        }
    };
    /**
     * Compares the two cursors. Returns a value indicating which cursor is ahead in a walk.
     * Note that cursors are advanced in reverse sorting order.
     */
    BTree.compare = function (cursorA, cursorB, compareKeys) {
        var heightA = cursorA.height, currentKeyA = cursorA.currentKey, levelIndicesA = cursorA.levelIndices;
        var heightB = cursorB.height, currentKeyB = cursorB.currentKey, levelIndicesB = cursorB.levelIndices;
        // Reverse the comparison order, as cursors are advanced in reverse sorting order
        var keyComparison = compareKeys(currentKeyB, currentKeyA);
        if (keyComparison !== 0) {
            return keyComparison;
        }
        // Normalize depth values relative to the shortest tree.
        // This ensures that concurrent cursor walks of trees of differing heights can reliably land on shared nodes at the same time.
        // To accomplish this, a cursor that is on an internal node at depth D1 with maxKey X is considered "behind" a cursor on an
        // internal node at depth D2 with maxKey Y, when D1 < D2. Thus, always walking the cursor that is "behind" will allow the cursor
        // at shallower depth (but equal maxKey) to "catch up" and land on shared nodes.
        var heightMin = heightA < heightB ? heightA : heightB;
        var depthANormalized = levelIndicesA.length - (heightA - heightMin);
        var depthBNormalized = levelIndicesB.length - (heightB - heightMin);
        return depthANormalized - depthBNormalized;
    };
    // End of helper methods for diffAgainst //////////////////////////////////
    ///////////////////////////////////////////////////////////////////////////
    /** Returns a new iterator for iterating the keys of each pair in ascending order.
     *  @param firstKey: Minimum key to include in the output. */
    BTree.prototype.keys = function (firstKey) {
        var it = this.entries(firstKey, ReusedArray);
        return iterator(function () {
            var n = it.next();
            if (n.value)
                n.value = n.value[0];
            return n;
        });
    };
    /** Returns a new iterator for iterating the values of each pair in order by key.
     *  @param firstKey: Minimum key whose associated value is included in the output. */
    BTree.prototype.values = function (firstKey) {
        var it = this.entries(firstKey, ReusedArray);
        return iterator(function () {
            var n = it.next();
            if (n.value)
                n.value = n.value[1];
            return n;
        });
    };
    Object.defineProperty(BTree.prototype, "maxNodeSize", {
        /////////////////////////////////////////////////////////////////////////////
        // Additional methods ///////////////////////////////////////////////////////
        /** Returns the maximum number of children/values before nodes will split. */
        get: function () {
            return this._maxNodeSize;
        },
        enumerable: false,
        configurable: true
    });
    /** Gets the lowest key in the tree. Complexity: O(log size) */
    BTree.prototype.minKey = function () { return this._root.minKey(); };
    /** Gets the highest key in the tree. Complexity: O(1) */
    BTree.prototype.maxKey = function () { return this._root.maxKey(); };
    /** Quickly clones the tree by marking the root node as shared.
     *  Both copies remain editable. When you modify either copy, any
     *  nodes that are shared (or potentially shared) between the two
     *  copies are cloned so that the changes do not affect other copies.
     *  This is known as copy-on-write behavior, or "lazy copying". */
    BTree.prototype.clone = function () {
        markNodeShared(this._root);
        var result = new BTree(undefined, this._compare, this._maxNodeSize);
        result._root = this._root;
        return result;
    };
    /** Performs a greedy clone, immediately duplicating any nodes that are
     *  not currently marked as shared, in order to avoid marking any
     *  additional nodes as shared.
     *  @param force Clone all nodes, even shared ones.
     */
    BTree.prototype.greedyClone = function (force) {
        var result = new BTree(undefined, this._compare, this._maxNodeSize);
        result._root = this._root.greedyClone(force);
        return result;
    };
    /**
     * Merges this tree with `other`, reusing subtrees wherever possible.
     * Neither input tree is modified.
     * @param other The other tree to merge into this one.
     * @param merge Called for keys that appear in both trees. Return the desired value, or
     *        `undefined` to omit the key from the result.
     * @returns A new BTree that contains the merged key/value pairs.
     * @description Complexity: O(1) when the ranges do not overlap; otherwise
     *        O(k · log n) where k is the number of overlapping keys.
     */
    BTree.prototype.merge = function (other, merge) {
        /* Merge algorithm:
         *
         * 1. First, select the deeper of the two B+ trees. This should also be the larger of the two trees.
         *    Call the deeper tree A and the smaller one B.
         * 2. Clone A. This clone becomes the result M and is also the structure we mutate and return.
         * 3. Initialize a candidate collection containing the root of B.
         *    - Each candidate stores a node plus its [min, max] key range.
         *    - The candidates are guaranteed to be disjoint because they originate from the same B+ tree.
         *    - Use a BTree keyed by the ranges with a comparator that treats overlapping ranges as equal.
         *      This allows range lookups and overlap detection in O(log n).
         *    - The collection must support:
         *      a. Finding the unique candidate that overlaps a specific key.
         *      b. Detecting whether any candidate is enclosed by a key range.
         * 4. Build an array `toMerge` containing leaf nodes that cannot be reused and must later be merged manually.
         * 5. Walk M recursively with `processSource(currentNode)`:
         *    a. For each endpoint of `currentNode` (its min key and every key in the node),
         *       explode overlapping candidates:
         *       - Remove the overlapping candidate from the set.
         *       - If it is internal, add each child as a new candidate (their ranges are disjoint subsets).
         *       - If it is a leaf, push it onto `toMerge`.
         *       The outer for-loop and inner while-loop continue exploding until no candidate overlaps an endpoint.
         *    b. After the endpoints are processed, perform an enclosure query using the full [min, max] range
         *       of `currentNode`. If any candidates are enclosed, recurse into each child of `currentNode`.
         *       Otherwise stop recursing below this node.
         * 6. Once the traversal finishes:
         *    - Every remaining candidate in the set is reused via `insertSharedSubtree`.
         *    - Every leaf in `toMerge` is merged manually (handling key conflicts via `merge`).
         */
        // Fast paths for empty trees
        var sizeThis = nodeSize(this._root);
        var sizeOther = nodeSize(other._root);
        if (sizeThis === 0)
            return other.clone();
        if (sizeOther === 0)
            return this.clone();
        // Ensure both trees share the same comparator reference
        if (this._compare !== other._compare)
            throw new Error("Cannot merge BTrees with different comparators.");
        if (this._maxNodeSize !== other._maxNodeSize)
            throw new Error("Cannot merge BTrees with different max node sizes.");
        // Pick deeper (and then larger) tree as source of the clone
        var heightThis = this.height;
        var heightOther = other.height;
        var treeA = this;
        var treeB = other;
        var sourceHeight;
        var swapped;
        if (heightThis < heightOther || (heightThis === heightOther && sizeThis < sizeOther)) {
            treeA = other;
            treeB = this;
            sourceHeight = heightThis;
            swapped = true;
        }
        else {
            sourceHeight = heightOther;
            swapped = false;
        }
        var result = treeA.clone();
        var cmp = this._compare;
        // Comparator for disjoint range keys (Step 3)
        var compareRanges = function (a, b) {
            if (cmp(a.max, b.min) < 0)
                return -1;
            if (cmp(a.min, b.max) > 0)
                return 1;
            return 0;
        };
        // Step 3: candidate set for reusable subtrees
        var candidateSet = new BTree(undefined, compareRanges, treeB._maxNodeSize);
        // Step 4: leaves that must be merged manually
        var toMerge = [];
        var addCandidate = function (node, depth) {
            var min = node.minKey();
            var max = node.maxKey();
            if (min === undefined || max === undefined)
                return;
            var range = { min: min, max: max };
            candidateSet.set(range, { node: node, depth: depth, range: range });
        };
        // start with root as candidate
        addCandidate(treeB._root, 0);
        var explodeCandidate = function (entry) {
            candidateSet.delete(entry.range);
            var node = entry.node;
            if (node.isLeaf) {
                toMerge.push(entry);
                return;
            }
            var internal = node;
            var nextDepth = entry.depth + 1;
            for (var i = 0; i < internal.children.length; i++) {
                addCandidate(internal.children[i], nextDepth);
            }
        };
        var explodeOverlaps = function (key) {
            if (key === undefined || candidateSet.isEmpty)
                return;
            var keyQuery = { min: key, max: key };
            for (var entry = candidateSet.get(keyQuery); entry; entry = candidateSet.get(keyQuery))
                explodeCandidate(entry);
        };
        var getEnclosedCandidates = function (minKey, maxKey, output) {
            var lowRange = { min: minKey, max: minKey };
            var highRange = { min: maxKey, max: maxKey };
            var enclosedPairs = candidateSet.getRange(lowRange, highRange, true);
            for (var i = 0; i < enclosedPairs.length; i++) {
                var range = enclosedPairs[i][0];
                if (cmp(range.min, minKey) > 0 && cmp(range.max, maxKey) < 0)
                    output.push(enclosedPairs[i][1]);
            }
        };
        // Reusable buffers to avoid allocations
        var enclosedCandidatesBuffer = [];
        // Step 5: recursive traversal over M that explodes overlapping candidates
        var processSource = function (currentNode, depth) {
            var minKey = currentNode.minKey();
            explodeOverlaps(minKey);
            for (var i = 0; i < currentNode.keys.length; i++) {
                explodeOverlaps(currentNode.keys[i]);
            }
            if (candidateSet.isEmpty)
                return;
            var maxKey = currentNode.maxKey();
            var enclosedCandidates = enclosedCandidatesBuffer;
            if (currentNode.isLeaf) {
                while (true) {
                    enclosedCandidates.length = 0;
                    getEnclosedCandidates(minKey, maxKey, enclosedCandidates);
                    if (enclosedCandidates.length === 0)
                        return;
                    var explodedAny = false;
                    for (var i = 0; i < enclosedCandidates.length; i++) {
                        explodeCandidate(enclosedCandidates[i]);
                        explodedAny = true;
                    }
                    if (!explodedAny || candidateSet.isEmpty)
                        return;
                }
            }
            enclosedCandidates.length = 0;
            getEnclosedCandidates(minKey, maxKey, enclosedCandidates);
            if (enclosedCandidates.length > 0) {
                var internal = currentNode;
                var children = internal.children;
                var childKeys = internal.keys;
                var nextDepth = depth + 1;
                // Process children recursively
                for (var i = 0; i < children.length; i++) {
                    // Pass the cached maxKey since we know keys[i] = children[i].maxKey()
                    processSource(children[i], nextDepth);
                }
            }
        };
        processSource(result._root, 0);
        // Step 6 (first half): reuse remaining candidates via subtree sharing
        var reusableEntries = [];
        if (!candidateSet.isEmpty) {
            candidateSet.forEachPair(function (range, entry) {
                reusableEntries.push(entry);
            });
        }
        for (var _i = 0, reusableEntries_1 = reusableEntries; _i < reusableEntries_1.length; _i++) {
            var entry = reusableEntries_1[_i];
            result.insertSharedSubtree(entry.node, entry.depth, sourceHeight);
        }
        // Step 6 (second half): merge leaf nodes that could not be reused
        for (var i = 0; i < toMerge.length; i++) {
            var entry = toMerge[i];
            var leaf = entry.node;
            var values = leaf.values;
            for (var j = 0; j < leaf.keys.length; j++) {
                var key = leaf.keys[j];
                var leafValue = values[j];
                var existingValue = result.get(key);
                if (existingValue !== undefined) {
                    var leftValue = swapped ? leafValue : existingValue;
                    var rightValue = swapped ? existingValue : leafValue;
                    var mergedValue = merge(key, leftValue, rightValue);
                    if (mergedValue !== undefined) {
                        result.set(key, mergedValue, true);
                    }
                    else {
                        result.delete(key);
                    }
                }
                else {
                    result.set(key, leafValue, true);
                }
            }
        }
        return result;
    };
    /**
     * Inserts a shared subtree from the source tree into the target tree at the correct depth.
     * Assumes the subtree is no taller than the current target. Height mismatches are treated
     * as programmer error (guarded with `check`).
     * The routine walks down from the root until it reaches the layer whose children share
     * the same remaining height as the source subtree, cloning nodes on the path as needed.
     * @param target The target tree
     * @param sourceNode The node to insert (will be marked as shared)
     * @param sourceDepth The depth of sourceNode in its original tree
     * @param sourceHeight The total height of the source tree
     */
    BTree.prototype.insertSharedSubtree = function (subtree, sourceDepth, sourceHeight) {
        // The subtree root must be shared to preserve COW across trees.
        markNodeShared(subtree);
        var boundaryKey = subtree.maxKey();
        check(boundaryKey !== undefined, "insertSharedSubtree: subtree must be non-empty");
        var subtreeHeight = sourceHeight - sourceDepth;
        check(subtreeHeight >= 0, "insertSharedSubtree: invalid source depth");
        var targetHeight = this.height;
        check(subtreeHeight <= targetHeight, "insertSharedSubtree: subtree taller than target");
        var depthDelta = targetHeight - subtreeHeight;
        var targetDepth = depthDelta <= 0
            ? (targetHeight === 0 ? 0 : 1)
            : depthDelta;
        check(targetDepth >= 0 && targetDepth <= targetHeight, "insertSharedSubtree: invalid target depth");
        // unzipping at either the min or max key of the subtree should work given it is disjoint with this tree
        var _a = this.unzip(boundaryKey, targetDepth), leftZip = _a.leftZip, rightZip = _a.rightZip, gapParent = _a.gapParent, gapIndex = _a.gapIndex;
        var delta = nodeSize(subtree);
        // Insert subtree at depth targetDepth.
        var parent = gapParent;
        if (parent) {
            parent = this._ensureWritableInternalInParent(parent);
            parent.insert(gapIndex, subtree);
            // propagate size delta up the ancestor chain (parent already updated by insert)
            this._addSizeToAncestors(parent, delta);
            if (parent.keys.length > this._maxNodeSize)
                this._cascadeSplitUp(parent);
        }
        else {
            // New root: place subtree either before or after the current root based on boundary.
            var root = this._root;
            var children = gapIndex === 0 ? [subtree, root] : [root, subtree];
            var newRoot = new BNodeInternal(children);
            var rootSize = nodeSize(root);
            setNodeSize(newRoot, rootSize + delta);
            this._root = newRoot;
        }
        // Fix underfilled nodes along both zipper edges top->bottom.
        this._fixupZipperEdge(leftZip, /*isLeft*/ true);
        this._fixupZipperEdge(rightZip, /*isLeft*/ false);
    };
    /**
     * Splits the tree to create a gap at the specified depth D on the search path for key k.
     * Returns the zipper edges and gap location.
     * If k is already present in the tree, throws an error.
     * @param k The key at which to unzip.
     * @param D The depth at which to create the gap. 0 = root.
     * @returns The zipper edges and gap location.
     */
    BTree.prototype.unzip = function (k, D) {
        if (D < 0 || D > this.height)
            throw new Error("unzip: invalid depth");
        // 0) Reject duplicate key.
        {
            var _a = this._descendToLeaf(k), leaf = _a.leaf, pos = _a.pos;
            if (pos >= 0)
                throw new Error("unzip: key already exists");
            // 1) Leaf boundary: split leaf only if k would land in the middle.
            var ins = ~pos;
            if (ins !== 0 && ins !== leaf.keys.length) {
                var parent = this._parentOfNode(leaf);
                if (parent)
                    parent = this._ensureWritableInternalInParent(parent);
                var _b = this._splitLeafAt(leaf, ins), L = _b.L, R = _b.R;
                if (parent) {
                    var j = this._indexOfChild(parent, leaf);
                    parent.children[j] = L;
                    parent.keys[j] = L.maxKey();
                    parent.insert(j + 1, R);
                    // cached sizes
                    setNodeSize(L, L.keys.length);
                    setNodeSize(R, R.keys.length);
                    this._recomputeInternalSizeFromChildren(parent);
                    if (parent.keys.length > this._maxNodeSize)
                        this._cascadeSplitUp(parent);
                }
                else {
                    // leaf was root
                    var newRoot = new BNodeInternal([L, R]);
                    setNodeSize(L, L.keys.length);
                    setNodeSize(R, R.keys.length);
                    this._setSizeFromChildren(newRoot);
                    this._root = newRoot;
                }
            }
        }
        // 2) Ascend from the (possibly new) leaf’s parent up to and including depth D.
        var H0 = this.height;
        var steps = H0 - D; // number of interior levels from leaf’s parent up to depth D
        for (var s = 1; s <= steps; s++) {
            var _c = this._nodeAtDepthOnRoute(k, H0 - s), node = _c.node, parent = _c.parent;
            var cur = node;
            cur = this._ensureWritableInternalInParent(cur);
            var i = Math.min(cur.indexOf(k, 0, this._compare), cur.children.length - 1);
            if (i === 0 || i === cur.children.length - 1)
                continue; // already extreme at this level
            // Need an exact boundary inside cur at cut=i
            var _d = this._splitInternalAtCut(cur, i), L = _d.L, R = _d.R;
            if (parent) {
                var writableParent = parent;
                writableParent = this._ensureWritableInternalInParent(writableParent);
                var slot = this._indexOfChild(writableParent, cur);
                writableParent.children[slot] = L;
                writableParent.keys[slot] = L.maxKey();
                writableParent.insert(slot + 1, R);
                this._recomputeInternalSizeFromChildren(writableParent);
                if (writableParent.keys.length > this._maxNodeSize)
                    this._cascadeSplitUp(writableParent);
            }
            else {
                var newRoot = new BNodeInternal([L, R]);
                this._setSizeFromChildren(newRoot);
                this._root = newRoot;
            }
        }
        // 3) Compute (gapParent, gapIndex) at depth D and build zipper edges.
        var _e = this._nodeAtDepthOnRoute(k, D), nodeD = _e.node, parentD = _e.parent;
        var gapParent = undefined;
        var gapIndex = 0;
        var leftStart;
        var rightStart;
        if (nodeD.isLeaf) {
            var leaf = nodeD;
            var posLeaf = leaf.indexOf(k, -1, this._compare);
            var insLeaf = ~posLeaf;
            check(insLeaf === 0 || insLeaf === leaf.keys.length, "unzip: leaf was not aligned");
            gapParent = parentD;
            if (gapParent) {
                var childIdx = this._indexOfChild(gapParent, leaf);
                if (insLeaf === 0) {
                    gapIndex = childIdx;
                    rightStart = leaf;
                    leftStart = childIdx > 0 ? gapParent.children[childIdx - 1] : undefined;
                }
                else {
                    gapIndex = childIdx + 1;
                    leftStart = leaf;
                    rightStart = childIdx + 1 < gapParent.children.length ? gapParent.children[childIdx + 1] : undefined;
                }
            }
            else {
                if (insLeaf === 0) {
                    gapIndex = 0;
                    rightStart = leaf;
                    leftStart = undefined;
                }
                else {
                    gapIndex = 1;
                    leftStart = leaf;
                    rightStart = undefined;
                }
            }
        }
        else {
            var curD = nodeD;
            var iD = Math.min(curD.indexOf(k, 0, this._compare), curD.children.length - 1);
            gapParent = parentD;
            if (iD === 0) {
                if (gapParent) {
                    var j = this._indexOfChild(gapParent, curD);
                    gapIndex = j; // insert before curD at depth D-1
                    rightStart = curD; // right zipper starts inside curD
                    leftStart = j > 0 ? gapParent.children[j - 1] : undefined; // may be absent (extreme)
                }
                else {
                    gapIndex = 0;
                    rightStart = curD;
                    leftStart = undefined;
                }
            }
            else if (iD === curD.children.length - 1) {
                if (gapParent) {
                    var j = this._indexOfChild(gapParent, curD);
                    gapIndex = j + 1; // insert after curD at depth D-1
                    leftStart = curD;
                    rightStart = j + 1 < gapParent.children.length ? gapParent.children[j + 1] : undefined;
                }
                else {
                    gapIndex = 1; // new root, inserted to the right of curD
                    leftStart = curD;
                    rightStart = undefined;
                }
            }
            else {
                // This level was split in the loop above; the boundary lies between L and R in parentD.
                // Find the first child strictly to the right of k at depth D-1.
                var p = parentD;
                var rightIdx = Math.min(p.indexOf(k, 0, this._compare), p.children.length - 1);
                check(rightIdx > 0, "unzip: unexpected boundary index");
                gapParent = p;
                gapIndex = rightIdx;
                leftStart = p.children[rightIdx - 1];
                rightStart = p.children[rightIdx];
            }
        }
        var leftZip = leftStart ? this._collectEdgeDown(leftStart, /*goLast*/ true) : [];
        var rightZip = rightStart ? this._collectEdgeDown(rightStart, /*goLast*/ false) : [];
        return { leftZip: leftZip, rightZip: rightZip, gapParent: gapParent, gapIndex: gapIndex };
    };
    BTree.prototype._descendToLeaf = function (k) {
        var x = this._root;
        while (!x.isLeaf) {
            var xi = x;
            var i = Math.min(xi.indexOf(k, 0, this._compare), xi.children.length - 1);
            x = xi.children[i];
        }
        var leaf = x;
        var pos = leaf.indexOf(k, -1, this._compare);
        return { leaf: leaf, pos: pos };
    };
    BTree.prototype._nodeAtDepthOnRoute = function (k, depth) {
        var x = this._root;
        var parent = undefined;
        for (var d = 0; d < depth; d++) {
            var xi = x;
            var i = Math.min(xi.indexOf(k, 0, this._compare), xi.children.length - 1);
            parent = xi;
            x = xi.children[i];
        }
        return { node: x, parent: parent };
    };
    BTree.prototype._collectEdgeDown = function (start, goLast) {
        var out = [start];
        var n = start;
        while (!n.isLeaf) {
            var ni = n;
            n = ni.children[goLast ? ni.children.length - 1 : 0];
            out.push(n);
        }
        return out;
    };
    BTree.prototype._splitLeafAt = function (leaf, pos) {
        var vals = leaf.reifyValues();
        var L = new BNode(leaf.keys.slice(0, pos), vals.slice(0, pos));
        var R = new BNode(leaf.keys.slice(pos), vals.slice(pos));
        return { L: L, R: R };
    };
    BTree.prototype._splitInternalAtCut = function (n, cut) {
        var L = new BNodeInternal(n.children.slice(0, cut));
        var R = new BNodeInternal(n.children.slice(cut));
        this._setSizeFromChildren(L);
        this._setSizeFromChildren(R);
        return { L: L, R: R };
    };
    BTree.prototype._cascadeSplitUp = function (node) {
        var cur = node;
        while (cur && cur.keys.length > this._maxNodeSize) {
            // writable cur is already ensured by callers
            var right = cur.splitOffRightSide();
            this._setSizeFromChildren(cur);
            this._setSizeFromChildren(right);
            var gp = this._parentOfNode(cur);
            if (!gp) {
                var newRoot = new BNodeInternal([cur, right]);
                this._setSizeFromChildren(newRoot);
                this._root = newRoot;
                return;
            }
            var writableGp = gp;
            writableGp = this._ensureWritableInternalInParent(writableGp);
            var j = this._indexOfChild(writableGp, cur);
            writableGp.insert(j + 1, right);
            // Parent subtree size unchanged (cur + right == old cur)
            this._recomputeInternalSizeFromChildren(writableGp);
            cur = writableGp;
        }
    };
    BTree.prototype._fixupZipperEdge = function (edge, isLeft) {
        if (edge.length === 0)
            return;
        var MAX = this._maxNodeSize;
        var HALF = (MAX + 1) >> 1;
        for (var d = 0; d < edge.length; d++) {
            var node = edge[d];
            if (node === this._root)
                continue; // root underfill is allowed or handled elsewhere
            if (node.keys.length >= HALF)
                continue;
            // Find parent each time, since previous steps may have re-parented nodes.
            var parent = this._parentOfNode(node);
            if (!parent)
                continue;
            // Choose sibling: toward the gap first, else the other side.
            var j = this._indexOfChild(parent, node);
            if (j < 0)
                continue;
            var sibIndex = isLeft ? j + 1 : j - 1;
            if (sibIndex < 0 || sibIndex >= parent.children.length)
                sibIndex = isLeft ? j - 1 : j + 1;
            if (sibIndex < 0 || sibIndex >= parent.children.length)
                continue; // no sibling available here
            parent = this._ensureWritableInternalInParent(parent);
            if (nodeIsShared(node))
                parent.children[j] = node = node.clone();
            var leftSibling = j > 0 ? parent.children[j - 1] : undefined;
            var rightSibling = j + 1 < parent.children.length ? parent.children[j + 1] : undefined;
            if (leftSibling && nodeIsShared(leftSibling))
                parent.children[j - 1] = leftSibling = leftSibling.clone();
            if (rightSibling && nodeIsShared(rightSibling))
                parent.children[j + 1] = rightSibling = rightSibling.clone();
            var borrowFromLeft = leftSibling && leftSibling.keys.length > HALF;
            var borrowFromRight = rightSibling && rightSibling.keys.length > HALF;
            if (borrowFromLeft) {
                if (node.children) {
                    node.takeFromLeft(leftSibling);
                    this._setSizeFromChildren(node);
                    this._setSizeFromChildren(leftSibling);
                }
                else {
                    node.takeFromLeft(leftSibling);
                    setNodeSize(node, node.keys.length);
                    setNodeSize(leftSibling, leftSibling.keys.length);
                }
                parent.keys[j - 1] = parent.children[j - 1].maxKey();
                parent.keys[j] = parent.children[j].maxKey();
            }
            else if (borrowFromRight) {
                if (node.children) {
                    node.takeFromRight(rightSibling);
                    this._setSizeFromChildren(node);
                    this._setSizeFromChildren(rightSibling);
                }
                else {
                    node.takeFromRight(rightSibling);
                    setNodeSize(node, node.keys.length);
                    setNodeSize(rightSibling, rightSibling.keys.length);
                }
                parent.keys[j] = parent.children[j].maxKey();
                parent.keys[j + 1] = parent.children[j + 1].maxKey();
            }
            else if (leftSibling) {
                if (leftSibling.children) {
                    leftSibling.mergeSibling(node, MAX);
                    this._setSizeFromChildren(leftSibling);
                }
                else {
                    leftSibling.mergeSibling(node, MAX);
                    setNodeSize(leftSibling, leftSibling.keys.length);
                }
                parent.children.splice(j, 1);
                parent.keys.splice(j, 1);
                parent.keys[j - 1] = parent.children[j - 1].maxKey();
            }
            else if (rightSibling) {
                if (node.children) {
                    node.mergeSibling(rightSibling, MAX);
                    this._setSizeFromChildren(node);
                }
                else {
                    node.mergeSibling(rightSibling, MAX);
                    setNodeSize(node, node.keys.length);
                }
                parent.children.splice(j + 1, 1);
                parent.keys.splice(j + 1, 1);
                parent.keys[j] = parent.children[j].maxKey();
            }
            this._recomputeInternalSizeFromChildren(parent);
            if (parent.keys.length > MAX)
                this._cascadeSplitUp(parent);
        }
    };
    BTree.prototype._ensureWritableInternalInParent = function (node) {
        if (!nodeIsShared(node))
            return node;
        var gp = this._parentOfNode(node);
        var clone = node.clone();
        if (gp) {
            var j = this._indexOfChild(gp, node);
            gp.children[j] = clone;
            gp.keys[j] = clone.maxKey();
        }
        else {
            this._root = clone;
        }
        return clone;
    };
    BTree.prototype._parentOfNode = function (child) {
        // Walk by routing on maxKey. Assumes unique keys.
        var key = child.maxKey();
        var x = this._root;
        var p = undefined;
        while (!x.isLeaf) {
            var xi = x;
            if (xi === child)
                return p;
            var i = Math.min(xi.indexOf(key, 0, this._compare), xi.children.length - 1);
            p = xi;
            x = xi.children[i];
        }
        return p;
    };
    BTree.prototype._indexOfChild = function (p, c) {
        for (var i = 0; i < p.children.length; i++)
            if (p.children[i] === c)
                return i;
        return -1;
    };
    BTree.prototype._setSizeFromChildren = function (n) {
        var s = 0;
        for (var _i = 0, _a = n.children; _i < _a.length; _i++) {
            var c = _a[_i];
            s += nodeSize(c);
        }
        setNodeSize(n, s);
    };
    BTree.prototype._recomputeInternalSizeFromChildren = function (n) {
        // Recompute both keys and cached size from children.
        for (var i = 0; i < n.children.length; i++)
            n.keys[i] = n.children[i].maxKey();
        this._setSizeFromChildren(n);
    };
    BTree.prototype._addSizeToAncestors = function (start, delta) {
        var child = start;
        var parent = this._parentOfNode(child);
        while (parent) {
            parent = this._ensureWritableInternalInParent(parent);
            adjustNodeSize(parent, delta);
            var idx = this._indexOfChild(parent, child);
            if (idx >= 0)
                parent.keys[idx] = child.maxKey();
            child = parent;
            parent = this._parentOfNode(child);
        }
    };
    /** Gets an array filled with the contents of the tree, sorted by key */
    BTree.prototype.toArray = function (maxLength) {
        if (maxLength === void 0) { maxLength = 0x7FFFFFFF; }
        var min = this.minKey(), max = this.maxKey();
        if (min !== undefined)
            return this.getRange(min, max, true, maxLength);
        return [];
    };
    /** Gets an array of all keys, sorted */
    BTree.prototype.keysArray = function () {
        var results = [];
        this._root.forRange(this.minKey(), this.maxKey(), true, false, this, 0, function (k, v) { results.push(k); });
        return results;
    };
    /** Gets an array of all values, sorted by key */
    BTree.prototype.valuesArray = function () {
        var results = [];
        this._root.forRange(this.minKey(), this.maxKey(), true, false, this, 0, function (k, v) { results.push(v); });
        return results;
    };
    /** Gets a string representing the tree's data based on toArray(). */
    BTree.prototype.toString = function () {
        return this.toArray().toString();
    };
    /** Stores a key-value pair only if the key doesn't already exist in the tree.
     * @returns true if a new key was added
    */
    BTree.prototype.setIfNotPresent = function (key, value) {
        return this.set(key, value, false);
    };
    /** Returns the next pair whose key is larger than the specified key (or undefined if there is none).
     * If key === undefined, this function returns the lowest pair.
     * @param key The key to search for.
     * @param reusedArray Optional array used repeatedly to store key-value pairs, to
     * avoid creating a new array on every iteration.
     */
    BTree.prototype.nextHigherPair = function (key, reusedArray) {
        reusedArray = reusedArray || [];
        if (key === undefined) {
            return this._root.minPair(reusedArray);
        }
        return this._root.getPairOrNextHigher(key, this._compare, false, reusedArray);
    };
    /** Returns the next key larger than the specified key, or undefined if there is none.
     *  Also, nextHigherKey(undefined) returns the lowest key.
     */
    BTree.prototype.nextHigherKey = function (key) {
        var p = this.nextHigherPair(key, ReusedArray);
        return p && p[0];
    };
    /** Returns the next pair whose key is smaller than the specified key (or undefined if there is none).
     *  If key === undefined, this function returns the highest pair.
     * @param key The key to search for.
     * @param reusedArray Optional array used repeatedly to store key-value pairs, to
     *        avoid creating a new array each time you call this method.
     */
    BTree.prototype.nextLowerPair = function (key, reusedArray) {
        reusedArray = reusedArray || [];
        if (key === undefined) {
            return this._root.maxPair(reusedArray);
        }
        return this._root.getPairOrNextLower(key, this._compare, false, reusedArray);
    };
    /** Returns the next key smaller than the specified key, or undefined if there is none.
     *  Also, nextLowerKey(undefined) returns the highest key.
     */
    BTree.prototype.nextLowerKey = function (key) {
        var p = this.nextLowerPair(key, ReusedArray);
        return p && p[0];
    };
    /** Returns the key-value pair associated with the supplied key if it exists
     *  or the pair associated with the next lower pair otherwise. If there is no
     *  next lower pair, undefined is returned.
     * @param key The key to search for.
     * @param reusedArray Optional array used repeatedly to store key-value pairs, to
     *        avoid creating a new array each time you call this method.
     * */
    BTree.prototype.getPairOrNextLower = function (key, reusedArray) {
        return this._root.getPairOrNextLower(key, this._compare, true, reusedArray || []);
    };
    /** Returns the key-value pair associated with the supplied key if it exists
     *  or the pair associated with the next lower pair otherwise. If there is no
     *  next lower pair, undefined is returned.
     * @param key The key to search for.
     * @param reusedArray Optional array used repeatedly to store key-value pairs, to
     *        avoid creating a new array each time you call this method.
     * */
    BTree.prototype.getPairOrNextHigher = function (key, reusedArray) {
        return this._root.getPairOrNextHigher(key, this._compare, true, reusedArray || []);
    };
    /** Edits the value associated with a key in the tree, if it already exists.
     * @returns true if the key existed, false if not.
    */
    BTree.prototype.changeIfPresent = function (key, value) {
        return this.editRange(key, key, true, function (k, v) { return ({ value: value }); }) !== 0;
    };
    /**
     * Builds an array of pairs from the specified range of keys, sorted by key.
     * Each returned pair is also an array: pair[0] is the key, pair[1] is the value.
     * @param low The first key in the array will be greater than or equal to `low`.
     * @param high This method returns when a key larger than this is reached.
     * @param includeHigh If the `high` key is present, its pair will be included
     *        in the output if and only if this parameter is true. Note: if the
     *        `low` key is present, it is always included in the output.
     * @param maxLength Length limit. getRange will stop scanning the tree when
     *                  the array reaches this size.
     * @description Computational complexity: O(result.length + log size)
     */
    BTree.prototype.getRange = function (low, high, includeHigh, maxLength) {
        if (maxLength === void 0) { maxLength = 0x3FFFFFF; }
        var results = [];
        this._root.forRange(low, high, includeHigh, false, this, 0, function (k, v) {
            results.push([k, v]);
            return results.length > maxLength ? Break : undefined;
        });
        return results;
    };
    /** Adds all pairs from a list of key-value pairs.
     * @param pairs Pairs to add to this tree. If there are duplicate keys,
     *        later pairs currently overwrite earlier ones (e.g. [[0,1],[0,7]]
     *        associates 0 with 7.)
     * @param overwrite Whether to overwrite pairs that already exist (if false,
     *        pairs[i] is ignored when the key pairs[i][0] already exists.)
     * @returns The number of pairs added to the collection.
     * @description Computational complexity: O(pairs.length * log(size + pairs.length))
     */
    BTree.prototype.setPairs = function (pairs, overwrite) {
        var added = 0;
        for (var i = 0; i < pairs.length; i++)
            if (this.set(pairs[i][0], pairs[i][1], overwrite))
                added++;
        return added;
    };
    /**
     * Scans the specified range of keys, in ascending order by key.
     * Note: the callback `onFound` must not insert or remove items in the
     * collection. Doing so may cause incorrect data to be sent to the
     * callback afterward.
     * @param low The first key scanned will be greater than or equal to `low`.
     * @param high Scanning stops when a key larger than this is reached.
     * @param includeHigh If the `high` key is present, `onFound` is called for
     *        that final pair if and only if this parameter is true.
     * @param onFound A function that is called for each key-value pair. This
     *        function can return {break:R} to stop early with result R.
     * @param initialCounter Initial third argument of onFound. This value
     *        increases by one each time `onFound` is called. Default: 0
     * @returns The number of values found, or R if the callback returned
     *        `{break:R}` to stop early.
     * @description Computational complexity: O(number of items scanned + log size)
     */
    BTree.prototype.forRange = function (low, high, includeHigh, onFound, initialCounter) {
        var r = this._root.forRange(low, high, includeHigh, false, this, initialCounter || 0, onFound);
        return typeof r === "number" ? r : r.break;
    };
    /**
     * Scans and potentially modifies values for a subsequence of keys.
     * Note: the callback `onFound` should ideally be a pure function.
     *   Specfically, it must not insert items, call clone(), or change
     *   the collection except via return value; out-of-band editing may
     *   cause an exception or may cause incorrect data to be sent to
     *   the callback (duplicate or missed items). It must not cause a
     *   clone() of the collection, otherwise the clone could be modified
     *   by changes requested by the callback.
     * @param low The first key scanned will be greater than or equal to `low`.
     * @param high Scanning stops when a key larger than this is reached.
     * @param includeHigh If the `high` key is present, `onFound` is called for
     *        that final pair if and only if this parameter is true.
     * @param onFound A function that is called for each key-value pair. This
     *        function can return `{value:v}` to change the value associated
     *        with the current key, `{delete:true}` to delete the current pair,
     *        `{break:R}` to stop early with result R, or it can return nothing
     *        (undefined or {}) to cause no effect and continue iterating.
     *        `{break:R}` can be combined with one of the other two commands.
     *        The third argument `counter` is the number of items iterated
     *        previously; it equals 0 when `onFound` is called the first time.
     * @returns The number of values scanned, or R if the callback returned
     *        `{break:R}` to stop early.
     * @description
     *   Computational complexity: O(number of items scanned + log size)
     *   Note: if the tree has been cloned with clone(), any shared
     *   nodes are copied before `onFound` is called. This takes O(n) time
     *   where n is proportional to the amount of shared data scanned.
     */
    BTree.prototype.editRange = function (low, high, includeHigh, onFound, initialCounter) {
        var root = this._root;
        if (nodeIsShared(root))
            this._root = root = root.clone();
        try {
            var r = root.forRange(low, high, includeHigh, true, this, initialCounter || 0, onFound);
            return typeof r === "number" ? r : r.break;
        }
        finally {
            var isShared = void 0;
            while (root.keys.length <= 1 && !root.isLeaf) {
                isShared || (isShared = nodeIsShared(root));
                this._root = root = root.keys.length === 0 ? EmptyLeaf :
                    root.children[0];
            }
            // If any ancestor of the new root was shared, the new root must also be shared
            if (isShared) {
                markNodeShared(root);
            }
        }
    };
    /** Same as `editRange` except that the callback is called for all pairs. */
    BTree.prototype.editAll = function (onFound, initialCounter) {
        return this.editRange(this.minKey(), this.maxKey(), true, onFound, initialCounter);
    };
    /**
     * Removes a range of key-value pairs from the B+ tree.
     * @param low The first key scanned will be greater than or equal to `low`.
     * @param high Scanning stops when a key larger than this is reached.
     * @param includeHigh Specifies whether the `high` key, if present, is deleted.
     * @returns The number of key-value pairs that were deleted.
     * @description Computational complexity: O(log size + number of items deleted)
     */
    BTree.prototype.deleteRange = function (low, high, includeHigh) {
        return this.editRange(low, high, includeHigh, DeleteRange);
    };
    /** Deletes a series of keys from the collection. */
    BTree.prototype.deleteKeys = function (keys) {
        for (var i = 0, r = 0; i < keys.length; i++)
            if (this.delete(keys[i]))
                r++;
        return r;
    };
    Object.defineProperty(BTree.prototype, "height", {
        /** Gets the height of the tree: the number of internal nodes between the
         *  BTree object and its leaf nodes (zero if there are no internal nodes). */
        get: function () {
            var node = this._root;
            var height = -1;
            while (node) {
                height++;
                node = node.isLeaf ? undefined : node.children[0];
            }
            return height;
        },
        enumerable: false,
        configurable: true
    });
    /** Makes the object read-only to ensure it is not accidentally modified.
     *  Freezing does not have to be permanent; unfreeze() reverses the effect.
     *  This is accomplished by replacing mutator functions with a function
     *  that throws an Error. Compared to using a property (e.g. this.isFrozen)
     *  this implementation gives better performance in non-frozen BTrees.
     */
    BTree.prototype.freeze = function () {
        var t = this;
        // Note: all other mutators ultimately call set() or editRange() 
        //       so we don't need to override those others.
        t.clear = t.set = t.editRange = function () {
            throw new Error("Attempted to modify a frozen BTree");
        };
    };
    /** Ensures mutations are allowed, reversing the effect of freeze(). */
    BTree.prototype.unfreeze = function () {
        // @ts-ignore "The operand of a 'delete' operator must be optional."
        //            (wrong: delete does not affect the prototype.)
        delete this.clear;
        // @ts-ignore
        delete this.set;
        // @ts-ignore
        delete this.editRange;
    };
    Object.defineProperty(BTree.prototype, "isFrozen", {
        /** Returns true if the tree appears to be frozen. */
        get: function () {
            return this.hasOwnProperty('editRange');
        },
        enumerable: false,
        configurable: true
    });
    /** Scans the tree for signs of serious bugs (e.g. this.size doesn't match
     *  number of elements, internal nodes not caching max element properly...)
     *  Computational complexity: O(number of nodes), i.e. O(size). This method
    *  skips the most expensive test - whether all keys are sorted - but it
    *  does check that maxKey() of the children of internal nodes are sorted. */
    BTree.prototype.checkValid = function () {
        var size = this._root.checkValid(0, this, 0);
        var storedSize = nodeSize(this._root);
        check(size === storedSize, "size mismatch: counted ", size, "but stored", storedSize);
    };
    return BTree;
}());
exports.default = BTree;
/** A TypeScript helper function that simply returns its argument, typed as
 *  `ISortedSet<K>` if the BTree implements it, as it does if `V extends undefined`.
 *  If `V` cannot be `undefined`, it returns `unknown` instead. Or at least, that
 *  was the intention, but TypeScript is acting weird and may return `ISortedSet<K>`
 *  even if `V` can't be `undefined` (discussion: btree-typescript issue #14) */
function asSet(btree) {
    return btree;
}
exports.asSet = asSet;
if (Symbol && Symbol.iterator) // iterator is equivalent to entries()
    BTree.prototype[Symbol.iterator] = BTree.prototype.entries;
BTree.prototype.where = BTree.prototype.filter;
BTree.prototype.setRange = BTree.prototype.setPairs;
BTree.prototype.add = BTree.prototype.set; // for compatibility with ISetSink<K>
function iterator(next) {
    if (next === void 0) { next = (function () { return ({ done: true, value: undefined }); }); }
    var result = { next: next };
    if (Symbol && Symbol.iterator)
        result[Symbol.iterator] = function () { return this; };
    return result;
}
/** Leaf node / base class. **************************************************/
var BNode = /** @class */ (function () {
    function BNode(keys, values) {
        if (keys === void 0) { keys = []; }
        this.keys = keys;
        this.values = values || undefVals;
        this.sharedSizeTag = keys.length + 1;
    }
    Object.defineProperty(BNode.prototype, "isLeaf", {
        get: function () { return this.children === undefined; },
        enumerable: false,
        configurable: true
    });
    ///////////////////////////////////////////////////////////////////////////
    // Shared methods /////////////////////////////////////////////////////////
    BNode.prototype.maxKey = function () {
        return this.keys[this.keys.length - 1];
    };
    // If key not found, returns i^failXor where i is the insertion index.
    // Callers that don't care whether there was a match will set failXor=0.
    BNode.prototype.indexOf = function (key, failXor, cmp) {
        var keys = this.keys;
        var lo = 0, hi = keys.length, mid = hi >> 1;
        while (lo < hi) {
            var c = cmp(keys[mid], key);
            if (c < 0)
                lo = mid + 1;
            else if (c > 0) // key < keys[mid]
                hi = mid;
            else if (c === 0)
                return mid;
            else {
                // c is NaN or otherwise invalid
                if (key === key) // at least the search key is not NaN
                    return keys.length;
                else
                    throw new Error("BTree: NaN was used as a key");
            }
            mid = (lo + hi) >> 1;
        }
        return mid ^ failXor;
        // Unrolled version: benchmarks show same speed, not worth using
        /*var i = 1, c: number = 0, sum = 0;
        if (keys.length >= 4) {
          i = 3;
          if (keys.length >= 8) {
            i = 7;
            if (keys.length >= 16) {
              i = 15;
              if (keys.length >= 32) {
                i = 31;
                if (keys.length >= 64) {
                  i = 127;
                  i += (c = i < keys.length ? cmp(keys[i], key) : 1) < 0 ? 64 : -64;
                  sum += c;
                  i += (c = i < keys.length ? cmp(keys[i], key) : 1) < 0 ? 32 : -32;
                  sum += c;
                }
                i += (c = i < keys.length ? cmp(keys[i], key) : 1) < 0 ? 16 : -16;
                sum += c;
              }
              i += (c = i < keys.length ? cmp(keys[i], key) : 1) < 0 ? 8 : -8;
              sum += c;
            }
            i += (c = i < keys.length ? cmp(keys[i], key) : 1) < 0 ? 4 : -4;
            sum += c;
          }
          i += (c = i < keys.length ? cmp(keys[i], key) : 1) < 0 ? 2 : -2;
          sum += c;
        }
        i += (c = i < keys.length ? cmp(keys[i], key) : 1) < 0 ? 1 : -1;
        c = i < keys.length ? cmp(keys[i], key) : 1;
        sum += c;
        if (c < 0) {
          ++i;
          c = i < keys.length ? cmp(keys[i], key) : 1;
          sum += c;
        }
        if (sum !== sum) {
          if (key === key) // at least the search key is not NaN
            return keys.length ^ failXor;
          else
            throw new Error("BTree: NaN was used as a key");
        }
        return c === 0 ? i : i ^ failXor;*/
    };
    /////////////////////////////////////////////////////////////////////////////
    // Leaf Node: misc //////////////////////////////////////////////////////////
    BNode.prototype.minKey = function () {
        return this.keys[0];
    };
    BNode.prototype.minPair = function (reusedArray) {
        if (this.keys.length === 0)
            return undefined;
        reusedArray[0] = this.keys[0];
        reusedArray[1] = this.values[0];
        return reusedArray;
    };
    BNode.prototype.maxPair = function (reusedArray) {
        if (this.keys.length === 0)
            return undefined;
        var lastIndex = this.keys.length - 1;
        reusedArray[0] = this.keys[lastIndex];
        reusedArray[1] = this.values[lastIndex];
        return reusedArray;
    };
    BNode.prototype.clone = function () {
        var v = this.values;
        return new BNode(this.keys.slice(0), v === undefVals ? v : v.slice(0));
    };
    BNode.prototype.greedyClone = function (force) {
        return nodeIsShared(this) && !force ? this : this.clone();
    };
    BNode.prototype.get = function (key, defaultValue, tree) {
        var i = this.indexOf(key, -1, tree._compare);
        return i < 0 ? defaultValue : this.values[i];
    };
    BNode.prototype.getPairOrNextLower = function (key, compare, inclusive, reusedArray) {
        var i = this.indexOf(key, -1, compare);
        var indexOrLower = i < 0 ? ~i - 1 : (inclusive ? i : i - 1);
        if (indexOrLower >= 0) {
            reusedArray[0] = this.keys[indexOrLower];
            reusedArray[1] = this.values[indexOrLower];
            return reusedArray;
        }
        return undefined;
    };
    BNode.prototype.getPairOrNextHigher = function (key, compare, inclusive, reusedArray) {
        var i = this.indexOf(key, -1, compare);
        var indexOrLower = i < 0 ? ~i : (inclusive ? i : i + 1);
        var keys = this.keys;
        if (indexOrLower < keys.length) {
            reusedArray[0] = keys[indexOrLower];
            reusedArray[1] = this.values[indexOrLower];
            return reusedArray;
        }
        return undefined;
    };
    BNode.prototype.checkValid = function (depth, tree, baseIndex) {
        var kL = this.keys.length, vL = this.values.length;
        check(this.values === undefVals ? kL <= vL : kL === vL, "keys/values length mismatch: depth", depth, "with lengths", kL, vL, "and baseIndex", baseIndex);
        // Note: we don't check for "node too small" because sometimes a node
        // can legitimately have size 1. This occurs if there is a batch 
        // deletion, leaving a node of size 1, and the siblings are full so
        // it can't be merged with adjacent nodes. However, the parent will
        // verify that the average node size is at least half of the maximum.
        check(depth == 0 || kL > 0, "empty leaf at depth", depth, "and baseIndex", baseIndex);
        check(nodeSize(this) === kL, "leaf size mismatch: depth", depth, "stored", nodeSize(this), "expected", kL, "baseIndex", baseIndex);
        return kL;
    };
    /////////////////////////////////////////////////////////////////////////////
    // Leaf Node: set & node splitting //////////////////////////////////////////
    BNode.prototype.set = function (key, value, overwrite, tree) {
        var i = this.indexOf(key, -1, tree._compare);
        if (i < 0) {
            // key does not exist yet
            i = ~i;
            if (this.keys.length < tree._maxNodeSize) {
                return this.insertInLeaf(i, key, value, tree);
            }
            else {
                // This leaf node is full and must split
                var newRightSibling = this.splitOffRightSide(), target = this;
                if (i > this.keys.length) {
                    i -= this.keys.length;
                    target = newRightSibling;
                }
                target.insertInLeaf(i, key, value, tree);
                return newRightSibling;
            }
        }
        else {
            // Key already exists
            if (overwrite !== false) {
                if (value !== undefined)
                    this.reifyValues();
                // usually this is a no-op, but some users may wish to edit the key
                this.keys[i] = key;
                this.values[i] = value;
            }
            return false;
        }
    };
    BNode.prototype.reifyValues = function () {
        if (this.values === undefVals)
            return this.values = this.values.slice(0, this.keys.length);
        return this.values;
    };
    BNode.prototype.insertInLeaf = function (i, key, value, tree) {
        this.keys.splice(i, 0, key);
        if (this.values === undefVals) {
            while (undefVals.length < tree._maxNodeSize)
                undefVals.push(undefined);
            if (value === undefined) {
                setNodeSize(this, this.keys.length);
                return true;
            }
            else {
                this.values = undefVals.slice(0, this.keys.length - 1);
            }
        }
        this.values.splice(i, 0, value);
        setNodeSize(this, this.keys.length);
        return true;
    };
    BNode.prototype.takeFromRight = function (rhs) {
        // Reminder: parent node must update its copy of key for this node
        // assert: neither node is shared
        // assert rhs.keys.length > (maxNodeSize/2 && this.keys.length<maxNodeSize)
        var v = this.values;
        if (rhs.values === undefVals) {
            if (v !== undefVals)
                v.push(undefined);
        }
        else {
            v = this.reifyValues();
            v.push(rhs.values.shift());
        }
        this.keys.push(rhs.keys.shift());
        setNodeSize(this, this.keys.length);
        setNodeSize(rhs, rhs.keys.length);
    };
    BNode.prototype.takeFromLeft = function (lhs) {
        // Reminder: parent node must update its copy of key for this node
        // assert: neither node is shared
        // assert rhs.keys.length > (maxNodeSize/2 && this.keys.length<maxNodeSize)
        var v = this.values;
        if (lhs.values === undefVals) {
            if (v !== undefVals)
                v.unshift(undefined);
        }
        else {
            v = this.reifyValues();
            v.unshift(lhs.values.pop());
        }
        this.keys.unshift(lhs.keys.pop());
        setNodeSize(this, this.keys.length);
        setNodeSize(lhs, lhs.keys.length);
    };
    BNode.prototype.splitOffRightSide = function () {
        // Reminder: parent node must update its copy of key for this node
        var half = this.keys.length >> 1, keys = this.keys.splice(half);
        var values = this.values === undefVals ? undefVals : this.values.splice(half);
        var newNode = new BNode(keys, values);
        setNodeSize(this, this.keys.length);
        return newNode;
    };
    /////////////////////////////////////////////////////////////////////////////
    // Leaf Node: scanning & deletions //////////////////////////////////////////
    BNode.prototype.forRange = function (low, high, includeHigh, editMode, tree, count, onFound) {
        var cmp = tree._compare;
        var iLow, iHigh;
        if (high === low) {
            if (!includeHigh)
                return count;
            iHigh = (iLow = this.indexOf(low, -1, cmp)) + 1;
            if (iLow < 0)
                return count;
        }
        else {
            iLow = this.indexOf(low, 0, cmp);
            iHigh = this.indexOf(high, -1, cmp);
            if (iHigh < 0)
                iHigh = ~iHigh;
            else if (includeHigh === true)
                iHigh++;
        }
        var keys = this.keys, values = this.values, deleted = 0;
        if (onFound !== undefined) {
            for (var i = iLow; i < iHigh; i++) {
                var key = keys[i];
                var result = onFound(key, values[i], count++);
                if (result !== undefined) {
                    if (editMode === true) {
                        if (key !== keys[i] || nodeIsShared(this))
                            throw new Error("BTree illegally changed or cloned in editRange");
                        if (result.delete) {
                            this.keys.splice(i, 1);
                            if (this.values !== undefVals)
                                this.values.splice(i, 1);
                            i--;
                            iHigh--;
                            deleted++;
                        }
                        else if (result.hasOwnProperty('value')) {
                            values[i] = result.value;
                        }
                    }
                    if (result.break !== undefined)
                        return result;
                }
            }
        }
        else
            count += iHigh - iLow;
        if (deleted !== 0)
            setNodeSize(this, this.keys.length);
        return count;
    };
    /** Adds entire contents of right-hand sibling (rhs is left unchanged) */
    BNode.prototype.mergeSibling = function (rhs, _) {
        this.keys.push.apply(this.keys, rhs.keys);
        if (this.values === undefVals) {
            if (rhs.values === undefVals) {
                setNodeSize(this, this.keys.length);
                return;
            }
            this.values = this.values.slice(0, this.keys.length);
        }
        this.values.push.apply(this.values, rhs.reifyValues());
        setNodeSize(this, this.keys.length);
    };
    return BNode;
}());
/** Internal node (non-leaf node) ********************************************/
var BNodeInternal = /** @class */ (function (_super) {
    __extends(BNodeInternal, _super);
    /**
     * This does not mark `children` as shared, so it is the responsibility of the caller
     * to ensure children are either marked shared, or aren't included in another tree.
     */
    function BNodeInternal(children, keys) {
        var _this = this;
        if (!keys) {
            keys = [];
            for (var i = 0; i < children.length; i++)
                keys[i] = children[i].maxKey();
        }
        _this = _super.call(this, keys) || this;
        _this.children = children;
        var total = 0;
        for (var i_1 = 0; i_1 < children.length; i_1++)
            total += nodeSize(children[i_1]);
        setNodeSize(_this, total);
        return _this;
    }
    BNodeInternal.prototype.clone = function () {
        var children = this.children.slice(0);
        for (var i = 0; i < children.length; i++)
            markNodeShared(children[i]);
        return new BNodeInternal(children, this.keys.slice(0));
    };
    BNodeInternal.prototype.greedyClone = function (force) {
        if (nodeIsShared(this) && !force)
            return this;
        var nu = new BNodeInternal(this.children.slice(0), this.keys.slice(0));
        for (var i = 0; i < nu.children.length; i++)
            nu.children[i] = nu.children[i].greedyClone(force);
        return nu;
    };
    BNodeInternal.prototype.minKey = function () {
        return this.children[0].minKey();
    };
    BNodeInternal.prototype.minPair = function (reusedArray) {
        return this.children[0].minPair(reusedArray);
    };
    BNodeInternal.prototype.maxPair = function (reusedArray) {
        return this.children[this.children.length - 1].maxPair(reusedArray);
    };
    BNodeInternal.prototype.get = function (key, defaultValue, tree) {
        var i = this.indexOf(key, 0, tree._compare), children = this.children;
        return i < children.length ? children[i].get(key, defaultValue, tree) : undefined;
    };
    BNodeInternal.prototype.getPairOrNextLower = function (key, compare, inclusive, reusedArray) {
        var i = this.indexOf(key, 0, compare), children = this.children;
        if (i >= children.length)
            return this.maxPair(reusedArray);
        var result = children[i].getPairOrNextLower(key, compare, inclusive, reusedArray);
        if (result === undefined && i > 0) {
            return children[i - 1].maxPair(reusedArray);
        }
        return result;
    };
    BNodeInternal.prototype.getPairOrNextHigher = function (key, compare, inclusive, reusedArray) {
        var i = this.indexOf(key, 0, compare), children = this.children, length = children.length;
        if (i >= length)
            return undefined;
        var result = children[i].getPairOrNextHigher(key, compare, inclusive, reusedArray);
        if (result === undefined && i < length - 1) {
            return children[i + 1].minPair(reusedArray);
        }
        return result;
    };
    BNodeInternal.prototype.checkValid = function (depth, tree, baseIndex) {
        var kL = this.keys.length, cL = this.children.length;
        check(kL === cL, "keys/children length mismatch: depth", depth, "lengths", kL, cL, "baseIndex", baseIndex);
        check(kL > 1 || depth > 0, "internal node has length", kL, "at depth", depth, "baseIndex", baseIndex);
        var size = 0, c = this.children, k = this.keys, childSize = 0;
        for (var i = 0; i < cL; i++) {
            var child = c[i];
            var counted = child.checkValid(depth + 1, tree, baseIndex + size);
            var storedChildSize = nodeSize(child);
            check(storedChildSize === counted, "child size mismatch at depth", depth, "index", i, "stored", storedChildSize, "expected", counted, "baseIndex", baseIndex);
            size += counted;
            childSize += child.keys.length;
            check(size >= childSize, "wtf", baseIndex); // no way this will ever fail
            check(i === 0 || c[i - 1].constructor === child.constructor, "type mismatch, baseIndex:", baseIndex);
            if (child.maxKey() != k[i])
                check(false, "keys[", i, "] =", k[i], "is wrong, should be ", child.maxKey(), "at depth", depth, "baseIndex", baseIndex);
            if (!(i === 0 || tree._compare(k[i - 1], k[i]) < 0))
                check(false, "sort violation at depth", depth, "index", i, "keys", k[i - 1], k[i]);
        }
        // 2020/08: BTree doesn't always avoid grossly undersized nodes,
        // but AFAIK such nodes are pretty harmless, so accept them.
        var toofew = childSize === 0; // childSize < (tree.maxNodeSize >> 1)*cL;
        if (toofew || childSize > tree.maxNodeSize * cL)
            check(false, toofew ? "too few" : "too many", "children (", childSize, size, ") at depth", depth, "maxNodeSize:", tree.maxNodeSize, "children.length:", cL, "baseIndex:", baseIndex);
        check(nodeSize(this) === size, "internal size mismatch at depth", depth, "stored", nodeSize(this), "expected", size, "baseIndex", baseIndex);
        return size;
    };
    /////////////////////////////////////////////////////////////////////////////
    // Internal Node: set & node splitting //////////////////////////////////////
    BNodeInternal.prototype.set = function (key, value, overwrite, tree) {
        var c = this.children, max = tree._maxNodeSize, cmp = tree._compare;
        var i = Math.min(this.indexOf(key, 0, cmp), c.length - 1), child = c[i];
        if (nodeIsShared(child))
            c[i] = child = child.clone();
        if (child.keys.length >= max) {
            // child is full; inserting anything else will cause a split.
            // Shifting an item to the left or right sibling may avoid a split.
            // We can do a shift if the adjacent node is not full and if the
            // current key can still be placed in the same node after the shift.
            var other;
            if (i > 0 && (other = c[i - 1]).keys.length < max && cmp(child.keys[0], key) < 0) {
                if (nodeIsShared(other))
                    c[i - 1] = other = other.clone();
                other.takeFromRight(child);
                this.keys[i - 1] = other.maxKey();
            }
            else if ((other = c[i + 1]) !== undefined && other.keys.length < max && cmp(child.maxKey(), key) < 0) {
                if (nodeIsShared(other))
                    c[i + 1] = other = other.clone();
                other.takeFromLeft(child);
                this.keys[i] = c[i].maxKey();
            }
        }
        var oldChildSize = nodeSize(child);
        var result = child.set(key, value, overwrite, tree);
        var newChildSize = nodeSize(child);
        adjustNodeSize(this, newChildSize - oldChildSize);
        if (result === false)
            return false;
        this.keys[i] = child.maxKey();
        if (result === true)
            return true;
        // The child has split and `result` is a new right child... does it fit?
        if (this.keys.length < max) { // yes
            this.insert(i + 1, result);
            return true;
        }
        else { // no, we must split also
            var newRightSibling = this.splitOffRightSide(), target = this;
            if (cmp(result.maxKey(), this.maxKey()) > 0) {
                target = newRightSibling;
                i -= this.keys.length;
            }
            target.insert(i + 1, result);
            return newRightSibling;
        }
    };
    /**
     * Inserts `child` at index `i`.
     * This does not mark `child` as shared, so it is the responsibility of the caller
     * to ensure that either child is marked shared, or it is not included in another tree.
    */
    BNodeInternal.prototype.insert = function (i, child) {
        this.children.splice(i, 0, child);
        this.keys.splice(i, 0, child.maxKey());
        adjustNodeSize(this, nodeSize(child));
    };
    /**
     * Split this node.
     * Modifies this to remove the second half of the items, returning a separate node containing them.
     */
    BNodeInternal.prototype.splitOffRightSide = function () {
        // assert !this.isShared;
        var half = this.children.length >> 1;
        var removedChildren = this.children.splice(half);
        var removedKeys = this.keys.splice(half);
        var newNode = new BNodeInternal(removedChildren, removedKeys);
        adjustNodeSize(this, -nodeSize(newNode));
        return newNode;
    };
    BNodeInternal.prototype.takeFromRight = function (rhs) {
        // Reminder: parent node must update its copy of key for this node
        // assert: neither node is shared
        // assert rhs.keys.length > (maxNodeSize/2 && this.keys.length<maxNodeSize)
        var rhsInternal = rhs;
        var child = rhsInternal.children.shift();
        var movedSize = nodeSize(child);
        this.children.push(child);
        this.keys.push(rhs.keys.shift());
        adjustNodeSize(this, movedSize);
        adjustNodeSize(rhs, -movedSize);
    };
    BNodeInternal.prototype.takeFromLeft = function (lhs) {
        // Reminder: parent node must update its copy of key for this node
        // assert: neither node is shared
        // assert rhs.keys.length > (maxNodeSize/2 && this.keys.length<maxNodeSize)
        var lhsInternal = lhs;
        var child = lhsInternal.children.pop();
        var movedSize = nodeSize(child);
        this.children.unshift(child);
        this.keys.unshift(lhs.keys.pop());
        adjustNodeSize(this, movedSize);
        adjustNodeSize(lhs, -movedSize);
    };
    /////////////////////////////////////////////////////////////////////////////
    // Internal Node: scanning & deletions //////////////////////////////////////
    // Note: `count` is the next value of the third argument to `onFound`. 
    //       A leaf node's `forRange` function returns a new value for this counter,
    //       unless the operation is to stop early.
    BNodeInternal.prototype.forRange = function (low, high, includeHigh, editMode, tree, count, onFound) {
        var cmp = tree._compare;
        var keys = this.keys, children = this.children;
        var iLow = this.indexOf(low, 0, cmp), i = iLow;
        var iHigh = Math.min(high === low ? iLow : this.indexOf(high, 0, cmp), keys.length - 1);
        if (!editMode) {
            // Simple case
            for (; i <= iHigh; i++) {
                var result = children[i].forRange(low, high, includeHigh, editMode, tree, count, onFound);
                if (typeof result !== 'number')
                    return result;
                count = result;
            }
        }
        else if (i <= iHigh) {
            try {
                for (; i <= iHigh; i++) {
                    var child = children[i];
                    if (nodeIsShared(child))
                        children[i] = child = child.clone();
                    var oldSize = nodeSize(child);
                    var result = child.forRange(low, high, includeHigh, editMode, tree, count, onFound);
                    // Note: if children[i] is empty then keys[i]=undefined.
                    //       This is an invalid state, but it is fixed below.
                    keys[i] = child.maxKey();
                    adjustNodeSize(this, nodeSize(child) - oldSize);
                    if (typeof result !== 'number')
                        return result;
                    count = result;
                }
            }
            finally {
                // Deletions may have occurred, so look for opportunities to merge nodes.
                var half = tree._maxNodeSize >> 1;
                if (iLow > 0)
                    iLow--;
                for (i = iHigh; i >= iLow; i--) {
                    if (children[i].keys.length <= half) {
                        if (children[i].keys.length !== 0) {
                            this.tryMerge(i, tree._maxNodeSize);
                        }
                        else { // child is empty! delete it!
                            keys.splice(i, 1);
                            children.splice(i, 1);
                        }
                    }
                }
                if (children.length !== 0 && children[0].keys.length === 0)
                    check(false, "emptiness bug");
            }
        }
        return count;
    };
    /** Merges child i with child i+1 if their combined size is not too large */
    BNodeInternal.prototype.tryMerge = function (i, maxSize) {
        var children = this.children;
        if (i >= 0 && i + 1 < children.length) {
            if (children[i].keys.length + children[i + 1].keys.length <= maxSize) {
                if (nodeIsShared(children[i])) // cloned already UNLESS i is outside scan range
                    children[i] = children[i].clone();
                children[i].mergeSibling(children[i + 1], maxSize);
                children.splice(i + 1, 1);
                this.keys.splice(i + 1, 1);
                this.keys[i] = children[i].maxKey();
                return true;
            }
        }
        return false;
    };
    /**
     * Move children from `rhs` into this.
     * `rhs` must be part of this tree, and be removed from it after this call
     * (otherwise isShared for its children could be incorrect).
     */
    BNodeInternal.prototype.mergeSibling = function (rhs, maxNodeSize) {
        // assert !this.isShared;
        var oldLength = this.keys.length;
        this.keys.push.apply(this.keys, rhs.keys);
        var rhsChildren = rhs.children;
        this.children.push.apply(this.children, rhsChildren);
        adjustNodeSize(this, nodeSize(rhs));
        if (nodeIsShared(rhs) && !nodeIsShared(this)) {
            // All children of a shared node are implicitly shared, and since their new
            // parent is not shared, they must now be explicitly marked as shared.
            for (var i = 0; i < rhsChildren.length; i++)
                markNodeShared(rhsChildren[i]);
        }
        // If our children are themselves almost empty due to a mass-delete,
        // they may need to be merged too (but only the oldLength-1 and its
        // right sibling should need this).
        this.tryMerge(oldLength - 1, maxNodeSize);
    };
    return BNodeInternal;
}(BNode));
function nodeIsShared(node) {
    return node.sharedSizeTag < 0;
}
function nodeSize(node) {
    return Math.abs(node.sharedSizeTag) - 1;
}
function setNodeSize(node, size) {
    var sign = Math.sign(node.sharedSizeTag) || 1;
    node.sharedSizeTag = (size + 1) * sign;
}
function adjustNodeSize(node, delta) {
    if (delta === 0)
        return;
    var tag = node.sharedSizeTag;
    var magnitude = Math.abs(tag) + delta;
    var sign = Math.sign(tag) || 1;
    node.sharedSizeTag = magnitude * sign;
}
function markNodeShared(node) {
    node.sharedSizeTag = -Math.abs(node.sharedSizeTag);
}
// Optimization: this array of `undefined`s is used instead of a normal
// array of values in nodes where `undefined` is the only value.
// Its length is extended to max node size on first use; since it can
// be shared between trees with different maximums, its length can only
// increase, never decrease. Its type should be undefined[] but strangely
// TypeScript won't allow the comparison V[] === undefined[]. To prevent
// users from making this array too large, BTree has a maximum node size.
//
// FAQ: undefVals[i] is already undefined, so why increase the array size?
// Reading outside the bounds of an array is relatively slow because it
// has the side effect of scanning the prototype chain.
var undefVals = [];
var Delete = { delete: true }, DeleteRange = function () { return Delete; };
var Break = { break: true };
var EmptyLeaf = (function () {
    var n = new BNode();
    markNodeShared(n);
    return n;
})();
var EmptyArray = [];
var ReusedArray = []; // assumed thread-local
function check(fact) {
    var args = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        args[_i - 1] = arguments[_i];
    }
    if (!fact) {
        args.unshift('B+ tree'); // at beginning of message
        throw new Error(args.join(' '));
    }
}
/** A BTree frozen in the empty state. */
exports.EmptyBTree = (function () { var t = new BTree(); t.freeze(); return t; })();
