function initDividends() {
  if (btnDivRefresh) {
    btnDivRefresh.addEventListener("click", () => {
      updateDivYearState();
      renderDividends();
    });
  }
  if (divYear) {
    divYear.addEventListener("change", () => {
      updateDivYearState();
      renderDividends();
    });
  }
}

function renderDividends() {
  if (!divTbody) return;
  
  const year = parseInt(divYear.value) || new Date().getFullYear();
  
  // 1. Group by Portfolio -> StockId -> Total Shares
  const portfolioMap = {};

  state.holdings.forEach(h => {
    const p = h.portfolio || "Uncategorized";
    if (!portfolioMap[p]) portfolioMap[p] = {};
    portfolioMap[p][h.stockId] = (portfolioMap[p][h.stockId] || 0) + safeNumber(h.shares);
  });

  const sortedPortfolios = Object.keys(portfolioMap).sort();
  let html = "";
  const monthlyIncomeTotals = Array(12).fill(0);
  let totalYearIncome = 0;

  sortedPortfolios.forEach(portfolioName => {
    // Add Portfolio Header
    html += `<tr class="table-group-header"><td colspan="15">${escapeHtml(portfolioName)}</td></tr>`;

    const stocksInPortfolio = portfolioMap[portfolioName];
    const stockIds = Object.keys(stocksInPortfolio).sort((a, b) => {
      const sA = state.stocksMaster.find(s => s.id === a);
      const sB = state.stocksMaster.find(s => s.id === b);
      const tickerA = sA ? sA.ticker : "";
      const tickerB = sB ? sB.ticker : "";
      return tickerA.localeCompare(tickerB);
    });

    stockIds.forEach(stockId => {
      const stock = state.stocksMaster.find(s => s.id === stockId);
      if (!stock) return;
      
      const shares = stocksInPortfolio[stockId];
      if (shares <= 0) return;

      if (!state.dividends[stockId]) state.dividends[stockId] = {};
      if (!state.dividends[stockId][year]) state.dividends[stockId][year] = Array(12).fill(0);
      
      const divs = state.dividends[stockId][year];
      
      let rowHtml = `<tr>
        <td>${escapeHtml(stock.ticker)}</td>
        <td class="text-end">${shares.toLocaleString()}</td>`;
        
      let stockYearTotal = 0;
      
      for (let m = 0; m < 12; m++) {
        const dps = divs[m] || 0;
        const income = dps * shares;
        monthlyIncomeTotals[m] += income;
        stockYearTotal += income;
        
        rowHtml += `
          <td class="p-1">
            <input type="number" class="form-control form-control-sm text-end border-0 bg-transparent" 
              step="0.0001" value="${dps === 0 ? '' : dps}" 
              onchange="updateDividend('${stockId}', ${year}, ${m}, this.value)"
              placeholder="-">
          </td>`;
      }
      
      totalYearIncome += stockYearTotal;
      rowHtml += `<td class="text-end fw-bold">${formatMoney(stockYearTotal)}</td></tr>`;
      html += rowHtml;
    });
  });

  divTbody.innerHTML = html || `<tr><td colspan="15" class="text-muted">No stocks with holdings found. Add holdings first.</td></tr>`;

  // Render Footer (Summary Row)
  const tfoot = document.getElementById("divTfoot");
  if (tfoot) {
    let footHtml = `<tr>
      <td class="fw-bold">Total Income</td>
      <td></td>`;
      
    for (let m = 0; m < 12; m++) {
      footHtml += `<td class="text-end fw-bold text-success" style="font-size: 0.85rem;">${formatMoney(monthlyIncomeTotals[m])}</td>`;
    }
    footHtml += `<td class="text-end fw-bold text-success">${formatMoney(totalYearIncome)}</td></tr>`;
    tfoot.innerHTML = footHtml;
  }

  // Update Chart
  renderDividendsChart(monthlyIncomeTotals);

  // Update separate totals row
  if (divMonthlyTotalsRow) {
     let totalsHtml = "";
     monthlyIncomeTotals.forEach(val => {
       totalsHtml += `<td class="text-end">${formatMoney(val)}</td>`;
     });
     totalsHtml += `<td class="text-end fw-bold">${formatMoney(totalYearIncome)}</td>`;
     divMonthlyTotalsRow.innerHTML = totalsHtml;
  }
}

function updateDivYearState() {
  const y = parseInt(divYear.value) || new Date().getFullYear();
  state.ui.divYear = y;
  saveState();
}

window.updateDividend = function(stockId, year, month, val) {
  const amount = safeNumber(val);
  if (!state.dividends[stockId]) state.dividends[stockId] = {};
  if (!state.dividends[stockId][year]) state.dividends[stockId][year] = Array(12).fill(0);
  state.dividends[stockId][year][month] = amount;
  saveState();
  renderDividends();
  refreshTopInvestmentMetrics();
}

window.renderDividendsChart = function(monthlyTotals) {
  const ctx = document.getElementById("dividendsChart")?.getContext("2d");
  if (!ctx) return;
  if (window.dividendsChartInstance) window.dividendsChartInstance.destroy();
  window.dividendsChartInstance = new Chart(ctx, { type: 'bar', data: { labels: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"], datasets: [{ label: 'Dividend Income', data: monthlyTotals, backgroundColor: '#D29F80', borderRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });
}

function computeTrailing12MDividendIncome() {
  const sel = getSelectedMonth();
  // trailing 12 months ending at selected (inclusive)
  let total = 0;
  for (let i = 0; i < 12; i++) {
    const ym = addMonthsYearMonth(sel.year, sel.month, -i);
    total += computeDividendIncomeForMonth(ym.year, ym.month);
  }
  return total;
}

function computeDividendIncomeForMonth(year, monthIdx) {
  // monthIdx: 0-11
  const sharesByStock = {};
  for (const h of state.holdings) {
    sharesByStock[h.stockId] = (sharesByStock[h.stockId] || 0) + safeNumber(h.shares);
  }

  let total = 0;
  for (const stockId of Object.keys(sharesByStock)) {
    const shares = sharesByStock[stockId] || 0;
    
    // Data structure is dividends[stockId][year][month]
    const stockDivs = state.dividends[stockId];
    const arr = stockDivs ? stockDivs[year] : [];
    const perShare = safeNumber(arr[monthIdx] || 0);
    
    total += perShare * shares;
  }
  return total;
}

function addMonthsYearMonth(year, monthIdx, deltaMonths) {
  const d = new Date(year, monthIdx, 1);
  d.setMonth(d.getMonth() + deltaMonths);
  return { year: d.getFullYear(), month: d.getMonth() };
}