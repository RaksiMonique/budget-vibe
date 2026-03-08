let averagesBarChart = null;
let annualOverviewBarChart = null;
let annualOverviewLineChart = null;

function initAverages() {
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
  if (!avgTbody) return;

  const startISO = avgStart.value || state.ui.avgStart;
  const endISO = avgEnd.value || state.ui.avgEnd;

  if (!startISO || !endISO) {
    avgMonths.value = "—";
    avgIncomeValue.textContent = "—";
    avgExpenseValue.textContent = "—";
    avgTbody.innerHTML = `<tr><td colspan="4" class="text-muted">Select a date range.</td></tr>`;
    return;
  }

  const start = parseISODate(startISO);
  const end = parseISODate(endISO);
  if (!start || !end || start > end) {
    avgMonths.value = "—";
    avgIncomeValue.textContent = "—";
    avgExpenseValue.textContent = "—";
    avgTbody.innerHTML = `<tr><td colspan="4" class="text-muted">Invalid range. Start must be <= End.</td></tr>`;
    return;
  }

  const monthsCount = countMonthsInclusive(start, end);
  avgMonths.value = String(monthsCount);

  // Sum by category for range
  const sumsByMinor = {};
  for (const t of state.transactions) {
    if (!t.date) continue;
    if (!isInRange(t.date, startISO, endISO)) continue;
    sumsByMinor[t.minorCategoryId] = (sumsByMinor[t.minorCategoryId] || 0) + safeNumber(t.amount);
  }

  // Avg monthly income
  let incomeTotal = 0;
  for (const c of state.minorCategories) {
    if (c.majorKey !== "income") continue;
    incomeTotal += (sumsByMinor[c.id] || 0);
  }
  const avgIncome = monthsCount > 0 ? (incomeTotal / monthsCount) : 0;
  avgIncomeValue.textContent = formatMoney(avgIncome);

  // Avg monthly total expenses (outflow categories only)
  let expenseTotal = 0;
  for (const c of state.minorCategories) {
    const type = MAJOR_TYPES[c.majorKey];
    if (type !== "outflow") continue;
    expenseTotal += (sumsByMinor[c.id] || 0);
  }
  const avgTotalExpenses = monthsCount > 0 ? (expenseTotal / monthsCount) : 0;
  avgExpenseValue.textContent = formatMoney(avgTotalExpenses);

  const sortedCats = state.minorCategories
    .slice()
    .sort((a, b) => (a.majorKey + a.name).localeCompare(b.majorKey + b.name));

  const rows = sortedCats.map(c => {
    const total = sumsByMinor[c.id] || 0;
    const avg = monthsCount > 0 ? (total / monthsCount) : 0;

    const type = MAJOR_TYPES[c.majorKey];

    let pctStr = "—";
    // Only compute % for outflow categories against total outflow
    if (type === "outflow") {
      const pct = avgTotalExpenses > 0 ? (avg / avgTotalExpenses) * 100 : 0;
      pctStr = avgTotalExpenses > 0 ? `${pct.toFixed(1)}%` : "—";
    }

    return `
      <tr>
        <td>${escapeHtml(getMajorLabel(c.majorKey))}</td>
        <td>${escapeHtml(c.name)}</td>
        <td class="text-end">${formatMoney(avg)}</td>
        <td class="text-end">${pctStr}</td>
      </tr>
    `;
  }).join("");

  avgTbody.innerHTML = rows || `<tr><td colspan="4" class="text-muted">No categories yet.</td></tr>`;

  renderAveragesBarChart(sortedCats, sumsByMinor, monthsCount);
}

function renderAveragesBarChart(sortedCats, sumsByMinor, monthsCount) {
  const ctx = document.getElementById("averagesBarChart")?.getContext("2d");
  if (!ctx) return;

  const chartData = sortedCats
    .map(c => {
      const total = sumsByMinor[c.id] || 0;
      const avg = monthsCount > 0 ? (total / monthsCount) : 0;
      return {
        label: c.name,
        avg: avg,
        majorKey: c.majorKey,
        type: MAJOR_TYPES[c.majorKey]
      };
    })
    .filter(d => d.type === "outflow" && d.avg > 0)
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 15); // Top 15

  const labels = chartData.map(d => d.label);
  const data = chartData.map(d => d.avg);
  const colors = chartData.map(d => MAJOR_CATEGORIES.find(m => m.key === d.majorKey)?.color || "#cccccc");

  if (averagesBarChart) {
    averagesBarChart.data.labels = labels;
    averagesBarChart.data.datasets[0].data = data;
    averagesBarChart.data.datasets[0].backgroundColor = colors;
    averagesBarChart.update();
  } else {
    averagesBarChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [{
          label: "Average Monthly Spend",
          data: data,
          backgroundColor: colors,
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        scales: { x: { beginAtZero: true } },
        plugins: {
          legend: { display: false }
        }
      }
    });
  }
}