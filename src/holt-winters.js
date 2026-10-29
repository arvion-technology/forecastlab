// Holt-Winters exponential smoothing, additive and multiplicative.
//
// The implementation follows the classic recursion: a level, a trend and one
// seasonal factor per position in the cycle, updated after every observation.
// It is deliberately not auto-optimised, fixed smoothing parameters are easier
// to test and to explain, and the demo exposes them in the methods panel. An
// optimiser can sit on top of `fitHoltWinters` later without changing its shape.
//
// Additive seasonality suits series where the seasonal swing is a constant
// amount (extra 200 sessions every Saturday). Multiplicative suits swings that
// scale with the level (30% more revenue every December).

import { mean } from "./series.js";

const DEFAULT_PARAMS = { alpha: 0.35, beta: 0.1, gamma: 0.3 };

function validate(values, { seasonLength, method, alpha, beta, gamma }) {
  if (!Array.isArray(values) || values.length < seasonLength * 2) {
    throw new Error(`need at least ${seasonLength * 2} observations for a seasonal model`);
  }
  if (!Number.isInteger(seasonLength) || seasonLength < 2) throw new Error("seasonLength must be an integer of at least 2");
  if (!["additive", "multiplicative"].includes(method)) throw new Error(`unknown seasonality: ${method}`);
  for (const [name, value] of Object.entries({ alpha, beta, gamma })) {
    if (!(value > 0 && value <= 1)) throw new Error(`${name} must be in (0, 1]`);
  }
  if (method === "multiplicative" && values.some((value) => value <= 0)) {
    throw new Error("multiplicative seasonality needs strictly positive values");
  }
}

export function fitHoltWinters(values, options = {}) {
  const seasonLength = options.seasonLength ?? 4;
  const method = options.method ?? "additive";
  const { alpha, beta, gamma } = { ...DEFAULT_PARAMS, ...options };
  const horizon = options.horizon ?? 1;
  if (!Number.isInteger(horizon) || horizon < 1) throw new Error("horizon must be a positive integer");
  validate(values, { seasonLength, method, alpha, beta, gamma });

  const n = values.length;
  const m = seasonLength;
  const firstSeason = values.slice(0, m);
  const secondSeason = values.slice(m, 2 * m);
  let level = method === "additive" ? mean(firstSeason) : mean(firstSeason);
  let trend = (mean(secondSeason) - mean(firstSeason)) / m;
  const seasonal = method === "additive"
    ? firstSeason.map((value) => value - level)
    : firstSeason.map((value) => value / level);

  const fitted = new Array(n).fill(null);
  for (let t = 0; t < n; t++) {
    const seasonalFactor = seasonal[t % m];
    const prediction = method === "additive" ? level + trend + seasonalFactor : (level + trend) * seasonalFactor;
    if (t >= m) fitted[t] = prediction;

    const observed = values[t];
    const base = method === "additive" ? observed - seasonalFactor : observed / seasonalFactor;
    const previousLevel = level;
    level = alpha * base + (1 - alpha) * (level + trend);
    trend = beta * (level - previousLevel) + (1 - beta) * trend;
    seasonal[t % m] =
      method === "additive"
        ? gamma * (observed - level) + (1 - gamma) * seasonalFactor
        : gamma * (observed / level) + (1 - gamma) * seasonalFactor;
  }

  function project(steps) {
    const out = [];
    for (let step = 1; step <= steps; step++) {
      const seasonalFactor = seasonal[(n + step - 1) % m];
      out.push(
        method === "additive"
          ? level + step * trend + seasonalFactor
          : (level + step * trend) * seasonalFactor,
      );
    }
    return out;
  }

  return {
    method,
    seasonLength: m,
    params: { alpha, beta, gamma },
    level,
    trend,
    seasonal: [...seasonal],
    fitted,
    forecast: project(horizon),
    forecastAt: project,
  };
}

export const HOLT_WINTERS_DEFAULTS = { ...DEFAULT_PARAMS };
