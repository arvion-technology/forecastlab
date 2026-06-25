// Forecast error metrics.
//
// MAPE is included because it is the number stakeholders ask for, and guarded
// because it explodes near zero: observations with |actual| below 1e-9 are
// skipped and the count of skipped points is reported rather than hidden.

export function mae(actuals, predictions) {
  if (!actuals.length) return 0;
  return actuals.reduce((sum, actual, index) => sum + Math.abs(actual - predictions[index]), 0) / actuals.length;
}

export function rmse(actuals, predictions) {
  if (!actuals.length) return 0;
  const squared = actuals.reduce((sum, actual, index) => sum + (actual - predictions[index]) ** 2, 0);
  return Math.sqrt(squared / actuals.length);
}

export function mape(actuals, predictions) {
  let total = 0;
  let counted = 0;
  let skipped = 0;
  actuals.forEach((actual, index) => {
    if (Math.abs(actual) < 1e-9) {
      skipped += 1;
      return;
    }
    total += Math.abs((actual - predictions[index]) / actual);
    counted += 1;
  });
  return { value: counted ? total / counted : null, counted, skipped };
}

/** Mean signed error. Positive means the forecast is biased high. */
export function bias(actuals, predictions) {
  if (!actuals.length) return 0;
  return actuals.reduce((sum, actual, index) => sum + (predictions[index] - actual), 0) / actuals.length;
}

export function summarise(folds) {
  const actuals = folds.map((fold) => fold.actual);
  const predictions = folds.map((fold) => fold.predicted);
  const percentage = mape(actuals, predictions);
  return {
    count: folds.length,
    mae: mae(actuals, predictions),
    rmse: rmse(actuals, predictions),
    mape: percentage.value,
    mapeSkipped: percentage.skipped,
    bias: bias(actuals, predictions),
  };
}
