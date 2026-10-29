// Three deterministic series for the demo and the tests.
//
// Generated, not downloaded: the same seed produces the same numbers on every
// machine, so a test can assert a forecast value and a screenshot can show the
// same chart after a year. The seasonal shapes are deliberate, one weekly
// cycle, one annual cycle, one daily cycle, so the model picker has something
// to disagree about.

function mulberry32(seed) {
  let state = seed >>> 0;
  return function next() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(random) {
  const u = 1 - random();
  const v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function dates(startIso, count, stepHours) {
  const start = new Date(`${startIso}T00:00:00Z`);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(start.getTime() + index * stepHours * 3600 * 1000);
    return date.toISOString().slice(0, stepHours === 24 ? 10 : 13).replace("T", " ");
  });
}

function buildWebTraffic() {
  const random = mulberry32(20260101);
  const count = 180;
  const day = dates("2025-09-01", count, 24);
  const points = day.map((date, index) => {
    const weekly = 230 * Math.sin((2 * Math.PI * (index % 7)) / 7);
    const value = 1400 + 1.6 * index + weekly + gaussian(random) * 42;
    return { date, value: Math.round(value * 10) / 10 };
  });
  return {
    id: "web-traffic",
    name: "Web traffic",
    unit: "sessions",
    frequency: "daily",
    seasonLength: 7,
    description: "Six months of daily sessions with a weekly cycle and a mild upward trend.",
    points,
  };
}

function buildRetailMonthly() {
  const random = mulberry32(4242);
  const count = 84;
  const months = dates("2019-01-01", count, 24 * 30.44);
  const factors = [0.9, 0.92, 0.97, 0.99, 1.01, 1.02, 0.98, 0.96, 1.0, 1.04, 1.13, 1.26];
  const points = months.map((date, index) => {
    const seasonal = factors[index % 12];
    const value = (96 + 3.1 * index) * seasonal + gaussian(random) * 4.2;
    return { date: date.slice(0, 7), value: Math.round(value * 10) / 10 };
  });
  return {
    id: "retail-monthly",
    name: "Retail revenue",
    unit: "USD thousands",
    frequency: "monthly",
    seasonLength: 12,
    description: "Seven years of monthly revenue with an annual cycle and a November, December peak.",
    points,
  };
}

function buildEnergyHourly() {
  const random = mulberry32(777);
  const count = 336;
  const hours = dates("2026-03-02", count, 1);
  const points = hours.map((date, index) => {
    const daily = 62 * Math.sin((2 * Math.PI * (index % 24)) / 24 - Math.PI / 2);
    const second = 18 * Math.sin((4 * Math.PI * (index % 24)) / 24);
    const value = 318 + daily + second + gaussian(random) * 5.5;
    return { date, value: Math.round(value * 10) / 10 };
  });
  return {
    id: "energy-hourly",
    name: "Energy load",
    unit: "kWh",
    frequency: "hourly",
    seasonLength: 24,
    description: "Two weeks of hourly load with a strong daily cycle and a flat level.",
    points,
  };
}

export const DATASETS = [buildWebTraffic(), buildRetailMonthly(), buildEnergyHourly()];

export const datasetById = (id) => DATASETS.find((dataset) => dataset.id === id) || null;

export const valuesOf = (dataset) => dataset.points.map((point) => point.value);
