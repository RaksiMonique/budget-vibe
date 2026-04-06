function initStockPlan() {
  const container = document.getElementById("stockPlanContainer");
  if (!container) return;

  container.addEventListener("change", (e) => {
    const target = e.target;
    const portfolio = target.dataset.portfolio;
    if (!portfolio) return;

    if (!state.stockPlan[portfolio]) state.stockPlan[portfolio] = { mode: 'dividend', multiplier: 1, targetValue: 0, ratios: {} };
    const settings = state.stockPlan[portfolio];

    if (target.dataset.action === "mode") {
      settings.mode = target.value;
    } else if (target.dataset.action === "multiplier") {
      settings.multiplier = safeNumber(target.value);
    } else if (target.dataset.action === "target-value") {
      settings.targetValue = safeNumber(target.value);
    } else if (target.dataset.action === "ratio") {
      const stockId = target.dataset.stockId;
      if (!settings.ratios) settings.ratios = {};
      settings.ratios[stockId] = safeNumber(target.value);
    }

    saveState();
    renderStockPlan();
  });
}

function renderStockPlan() {
  const container = document.getElementById("stockPlanContainer");
  if (!container) return;

  // Identify Portfolios from holdings
  const portfolios = new Set();
  state.holdings.forEach(h => portfolios.add(h.portfolio || "Uncategorized"));
  const sortedPortfolios = Array.from(portfolios).sort();

  if (sortedPortfolios.length === 0) {
    container.innerHTML = `<div class="text-muted fst-italic">No portfolios found. Add holdings in the Stocks tab first.</div>`;
    return;
  }

  container.innerHTML = sortedPortfolios.map(portfolio => renderPortfolioPlan(portfolio)).join("");
}

