// ForecastLab demo — rendering and chart drawing.
// Models, backtest, metrics and anomaly detection come from ../src/.
import { DATASETS, datasetById, valuesOf } from "../src/datasets.js";
import { HOLT_WINTERS_DEFAULTS } from "../src/holt-winters.js";
import { MODELS, getModel } from "../src/models.js";
import { compareModels } from "../src/backtest.js";
import { detectAnomalies, forecastBand, residualStats } from "../src/anomalies.js";

const el = A.el;
const $ = A.$;
const $$ = A.$$;
const fmt = A.fmt;

const state = {
  dataset: "retail-monthly",
  model: "hw-additive",
  horizon: 12,
  threshold: 3,
  view: "forecast",
};

const comparisonCache = new Map();
const analysisCache = new Map();

const number = (value, digits = 1) => (value === null || value === undefined ? "—" : Number(value).toLocaleString("en-US", { maximumFractionDigits: digits }));
const percent = (value) => (value === null || value === undefined ? "—" : `${(value * 100).toFixed(1)}%`);

function dateLabel(dataset, index) {
  const date = dataset.points[index]?.date || "";
  if (dataset.frequency === "monthly") return date.slice(0, 7);
  if (dataset.frequency === "hourly") return date.slice(5).replace(" ", " · ");
  return date.slice(5);
}

/* ------------------------------------------------------------------ chart */

const NS = "http://www.w3.org/2000/svg";
const svgEl = (tag, attrs = {}) => {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
};

