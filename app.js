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
let billsBarChart = null;

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

  // Init transaction filters
  txFilterStart.value = state.ui.txFilterStart || "";
  txFilterEnd.value = state.ui.txFilterEnd || "";

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
  if (!Array.isArray(state.goals)) state.goals = [];
  state.rentals.forEach(r => {
    if (!Array.isArray(r.expenses)) r.expenses = [];
  });
  
  // Init Saved Descriptions (and backfill from existing transactions if empty)
  if (!Array.isArray(state.savedDescriptions)) {
    const existing = new Set((state.transactions || []).map(t => t.description).filter(d => d && d.trim().length > 0));
    state.savedDescriptions = Array.from(existing).sort();
  }

  if (!Array.isArray(state.billPayments)) state.billPayments = [];
  if (!Array.isArray(state.stocksMaster)) state.stocksMaster = [];
  if (!Array.isArray(state.holdings)) state.holdings = [];
  if (!state.dividends || typeof state.dividends !== "object") state.dividends = {};
  if (!state.stockPlan || typeof state.stockPlan !== "object") state.stockPlan = {};

  if (!state.ui.rentalYear) state.ui.rentalYear = now.getFullYear();
  rentalYear.value = String(state.ui.rentalYear);
  if (!state.rentalIncome || typeof state.rentalIncome !== "object") state.rentalIncome = {};

  // Init Currency
  if (!state.ui.currency) state.ui.currency = 'USD';
  currencySelect.value = state.ui.currency;

  // Override global formatMoney to use selected currency
  window.formatMoney = function(amount) {
    const val = parseFloat(amount);
    if (isNaN(val)) return "-";
    // Using en-US locale for number formatting (1,000.00) but applying the selected currency symbol/code
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: state.ui.currency }).format(val);
  };

  // Initialize Bootstrap tooltips
  const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
  [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));

  // Force light theme and ignore saved preferences while feature is disabled
  document.documentElement.setAttribute("data-theme", "light");

  wireEvents();
  refreshAll();
}

function initMobileNav() {
  const toggle = document.getElementById('mobile-nav-toggle');
  const nav = document.getElementById('mainTabs');
  const backdrop = document.getElementById('nav-backdrop');
  const links = nav.querySelectorAll('.nav-link');

  const closeNav = () => {
    nav.classList.remove('show');
    backdrop.classList.remove('show');
    document.body.style.overflow = '';
  };

  const openNav = () => {
    nav.classList.add('show');
    backdrop.classList.add('show');
    document.body.style.overflow = 'hidden';
  };

  toggle?.addEventListener('click', openNav);
  backdrop?.addEventListener('click', closeNav);
  links.forEach(link => link.addEventListener('click', closeNav));
}

