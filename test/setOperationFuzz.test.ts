import BTreeEx from '../extended';
import MersenneTwister from 'mersenne-twister';
import { makeArray } from './shared';

const compare = (a: number, b: number) => a - b;

describe('Set operation fuzz tests', () => {
  const FUZZ_SETTINGS = {
    branchingFactors: [4, 5, 32],
    ooms: [2, 3],
    fractionsPerOOM: [0.1, 0.25, 0.5],
    removalChances: [0.01, 0.1],
    timeoutMs: 30_000
  } as const;

  FUZZ_SETTINGS.fractionsPerOOM.forEach(fraction => {
    if (fraction < 0 || fraction > 1)
      throw new Error('FUZZ_SETTINGS.fractionsPerOOM must contain values between 0 and 1');
  });
  FUZZ_SETTINGS.removalChances.forEach(chance => {
    if (chance < 0 || chance > 1)
      throw new Error('FUZZ_SETTINGS.removalChances must contain values between 0 and 1');
  });

  jest.setTimeout(FUZZ_SETTINGS.timeoutMs);

  const rng = new MersenneTwister(0xC0FFEE);

  const applyRemovalRuns = (tree: BTreeEx<number, number>, removalChance: number, branchingFactor: number) => {
    if (removalChance <= 0 || tree.size === 0)
      return;
    const entries = tree.toArray();
    let index = 0;
    while (index < entries.length) {
      const key = entries[index][0];
      if (rng.random() < removalChance) {
        tree.delete(key);
        index++;
        while (index < entries.length) {
          const candidateKey = entries[index][0];
          if (rng.random() < (1 / branchingFactor))
            break;
          tree.delete(candidateKey);
          index++;
        }
      } else {
        index++;
      }
    }
  };

  for (const maxNodeSize of FUZZ_SETTINGS.branchingFactors) {
    describe(`branching factor ${maxNodeSize}`, () => {
      for (const oom of FUZZ_SETTINGS.ooms) {
        const size = 5 * Math.pow(10, oom);
        for (const fractionA of FUZZ_SETTINGS.fractionsPerOOM) {
          const fractionB = 1 - fractionA;
          for (const removalChance of FUZZ_SETTINGS.removalChances) {
            const removalLabel = removalChance.toFixed(3);
            for (const removalChance of FUZZ_SETTINGS.removalChances) {
              const removalLabel = removalChance.toFixed(3);

            it(`size ${size}, fractionA ${fractionA.toFixed(2)}, fractionB ${fractionB.toFixed(2)}, removal ${removalLabel}`, () => {
              const treeA = new BTreeEx<number, number>([], compare, maxNodeSize);
                const treeB = new BTreeEx<number, number>([], compare, maxNodeSize);
                const treeC = new BTreeEx<number, number>([], compare, maxNodeSize);

                const keys = makeArray(size, true, 1, 0, rng);

                for (const value of keys) {
                  const assignToA = rng.random() < fractionA;
                  const assignToB = rng.random() < fractionB;
                  const assignToC = rng.random() < 0.5;

                  if (assignToA)
                    treeA.set(value, value);
                  if (assignToB)
                    treeB.set(value, value);
                  if (assignToC)
                    treeC.set(value, value);
                }

                applyRemovalRuns(treeA, removalChance, maxNodeSize);
                applyRemovalRuns(treeB, removalChance, maxNodeSize);

                const treeAInitial = treeA.toArray();
                const treeBInitial = treeB.toArray();
                const treeCInitial = treeC.toArray();

                const keepEither = (_k: number, left: number, _right: number) => left;
                const dropValue = () => undefined;
                const combineSum = (_k: number, left: number, right: number) => left + right;

                const unionDrop = treeA.union(treeB, dropValue);
                const unionKeep = treeA.union(treeB, keepEither);
                const intersection = treeA.intersect(treeB, keepEither);
                const diffAB = treeA.subtract(treeB);
                const diffBA = treeB.subtract(treeA);

                // 1. Partition of A: A = (A\B) ∪ (A∩B) and parts are disjoint.
                const partition = diffAB.union(intersection, keepEither);
                expect(partition.toArray()).toEqual(treeAInitial);
                expect(diffAB.intersect(intersection, keepEither).size).toBe(0);

                // 2. Recover B from union and A\B: (A∪B)\(A\B) = B.
                expect(unionKeep.subtract(diffAB).toArray()).toEqual(treeBInitial);

                // 3. Symmetric difference two ways.
                const symFromDiffs = diffAB.union(diffBA, keepEither);
                const symFromUnion = unionKeep.subtract(intersection);
                expect(symFromDiffs.toArray()).toEqual(symFromUnion.toArray());

                // 4. Intersection via difference: A∩B = A \ (A\B).
                expect(intersection.toArray()).toEqual(treeA.subtract(diffAB).toArray());

                // 5. Difference via intersection: A\B = A \ (A∩B).
                expect(diffAB.toArray()).toEqual(treeA.subtract(intersection).toArray());

                // 6. Idempotence.
                expect(treeA.union(treeA, keepEither).toArray()).toEqual(treeAInitial);
                expect(treeA.intersect(treeA, keepEither).toArray()).toEqual(treeAInitial);
                expect(diffAB.subtract(treeB).toArray()).toEqual(diffAB.toArray());

                // 7. Commutativity.
                expect(intersection.toArray()).toEqual(treeB.intersect(treeA, keepEither).toArray());
                const commUT = treeA.union(treeB, combineSum);
                const commTU = treeB.union(treeA, combineSum);
                expect(commUT.toArray()).toEqual(commTU.toArray());

                // 8. Associativity.
                const assocLeft = treeA.intersect(treeB, keepEither).intersect(treeC, keepEither);
                const assocRight = treeA.intersect(treeB.intersect(treeC, keepEither), keepEither);
                expect(assocLeft.toArray()).toEqual(assocRight.toArray());
                const assocSumLeft = treeA.union(treeB, combineSum).union(treeC, combineSum);
                const assocSumRight = treeA.union(treeB.union(treeC, combineSum), combineSum);
                expect(assocSumLeft.toArray()).toEqual(assocSumRight.toArray());

                // 9. Absorption.
                expect(treeA.intersect(treeA.union(treeB, keepEither), keepEither).toArray()).toEqual(treeAInitial);
                expect(treeA.union(treeA.intersect(treeB, keepEither), keepEither).toArray()).toEqual(treeAInitial);

                // 10. Distributivity.
                const distIntersect = treeA.intersect(treeB.union(treeC, keepEither), keepEither);
                const distRight = treeA.intersect(treeB, keepEither).union(treeA.intersect(treeC, keepEither), keepEither);
                expect(distIntersect.toArray()).toEqual(distRight.toArray());
                const distSubtract = treeA.subtract(treeB.union(treeC, keepEither));
                const distSubtractRight = treeA.subtract(treeB).subtract(treeC);
                expect(distSubtract.toArray()).toEqual(distSubtractRight.toArray());
                const distIntersectDiff = treeA.intersect(treeB, keepEither).subtract(treeC);
                const distDiffIntersect = treeA.subtract(treeC).intersect(treeB, keepEither);
                expect(distIntersectDiff.toArray()).toEqual(distDiffIntersect.toArray());

                // 11. Superset sanity.
                expect(treeA.subtract(treeA.union(treeB, keepEither)).size).toBe(0);
                expect(diffAB.intersect(treeB, keepEither).size).toBe(0);

                // 12. Cardinality relations.
                expect(unionKeep.size).toBe(treeA.size + treeB.size - intersection.size);
                expect(diffAB.size).toBe(treeA.size - intersection.size);
                expect(treeA.size).toBe(diffAB.size + intersection.size);

                partition.checkValid();
                unionDrop.checkValid();
                unionKeep.checkValid();
                intersection.checkValid();
                diffAB.checkValid();
                diffBA.checkValid();
                treeA.checkValid();
                treeB.checkValid();
                treeC.checkValid();

                expect(treeA.toArray()).toEqual(treeAInitial);
                expect(treeB.toArray()).toEqual(treeBInitial);
                expect(treeC.toArray()).toEqual(treeCInitial);
              });
            }
          }
        }
      }
    });
  }
});
