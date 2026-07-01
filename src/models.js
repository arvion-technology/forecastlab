// Model registry.
//
// Every model implements the same tiny contract: `fit(values, config)` returns
// `{fitted, forecast, params}`. The backtest, the demo and the tests do not care
// which model is behind it, which is what makes the comparison table honest.

import { fitHoltWinters } from "./holt-winters.js";
import { linearTrend, movingAverage, naive, seasonalNaive } from "./baselines.js";

export const MODELS = [
  {
    id: "hw-additive",
    label: "Holt-Winters additive",
    short: "HW additive",
    seasonal: true,
    note: "constant-size seasonal swing",
    fit: (values, config) => fitHoltWinters(values, { ...config, method: "additive" }),
  },
  {
    id: "hw-multiplicative",
    label: "Holt-Winters multiplicative",
    short: "HW multiplicative",
    seasonal: true,
    note: "seasonal swing proportional to the level",
    fit: (values, config) => fitHoltWinters(values, { ...config, method: "multiplicative" }),
  },
  {
    id: "seasonal-naive",
    label: "Seasonal naive",
    short: "Seasonal naive",
    seasonal: true,
    note: "same point one season ago",
    fit: (values, config) => seasonalNaive(values, config),
  },
  {
    id: "moving-average",
    label: "Moving average",
    short: "Moving average",
    seasonal: false,
    note: "mean of the last window",
    fit: (values, config) => movingAverage(values, { ...config, window: config.seasonLength }),
  },
  {
    id: "linear-trend",
    label: "Linear trend",
    short: "Linear trend",
    seasonal: false,
    note: "ordinary least squares over time",
    fit: (values, config) => linearTrend(values, config),
  },
  {
    id: "naive",
    label: "Naive",
    short: "Naive",
    seasonal: false,
    note: "tomorrow equals today",
    fit: (values, config) => naive(values, config),
  },
];

export function getModel(id) {
  const model = MODELS.find((candidate) => candidate.id === id);
  if (!model) throw new Error(`unknown model: ${id}`);
  return model;
}

export function fitModel(id, values, config = {}) {
  const model = getModel(id);
  const result = model.fit(values, { horizon: 1, seasonLength: 4, ...config });
  return { model, ...result };
}
