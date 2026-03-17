let averagesBarChart = null;
let annualOverviewBarChart = null;
let annualOverviewLineChart = null;

function initAverages() {
  const avgViewAnnualTab = document.getElementById("avg-view-annual-tab");
  const avgViewActualsTab = document.getElementById("avg-view-actuals-tab");

  if (avgViewAnnualTab && avgViewActualsTab) {
    // Set initial view from state, defaulting to 'annual'
    const currentView = state.ui.averagesView || 'annual';
    const tabToActivate = currentView === 'annual' ? avgViewAnnualTab : avgViewActualsTab;
    
    // Use Bootstrap's Tab instance to show the correct tab
    const bsTab = new bootstrap.Tab(tabToActivate);
    bsTab.show();

    // Listen for tab changes to save state
    avgViewAnnualTab.addEventListener('shown.bs.tab', () => {
      state.ui.averagesView = 'annual';
      saveState();
    });
    avgViewActualsTab.addEventListener('shown.bs.tab', () => {
      state.ui.averagesView = 'actuals';
      saveState();
    });
  }

  btnAvgRefresh.addEventListener("click", () => {
    state.ui.avgStart = avgStart.value || state.ui.avgStart;
    state.ui.avgEnd = avgEnd.value || state.ui.avgEnd;
    saveState();
    renderAverages();
  });
  avgStart.addEventListener("change", () => { state.ui.avgStart = avgStart.value; saveState(); renderAverages(); });
  avgEnd.addEventListener("change", () => { state.ui.avgEnd = avgEnd.value; saveState(); renderAverages(); });

  if (annualOverviewYear) {
    annualOverviewYear.value = String(state.ui.annualOverviewYear || new Date().getFullYear());
    annualOverviewYear.addEventListener("change", () => {
      state.ui.annualOverviewYear = Number(annualOverviewYear.value);
      saveState();
      renderAnnualOverview();
    });

    if (annualMajor) {
      annualMajor.checked = state.ui.annualOverviewGranularity === 'major';
      annualMajor.addEventListener("change", () => {
        if (annualMajor.checked) state.ui.annualOverviewGranularity = 'major';
        saveState();
        renderAnnualOverview();
      });
    }
    if (annualMinor) {
      annualMinor.checked = state.ui.annualOverviewGranularity === 'minor';
      annualMinor.addEventListener("change", () => {
        if (annualMinor.checked) state.ui.annualOverviewGranularity = 'minor';
        saveState();
        renderAnnualOverview();
      });
    }
  }

  if (avgThead) {
    avgThead.addEventListener("click", (e) => {
      const th = e.target.closest("th");
      if (!th || !th.dataset.sort) return;
      
      const field = th.dataset.sort;
      const currentSort = state.ui.avgSortField || 'actual';
      const currentDir = state.ui.avgSortDir || 'desc';
      
      let newDir = 'desc';
      if (field === currentSort) {
        newDir = currentDir === 'desc' ? 'asc' : 'desc';
      } else {
        // Default sort direction: asc for text, desc for numbers
        if (field === 'major' || field === 'minor') newDir = 'asc';
      }
      
      state.ui.avgSortField = field;
      state.ui.avgSortDir = newDir;
      saveState();
      renderAverages();
    });
  }
}

