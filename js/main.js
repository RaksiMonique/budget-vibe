import { state, loadState, saveState, defaultState, getCategory, getMajorLabel, getTransferCategory, ensureTransferCategory, seedStarterCategories } from './store.js';
import { MAJOR_CATEGORIES, MAJOR_TYPES, FREQUENCY_TO_MONTHLY_MULTIPLIER, MONTHS } from './constants.js';
import { uid, safeNumber, formatMoney, escapeHtml, capitalize, toISODate, clampInt, showToast, openModal, closeModal, showConfirmationModal, addMonths, addYears, monthsBetweenInclusive } from './utils.js';
import { computeSinkingFundBalance, computeGoalMonthlyRequired } from './calculations.js';

import { initAccounts, renderAccounts, computeAccountBalances, seedStarterAccounts } from './features/accounts.js';
import { initAssets, renderAssets } from './features/assets.js';
import { initAverages, renderAverages, renderAnnualOverview } from './features/averages.js';
import { initBudget, renderBudgetTable } from './features/budget.js';
import { initDebts, renderDebts, renderDebtsForAssetsTab } from './features/debt.js';
import { initDividends, renderDividends, computeTrailing12MDividendIncome, addMonthsYearMonth, computeDividendIncomeForMonth } from './features/dividends.js';
import { initFIRE, renderFIRE } from './features/fire.js';
import { initNetWorth, renderNetWorth } from './features/networth.js';
import { initRentals, renderRentals } from './features/rentals.js';
import { initSavings, renderGoals, renderSinkingCategories, deleteSinkingCategory } from './features/savings.js';
import { initStocks, renderStocks, computeTotalStockValue } from './features/stocks.js';
import { initStockPlan, renderStockPlan } from './features/stockPlan.js';
import { initTransactions, renderTransactionsTable, repopulateTxMinorOptions, upsertTransfer, updateTransferToOptions, updateTransferFromOptions } from './features/transactions.js';
import { initBills, renderBills, renderBillsCategories, handleBillModalOpen, isBillPaidByTransactions, computeFirstDueInMonth, upsertBill, upsertBillsCategory, deleteBillsCategory, deleteCategory, computeBillMonthlyEquivalent } from './features/bills.js';
import { initCategories, renderGeneralCategories } from './features/categories.js';

// Chart instances
let budgetDonutChart = null;
let billsBarChart = null;

// DOM Elements (cache them)
const yearInput = document.getElementById('yearInput');
const monthSelect = document.getElementById('monthSelect');
const displayMonthYear = document.getElementById('displayMonthYear');

function getSelectedMonth() {
    const y = clampInt(yearInput.value, 2000, 2100, new Date().getFullYear());
    const m = clampInt(monthSelect.value, 0, 11, new Date().getMonth());
    return { year: y, month: m };
}

function init() {
  loadState();

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
  document.getElementById('avgStart').value = state.ui.avgStart;
  document.getElementById('avgEnd').value = state.ui.avgEnd;

  // Init transaction filters
  document.getElementById('txFilterStart').value = state.ui.txFilterStart || "";
  document.getElementById('txFilterEnd').value = state.ui.txFilterEnd || "";

  // Default for annual overview year
  if (!state.ui.annualOverviewYear) {
    state.ui.annualOverviewYear = now.getFullYear();
  }

  // Default for annual overview granularity
  if (!state.ui.annualOverviewGranularity) {
    state.ui.annualOverviewGranularity = 'major';
  }

  // Default dividends year
  if (!state.ui.divYear) state.ui.divYear = now.getFullYear();
  document.getElementById('divYear').value = String(state.ui.divYear);

  document.getElementById('categoryMajor').innerHTML = MAJOR_CATEGORIES
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
  if (!Array.isArray(state.goals)) state.goals = [];

  if (!Array.isArray(state.billPayments)) state.billPayments = [];
  if (!Array.isArray(state.stocksMaster)) state.stocksMaster = [];
  if (!Array.isArray(state.holdings)) state.holdings = [];
  if (!state.dividends || typeof state.dividends !== "object") state.dividends = {};
  if (!state.stockPlan || typeof state.stockPlan !== "object") state.stockPlan = {};

  if (!state.ui.rentalYear) state.ui.rentalYear = now.getFullYear();
  document.getElementById('rentalYear').value = String(state.ui.rentalYear);
  if (!state.rentalIncome || typeof state.rentalIncome !== "object") state.rentalIncome = {};

  wireEvents();
  refreshAll();
}

