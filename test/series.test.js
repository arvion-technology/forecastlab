import test from "node:test";
import assert from "node:assert/strict";

import {
  diff,
  lastN,
  linearRegression,
  mean,
  rollingMean,
  seasonalIndices,
  splitTrainTest,
  std,
} from "../src/series.js";

test("mean and sample standard deviation", () => {
  assert.equal(mean([2, 4, 6]), 4);
  assert.equal(mean([]), 0);
  assert.ok(Math.abs(std([2, 4, 4, 4, 5, 5, 7, 9]) - 2.13809) < 1e-4);
  assert.equal(std([5]), 0);
});

test("diff returns first differences", () => {
  assert.deepEqual(diff([1, 4, 9]), [3, 5]);
  assert.deepEqual(diff([7]), []);
});

test("lastN keeps the tail", () => {
  assert.deepEqual(lastN([1, 2, 3, 4, 5], 2), [4, 5]);
  assert.deepEqual(lastN([1, 2], 5), [1, 2]);
});

test("rollingMean is null until the window is full", () => {
  assert.deepEqual(rollingMean([1, 2, 3, 4], 2), [null, 1.5, 2.5, 3.5]);
});

test("seasonalIndices average to zero for additive seasonality", () => {
  const values = Array.from({ length: 24 }, (_, index) => [0, 2, 4, 6][index % 4]);
  const indices = seasonalIndices(values, 4);
  assert.deepEqual(indices, [-3, -1, 1, 3]);
  assert.ok(Math.abs(indices.reduce((sum, value) => sum + value, 0)) < 1e-12);
});

test("seasonalIndices rejects a cycle of one", () => {
  assert.throws(() => seasonalIndices([1, 2, 3], 1), /at least 2/);
});

test("linearRegression recovers an exact line", () => {
  const { slope, intercept } = linearRegression([3, 5, 7, 9]);
  assert.equal(slope, 2);
  assert.equal(intercept, 3);
});

test("splitTrainTest keeps order and rejects impossible sizes", () => {
  const { train, test } = splitTrainTest([1, 2, 3, 4, 5], 2);
  assert.deepEqual(train, [1, 2, 3]);
  assert.deepEqual(test, [4, 5]);
  assert.throws(() => splitTrainTest([1, 2], 2), /at least one training point/);
});
