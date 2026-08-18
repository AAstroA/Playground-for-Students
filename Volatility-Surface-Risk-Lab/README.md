# Volatility Surface Risk Lab

Static, browser-based teaching interface for volatility-surface reconstruction, PCA shocks,
Heston/GBM scenarios, option-portfolio VaR and expected shortfall, and empirical backtest results.

The live surface and simulation outputs are illustrative calculations driven by visible controls.
The validation table contains aggregated 2005–2021 results from the accompanying research project.
No WRDS credentials, licensed observations, backend, build step, or external JavaScript dependency is
required.

Open `index.html` through any static HTTP server. For example:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000/Volatility-Surface-Risk-Lab/`.
