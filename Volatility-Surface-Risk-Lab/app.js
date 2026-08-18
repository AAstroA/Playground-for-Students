(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const maturities = [30, 60, 90, 180, 365];
  const money = Array.from({ length: 9 }, (_, i) => 0.8 + i * 0.05);
  const surfaceDomain = { min: 0, max: 80 };
  const modelNames = { market: "Market B-spline", polynomial: "Polynomial", heston: "Heston structural" };
  const scenarioNames = {
    hestonP: "Heston-MC-P",
    gbmFhs: "GBM + PSP-FHS",
    pcaHs: "PCA historical surface",
    hestonQ: "Heston-MC-Q"
  };

  const backtests = {
    "0.90": [
      { model: "GBM + PSP-FHS", expected: 402.7, breaches: 382, rate: 0.09486, p: 0.0637 },
      { model: "Heston-MC-P", expected: 402.7, breaches: 333, rate: 0.08269, p: 0.000098 },
      { model: "Heston-MC-Q", expected: 402.7, breaches: 110, rate: 0.02732, p: 0.000001 }
    ],
    "0.95": [
      { model: "GBM + PSP-FHS", expected: 201.35, breaches: 187, rate: 0.04644, p: 0.000468 },
      { model: "Heston-MC-P", expected: 201.35, breaches: 200, rate: 0.04967, p: 0.946507 },
      { model: "Heston-MC-Q", expected: 201.35, breaches: 73, rate: 0.01813, p: 0.000001 }
    ],
    "0.99": [
      { model: "GBM + PSP-FHS", expected: 40.27, breaches: 37, rate: 0.00919, p: 0.01487 },
      { model: "Heston-MC-P", expected: 40.27, breaches: 72, rate: 0.01788, p: 0.000035 },
      { model: "Heston-MC-Q", expected: 40.27, breaches: 45, rate: 0.01117, p: 0.00044 }
    ]
  };

  const defaults = {
    startYear: 2005, endYear: 2021, surfaceModel: "market", confidence: "0.95", seed: 2311,
    atmVol: 20, skew: -12, curvature: 18, termSlope: 3, sliceMaturity: 90,
    pc1: 0, pc2: 0, pc3: 0, pc5: 0, pcaBasis: "raw", loadingChoice: "1",
    scenarioModel: "hestonP", horizon: 10, paths: 600, kappa: 4, xi: 0.55, rho: -0.7,
    vega: 500, gamma: 250, delta: 0, deltaHedge: true, fullRevaluation: true
  };

  let scenario = null;
  let toastTimer = null;
  let resizeTimer = null;
  let activeRenderFrame = null;

  function number(id) { return Number($(id).value); }
  function value(id) { return $(id).value; }
  function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
  function pct(x, digits = 1) { return `${(x * 100).toFixed(digits)}%`; }
  function moneyFmt(x) {
    const sign = x < 0 ? "−" : "";
    const n = Math.abs(x);
    if (n >= 1e6) return `${sign}$${(n / 1e6).toFixed(2)}m`;
    if (n >= 1000) return `${sign}$${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}k`;
    return `${sign}$${n.toFixed(0)}`;
  }
  function signed(x, digits = 1, suffix = "") { return `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(digits)}${suffix}`; }

  function showToast(message) {
    const toast = $("toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
  }

  function setupCanvas(id) {
    const canvas = $(id);
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(260, rect.width);
    const h = Math.max(180, rect.height);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  }

  function canvasBackground(ctx, w, h) {
    const gradient = ctx.createLinearGradient(0, 0, w, h);
    gradient.addColorStop(0, "rgba(9,18,34,0.78)");
    gradient.addColorStop(1, "rgba(5,11,23,0.94)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  }

  function grid(ctx, left, top, right, bottom, xCount = 6, yCount = 5) {
    ctx.strokeStyle = "rgba(148,174,214,0.10)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= xCount; i++) {
      const x = left + (right - left) * i / xCount;
      ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke();
    }
    for (let i = 0; i <= yCount; i++) {
      const y = top + (bottom - top) * i / yCount;
      ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();
    }
  }

  function ticks(min, max, count) {
    return Array.from({ length: count + 1 }, (_, i) => min + (max - min) * i / count);
  }

  function drawAxes(ctx, options) {
    const { left, top, right, bottom, xTicks, yTicks, xPos, yPos, xFormat, yFormat, xLabel, yLabel } = options;
    ctx.save();
    ctx.strokeStyle = "rgba(178,198,226,0.48)";
    ctx.fillStyle = "#93a5bf";
    ctx.lineWidth = 1;
    ctx.font = "10px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.beginPath(); ctx.moveTo(left, top); ctx.lineTo(left, bottom); ctx.lineTo(right, bottom); ctx.stroke();
    xTicks.forEach((v) => {
      const x = xPos(v);
      ctx.beginPath(); ctx.moveTo(x, bottom); ctx.lineTo(x, bottom + 5); ctx.stroke();
      ctx.fillText(xFormat(v), x, bottom + 8);
    });
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    yTicks.forEach((v) => {
      const y = yPos(v);
      ctx.beginPath(); ctx.moveTo(left - 5, y); ctx.lineTo(left, y); ctx.stroke();
      ctx.fillText(yFormat(v), left - 8, y);
    });
    ctx.fillStyle = "#b7c5d9";
    ctx.font = "11px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(xLabel, (left + right) / 2, bottom + 42);
    ctx.translate(left - 43, (top + bottom) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(yLabel, 0, 0);
    ctx.restore();
  }

  function scheduleActiveRender() {
    if (activeRenderFrame !== null) cancelAnimationFrame(activeRenderFrame);
    activeRenderFrame = requestAnimationFrame(() => {
      activeRenderFrame = null;
      renderActive();
    });
  }

  function surfaceVol(m, days, model = value("surfaceModel")) {
    const atm = number("atmVol");
    const skew = number("skew");
    const curve = number("curvature");
    const term = number("termSlope");
    const x = m - 1;
    const t = days / 365;
    const termPart = term * (Math.sqrt(t) - Math.sqrt(90 / 365));
    let vol = atm + termPart - skew * x + curve * x * x;
    if (model === "market") {
      vol += 1.25 * Math.exp(-Math.pow((m - 1.155) / 0.045, 2)) * Math.exp(-1.8 * t);
      vol += 0.42 * Math.sin((m - 0.8) * 18) * Math.exp(-2.4 * t);
    } else if (model === "heston") {
      const short = Math.exp(-2.5 * t);
      vol = atm + termPart - skew * x * (1 + 0.75 * short) + curve * x * x * (1 + 0.6 * short);
    }
    return clamp(vol, 6, 90);
  }

  function loading(pc, m, days, basis = value("pcaBasis")) {
    const x = (m - 1) / 0.2;
    const t = (Math.sqrt(days / 365) - Math.sqrt(30 / 365)) / (1 - Math.sqrt(30 / 365));
    if (basis === "correlation") {
      if (pc === 1) return 0.88 + 0.12 * (1 - t);
      if (pc === 2) return x;
      if (pc === 3) return (t - 0.5) * 1.8;
      return (x * x - 0.38) * (1.15 - 0.25 * t);
    }
    if (pc === 1) return 0.18 + 0.95 * Math.max(0, x) * Math.exp(-2.8 * t) + 0.3 * (1 - t);
    if (pc === 2) return -0.25 + x * (1.15 - 0.55 * t);
    if (pc === 3) return (t - 0.38) * (0.75 + 0.3 * x);
    return (x * x - 0.45) * Math.exp(-1.6 * t);
  }

  function factorShock(m, days) {
    return 1.55 * number("pc1") * loading(1, m, days) +
      1.25 * number("pc2") * loading(2, m, days) +
      1.05 * number("pc3") * loading(3, m, days) +
      0.9 * number("pc5") * loading(5, m, days);
  }

  function colorScale(v, alpha = 1) {
    const z = clamp(v, 0, 1);
    const hue = 222 - z * 205;
    return `hsla(${hue}, 82%, ${48 + z * 14}%, ${alpha})`;
  }

  function surfaceRange(getter) {
    const values = maturities.flatMap((d) => money.map((m) => getter(m, d)));
    return { min: Math.min(...values), max: Math.max(...values) };
  }

  function drawSurface(canvasId, getter) {
    const { ctx, w, h } = setupCanvas(canvasId);
    canvasBackground(ctx, w, h);
    const values = maturities.flatMap((d) => money.map((m) => getter(m, d)));
    const dataMin = Math.min(...values), dataMax = Math.max(...values);
    const min = surfaceDomain.min, max = surfaceDomain.max;
    const left = 72, right = w - 68, top = 24, bottom = h - 70;
    const spanX = (right - left) * 0.72;
    const depthX = (right - left) * 0.2;
    const spanY = (bottom - top) * 0.66;
    const depthY = (bottom - top) * 0.18;
    const point = (mi, ti, vol) => ({
      x: left + spanX * mi / (money.length - 1) + depthX * ti / (maturities.length - 1),
      y: bottom - spanY * (clamp(vol, min, max) - min) / (max - min) - depthY * ti / (maturities.length - 1)
    });

    for (let ti = maturities.length - 2; ti >= 0; ti--) {
      for (let mi = 0; mi < money.length - 1; mi++) {
        const vs = [
          getter(money[mi], maturities[ti]), getter(money[mi + 1], maturities[ti]),
          getter(money[mi + 1], maturities[ti + 1]), getter(money[mi], maturities[ti + 1])
        ];
        const ps = [point(mi, ti, vs[0]), point(mi + 1, ti, vs[1]), point(mi + 1, ti + 1, vs[2]), point(mi, ti + 1, vs[3])];
        const avg = vs.reduce((a, b) => a + b, 0) / 4;
        ctx.beginPath(); ctx.moveTo(ps[0].x, ps[0].y); ps.slice(1).forEach((p) => ctx.lineTo(p.x, p.y)); ctx.closePath();
        ctx.fillStyle = colorScale((avg - min) / (max - min), 0.34); ctx.fill();
      }
    }

    ctx.lineWidth = 1.25;
    maturities.forEach((d, ti) => {
      ctx.beginPath();
      money.forEach((m, mi) => {
        const p = point(mi, ti, getter(m, d));
        if (mi === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      });
      ctx.strokeStyle = `rgba(130,221,255,${0.35 + ti * 0.1})`; ctx.stroke();
    });
    money.forEach((m, mi) => {
      ctx.beginPath();
      maturities.forEach((d, ti) => {
        const p = point(mi, ti, getter(m, d));
        if (ti === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      });
      ctx.strokeStyle = "rgba(168,149,255,0.42)"; ctx.stroke();
    });

    const origin = point(0, 0, min), xEnd = point(money.length - 1, 0, min);
    const maturityEnd = point(money.length - 1, maturities.length - 1, min), zEnd = point(0, 0, max);
    ctx.save();
    ctx.strokeStyle = "rgba(189,207,232,0.55)"; ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(origin.x, origin.y); ctx.lineTo(xEnd.x, xEnd.y); ctx.lineTo(maturityEnd.x, maturityEnd.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(origin.x, origin.y); ctx.lineTo(zEnd.x, zEnd.y); ctx.stroke();
    ctx.font = "10px system-ui";
    ctx.fillStyle = "#93a5bf";
    ctx.textAlign = "center";
    [0, 2, 4, 6, 8].forEach((mi) => {
      const p = point(mi, 0, min);
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y + 5); ctx.stroke();
      ctx.fillText(money[mi].toFixed(2), p.x, p.y + 17);
    });
    const maturityAngle = Math.atan2(maturityEnd.y - xEnd.y, maturityEnd.x - xEnd.x);
    maturities.forEach((d, ti) => {
      if (![0, 2, 4].includes(ti)) return;
      const p = point(8, ti, min);
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 5, p.y + 3); ctx.stroke();
      ctx.save(); ctx.translate(p.x + 7, p.y + 5); ctx.rotate(maturityAngle); ctx.textAlign = "left"; ctx.fillText(`${d}d`, 0, 0); ctx.restore();
    });
    ticks(min, max, 4).forEach((v) => {
      const p = point(0, 0, v);
      ctx.beginPath(); ctx.moveTo(p.x - 5, p.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillText(`${v.toFixed(0)}%`, p.x - 8, p.y);
    });
    ctx.fillStyle = "#c0cce0"; ctx.font = "11px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.fillText("Forward moneyness F/K", (origin.x + xEnd.x) / 2, bottom + 50);
    const maturityMid = { x: (xEnd.x + maturityEnd.x) / 2, y: (xEnd.y + maturityEnd.y) / 2 };
    ctx.save(); ctx.translate(maturityMid.x - Math.sin(maturityAngle) * 28, maturityMid.y + Math.cos(maturityAngle) * 28); ctx.rotate(maturityAngle); ctx.fillText("Maturity (days)", 0, 0); ctx.restore();
    ctx.save(); ctx.translate(left - 48, (origin.y + zEnd.y) / 2); ctx.rotate(-Math.PI / 2); ctx.fillText("Implied volatility (%)", 0, 0); ctx.restore();
    ctx.restore();
    return { min: dataMin, max: dataMax };
  }

  function drawSmile() {
    const { ctx, w, h } = setupCanvas("smileCanvas");
    canvasBackground(ctx, w, h);
    const d = number("sliceMaturity");
    const vals = money.map((m) => surfaceVol(m, d));
    const min = Math.min(...vals) - 1, max = Math.max(...vals) + 1;
    const l = 58, r = w - 20, t = 18, b = h - 58;
    grid(ctx, l, t, r, b, 4, 4);
    const x = (m) => l + (m - 0.8) / 0.4 * (r - l);
    const y = (v) => b - (v - min) / (max - min) * (b - t);
    const grad = ctx.createLinearGradient(l, 0, r, 0); grad.addColorStop(0, "#a895ff"); grad.addColorStop(0.55, "#82ddff"); grad.addColorStop(1, "#f4cf7a");
    ctx.beginPath(); vals.forEach((v, i) => i ? ctx.lineTo(x(money[i]), y(v)) : ctx.moveTo(x(money[i]), y(v)));
    ctx.strokeStyle = grad; ctx.lineWidth = 3; ctx.stroke();
    vals.forEach((v, i) => { ctx.beginPath(); ctx.arc(x(money[i]), y(v), 3.2, 0, Math.PI * 2); ctx.fillStyle = "#f5f8ff"; ctx.fill(); });
    drawAxes(ctx, {
      left: l, top: t, right: r, bottom: b,
      xTicks: [0.8, 0.9, 1, 1.1, 1.2], yTicks: ticks(min, max, 4), xPos: x, yPos: y,
      xFormat: (m) => m.toFixed(2), yFormat: (v) => `${v.toFixed(1)}%`,
      xLabel: "Forward moneyness F/K", yLabel: "Implied volatility (%)"
    });
  }

  function renderSurface() {
    const getter = (m, d) => surfaceVol(m, d);
    const range = $("surfaceCanvas").dataset.rotatable ? surfaceRange(getter) : drawSurface("surfaceCanvas", getter);
    drawSmile();
    const d = number("sliceMaturity");
    const atm = surfaceVol(1, d);
    const wing = surfaceVol(1.2, d) - atm;
    $("surfaceChartTitle").textContent = `${modelNames[value("surfaceModel")]} surface`;
    $("smileTitle").textContent = `${d}-day smile`;
    $("metricAtm").textContent = `${atm.toFixed(1)}%`;
    $("metricWing").textContent = `${wing.toFixed(1)} vol`;
    $("metricRange").textContent = `${range.min.toFixed(1)}–${range.max.toFixed(1)}%`;
    const roles = {
      market: ["Market fit", "scenario starting state"],
      polynomial: ["Parametric fit", "held-out benchmark"],
      heston: ["Structural fit", "conditional repricing"]
    }[value("surfaceModel")];
    $("metricRole").textContent = roles[0]; $("metricRoleNote").textContent = roles[1];
  }

  function drawLoading() {
    const { ctx, w, h } = setupCanvas("loadingCanvas");
    canvasBackground(ctx, w, h);
    const pc = Number(value("loadingChoice"));
    const pad = { l: 64, r: 54, t: 24, b: 60 };
    const cellW = (w - pad.l - pad.r) / money.length;
    const cellH = (h - pad.t - pad.b) / maturities.length;
    let maxAbs = 0;
    maturities.forEach((d) => money.forEach((m) => { maxAbs = Math.max(maxAbs, Math.abs(loading(pc, m, d))); }));
    maturities.forEach((d, ti) => money.forEach((m, mi) => {
      const z = loading(pc, m, d) / (maxAbs || 1);
      ctx.fillStyle = z >= 0 ? `rgba(244,112,133,${0.16 + Math.abs(z) * 0.72})` : `rgba(74,134,255,${0.16 + Math.abs(z) * 0.72})`;
      ctx.fillRect(pad.l + mi * cellW + 1, pad.t + ti * cellH + 1, cellW - 2, cellH - 2);
    }));
    const xPos = (m) => pad.l + ((m - money[0]) / 0.05 + 0.5) * cellW;
    const yPos = (d) => pad.t + (maturities.indexOf(d) + 0.5) * cellH;
    drawAxes(ctx, {
      left: pad.l, top: pad.t, right: w - pad.r, bottom: h - pad.b,
      xTicks: money.filter((_, i) => i % 2 === 0), yTicks: maturities, xPos, yPos,
      xFormat: (m) => m.toFixed(2), yFormat: (d) => `${d}d`,
      xLabel: "Forward moneyness F/K", yLabel: "Maturity (days)"
    });
    const legendX = w - 28, legendTop = pad.t, legendBottom = h - pad.b;
    for (let i = 0; i < 48; i++) {
      const z = 1 - i / 47;
      ctx.fillStyle = z >= 0.5 ? `rgba(244,112,133,${0.3 + (z - 0.5) * 1.4})` : `rgba(74,134,255,${0.3 + (0.5 - z) * 1.4})`;
      ctx.fillRect(legendX, legendTop + i * (legendBottom - legendTop) / 48, 8, (legendBottom - legendTop) / 48 + 1);
    }
    ctx.fillStyle = "#93a5bf"; ctx.font = "9px system-ui"; ctx.textAlign = "left";
    ctx.fillText("+1", legendX + 12, legendTop + 4); ctx.fillText("0", legendX + 12, (legendTop + legendBottom) / 2 + 3); ctx.fillText("−1", legendX + 12, legendBottom);
  }

  function drawVariance() {
    const { ctx, w, h } = setupCanvas("varianceCanvas");
    canvasBackground(ctx, w, h);
    const raw = value("pcaBasis") === "raw";
    const vals = raw ? [77, 14.7, 2.5, 1.8, 1.2] : [41, 21, 13, 8, 5];
    const l = 58, r = w - 20, t = 20, b = h - 58;
    grid(ctx, l, t, r, b, 5, 4);
    const barW = (r - l) / vals.length * 0.54;
    vals.forEach((v, i) => {
      const x = l + (i + 0.5) * (r - l) / vals.length - barW / 2;
      const y = b - v / 80 * (b - t);
      const g = ctx.createLinearGradient(0, y, 0, b); g.addColorStop(0, i === 0 ? "#82ddff" : "#a895ff"); g.addColorStop(1, "rgba(24,46,79,0.35)");
      ctx.fillStyle = g; ctx.fillRect(x, y, barW, b - y);
      ctx.fillStyle = "#dce6f6"; ctx.font = "11px system-ui"; ctx.textAlign = "left"; ctx.fillText(`${v.toFixed(v % 1 ? 1 : 0)}%`, x, y - 7);
    });
    drawAxes(ctx, {
      left: l, top: t, right: r, bottom: b,
      xTicks: [0, 1, 2, 3, 4], yTicks: [0, 20, 40, 60, 80],
      xPos: (i) => l + (i + 0.5) * (r - l) / vals.length, yPos: (v) => b - v / 80 * (b - t),
      xFormat: (i) => `PC${i + 1}`, yFormat: (v) => `${v}%`,
      xLabel: "Principal component", yLabel: "Explained variance (%)"
    });
    $("basisChip").textContent = raw ? "Empirical raw basis" : "Standardized demo";
  }

  function renderFactors() {
    const getter = (m, d) => clamp(surfaceVol(m, d) + factorShock(m, d), 5, 95);
    if (!$("factorSurfaceCanvas").dataset.rotatable) drawSurface("factorSurfaceCanvas", getter);
    drawLoading(); drawVariance();
    const norm = Math.sqrt(["pc1", "pc2", "pc3", "pc5"].reduce((s, id) => s + number(id) ** 2, 0));
    $("factorNorm").textContent = `${norm.toFixed(2)}σ total`;
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }

  function normalFactory(seed) {
    const rand = mulberry32(seed);
    let spare = null;
    return () => {
      if (spare !== null) { const z = spare; spare = null; return z; }
      const u = Math.max(rand(), 1e-12), v = rand();
      const r = Math.sqrt(-2 * Math.log(u));
      spare = r * Math.sin(2 * Math.PI * v);
      return r * Math.cos(2 * Math.PI * v);
    };
  }

  function quantile(sorted, q) {
    if (!sorted.length) return NaN;
    const p = (sorted.length - 1) * q, lo = Math.floor(p), hi = Math.ceil(p);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (p - lo);
  }

  function correlation(xs, ys) {
    const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
    const my = ys.reduce((a, b) => a + b, 0) / ys.length;
    let cov = 0, vx = 0, vy = 0;
    xs.forEach((x, i) => { const dx = x - mx, dy = ys[i] - my; cov += dx * dy; vx += dx * dx; vy += dy * dy; });
    return cov / Math.sqrt(Math.max(vx * vy, 1e-16));
  }

  function simulate() {
    const n = number("paths"), steps = number("horizon"), model = value("scenarioModel");
    const dt = 1 / 252, rho = number("rho"), kappa = number("kappa"), xi = number("xi");
    const theta = Math.pow(number("atmVol") / 100, 2), v0 = theta;
    const rng = normalFactory(number("seed") + ({ hestonP: 11, gbmFhs: 29, pcaHs: 47, hestonQ: 71 }[model] || 0));
    const pathsByStep = Array.from({ length: steps + 1 }, () => []);
    const samplePaths = [];
    const terminalSpot = [], terminalVar = [], returns = [], deltaVar = [], ivChanges = [];

    for (let p = 0; p < n; p++) {
      let s = 100, v = v0;
      const sample = p < 42 ? [s] : null;
      pathsByStep[0].push(s);
      for (let j = 1; j <= steps; j++) {
        const z1 = rng(), z2i = rng();
        const z2 = rho * z1 + Math.sqrt(Math.max(0, 1 - rho * rho)) * z2i;
        if (model === "pcaHs") {
          v = clamp(v * Math.exp(0.14 * Math.sqrt(dt) * z2 - 0.5 * 0.14 ** 2 * dt), 0.0004, 1.2);
        } else if (model === "gbmFhs") {
          s *= Math.exp((0.055 - 0.5 * v) * dt + Math.sqrt(v * dt) * z1);
          const paired = -0.64 * z1 + Math.sqrt(1 - 0.64 ** 2) * z2i;
          v = clamp(v * Math.exp(0.58 * Math.sqrt(dt) * paired - 0.5 * 0.58 ** 2 * dt), 0.0004, 1.2);
        } else {
          const mu = model === "hestonQ" ? 0.02 : 0.065;
          const rootV = Math.sqrt(Math.max(v, 0));
          s *= Math.exp((mu - 0.5 * v) * dt + rootV * Math.sqrt(dt) * z1);
          const target = model === "hestonQ" ? theta * 0.88 : theta;
          v = Math.max(0, v + kappa * (target - v) * dt + xi * rootV * Math.sqrt(dt) * z2);
        }
        pathsByStep[j].push(s);
        if (sample) sample.push(s);
      }
      if (sample) samplePaths.push(sample);
      const ret = Math.log(s / 100);
      const dv = v - v0;
      terminalSpot.push(s); terminalVar.push(v); returns.push(ret); deltaVar.push(dv);
      const leverageSurface = model === "pcaHs" ? 0 : -0.28 * ret;
      ivChanges.push(Math.sqrt(Math.max(v, 0)) - Math.sqrt(v0) + leverageSurface);
    }

    scenario = { model, steps, n, theta, pathsByStep, samplePaths, terminalSpot, terminalVar, returns, deltaVar, ivChanges };
    renderScenario();
    revalue();
  }

  function drawFan() {
    const { ctx, w, h } = setupCanvas("fanCanvas");
    canvasBackground(ctx, w, h);
    const l = 60, r = w - 20, t = 22, b = h - 60;
    const qs = scenario.pathsByStep.map((arr) => {
      const s = [...arr].sort((a, b) => a - b);
      return [quantile(s, 0.01), quantile(s, 0.05), quantile(s, 0.5), quantile(s, 0.95), quantile(s, 0.99)];
    });
    const min = Math.min(...qs.map((x) => x[0])) * 0.995, max = Math.max(...qs.map((x) => x[4])) * 1.005;
    const x = (i) => l + i / scenario.steps * (r - l), y = (v) => b - (v - min) / (max - min || 1) * (b - t);
    grid(ctx, l, t, r, b, Math.min(6, scenario.steps), 5);
    const band = (lo, hi, fill) => {
      ctx.beginPath(); qs.forEach((q, i) => i ? ctx.lineTo(x(i), y(q[hi])) : ctx.moveTo(x(i), y(q[hi])));
      for (let i = qs.length - 1; i >= 0; i--) ctx.lineTo(x(i), y(qs[i][lo]));
      ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
    };
    band(0, 4, "rgba(168,149,255,0.10)"); band(1, 3, "rgba(130,221,255,0.18)");
    scenario.samplePaths.slice(0, 18).forEach((path) => {
      ctx.beginPath(); path.forEach((v, i) => i ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v)));
      ctx.strokeStyle = "rgba(196,214,240,0.08)"; ctx.lineWidth = 0.8; ctx.stroke();
    });
    ctx.beginPath(); qs.forEach((q, i) => i ? ctx.lineTo(x(i), y(q[2])) : ctx.moveTo(x(i), y(q[2])));
    ctx.strokeStyle = "#82ddff"; ctx.lineWidth = 2.5; ctx.stroke();
    const dayTicks = [...new Set([0, Math.round(scenario.steps / 4), Math.round(scenario.steps / 2), Math.round(3 * scenario.steps / 4), scenario.steps])];
    drawAxes(ctx, {
      left: l, top: t, right: r, bottom: b,
      xTicks: dayTicks, yTicks: ticks(min, max, 4), xPos: x, yPos: y,
      xFormat: (v) => `${v}d`, yFormat: (v) => v.toFixed(1),
      xLabel: "Trading-day horizon", yLabel: "Spot index (S₀ = 100)"
    });
  }

  function drawJoint() {
    const { ctx, w, h } = setupCanvas("jointCanvas");
    canvasBackground(ctx, w, h);
    const xs = scenario.returns.map((x) => x * 100), ys = scenario.terminalVar.map((v) => Math.sqrt(v) * 100);
    const xmin = Math.min(...xs), xmax = Math.max(...xs), ymin = Math.min(...ys), ymax = Math.max(...ys);
    const l = 62, r = w - 20, t = 20, b = h - 60;
    grid(ctx, l, t, r, b, 5, 5);
    const xp = (v) => l + (v - xmin) / (xmax - xmin || 1) * (r - l), yp = (v) => b - (v - ymin) / (ymax - ymin || 1) * (b - t);
    const step = Math.max(1, Math.floor(xs.length / 420));
    for (let i = 0; i < xs.length; i += step) {
      ctx.beginPath(); ctx.arc(xp(xs[i]), yp(ys[i]), 2.1, 0, Math.PI * 2);
      ctx.fillStyle = xs[i] < 0 ? "rgba(255,112,133,0.42)" : "rgba(72,213,181,0.4)"; ctx.fill();
    }
    drawAxes(ctx, {
      left: l, top: t, right: r, bottom: b,
      xTicks: ticks(xmin, xmax, 4), yTicks: ticks(ymin, ymax, 4), xPos: xp, yPos: yp,
      xFormat: (v) => `${v.toFixed(1)}%`, yFormat: (v) => `${v.toFixed(1)}%`,
      xLabel: "Terminal log return", yLabel: "Terminal volatility"
    });
  }

  function renderScenario() {
    if (!scenario) return;
    drawFan(); drawJoint();
    const spots = [...scenario.terminalSpot].sort((a, b) => a - b);
    const vars = [...scenario.terminalVar].sort((a, b) => a - b);
    const corr = correlation(scenario.returns, scenario.deltaVar);
    $("fanChip").textContent = `${scenario.n.toLocaleString()} paths · ${scenario.steps} days`;
    $("corrChip").textContent = `sample corr. ${corr.toFixed(2)}`;
    $("medianSpot").textContent = quantile(spots, 0.5).toFixed(2);
    $("tailSpot").textContent = quantile(spots, 0.01).toFixed(2);
    $("medianVar").textContent = pct(Math.sqrt(quantile(vars, 0.5)), 1);
    $("realizedCorr").textContent = corr.toFixed(2);
  }

  function pnlValues() {
    if (!scenario) return [];
    const vega = number("vega") * 1000;
    const gamma = number("gamma") * 1000;
    const residualDelta = number("delta") / 100;
    const full = $("fullRevaluation").checked;
    const hedged = $("deltaHedge").checked;
    const expectedVar = scenario.theta * scenario.steps / 252;
    return scenario.returns.map((ret, i) => {
      const dIv = scenario.ivChanges[i];
      const vegaPnl = vega * dIv;
      const gammaPnl = full ? 0.5 * gamma * (ret * ret - expectedVar) * 7 : 0;
      const vannaPnl = full ? -0.12 * vega * ret * dIv : 0;
      const deltaPnl = hedged ? residualDelta * 120000 * ret : (0.35 + residualDelta) * 120000 * ret;
      return vegaPnl + gammaPnl + vannaPnl + deltaPnl;
    });
  }

  function drawHistogram(id, values, marker, marker2 = null) {
    const { ctx, w, h } = setupCanvas(id);
    canvasBackground(ctx, w, h);
    if (!values.length) return;
    const sorted = [...values].sort((a, b) => a - b);
    const q1 = quantile(sorted, 0.005), q2 = quantile(sorted, 0.995);
    const min = Math.min(q1, marker2 ?? q1), max = Math.max(q2, marker ?? q2);
    const bins = 42, counts = Array(bins).fill(0);
    values.forEach((v) => { const k = clamp(Math.floor((v - min) / (max - min || 1) * bins), 0, bins - 1); counts[k]++; });
    const cmax = Math.max(...counts);
    const l = 64, r = w - 20, t = 22, b = h - 60;
    grid(ctx, l, t, r, b, 6, 4);
    counts.forEach((c, i) => {
      const x = l + i / bins * (r - l), bw = (r - l) / bins - 1;
      const y = b - c / cmax * (b - t);
      const center = min + (i + 0.5) / bins * (max - min);
      ctx.fillStyle = center < marker ? "rgba(255,112,133,0.66)" : "rgba(130,221,255,0.44)";
      ctx.fillRect(x, y, bw, b - y);
    });
    const markerLine = (v, color, label) => {
      const x = l + (v - min) / (max - min || 1) * (r - l);
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.moveTo(x, t); ctx.lineTo(x, b); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = color; ctx.font = "10px system-ui"; ctx.fillText(label, clamp(x + 4, l, r - 55), t + 12);
    };
    markerLine(marker, "#ff7085", "VaR cutoff");
    if (marker2 !== null) markerLine(marker2, "#f4cf7a", "ES");
    drawAxes(ctx, {
      left: l, top: t, right: r, bottom: b,
      xTicks: ticks(min, max, 4), yTicks: ticks(0, cmax, 4),
      xPos: (v) => l + (v - min) / (max - min || 1) * (r - l), yPos: (v) => b - v / (cmax || 1) * (b - t),
      xFormat: moneyFmt, yFormat: (v) => Math.round(v).toString(),
      xLabel: "Portfolio P&L", yLabel: "Scenario count"
    });
  }

  function renderBacktest() {
    const key = value("confidence"), rows = backtests[key], level = Number(key);
    $("backtestBody").innerHTML = rows.map((r) => {
      const pass = r.p >= 0.05;
      return `<tr><td><strong>${r.model}</strong></td><td>${r.expected.toFixed(2)}</td><td>${r.breaches}</td><td>${(r.rate * 100).toFixed(2)}%</td><td>${r.p < 0.0001 ? "<0.0001" : r.p.toFixed(4)}</td><td><span class="verdict ${pass ? "pass" : "fail"}">${pass ? "PASS" : "REJECT"}</span></td></tr>`;
    }).join("");
    $("coverageChip").textContent = `${(level * 100).toFixed(0)}%`;
    drawCoverage(rows, level);
  }

  function drawCoverage(rows, level) {
    const { ctx, w, h } = setupCanvas("coverageCanvas");
    canvasBackground(ctx, w, h);
    const l = 60, r = w - 18, t = 34, b = h - 62;
    const max = Math.max(...rows.flatMap((x) => [x.expected, x.breaches])) * 1.14;
    grid(ctx, l, t, r, b, 3, 4);
    const groupW = (r - l) / rows.length, bw = Math.min(28, groupW * 0.24);
    rows.forEach((row, i) => {
      const center = l + (i + 0.5) * groupW;
      const ye = b - row.expected / max * (b - t), yo = b - row.breaches / max * (b - t);
      ctx.fillStyle = "rgba(130,221,255,0.36)"; ctx.fillRect(center - bw - 2, ye, bw, b - ye);
      ctx.fillStyle = row.p >= 0.05 ? "rgba(115,230,169,0.72)" : "rgba(255,112,133,0.7)"; ctx.fillRect(center + 2, yo, bw, b - yo);
    });
    const labels = ["GBM/FHS", "Heston-P", "Heston-Q"];
    drawAxes(ctx, {
      left: l, top: t, right: r, bottom: b,
      xTicks: [0, 1, 2], yTicks: ticks(0, max, 4),
      xPos: (i) => l + (i + 0.5) * groupW, yPos: (v) => b - v / max * (b - t),
      xFormat: (i) => labels[i], yFormat: (v) => Math.round(v).toString(),
      xLabel: "Scenario model", yLabel: "VaR exceptions"
    });
    ctx.textAlign = "left"; ctx.fillStyle = "#8191aa"; ctx.font = "10px system-ui";
    ctx.fillText("Expected", l + 12, 18); ctx.fillStyle = "#82ddff"; ctx.fillRect(l, 10, 8, 8);
    ctx.fillStyle = "#8191aa"; ctx.fillText("Observed", l + 94, 18); ctx.fillStyle = "#ff7085"; ctx.fillRect(l + 82, 10, 8, 8);
  }

  function revalue() {
    if (!scenario) return;
    const pnl = pnlValues();
    const alpha = number("confidence");
    const sortedLosses = pnl.map((x) => -x).sort((a, b) => a - b);
    const varLoss = quantile(sortedLosses, alpha);
    const tail = sortedLosses.filter((x) => x >= varLoss);
    const es = tail.reduce((a, b) => a + b, 0) / tail.length;
    const mean = pnl.reduce((a, b) => a + b, 0) / pnl.length;
    const worst = Math.min(...pnl);
    drawHistogram("pnlCanvas", pnl, -varLoss, -es);
    const level = `${(alpha * 100).toFixed(0)}%`;
    $("lossChip").textContent = `${level} tail · ${scenarioNames[scenario.model]}`;
    $("varLabel").textContent = `${level} VaR`; $("esLabel").textContent = `${level} expected shortfall`;
    $("varValue").textContent = moneyFmt(varLoss); $("esValue").textContent = moneyFmt(es);
    $("meanPnl").textContent = moneyFmt(mean); $("worstPnl").textContent = moneyFmt(worst);
    renderBacktest();
  }

  function updateOutputs() {
    $("atmVolOut").textContent = `${number("atmVol").toFixed(1)}%`;
    $("skewOut").textContent = `${number("skew") < 0 ? "−" : "+"}${Math.abs(number("skew")).toFixed(1)} vol`;
    $("curvatureOut").textContent = number("curvature").toFixed(1);
    $("termSlopeOut").textContent = `${number("termSlope").toFixed(1)} vol`;
    ["pc1", "pc2", "pc3", "pc5"].forEach((id) => { $(`${id}Out`).textContent = signed(number(id), 1, "σ"); });
    $("horizonOut").textContent = `${number("horizon")} days`; $("pathsOut").textContent = number("paths").toLocaleString();
    $("kappaOut").textContent = number("kappa").toFixed(2); $("xiOut").textContent = number("xi").toFixed(2);
    $("rhoOut").textContent = signed(number("rho"), 2);
    $("vegaOut").textContent = `$${number("vega").toFixed(0)}k`; $("gammaOut").textContent = `${number("gamma") < 0 ? "−" : ""}$${Math.abs(number("gamma")).toFixed(0)}k`;
    $("deltaOut").textContent = `${number("delta").toFixed(0)}%`;
    const model = value("scenarioModel"), q = model === "hestonQ";
    $("measureCallout").classList.toggle("q", q);
    $("measureCallout").innerHTML = q ? "<span>Q</span><div><strong>Risk-neutral transition</strong><small>Pricing sensitivity; not interpreted as a physical VaR law.</small></div>" : "<span>P</span><div><strong>Physical transition</strong><small>Candidate scenario probabilities for risk measurement.</small></div>";
    const level = `${(number("confidence") * 100).toFixed(0)}%`;
    $("experimentName").textContent = `SPX · ${modelNames[value("surfaceModel")]} · ${level} VaR`;
    $("footerFingerprint").textContent = `Config ${number("seed")}-${number("startYear")}-${number("endYear")}`;
  }

  function activateTab(button, focus = false) {
    document.querySelectorAll(".tab-bar [role=tab]").forEach((tab) => {
      const active = tab === button;
      tab.setAttribute("aria-selected", String(active)); tab.tabIndex = active ? 0 : -1;
      $(tab.getAttribute("aria-controls")).hidden = !active;
    });
    history.replaceState(null, "", `#${button.id.replace("tab-", "")}`);
    if (focus) button.focus();
    scheduleActiveRender();
  }

  function renderActive() {
    const active = document.querySelector(".tab-bar [aria-selected=true]")?.id;
    if (active === "tab-surface") renderSurface();
    if (active === "tab-factors") renderFactors();
    if (active === "tab-scenarios") renderScenario();
    if (active === "tab-risk") revalue();
    if (active === "tab-compare") renderBacktest();
  }

  function resetAll() {
    Object.entries(defaults).forEach(([id, val]) => {
      const el = $(id); if (!el) return;
      if (el.type === "checkbox") el.checked = val; else el.value = val;
    });
    updateOutputs(); renderSurface(); renderFactors(); simulate(); showToast("Default experiment restored.");
  }

  function exportConfig() {
    const ids = ["startYear", "endYear", "surfaceModel", "confidence", "seed", "atmVol", "skew", "curvature", "termSlope", "sliceMaturity", "pc1", "pc2", "pc3", "pc5", "pcaBasis", "scenarioModel", "horizon", "paths", "kappa", "xi", "rho", "vega", "gamma", "delta"];
    const config = { app: "Volatility Surface Risk Lab", version: 1, exportedAt: new Date().toISOString(), settings: {} };
    ids.forEach((id) => { config.settings[id] = $(id).type === "number" || $(id).type === "range" ? number(id) : value(id); });
    config.settings.deltaHedge = $("deltaHedge").checked; config.settings.fullRevaluation = $("fullRevaluation").checked;
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `vol-surface-risk-config-${number("seed")}.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 500); showToast("Experiment configuration downloaded.");
  }

  function bind() {
    document.querySelectorAll(".tab-bar [role=tab]").forEach((tab, index, tabs) => {
      tab.addEventListener("click", () => activateTab(tab));
      tab.addEventListener("keydown", (event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault(); let next = index;
        if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
        if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
        if (event.key === "Home") next = 0; if (event.key === "End") next = tabs.length - 1;
        activateTab(tabs[next], true);
      });
    });

    ["atmVol", "skew", "curvature", "termSlope", "sliceMaturity", "surfaceModel"].forEach((id) => $(id).addEventListener("input", () => { updateOutputs(); scheduleActiveRender(); }));
    ["pc1", "pc2", "pc3", "pc5", "pcaBasis", "loadingChoice"].forEach((id) => $(id).addEventListener("input", () => { updateOutputs(); scheduleActiveRender(); }));
    ["horizon", "paths", "kappa", "xi", "rho", "scenarioModel"].forEach((id) => $(id).addEventListener("input", updateOutputs));
    ["vega", "gamma", "delta", "deltaHedge", "fullRevaluation"].forEach((id) => $(id).addEventListener("input", () => { updateOutputs(); revalue(); }));
    ["startYear", "endYear", "seed"].forEach((id) => $(id).addEventListener("change", updateOutputs));
    $("confidence").addEventListener("change", () => { updateOutputs(); revalue(); });
    $("runScenarios").addEventListener("click", () => { simulate(); showToast(`${scenarioNames[value("scenarioModel")]} scenarios refreshed.`); });
    $("revaluePortfolio").addEventListener("click", () => { revalue(); showToast("Portfolio revalued on the active scenarios."); });
    $("surfacePreset").addEventListener("click", () => { $("atmVol").value = 42; $("skew").value = -24; $("curvature").value = 31; $("termSlope").value = -5; updateOutputs(); scheduleActiveRender(); showToast("Crisis-shaped surface loaded."); });
    $("factorReset").addEventListener("click", () => { ["pc1", "pc2", "pc3", "pc5"].forEach((id) => $(id).value = 0); updateOutputs(); scheduleActiveRender(); });
    $("riskPreset").addEventListener("click", () => { $("vega").value = 500; $("gamma").value = 250; $("delta").value = 0; $("deltaHedge").checked = true; $("fullRevaluation").checked = true; updateOutputs(); revalue(); });
    $("resetAll").addEventListener("click", resetAll); $("exportConfig").addEventListener("click", exportConfig);
    window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(scheduleActiveRender, 120); });
  }

  function init() {
    bind(); updateOutputs(); renderSurface(); renderFactors(); simulate();
    const requested = location.hash.replace("#", "");
    const target = requested && $(`tab-${requested}`);
    if (target) activateTab(target);
  }

  init();
})();
