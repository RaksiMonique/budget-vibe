if (!window.portfolioChartInstances) {
  window.portfolioChartInstances = {};
}

function initStocks() {
  stockMasterForm.addEventListener("submit", (e) => { e.preventDefault(); upsertStockMaster(); });
  stockMasterCancel.addEventListener("click", () => { stockMasterForm.reset(); stockMasterId.value = ""; });

  holdingForm.addEventListener("submit", (e) => { e.preventDefault(); upsertHolding(); });
  holdingCancel.addEventListener("click", () => { holdingForm.reset(); holdingId.value = ""; });
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

  // 2. Render Holdings (Grouped by Portfolio)

  // Clear old portfolio charts before re-rendering
  for (const chartId in window.portfolioChartInstances) {
    if (window.portfolioChartInstances[chartId]) {
      window.portfolioChartInstances[chartId].destroy();
    }
  }
  window.portfolioChartInstances = {};
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

  // Update datalist for portfolio input
  if (document.getElementById('portfolioList')) {
    document.getElementById('portfolioList').innerHTML = Array.from(portfolios)
      .sort()
      .map(p => `<option value="${escapeHtml(p)}">`)
      .join("");
  }

  const sortedPortfolios = Array.from(portfolios).sort();

  if (sortedPortfolios.length === 0 && holdingsContainer) {
    holdingsContainer.innerHTML = `<div class="text-muted fst-italic">No holdings added.</div>`;
  }

  sortedPortfolios.forEach(p => {
    const group = byPortfolio[p];
    const chartId = `portfolio-chart-${p.replace(/[^a-zA-Z0-9]/g, '')}`;
    
    const wrapper = document.createElement("div");
    wrapper.className = "mb-4";
    wrapper.innerHTML = `
      <h6 class="fw-bold text-uppercase text-muted mb-2">${escapeHtml(p)}</h6>
      <div class="row g-4 align-items-center">
        <div class="col-lg-8">
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
              <tbody>
                ${group.map(h => {
                  const stock = state.stocksMaster.find(s => s.id === h.stockId);
                  const ticker = stock ? stock.ticker : "???";
                  const currentPrice = stock ? safeNumber(stock.price) : 0;
                  const avgBuy = safeNumber(h.avgPrice);
                  const shares = safeNumber(h.shares);
                  const cost = avgBuy * shares;
                  const value = currentPrice * shares;
                  const gain = value - cost;
                  const gainClass = gain >= 0 ? "text-success" : "text-danger";
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
                }).join("")}
              </tbody>
            </table>
          </div>
        </div>
        <div class="col-lg-4">
          <div class="card shadow-soft">
            <div class="card-body">
              <div style="height: 250px; position: relative;">
                <canvas id="${chartId}"></canvas>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    if (holdingsContainer) holdingsContainer.appendChild(wrapper);
    renderPortfolioCompositionChart(chartId, group);
  });

  // 3. Render Chart (Total Allocation by Ticker)
  renderStocksChart();
}

function upsertStockMaster() {
  const id = stockMasterId.value?.trim();
  const ticker = stockTicker.value.trim().toUpperCase();
  const market = stockMarket.value.trim();
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
  const portfolio = holdingPortfolio.value?.trim() || "General";
  const avg = safeNumber(holdingAvgPrice.value);
  const shares = safeNumber(holdingShares.value);

  if (!stockId || shares <= 0) return;

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
  refreshAll();
}

window.editHolding = function(id) {
  const h = state.holdings.find(x => x.id === id);
  if (!h) return;
  holdingId.value = h.id;
  holdingStockId.value = h.stockId;
  holdingPortfolio.value = h.portfolio || "";
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
  const colors = labels.map((_, i) => `hsl(${i * 55 + 210}, 65%, 60%)`);

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
  const colors = labels.map((_, i) => `hsl(${i * 55 + 210}, 65%, 60%)`);

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