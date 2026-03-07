let dividendsChart = null;

function initDividends() {
  divYear.addEventListener("change", () => {
    state.ui.divYear = clampInt(divYear.value, 2000, 2100, new Date().getFullYear());
    divYear.value = String(state.ui.divYear);
    saveState();
    renderDividends();
    refreshTopInvestmentMetrics(); // keep top in sync
  });
  btnDivRefresh.addEventListener("click", () => { renderDividends(); refreshTopInvestmentMetrics(); });
}

function renderDividends() {
  if (!divTbody || !divMonthlyTotalsRow) return;

  const year = clampInt(divYear.value, 2000, 2100, new Date().getFullYear());
  divYear.value = String(year);
  state.ui.divYear = year;
  saveState();

  ensureDivYear(year);

  const sharesByStock = {};
  for (const h of state.holdings) {
    sharesByStock[h.stockId] = (sharesByStock[h.stockId] || 0) + safeNumber(h.shares);
  }

  const stockIds = Object.keys(sharesByStock).sort((a,b) => {
    const ta = (getStockMaster(a)?.ticker || "");
    const tb = (getStockMaster(b)?.ticker || "");
    return ta.localeCompare(tb);
  });

  if (stockIds.length === 0) {
    divTbody.innerHTML = `<tr><td colspan="15" class="text-muted">No holdings yet. Add holdings in the Stocks tab.</td></tr>`;
    divMonthlyTotalsRow.innerHTML = `<td class="text-muted" colspan="13">—</td>`;
    return;
  }

  divTbody.innerHTML = stockIds.map(stockId => {
    const s = getStockMaster(stockId);
    const ticker = s ? `${s.ticker}` : "—";
    const shares = sharesByStock[stockId] || 0;

    const arr = getDivArray(year, stockId);
    const perShareYearTotal = arr.reduce((a,b) => a + safeNumber(b), 0);
    const yearIncome = perShareYearTotal * shares;

    const inputs = arr.map((val, idx) => {
      const v = safeNumber(val);
      return `
        <td class="text-end">
          <input
            class="form-control form-control-sm text-end"
            style="min-width:80px;"
            data-div-year="${year}"
            data-div-stock="${stockId}"
            data-div-month="${idx}"
            value="${v ? String(v) : ""}"
            placeholder="0"
          >
        </td>
      `;
    }).join("");

    return `
      <tr>
        <td>${escapeHtml(ticker)}</td>
        <td class="text-end">${formatNumber(shares)}</td>
        ${inputs}
        <td class="text-end fw-semibold">${formatMoney(yearIncome)}</td>
      </tr>
    `;
  }).join("");

  divTbody.querySelectorAll("input[data-div-year]").forEach(inp => {
    inp.addEventListener("input", (e) => {
      const el = e.target;
      const y = parseInt(el.dataset.divYear, 10);
      const stockId = el.dataset.divStock;
      const m = parseInt(el.dataset.divMonth, 10);
      const v = safeNumber(el.value);

      setDivValue(y, stockId, m, v);
      saveState();
      renderDividendsTotalsOnly();
      refreshTopInvestmentMetrics();
    });
  });

  renderDividendsTotalsOnly();
  refreshTopInvestmentMetrics();
  renderDividendsChart();
}

function ensureDivYear(year) {
  if (!state.dividends[year]) state.dividends[year] = {};
}

function getDivArray(year, stockId) {
  ensureDivYear(year);
  if (!state.dividends[year][stockId]) state.dividends[year][stockId] = Array(12).fill(0);
  if (!Array.isArray(state.dividends[year][stockId]) || state.dividends[year][stockId].length !== 12) {
    const old = Array.isArray(state.dividends[year][stockId]) ? state.dividends[year][stockId] : [];
    const next = Array(12).fill(0);
    for (let i = 0; i < Math.min(12, old.length); i++) next[i] = safeNumber(old[i]);
    state.dividends[year][stockId] = next;
  }
  return state.dividends[year][stockId];
}

function setDivValue(year, stockId, monthIdx, value) {
  const arr = getDivArray(year, stockId);
  arr[monthIdx] = safeNumber(value);
  state.dividends[year][stockId] = arr;
}

function renderDividendsTotalsOnly() {
  const year = clampInt(divYear.value, 2000, 2100, new Date().getFullYear());
  ensureDivYear(year);

  const sharesByStock = {};
  for (const h of state.holdings) {
    sharesByStock[h.stockId] = (sharesByStock[h.stockId] || 0) + safeNumber(h.shares);
  }
  const stockIds = Object.keys(sharesByStock);

  const monthlyIncome = Array(12).fill(0);
  for (const stockId of stockIds) {
    const shares = sharesByStock[stockId] || 0;
    const arr = getDivArray(year, stockId);
    for (let m = 0; m < 12; m++) {
      monthlyIncome[m] += safeNumber(arr[m]) * shares;
    }
  }

  const yearTotal = monthlyIncome.reduce((a,b) => a + b, 0);

  divMonthlyTotalsRow.innerHTML =
    monthlyIncome.map(v => `<td>${formatMoney(v)}</td>`).join("") +
    `<td class="text-end fw-semibold">${formatMoney(yearTotal)}</td>`;
}

function renderDividendsChart() {
  const ctx = document.getElementById("dividendsChart")?.getContext("2d");
  if (!ctx) return;

  const year = clampInt(divYear.value, 2000, 2100, new Date().getFullYear());
  ensureDivYear(year);

  // Calculate monthly totals
  const monthlyIncome = Array(12).fill(0);
  for (const h of state.holdings) {
    const arr = getDivArray(year, h.stockId);
    const shares = safeNumber(h.shares);
    for (let i = 0; i < 12; i++) {
      monthlyIncome[i] += safeNumber(arr[i]) * shares;
    }
  }

  if (dividendsChart) {
    dividendsChart.data.datasets[0].data = monthlyIncome;
    dividendsChart.update();
  } else {
    dividendsChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: MONTHS,
        datasets: [{
          label: "Dividend Income",
          data: monthlyIncome,
          backgroundColor: "#7EAD86", // Sage color
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { beginAtZero: true } }
      }
    });
  }
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
  ensureDivYear(year);

  // shares per stock
  const sharesByStock = {};
  for (const h of state.holdings) {
    sharesByStock[h.stockId] = (sharesByStock[h.stockId] || 0) + safeNumber(h.shares);
  }

  let total = 0;
  for (const stockId of Object.keys(sharesByStock)) {
    const shares = sharesByStock[stockId] || 0;
    const arr = getDivArray(year, stockId); // 12 per-share values
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