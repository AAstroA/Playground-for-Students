# Volatility Surface Risk Lab

Static, browser-based teaching interface for volatility-surface shape, PCA shocks, Heston/GBM-style scenarios, option-portfolio VaR and expected shortfall, and aggregate research backtest results.

## Interaction

The surface-shape controls and PCA-factor controls redraw immediately while they are moved. Both 3D surface canvases can be rotated by dragging or swiping, zoomed with the mouse wheel, reset by double-clicking, and operated from the keyboard with the arrow keys.

## What the browser calculates

The displayed volatility surface is generated locally from the visible controls. For forward moneyness `m` and maturity `T`, the browser starts from an ATM level and adds a term component, a skew component proportional to `m - 1`, a curvature component proportional to `(m - 1)^2`, and a small deterministic adjustment for the selected shape family. Labels such as “B-spline-shaped,” “polynomial,” and “Heston-shaped” describe the browser formula; they do not mean that the page is fitting live option quotes.

Scenario paths use a seeded pseudo-random generator and stylized Heston-, GBM/FHS-, or PCA-inspired transition equations. The portfolio distribution is then computed from the selected delta, vega, gamma, vanna, hedging, and revaluation assumptions.

## What the browser does not contain

The page contains no WRDS credentials, OptionMetrics rows, quote-level data, licensed cache, or server connection. It does not reconstruct a historical OptionMetrics surface for a selected date. The backtest table is a fixed aggregate summary from the separate WRDS-based MSc thesis analysis.

## Research report

The full report, research code, configuration, and methodology are maintained in the accompanying MSc thesis repository:

`https://github.com/AAstroA/vol-surface-risk-lab`

Open `index.html` through any static HTTP server. For example:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000/Volatility-Surface-Risk-Lab/`.