function initFeedbackButton() {
  const nav = document.getElementById('mainTabs');
  if (!nav) return;

  const title = document.createElement('div');
  title.className = "nav-section-title mt-4";
  title.textContent = "Support";
  nav.appendChild(title);

  const container = document.createElement('div');
  container.className = "px-3 mb-4 d-grid gap-2";
  container.innerHTML = `
    <a href="https://docs.google.com/forms/d/e/1FAIpQLSd3cTLpaIzvWti_R6gfURUiG_stMhdo_pei1Uj7DkErXq0JpQ/viewform?usp=header" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline-secondary btn-feedback-sidebar d-flex align-items-center justify-content-center gap-2" style="border-radius: 12px; font-weight: 600; padding: 10px;">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M3.5 0a.5.5 0 0 1 .5.5V1h8V.5a.5.5 0 0 1 1 0V1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h1V.5a.5.5 0 0 1 .5-.5zM1 4v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4H1z"/></svg>
      Give Feedback
    </a>
    <a href="https://docs.google.com/forms/d/e/1FAIpQLSd3cTLpaIzvWti_R6gfURUiG_stMhdo_pei1Uj7DkErXq0JpQ/viewform?usp=pp_url&entry.1234567=Bug+Report" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline-danger btn-bug-sidebar d-flex align-items-center justify-content-center gap-2" style="border-radius: 12px; font-weight: 600; padding: 10px;">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M11 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"/><path fill-rule="evenodd" d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm8-7a7 7 0 0 0-5.468 11.37C3.242 11.226 4.805 10 8 10s4.757 1.225 5.468 2.37A7 7 0 0 0 8 1z"/></svg>
      Report a Bug
    </a>
  `;
  nav.appendChild(container);

  // Mobile-only FAB above the primary plus button
  const fab = document.createElement('a');
  fab.href = "https://docs.google.com/forms/d/e/1FAIpQLSd3cTLpaIzvWti_R6gfURUiG_stMhdo_pei1Uj7DkErXq0JpQ/viewform?usp=header";
  fab.target = "_blank";
  fab.rel = "noopener noreferrer";
  fab.className = "btn fab-btn fab-feedback d-lg-none";
  fab.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M14 1a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4.414A2 2 0 0 0 3 11.586l-2 2V2a1 1 0 0 1 1-1h12zM2 0a2 2 0 0 0-2 2v12.793a.5.5 0 0 0 .854.353l2.853-2.853A1 1 0 0 1 4.414 12H14a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2z"/></svg>`;
  document.body.appendChild(fab);
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

  currencySelect.addEventListener("change", () => {
    state.ui.currency = currencySelect.value;
    saveState();
    refreshAll();
  });

  yearInput.addEventListener("change", () => { persistSelectedMonth(); refreshAll(); });
  monthSelect.addEventListener("change", () => { persistSelectedMonth(); refreshAll(); });

  const modalBillEl = document.getElementById("modalBill");
  if (modalBillEl) {
    modalBillEl.addEventListener("show.bs.modal", handleBillModalOpen);
    modalBillEl.addEventListener("hidden.bs.modal", () => {
      // Reset form on close to prevent stale data on next open
      billForm.reset();
      billId.value = "";
      billModalTitle.textContent = "Add Recurring Bill";
      toggleBillSinkingFundWrap();
    });
  }

  billMinor.addEventListener("change", toggleNewBillMinorInput);
  billFreq.addEventListener("change", toggleBillSinkingFundWrap);
  billSinkingFund.addEventListener("change", () => {
    billSinkingFundSelectWrap.style.display = billSinkingFund.checked ? "block" : "none";
  });

  transferForm.addEventListener("submit", (e) => { e.preventDefault(); upsertTransfer(); });
  transferFromAccount.addEventListener("change", updateTransferToOptions);
  modalTransferEl.addEventListener("show.bs.modal", (event) => {
    const button = event.relatedTarget;
    const fromAccountId = button ? button.dataset.fromAccountId : null;

    transferForm.reset();
    transferDate.value = toISODate(new Date());
    const accs = state.accounts.sort((a,b) => a.name.localeCompare(b.name));
    const options = accs.map(a => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join("");
    transferFromAccount.innerHTML = options;
    transferToAccount.innerHTML = options;

    if (fromAccountId && accs.some(a => a.id === fromAccountId)) {
      transferFromAccount.value = fromAccountId;
      // Pre-select a different 'to' account if possible
      const toAccount = accs.find(a => a.id !== fromAccountId);
      if (toAccount) {
        transferToAccount.value = toAccount.id;
      }
    } else if (accs.length > 1) {
      transferFromAccount.value = accs[0].id;
      transferToAccount.value = accs[1].id;
    }
    updateTransferToOptions();
  });

  categoryForm.addEventListener("submit", (e) => { e.preventDefault(); upsertGeneralMinorCategory(); });
  modalCategoryEl.addEventListener("hidden.bs.modal", () => {
    categoryForm.reset();
    categoryId.value = "";
    categoryModalTitle.textContent = "Add Minor Category";
  });
  billsCategoryForm.addEventListener("submit", (e) => { e.preventDefault(); upsertBillsCategory(); });

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

  initAverages();
  initStocks();
  initTransactions();
  initStockPlan();
  initDividends();
  initFIRE();
  initAccounts();
  initDebts();
  initRentals();
  initAssets();
  initNetWorth();
  initSavings();
  initBudget();

  initModalAutoFocus();
  initMobileNav();
  initFeedbackButton();
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
  const budgetMonthYear = document.getElementById('budgetMonthYear');
  if (budgetMonthYear) {
    const mName = monthSelect.options[sel.month]?.text || MONTHS[sel.month];
    budgetMonthYear.textContent = `${mName} ${sel.year}`;
  }
  
  // Update pension input for selected month
  if (!state.pensionRates) state.pensionRates = {};
  const pKey = `${sel.year}-${sel.month}`;
  pensionInput.value = state.pensionRates[pKey] || 0;

  renderBudgetTable(expectedByMinor, actualByMinor);
  renderAccounts();
  renderTransactionsTable();
  renderGoals(expectedByMinor);
  renderBillsCategories(expectedByMinor);
  renderBills(sel.year, sel.month); // FIXED: show ALL bills 
  renderDebts();
  renderDebtsForAssetsTab(); //changes to test vercel 
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
  const pKey = `${year}-${month}`;
  const pensionRate = safeNumber(state.pensionRates?.[pKey] || 0);

  metricSavingsRate.textContent = income > 0 ? ((sinking / income) * 100).toFixed(1) + "%" : "0.0%";
  
  const investPct = income > 0 ? ((invest / income) * 100) : 0;
  metricInvestRate.textContent = (investPct + pensionRate).toFixed(1) + "%";
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
          {
            label: 'Expected',
            data: expectedData,
            backgroundColor: 'rgba(210, 159, 128, 0.2)',
            borderColor: '#D29F80', // sand
            borderWidth: 2,
            tension: 0.3,
            fill: true,
          },
          {
            label: 'Actual',
            data: actualData,
            backgroundColor: 'rgba(115, 85, 87, 0.2)',
            borderColor: '#735557', // plum-soft
            borderWidth: 2,
            tension: 0.3,
            fill: true,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value) { return formatMoney(value); }
            }
          }
        },
        plugins: {
          legend: { position: 'top' },
          tooltip: {
            callbacks: {
              label: function(context) { return `${context.dataset.label}: ${formatMoney(context.parsed.y)}`; }
            }
          }
        }
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
  // Filter for bills that are actually due in the selected month.
  const dueThisMonthBills = state.bills.filter(b => computeFirstDueInMonth(b, year, month) !== null);

  const total = dueThisMonthBills.length;

  let paid = 0;
  for (const b of dueThisMonthBills) {
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

function toggleNewBillMinorInput() {
  const show = billMinor.value === '--new--';
  billNewMinorWrap.style.display = show ? 'block' : 'none';
  if (show) {
    billNewMinorName.focus();
  }
}

function createNewBillCategory(name) {
  const dupe = state.minorCategories.find(c => c.majorKey === "bills" && c.name.toLowerCase() === name.toLowerCase());
  if (dupe) {
    showToast("A bill category with that name already exists.");
    return null;
  }

  const newCat = { id: uid(), majorKey: "bills", name, manualExpectedMonthly: 0, createdAt: new Date().toISOString() };
  state.minorCategories.push(newCat);
  showToast("New bill category created.");
  return newCat.id;
}

function upsertBill() {
  const id = billId.value?.trim();
  let minorId = billMinor.value;

  // Handle creation of new Bill Category on the fly
  if (minorId === '--new--') {
    const newName = billNewMinorName.value.trim();
    if (!newName) {
      showToast("Please enter a name for the new bill category.");
      return;
    }
    const existing = state.minorCategories.find(c => c.majorKey === "bills" && c.name.toLowerCase() === newName.toLowerCase());
    if (existing) {
      minorId = existing.id;
    } else {
      const newId = createNewBillCategory(newName);
      if (!newId) return;
      minorId = newId;
    }
  }

  const amount = safeNumber(billAmount.value);
  const freq = billFreq.value;
  const nextDue = billNextDue.value;
  const useSinkingFund = billSinkingFund.checked;
  const sinkingFundLink = (useSinkingFund && billSinkingFundWrap.style.display !== 'none') ? billSinkingFundMinor.value : null;

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
    b.sinkingFundLink = sinkingFundLink;
    showToast("Bill updated.");
  } else {
    state.bills.push({
      id: uid(),
      name: derivedName,
      minorCategoryId: minorId,
      amount,
      frequency: freq,
      nextDueISO: nextDue,
      sinkingFundLink: sinkingFundLink,
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

  // Must call this first to ensure wrap is visible for correct frequencies
  toggleBillSinkingFundWrap();

  if (b.sinkingFundLink && billSinkingFundWrap.style.display !== 'none') {
    billSinkingFund.checked = true;
    billSinkingFundSelectWrap.style.display = "block";
    billSinkingFundMinor.value = b.sinkingFundLink;
  } else {
    billSinkingFund.checked = false;
    billSinkingFundSelectWrap.style.display = "none";
  }

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

function handleBillModalOpen() {
  if (!billId.value) {
    billModalTitle.textContent = "Add Recurring Bill";
    // Reset sinking fund section for new bills
    billSinkingFund.checked = false;
    billSinkingFundSelectWrap.style.display = "none";
  }

  // Reset new category input
  billNewMinorWrap.style.display = 'none';
  billNewMinorName.value = '';

  // Populate bills dropdown
  const bills = state.minorCategories
    .filter(c => c.majorKey === "bills")
    .sort((a, b) => a.name.localeCompare(b.name));
  const options = bills.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
  const addNewOption = `<option value="--new--">-- Add New Bill Category --</option>`;
  const currentVal = billMinor.value; // Preserve value if editing
  billMinor.innerHTML = addNewOption + options;
  if (billId.value && bills.some(c => c.id === currentVal)) {
    billMinor.value = currentVal;
  }

  // Create a map of sinking fund category ID -> goal name
  const goalMap = new Map();
  state.goals.forEach(g => {
    goalMap.set(g.minorCategoryId, g.name);
  });

  // Populate sinking funds dropdown
  const sinkingFunds = state.minorCategories
    .filter(c => c.majorKey === "sinking")
    .sort((a, b) => a.name.localeCompare(b.name));
  billSinkingFundMinor.innerHTML = sinkingFunds.map(c => {
    const goalName = goalMap.get(c.id);
    const optionText = goalName
      ? `${escapeHtml(c.name)} (Goal: ${escapeHtml(goalName)})`
      : escapeHtml(c.name);
    return `<option value="${c.id}">${optionText}</option>`;
  }).join("");

  // Show/hide based on frequency (must be after form is populated for 'edit')
  toggleBillSinkingFundWrap();
  toggleNewBillMinorInput();
}

function toggleBillSinkingFundWrap() {
  const freq = billFreq.value;
  const show = freq === 'quarterly' || freq === 'yearly';
  billSinkingFundWrap.style.display = show ? "block" : "none";
  if (!show) { // If hiding, also reset the inputs
    billSinkingFund.checked = false;
    billSinkingFundSelectWrap.style.display = "none";
  }
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

function updateTransferToOptions() {
  const fromId = transferFromAccount.value;
  for (const option of transferToAccount.options) {
    option.disabled = (option.value === fromId);
  }
  // If the current 'to' is now disabled, find a new one
  if (transferToAccount.options[transferToAccount.selectedIndex]?.disabled) {
    const firstAvailable = Array.from(transferToAccount.options).find(opt => !opt.disabled);
    if (firstAvailable) {
      transferToAccount.value = firstAvailable.value;
    }
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

  const saved = computeSinkingFundBalance(goal.minorCategoryId);
  if (saved >= total) return 0;

  const remaining = total - saved;

  const now = new Date();
  const deadline = goal.deadlineISO ? new Date(goal.deadlineISO + "T00:00:00") : null;
  if (!deadline || isNaN(deadline.getTime())) return 0;

  let months = monthsBetweenInclusive(now, deadline);
  months = Math.max(1, months);

  return remaining / months;
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
   Averages
   ========================= */
function computeActualByMinorForRange(startISO, endISO) {
  const totals = {};
  for (const t of state.transactions) {
    if (isInRange(t.date, startISO, endISO)) {
      totals[t.minorCategoryId] = (totals[t.minorCategoryId] || 0) + safeNumber(t.amount);
    }
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
        stockPlan: (parsed.stockPlan && typeof parsed.stockPlan === "object") ? parsed.stockPlan : {},
        savedDescriptions: Array.isArray(parsed.savedDescriptions) ? parsed.savedDescriptions : [],
      };
      state.rentals.forEach(r => {
        if (!Array.isArray(r.expenses)) r.expenses = [];
      });

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

function computeSinkingFundBalance(minorId) {
  const cat = state.minorCategories.find(c => c.id === minorId);
  let balance = cat?.initialBalance || 0;

  for (const t of state.transactions) {
    const amt = safeNumber(t.amount);
    // Add contributions (direct transactions to the sinking fund)
    if (t.minorCategoryId === minorId) {
      balance += amt;
    }
    // Subtract usage (transactions linked to this sinking fund)
    if (t.sinkingFundId === minorId) {
      balance -= amt;
    }
  }
  return balance;
}

init();