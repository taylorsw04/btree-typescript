"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/** A super-inefficient sorted list for testing purposes */
var SortedArray = /** @class */ (function () {
    function SortedArray(entries, compare) {
        this.cmp = compare || (function (a, b) { return a < b ? -1 : a > b ? 1 : a === b ? 0 : a - b; });
        this.a = [];
        if (entries !== undefined)
            for (var _i = 0, entries_1 = entries; _i < entries_1.length; _i++) {
                var e = entries_1[_i];
                this.set(e[0], e[1]);
            }
    }
    Object.defineProperty(SortedArray.prototype, "size", {
        get: function () { return this.a.length; },
        enumerable: false,
        configurable: true
    });
    SortedArray.prototype.get = function (key, defaultValue) {
        var pair = this.a[this.indexOf(key, -1)];
        return pair === undefined ? defaultValue : pair[1];
    };
    SortedArray.prototype.set = function (key, value, overwrite) {
        var i = this.indexOf(key, -1);
        if (i <= -1)
            this.a.splice(~i, 0, [key, value]);
        else
            this.a[i] = [key, value];
        return i <= -1;
    };
    SortedArray.prototype.has = function (key) {
        return this.indexOf(key, -1) >= 0;
    };
    SortedArray.prototype.delete = function (key) {
        var i = this.indexOf(key, -1);
        if (i > -1)
            this.a.splice(i, 1);
        return i > -1;
    };
    SortedArray.prototype.clear = function () { this.a = []; };
    SortedArray.prototype.getArray = function () { return this.a; };
    SortedArray.prototype.minKey = function () { return this.a[0][0]; };
    SortedArray.prototype.maxKey = function () { return this.a[this.a.length - 1][0]; };
    SortedArray.prototype.forEach = function (callbackFn) {
        var _this = this;
        this.a.forEach(function (pair) { return callbackFn(pair[1], pair[0], _this); });
    };
    // a.values() used to implement IMap<K,V> but it's not actually available in Node v10.4
    SortedArray.prototype[Symbol.iterator] = function () { return this.a.values(); };
    SortedArray.prototype.entries = function () { return this.a.values(); };
    SortedArray.prototype.keys = function () { return this.a.map(function (pair) { return pair[0]; }).values(); };
    SortedArray.prototype.values = function () { return this.a.map(function (pair) { return pair[1]; }).values(); };
    SortedArray.prototype.indexOf = function (key, failXor) {
        var lo = 0, hi = this.a.length, mid = hi >> 1;
        while (lo < hi) {
            var c = this.cmp(this.a[mid][0], key);
            if (c < 0)
                lo = mid + 1;
            else if (c > 0) // keys[mid] > key
                hi = mid;
            else if (c === 0)
                return mid;
            else
                throw new Error("Problem: compare failed");
            mid = (lo + hi) >> 1;
        }
        return mid ^ failXor;
    };
    return SortedArray;
}());
exports.default = SortedArray;
