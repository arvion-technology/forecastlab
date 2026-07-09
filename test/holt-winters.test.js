import test from "node:test";
import assert from "node:assert/strict";

import { fitHoltWinters, HOLT_WINTERS_DEFAULTS } from "../src/holt-winters.js";

// A clean additive seasonal series: level 10, trend 0.5 per step, seasonal
// pattern [0, 2, 4, 6] repeated. A decent Holt-Winters fit must recover it.
function cleanSeries(length = 64) {
  const seasonal = [0, 2, 4, 6];
  return Array.from({ length }, (_, index) => 10 + 0.5 * index + seasonal[index % 4]);
}

test("additive Holt-Winters recovers a clean seasonal trend", () => {
  const values = cleanSeries(64);
  const fit = fitHoltWinters(values, { seasonLength: 4, method: "additive", horizon: 4 });
  const expected = [0, 2, 4, 6].map((offset, index) => 10 + 0.5 * (64 + index) + offset);
  fit.forecast.forEach((value, index) => {
    assert.ok(Math.abs(value - expected[index]) < 1.5, `step ${index + 1}: ${value} vs ${expected[index]}`);
  });
});

test("additive fitted values are close to the observed series", () => {
  const values = cleanSeries(64);
  const fit = fitHoltWinters(values, { seasonLength: 4, method: "additive", horizon: 1 });
  const pairs = values
    .map((value, index) => [value, fit.fitted[index]])
    .filter(([, fitted]) => fitted !== null);
  const mae = pairs.reduce((sum, [actual, fitted]) => sum + Math.abs(actual - fitted), 0) / pairs.length;
  assert.ok(mae < 0.5, `in-sample MAE ${mae}`);
});

test("the first season has no fitted values", () => {
  const fit = fitHoltWinters(cleanSeries(24), { seasonLength: 4, method: "additive", horizon: 1 });
  assert.deepEqual(fit.fitted.slice(0, 4), [null, null, null, null]);
  assert.ok(fit.fitted[4] !== null);
});

test("multiplicative seasonality needs positive values", () => {
  const positive = Array.from({ length: 24 }, (_, index) => 100 * [1, 1.2, 1.4, 1.1][index % 4]);
  const fit = fitHoltWinters(positive, { seasonLength: 4, method: "multiplicative", horizon: 2 });
  assert.equal(fit.forecast.length, 2);
  assert.ok(fit.forecast.every((value) => value > 0));
  assert.throws(
    () => fitHoltWinters([1, 2, 0, 3, 1, 2, 3, 4, 5, 6], { seasonLength: 4, method: "multiplicative" }),
    /strictly positive/,
  );
});

test("multiplicative factors are ratios around one", () => {
  const values = Array.from({ length: 40 }, (_, index) => 50 + index + [0, 10, 20, 5][index % 4]);
  const fit = fitHoltWinters(values, { seasonLength: 4, method: "multiplicative", horizon: 1 });
  const average = fit.seasonal.reduce((sum, value) => sum + value, 0) / fit.seasonal.length;
  assert.ok(Math.abs(average - 1) < 0.15, `average factor ${average}`);
});

test("horizon controls the length of the forecast array", () => {
  const fit3 = fitHoltWinters(cleanSeries(24), { seasonLength: 4, horizon: 3 });
  const fit8 = fitHoltWinters(cleanSeries(24), { seasonLength: 4, horizon: 8 });
  assert.equal(fit3.forecast.length, 3);
  assert.equal(fit8.forecast.length, 8);
  assert.deepEqual(fit3.forecastAt(3), fit3.forecast);
});

test("smoothing parameters are validated and recorded", () => {
  assert.throws(() => fitHoltWinters(cleanSeries(24), { seasonLength: 4, alpha: 0 }), /alpha/);
  assert.throws(() => fitHoltWinters(cleanSeries(24), { seasonLength: 4, beta: 1.5 }), /beta/);
  const fit = fitHoltWinters(cleanSeries(24), { seasonLength: 4 });
  assert.deepEqual(fit.params, HOLT_WINTERS_DEFAULTS);
  assert.equal(fit.method, "additive");
});

test("too few observations for the season length is an explicit error", () => {
  assert.throws(() => fitHoltWinters([1, 2, 3], { seasonLength: 4 }), /at least 8 observations/);
});