function wireEvents() {
  document.getElementById('themeToggle').addEventListener("click", () => {
    const currentTheme = document.documentElement.getAttribute("data-theme");
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", newTheme);
    state.ui.theme = newTheme;
    saveState();
  });

  document.getElementById('btnThisMonth').addEventListener("click", () => {
    const now = new Date();
    yearInput.value = now.getFullYear();
    monthSelect.value = String(now.getMonth());
    persistSelectedMonth();
    refreshAll();
    showToast("Budget set to current month.");
  });

  document.getElementById('pensionInput').addEventListener("change", (e) => {
    const sel = getSelectedMonth();
    const key = `${sel.year}-${sel.month}`;
    if (!state.pensionRates) state.pensionRates = {};
    state.pensionRates[key] = safeNumber(e.target.value);
    saveState();
    refreshAll();
  });

  yearInput.addEventListener("change", () => { persistSelectedMonth(); refreshAll(); });
  monthSelect.addEventListener("change", () => { persistSelectedMonth(); refreshAll(); });

  const modalBillEl = document.getElementById("modalBill");
  if (modalBillEl) {
    modalBillEl.addEventListener("show.bs.modal", handleBillModalOpen);
    modalBillEl.addEventListener("hidden.bs.modal", () => {
      document.getElementById('billForm').reset();
      document.getElementById('billId').value = "";
      document.getElementById('billModalTitle').textContent = "Add Recurring Bill";
    });
  }

  document.getElementById('transferForm').addEventListener("submit", (e) => { e.preventDefault(); upsertTransfer(refreshAll); });
  document.getElementById('modalTransfer').addEventListener("show.bs.modal", (event) => {
    const button = event.relatedTarget;
    const fromAccountId = button ? button.dataset.fromAccountId : null;

    document.getElementById('transferForm').reset();
    document.getElementById('transferDate').value = toISODate(new Date());
    const accs = state.accounts.sort((a,b) => a.name.localeCompare(b.name));
    const options = accs.map(a => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join("");
    const transferFromAccount = document.getElementById('transferFromAccount');
    const transferToAccount = document.getElementById('transferToAccount');
    transferFromAccount.innerHTML = options;
    transferToAccount.innerHTML = options;

    if (fromAccountId && accs.some(a => a.id === fromAccountId)) {
      transferFromAccount.value = fromAccountId;
      const toAccount = accs.find(a => a.id !== fromAccountId);
      if (toAccount) {
        transferToAccount.value = toAccount.id;
      }
    } else if (accs.length > 1) {
      transferFromAccount.value = accs[0].id;
      transferToAccount.value = accs[1].id;
    }
    updateTransferToOptions();
    updateTransferFromOptions();
  });

  // Add listener for Recalculate button on Budget tab
  const btnRecalc = document.getElementById('btnRecalc');
  if (btnRecalc) {
    btnRecalc.addEventListener('click', refreshAll);
  }

  // Auto-focus first input in modals
  const autoFocusMap = [
    { modal: "modalCategory", input: "categoryMajor" },
    { modal: "modalSinkingCategory", input: "sinkingCategoryName" },
    { modal: "modalBillsCategory", input: "billsCategoryName" },
    { modal: "modalTransaction", input: "txDate" },
    { modal: "modalGoal", input: "goalName" },
    { modal: "modalBill", input: "billMinor" },
    { modal: "modalAccount", input: "accountName" },
  ];
  autoFocusMap.forEach(m => {
    const el = document.getElementById(m.modal);
    if(el) el.addEventListener("shown.bs.modal", () => {
      const inp = document.getElementById(m.input);
      if(inp) inp.focus();
    });
  });

  // Handle active state for bottom navigation
  const bottomNav = document.querySelector('.bottom-nav');
  if (bottomNav) {
    document.body.addEventListener('shown.bs.tab', (event) => {
      // event.target is the new active tab link
      const activeTabTrigger = event.target;
      const activePaneId = activeTabTrigger.getAttribute('href');

      // Update mobile header title
      const mobileHeaderTitle = document.getElementById('mobile-header-title');
      if (mobileHeaderTitle) {
        mobileHeaderTitle.textContent = activeTabTrigger.textContent;
      }

      // Update desktop dropdown title
      const mainNavDropdown = document.getElementById('mainNavDropdown');
      if (mainNavDropdown) {
        mainNavDropdown.textContent = activeTabTrigger.textContent;
      }

      // This logic only needs to run when the bottom nav is visible
      if (getComputedStyle(bottomNav).display !== 'flex') {
          return;
      }

      const moreToggle = bottomNav.querySelector('.dropdown-toggle');
      const isMoreItem = activeTabTrigger.closest('.dropdown-menu');

      if (isMoreItem) {
        moreToggle.classList.add('active');
      } else if (moreToggle) {
        moreToggle.classList.remove('active');
      }
    });
  }

  // Init all features, passing refreshAll
  initCategories(refreshAll);
  initAverages(refreshAll);
  initTransactions(refreshAll);
  initFIRE(refreshAll);
  initAccounts(refreshAll);
  initDebts(refreshAll);
  initRentals(refreshAll);
  initAssets(refreshAll);
  initNetWorth(refreshAll);
  initSavings(refreshAll);
  initBudget(refreshAll);
  initBills(refreshAll);

  // Grouped Investment Features
  initStocks(refreshAll);
  initStockPlan(refreshAll);
  initDividends(refreshAll);

  document.getElementById('billsCategoryForm').addEventListener("submit", (e) => { e.preventDefault(); upsertBillsCategory(refreshAll); });
  document.getElementById('billForm').addEventListener("submit", (e) => { e.preventDefault(); upsertBill(refreshAll); });

  document.getElementById('btnExport').addEventListener("click", exportJSON);
  document.getElementById('fileImport').addEventListener("change", importJSON);

  document.getElementById('btnReset').addEventListener("click", () => {
    showConfirmationModal("Reset all budget data? This cannot be undone.", () => {
      localStorage.removeItem("budgetState");
      window.location.reload();
    });
  });
}

function refreshAll() {
  renderCategoryDropdowns();

  const expectedByMinor = computeExpectedByMinor();
  const sel = getSelectedMonth();
  const actualByMinor = computeActualByMinor(sel.year, sel.month);

  if (displayMonthYear) {
    const mName = monthSelect.options[sel.month]?.text || MONTHS[sel.month];
    displayMonthYear.textContent = `${mName} ${sel.year}`;
  }
  
  if (!state.pensionRates) state.pensionRates = {};
  const pKey = `${sel.year}-${sel.month}`;
  document.getElementById('pensionInput').value = state.pensionRates[pKey] || 0;

  renderBudgetTable(expectedByMinor, actualByMinor);
  renderAccounts(computeAccountBalances(), computeActualByMinor(null, null));
  renderTransactionsTable(sel);
  renderGoals(expectedByMinor);
  renderSinkingCategories(expectedByMinor, actualByMinor);
  renderBillsCategories(expectedByMinor);
  renderBills(sel.year, sel.month);
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
  renderBillsChart(expectedByMinor, actualByMinor);
  renderAverages();
  renderAnnualOverview();
  renderStocks();
  renderDividends();
  renderStockPlan();

  refreshTopInvestmentMetrics();
}

function persistSelectedMonth() {
  const sel = getSelectedMonth();
  state.ui.selectedYear = sel.year;
  state.ui.selectedMonth = sel.month;
  saveState();
}

function renderCategoryDropdowns() {
  const txMajor = document.getElementById('txMajor');
  txMajor.innerHTML = MAJOR_CATEGORIES
    .filter(m => m.key !== "transfer")
    .map(m => `<option value="${m.key}">${m.label}</option>`).join("");
  if (!txMajor.value) txMajor.value = "variable";
  repopulateTxMinorOptions(txMajor.value, false);

  const bills = state.minorCategories
    .filter(c => c.majorKey === "bills")
    .sort((a, b) => a.name.localeCompare(b.name));
  const billMinor = document.getElementById('billMinor');
  billMinor.innerHTML = bills.length
    ? `<option value="" disabled selected>Select Bill</option>` + bills.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("")
    : `<option value="" disabled selected>Create a Bills category first</option>`;

  const allCats = state.minorCategories
    .slice()
    .sort((a,b) => a.name.localeCompare(b.name));
  const txFilterCategory = document.getElementById('txFilterCategory');
  txFilterCategory.innerHTML = `<option value="">All Categories</option>` + allCats
    .map(c => `<option value="${c.id}">${escapeHtml(c.name)} (${escapeHtml(getMajorLabel(c.majorKey))})</option>`)
    .join("");
}

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

  document.getElementById('sumIncome').textContent = formatMoney(income);
  document.getElementById('sumExpenses').textContent = formatMoney(expenses);
  const sumNet = document.getElementById('sumNet');
  sumNet.textContent = formatMoney(net);

  sumNet.classList.toggle("text-danger", net < 0);
  sumNet.classList.toggle("text-success", net >= 0);

  const pKey = `${year}-${month}`;
  const pensionRate = safeNumber(state.pensionRates?.[pKey] || 0);

  document.getElementById('metricSavingsRate').textContent = income > 0 ? ((sinking / income) * 100).toFixed(1) + "%" : "0.0%";
  
  const investPct = income > 0 ? ((invest / income) * 100) : 0;
  document.getElementById('metricInvestRate').textContent = (investPct + pensionRate).toFixed(1) + "%";
}

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
        datasets: [{ data: data, backgroundColor: colors, borderWidth: 0 }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom" } }
      }
    });
  }
}

