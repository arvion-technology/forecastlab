// Residual anomaly detection.
//
// The model is fitted to the whole series, then each point is compared with what
// the model expected. Residuals are standardised against a rolling window of
// earlier residuals, so a series with genuinely noisy periods does not flag every
// point. Without that local baseline, a fixed threshold on raw residuals would
// mostly measure the variance of the series.

import { mean, std } from "./series.js";

export function detectAnomalies(series, fitted, options = {}) {
  const window = options.window ?? 12;
  const threshold = options.threshold ?? 3;
  if (threshold <= 0) throw new Error("threshold must be positive");

  const residuals = series.map((point, index) => {
    const value = typeof point === "number" ? point : point.value;
    const prediction = fitted[index];
    return prediction === null || prediction === undefined ? null : value - prediction;
  });

  const anomalies = [];
  for (let index = 0; index < residuals.length; index++) {
    const residual = residuals[index];
    if (residual === null) continue;
    const history = residuals.slice(Math.max(0, index - window), index).filter((value) => value !== null);
    if (history.length < 4) continue;
    const average = mean(history);
    const spread = std(history);
    // With a perfectly constant residual history there is no scale to divide by.
    // That is a deterministic series, so any deviation is anomalous by
    // definition; a threshold of "some standard deviations" would divide by
    // zero and silently miss it.
    const z = spread < 1e-9
      ? (Math.abs(residual - average) < 1e-9 ? 0 : Math.sign(residual - average) * threshold)
      : (residual - average) / spread;
    if (Math.abs(z) < threshold) continue;
    anomalies.push({
      index,
      date: series[index]?.date ?? String(index),
      value: typeof series[index] === "number" ? series[index] : series[index].value,
      fitted: fitted[index],
      residual,
      z,
      direction: z > 0 ? "above" : "below",
    });
  }
  return anomalies;
}

export function residualStats(series, fitted) {
  const residuals = [];
  series.forEach((point, index) => {
    const value = typeof point === "number" ? point : point.value;
    if (fitted[index] === null || fitted[index] === undefined) return;
    residuals.push(value - fitted[index]);
  });
  return {
    count: residuals.length,
    mean: mean(residuals),
    std: std(residuals),
    min: residuals.length ? Math.min(...residuals) : 0,
    max: residuals.length ? Math.max(...residuals) : 0,
  };
}

/** Write a normal-approximation forecast band. The width grows with the square
 *  root of the step ahead, the way an error term accumulates; the residual
 *  standard deviation comes from the fitted model, not from a hard-coded 5%. */
export function forecastBand(forecast, residualStd, z = 1.96) {
  return forecast.map((value, index) => {
    const width = z * residualStd * Math.sqrt(index + 1);
    return { value, low: value - width, high: value + width };
  });
}
