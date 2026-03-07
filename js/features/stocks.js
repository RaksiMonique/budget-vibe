let stocksChart = null;

function initStocks() {
  stockMasterForm.addEventListener("submit", (e) => { e.preventDefault(); upsertStockMaster(); });
  stockMasterCancel.addEventListener("click", () => resetStockMasterForm());

  holdingForm.addEventListener("submit", (e) => { e.preventDefault(); upsertHolding(); });
  holdingCancel.addEventListener("click", () => resetHoldingForm());
}

function renderStocks() {
  if (!stocksMasterTbody || !holdingsTbody) return;

  const masters = state.stocksMaster.slice().sort((a,b) => a.ticker.localeCompare(b.ticker));
  stocksMasterTbody.innerHTML = masters.map(s => `
    <tr>
      <td>${escapeHtml(s.ticker)}</td>
      <td>${escapeHtml(s.market)}</td>
      <td class="text-end">${formatNumber(s.currentPrice)}</td>
      <td>
        <div class="d-flex gap-2">
          <button class="btn btn-sm btn-outline-secondary" onclick="editStockMaster('${s.id}')">Edit</button>
          <button class="btn btn-sm btn-outline-danger" onclick="deleteStockMaster('${s.id}')">Delete</button>
        </div>
      </td>
    </tr>
  `).join("") || `<tr><td colspan="4" class="text-muted">No stocks added yet.</td></tr>`;

  const options = masters.map(s => `<option value="${s.id}">${escapeHtml(s.ticker)} (${escapeHtml(s.market)})</option>`).join("");
  holdingStockId.innerHTML = options || `<option value="" disabled selected>Add stocks in the master list first</option>`;

  const holdings = state.holdings.slice().sort((a,b) => {
    const sa = getStockMaster(a.stockId)?.ticker || "";
    const sb = getStockMaster(b.stockId)?.ticker || "";
    return sa.localeCompare(sb);
  });

  holdingsTbody.innerHTML = holdings.map(h => {
    const s = getStockMaster(h.stockId);
    const ticker = s ? s.ticker : "—";
    const curr = s ? safeNumber(s.currentPrice) : 0;
    const avg = safeNumber(h.avgBuyPrice);
    const shares = safeNumber(h.shares);

    const cost = avg * shares;
    const value = curr * shares;
    const gl = value - cost;

    return `
      <tr>
        <td>${escapeHtml(ticker)}</td>
        <td class="text-end">${formatNumber(avg)}</td>
        <td class="text-end">${formatNumber(shares)}</td>
        <td class="text-end">${formatMoney(cost)}</td>
        <td class="text-end">${formatMoney(value)}</td>
        <td class="text-end ${gl < 0 ? "text-danger" : "text-success"}">${formatMoney(gl)}</td>
        <td>
          <div class="d-flex gap-2">
            <button class="btn btn-sm btn-outline-secondary" onclick="editHolding('${h.id}')">Edit</button>
            <button class="btn btn-sm btn-outline-danger" onclick="deleteHolding('${h.id}')">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join("") || `<tr><td colspan="7" class="text-muted">No holdings yet.</td></tr>`;

  renderStocksChart();
}

function upsertStockMaster() {
  const id = stockMasterId.value?.trim();
  const ticker = stockTicker.value.trim().toUpperCase();
  const market = stockMarket.value.trim();
  const price = safeNumber(stockPrice.value);

  if (!ticker || !market || !isFinite(price) || price < 0) return;

  const dupe = state.stocksMaster.find(s => s.ticker === ticker && s.market.toLowerCase() === market.toLowerCase() && s.id !== id);
  if (dupe) { showToast("That ticker/market already exists."); return; }

  if (id) {
    const s = state.stocksMaster.find(x => x.id === id);
    if (!s) return;
    s.ticker = ticker;
    s.market = market;
    s.currentPrice = price;
    s.updatedAt = new Date().toISOString();
    showToast("Stock updated.");
  } else {
    state.stocksMaster.push({
      id: uid(),
      ticker,
      market,
      currentPrice: price,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    showToast("Stock added.");
  }

  saveState();
  resetStockMasterForm();
  renderStocks();
  renderDividends();
  refreshTopInvestmentMetrics();
}

function resetStockMasterForm() {
  stockMasterId.value = "";
  stockTicker.value = "";
  stockMarket.value = "";
  stockPrice.value = "";
}

window.editStockMaster = function(id) {
  const s = state.stocksMaster.find(x => x.id === id);
  if (!s) return;
  stockMasterId.value = s.id;
  stockTicker.value = s.ticker;
  stockMarket.value = s.market;
  stockPrice.value = String(s.currentPrice);
};

function deleteStockMaster(id) {
  const s = state.stocksMaster.find(x => x.id === id);
  if (!s) return;

  showConfirmationModal(`Delete stock ${s.ticker} (${s.market})?`, () => {
    const usedInHoldings = state.holdings.some(h => h.stockId === id);
    if (usedInHoldings) {
      alert("Cannot delete: this stock is linked to holdings. Delete holdings first.");
      return;
    }

    state.stocksMaster = state.stocksMaster.filter(x => x.id !== id);
    for (const y of Object.keys(state.dividends || {})) {
      if (state.dividends[y] && state.dividends[y][id]) delete state.dividends[y][id];
    }
    saveState();
    showToast("Stock deleted.");
    resetStockMasterForm();
    renderStocks();
    renderDividends();
    refreshTopInvestmentMetrics();
  });
}

function upsertHolding() {
  const id = holdingId.value?.trim();
  const stockId = holdingStockId.value;
  const avg = safeNumber(holdingAvgPrice.value);
  const shares = safeNumber(holdingShares.value);

  if (!stockId || !isFinite(avg) || avg < 0 || !isFinite(shares) || shares <= 0) return;

  if (id) {
    const h = state.holdings.find(x => x.id === id);
    if (!h) return;
    h.stockId = stockId;
    h.avgBuyPrice = avg;
    h.shares = shares;
    h.updatedAt = new Date().toISOString();
    showToast("Holding updated.");
  } else {
    state.holdings.push({
      id: uid(),
      stockId,
      avgBuyPrice: avg,
      shares,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    showToast("Holding added.");
  }

  saveState();
  resetHoldingForm();
  renderStocks();
  renderDividends();
  refreshTopInvestmentMetrics();
}

function resetHoldingForm() {
  holdingId.value = "";
  holdingAvgPrice.value = "";
  holdingShares.value = "";
}

window.editHolding = function(id) {
  const h = state.holdings.find(x => x.id === id);
  if (!h) return;
  holdingId.value = h.id;
  holdingStockId.value = h.stockId;
  holdingAvgPrice.value = String(h.avgBuyPrice);
  holdingShares.value = String(h.shares);
};

function deleteHolding(id) {
  const h = state.holdings.find(x => x.id === id);
  if (!h) return;
  showConfirmationModal("Delete this holding?", () => {
    state.holdings = state.holdings.filter(x => x.id !== id);
    saveState();
    showToast("Holding deleted.");
    resetHoldingForm();
    renderStocks();
    renderDividends();
    refreshTopInvestmentMetrics();
  });
}

function getStockMaster(id) {
  return state.stocksMaster.find(s => s.id === id) || null;
}

function computeTotalStockValue() {
  let total = 0;
  for (const h of state.holdings) {
    const s = getStockMaster(h.stockId);
    const curr = s ? safeNumber(s.currentPrice) : 0;
    const shares = safeNumber(h.shares);
    total += curr * shares;
  }
  return total;
}

function renderStocksChart() {
  const ctx = document.getElementById("stocksChart")?.getContext("2d");
  if (!ctx) return;

  // Aggregate value by stock
  const valueByStock = {};
  for (const h of state.holdings) {
    const s = getStockMaster(h.stockId);
    if (!s) continue;
    const val = safeNumber(h.shares) * safeNumber(s.currentPrice);
    valueByStock[s.ticker] = (valueByStock[s.ticker] || 0) + val;
  }

  const labels = Object.keys(valueByStock);
  const data = Object.values(valueByStock);
  // Simple palette generator
  const colors = labels.map((_, i) => `hsl(${ (i * 360) / labels.length }, 40%, 60%)`);

  if (stocksChart) {
    stocksChart.data.labels = labels;
    stocksChart.data.datasets[0].data = data;
    stocksChart.data.datasets[0].backgroundColor = colors;
    stocksChart.update();
  } else {
    stocksChart = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: colors,
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "right" } }
      }
    });
  }
}