function renderAnnualOverview() {
  if (!annualOverviewTbody) return;

  const year = Number(annualOverviewYear.value);
  if (!year) return;

  const totals = {};
  const totalsByMinor = {};
  MAJOR_CATEGORIES.forEach(m => { totals[m.key] = 0; });
  state.minorCategories.forEach(c => { totalsByMinor[c.id] = 0; });

  let totalExpenses = 0;
  const monthlyStats = Array(12).fill(0).map(() => ({ income: 0, expense: 0 }));

  for (const t of state.transactions) {
    if (!t.date) continue;
    const d = new Date(t.date + "T00:00:00");
    if (d.getFullYear() !== year) continue;

    const cat = getCategory(t.minorCategoryId);
    if (!cat) continue;

    const amount = safeNumber(t.amount);
    const type = MAJOR_TYPES[cat.majorKey];

    if (type === 'transfer') continue;

    totals[cat.majorKey] = (totals[cat.majorKey] || 0) + amount;
    totalsByMinor[cat.id] = (totalsByMinor[cat.id] || 0) + amount;

    if (type === 'outflow') {
      totalExpenses += amount;
      monthlyStats[d.getMonth()].expense += amount;
    } else if (type === 'inflow') {
      monthlyStats[d.getMonth()].income += amount;
    }
  }

  const net = totals.income - totalExpenses;

  let html = `
    <tr>
      <td>Total Income</td>
      <td class="text-end fw-bold text-success">${formatMoney(totals.income)}</td>
    </tr>
    <tr>
      <td>Total Expenses</td>
      <td class="text-end fw-bold text-danger">${formatMoney(totalExpenses)}</td>
    </tr>
  `;

  const granularity = state.ui.annualOverviewGranularity || 'major';

  if (granularity === 'major') {
    MAJOR_CATEGORIES.forEach(m => {
      if (MAJOR_TYPES[m.key] === 'outflow' && totals[m.key] > 0) {
        html += `
          <tr>
            <td class="ps-4 text-muted">${m.label}</td>
            <td class="text-end">${formatMoney(totals[m.key])}</td>
          </tr>
        `;
      }
    });
  } else { // 'minor'
    const groupedMinors = {};
    state.minorCategories.forEach(c => {
      if (MAJOR_TYPES[c.majorKey] !== 'outflow') return;
      if (!groupedMinors[c.majorKey]) groupedMinors[c.majorKey] = [];
      groupedMinors[c.majorKey].push(c);
    });

    MAJOR_CATEGORIES.forEach(major => {
      if (MAJOR_TYPES[major.key] !== 'outflow') return;
      const minorsInGroup = groupedMinors[major.key];
      if (minorsInGroup && minorsInGroup.some(c => (totalsByMinor[c.id] || 0) > 0)) {
        html += `<tr class="table-group-header"><td colspan="2">${escapeHtml(major.label)}</td></tr>`;
        minorsInGroup.forEach(minor => {
          const total = totalsByMinor[minor.id] || 0;
          if (total > 0) {
            html += `
              <tr><td class="ps-4 text-muted">${escapeHtml(minor.name)}</td><td class="text-end">${formatMoney(total)}</td></tr>
            `;
          }
        });
      }
    });
  }

  html += `
    <tr class="fw-bold">
      <td>Net Income</td>
      <td class="text-end ${net >= 0 ? 'text-success' : 'text-danger'}">${formatMoney(net)}</td>
    </tr>
    <tr>
      <td>Total Savings (Sinking Funds)</td>
      <td class="text-end">${formatMoney(totals.sinking)}</td>
    </tr>
    <tr>
      <td>Total Investments</td>
      <td class="text-end">${formatMoney(totals.invest)}</td>
    </tr>
  `;

  annualOverviewTbody.innerHTML = html;
  renderAnnualOverviewCharts(totals, totalsByMinor, monthlyStats);
}

