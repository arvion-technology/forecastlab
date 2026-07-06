import test from "node:test";
import assert from "node:assert/strict";

import { detectAnomalies, forecastBand, residualStats } from "../src/anomalies.js";

const series = (values) => values.map((value, index) => ({ date: `2026-02-${String(index + 1).padStart(2, "0")}`, value }));

test("a single spike is detected against a flat model", () => {
  const values = Array.from({ length: 30 }, () => 100);
  values[20] = 160;
  const fitted = new Array(30).fill(100);
  const anomalies = detectAnomalies(series(values), fitted, { window: 10, threshold: 3 });
  assert.equal(anomalies.length, 1);
  assert.equal(anomalies[0].index, 20);
  assert.equal(anomalies[0].direction, "above");
  assert.ok(Math.abs(anomalies[0].z) >= 3);
});

test("a drop below the model is flagged as a negative anomaly", () => {
  const values = Array.from({ length: 30 }, () => 100);
  values[24] = 40;
  const anomalies = detectAnomalies(series(values), new Array(30).fill(100), { window: 10, threshold: 3 });
  assert.equal(anomalies.length, 1);
  assert.equal(anomalies[0].direction, "below");
});

test("a clean series with noise-free residuals is not flagged", () => {
  const values = Array.from({ length: 30 }, (_, index) => 100 + index);
  const fitted = values.map((value, index) => (index === 0 ? null : value));
  assert.deepEqual(detectAnomalies(series(values), fitted, { threshold: 3 }), []);
});

test("fitted nulls are skipped rather than treated as zero", () => {
  const values = Array.from({ length: 10 }, () => 10);
  const fitted = new Array(10).fill(null);
  assert.deepEqual(detectAnomalies(series(values), fitted, { threshold: 3 }), []);
});

test("the window needs enough residual history before flagging", () => {
  const values = [100, 100, 500, 100, 100];
  const anomalies = detectAnomalies(series(values), new Array(5).fill(100), { window: 2, threshold: 2 });
  assert.ok(anomalies.every((anomaly) => anomaly.index > 2), "early points have no baseline");
});

test("threshold must be positive", () => {
  assert.throws(() => detectAnomalies(series([1, 2, 3]), [null, 1, 2], { threshold: 0 }), /positive/);
});

test("residualStats reports spread and range", () => {
  const values = [11, 22, 33];
  const fitted = [10, 20, 30];
  const stats = residualStats(series(values), fitted);
  assert.equal(stats.count, 3);
  assert.equal(stats.mean, 2);
  assert.equal(stats.min, 1);
  assert.equal(stats.max, 3);
  assert.ok(stats.std > 0);
});

test("forecast band widens with the step ahead", () => {
  const band = forecastBand([100, 100, 100], 5, 1.96);
  assert.equal(band.length, 3);
  assert.ok(band[0].high - band[0].low < band[1].high - band[1].low);
  assert.ok(band[1].high - band[1].low < band[2].high - band[2].low);
  assert.equal(band[0].value, 100);
  assert.ok(Math.abs(band[0].high - (100 + 1.96 * 5)) < 1e-9);
});

test("a zero residual spread gives a zero-width band", () => {
  const band = forecastBand([10, 20], 0);
  assert.deepEqual(band, [{ value: 10, low: 10, high: 10 }, { value: 20, low: 20, high: 20 }]);
});
