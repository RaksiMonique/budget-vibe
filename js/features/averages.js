let averagesBarChart = null;

function initAverages() {
  btnAvgRefresh.addEventListener("click", () => {
    state.ui.avgStart = avgStart.value || state.ui.avgStart;
    state.ui.avgEnd = avgEnd.value || state.ui.avgEnd;
    saveState();
    renderAverages();
  });
  avgStart.addEventListener("change", () => { state.ui.avgStart = avgStart.value; saveState(); renderAverages(); });
  avgEnd.addEventListener("change", () => { state.ui.avgEnd = avgEnd.value; saveState(); renderAverages(); });
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