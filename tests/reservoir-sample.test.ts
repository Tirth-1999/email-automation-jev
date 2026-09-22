import assert from "node:assert/strict";
import test from "node:test";
import {
  addToReservoir,
  createSeededRandom,
  shuffleInPlace,
} from "../lib/reservoir-sample.js";

function sample(seed: string): number[] {
  const random = createSeededRandom(seed);
  const reservoir: number[] = [];
  for (let value = 1; value <= 1_000; value += 1) {
    addToReservoir(reservoir, value, value, 100, random);
  }
  shuffleInPlace(reservoir, random);
  return reservoir;
}

test("seeded reservoir sampling is reproducible and unique", () => {
  const first = sample("phase-2");
  const second = sample("phase-2");
  assert.deepEqual(first, second);
  assert.equal(first.length, 100);
  assert.equal(new Set(first).size, 100);
});
test("different seeds produce different samples", () => {
  assert.notDeepEqual(sample("first"), sample("second"));
});