function renderAnnualOverviewCharts(totals, totalsByMinor, monthlyStats) {
  const granularity = state.ui.annualOverviewGranularity || 'major';

  // 1. Bar Chart (Allocation)
  const ctxBar = document.getElementById("annualOverviewBarChart")?.getContext("2d");
  if (ctxBar) {
    if (annualOverviewBarChart) annualOverviewBarChart.destroy();

    let chartLabels = [];
    let chartData = [];
    let chartColors = [];

    if (granularity === 'major') {
      MAJOR_CATEGORIES.forEach(cat => {
        if (cat.key === 'transfer') return; // Skip transfers
        const total = totals[cat.key] || 0;
        if (total > 0) {
          chartLabels.push(cat.label);
          chartData.push(total);
          chartColors.push(cat.color);
        }
      });
    } else { // 'minor'
      const minorChartData = state.minorCategories
        .map(c => ({
          label: c.name,
          total: totalsByMinor[c.id] || 0,
          color: MAJOR_CATEGORIES.find(m => m.key === c.majorKey)?.color || '#cccccc',
          type: MAJOR_TYPES[c.majorKey]
        }))
        .filter(d => d.type === 'outflow' && d.total > 0)
        .sort((a, b) => b.total - a.total)
        .slice(0, 15); // Top 15

      chartLabels = minorChartData.map(d => d.label);
      chartData = minorChartData.map(d => d.total);
      chartColors = minorChartData.map(d => d.color);
    }

    annualOverviewBarChart = new Chart(ctxBar, {
      type: "bar",
      data: {
        labels: chartLabels,
        datasets: [{
          label: "Annual Total",
          data: chartData,
          backgroundColor: chartColors,
          borderRadius: 6,
          barPercentage: 0.6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (c) => formatMoney(c.raw) } }
        },
        scales: {
          y: { beginAtZero: true, ticks: { callback: (v) => formatMoney(v).replace(".00", "") } }
        }
      }
    });
  }

  // 2. Line Chart (Monthly Trends)
  const ctxLine = document.getElementById("annualOverviewLineChart")?.getContext("2d");
  if (ctxLine) {
    if (annualOverviewLineChart) annualOverviewLineChart.destroy();

    const labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const incomeData = monthlyStats.map(s => s.income);
    const expenseData = monthlyStats.map(s => s.expense);

    annualOverviewLineChart = new Chart(ctxLine, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Income",
            data: incomeData,
            borderColor: MAJOR_CATEGORIES.find(m => m.key === "income")?.color || "#A4747D",
            backgroundColor: "rgba(164, 116, 125, 0.1)",
            tension: 0.3,
            fill: true
          },
          {
            label: "Expenses",
            data: expenseData,
            borderColor: "#C27250",
            backgroundColor: "rgba(194, 114, 80, 0.1)",
            tension: 0.3,
            fill: true
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${formatMoney(c.raw)}` } }
        },
        scales: {
          y: { beginAtZero: true, ticks: { callback: (v) => formatMoney(v).replace(".00", "") } }
        }
      }
    });
  }
}

/* =========================
   Averages Tab (UPDATED % denominator)
   ========================= */
function renderAverages() {
  const startISO = avgStart.value || state.ui.avgStart;
  const endISO = avgEnd.value || state.ui.avgEnd;

  if (!startISO || !endISO) {
    avgMonths.value = "—";
    avgIncomeValue.textContent = "—";
    avgExpenseValue.textContent = "—";
    if (avgTbody) avgTbody.innerHTML = `<tr><td colspan="6" class="text-muted">Select a date range.</td></tr>`;
    if (averagesBarChart) averagesBarChart.destroy();
    averagesBarChart = null;
    return;
  }

  const start = parseISODate(startISO);
  const end = parseISODate(endISO);
  if (!start || !end || start > end) {
    avgMonths.value = "—";
    avgIncomeValue.textContent = "—";
    avgExpenseValue.textContent = "—";
    if (avgTbody) avgTbody.innerHTML = `<tr><td colspan="6" class="text-muted">Invalid range. Start must be <= End.</td></tr>`;
    if (averagesBarChart) averagesBarChart.destroy();
    averagesBarChart = null;
    return;
  }

  const monthsCount = countMonthsInclusive(start, end);
  avgMonths.value = String(monthsCount);

  // 1. Sum actuals by category for the selected range
  const sumsByMinor = {};
  for (const t of state.transactions) {
    if (!t.date) continue;
    if (!isInRange(t.date, startISO, endISO)) continue;
    sumsByMinor[t.minorCategoryId] = (sumsByMinor[t.minorCategoryId] || 0) + safeNumber(t.amount);
  }

  // 2. Get current expected values (which are already monthly)
  const expectedByMinor = computeExpectedByMinor();

  // 3. Calculate total average income and expenses
  let incomeTotal = 0;
  let actualExpenseTotal = 0;
  let expectedExpenseTotal = 0;

  for (const c of state.minorCategories) {
    const type = MAJOR_TYPES[c.majorKey];
    if (type === 'inflow') {
      incomeTotal += (sumsByMinor[c.id] || 0);
    } else if (type === 'outflow') {
      actualExpenseTotal += (sumsByMinor[c.id] || 0);
      expectedExpenseTotal += (expectedByMinor[c.id] || 0);
    }
  }

  const avgTotalActualIncome = monthsCount > 0 ? (incomeTotal / monthsCount) : 0;
  const avgTotalActualExpenses = monthsCount > 0 ? (actualExpenseTotal / monthsCount) : 0;
  const avgTotalExpectedExpenses = expectedExpenseTotal; // Expected is already monthly

  avgIncomeValue.textContent = formatMoney(avgTotalActualIncome);
  avgExpenseValue.textContent = formatMoney(avgTotalActualExpenses);

  // 4. Prepare data for table and chart (only expenses), then sort
  const sortField = state.ui.avgSortField || 'actual';
  const sortDir = state.ui.avgSortDir || 'desc';
  const dirMult = sortDir === 'asc' ? 1 : -1;

  const expenseCats = state.minorCategories
    .filter(c => MAJOR_TYPES[c.majorKey] === 'outflow')
    .map(c => ({
      ...c,
      avgActual: monthsCount > 0 ? (sumsByMinor[c.id] || 0) / monthsCount : 0,
      avgExpected: expectedByMinor[c.id] || 0,
    }))
    .sort((a, b) => {
      if (sortField === 'actual' || sortField === 'pctActual') {
        return (a.avgActual - b.avgActual) * dirMult;
      }
      if (sortField === 'expected' || sortField === 'pctExpected') {
        return (a.avgExpected - b.avgExpected) * dirMult;
      }
      if (sortField === 'major') {
        const labelA = getMajorLabel(a.majorKey).toLowerCase();
        const labelB = getMajorLabel(b.majorKey).toLowerCase();
        return labelA.localeCompare(labelB) * dirMult;
      }
      if (sortField === 'minor') {
        return a.name.toLowerCase().localeCompare(b.name.toLowerCase()) * dirMult;
      }
      return 0;
    });

  // 5. Render Table
  if (avgTbody) {
    const rows = expenseCats.map(c => {
      const pctActual = avgTotalActualExpenses > 0 ? (c.avgActual / avgTotalActualExpenses * 100).toFixed(1) + "%" : "0.0%";
      const pctExpected = avgTotalExpectedExpenses > 0 ? (c.avgExpected / avgTotalExpectedExpenses * 100).toFixed(1) + "%" : "0.0%";
      return `
        <tr>
          <td>${escapeHtml(getMajorLabel(c.majorKey))}</td>
          <td>${escapeHtml(c.name)}</td>
          <td class="text-end">${formatMoney(c.avgActual)}</td>
          <td class="text-end">${formatMoney(c.avgExpected)}</td>
          <td class="text-end">${pctActual}</td>
          <td class="text-end">${pctExpected}</td>
        </tr>
      `;
    }).join("");
    avgTbody.innerHTML = rows || `<tr><td colspan="6" class="text-muted">No expense categories with data in this range.</td></tr>`;
  }

  // 6. Render Chart
  renderAveragesBarChart(expenseCats);
}

function renderAveragesBarChart(expenseCats) {
  const ctx = document.getElementById("averagesBarChart")?.getContext("2d");
  if (!ctx) return;

  const topCats = expenseCats.slice(0, 15).reverse(); // Reverse for horizontal bar chart

  const labels = topCats.map(c => c.name);
  const actualData = topCats.map(c => c.avgActual);
  const expectedData = topCats.map(c => c.avgExpected);

  if (averagesBarChart) {
    averagesBarChart.destroy();
  }

  averagesBarChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Average Actual',
          data: actualData,
          backgroundColor: '#735557', // plum-soft
          borderRadius: 4
        },
        {
          label: 'Average Expected',
          data: expectedData,
          backgroundColor: '#D29F80', // sand
          borderRadius: 4
        }
      ]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { beginAtZero: true, ticks: { callback: (value) => formatMoney(value) } }
      },
      plugins: {
        legend: { position: 'top' },
        tooltip: { callbacks: { label: (context) => `${context.dataset.label}: ${formatMoney(context.parsed.x)}` } }
      }
    }
  });
}