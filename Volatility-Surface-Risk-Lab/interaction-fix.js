(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const mats = [30, 60, 90, 180, 365];
  const money = Array.from({length: 9}, (_, i) => 0.8 + i * 0.05);
  const labels = {
    market: "B-spline-shaped browser surface",
    polynomial: "Polynomial browser surface",
    heston: "Heston-shaped browser surface"
  };
  const views = {
    surfaceCanvas: {yaw: -0.72, pitch: 0.68, zoom: 1},
    factorSurfaceCanvas: {yaw: -0.72, pitch: 0.68, zoom: 1}
  };
  let liveFrame = 0, drawFrame = 0;

  const num = (id, fallback = 0) => {
    const x = Number($(id)?.value);
    return Number.isFinite(x) ? x : fallback;
  };
  const val = (id, fallback = "") => $(id)?.value ?? fallback;

  function patchPage() {
    ["startYear", "endYear"].forEach((id, i) => {
      const input = $(id);
      if (!input) return;
      input.value = i ? "2021" : "2005";
      if (input.closest("label")) input.closest("label").style.display = "none";
    });

    const model = $("surfaceModel");
    if (model) [...model.options].forEach(o => { if (labels[o.value]) o.textContent = labels[o.value]; });
    const status = document.querySelectorAll(".hero-status span");
    if (status[1]) status[1].textContent = "No WRDS observations or credentials in the browser";
    const hero = document.querySelector(".hero-copy");
    if (hero) hero.textContent = "Shape a model-generated implied-volatility surface, move PCA factors, simulate future spot and variance, and trace the visible assumptions into portfolio VaR and expected shortfall.";
    const surfaceIntro = document.querySelector("#panel-surface .section-heading > p");
    if (surfaceIntro) surfaceIntro.textContent = "The displayed surface is generated from the visible ATM-volatility, skew, curvature, term-slope, PCA, and shape-family controls. It is not fitted from WRDS or OptionMetrics quotes.";
    const factorIntro = document.querySelector("#panel-factors .section-heading > p");
    if (factorIntro) factorIntro.textContent = "Move the factor standard deviations and inspect both the shocked surface and the selected loading geometry. Changes are redrawn immediately.";

    if (!$("browserScopeNote")) {
      const note = document.createElement("section");
      note.id = "browserScopeNote";
      note.className = "browser-scope-note";
      note.innerHTML = "<strong>How the browser values are generated.</strong> For forward moneyness <em>m = F/K</em> and maturity <em>T</em>, implied volatility equals the selected ATM level plus a term component, a skew term proportional to <em>m − 1</em>, a curvature term proportional to <em>(m − 1)²</em>, and a deterministic shape adjustment. Scenario paths use seeded stylized Heston-, GBM/FHS-, or PCA-inspired equations. Portfolio P&amp;L uses the visible delta, vega, gamma, vanna, hedge, and revaluation settings. None of the live values is a WRDS or OptionMetrics quote or price. The backtest table is a fixed aggregate summary from the separate MSc thesis report.";
      document.querySelector(".experiment-bar")?.insertAdjacentElement("afterend", note);
    }

    const style = document.createElement("style");
    style.textContent = `
      #surfaceCanvas,#factorSurfaceCanvas{cursor:grab;touch-action:none;user-select:none;-webkit-user-select:none}
      #surfaceCanvas.dragging,#factorSurfaceCanvas.dragging{cursor:grabbing}
      .browser-scope-note{margin:16px 0;padding:17px 20px;border:1px solid rgba(130,221,255,.28);border-radius:16px;background:rgba(20,43,70,.62);color:#b8c7dc;line-height:1.55}
      .browser-scope-note strong{color:#f4f7ff}
      .rotation-help{display:flex;justify-content:space-between;gap:12px;margin-top:8px;color:#8495af;font-size:11px}
      .rotation-help button{border:1px solid rgba(130,221,255,.28);border-radius:999px;background:#0d1c30;color:#aeeaff;padding:4px 10px;cursor:pointer}
    `;
    document.head.appendChild(style);
    if ($("footerFingerprint")) $("footerFingerprint").textContent = `Seed ${num("seed", 2311)}`;
  }

  function syncLabels() {
    const model = val("surfaceModel", "market");
    const level = Math.round(num("confidence", .95) * 100);
    if ($("experimentName")) $("experimentName").textContent = `SPX · ${labels[model]} · ${level}% VaR`;
    if ($("surfaceChartTitle")) $("surfaceChartTitle").textContent = labels[model];
    if ($("metricRole")) $("metricRole").textContent = "Browser formula";
    if ($("metricRoleNote")) $("metricRoleNote").textContent = "not fitted from WRDS quotes";
    if ($("footerFingerprint")) $("footerFingerprint").textContent = `Seed ${num("seed", 2311)}`;
  }

  function surfaceVol(m, days) {
    const atm = num("atmVol", 20), skew = num("skew", -12), curve = num("curvature", 18), term = num("termSlope", 3);
    const x = m - 1, t = days / 365;
    const termPart = term * (Math.sqrt(t) - Math.sqrt(90 / 365));
    let vol = atm + termPart - skew * x + curve * x * x;
    const model = val("surfaceModel", "market");
    if (model === "market") {
      vol += 1.25 * Math.exp(-Math.pow((m - 1.155) / .045, 2)) * Math.exp(-1.8 * t);
      vol += .42 * Math.sin((m - .8) * 18) * Math.exp(-2.4 * t);
    } else if (model === "heston") {
      const short = Math.exp(-2.5 * t);
      vol = atm + termPart - skew * x * (1 + .75 * short) + curve * x * x * (1 + .6 * short);
    }
    return clamp(vol, 6, 90);
  }

  function loading(pc, m, days) {
    const x = (m - 1) / .2;
    const t = (Math.sqrt(days / 365) - Math.sqrt(30 / 365)) / (1 - Math.sqrt(30 / 365));
    if (val("pcaBasis", "raw") === "correlation") {
      if (pc === 1) return .88 + .12 * (1 - t);
      if (pc === 2) return x;
      if (pc === 3) return (t - .5) * 1.8;
      return (x * x - .38) * (1.15 - .25 * t);
    }
    if (pc === 1) return .18 + .95 * Math.max(0, x) * Math.exp(-2.8 * t) + .3 * (1 - t);
    if (pc === 2) return -.25 + x * (1.15 - .55 * t);
    if (pc === 3) return (t - .38) * (.75 + .3 * x);
    return (x * x - .45) * Math.exp(-1.6 * t);
  }

  function shock(m, days) {
    return 1.55 * num("pc1") * loading(1, m, days) +
      1.25 * num("pc2") * loading(2, m, days) +
      1.05 * num("pc3") * loading(3, m, days) +
      .9 * num("pc5") * loading(5, m, days);
  }

  function setup(canvas) {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2), w = Math.max(280, rect.width), h = Math.max(220, rect.height);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    const g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, "#091222"); g.addColorStop(1, "#050b17");
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    return {ctx, w, h};
  }

  function project(p, view, w, h) {
    const cy = Math.cos(view.yaw), sy = Math.sin(view.yaw), cp = Math.cos(view.pitch), sp = Math.sin(view.pitch);
    const x1 = p.x * cy - p.y * sy, y1 = p.x * sy + p.y * cy;
    const y2 = y1 * cp - p.z * sp, depth = y1 * sp + p.z * cp;
    const scale = Math.min(w, h) * .29 * view.zoom;
    const persp = 1 / clamp(1 + depth * .075, .72, 1.35);
    return {x: w * .5 + x1 * scale * persp, y: h * .54 + y2 * scale * persp, depth};
  }

  function color(z, alpha) {
    const q = clamp(z, 0, 1);
    return `hsla(${220 - 185 * q},78%,${45 + 15 * q}%,${alpha})`;
  }

  function draw3d(id) {
    const canvas = $(id), view = views[id];
    if (!canvas || !view || canvas.offsetParent === null) return;
    const getter = id === "factorSurfaceCanvas" ? (m, d) => surfaceVol(m, d) + shock(m, d) : surfaceVol;
    const {ctx, w, h} = setup(canvas);
    const vals = mats.flatMap(d => money.map(m => getter(m, d)));
    const lo = Math.min(...vals), hi = Math.max(...vals), range = Math.max(hi - lo, 1e-6);
    const grid = mats.map((d, ti) => money.map((m, mi) => {
      const vol = getter(m, d);
      return {vol, world: {x: (mi / 8 - .5) * 2.55, y: (ti / 4 - .5) * 1.85, z: ((vol - lo) / range - .5) * 1.6}};
    }));
    const cells = [];
    for (let ti = 0; ti < 4; ti++) for (let mi = 0; mi < 8; mi++) {
      const nodes = [grid[ti][mi], grid[ti][mi + 1], grid[ti + 1][mi + 1], grid[ti + 1][mi]];
      const points = nodes.map(n => project(n.world, view, w, h));
      cells.push({nodes, points, depth: points.reduce((s, p) => s + p.depth, 0) / 4, avg: nodes.reduce((s, n) => s + n.vol, 0) / 4});
    }
    cells.sort((a, b) => a.depth - b.depth).forEach(c => {
      ctx.beginPath(); ctx.moveTo(c.points[0].x, c.points[0].y); c.points.slice(1).forEach(p => ctx.lineTo(p.x, p.y)); ctx.closePath();
      ctx.fillStyle = color((c.avg - lo) / range, .5); ctx.fill(); ctx.strokeStyle = "rgba(145,211,240,.22)"; ctx.stroke();
    });
    ctx.lineWidth = 1.25;
    grid.forEach(row => { ctx.beginPath(); row.forEach((n, i) => { const p = project(n.world, view, w, h); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); }); ctx.strokeStyle = "rgba(130,221,255,.65)"; ctx.stroke(); });
    money.forEach((_, mi) => { ctx.beginPath(); grid.forEach((row, i) => { const p = project(row[mi].world, view, w, h); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); }); ctx.strokeStyle = "rgba(168,149,255,.5)"; ctx.stroke(); });
    ctx.font = "11px system-ui"; ctx.fillStyle = "#8c9db6"; ctx.fillText(`${lo.toFixed(1)}%`, 14, h - 18); ctx.fillText(`${hi.toFixed(1)}%`, 14, 24);
    ctx.textAlign = "right"; ctx.fillText("Drag to rotate · wheel to zoom · double-click to reset", w - 14, h - 18); ctx.textAlign = "left";
  }

  function drawVisible() { draw3d("surfaceCanvas"); draw3d("factorSurfaceCanvas"); }
  function schedule3d() {
    cancelAnimationFrame(drawFrame);
    drawFrame = requestAnimationFrame(() => requestAnimationFrame(drawVisible));
  }
  function forceLiveRender() {
    if (liveFrame) return;
    liveFrame = requestAnimationFrame(() => {
      liveFrame = 0; syncLabels();
      document.querySelector('.tab-bar [role="tab"][aria-selected="true"]')?.click();
      schedule3d();
    });
  }

  function makeRotatable(id) {
    const canvas = $(id), view = views[id];
    if (!canvas || canvas.dataset.rotatable) return;
    canvas.dataset.rotatable = "1"; canvas.tabIndex = 0;
    const help = document.createElement("div"); help.className = "rotation-help";
    help.innerHTML = "<span>Drag or swipe to rotate the plot.</span><button type='button'>Reset view</button>";
    canvas.insertAdjacentElement("afterend", help);
    let dragging = false, lastX = 0, lastY = 0;
    const reset = () => { view.yaw = -.72; view.pitch = .68; view.zoom = 1; draw3d(id); };
    help.querySelector("button").onclick = reset; canvas.ondblclick = reset;
    canvas.addEventListener("pointerdown", e => { dragging = true; lastX = e.clientX; lastY = e.clientY; canvas.classList.add("dragging"); canvas.setPointerCapture?.(e.pointerId); e.preventDefault(); });
    canvas.addEventListener("pointermove", e => { if (!dragging) return; view.yaw += (e.clientX - lastX) * .012; view.pitch = clamp(view.pitch + (e.clientY - lastY) * .01, -1.48, 1.48); lastX = e.clientX; lastY = e.clientY; draw3d(id); e.preventDefault(); });
    const stop = e => { dragging = false; canvas.classList.remove("dragging"); if (e?.pointerId !== undefined) canvas.releasePointerCapture?.(e.pointerId); };
    canvas.addEventListener("pointerup", stop); canvas.addEventListener("pointercancel", stop); canvas.addEventListener("lostpointercapture", stop);
    canvas.addEventListener("wheel", e => { view.zoom = clamp(view.zoom * Math.exp(-e.deltaY * .0012), .55, 2.25); draw3d(id); e.preventDefault(); }, {passive: false});
  }

  function bind() {
    ["atmVol","skew","curvature","termSlope","sliceMaturity","surfaceModel","pc1","pc2","pc3","pc5","pcaBasis","loadingChoice"].forEach(id => {
      const el = $(id); if (!el) return;
      el.addEventListener("input", forceLiveRender); el.addEventListener("change", forceLiveRender);
    });
    document.querySelectorAll('.tab-bar [role="tab"]').forEach(tab => tab.addEventListener("click", schedule3d));
    $("seed")?.addEventListener("input", syncLabels);
    addEventListener("resize", schedule3d);
  }

  function init() {
    patchPage(); syncLabels(); makeRotatable("surfaceCanvas"); makeRotatable("factorSurfaceCanvas"); bind(); forceLiveRender();
  }
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", init, {once: true}) : init();
})();
