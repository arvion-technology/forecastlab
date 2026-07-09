import test from "node:test";
import assert from "node:assert/strict";

import { bias, mae, mape, rmse, summarise } from "../src/metrics.js";

test("MAE, RMSE and bias use the forecast as the prediction", () => {
  const actual = [10, 20, 30];
  const predicted = [12, 18, 33];
  assert.equal(mae(actual, predicted), 7 / 3);
  assert.ok(Math.abs(rmse(actual, predicted) - Math.sqrt((4 + 4 + 9) / 3)) < 1e-12);
  assert.equal(bias(actual, predicted), 3 / 3);
});

test("identical forecasts score zero", () => {
  assert.equal(mae([1, 2, 3], [1, 2, 3]), 0);
  assert.equal(rmse([1, 2, 3], [1, 2, 3]), 0);
  assert.equal(bias([1, 2, 3], [1, 2, 3]), 0);
});

test("MAPE skips zero actuals and reports how many", () => {
  const result = mape([0, 100, 200], [10, 110, 180]);
  assert.equal(result.counted, 2);
  assert.equal(result.skipped, 1);
  assert.ok(Math.abs(result.value - 0.1) < 1e-12);
});

test("MAPE is null when every actual is zero", () => {
  assert.deepEqual(mape([0, 0], [1, 2]), { value: null, counted: 0, skipped: 2 });
});

test("empty input is safe", () => {
  assert.equal(mae([], []), 0);
  assert.equal(rmse([], []), 0);
  assert.equal(bias([], []), 0);
});

test("summarise produces the table row from folds", () => {
  const folds = [
    { actual: 10, predicted: 12 },
    { actual: 20, predicted: 18 },
  ];
  const row = summarise(folds);
  assert.equal(row.count, 2);
  assert.equal(row.mae, 2);
  assert.ok(Math.abs(row.mape - 0.15) < 1e-12);
  assert.equal(row.mapeSkipped, 0);
});
