const STORAGE_KEY = "budgetTracker.v1";

const MAJOR_CATEGORIES = [
  { key: "income", label: "Income" },
  { key: "fixed", label: "Fixed Expenses" },
  { key: "variable", label: "Variable Expenses" },
  { key: "bills", label: "Bills" },
  { key: "sinking", label: "Sinking (Savings) Fund" },
  { key: "fun", label: "Fun Money" },
  { key: "invest", label: "Investments" },
];

const MAJOR_TYPES = {
  income: "inflow",
  fixed: "outflow",
  variable: "outflow",
  bills: "outflow",
  sinking: "savings",
  fun: "outflow",
  invest: "savings",
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

/* ---------- DOM ---------- */
const yearInput = document.getElementById("yearInput");
const monthSelect = document.getElementById("monthSelect");
const btnThisMonth = document.getElementById("btnThisMonth");
const btnRecalc = document.getElementById("btnRecalc");

const sumIncome = document.getElementById("sumIncome");
const sumExpenses = document.getElementById("sumExpenses");
const sumNet = document.getElementById("sumNet");
const sumSaveInvest = document.getElementById("sumSaveInvest");

const sumStocksValue = document.getElementById("sumStocksValue");
const sumDivTTM = document.getElementById("sumDivTTM");

const billsPaidSummary = document.getElementById("billsPaidSummary");
const billsPaidBar = document.getElementById("billsPaidBar");

const budgetTbody = document.getElementById("budgetTbody");
const txTbody = document.getElementById("txTbody");
const goalsWrap = document.getElementById("goalsWrap");
const billsTbody = document.getElementById("billsTbody");
const catTbody = document.getElementById("catTbody");
const sinkingCatTbody = document.getElementById("sinkingCatTbody");
const billsCatTbody = document.getElementById("billsCatTbody");

const btnExport = document.getElementById("btnExport");
const fileImport = document.getElementById("fileImport");
const btnReset = document.getElementById("btnReset");

/* Averages tab */
const avgStart = document.getElementById("avgStart");
const avgEnd = document.getElementById("avgEnd");
const avgMonths = document.getElementById("avgMonths");
const avgIncomeValue = document.getElementById("avgIncomeValue");
const avgExpenseValue = document.getElementById("avgExpenseValue");
const avgTbody = document.getElementById("avgTbody");
const btnAvgRefresh = document.getElementById("btnAvgRefresh");

/* Stocks tab */
const stockMasterForm = document.getElementById("stockMasterForm");
const stockMasterId = document.getElementById("stockMasterId");
const stockTicker = document.getElementById("stockTicker");
const stockMarket = document.getElementById("stockMarket");
const stockPrice = document.getElementById("stockPrice");
const stockMasterCancel = document.getElementById("stockMasterCancel");
const stocksMasterTbody = document.getElementById("stocksMasterTbody");

const holdingForm = document.getElementById("holdingForm");
const holdingId = document.getElementById("holdingId");
const holdingStockId = document.getElementById("holdingStockId");
const holdingAvgPrice = document.getElementById("holdingAvgPrice");
const holdingShares = document.getElementById("holdingShares");
const holdingCancel = document.getElementById("holdingCancel");
const holdingsTbody = document.getElementById("holdingsTbody");

/* Dividends tab */
const divYear = document.getElementById("divYear");
const btnDivRefresh = document.getElementById("btnDivRefresh");
const divTbody = document.getElementById("divTbody");
const divMonthlyTotalsRow = document.getElementById("divMonthlyTotalsRow");

/* General category modal */
const categoryForm = document.getElementById("categoryForm");
const categoryModalTitle = document.getElementById("categoryModalTitle");
const categoryId = document.getElementById("categoryId");
const categoryMajor = document.getElementById("categoryMajor");
const categoryName = document.getElementById("categoryName");
const categoryExpected = document.getElementById("categoryExpected");

/* Sinking category modal */
const sinkingCategoryForm = document.getElementById("sinkingCategoryForm");
const sinkingCategoryModalTitle = document.getElementById("sinkingCategoryModalTitle");
const sinkingCategoryId = document.getElementById("sinkingCategoryId");
const sinkingCategoryName = document.getElementById("sinkingCategoryName");

/* Bills category modal */
const billsCategoryForm = document.getElementById("billsCategoryForm");
const billsCategoryModalTitle = document.getElementById("billsCategoryModalTitle");
const billsCategoryId = document.getElementById("billsCategoryId");
const billsCategoryName = document.getElementById("billsCategoryName");

/* Transaction modal */
const txForm = document.getElementById("txForm");
const modalTransactionEl = document.getElementById("modalTransaction");
const txModalTitle = document.getElementById("txModalTitle");
const txSubmitBtn = document.getElementById("txSubmitBtn");
const txId = document.getElementById("txId");
const txDate = document.getElementById("txDate");
const txMajor = document.getElementById("txMajor");
const txMinor = document.getElementById("txMinor");
const txDesc = document.getElementById("txDesc");
const txAmount = document.getElementById("txAmount");

/* Goals */
const goalForm = document.getElementById("goalForm");
const modalGoalEl = document.getElementById("modalGoal");
const goalModalTitle = document.getElementById("goalModalTitle");
const goalId = document.getElementById("goalId");
const goalName = document.getElementById("goalName");
const goalMinor = document.getElementById("goalMinor");
const goalTotal = document.getElementById("goalTotal");
const goalDeadlineDate = document.getElementById("goalDeadlineDate");
const goalDurationMonths = document.getElementById("goalDurationMonths");

/* Bills (recurring) */
const billForm = document.getElementById("billForm");
const billModalTitle = document.getElementById("billModalTitle");
const billId = document.getElementById("billId");
const billMinor = document.getElementById("billMinor");
const billAmount = document.getElementById("billAmount");
const billFreq = document.getElementById("billFreq");
const billNextDue = document.getElementById("billNextDue");

/* Toast */
const toastEl = document.getElementById("appToast");
const toastBody = document.getElementById("toastBody");
const toast = toastEl ? new bootstrap.Toast(toastEl, { delay: 2000 }) : null;

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
    .filter(m => m.key !== "bills" && m.key !== "sinking")
    .map(m => `<option value="${m.key}">${m.label}</option>`)
    .join("");

  if (state.minorCategories.length === 0) {
    seedStarterCategories();
    saveState();
  }

  if (!Array.isArray(state.billPayments)) state.billPayments = [];
  if (!Array.isArray(state.stocksMaster)) state.stocksMaster = [];
  if (!Array.isArray(state.holdings)) state.holdings = [];
  if (!state.dividends || typeof state.dividends !== "object") state.dividends = {};

  wireEvents();
  refreshAll();
}

