"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.randomInt = exports.makeArray = exports.addToBoth = exports.expectTreeEqualTo = exports.randInt = exports.logTreeNodeStats = exports.countTreeNodeStats = void 0;
var mersenne_twister_1 = __importDefault(require("mersenne-twister"));
var rand = new mersenne_twister_1.default(1234);
function countTreeNodeStats(tree) {
    var root = tree._root;
    if (tree.size === 0 || !root)
        return { total: 0, shared: 0, newUnderfilled: 0, averageLoadFactor: 0 };
    var maxNodeSize = tree.maxNodeSize;
    var minNodeSize = Math.floor(maxNodeSize / 2);
    var visit = function (node, ancestorShared, isRoot) {
        if (!node)
            return { total: 0, shared: 0, newUnderfilled: 0, loadFactorSum: 0 };
        var selfShared = node.isShared === true || ancestorShared;
        var children = node.children;
        var occupancy = children ? children.length : node.keys.length;
        var isUnderfilled = !isRoot && occupancy < minNodeSize;
        var loadFactor = occupancy / maxNodeSize;
        var shared = selfShared ? 1 : 0;
        var total = 1;
        var newUnderfilled = !selfShared && isUnderfilled ? 1 : 0;
        var loadFactorSum = loadFactor;
        if (children) {
            for (var _i = 0, children_1 = children; _i < children_1.length; _i++) {
                var child = children_1[_i];
                var stats = visit(child, selfShared, false);
                total += stats.total;
                shared += stats.shared;
                newUnderfilled += stats.newUnderfilled;
                loadFactorSum += stats.loadFactorSum;
            }
        }
        return { total: total, shared: shared, newUnderfilled: newUnderfilled, loadFactorSum: loadFactorSum };
    };
    var result = visit(root, false, true);
    var averageLoadFactor = result.total === 0 ? 0 : result.loadFactorSum / result.total;
    return {
        total: result.total,
        shared: result.shared,
        newUnderfilled: result.newUnderfilled,
        averageLoadFactor: averageLoadFactor
    };
}
exports.countTreeNodeStats = countTreeNodeStats;
function logTreeNodeStats(label, stats) {
    console.log("\tShared nodes (".concat(label, "): ").concat(stats.shared, "/").concat(stats.total));
    console.log("\tUnderfilled nodes (".concat(label, "): ").concat(stats.newUnderfilled, "/").concat(stats.total));
    var percent = (stats.averageLoadFactor * 100).toFixed(2);
    console.log("\tAverage load factor (".concat(label, "): ").concat(percent, "%"));
}
exports.logTreeNodeStats = logTreeNodeStats;
function randInt(max) {
    return rand.random_int() % max;
}
exports.randInt = randInt;
function expectTreeEqualTo(tree, list) {
    tree.checkValid();
    expect(tree.toArray()).toEqual(list.getArray());
}
exports.expectTreeEqualTo = expectTreeEqualTo;
function addToBoth(a, b, k, v) {
    expect(a.set(k, v)).toEqual(b.set(k, v));
}
exports.addToBoth = addToBoth;
function makeArray(size, randomOrder, spacing, collisionChance, rng) {
    if (spacing === void 0) { spacing = 10; }
    if (collisionChance === void 0) { collisionChance = 0; }
    var randomizer = rng !== null && rng !== void 0 ? rng : rand;
    var useGlobalRand = rng === undefined;
    var randomFloat = function () {
        if (typeof randomizer.random === 'function')
            return randomizer.random();
        return Math.random();
    };
    var randomIntWithMax = function (max) {
        if (max <= 0)
            return 0;
        if (useGlobalRand)
            return randInt(max);
        return Math.floor(randomFloat() * max);
    };
    var keys = [];
    var current = 0;
    for (var i = 0; i < size; i++) {
        if (i > 0 && collisionChance > 0 && randomFloat() < collisionChance) {
            keys[i] = keys[i - 1];
        }
        else {
            current += 1 + randomIntWithMax(spacing);
            keys[i] = current;
        }
    }
    if (randomOrder) {
        for (var i = 0; i < size; i++)
            swap(keys, i, randomIntWithMax(size));
    }
    return keys;
}
exports.makeArray = makeArray;
var randomInt = function (rng, maxExclusive) {
    return Math.floor(rng.random() * maxExclusive);
};
exports.randomInt = randomInt;
function swap(keys, i, j) {
    var tmp = keys[i];
    keys[i] = keys[j];
    keys[j] = tmp;
}
