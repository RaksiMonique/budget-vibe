const STOCK_THEME_COLORS = [
  // Existing colors

  "#69856D", // Sage
  "#D29F80", // Sand
  "#C27250", // Clay
  "#A4747D", // Mauve
  "#735557", // Plum Soft
  "#97866A", // Tan
  "#B6C1B1", // Sage Light
  "#604653", // Plum
  "#B25C5A", // Rose
  "#D3E3EB", // Ice
];

const STOCK_MARKETS = [
  "NASDAQ", "NYSE", "LSE", "TSE", "ASX", "XETRA", "SIX", "HKEX", "SGX", "BSE", "NSE"
];

if (!window.portfolioChartInstances) {
  window.portfolioChartInstances = {};
}

function initStocks() {
  stockMasterForm.addEventListener("submit", (e) => { e.preventDefault(); upsertStockMaster(); });
  stockMasterCancel.addEventListener("click", () => { stockMasterForm.reset(); stockMasterId.value = ""; });

  holdingForm.addEventListener("submit", (e) => { e.preventDefault(); upsertHolding(); });
  holdingCancel.addEventListener("click", () => {
    holdingForm.reset();
    holdingId.value = "";
    holdingNewPortfolioWrap.style.display = 'none';
    holdingNewPortfolioName.value = '';
  });

  holdingPortfolio.addEventListener("change", toggleNewPortfolioInput);
  btnSaveNewHoldingPortfolio.addEventListener("click", saveNewPortfolio);
}

function repopulatePortfolioOptions() {
  const portfolios = new Set((state.holdings || []).map(h => h.portfolio).filter(p => p));
  const sortedPortfolios = Array.from(portfolios).sort((a,b) => a.localeCompare(b));

  const optionsHtml = sortedPortfolios.map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join("");
  const addNewOption = `<option value="--new--">-- Add New Portfolio --</option>`;
  
  let finalOptions = optionsHtml;
  if (!portfolios.has("General")) {
    finalOptions = `<option value="General">General</option>` + finalOptions;
  }

  holdingPortfolio.innerHTML = addNewOption + finalOptions;

  // If adding a new holding, default to "Add New Portfolio"
  if (!holdingId.value) {
    holdingPortfolio.value = "--new--";
    toggleNewPortfolioInput();
  }
}

function toggleNewPortfolioInput() {
  if (holdingPortfolio.value === '--new--') {
    holdingNewPortfolioWrap.style.display = 'block';
    holdingNewPortfolioName.focus();
  } else {
    holdingNewPortfolioWrap.style.display = 'none';
  }
}

function saveNewPortfolio() {
  const newName = holdingNewPortfolioName.value.trim();
  if (!newName) {
    showToast("Please enter a portfolio name.");
    return;
  }

  const existingOptions = Array.from(holdingPortfolio.options).map(opt => opt.value);
  if (existingOptions.some(opt => opt.toLowerCase() === newName.toLowerCase() && opt !== '--new--')) {
    showToast("That portfolio already exists in the list.");
    const existingValue = existingOptions.find(opt => opt.toLowerCase() === newName.toLowerCase());
    holdingPortfolio.value = existingValue;
    toggleNewPortfolioInput();
    return;
  }

  const newOption = new Option(escapeHtml(newName), newName, false, true);
  holdingPortfolio.add(newOption);
  holdingPortfolio.value = newName;

  holdingNewPortfolioName.value = '';
  toggleNewPortfolioInput();
  showToast("New portfolio selected. It will be saved with the holding.");
}

