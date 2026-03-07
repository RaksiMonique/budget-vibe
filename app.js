const MAJOR_CATEGORIES = [
  { key: "income", label: "Income", color: "#A4747D" },
  { key: "fixed", label: "Fixed Expenses", color: "#C27250" },
  { key: "variable", label: "Variable Expenses", color: "#D29F80" },
  { key: "bills", label: "Bills", color: "#735557" },
  { key: "sinking", label: "Sinking (Savings) Fund", color: "#69856D" },
  { key: "fun", label: "Fun Money", color: "#97866A" },
  { key: "invest", label: "Investments", color: "#B6C1B1" },
  { key: "transfer", label: "Transfer", color: "#9E9E9E" },
];

const MAJOR_TYPES = {
  income: "inflow",
  fixed: "outflow",
  variable: "outflow",
  bills: "outflow",
  sinking: "outflow",
  fun: "outflow",
  invest: "outflow",
  transfer: "transfer",
};

const FREQUENCY_TO_MONTHLY_MULTIPLIER = {
  weekly: 52 / 12,
  biweekly: 26 / 12,
  monthly: 1,
  quarterly: 1 / 3,
  yearly: 1 / 12,
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

let state = loadState();
let budgetDonutChart = null;
let averagesBarChart = null;
let netWorthChart = null;

init();

function init() {
  const now = new Date();
  yearInput.value = state.ui.selectedYear ?? now.getFullYear();
  monthSelect.value = String(state.ui.selectedMonth ?? now.getMonth());

  // Defaults for averages tab
  if (!state.ui.avgStart || !state.ui.avgEnd) {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    state.ui.avgStart = toISODate(start);
    state.ui.avgEnd = toISODate(end);
    saveState();
  }
  avgStart.value = state.ui.avgStart;
  avgEnd.value = state.ui.avgEnd;

  // Default dividends year
  if (!state.ui.divYear) state.ui.divYear = now.getFullYear();
  divYear.value = String(state.ui.divYear);

  categoryMajor.innerHTML = MAJOR_CATEGORIES
    .filter(m => m.key !== "bills" && m.key !== "sinking" && m.key !== "transfer")
    .map(m => `<option value="${m.key}">${m.label}</option>`)
    .join("");

  if (state.minorCategories.length === 0) {
    seedStarterCategories();
    ensureTransferCategory();
    saveState();
  }

  if (!Array.isArray(state.accounts)) state.accounts = [];
  if (state.accounts.length === 0) seedStarterAccounts();
  if (!Array.isArray(state.debts)) state.debts = [];
  if (!Array.isArray(state.otherAssets)) state.otherAssets = [];
  if (!Array.isArray(state.rentals)) state.rentals = [];

  if (!Array.isArray(state.billPayments)) state.billPayments = [];
  if (!Array.isArray(state.stocksMaster)) state.stocksMaster = [];
  if (!Array.isArray(state.holdings)) state.holdings = [];
  if (!state.dividends || typeof state.dividends !== "object") state.dividends = {};

  if (!state.ui.rentalYear) state.ui.rentalYear = now.getFullYear();
  rentalYear.value = String(state.ui.rentalYear);
  if (!state.rentalIncome || typeof state.rentalIncome !== "object") state.rentalIncome = {};

  wireEvents();
  refreshAll();
}

/* =========================
   Events
   ========================= */
function wireEvents() {
  themeToggle.addEventListener("click", () => {
    const currentTheme = document.documentElement.getAttribute("data-theme");
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", newTheme);
    state.ui.theme = newTheme; // Explicitly set user choice
    saveState();
  });

  btnThisMonth.addEventListener("click", () => {
    const now = new Date();
    yearInput.value = now.getFullYear();
    monthSelect.value = String(now.getMonth());
    persistSelectedMonth();
    refreshAll();
  });

  pensionInput.addEventListener("change", () => {
    const sel = getSelectedMonth();
    const key = `${sel.year}-${sel.month}`;
    if (!state.pensionRates) state.pensionRates = {};
    state.pensionRates[key] = safeNumber(pensionInput.value);
    saveState();
    refreshAll();
  });

  yearInput.addEventListener("change", () => { persistSelectedMonth(); refreshAll(); });
  monthSelect.addEventListener("change", () => { persistSelectedMonth(); refreshAll(); });

  btnRecalc.addEventListener("click", () => refreshAll());

  modalGoalEl.addEventListener("show.bs.modal", () => {
    if (!goalId.value) {
      goalModalTitle.textContent = "Add Savings Goal";
      goalForm.reset();
      goalDeadlineDate.value = "";
      goalDurationMonths.value = "";
    }
  });

  document.getElementById("modalBill").addEventListener("show.bs.modal", () => {
    if (!billId.value) billModalTitle.textContent = "Add Recurring Bill";
  });

  transferForm.addEventListener("submit", (e) => { e.preventDefault(); upsertTransfer(); });
  modalTransferEl.addEventListener("show.bs.modal", () => {
    transferForm.reset();
    transferDate.value = toISODate(new Date());
    const accs = state.accounts.sort((a,b) => a.name.localeCompare(b.name));
    const options = accs.map(a => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join("");
    transferFromAccount.innerHTML = options;
    transferToAccount.innerHTML = options;
    if (accs.length > 1) {
      transferFromAccount.value = accs[0].id;
      transferToAccount.value = accs[1].id;
    }
  });

  /* Rentals */
  rentalsTbody.addEventListener("click", (e) => {
    const button = e.target.closest("button[data-id]");
    if (!button) return;
    const id = button.dataset.id;
    if (button.dataset.action === "edit-rental") editRental(id);
    else if (button.dataset.action === "delete-rental") deleteRental(id);
  });
  rentalForm.addEventListener("submit", (e) => { e.preventDefault(); upsertRental(); });
  modalRentalEl.addEventListener("hidden.bs.modal", () => {
    rentalForm.reset();
    rentalId.value = "";
    rentalModalTitle.textContent = "Add Rental Property";
  });
  rentalYear.addEventListener("change", () => {
    state.ui.rentalYear = clampInt(rentalYear.value, 2000, 2100, new Date().getFullYear());
    rentalYear.value = String(state.ui.rentalYear);
    saveState();
    renderRentals();
  });
  btnRentalRefresh.addEventListener("click", () => renderRentals());

  /* Assets */
  assetsTbody.addEventListener("click", (e) => {
    const button = e.target.closest("button[data-id]");
    if (!button) return;
    const id = button.dataset.id;
    if (button.dataset.action === "edit-asset") editAsset(id);
    else if (button.dataset.action === "delete-asset") deleteAsset(id);
  });
  assetForm.addEventListener("submit", (e) => { e.preventDefault(); upsertAsset(); });
  modalAssetEl.addEventListener("hidden.bs.modal", () => {
    assetForm.reset();
    assetId.value = "";
    assetModalTitle.textContent = "Add Asset";
  });

  categoryForm.addEventListener("submit", (e) => { e.preventDefault(); upsertGeneralMinorCategory(); });
  modalCategoryEl.addEventListener("hidden.bs.modal", () => {
    categoryForm.reset();
    categoryId.value = "";
    categoryModalTitle.textContent = "Add Minor Category";
  });
  sinkingCategoryForm.addEventListener("submit", (e) => { e.preventDefault(); upsertSinkingCategory(); });
  billsCategoryForm.addEventListener("submit", (e) => { e.preventDefault(); upsertBillsCategory(); });

  goalForm.addEventListener("submit", (e) => { e.preventDefault(); upsertGoal(); });
  billForm.addEventListener("submit", (e) => { e.preventDefault(); upsertBill(); });

  btnExport.addEventListener("click", exportJSON);
  fileImport.addEventListener("change", importJSON);

  btnReset.addEventListener("click", () => {
    showConfirmationModal("Reset all budget data? This cannot be undone.", () => {
      state = defaultState();
      saveState();
      init();
    });
  });

  /* Averages */
  btnAvgRefresh.addEventListener("click", () => {
    state.ui.avgStart = avgStart.value || state.ui.avgStart;
    state.ui.avgEnd = avgEnd.value || state.ui.avgEnd;
    saveState();
    renderAverages();
  });
  avgStart.addEventListener("change", () => { state.ui.avgStart = avgStart.value; saveState(); renderAverages(); });
  avgEnd.addEventListener("change", () => { state.ui.avgEnd = avgEnd.value; saveState(); renderAverages(); });

  initStocks();
  initTransactions();
  initDividends();
  initFIRE();
  initAccounts();
  initDebts();

  initModalAutoFocus();
}

/* =========================
   Refresh
   ========================= */
function refreshAll() {
  renderCategoryDropdowns();

  const expectedByMinor = computeExpectedByMinor();
  const sel = getSelectedMonth();
  const actualByMinor = computeActualByMinor(sel.year, sel.month);

  if (displayMonthYear) {
    const mName = monthSelect.options[sel.month]?.text || MONTHS[sel.month];
    displayMonthYear.textContent = `${mName} ${sel.year}`;
  }
  
  // Update pension input for selected month
  if (!state.pensionRates) state.pensionRates = {};
  const pKey = `${sel.year}-${sel.month}`;
  pensionInput.value = state.pensionRates[pKey] || 0;

  renderBudgetTable(expectedByMinor, actualByMinor);
  renderAccounts();
  renderTransactionsTable(sel.year, sel.month);
  renderGoals(expectedByMinor);
  renderSinkingCategories(expectedByMinor, actualByMinor);
  renderBillsCategories(expectedByMinor);
  renderBills(sel.year, sel.month); // FIXED: show ALL bills
  renderDebts();
  renderDebtsForAssetsTab();
  renderFIRE();
  renderRentals();
  renderAssets();
  renderNetWorth();
  renderGeneralCategories();

  renderSummary(actualByMinor, sel.year, sel.month);
  renderBillsPaidTracker(sel.year, sel.month);

  renderBudgetDonutChart(actualByMinor);
  renderAverages();
  renderStocks();
  renderDividends();

  refreshTopInvestmentMetrics();
}

function persistSelectedMonth() {
  const y = clampInt(yearInput.value, 2000, 2100, new Date().getFullYear());
  const m = clampInt(monthSelect.value, 0, 11, new Date().getMonth());
  state.ui.selectedYear = y;
  state.ui.selectedMonth = m;
  saveState();
}

/* =========================
   Dropdowns
   ========================= */
function renderCategoryDropdowns() {
  txMajor.innerHTML = MAJOR_CATEGORIES
    .filter(m => m.key !== "transfer")
    .map(m => `<option value="${m.key}">${m.label}</option>`).join("");
  if (!txMajor.value) txMajor.value = "variable";
  repopulateTxMinorOptions(txMajor.value, false);

  const sinking = state.minorCategories
    .filter(c => c.majorKey === "sinking")
    .sort((a, b) => a.name.localeCompare(b.name));
  goalMinor.innerHTML = sinking.length
    ? sinking.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("")
    : `<option value="" disabled selected>Create a Sinking Fund category first</option>`;

  const bills = state.minorCategories
    .filter(c => c.majorKey === "bills")
    .sort((a, b) => a.name.localeCompare(b.name));
  billMinor.innerHTML = bills.length
    ? bills.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("")
    : `<option value="" disabled selected>Create a Bills category first</option>`;

  // Populate transaction filter dropdown
  const allCats = state.minorCategories
    .slice()
    .sort((a,b) => a.name.localeCompare(b.name));
  txFilterCategory.innerHTML = `<option value="">All Categories</option>` + allCats
    .map(c => `<option value="${c.id}">${escapeHtml(c.name)} (${escapeHtml(getMajorLabel(c.majorKey))})</option>`)
    .join("");
}

/* =========================
   Summary
   ========================= */
function renderSummary(actualByMinor, year, month) {
  let income = 0, expenses = 0;
  let sinking = 0, invest = 0;

  for (const cat of state.minorCategories) {
    const actual = actualByMinor[cat.id] || 0;
    const type = MAJOR_TYPES[cat.majorKey];
    if (type === "transfer") continue;
    if (type === "inflow") income += actual;
    else if (type === "outflow") expenses += actual;

    if (cat.majorKey === "sinking") sinking += actual;
    if (cat.majorKey === "invest") invest += actual;
  }

  const net = income - expenses;

  sumIncome.textContent = formatMoney(income);
  sumExpenses.textContent = formatMoney(expenses);
  sumNet.textContent = formatMoney(net);

  sumNet.classList.toggle("text-danger", net < 0);
  sumNet.classList.toggle("text-success", net >= 0);

  // Rates Calculation
  // Pension Amount = Income * (Rate / 100)
  // Total Income (Adjusted) = Income + Pension Amount
  const pKey = `${year}-${month}`;
  const pensionRate = safeNumber(state.pensionRates?.[pKey] || 0);
  const pensionAmount = income * (pensionRate / 100);
  const totalIncome = income + pensionAmount;
  const totalSavings = sinking;
  const totalInvest = invest + pensionAmount;

  metricSavingsRate.textContent = income > 0 ? ((totalSavings / income) * 100).toFixed(1) + "%" : "0.0%";
  metricInvestRate.textContent = totalIncome > 0 ? ((totalInvest / totalIncome) * 100).toFixed(1) + "%" : "0.0%";
}

/* =========================
   Charts
   ========================= */
function renderBudgetDonutChart(actualByMinor) {
  const ctx = document.getElementById("budgetDonutChart")?.getContext("2d");
  if (!ctx) return;

  const sumsByMajor = {};
  for (const cat of state.minorCategories) {
    const type = MAJOR_TYPES[cat.majorKey];
    if (type !== "outflow") continue;

    const actual = actualByMinor[cat.id] || 0;
    sumsByMajor[cat.majorKey] = (sumsByMajor[cat.majorKey] || 0) + actual;
  }

  const labels = [], data = [], colors = [];
  for (const major of MAJOR_CATEGORIES) {
    if (sumsByMajor[major.key] > 0) {
      labels.push(major.label);
      data.push(sumsByMajor[major.key]);
      colors.push(major.color);
    }
  }

  if (budgetDonutChart) {
    budgetDonutChart.data.labels = labels;
    budgetDonutChart.data.datasets[0].data = data;
    budgetDonutChart.data.datasets[0].backgroundColor = colors;
    budgetDonutChart.update();
  } else {
    budgetDonutChart = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: colors,
          borderWidth: 0,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom" } }
      }
    });
  }
}