function renderBillsChart(expectedByMinor, actualByMinor) {
  const ctx = document.getElementById("billsChart")?.getContext("2d");
  if (!ctx) return;

  const billCategories = state.minorCategories
    .filter(c => c.majorKey === 'bills')
    .sort((a, b) => a.name.localeCompare(b.name));

  const labels = billCategories.map(c => c.name);
  const expectedData = billCategories.map(c => expectedByMinor[c.id] || 0);
  const actualData = billCategories.map(c => actualByMinor[c.id] || 0);

  if (billsBarChart) {
    billsBarChart.data.labels = labels;
    billsBarChart.data.datasets[0].data = expectedData;
    billsBarChart.data.datasets[1].data = actualData;
    billsBarChart.update();
  } else {
    billsBarChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          { label: 'Expected', data: expectedData, backgroundColor: 'rgba(210, 159, 128, 0.2)', borderColor: '#D29F80', borderWidth: 2, tension: 0.3, fill: true },
          { label: 'Actual', data: actualData, backgroundColor: 'rgba(115, 85, 87, 0.2)', borderColor: '#735557', borderWidth: 2, tension: 0.3, fill: true }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: { y: { beginAtZero: true, ticks: { callback: (v) => formatMoney(v) } } },
        plugins: {
          legend: { position: 'top' },
          tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${formatMoney(c.parsed.y)}` } }
        }
      }
    });
  }
}

function computeNetWorth() {
  return getNetWorthBreakdown().netWorth;
}

function getNetWorthBreakdown() {
  const totalAccounts = (state.accounts || []).reduce((sum, acc) => {
    const transSum = (state.transactions || [])
      .filter(t => t.accountId === acc.id)
      .reduce((tSum, t) => tSum + safeNumber(t.amount), 0);
    return sum + safeNumber(acc.initialBalance) + transSum;
  }, 0);

  const totalStocks = typeof computeTotalStockValue === 'function' ? computeTotalStockValue() : 0;
  const totalOther = (state.otherAssets || []).reduce((sum, a) => sum + safeNumber(a.value), 0);
  const totalRentals = (state.rentals || []).reduce((sum, r) => sum + safeNumber(r.value || 0), 0);
  const liabilities = (state.debts || []).reduce((sum, d) => sum + safeNumber(d.balance), 0);
  const assets = totalAccounts + totalStocks + totalOther + totalRentals;

  return { assets, liabilities, netWorth: assets - liabilities };
}

function refreshTopInvestmentMetrics() {
    const breakdown = getNetWorthBreakdown();
    const elNW = document.getElementById('sumNetWorth');
    const elAssets = document.getElementById('sumTotalAssets');
    const elLiab = document.getElementById('sumTotalLiabilities');
    const elStocks = document.getElementById('sumStocksValue');
    const elDiv = document.getElementById('sumDivTTM');

    if (elNW) elNW.textContent = formatMoney(breakdown.netWorth);
    if (elAssets) elAssets.textContent = formatMoney(breakdown.assets);
    if (elLiab) elLiab.textContent = formatMoney(breakdown.liabilities);
    if (elStocks) elStocks.textContent = formatMoney(computeTotalStockValue());
    if (elDiv) elDiv.textContent = formatMoney(computeTrailing12MDividendIncome(getSelectedMonth()));
}

function renderBillsPaidTracker(year, month) {
  const dueThisMonthBills = state.bills.filter(b => computeFirstDueInMonth(b, year, month) !== null);
  const total = dueThisMonthBills.length;
  let paid = 0;
  for (const b of dueThisMonthBills) {
    if (isBillPaidByTransactions(b, year, month)) paid += 1;
  }
  const billsPaidSummary = document.getElementById('billsPaidSummary');
  const billsPaidBar = document.getElementById('billsPaidBar');
  billsPaidSummary.textContent = total === 0 ? "0 / 0" : `${paid} / ${total}`;
  const pct = total === 0 ? 0 : Math.round((paid / total) * 100);
  billsPaidBar.style.width = `${pct}%`;
  billsPaidBar.setAttribute("aria-valuenow", pct);
}

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

      const base = defaultState();
      state = {
        ...base,
        ...parsed,
        ui: { ...base.ui, ...(parsed.ui || {}) },
      };

      saveState();
      showToast("Imported JSON. Reloading page...");
      setTimeout(() => window.location.reload(), 1000);

    } catch {
      alert("Import failed: invalid JSON file.");
    } finally {
      const fileImport = document.getElementById('fileImport');
      if (fileImport) fileImport.value = "";
    }
  };
  reader.readAsText(file);
}

// Start the app
document.addEventListener('DOMContentLoaded', init);