function renderPortfolioPlan(portfolio) {
  // Ensure settings exist
  if (!state.stockPlan) state.stockPlan = {};
  if (!state.stockPlan[portfolio]) state.stockPlan[portfolio] = { mode: 'dividend', multiplier: 1, targetValue: 0, ratios: {} };
  const settings = state.stockPlan[portfolio];

  const isDividend = settings.mode === 'dividend';

  // Get holdings for this portfolio
  const holdings = state.holdings.filter(h => (h.portfolio || "Uncategorized") === portfolio);
  // Unique stocks in this portfolio
  const stockIds = [...new Set(holdings.map(h => h.stockId))];

  // Calculate rows
  const rows = stockIds.map(stockId => {
    const stock = state.stocksMaster.find(s => s.id === stockId);
    if (!stock) return null;
    
    const currentShares = holdings
      .filter(h => h.stockId === stockId)
      .reduce((sum, h) => sum + safeNumber(h.shares), 0);

    const price = safeNumber(stock.price);
    const currentVal = currentShares * price;

    if (isDividend) {
       // Dividend Logic
       const ttmDivPerShare = computeTTMDivPerShare(stockId);
       const yieldVal = price > 0 ? ttmDivPerShare / price : 0; // Decimal
       // Formula: (Yield * 100 / Price) * Multiplier
       // Yield * 100 is Percentage (e.g. 0.04 * 100 = 4)
       const score = price > 0 ? ((yieldVal * 100) / price) * safeNumber(settings.multiplier) : 0;
       const toBuy = Math.floor(score);
       
       return {
         ticker: stock.ticker,
         price,
         ttmDiv: ttmDivPerShare,
         yieldPct: yieldVal * 100,
         toBuy
       };
    } else {
       // Ratio Logic
       const ratio = safeNumber(settings.ratios[stockId] || 0); // Percentage 0-100
       const targetVal = safeNumber(settings.targetValue) * (ratio / 100);
       const targetShares = price > 0 ? Math.floor(targetVal / price) : 0;
       const diff = targetShares - currentShares;
       
       return {
         ticker: stock.ticker,
         price,
         currentShares,
         currentVal,
         ratio,
         targetVal,
         diff,
         stockId
       };
    }
  }).filter(r => r !== null);

  // Build HTML
  let controlsHtml = "";
  let tableHtml = "";

  if (isDividend) {
    controlsHtml = `
      <div class="col-auto">
        <label class="form-label small fw-bold">Multiplier</label>
        <input type="number" class="form-control form-control-sm" value="${settings.multiplier}" data-portfolio="${escapeHtml(portfolio)}" data-action="multiplier" step="0.1" style="width: 100px;">
      </div>
    `;
    tableHtml = `
      <thead><tr><th>Ticker</th><th class="text-end">Price</th><th class="text-end">TTM Div/Share</th><th class="text-end">Yield %</th><th class="text-end">Rec. Buy</th></tr></thead>
      <tbody>
        ${rows.map(r => `<tr><td>${escapeHtml(r.ticker)}</td><td class="text-end">${formatMoney(r.price)}</td><td class="text-end">${formatMoney(r.ttmDiv)}</td><td class="text-end">${r.yieldPct.toFixed(2)}%</td><td class="text-end fw-bold text-success">${r.toBuy}</td></tr>`).join("")}
      </tbody>
    `;
  } else {
    controlsHtml = `
      <div class="col-auto">
        <label class="form-label small fw-bold">Target Portfolio Value</label>
        <div class="input-group input-group-sm">
          <span class="input-group-text">$</span>
          <input type="number" class="form-control" value="${settings.targetValue}" data-portfolio="${escapeHtml(portfolio)}" data-action="target-value" step="100" style="width: 120px;">
        </div>
      </div>
    `;
    tableHtml = `
      <thead><tr><th>Ticker</th><th class="text-end">Price</th><th class="text-end">Current Val</th><th class="text-end" style="width:120px;">Target %</th><th class="text-end">Target Val</th><th class="text-end">Rec. Buy/Sell</th></tr></thead>
      <tbody>
        ${rows.map(r => `<tr><td>${escapeHtml(r.ticker)}</td><td class="text-end">${formatMoney(r.price)}</td><td class="text-end">${formatMoney(r.currentVal)}</td><td class="text-end"><div class="input-group input-group-sm"><input type="number" class="form-control text-end" value="${r.ratio}" data-portfolio="${escapeHtml(portfolio)}" data-action="ratio" data-stock-id="${r.stockId}" step="1"><span class="input-group-text">%</span></div></td><td class="text-end">${formatMoney(r.targetVal)}</td><td class="text-end fw-bold ${r.diff >= 0 ? 'text-success' : 'text-danger'}">${r.diff > 0 ? '+' : ''}${r.diff}</td></tr>`).join("")}
      </tbody>
    `;
  }

  return `
    <div class="card shadow-soft mb-4">
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h6 class="mb-0 text-uppercase text-muted fw-bold">${escapeHtml(portfolio)}</h6>
          <div class="btn-group btn-group-sm" role="group">
            <input type="radio" class="btn-check" name="mode-${escapeHtml(portfolio)}" id="mode-div-${escapeHtml(portfolio)}" value="dividend" ${isDividend ? 'checked' : ''} data-portfolio="${escapeHtml(portfolio)}" data-action="mode">
            <label class="btn btn-outline-secondary" for="mode-div-${escapeHtml(portfolio)}">Dividend Plan</label>
            <input type="radio" class="btn-check" name="mode-${escapeHtml(portfolio)}" id="mode-ratio-${escapeHtml(portfolio)}" value="ratio" ${!isDividend ? 'checked' : ''} data-portfolio="${escapeHtml(portfolio)}" data-action="mode">
            <label class="btn btn-outline-secondary" for="mode-ratio-${escapeHtml(portfolio)}">Ratio Plan</label>
          </div>
        </div>
        <div class="row g-3 align-items-end mb-3">${controlsHtml}</div>
        <div class="table-responsive">
          <table class="table table-sm align-middle table-soft mb-0">
            ${tableHtml}
          </table>
        </div>
      </div>
    </div>
  `;
}

function computeTTMDivPerShare(stockId) {
  const now = new Date();
  let total = 0;
  // Sum dividends for the last 12 months (inclusive of current month)
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    
    const stockData = state.dividends[stockId];
    if (stockData && stockData[y]) {
        total += safeNumber(stockData[y][m]);
    }
  }
  return total;
}