/* =========================
   Top: Stocks Value + TTM Dividends
   ========================= */
function refreshTopInvestmentMetrics() {
  if (sumStocksValue) sumStocksValue.textContent = formatMoney(computeTotalStockValue());
  if (sumDivTTM) sumDivTTM.textContent = formatMoney(computeTrailing12MDividendIncome());
}

/* =========================
   Bills paid tracker (auto)
   ========================= */
function renderBillsPaidTracker(year, month) {
  // For monthly tracker we treat each bill as one "to pay" item in the month.
  const bills = state.bills.slice();
  const total = bills.length;

  let paid = 0;
  for (const b of bills) {
    if (isBillPaidByTransactions(b, year, month)) paid += 1;
  }

  billsPaidSummary.textContent = total === 0 ? "0 / 0" : `${paid} / ${total}`;
  const pct = total === 0 ? 0 : Math.round((paid / total) * 100);
  billsPaidBar.style.width = `${pct}%`;
  billsPaidBar.setAttribute("aria-valuenow", pct);
}

function isBillPaidByTransactions(bill, year, month) {
  // Paid if there is any transaction in the selected month with the same minorCategoryId
  return state.transactions.some(t =>
    t.minorCategoryId === bill.minorCategoryId &&
    isInMonth(t.date, year, month)
  );
}