/* =========================
   Events
   ========================= */
function wireEvents() {
  btnThisMonth.addEventListener("click", () => {
    const now = new Date();
    yearInput.value = now.getFullYear();
    monthSelect.value = String(now.getMonth());
    persistSelectedMonth();
    refreshAll();
  });

  yearInput.addEventListener("change", () => { persistSelectedMonth(); refreshAll(); });
  monthSelect.addEventListener("change", () => { persistSelectedMonth(); refreshAll(); });

  btnRecalc.addEventListener("click", () => refreshAll());

  modalTransactionEl.addEventListener("show.bs.modal", () => {
    if (!txId.value) {
      setTxModalMode("add");
      txDate.value = toISODate(new Date());
      txDesc.value = "";
      txAmount.value = "";
      if (!txMajor.value) txMajor.value = "variable";
      repopulateTxMinorOptions(txMajor.value, true);
    }
  });

  txMajor.addEventListener("change", () => {
    repopulateTxMinorOptions(txMajor.value, true);
  });

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

  categoryForm.addEventListener("submit", (e) => { e.preventDefault(); upsertGeneralMinorCategory(); });
  sinkingCategoryForm.addEventListener("submit", (e) => { e.preventDefault(); upsertSinkingCategory(); });
  billsCategoryForm.addEventListener("submit", (e) => { e.preventDefault(); upsertBillsCategory(); });

  txForm.addEventListener("submit", (e) => { e.preventDefault(); upsertTransaction(); });
  goalForm.addEventListener("submit", (e) => { e.preventDefault(); upsertGoal(); });
  billForm.addEventListener("submit", (e) => { e.preventDefault(); upsertBill(); });

  btnExport.addEventListener("click", exportJSON);
  fileImport.addEventListener("change", importJSON);

  btnReset.addEventListener("click", () => {
    if (!confirm("Reset all budget data? This cannot be undone.")) return;
    state = defaultState();
    saveState();
    init();
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

  /* Stocks */
  stockMasterForm.addEventListener("submit", (e) => { e.preventDefault(); upsertStockMaster(); });
  stockMasterCancel.addEventListener("click", () => resetStockMasterForm());

  holdingForm.addEventListener("submit", (e) => { e.preventDefault(); upsertHolding(); });
  holdingCancel.addEventListener("click", () => resetHoldingForm());

  /* Dividends */
  divYear.addEventListener("change", () => {
    state.ui.divYear = clampInt(divYear.value, 2000, 2100, new Date().getFullYear());
    divYear.value = String(state.ui.divYear);
    saveState();
    renderDividends();
    refreshTopInvestmentMetrics(); // keep top in sync
  });
  btnDivRefresh.addEventListener("click", () => { renderDividends(); refreshTopInvestmentMetrics(); });
}

/* =========================
   Refresh
   ========================= */
function refreshAll() {
  renderCategoryDropdowns();

  const expectedByMinor = computeExpectedByMinor();
  const sel = getSelectedMonth();
  const actualByMinor = computeActualByMinor(sel.year, sel.month);

  renderBudgetTable(expectedByMinor, actualByMinor);
  renderTransactionsTable(sel.year, sel.month);
  renderGoals(expectedByMinor);
  renderSinkingCategories(expectedByMinor, actualByMinor);
  renderBillsCategories(expectedByMinor);
  renderBills(sel.year, sel.month); // FIXED: show ALL bills
  renderGeneralCategories();

  renderSummary(actualByMinor);
  renderBillsPaidTracker(sel.year, sel.month);

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
  txMajor.innerHTML = MAJOR_CATEGORIES.map(m => `<option value="${m.key}">${m.label}</option>`).join("");
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
}

function repopulateTxMinorOptions(majorKey, forceSelectFirst) {
  const minors = state.minorCategories
    .filter(c => c.majorKey === majorKey)
    .sort((a, b) => a.name.localeCompare(b.name));

  txMinor.innerHTML = minors.length
    ? minors.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("")
    : `<option value="" disabled selected>No minor categories in this major</option>`;

  if (forceSelectFirst && minors.length) txMinor.value = minors[0].id;
}

/* =========================
   Summary
   ========================= */
function renderSummary(actualByMinor) {
  let income = 0, expenses = 0, saveInvest = 0;

  for (const cat of state.minorCategories) {
    const actual = actualByMinor[cat.id] || 0;
    const type = MAJOR_TYPES[cat.majorKey];
    if (type === "inflow") income += actual;
    else if (type === "outflow") expenses += actual;
    else if (type === "savings") saveInvest += actual;
  }

  const net = income - expenses - saveInvest;

  sumIncome.textContent = formatMoney(income);
  sumExpenses.textContent = formatMoney(expenses);
  sumSaveInvest.textContent = formatMoney(saveInvest);
  sumNet.textContent = formatMoney(net);

  sumNet.classList.toggle("text-danger", net < 0);
  sumNet.classList.toggle("text-success", net >= 0);
}

/* =========================
   Top: Stocks Value + TTM Dividends
   ========================= */
function refreshTopInvestmentMetrics() {
  if (sumStocksValue) sumStocksValue.textContent = formatMoney(computeTotalStockValue());
  if (sumDivTTM) sumDivTTM.textContent = formatMoney(computeTrailing12MDividendIncome());
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
   Transactions (edit supported)
   ========================= */
function renderTransactionsTable(year, month) {
  const list = state.transactions
    .filter(t => isInMonth(t.date, year, month))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (!list.length) {
    txTbody.innerHTML = `<tr><td colspan="6" class="text-muted">No transactions for this month.</td></tr>`;
    return;
  }

  txTbody.innerHTML = list.map(t => {
    const cat = getCategory(t.minorCategoryId);
    const majorLabel = cat ? getMajorLabel(cat.majorKey) : "—";
    const minorLabel = cat ? cat.name : "—";

    return `
      <tr>
        <td>${escapeHtml(t.date)}</td>
        <td>${escapeHtml(t.description || "")}</td>
        <td>${escapeHtml(majorLabel)}</td>
        <td>${escapeHtml(minorLabel)}</td>
        <td class="text-end">${formatMoney(t.amount)}</td>
        <td>
          <div class="d-flex gap-2">
            <button class="btn btn-sm btn-outline-secondary" onclick="editTransaction('${t.id}')">Edit</button>
            <button class="btn btn-sm btn-outline-danger" onclick="deleteTransaction('${t.id}')">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function setTxModalMode(mode) {
  if (mode === "edit") {
    txModalTitle.textContent = "Edit Transaction";
    txSubmitBtn.textContent = "Save";
    txSubmitBtn.classList.remove("btn-success");
    txSubmitBtn.classList.add("btn-primary");
  } else {
    txModalTitle.textContent = "Add Transaction";
    txSubmitBtn.textContent = "Add";
    txSubmitBtn.classList.remove("btn-primary");
    txSubmitBtn.classList.add("btn-success");
  }
}

function upsertTransaction() {
  const id = txId.value?.trim();
  const date = txDate.value;
  const majorKey = txMajor.value;
  const minorId = txMinor.value;
  const amount = safeNumber(txAmount.value);
  const desc = txDesc.value.trim();

  if (!date || !majorKey || !minorId || !isFinite(amount)) return;

  const cat = getCategory(minorId);
  if (!cat || cat.majorKey !== majorKey) {
    alert("Selected minor category does not match the selected major category.");
    return;
  }

  if (id) {
    const t = state.transactions.find(x => x.id === id);
    if (!t) return;

    t.date = date;
    t.minorCategoryId = minorId;
    t.amount = amount;
    t.description = desc;

    showToast("Transaction updated.");
  } else {
    state.transactions.push({
      id: uid(),
      date,
      minorCategoryId: minorId,
      amount,
      description: desc,
      createdAt: new Date().toISOString(),
    });
    showToast("Transaction added.");
  }

  saveState();
  closeModal("modalTransaction");
  txForm.reset();
  txId.value = "";
  setTxModalMode("add");
  refreshAll();
}

window.editTransaction = function (id) {
  const t = state.transactions.find(x => x.id === id);
  if (!t) return;

  const cat = getCategory(t.minorCategoryId);
  const majorKey = cat ? cat.majorKey : "variable";

  txId.value = t.id;
  txDate.value = t.date;
  txMajor.value = majorKey;

  repopulateTxMinorOptions(majorKey, false);
  txMinor.value = t.minorCategoryId;

  txDesc.value = t.description || "";
  txAmount.value = String(t.amount);

  setTxModalMode("edit");
  openModal("modalTransaction");
};

window.deleteTransaction = function (id) {
  const t = state.transactions.find(x => x.id === id);
  if (!t) return;
  if (!confirm("Delete this transaction?")) return;

  state.transactions = state.transactions.filter(x => x.id !== id);
  saveState();
  showToast("Transaction deleted.");
  refreshAll();
};

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
  if (!confirm(`Delete goal "${g.name}"?`)) return;

  state.goals = state.goals.filter(x => x.id !== id);
  saveState();
  showToast("Goal deleted.");
  refreshAll();
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

window.deleteBill = function (id) {
  const b = state.bills.find(x => x.id === id);
  if (!b) return;
  if (!confirm("Delete this recurring bill?")) return;

  state.bills = state.bills.filter(x => x.id !== id);
  // Keep billPayments for backward compatibility; no longer used for paid logic

  saveState();
  showToast("Bill deleted.");
  refreshAll();
};

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
   Stocks
   ========================= */
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

window.deleteStockMaster = function(id) {
  const s = state.stocksMaster.find(x => x.id === id);
  if (!s) return;

  const usedInHoldings = state.holdings.some(h => h.stockId === id);
  if (usedInHoldings) {
    alert("Cannot delete: this stock is linked to holdings. Delete holdings first.");
    return;
  }

  if (!confirm(`Delete stock ${s.ticker} (${s.market})?`)) return;
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
};

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

window.deleteHolding = function(id) {
  const h = state.holdings.find(x => x.id === id);
  if (!h) return;
  if (!confirm("Delete this holding?")) return;
  state.holdings = state.holdings.filter(x => x.id !== id);
  saveState();
  showToast("Holding deleted.");
  resetHoldingForm();
  renderStocks();
  renderDividends();
  refreshTopInvestmentMetrics();
};

function getStockMaster(id) {
  return state.stocksMaster.find(s => s.id === id) || null;
}

/* =========================
   Dividends
   ========================= */
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

/* =========================
   General categories list
   ========================= */
function renderGeneralCategories() {
  const rows = state.minorCategories
    .filter(c => c.majorKey !== "bills" && c.majorKey !== "sinking")
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

  if (!confirm(`Delete category "${c.name}"?`)) return;
  state.minorCategories = state.minorCategories.filter(x => x.id !== id);
  saveState();
  showToast("Category deleted.");
  refreshAll();
};

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
   Helpers
   ========================= */
function getSelectedMonth() {
  const year = clampInt(yearInput.value, 2000, 2100, new Date().getFullYear());
  const month = clampInt(monthSelect.value, 0, 11, new Date().getMonth());
  return { year, month };
}

function getMajorLabel(key) {
  return MAJOR_CATEGORIES.find(m => m.key === key)?.label || key;
}

function getCategory(id) {
  return state.minorCategories.find(c => c.id === id) || null;
}

function isInMonth(isoDate, year, month) {
  if (!isoDate) return false;
  const [y, m] = isoDate.split("-").map(n => parseInt(n, 10));
  return y === year && (m - 1) === month;
}

function monthsBetweenInclusive(startDate, endDate) {
  const sY = startDate.getFullYear(), sM = startDate.getMonth();
  const eY = endDate.getFullYear(), eM = endDate.getMonth();
  return (eY - sY) * 12 + (eM - sM) + 1;
}

function uid() {
  return Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
}

function safeNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function clampInt(v, min, max, fallback) {
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function formatMoney(n) {
  const x = Number.isFinite(n) ? n : 0;
  return x.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function formatNumber(n) {
  const x = Number.isFinite(n) ? n : 0;
  return x.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

function capitalize(s) {
  return (s || "").slice(0, 1).toUpperCase() + (s || "").slice(1);
}

function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseISODate(iso) {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  return isNaN(d.getTime()) ? null : d;
}

function isInRange(dateISO, startISO, endISO) {
  return dateISO >= startISO && dateISO <= endISO;
}

function countMonthsInclusive(start, end) {
  return monthsBetweenInclusive(start, end);
}

function escapeHtml(str) {
  return (str ?? "").toString()
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(msg) {
  if (!toast) return;
  toastBody.textContent = msg;
  toast.show();
}

function openModal(id) {
  const el = document.getElementById(id);
  const m = bootstrap.Modal.getOrCreateInstance(el);
  m.show();
}

function closeModal(id) {
  const el = document.getElementById(id);
  const m = bootstrap.Modal.getInstance(el);
  if (m) m.hide();
}

/* =========================
   Storage
   ========================= */
function defaultState() {
  return {
    ui: {
      selectedYear: null,
      selectedMonth: null,
      avgStart: "",
      avgEnd: "",
      divYear: null
    },
    minorCategories: [],
    transactions: [],
    goals: [],
    bills: [],
    billPayments: [], // legacy; no longer used for paid logic
    stocksMaster: [],
    holdings: [],
    dividends: {},
    meta: { createdAt: new Date().toISOString() }
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);

    const base = defaultState();

    const st = {
      ...base,
      ui: { ...base.ui, ...(parsed.ui || {}) },
      minorCategories: Array.isArray(parsed.minorCategories) ? parsed.minorCategories : [],
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
      goals: Array.isArray(parsed.goals) ? parsed.goals : [],
      bills: Array.isArray(parsed.bills) ? parsed.bills : [],
      billPayments: Array.isArray(parsed.billPayments) ? parsed.billPayments : [],
      stocksMaster: Array.isArray(parsed.stocksMaster) ? parsed.stocksMaster : [],
      holdings: Array.isArray(parsed.holdings) ? parsed.holdings : [],
      dividends: (parsed.dividends && typeof parsed.dividends === "object") ? parsed.dividends : {},
      meta: parsed.meta || base.meta
    };

    return st;
  } catch {
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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