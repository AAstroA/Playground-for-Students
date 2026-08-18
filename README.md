# Playground for Students

Interactive teaching tools for finance students.

## Mean–Variance Lab

The root `index.html` is a self-contained Markowitz mean–variance simulator. It illustrates:

- risky-asset minimum-variance frontier
- efficient and inefficient branches
- global minimum-variance portfolio (GMVP / vertex)
- frontier asymptotes
- risk-free asset
- tangency portfolio
- Capital Market Line (CML)
- live target-return portfolios and portfolio weights
- the matrix constants A, B, C, and D
- interactive changes to expected returns, volatilities, correlations, and the risk-free rate

No backend or installation is required; all calculations run in the browser.

## Volatility Surface Risk Lab

The multi-tab volatility laboratory adds:

- interactive maturity × moneyness volatility surfaces
- covariance and correlation PCA factor shocks
- seeded Heston-P, Heston-Q, GBM/FHS, and PCA historical scenarios
- option-strip VaR and expected shortfall under linear and nonlinear revaluation
- aggregated 2005–2021 backtest diagnostics and model-role comparisons

The live browser calculations use illustrative data and visibly configured assumptions; licensed
WRDS observations and credentials are never published.

For GitHub Pages, serve the repository from the `main` branch/root. The intended classroom URL is:

`https://aastroa.github.io/Playground-for-Students/`
