// Walk-forward backtesting.
//
// One train/test split tells you how a model did on one particular future. Walk-
// forward re-fits at every origin and scores only points that were genuinely
// unknown at fit time, across many origins. It is slower than a single split and
// much harder to fool with a lucky test window.

import { summarise } from "./metrics.js";
import { getModel } from "./models.js";

export function walkForward(series, modelId, options = {}) {
  const model = getModel(modelId);
  const values = series.map((point) => (typeof point === "number" ? point : point.value));
  const seasonLength = options.seasonLength ?? 4;
  const horizon = options.horizon ?? 1;
  const step = options.step ?? 1;
  const minTrain = options.minTrain ?? Math.max(2 * seasonLength, 12);

  if (values.length <= minTrain + horizon - 1) {
    throw new Error(`series too short for minTrain=${minTrain} and horizon=${horizon}`);
  }

  const folds = [];
  for (let origin = minTrain; origin + horizon <= values.length; origin += step) {
    const train = values.slice(0, origin);
    const fitted = model.fit(train, { horizon, seasonLength });
    for (let h = 1; h <= horizon; h++) {
      const index = origin + h - 1;
      const actual = values[index];
      const predicted = fitted.forecast[h - 1];
      folds.push({
        origin,
        step: h,
        index,
        date: series[index]?.date ?? String(index),
        actual,
        predicted,
        error: predicted - actual,
        trainSize: origin,
      });
    }
  }

  const perStep = [];
  for (let h = 1; h <= horizon; h++) {
    const stepFolds = folds.filter((fold) => fold.step === h);
    perStep.push({ step: h, ...summarise(stepFolds) });
  }

  return {
    modelId,
    modelLabel: model.label,
    config: { horizon, step, minTrain, seasonLength },
    folds,
    metrics: summarise(folds),
    perStep,
  };
}

/** Compare every model on the same folds so the table is apples to apples. */
export function compareModels(series, modelIds, options = {}) {
  const results = [];
  for (const modelId of modelIds) {
    try {
      results.push(walkForward(series, modelId, options));
    } catch (error) {
      results.push({ modelId, modelLabel: modelId, error: error.message, metrics: null, folds: [], perStep: [] });
    }
  }
  return results;
}