function drawChart(dataset, values, band) {
  const history = values;
  const forecast = band.map((item) => item.value);
  const width = 760;
  const height = 320;
  const pad = { t: 18, r: 18, b: 32, l: 58 };
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const lows = band.map((item) => item.low);
  const highs = band.map((item) => item.high);
  const all = [...history, ...lows, ...highs];
  const rawMin = Math.min(...all);
  const rawMax = Math.max(...all);
  const margin = (rawMax - rawMin) * 0.08 || 1;
  const min = rawMin - margin;
  const max = rawMax + margin;
  const total = history.length + forecast.length;
  const x = (index) => pad.l + (index / (total - 1)) * innerW;
  const y = (value) => pad.t + innerH - ((value - min) / (max - min)) * innerH;

  const svg = svgEl("svg", { viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": `${dataset.name} history and forecast` });

  // Forecast region shading starts at the last observation.
  svg.append(svgEl("rect", {
    x: x(history.length - 1), y: pad.t, width: x(total - 1) - x(history.length - 1), height: innerH,
    class: "fl-forecast-zone",
  }));

  for (let i = 0; i <= 4; i++) {
    const value = min + ((max - min) / 4) * i;
    const yy = y(value);
    svg.append(svgEl("line", { x1: pad.l, x2: width - pad.r, y1: yy, y2: yy, class: i === 0 ? "fl-axis" : "fl-grid" }));
    const label = svgEl("text", { x: pad.l - 10, y: yy + 3, "text-anchor": "end", class: "fl-label" });
    label.textContent = fmt.compact(value);
    svg.append(label);
  }

  const tickEvery = Math.max(1, Math.ceil(total / 8));
  for (let index = 0; index < total; index += tickEvery) {
    const label = svgEl("text", { x: x(index), y: height - 10, "text-anchor": "middle", class: "fl-label" });
    label.textContent = dateLabel(dataset, Math.min(index, dataset.points.length - 1));
    svg.append(label);
  }

  // History line.
  const historyPath = history.map((value, index) => `${index ? "L" : "M"}${x(index).toFixed(2)} ${y(value).toFixed(2)}`).join(" ");
  svg.append(svgEl("path", { d: historyPath, class: "fl-history" }));

  // Band polygon: last observation → low edge forward → high edge back.
  const bandPoints = [
    [x(history.length - 1), y(history[history.length - 1])],
    ...band.map((item, index) => [x(history.length + index), y(item.low)]),
    ...[...band].reverse().map((item, index) => [x(history.length + band.length - 1 - index), y(item.high)]),
  ];
  svg.append(svgEl("path", {
    d: bandPoints.map(([px, py], index) => `${index ? "L" : "M"}${px.toFixed(2)} ${py.toFixed(2)}`).join(" ") + " Z",
    class: "fl-band",
  }));

  // Forecast line connects to the last observation.
  const forecastPath = [
    `M${x(history.length - 1).toFixed(2)} ${y(history[history.length - 1]).toFixed(2)}`,
    ...forecast.map((value, index) => `L${x(history.length + index).toFixed(2)} ${y(value).toFixed(2)}`),
  ].join(" ");
  svg.append(svgEl("path", { d: forecastPath, class: "fl-forecast" }));

  svg.append(svgEl("circle", { cx: x(history.length - 1), cy: y(history[history.length - 1]), r: 3.5, class: "fl-last" }));

  return { svg, x, y };
}

function renderChart(analysis) {
  const { dataset, values, band, anomalies } = analysis;
  const { svg, x, y } = drawChart(dataset, values, band);
  for (const anomaly of anomalies) {
    const node = svgEl("circle", { cx: x(anomaly.index), cy: y(anomaly.value), r: 4.2, class: "fl-anomaly" });
    const title = svgEl("title");
    title.textContent = `${anomaly.date}: ${number(anomaly.value)} (z ${anomaly.z.toFixed(1)})`;
    node.append(title);
    svg.append(node);
  }
  $("#chart").replaceChildren(svg);
  $("#chart-title").textContent = `${dataset.name} · ${dataset.frequency}`;
  $("#chart-sub").textContent = `${values.length} observations · ${state.horizon} steps forecast · band from residual σ`;
}

/* ----------------------------------------------------------------- analysis */

function analyse() {
  const key = `${state.dataset}|${state.model}|${state.horizon}|${state.threshold}`;
  if (analysisCache.has(key)) return analysisCache.get(key);
  const dataset = datasetById(state.dataset);
  const values = valuesOf(dataset);
  const model = getModel(state.model);
  const fit = model.fit(values, { horizon: state.horizon, seasonLength: dataset.seasonLength });
  const stats = residualStats(dataset.points, fit.fitted);
  const band = forecastBand(fit.forecast, stats.std);
  const anomalies = detectAnomalies(dataset.points, fit.fitted, { threshold: state.threshold, window: dataset.seasonLength });

  const comparisonKey = `${state.dataset}|${state.horizon}`;
  if (!comparisonCache.has(comparisonKey)) {
    comparisonCache.set(comparisonKey, compareModels(
      dataset.points,
      MODELS.map((candidate) => candidate.id),
      { horizon: state.horizon, seasonLength: dataset.seasonLength, minTrain: Math.max(dataset.seasonLength * 2, 24) },
    ));
  }
  const comparisons = comparisonCache.get(comparisonKey);

  const analysis = { dataset, values, fit, stats, band, anomalies, comparisons };
  analysisCache.set(key, analysis);
  return analysis;
}

/* ---------------------------------------------------------------- forecast */

function renderMetricCards(analysis) {
  const { comparisons } = analysis;
  const ranked = comparisons
    .filter((row) => row.metrics)
    .sort((a, b) => a.metrics.mae - b.metrics.mae);
  const selected = comparisons.find((row) => row.modelId === state.model);
  const rank = ranked.findIndex((row) => row.modelId === state.model) + 1;

  $("#rank-badge").textContent = selected?.metrics ? `rank ${rank} of ${ranked.length}` : "fit failed";
  $("#rank-badge").className = `badge ${rank === 1 ? "green" : "gold"}`;

  const metrics = selected?.metrics;
  const cards = metrics
    ? [
        { label: "MAE", value: number(metrics.mae, 2) },
        { label: "RMSE", value: number(metrics.rmse, 2) },
        { label: "MAPE", value: percent(metrics.mape) },
        { label: "Bias", value: number(metrics.bias, 2) },
      ]
    : [{ label: "error", value: selected?.error || "fit failed" }];
  $("#metric-cards").replaceChildren(
    ...cards.map((card) =>
      el("div", { class: "metric" },
        el("div", { class: "metric-label", text: card.label }),
        el("div", { class: "metric-value", text: card.value }),
      ),
    ),
  );
  $("#metric-note").textContent = metrics
    ? `${metrics.count} walk-forward folds · h=${state.horizon} · ${selected.modelLabel}`
    : selected?.error || "the model could not be fitted to this series";
}

function renderForecastList(analysis) {
  const { dataset, band, stats } = analysis;
  $("#band-note").textContent = `σ = ${number(stats.std, 1)}`;
  const rows = band.slice(0, 6).map((item, index) => ({
    date: dateLabel(dataset, dataset.points.length + index).slice(0, 10),
    value: `${number(item.value, 1)} ${dataset.unit}`,
    band: `${number(item.low, 0)} – ${number(item.high, 0)}`,
  }));
  $("#forecast-list").replaceChildren(
    ...rows.map((row) =>
      el("div", { class: "forecast-row" },
        el("span", { class: "date", text: row.date }),
        el("span", { class: "value", text: row.value }),
        el("span", { class: "band", text: row.band }),
      ),
    ),
  );
}

function renderComparison(analysis) {
  const { comparisons } = analysis;
  const ranked = [...comparisons].sort((a, b) => (a.metrics?.mae ?? Infinity) - (b.metrics?.mae ?? Infinity));
  $("#comparison-sub").textContent = `walk-forward, h=${state.horizon}`;
  $("#comparison").replaceChildren(
    A.dataTable({
      columns: [
        { key: "model", label: "Model", render: (row) => el("span", { class: row.modelId === state.model ? "strong" : "", text: row.modelLabel }) },
        { key: "mae", label: "MAE", align: "right", render: (row) => el("span", { class: "mono", text: row.metrics ? number(row.metrics.mae, 2) : "—" }) },
        { key: "rmse", label: "RMSE", align: "right", render: (row) => el("span", { class: "mono", text: row.metrics ? number(row.metrics.rmse, 2) : "—" }) },
        { key: "mape", label: "MAPE", align: "right", render: (row) => el("span", { class: "mono", text: row.metrics ? percent(row.metrics.mape) : "—" }) },
        { key: "best", label: "", align: "right", render: (row) => (row.modelId === ranked[0]?.modelId ? el("span", { class: "badge green", text: "best" }) : null) },
      ],
      rows: ranked,
    }),
  );
}

function renderAnomalies(analysis) {
  const { anomalies, dataset } = analysis;
  $("#anomaly-count").textContent = `${anomalies.length} at z≥${state.threshold}`;
  $("#anomalies").replaceChildren(
    ...(anomalies.length
      ? anomalies
          .slice()
          .reverse()
          .slice(0, 6)
          .map((anomaly) =>
            el("div", { class: "anomaly-row" },
              el("span", { class: "when", text: anomaly.date.slice(0, 12) }),
              el("span", { class: `badge ${anomaly.direction === "above" ? "red" : "blue"}`, text: anomaly.direction }),
              el("span", { class: "val", text: `${number(anomaly.value)} ${dataset.unit}` }),
              el("span", { class: "z", text: `${anomaly.z >= 0 ? "+" : ""}${anomaly.z.toFixed(1)}σ` }),
            ),
          )
      : [el("div", { class: "empty" }, el("strong", { text: "No anomalies" }), `No residual is beyond ${state.threshold}σ of its local history.`)]),
  );
}

function renderForecast() {
  const analysis = analyse();
  renderChart(analysis);
  renderMetricCards(analysis);
  renderForecastList(analysis);
  renderComparison(analysis);
  renderAnomalies(analysis);
}

/* ---------------------------------------------------------------- backtest */

function renderBacktest() {
  const analysis = analyse();
  const { comparisons, dataset } = analysis;
  const ranked = [...comparisons].sort((a, b) => (a.metrics?.mae ?? Infinity) - (b.metrics?.mae ?? Infinity));
  $("#backtest-sub").textContent = `${dataset.name} · h=${state.horizon} · ${ranked[0]?.metrics?.count ?? 0} folds`;

  $("#backtest-table").replaceChildren(
    A.dataTable({
      columns: [
        { key: "rank", label: "#", align: "right", render: (row) => el("span", { class: "mono muted", text: String(ranked.indexOf(row) + 1) }) },
        { key: "label", label: "Model", render: (row) => el("span", { class: row.modelId === state.model ? "strong" : "", text: row.modelLabel }) },
        { key: "mae", label: "MAE", align: "right", render: (row) => el("span", { class: "mono", text: row.metrics ? number(row.metrics.mae, 2) : "—" }) },
        { key: "rmse", label: "RMSE", align: "right", render: (row) => el("span", { class: "mono", text: row.metrics ? number(row.metrics.rmse, 2) : "—" }) },
        { key: "mape", label: "MAPE", align: "right", render: (row) => el("span", { class: "mono", text: row.metrics ? percent(row.metrics.mape) : "—" }) },
        { key: "bias", label: "Bias", align: "right", render: (row) => el("span", { class: "mono", text: row.metrics ? number(row.metrics.bias, 2) : "—" }) },
      ],
      rows: ranked,
    }),
  );

  const selected = comparisons.find((row) => row.modelId === state.model);
  const steps = selected?.perStep || [];
  const rmses = steps.map((step) => step.rmse);
  const spread = rmses.length ? Math.max(...rmses) / Math.max(1e-9, Math.min(...rmses)) : 1;
  $("#step-sub").textContent = selected
    ? `${selected.modelLabel} · ${spread < 1.3 ? "flat across the horizon" : "growing with the horizon"}`
    : "fit failed";
  $("#step-bars").replaceChildren(
    A.barList({
      rows: steps.map((step) => ({ label: `${step.step} step${step.step === 1 ? "" : "s"} ahead`, value: step.rmse })),
      format: (value) => value.toFixed(1),
    }),
  );

  $("#folds-sub").textContent = selected
    ? `${selected.modelLabel} · showing the last 14 of ${selected.metrics.count} folds`
    : "fit failed";
  const folds = (selected?.folds || []).slice(-14).reverse();
  $("#folds").replaceChildren(
    A.dataTable({
      columns: [
        { key: "date", label: "Target", render: (row) => el("span", { class: "mono", text: row.date.slice(0, 10) }) },
        { key: "step", label: "Step", align: "center", render: (row) => el("span", { class: "mono muted", text: `h${row.step}` }) },
        { key: "actual", label: "Actual", align: "right", render: (row) => el("span", { class: "mono", text: number(row.actual) }) },
        { key: "predicted", label: "Predicted", align: "right", render: (row) => el("span", { class: "mono", text: number(row.predicted) }) },
        { key: "error", label: "Error", align: "right", render: (row) => el("span", { class: `mono ${Math.abs(row.error) > 20 ? "delta bad" : "muted"}`, text: `${row.error >= 0 ? "+" : ""}${number(row.error, 2)}` }) },
      ],
      rows: folds,
    }),
  );
}

/* ----------------------------------------------------------------- methods */

function renderMethods() {
  $("#hw-params").replaceChildren(
    ...Object.entries(HOLT_WINTERS_DEFAULTS).map(([key, value]) =>
      el("div", { style: "display:contents" }, el("dt", { text: key }), el("dd", { text: String(value) })),
    ),
  );
  $("#dataset-cards").replaceChildren(
    ...DATASETS.map((dataset) =>
      el("div", { class: "dataset-card" },
        el("div", { class: "dataset-name", text: `${dataset.name} · ${dataset.unit}` }),
        el("div", { class: "dataset-meta", text: `${dataset.points.length} points · ${dataset.frequency} · seasonal period ${dataset.seasonLength}` }),
        el("div", { class: "dataset-desc", text: dataset.description }),
      ),
    ),
  );
}

/* ---------------------------------------------------------------- controls */

function maxHorizon(dataset) {
  return Math.min(24, dataset.seasonLength * 2);
}

function syncControls() {
  const dataset = datasetById(state.dataset);
  const max = maxHorizon(dataset);
  if (state.horizon > max) state.horizon = max;
  const horizon = $("#horizon");
  horizon.max = String(max);
  horizon.value = String(state.horizon);
  $("#horizon-value").textContent = String(state.horizon);
  $("#dataset").value = state.dataset;
  $("#model").value = state.model;
  $("#threshold").value = String(state.threshold);
}

function render() {
  syncControls();
  if (state.view === "forecast") renderForecast();
  if (state.view === "backtest") renderBacktest();
  if (state.view === "methods") renderMethods();
}

/* --------------------------------------------------------------------- nav */

function show(view) {
  if (!["forecast", "backtest", "methods"].includes(view)) view = "forecast";
  state.view = view;
  $$("[data-view-panel]").forEach((panel) => { panel.hidden = panel.dataset.viewPanel !== view; });
  $$(".nav-item[data-view]").forEach((link) => link.classList.toggle("active", link.dataset.view === view));
  if (location.hash !== `#${view}`) history.replaceState(null, "", `#${view}`);
  render();
}

function bind() {
  $("#dataset").replaceChildren(
    ...DATASETS.map((dataset) => el("option", { value: dataset.id, text: `${dataset.name} (${dataset.frequency})` })),
  );
  $("#model").replaceChildren(
    ...MODELS.map((model) => el("option", { value: model.id, text: model.label })),
  );

  $("#dataset").addEventListener("change", (event) => {
    state.dataset = event.target.value;
    state.horizon = Math.min(state.horizon, maxHorizon(datasetById(state.dataset)));
    render();
  });
  $("#model").addEventListener("change", (event) => {
    state.model = event.target.value;
    render();
  });
  $("#horizon").addEventListener("input", (event) => {
    state.horizon = Number(event.target.value);
    $("#horizon-value").textContent = event.target.value;
    render();
  });
  $("#threshold").addEventListener("change", (event) => {
    state.threshold = Number(event.target.value);
    render();
  });
  window.addEventListener("hashchange", () => show(location.hash.replace("#", "")));
  $$(".nav-item[data-view]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      show(link.dataset.view);
    });
  });
}

/* -------------------------------------------------------------------- boot */

bind();
show(location.hash.replace("#", "") || "forecast");