function renderStocks() {
  // 1. Render Master List
  const masterList = state.stocksMaster.slice().sort((a,b) => a.ticker.localeCompare(b.ticker));
  stocksMasterTbody.innerHTML = masterList.map(s => `
    <tr>
      <td><span class="fw-bold">${escapeHtml(s.ticker)}</span></td>
      <td>${escapeHtml(s.market)}</td>
      <td class="text-end">${formatMoney(s.price)}</td>
      <td>
        <div class="d-flex gap-2">
          <button class="btn btn-sm btn-outline-secondary" onclick="editStockMaster('${s.id}')">Edit</button>
          <button class="btn btn-sm btn-outline-danger" onclick="deleteStockMaster('${s.id}')">Delete</button>
        </div>
      </td>
    </tr>
  `).join("") || `<tr><td colspan="4" class="text-muted">No stocks in master list.</td></tr>`;

  // Also populate the holdings dropdown
  if (holdingStockId) {
    holdingStockId.innerHTML = masterList.map(s => `<option value="${s.id}">${escapeHtml(s.ticker)}</option>`).join("") || `<option value="" disabled>Add a stock to master list first</option>`;
  }

  // Populate the stockMarket dropdown
  const stockMarketSelect = document.getElementById('stockMarket');
  if (stockMarketSelect) {
    stockMarketSelect.innerHTML = `<option value="">Select Market</option>` + STOCK_MARKETS.map(market => `<option value="${escapeHtml(market)}">${escapeHtml(market)}</option>`).join("");
  }

  repopulatePortfolioOptions();

  // 2. Render Holdings (Grouped by Portfolio)

  // Clear old portfolio charts before re-rendering
  for (const chartId in window.portfolioChartInstances) {
    if (window.portfolioChartInstances[chartId]) {
      window.portfolioChartInstances[chartId].destroy();
    }
  }
  window.portfolioChartInstances = {};
  const portfolioChartsContainer = document.getElementById("portfolioChartsContainer");
  if (portfolioChartsContainer) portfolioChartsContainer.innerHTML = "";

  if (holdingsContainer) holdingsContainer.innerHTML = "";

  const holdings = state.holdings.slice();
  const byPortfolio = {};
  const portfolios = new Set();

  holdings.forEach(h => {
    const p = h.portfolio || "Uncategorized";
    if (!byPortfolio[p]) byPortfolio[p] = [];
    byPortfolio[p].push(h);
    portfolios.add(p);
  });

  const sortedPortfolios = Array.from(portfolios).sort();

  if (sortedPortfolios.length === 0 && holdingsContainer) {
    holdingsContainer.innerHTML = `<div class="text-muted fst-italic">No holdings added.</div>`;
  }

  sortedPortfolios.forEach(p => {
    const group = byPortfolio[p];
    let portfolioTotalValue = 0;
    let portfolioTotalCost = 0;

    const tableBodyHtml = group.map(h => {
      const stock = state.stocksMaster.find(s => s.id === h.stockId);
      const ticker = stock ? stock.ticker : "???";
      const currentPrice = stock ? safeNumber(stock.price) : 0;
      const avgBuy = safeNumber(h.avgPrice);
      const shares = safeNumber(h.shares);
      const cost = avgBuy * shares;
      const value = currentPrice * shares;
      const gain = value - cost;
      const gainClass = gain >= 0 ? "text-success" : "text-danger";

      portfolioTotalValue += value;
      portfolioTotalCost += cost;

      return `
        <tr>
          <td>${escapeHtml(ticker)}</td>
          <td class="text-end">${formatMoney(avgBuy)}</td>
          <td class="text-end">${shares}</td>
          <td class="text-end">${formatMoney(cost)}</td>
          <td class="text-end fw-bold">${formatMoney(value)}</td>
          <td class="text-end ${gainClass}">${formatMoney(gain)}</td>
          <td>
            <div class="d-flex gap-2">
              <button class="btn btn-sm btn-outline-secondary" onclick="editHolding('${h.id}')">Edit</button>
              <button class="btn btn-sm btn-outline-danger" onclick="deleteHolding('${h.id}')">Delete</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");

    const portfolioTotalGain = portfolioTotalValue - portfolioTotalCost;
    const portfolioGainClass = portfolioTotalGain >= 0 ? "text-success" : "text-danger";
    const chartId = `portfolio-chart-${p.replace(/[^a-zA-Z0-9]/g, '')}`;

    // 1. Create and append TABLE to holdingsContainer (right column)
    const tableWrapper = document.createElement("div");
    tableWrapper.className = "mb-4";
    tableWrapper.innerHTML = `
      <h6 class="fw-bold text-uppercase text-muted mb-2">${escapeHtml(p)}</h6>
      <div class="table-responsive">
        <table class="table table-sm align-middle table-soft mb-0">
          <thead>
            <tr>
              <th>Ticker</th>
              <th class="text-end">Avg Buy</th>
              <th class="text-end">Shares</th>
              <th class="text-end">Cost</th>
              <th class="text-end">Value</th>
              <th class="text-end">Gain/Loss</th>
              <th style="width: 20%">Actions</th>
            </tr>
          </thead>
          <tbody>${tableBodyHtml}</tbody>
          <tfoot>
            <tr class="fw-bold">
              <td colspan="3" class="text-end border-top">Portfolio Totals:</td>
              <td class="text-end border-top">${formatMoney(portfolioTotalCost)}</td>
              <td class="text-end border-top">${formatMoney(portfolioTotalValue)}</td>
              <td class="text-end border-top ${portfolioGainClass}">${formatMoney(portfolioTotalGain)}</td>
              <td class="border-top"></td>
            </tr>
          </tfoot>
        </table>
      </div>`;
    if (holdingsContainer) holdingsContainer.appendChild(tableWrapper);

    // 2. Create and append CHART to portfolioChartsContainer (left column)
    const chartWrapper = document.createElement("div");
    chartWrapper.className = "card shadow-soft mb-4";
    chartWrapper.innerHTML = `
      <div class="card-body">
        <h6 class="card-title text-center mb-3">Allocation: ${escapeHtml(p)}</h6>
        <div style="height: 250px; position: relative;">
          <canvas id="${chartId}"></canvas>
        </div>
      </div>`;
    if (portfolioChartsContainer) portfolioChartsContainer.appendChild(chartWrapper);

    renderPortfolioCompositionChart(chartId, group);
  });

  // 3. Render Chart (Total Allocation by Ticker)
  renderStocksChart();
}

function upsertStockMaster() {
  const id = stockMasterId.value?.trim();
  const ticker = stockTicker.value.trim().toUpperCase();
  const market = stockMarket.value; // Get value from select dropdown
  const price = safeNumber(stockPrice.value);

  if (!ticker || !market || !isFinite(price) || price < 0) {
    showToast("Please fill all stock fields with valid values.");
    return;
  }

  if (id) {
    const s = state.stocksMaster.find(x => x.id === id);
    if (s) {
      s.ticker = ticker;
      s.market = market;
      s.price = price;
      showToast("Stock updated.");
    }
  } else {
    const dupe = state.stocksMaster.find(s => s.ticker === ticker);
    if (dupe) {
      showToast("A stock with this ticker already exists.");
      return;
    }
    state.stocksMaster.push({ id: uid(), ticker, market, price, createdAt: new Date().toISOString() });
    showToast("Stock added to master list.");
  }

  saveState();
  stockMasterForm.reset();
  stockMasterId.value = "";
  refreshAll();
}

window.editStockMaster = function(id) {
  const s = state.stocksMaster.find(x => x.id === id);
  if (!s) return;
  stockMasterId.value = s.id;
  stockTicker.value = s.ticker;
  stockMarket.value = s.market;
  stockPrice.value = s.price;
};

window.deleteStockMaster = function(id) {
  const s = state.stocksMaster.find(x => x.id === id);
  if (!s) return;

  if (state.holdings.some(h => h.stockId === id)) {
    alert("Cannot delete stock: referenced by holdings.");
    return;
  }
  if(!confirm("Delete this stock?")) return;
  state.stocksMaster = state.stocksMaster.filter(x => x.id !== id);
  saveState();
  refreshAll();
}

window.upsertHolding = function() {
  const id = holdingId.value?.trim();
  const stockId = holdingStockId.value;
  let portfolio = holdingPortfolio.value?.trim();
  const avg = safeNumber(holdingAvgPrice.value);
  const shares = safeNumber(holdingShares.value);

  if (portfolio === '--new--') {
    showToast("Please save the new portfolio name first.");
    return;
  }
  if (!portfolio) portfolio = "General";

  if (!stockId || !isFinite(shares) || shares <= 0) return;

  if (id) {
    const h = state.holdings.find(x => x.id === id);
    if (h) {
      h.stockId = stockId;
      h.portfolio = portfolio;
      h.avgPrice = avg;
      h.shares = shares;
      showToast("Holding updated.");
    }
  } else {
    state.holdings.push({
      id: uid(),
      stockId,
      portfolio,
      avgPrice: avg,
      shares,
      createdAt: new Date().toISOString()
    });
    showToast("Holding added.");
  }

  saveState();
  holdingForm.reset();
  holdingId.value = "";
  holdingNewPortfolioWrap.style.display = 'none';
  holdingNewPortfolioName.value = '';
  refreshAll();
}

window.editHolding = function(id) {
  const h = state.holdings.find(x => x.id === id);
  if (!h) return;
  holdingId.value = h.id;
  holdingStockId.value = h.stockId;
  repopulatePortfolioOptions();
  holdingPortfolio.value = h.portfolio || "General";
  toggleNewPortfolioInput();
  holdingAvgPrice.value = h.avgPrice;
  holdingShares.value = h.shares;
};

window.deleteHolding = function(id) {
  if(!confirm("Delete this holding?")) return;
  state.holdings = state.holdings.filter(x => x.id !== id);
  saveState();
  refreshAll();
}

function computeTotalStockValue() {
  let total = 0;
  for (const h of state.holdings) {
    const s = state.stocksMaster.find(x => x.id === h.stockId);
    const curr = s ? safeNumber(s.price) : 0;
    const shares = safeNumber(h.shares);
    total += curr * shares;
  }
  return total;
}

function renderPortfolioCompositionChart(canvasId, holdingsInPortfolio) {
  const ctx = document.getElementById(canvasId)?.getContext("2d");
  if (!ctx) return;

  const valueByStock = {};
  holdingsInPortfolio.forEach(h => {
    const stock = state.stocksMaster.find(s => s.id === h.stockId);
    if (stock) {
      const ticker = stock.ticker;
      const val = safeNumber(stock.price) * safeNumber(h.shares);
      valueByStock[ticker] = (valueByStock[ticker] || 0) + val;
    }
  });

  const labels = Object.keys(valueByStock);
  const data = Object.values(valueByStock);
  const totalValue = data.reduce((a, b) => a + b, 0);
  const colors = labels.map((_, i) => STOCK_THEME_COLORS[i % STOCK_THEME_COLORS.length]);

  if (window.portfolioChartInstances[canvasId]) {
    window.portfolioChartInstances[canvasId].destroy();
  }

  window.portfolioChartInstances[canvasId] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data, backgroundColor: colors, borderWidth: 0 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { padding: 10, boxWidth: 12 }
        },
        tooltip: {
          callbacks: {
            label: (context) => `${context.label}: ${formatMoney(context.parsed)} (${totalValue > 0 ? ((context.parsed / totalValue) * 100).toFixed(1) : 0}%)`
          }
        }
      }
    }
  });
}

function renderStocksChart() {
  const ctx = document.getElementById("stocksChart")?.getContext("2d");
  if (!ctx) return;

  const valueByPortfolio = {};
  state.holdings.forEach(h => {
    const s = state.stocksMaster.find(x => x.id === h.stockId);
    if (s) {
      const portfolioName = h.portfolio || "Uncategorized";
      const val = safeNumber(s.price) * safeNumber(h.shares);
      valueByPortfolio[portfolioName] = (valueByPortfolio[portfolioName] || 0) + val;
    }
  });

  const labels = Object.keys(valueByPortfolio);
  const data = Object.values(valueByPortfolio);
  const colors = labels.map((_, i) => STOCK_THEME_COLORS[i % STOCK_THEME_COLORS.length]);

  if (window.stocksChartInstance) {
    window.stocksChartInstance.destroy();
  }

  window.stocksChartInstance = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels,
        datasets: [{ data, backgroundColor: colors, borderWidth: 0 }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom" },
        tooltip: {
          callbacks: {
            label: (context) => `${context.label}: ${formatMoney(context.parsed)}`,
          },
        },
      },
    },
  });
}