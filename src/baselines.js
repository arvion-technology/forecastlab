// Baseline forecasts. A forecasting project without baselines is a demo of a
// model, not a measurement of one: if Holt-Winters cannot beat "same as last
// week" on the series, that is the finding.

import { linearRegression, mean } from "./series.js";

const fittedNaive = (values) => values.map((value, index) => (index === 0 ? null : values[index - 1]));

export function naive(values, { horizon = 1 } = {}) {
  const last = values[values.length - 1];
  return {
    method: "naive",
    fitted: fittedNaive(values),
    forecast: new Array(horizon).fill(last),
    params: {},
  };
}

export function seasonalNaive(values, { horizon = 1, seasonLength = 4 } = {}) {
  const fitted = values.map((value, index) => (index < seasonLength ? null : values[index - seasonLength]));
  const forecast = Array.from({ length: horizon }, (_, index) => values[values.length - seasonLength + (index % seasonLength)]);
  return { method: "seasonal-naive", fitted, forecast, params: { seasonLength } };
}

export function movingAverage(values, { horizon = 1, window = 4 } = {}) {
  const fitted = values.map((value, index) => {
    if (index < window) return null;
    return mean(values.slice(index - window, index));
  });
  const forecastValue = mean(values.slice(-window));
  return {
    method: "moving-average",
    fitted,
    forecast: new Array(horizon).fill(forecastValue),
    params: { window },
  };
}

export function linearTrend(values, { horizon = 1 } = {}) {
  const { slope, intercept } = linearRegression(values);
  const fitted = values.map((value, index) => (index === 0 ? null : intercept + slope * index));
  const n = values.length;
  const forecast = Array.from({ length: horizon }, (_, index) => intercept + slope * (n + index));
  return { method: "linear-trend", fitted, forecast, params: { slope, intercept } };
}
