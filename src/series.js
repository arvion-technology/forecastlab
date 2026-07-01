// Series helpers used by the models, the backtest and the demo.
//
// Everything here is a pure function over an array of numbers. Keeping the maths
// separate from the chart makes it testable with plain assertions instead of
// screenshots.

export function mean(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Sample standard deviation (n-1). Returns 0 for fewer than two points. */
export function std(values) {
  if (values.length < 2) return 0;
  const average = mean(values);
  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export function diff(values) {
  const out = [];
  for (let i = 1; i < values.length; i++) out.push(values[i] - values[i - 1]);
  return out;
}

export function lastN(values, n) {
  return values.slice(Math.max(0, values.length - n));
}

export function rollingMean(values, window) {
  const out = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= window) sum -= values[i - window];
    out.push(i + 1 >= window ? sum / window : null);
  }
  return out;
}

/** Average seasonal index for each position in the cycle, with the mean removed
 *  (additive) so the indices sum to roughly zero. */
export function seasonalIndices(values, seasonLength) {
  if (seasonLength < 2) throw new Error("seasonLength must be at least 2");
  const buckets = Array.from({ length: seasonLength }, () => []);
  values.forEach((value, index) => buckets[index % seasonLength].push(value));
  const average = mean(values);
  return buckets.map((bucket) => mean(bucket) - average);
}

/** Split a series into train and test sets. */
export function splitTrainTest(series, testSize) {
  if (testSize <= 0 || testSize >= series.length) throw new Error("testSize must leave at least one training point");
  return { train: series.slice(0, series.length - testSize), test: series.slice(series.length - testSize) };
}

/** Simple ordinary least squares over y against its index. */
export function linearRegression(values) {
  const n = values.length;
  if (n < 2) return { slope: 0, intercept: values[0] ?? 0 };
  const xMean = (n - 1) / 2;
  const yMean = mean(values);
  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (i - xMean) * (values[i] - yMean);
    denominator += (i - xMean) ** 2;
  }
  const slope = denominator === 0 ? 0 : numerator / denominator;
  return { slope, intercept: yMean - slope * xMean };
}

export function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}