/* =========================
   Budget table
   ========================= */
function renderBudgetTable(expectedByMinor, actualByMinor) {
  const majors = MAJOR_CATEGORIES.map(m => m.key);
  const catsByMajor = Object.fromEntries(majors.map(k => [k, []]));
  for (const c of state.minorCategories) catsByMajor[c.majorKey].push(c);
  for (const k of majors) catsByMajor[k].sort((a, b) => a.name.localeCompare(b.name));

  let rows = "";
  for (const major of majors) {
    if (major === "transfer") continue;
    const list = catsByMajor[major];
    if (!list.length) continue;

    const majorLabel = getMajorLabel(major);

    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      const exp = expectedByMinor[c.id] || 0;
      const act = actualByMinor[c.id] || 0;

      const type = MAJOR_TYPES[c.majorKey];
      const variance = (type === "inflow") ? (act - exp) : (exp - act);

      const locked = (c.majorKey === "bills" || c.majorKey === "sinking");
      const actionsHtml = locked
        ? `<span class="text-muted small">Manage in ${c.majorKey === "bills" ? "Bills" : "Sinking (Savings)"} tab</span>`
        : `
          <div class="d-flex gap-2">
            <button class="btn btn-sm btn-outline-secondary" onclick="editGeneralCategory('${c.id}')">Edit</button>
            <button class="btn btn-sm btn-outline-danger" onclick="deleteCategory('${c.id}')">Delete</button>
          </div>
        `;

      rows += `
        <tr>
          <td>${i === 0 ? `<span class="badge-soft">${escapeHtml(majorLabel)}</span>` : ""}</td>
          <td>${escapeHtml(c.name)}</td>
          <td class="text-end">${formatMoney(exp)}</td>
          <td class="text-end">${formatMoney(act)}</td>
          <td class="text-end ${variance < 0 ? "text-danger" : "text-success"}">${formatMoney(variance)}</td>
          <td>${actionsHtml}</td>
        </tr>
      `;
    }
  }

  budgetTbody.innerHTML = rows || `<tr><td colspan="6" class="text-muted">No categories yet.</td></tr>`;
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

/* =========================
   Savings Goals
   ========================= */
