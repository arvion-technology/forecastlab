import test from "node:test";
import assert from "node:assert/strict";

import { compareModels, walkForward } from "../src/backtest.js";
import { MODELS } from "../src/models.js";

const points = (values) => values.map((value, index) => ({ date: `2026-01-${String(index + 1).padStart(2, "0")}`, value }));

test("walk-forward only scores points after the training window", () => {
  const values = Array.from({ length: 40 }, (_, index) => 100 + index);
  const result = walkForward(points(values), "naive", { horizon: 1, minTrain: 10 });
  assert.equal(result.folds.length, 30);
  for (const fold of result.folds) {
    assert.ok(fold.index >= 10, "first scored point is the first unseen one");
    assert.ok(fold.trainSize <= fold.index, "the training window ends before the prediction target");
  }
});

test("naive predicts the previous observation", () => {
  const values = [5, 7, 9, 11, 13, 15];
  const result = walkForward(points(values), "naive", { horizon: 1, minTrain: 2 });
  assert.equal(result.folds[0].predicted, 7);
  assert.equal(result.folds[0].actual, 9);
});

test("multi-step folds repeat the origin for each horizon step", () => {
  const values = Array.from({ length: 30 }, (_, index) => 50 + index);
  const result = walkForward(points(values), "seasonal-naive", { horizon: 3, seasonLength: 4, minTrain: 8 });
  const origins = new Set(result.folds.map((fold) => fold.origin));
  assert.equal(result.folds.length, origins.size * 3);
  assert.equal(result.perStep.length, 3);
  assert.equal(result.perStep[0].step, 1);
});

test("a model that throws is reported, not fatal, in compareModels", () => {
  const values = [10, 12, 11, 13, 0, 15, 16, 14, 17, 15, 18, 19, 20, 21, 22];
  const results = compareModels(points(values), ["hw-multiplicative", "naive"], { horizon: 1, seasonLength: 4, minTrain: 8 });
  const multiplicative = results.find((row) => row.modelId === "hw-multiplicative");
  assert.ok(multiplicative.error);
  assert.equal(multiplicative.metrics, null);
  assert.ok(results.find((row) => row.modelId === "naive").metrics.mae >= 0);
});

test("all registered models run on a well-formed series", () => {
  const values = Array.from({ length: 48 }, (_, index) => 100 + index + [0, 8, 16, 4][index % 4]);
  for (const model of MODELS) {
    const result = walkForward(points(values), model.id, { horizon: 2, seasonLength: 4, minTrain: 12 });
    assert.ok(result.folds.length > 0, model.id);
    for (const metric of ["mae", "rmse", "bias"]) {
      assert.ok(Number.isFinite(result.metrics[metric]), `${model.id} ${metric}`);
    }
  }
});

test("a short series fails with a readable message", () => {
  assert.throws(
    () => walkForward(points([1, 2, 3, 4, 5]), "naive", { horizon: 2, minTrain: 10 }),
    /series too short/,
  );
});

test("walk-forward metrics match a hand-computed average", () => {
  const values = [10, 12, 14, 16, 18];
  const result = walkForward(points(values), "naive", { horizon: 1, minTrain: 2 });
  // folds: origin 2 -> pred 12 actual 14 (2); origin 3 -> pred 14 actual 16 (2); origin 4 -> pred 16 actual 18 (2)
  assert.equal(result.folds.length, 3);
  assert.ok(Math.abs(result.metrics.mae - 2) < 1e-12);
  assert.ok(Math.abs(result.metrics.bias - -2) < 1e-12);
});
