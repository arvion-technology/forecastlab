import test from "node:test";
import assert from "node:assert/strict";

import { DATASETS, datasetById, valuesOf } from "../src/datasets.js";
import { fitHoltWinters } from "../src/holt-winters.js";
import { residualStats } from "../src/anomalies.js";
import { mean, std } from "../src/series.js";

test("the demo ships three datasets with distinct season lengths", () => {
  assert.deepEqual(DATASETS.map((dataset) => dataset.id), ["web-traffic", "retail-monthly", "energy-hourly"]);
  assert.deepEqual(DATASETS.map((dataset) => dataset.seasonLength), [7, 12, 24]);
});

test("datasets are deterministic", () => {
  const first = valuesOf(datasetById("web-traffic"));
  const second = valuesOf(datasetById("web-traffic"));
  assert.deepEqual(first, second);
  assert.equal(first[0], 1373.1);
  assert.equal(first.at(-1), 1459.9);
});

test("every dataset is long enough for a seasonal model", () => {
  for (const dataset of DATASETS) {
    assert.ok(dataset.points.length >= dataset.seasonLength * 3, dataset.id);
    assert.ok(dataset.points.every((point) => typeof point.date === "string"));
    assert.ok(dataset.points.every((point) => Number.isFinite(point.value)), dataset.id);
    assert.ok(dataset.unit.length > 0);
  }
});

test("retail is strongly seasonal and trending", () => {
  const values = valuesOf(datasetById("retail-monthly"));
  assert.ok(mean(values) > 150);
  assert.ok(values.at(-1) > values[0], "trend should be upward");
  assert.ok(std(values) > 30, "seasonality should create spread");
});

test("Holt-Winters fits each dataset without exploding", () => {
  for (const dataset of DATASETS) {
    const values = valuesOf(dataset);
    const fit = fitHoltWinters(values, { seasonLength: dataset.seasonLength, horizon: 4 });
    assert.equal(fit.forecast.length, 4);
    assert.ok(fit.forecast.every((value) => Number.isFinite(value)), dataset.id);
    const stats = residualStats(dataset.points, fit.fitted);
    assert.ok(stats.std > 0, dataset.id);
    assert.ok(Math.abs(stats.mean) < stats.std, dataset.id);
  }
});

test("an unknown dataset id returns null", () => {
  assert.equal(datasetById("nope"), null);
});
