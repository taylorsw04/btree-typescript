const BTree = require('./b+tree.js').default;

const compare = (a, b) => a - b;
const tree1 = new BTree([[1, 10], [2, 20], [3, 30], [4, 40]], compare);
const tree2 = new BTree([[2, 200], [3, 300], [4, 400], [5, 500]], compare);

const mergeFunc = (k, v1, v2) => {
  console.log(`merge called: k=${k}, v1=${v1}, v2=${v2}`);
  if (k === 3) {
    console.log('  -> returning undefined');
    return undefined;
  }
  console.log(`  -> returning ${v1 + v2}`);
  return v1 + v2;
};

const result = tree1.merge(tree2, mergeFunc);
console.log('\nResult:', result.toArray());
console.log('Size:', result.size);
