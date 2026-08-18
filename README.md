# Playground for Students

Interactive finance laboratories designed to make model assumptions, calculations, and limitations visible.

## Volatility Surface Risk Lab

The project began from **Alireza Moslemi Haghighi's master's-thesis work on Parametric Surface Projection (PSP)**, developed with Shiva Zamani and Hamid Arian and documented in arXiv:2311.14985. Alireza subsequently extended it into a 2005–2021 research platform with PCA, Heston models, nonlinear option repricing, and formal VaR validation.

### Public-safe browser boundary

The deployed interface uses **project-authored synthetic inputs only**. It contains no Cboe, WRDS, OptionMetrics, exchange, or other vendor observations. Changing the year window changes a transparent synthetic regime generator, surface proxy, scenarios, and teaching VaR/ES values.

Detailed WRDS/OptionMetrics-derived empirical tables and the extended report are withheld from the public build pending written confirmation of publication rights under Bocconi University's institutional agreements.

### Required WRDS acknowledgment

> Wharton Research Data Services (WRDS) was used in preparing the SPX Volatility-Surface Risk master's-thesis research and subsequent research-extension report. This service and the data available thereon constitute valuable intellectual property and trade secrets of WRDS and/or its third-party suppliers.

Acknowledgment does not itself grant publication or redistribution rights.

Live page: `https://aastroa.github.io/Playground-for-Students/Volatility-Surface-Risk-Lab/`

Research code: `https://github.com/AAstroA/vol-surface-risk-lab`

## Mean-Variance Lab

The repository also contains a self-contained Markowitz mean-variance simulator.