function renderGoals(expectedByMinor) {
  if (!state.goals.length) {
    goalsWrap.innerHTML = `<div class="text-muted">No goals yet.</div>`;
    return;
  }

  const sel = getSelectedMonth();
  const actualAllTimeByMinor = computeActualByMinor(null, null);
  const actualMonthByMinor = computeActualByMinor(sel.year, sel.month);

  goalsWrap.innerHTML = state.goals
    .slice()
    .sort((a, b) => (a.deadlineISO || "").localeCompare(b.deadlineISO || ""))
    .map(g => {
      const cat = getCategory(g.minorCategoryId);
      const savedAll = actualAllTimeByMinor[g.minorCategoryId] || 0;
      const savedMonth = actualMonthByMinor[g.minorCategoryId] || 0;
      const pct = g.totalAmount > 0 ? Math.min(100, (savedAll / g.totalAmount) * 100) : 0;

      const monthlyReq = computeGoalMonthlyRequired(g);
      const expForCat = expectedByMinor[g.minorCategoryId] || 0;

      return `
        <div class="col-12">
          <div class="card shadow-soft">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-start gap-2">
                <div>
                  <div class="fw-semibold">${escapeHtml(g.name)}</div>
                  <div class="small text-muted">Category: <b>${escapeHtml(cat ? cat.name : "—")}</b></div>
                </div>
                <div class="d-flex gap-2">
                  <button class="btn btn-sm btn-outline-secondary" onclick="editGoal('${g.id}')">Edit</button>
                  <button class="btn btn-sm btn-outline-danger" onclick="deleteGoal('${g.id}')">Delete</button>
                </div>
              </div>

              <div class="mt-3">
                <div class="d-flex justify-content-between small">
                  <span>Progress (all time)</span>
                  <span>${formatMoney(savedAll)} / ${formatMoney(g.totalAmount)} (${pct.toFixed(1)}%)</span>
                </div>
                <div class="progress mt-1">
                  <div class="progress-bar" role="progressbar" style="width:${pct}%"></div>
                </div>
              </div>

              <div class="mt-3 row g-2">
                <div class="col-6">
                  <div class="small text-muted">Monthly required</div>
                  <div class="fw-semibold">${formatMoney(monthlyReq)}</div>
                </div>
                <div class="col-6">
                  <div class="small text-muted">Saved this month</div>
                  <div class="fw-semibold">${formatMoney(savedMonth)}</div>
                </div>
                <div class="col-12">
                  <div class="small text-muted">Expected this month (category total)</div>
                  <div class="fw-semibold">${formatMoney(expForCat)}</div>
                </div>
                <div class="col-12 small text-muted">Deadline: ${g.deadlineISO ? escapeHtml(g.deadlineISO) : "—"}</div>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join("");
}

function upsertGoal() {
  const id = goalId.value?.trim();
  const name = goalName.value.trim();
  const minorId = goalMinor.value;
  const total = safeNumber(goalTotal.value);

  const dateISO = goalDeadlineDate.value || "";
  const durationMonthsRaw = goalDurationMonths.value ? clampInt(goalDurationMonths.value, 1, 600, 12) : null;

  if (!name || !minorId || !isFinite(total) || total <= 0) return;

  const cat = getCategory(minorId);
  if (!cat || cat.majorKey !== "sinking") {
    alert("Goal must be linked to a Sinking Fund category.");
    return;
  }

  let deadlineISO = "";
  if (dateISO) {
    deadlineISO = dateISO;
  } else if (durationMonthsRaw) {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth() + durationMonthsRaw, now.getDate());
    deadlineISO = toISODate(d);
  } else {
    alert("Provide a deadline date or duration (months).");
    return;
  }

  if (id) {
    const g = state.goals.find(x => x.id === id);
    if (!g) return;
    g.name = name;
    g.minorCategoryId = minorId;
    g.totalAmount = total;
    g.deadlineISO = deadlineISO;
    showToast("Goal updated.");
  } else {
    state.goals.push({
      id: uid(),
      name,
      minorCategoryId: minorId,
      totalAmount: total,
      deadlineISO,
      createdAt: new Date().toISOString(),
    });
    showToast("Goal added.");
  }

  saveState();
  closeModal("modalGoal");
  goalForm.reset();
  goalId.value = "";
  goalModalTitle.textContent = "Add Savings Goal";
  refreshAll();
}

window.editGoal = function (id) {
  const g = state.goals.find(x => x.id === id);
  if (!g) return;

  goalId.value = g.id;
  goalName.value = g.name;
  goalMinor.value = g.minorCategoryId;
  goalTotal.value = String(g.totalAmount || 0);

  goalDeadlineDate.value = g.deadlineISO || "";
  goalDurationMonths.value = "";

  goalModalTitle.textContent = "Edit Savings Goal";
  openModal("modalGoal");
};

window.deleteGoal = function (id) {
  const g = state.goals.find(x => x.id === id);
  if (!g) return;
  showConfirmationModal(`Delete goal "${g.name}"?`, () => {
    state.goals = state.goals.filter(x => x.id !== id);
    saveState();
    showToast("Goal deleted.");
    refreshAll();
  });
};

/* =========================
   Sinking categories
   ========================= */
function renderSinkingCategories(expectedByMinor, actualByMinor) {
  const sinking = state.minorCategories
    .filter(c => c.majorKey === "sinking")
    .sort((a, b) => a.name.localeCompare(b.name));

  if (!sinking.length) {
    sinkingCatTbody.innerHTML = `<tr><td colspan="4" class="text-muted">No sinking fund categories yet.</td></tr>`;
    return;
  }

  sinkingCatTbody.innerHTML = sinking.map(c => `
    <tr>
      <td>${escapeHtml(c.name)}</td>
      <td class="text-end">${formatMoney(expectedByMinor[c.id] || 0)}</td>
      <td class="text-end">${formatMoney(actualByMinor[c.id] || 0)}</td>
      <td>
        <div class="d-flex gap-2">
          <button class="btn btn-sm btn-outline-secondary" onclick="editSinkingCategory('${c.id}')">Edit</button>
          <button class="btn btn-sm btn-outline-danger" onclick="deleteSinkingCategory('${c.id}')">Delete</button>
        </div>
      </td>
    </tr>
  `).join("");
}

function upsertSinkingCategory() {
  const id = sinkingCategoryId.value?.trim();
  const name = sinkingCategoryName.value.trim();
  if (!name) return;

  const dupe = state.minorCategories.find(c =>
    c.majorKey === "sinking" &&
    c.name.toLowerCase() === name.toLowerCase() &&
    c.id !== id
  );
  if (dupe) { showToast("That sinking fund already exists."); return; }

  if (id) {
    const c = state.minorCategories.find(x => x.id === id);
    if (!c) return;
    c.name = name;
    c.manualExpectedMonthly = 0;
    showToast("Sinking fund updated.");
  } else {
    state.minorCategories.push({
      id: uid(),
      majorKey: "sinking",
      name,
      manualExpectedMonthly: 0,
      createdAt: new Date().toISOString(),
    });
    showToast("Sinking fund added.");
  }

  saveState();
  closeModal("modalSinkingCategory");
  sinkingCategoryForm.reset();
  sinkingCategoryId.value = "";
  sinkingCategoryModalTitle.textContent = "Add Sinking Fund";
  refreshAll();
}

window.editSinkingCategory = function (id) {
  const c = state.minorCategories.find(x => x.id === id && x.majorKey === "sinking");
  if (!c) return;

  sinkingCategoryId.value = c.id;
  sinkingCategoryName.value = c.name;
  sinkingCategoryModalTitle.textContent = "Edit Sinking Fund";
  openModal("modalSinkingCategory");
};

window.deleteSinkingCategory = function (id) {
  const c = state.minorCategories.find(x => x.id === id && x.majorKey === "sinking");
  if (!c) return;

  const usedInTx = state.transactions.some(t => t.minorCategoryId === id);
  const usedInGoals = state.goals.some(g => g.minorCategoryId === id);
  if (usedInTx || usedInGoals) {
    alert("Cannot delete: linked to transactions or goals. Delete those first.");
    return;
  }

  if (!confirm(`Delete sinking fund "${c.name}"?`)) return;
  state.minorCategories = state.minorCategories.filter(x => x.id !== id);
  saveState();
  showToast("Sinking fund deleted.");
  refreshAll();
};

/* =========================
   Bills categories + recurring bills
   ========================= */
function renderBillsCategories(expectedByMinor) {
  const bills = state.minorCategories
    .filter(c => c.majorKey === "bills")
    .sort((a, b) => a.name.localeCompare(b.name));

  if (!bills.length) {
    billsCatTbody.innerHTML = `<tr><td colspan="3" class="text-muted">No bills categories yet.</td></tr>`;
    return;
  }

  billsCatTbody.innerHTML = bills.map(c => `
    <tr>
      <td>${escapeHtml(c.name)}</td>
      <td class="text-end">${formatMoney(expectedByMinor[c.id] || 0)}</td>
      <td>
        <div class="d-flex gap-2">
          <button class="btn btn-sm btn-outline-secondary" onclick="editBillsCategory('${c.id}')">Edit</button>
          <button class="btn btn-sm btn-outline-danger" onclick="deleteBillsCategory('${c.id}')">Delete</button>
        </div>
      </td>
    </tr>
  `).join("");
}

function upsertBillsCategory() {
  const id = billsCategoryId.value?.trim();
  const name = billsCategoryName.value.trim();
  if (!name) return;

  const dupe = state.minorCategories.find(c =>
    c.majorKey === "bills" &&
    c.name.toLowerCase() === name.toLowerCase() &&
    c.id !== id
  );
  if (dupe) { showToast("That bills category already exists."); return; }

  if (id) {
    const c = state.minorCategories.find(x => x.id === id);
    if (!c) return;
    c.name = name;
    c.manualExpectedMonthly = 0;
    showToast("Bills category updated.");
  } else {
    state.minorCategories.push({
      id: uid(),
      majorKey: "bills",
      name,
      manualExpectedMonthly: 0,
      createdAt: new Date().toISOString(),
    });
    showToast("Bills category added.");
  }

  saveState();
  closeModal("modalBillsCategory");
  billsCategoryForm.reset();
  billsCategoryId.value = "";
  billsCategoryModalTitle.textContent = "Add Bills Category";
  refreshAll();
}

window.editBillsCategory = function (id) {
  const c = state.minorCategories.find(x => x.id === id && x.majorKey === "bills");
  if (!c) return;

  billsCategoryId.value = c.id;
  billsCategoryName.value = c.name;
  billsCategoryModalTitle.textContent = "Edit Bills Category";
  openModal("modalBillsCategory");
};

window.deleteBillsCategory = function (id) {
  const c = state.minorCategories.find(x => x.id === id && x.majorKey === "bills");
  if (!c) return;

  const usedInTx = state.transactions.some(t => t.minorCategoryId === id);
  const usedInBills = state.bills.some(b => b.minorCategoryId === id);
  if (usedInTx || usedInBills) {
    alert("Cannot delete: linked to transactions or recurring bills. Delete those first.");
    return;
  }

  if (!confirm(`Delete bills category "${c.name}"?`)) return;
  state.minorCategories = state.minorCategories.filter(x => x.id !== id);
  saveState();
  showToast("Bills category deleted.");
  refreshAll();
};

/* FIXED: show ALL recurring bills, not only occurrences in month */
function renderBills(year, month) {
  const list = state.bills
    .slice()
    .sort((a, b) => {
      const ca = getCategory(a.minorCategoryId)?.name || "";
      const cb = getCategory(b.minorCategoryId)?.name || "";
      return ca.localeCompare(cb);
    });

  if (!list.length) {
    billsTbody.innerHTML = `<tr><td colspan="8" class="text-muted">No recurring bills added yet.</td></tr>`;
    return;
  }

  // Precompute which bill minors have transactions this month
  const paidMinors = new Set(
    state.transactions
      .filter(t => isInMonth(t.date, year, month))
      .map(t => t.minorCategoryId)
  );

  billsTbody.innerHTML = list.map(b => {
    const cat = getCategory(b.minorCategoryId);
    const billLabel = cat ? cat.name : "—";

    const monthlyEq = computeBillMonthlyEquivalent(b);
    const dueThisMonth = computeFirstDueInMonth(b, year, month); // may be null
    const paid = paidMinors.has(b.minorCategoryId);

    return `
      <tr>
        <td>${escapeHtml(billLabel)}</td>
        <td class="text-end">${formatMoney(b.amount)}</td>
        <td>${escapeHtml(capitalize(b.frequency))}</td>
        <td>${escapeHtml(b.nextDueISO || "—")}</td>
        <td>${escapeHtml(dueThisMonth || "—")}</td>
        <td class="text-end">${formatMoney(monthlyEq)}</td>
        <td>
          <span class="badge ${paid ? "text-bg-success" : "text-bg-secondary"}">
            ${paid ? "Paid" : "Unpaid"}
          </span>
        </td>
        <td>
          <div class="d-flex gap-2">
            <button class="btn btn-sm btn-outline-secondary" onclick="editBill('${b.id}')">Edit</button>
            <button class="btn btn-sm btn-outline-danger" onclick="deleteBill('${b.id}')">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function computeFirstDueInMonth(bill, year, month) {
  if (!bill.nextDueISO) return null;
  let d = new Date(bill.nextDueISO + "T00:00:00");
  if (isNaN(d.getTime())) return null;

  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  const endISO = toISODate(end);

  // move forward until >= start
  while (toISODate(d) < toISODate(start)) {
    d = addByFrequency(d, bill.frequency);
    if (d.getFullYear() > year + 10) return null;
  }

  const iso = toISODate(d);
  if (iso >= toISODate(start) && iso <= endISO) return iso;
  return null;
}

function upsertBill() {
  const id = billId.value?.trim();
  const minorId = billMinor.value;
  const amount = safeNumber(billAmount.value);
  const freq = billFreq.value;
  const nextDue = billNextDue.value;

  if (!minorId || !isFinite(amount) || amount <= 0 || !nextDue) return;

  const cat = getCategory(minorId);
  if (!cat || cat.majorKey !== "bills") {
    alert("Bill must be linked to a Bills minor category.");
    return;
  }

  const derivedName = cat.name;

  if (id) {
    const b = state.bills.find(x => x.id === id);
    if (!b) return;
    b.name = derivedName;
    b.minorCategoryId = minorId;
    b.amount = amount;
    b.frequency = freq;
    b.nextDueISO = nextDue;
    showToast("Bill updated.");
  } else {
    state.bills.push({
      id: uid(),
      name: derivedName,
      minorCategoryId: minorId,
      amount,
      frequency: freq,
      nextDueISO: nextDue,
      createdAt: new Date().toISOString(),
    });
    showToast("Bill added.");
  }

  saveState();
  closeModal("modalBill");
  billForm.reset();
  billId.value = "";
  billModalTitle.textContent = "Add Recurring Bill";
  refreshAll();
}

window.editBill = function (id) {
  const b = state.bills.find(x => x.id === id);
  if (!b) return;

  billId.value = b.id;
  billMinor.value = b.minorCategoryId;
  billAmount.value = String(b.amount);
  billFreq.value = b.frequency;
  billNextDue.value = b.nextDueISO;

  billModalTitle.textContent = "Edit Recurring Bill";
  openModal("modalBill");
};

function deleteBill(id) {
  const b = state.bills.find(x => x.id === id);
  if (!b) return;
  showConfirmationModal("Delete this recurring bill?", () => {
    state.bills = state.bills.filter(x => x.id !== id);
    saveState();
    showToast("Bill deleted.");
    refreshAll();
  });
}

function addByFrequency(dateObj, freq) {
  const d = new Date(dateObj.getTime());
  switch (freq) {
    case "weekly": d.setDate(d.getDate() + 7); return d;
    case "biweekly": d.setDate(d.getDate() + 14); return d;
    case "monthly": return addMonths(d, 1);
    case "quarterly": return addMonths(d, 3);
    case "yearly": return addYears(d, 1);
    default: return addMonths(d, 1);
  }
}

function addMonths(dateObj, months) {
  const d = new Date(dateObj.getTime());
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return d;
}

function addYears(dateObj, years) {
  const d = new Date(dateObj.getTime());
  const month = d.getMonth();
  const day = d.getDate();
  d.setFullYear(d.getFullYear() + years, month, 1);
  const last = new Date(d.getFullYear(), month + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return d;
}

/* =========================
   General categories list
   ========================= */
function renderGeneralCategories() {
  const rows = state.minorCategories
    .filter(c => c.majorKey !== "bills" &&
                 c.majorKey !== "sinking" &&
                 c.majorKey !== "transfer")
    .slice()
    .sort((a, b) => (a.majorKey + a.name).localeCompare(b.majorKey + b.name))
    .map(c => `
      <tr>
        <td>${escapeHtml(getMajorLabel(c.majorKey))}</td>
        <td>${escapeHtml(c.name)}</td>
        <td class="text-end">${formatMoney(c.manualExpectedMonthly || 0)}</td>
        <td>
          <div class="d-flex gap-2">
            <button class="btn btn-sm btn-outline-secondary" onclick="editGeneralCategory('${c.id}')">Edit</button>
            <button class="btn btn-sm btn-outline-danger" onclick="deleteCategory('${c.id}')">Delete</button>
          </div>
        </td>
      </tr>
    `);

  catTbody.innerHTML = rows.join("") || `<tr><td colspan="4" class="text-muted">No general categories yet.</td></tr>`;
}

/* =========================
   CRUD: General categories
   ========================= */
function upsertGeneralMinorCategory() {
  const id = categoryId.value?.trim();
  const majorKey = categoryMajor.value;
  const name = categoryName.value.trim();
  const expected = safeNumber(categoryExpected.value);
  if (!name) return;

  if (majorKey === "bills" || majorKey === "sinking") {
    showToast("Bills and Sinking Funds must be managed in their tabs.");
    return;
  }

  const dupe = state.minorCategories.find(c =>
    c.majorKey === majorKey &&
    c.name.toLowerCase() === name.toLowerCase() &&
    c.id !== id
  );
  if (dupe) { showToast("That category already exists."); return; }

  if (id) {
    const c = state.minorCategories.find(x => x.id === id);
    if (!c) return;
    c.majorKey = majorKey;
    c.name = name;
    c.manualExpectedMonthly = expected;
    showToast("Category updated.");
  } else {
    state.minorCategories.push({
      id: uid(),
      majorKey,
      name,
      manualExpectedMonthly: expected,
      createdAt: new Date().toISOString(),
    });
    showToast("Category added.");
  }

  saveState();
  closeModal("modalCategory");
  categoryForm.reset();
  categoryId.value = "";
  categoryModalTitle.textContent = "Add Minor Category";
  refreshAll();
}

window.editGeneralCategory = function (id) {
  const c = state.minorCategories.find(x => x.id === id);
  if (!c) return;

  if (c.majorKey === "bills" || c.majorKey === "sinking") {
    showToast("Manage this category in its dedicated tab.");
    return;
  }

  categoryId.value = c.id;
  categoryMajor.value = c.majorKey;
  categoryName.value = c.name;
  categoryExpected.value = String(c.manualExpectedMonthly || 0);
  categoryModalTitle.textContent = "Edit Minor Category";
  openModal("modalCategory");
};

window.deleteCategory = function (id) {
  const c = state.minorCategories.find(x => x.id === id);
  if (!c) return;

  if (c.majorKey === "bills") return window.deleteBillsCategory(id);
  if (c.majorKey === "sinking") return window.deleteSinkingCategory(id);

  const usedInTx = state.transactions.some(t => t.minorCategoryId === id);
  const usedInGoals = state.goals.some(g => g.minorCategoryId === id);
  const usedInBills = state.bills.some(b => b.minorCategoryId === id);

  if (usedInTx || usedInGoals || usedInBills) {
    alert("Cannot delete: linked to transactions/goals/bills. Delete those first.");
    return;
  }

  showConfirmationModal(`Delete category "${c.name}"?`, () => {
    state.minorCategories = state.minorCategories.filter(x => x.id !== id);
    saveState();
    showToast("Category deleted.");
    refreshAll();
  });
};

/* =========================
   Transfers
   ========================= */
function upsertTransfer() {
  const date = transferDate.value;
  const fromId = transferFromAccount.value;
  const toId = transferToAccount.value;
  const amount = safeNumber(transferAmount.value);
  const desc = transferDescription.value.trim();

  if (!date || !fromId || !toId || !isFinite(amount) || amount <= 0) {
    showToast("Please fill all required transfer fields.");
    return;
  }

  if (fromId === toId) {
    showToast("From and To accounts cannot be the same.");
    return;
  }

  const transferCat = getTransferCategory();
  if (!transferCat) {
    alert("Error: Internal Transfer category not found. Please reload.");
    return;
  }

  const fromAcc = state.accounts.find(a => a.id === fromId);
  const toAcc = state.accounts.find(a => a.id === toId);
  if (!fromAcc || !toAcc) {
    alert("Error: Account not found.");
    return;
  }

  const transferId = uid();

  // Outflow from source
  state.transactions.push({
    id: uid(), transferId, accountId: fromId, minorCategoryId: transferCat.id,
    date, amount, transferType: 'out',
    description: desc ? `${desc} (to ${toAcc.name})` : `Transfer to ${toAcc.name}`,
    createdAt: new Date().toISOString(),
  });

  // Inflow to destination
  state.transactions.push({
    id: uid(), transferId, accountId: toId, minorCategoryId: transferCat.id,
    date, amount, transferType: 'in',
    description: desc ? `${desc} (from ${fromAcc.name})` : `Transfer from ${fromAcc.name}`,
    createdAt: new Date().toISOString(),
  });

  saveState();
  showToast("Transfer recorded.");
  closeModal("modalTransfer");
  refreshAll();
}

/* =========================
   Rentals
   ========================= */
function renderRentals() {
  if (!rentalsTbody || !rentalIncomeTbody) return;

  // 1. Render Properties List
  const list = state.rentals.slice().sort((a, b) => a.name.localeCompare(b.name));
  rentalsTbody.innerHTML = list.map(r => `
    <tr>
      <td>${escapeHtml(r.name)}</td>
      <td>${escapeHtml(r.address || "—")}</td>
      <td>${escapeHtml(r.tenant || "—")}</td>
      <td class="text-end">${formatMoney(r.amount)}</td>
      <td>
        <div class="d-flex gap-2">
          <button class="btn btn-sm btn-outline-secondary" data-action="edit-rental" data-id="${r.id}">Edit</button>
          <button class="btn btn-sm btn-outline-danger" data-action="delete-rental" data-id="${r.id}">Delete</button>
        </div>
      </td>
    </tr>
  `).join("") || `<tr><td colspan="5" class="text-muted">No rental properties added yet.</td></tr>`;

  // 2. Render Income Matrix
  const year = state.ui.rentalYear;
  ensureRentalYear(year);

  if (list.length === 0) {
    rentalIncomeTbody.innerHTML = `<tr><td colspan="14" class="text-muted">Add a property to track income.</td></tr>`;
    return;
  }

  rentalIncomeTbody.innerHTML = list.map(r => {
    const arr = getRentalIncomeArray(year, r.id);
    const total = arr.reduce((a, b) => a + safeNumber(b), 0);
    
    const inputs = arr.map((val, idx) => {
      const v = safeNumber(val);
      return `
        <td class="text-end p-1">
          <input 
            class="form-control form-control-sm text-end px-1" 
            style="min-width: 60px;"
            data-rental-year="${year}"
            data-rental-id="${r.id}"
            data-rental-month="${idx}"
            value="${v ? v : ""}"
            placeholder="${formatNumber(r.amount)}"
          >
        </td>
      `;
    }).join("");

    return `
      <tr>
        <td>${escapeHtml(r.name)}</td>
        ${inputs}
        <td class="text-end fw-bold">${formatMoney(total)}</td>
      </tr>
    `;
  }).join("");

  // Add listeners to new inputs
  rentalIncomeTbody.querySelectorAll("input[data-rental-year]").forEach(inp => {
    inp.addEventListener("input", (e) => {
      const el = e.target;
      const y = parseInt(el.dataset.rentalYear, 10);
      const rId = el.dataset.rentalId;
      const m = parseInt(el.dataset.rentalMonth, 10);
      const v = safeNumber(el.value);
      setRentalIncomeValue(y, rId, m, v);
      saveState();
      // Optional: update row total dynamically without full re-render for performance
      // For now, full re-render on blur or just let it be until refresh
    });
    inp.addEventListener("blur", () => renderRentals()); // Update totals on blur
  });
}

function upsertRental() {
  const id = rentalId.value?.trim();
  const name = rentalName.value.trim();
  const address = rentalAddress.value.trim();
  const tenant = rentalTenant.value.trim();
  const amount = safeNumber(rentalAmount.value);

  if (!name) return;

  if (id) {
    const r = state.rentals.find(x => x.id === id);
    if (!r) return;
    r.name = name;
    r.address = address;
    r.tenant = tenant;
    r.amount = amount;
    showToast("Property updated.");
  } else {
    state.rentals.push({
      id: uid(), name, address, tenant, amount,
      createdAt: new Date().toISOString()
    });
    showToast("Property added.");
  }
  saveState();
  closeModal("modalRental");
  refreshAll();
}

function editRental(id) {
  const r = state.rentals.find(x => x.id === id);
  if (!r) return;
  rentalId.value = r.id;
  rentalName.value = r.name;
  rentalAddress.value = r.address || "";
  rentalTenant.value = r.tenant || "";
  rentalAmount.value = String(r.amount);
  rentalModalTitle.textContent = "Edit Rental Property";
  openModal("modalRental");
}

function deleteRental(id) {
  const r = state.rentals.find(x => x.id === id);
  if (!r) return;
  showConfirmationModal(`Delete property "${r.name}"?`, () => {
    state.rentals = state.rentals.filter(x => x.id !== id);
    // Clean up income data
    for (const y of Object.keys(state.rentalIncome || {})) {
      if (state.rentalIncome[y] && state.rentalIncome[y][id]) delete state.rentalIncome[y][id];
    }
    saveState();
    showToast("Property deleted.");
    refreshAll();
  });
}

function ensureRentalYear(year) {
  if (!state.rentalIncome[year]) state.rentalIncome[year] = {};
}

function getRentalIncomeArray(year, rentalId) {
  ensureRentalYear(year);
  if (!state.rentalIncome[year][rentalId]) state.rentalIncome[year][rentalId] = Array(12).fill(0);
  return state.rentalIncome[year][rentalId];
}

function setRentalIncomeValue(year, rentalId, monthIdx, value) {
  const arr = getRentalIncomeArray(year, rentalId);
  arr[monthIdx] = safeNumber(value);
  state.rentalIncome[year][rentalId] = arr;
}

/* =========================
   Assets (Other)
   ========================= */
function renderAssets() {
  if (assetsTbody) {
    const list = state.otherAssets.slice().sort((a, b) => a.name.localeCompare(b.name));
    assetsTbody.innerHTML = list.map(a => `
      <tr>
        <td>
          <div class="fw-semibold">${escapeHtml(a.name)}</div>
          ${a.notes ? `<div class="small text-muted">${escapeHtml(a.notes)}</div>` : ""}
        </td>
        <td>${escapeHtml(a.category)}</td>
        <td class="text-end">${formatMoney(a.value)}</td>
        <td>
          <div class="d-flex gap-2">
            <button class="btn btn-sm btn-outline-secondary" data-action="edit-asset" data-id="${a.id}">Edit</button>
            <button class="btn btn-sm btn-outline-danger" data-action="delete-asset" data-id="${a.id}">Delete</button>
          </div>
        </td>
      </tr>
    `).join("") || `<tr><td colspan="4" class="text-muted">No other assets added yet.</td></tr>`;
  }
}

function upsertAsset() {
  const id = assetId.value?.trim();
  const name = assetName.value.trim();
  const category = assetCategory.value;
  const value = safeNumber(assetValue.value);
  const notes = assetNotes.value.trim();

  if (!name) return;

  if (id) {
    const a = state.otherAssets.find(x => x.id === id);
    if (!a) return;
    a.name = name;
    a.category = category;
    a.value = value;
    a.notes = notes;
    showToast("Asset updated.");
  } else {
    state.otherAssets.push({
      id: uid(),
      name,
      category,
      value,
      notes,
      createdAt: new Date().toISOString()
    });
    showToast("Asset added.");
  }
  saveState();
  closeModal("modalAsset");
  refreshAll();
}

function editAsset(id) {
  const a = state.otherAssets.find(x => x.id === id);
  if (!a) return;
  assetId.value = a.id;
  assetName.value = a.name;
  assetCategory.value = a.category;
  assetValue.value = String(a.value);
  assetNotes.value = a.notes || "";
  assetModalTitle.textContent = "Edit Asset";
  openModal("modalAsset");
}

function deleteAsset(id) {
  const a = state.otherAssets.find(x => x.id === id);
  if (!a) return;
  showConfirmationModal(`Delete asset "${a.name}"?`, () => {
    state.otherAssets = state.otherAssets.filter(x => x.id !== id);
    saveState();
    showToast("Asset deleted.");
    refreshAll();
  });
}

/* =========================
   Net Worth
   ========================= */
function renderNetWorth() {
  if (!nwTbody) return;

  // 1. Calculate Assets
  // Accounts > 0
  let cashAssets = 0;
  let investmentAssets = 0;
  
  // Calculate current balances first (reusing logic from renderAccounts)
  const balances = {};
  state.accounts.forEach(a => balances[a.id] = safeNumber(a.initialBalance));
  state.transactions.forEach(t => {
    if (!t.accountId || balances[t.accountId] === undefined) return;
    const cat = getCategory(t.minorCategoryId);
    const type = cat ? MAJOR_TYPES[cat.majorKey] : null;
    if (type === 'transfer') {
      if (t.transferType === 'in') balances[t.accountId] += safeNumber(t.amount);
      else balances[t.accountId] -= safeNumber(t.amount);
    } else if (type === "inflow") {
      balances[t.accountId] += safeNumber(t.amount);
    } else {
      balances[t.accountId] -= safeNumber(t.amount);
    }
  });

  state.accounts.forEach(a => {
    const bal = balances[a.id];
    if (bal > 0) {
      if (a.type === 'Investment') investmentAssets += bal;
      else cashAssets += bal;
    }
  });

  // Stocks
  const stockAssets = computeTotalStockValue();
  // Other Assets
  const otherAssets = state.otherAssets.reduce((sum, a) => sum + safeNumber(a.value), 0);

  const totalAssets = cashAssets + investmentAssets + stockAssets + otherAssets;

  // 2. Calculate Liabilities
  // Accounts < 0
  let accountLiabilities = 0;
  state.accounts.forEach(a => {
    const bal = balances[a.id];
    if (bal < 0) accountLiabilities += Math.abs(bal);
  });

  // Debts from Debt Snowball
  let otherDebts = state.debts.reduce((sum, d) => sum + safeNumber(d.balance), 0);
  const totalLiabilities = accountLiabilities + otherDebts;

  // 3. Render
  nwAssets.textContent = formatMoney(totalAssets);
  nwLiabilities.textContent = formatMoney(totalLiabilities);
  const netWorth = totalAssets - totalLiabilities;
  nwTotal.textContent = formatMoney(netWorth);
  nwTotal.classList.toggle("text-danger", netWorth < 0);
  nwTotal.classList.toggle("text-success", netWorth >= 0);

  nwTbody.innerHTML = `
    <tr><td>Cash & Bank Accounts</td><td class="text-end">${formatMoney(cashAssets)}</td></tr>
    <tr><td>Investment Accounts</td><td class="text-end">${formatMoney(investmentAssets)}</td></tr>
    <tr><td>Stock Holdings</td><td class="text-end">${formatMoney(stockAssets)}</td></tr>
    <tr><td>Property & Other Assets</td><td class="text-end">${formatMoney(otherAssets)}</td></tr>
    <tr class="table-light fw-bold"><td>Total Assets</td><td class="text-end">${formatMoney(totalAssets)}</td></tr>
    <tr><td colspan="2">&nbsp;</td></tr>
    <tr><td>Credit Cards / Overdrafts</td><td class="text-end text-danger">-${formatMoney(accountLiabilities)}</td></tr>
    <tr><td>Other Debts (Loans, etc.)</td><td class="text-end text-danger">-${formatMoney(otherDebts)}</td></tr>
    <tr class="table-light fw-bold"><td>Total Liabilities</td><td class="text-end text-danger">-${formatMoney(totalLiabilities)}</td></tr>
  `;

  // 4. Chart
  const ctx = document.getElementById("netWorthChart")?.getContext("2d");
  if (ctx) {
    if (netWorthChart) netWorthChart.destroy();
    netWorthChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Assets', 'Liabilities'],
        datasets: [{
          data: [totalAssets, totalLiabilities],
          backgroundColor: ['#69856D', '#C27250'],
          borderWidth: 0
        }]
      },
      options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
    });
  }
}

/* =========================
   Expected/Actual calculations
   ========================= */
function computeExpectedByMinor() {
  const expected = {};
  for (const c of state.minorCategories) {
    expected[c.id] = (c.majorKey === "bills" || c.majorKey === "sinking")
      ? 0
      : safeNumber(c.manualExpectedMonthly || 0);
  }

  for (const g of state.goals) {
    const monthly = computeGoalMonthlyRequired(g);
    expected[g.minorCategoryId] = (expected[g.minorCategoryId] || 0) + monthly;
  }

  for (const b of state.bills) {
    const monthlyEq = computeBillMonthlyEquivalent(b);
    expected[b.minorCategoryId] = (expected[b.minorCategoryId] || 0) + monthlyEq;
  }

  return expected;
}

function computeGoalMonthlyRequired(goal) {
  const total = safeNumber(goal.totalAmount);
  if (total <= 0) return 0;

  const now = new Date();
  const deadline = goal.deadlineISO ? new Date(goal.deadlineISO + "T00:00:00") : null;
  if (!deadline || isNaN(deadline.getTime())) return 0;

  let months = monthsBetweenInclusive(now, deadline);
  months = Math.max(1, months);

  return total / months;
}

function computeBillMonthlyEquivalent(bill) {
  const amt = safeNumber(bill.amount);
  const mult = FREQUENCY_TO_MONTHLY_MULTIPLIER[bill.frequency] || 1;
  return amt * mult;
}

function computeActualByMinor(year, month) {
  const totals = {};
  for (const t of state.transactions) {
    if (year != null && month != null) {
      if (!isInMonth(t.date, year, month)) continue;
    }
    totals[t.minorCategoryId] = (totals[t.minorCategoryId] || 0) + safeNumber(t.amount);
  }
  return totals;
}




/* =========================
   Export/Import
   ========================= */
function exportJSON() {
  const data = JSON.stringify(state, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "budget-data.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  showToast("Exported JSON.");
}

function importJSON(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!parsed || typeof parsed !== "object") throw new Error("Invalid");

      const merged = defaultState();
      state = {
        ...merged,
        ...parsed,
        pensionRates: (parsed.pensionRates && typeof parsed.pensionRates === "object") ? parsed.pensionRates : {},
        otherAssets: Array.isArray(parsed.otherAssets) ? parsed.otherAssets : [],
        rentals: Array.isArray(parsed.rentals) ? parsed.rentals : [],
        rentalIncome: (parsed.rentalIncome && typeof parsed.rentalIncome === "object") ? parsed.rentalIncome : {},
        debts: Array.isArray(parsed.debts) ? parsed.debts : [],
        fire: parsed.fire || merged.fire,
        ui: { ...merged.ui, ...(parsed.ui || {}) },
        minorCategories: Array.isArray(parsed.minorCategories) ? parsed.minorCategories : [],
        transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
        goals: Array.isArray(parsed.goals) ? parsed.goals : [],
        bills: Array.isArray(parsed.bills) ? parsed.bills : [],
        billPayments: Array.isArray(parsed.billPayments) ? parsed.billPayments : [],
        stocksMaster: Array.isArray(parsed.stocksMaster) ? parsed.stocksMaster : [],
        holdings: Array.isArray(parsed.holdings) ? parsed.holdings : [],
        dividends: (parsed.dividends && typeof parsed.dividends === "object") ? parsed.dividends : {},
      };

      saveState();
      showToast("Imported JSON.");
      refreshAll();
    } catch {
      alert("Import failed: invalid JSON file.");
    } finally {
      fileImport.value = "";
    }
  };
  reader.readAsText(file);
}

/* =========================
   Seed
   ========================= */
function seedStarterCategories() {
  const starter = [
    { majorKey: "income", name: "Salary", manualExpectedMonthly: 0 },
    { majorKey: "variable", name: "Groceries", manualExpectedMonthly: 0 },
    { majorKey: "bills", name: "Electricity", manualExpectedMonthly: 0 },
    { majorKey: "sinking", name: "Emergency Fund", manualExpectedMonthly: 0 },
    { majorKey: "invest", name: "Brokerage", manualExpectedMonthly: 0 },
  ];

  state.minorCategories = starter.map(s => ({
    id: uid(),
    majorKey: s.majorKey,
    name: s.name,
    manualExpectedMonthly: (s.majorKey === "bills" || s.majorKey === "sinking") ? 0 : s.manualExpectedMonthly,
    createdAt: new Date().toISOString(),
  }));
}