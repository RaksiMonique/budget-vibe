/* Budget Tracker - vanilla JS + Bootstrap
   Persistence: localStorage (see notes near bottom for IndexedDB upgrade path)
*/

const STORAGE_KEY = "budgetTracker.v1";

// Fixed major categories
const MAJOR_CATEGORIES = [
  { key: "income", label: "Income" },
  { key: "fixed", label: "Fixed Expenses" },
  { key: "variable", label: "Variable Expenses" },
  { key: "bills", label: "Bills" },
  { key: "sinking", label: "Sinking (Savings) Fund" },
  { key: "fun", label: "Fun Money" },
  { key: "invest", label: "Investments" },
];

// which majors behave as "income-like" vs "expense-like" for net math
const MAJOR_TYPES = {
  income: "inflow",
  fixed: "outflow",
  variable: "outflow",
  bills: "outflow",
  sinking: "savings",   // treated separately in summary
  fun: "outflow",
  invest: "savings",    // treated separately in summary
};

const FREQUENCY_TO_MONTHLY_MULTIPLIER = {
  weekly: 52 / 12,
  biweekly: 26 / 12,
  monthly: 1,
  quarterly: 1 / 3,
  yearly: 1 / 12,
};

let state = loadState();

// ---------- DOM ----------
const yearInput = document.getElementById("yearInput");
const monthSelect = document.getElementById("monthSelect");
const btnThisMonth = document.getElementById("btnThisMonth");
const btnRecalc = document.getElementById("btnRecalc");

const sumIncome = document.getElementById("sumIncome");
const sumExpenses = document.getElementById("sumExpenses");
const sumNet = document.getElementById("sumNet");
const sumSaveInvest = document.getElementById("sumSaveInvest");

const budgetTbody = document.getElementById("budgetTbody");
const txTbody = document.getElementById("txTbody");
const goalsWrap = document.getElementById("goalsWrap");
const billsTbody = document.getElementById("billsTbody");
const catTbody = document.getElementById("catTbody");

const btnExport = document.getElementById("btnExport");
const fileImport = document.getElementById("fileImport");
const btnReset = document.getElementById("btnReset");

// Modals + forms
const categoryForm = document.getElementById("categoryForm");
const categoryModalTitle = document.getElementById("categoryModalTitle");
const categoryId = document.getElementById("categoryId");
const categoryMajor = document.getElementById("categoryMajor");
const categoryName = document.getElementById("categoryName");
const categoryExpected = document.getElementById("categoryExpected");

const txForm = document.getElementById("txForm");
const txDate = document.getElementById("txDate");
const txMinor = document.getElementById("txMinor");
const txDesc = document.getElementById("txDesc");
const txAmount = document.getElementById("txAmount");

const goalForm = document.getElementById("goalForm");
const goalName = document.getElementById("goalName");
const goalMinor = document.getElementById("goalMinor");
const goalTotal = document.getElementById("goalTotal");
const goalDeadlineDate = document.getElementById("goalDeadlineDate");
const goalDurationMonths = document.getElementById("goalDurationMonths");

const billForm = document.getElementById("billForm");
const billName = document.getElementById("billName");
const billMinor = document.getElementById("billMinor");
const billAmount = document.getElementById("billAmount");
const billFreq = document.getElementById("billFreq");
const billNextDue = document.getElementById("billNextDue");

// Toast
const toastEl = document.getElementById("appToast");
const toastBody = document.getElementById("toastBody");
const toast = toastEl ? new bootstrap.Toast(toastEl, { delay: 2000 }) : null;

init();

function init() {
  // Default month/year
  const now = new Date();
  yearInput.value = state.ui.selectedYear ?? now.getFullYear();
  monthSelect.value = String(state.ui.selectedMonth ?? now.getMonth());

  // Populate major category dropdown for new minor categories
  categoryMajor.innerHTML = MAJOR_CATEGORIES
    .map(m => `<option value="${m.key}">${m.label}</option>`)
    .join("");

  // Preload: ensure at least one bills minor category and sinking minor category for demo UX (optional)
  if (state.minorCategories.length === 0) {
    seedStarterCategories();
    saveState();
  }

  wireEvents();
  refreshAll();
}

function wireEvents() {
  btnThisMonth.addEventListener("click", () => {
    const now = new Date();
    yearInput.value = now.getFullYear();
    monthSelect.value = String(now.getMonth());
    persistSelectedMonth();
    refreshAll();
  });

  yearInput.addEventListener("change", () => {
    persistSelectedMonth();
    refreshAll();
  });

  monthSelect.addEventListener("change", () => {
    persistSelectedMonth();
    refreshAll();
  });

  btnRecalc.addEventListener("click", () => refreshAll());

  // Category form
  categoryForm.addEventListener("submit", (e) => {
    e.preventDefault();
    upsertMinorCategory();
  });

  // Transaction form
  txForm.addEventListener("submit", (e) => {
    e.preventDefault();
    addTransaction();
  });

  // Goal form
  goalForm.addEventListener("submit", (e) => {
    e.preventDefault();
    addGoal();
  });

  // Bill form
  billForm.addEventListener("submit", (e) => {
    e.preventDefault();
    addBill();
  });

  // Export/import/reset
  btnExport.addEventListener("click", exportJSON);
  fileImport.addEventListener("change", importJSON);
  btnReset.addEventListener("click", () => {
    if (!confirm("Reset all budget data? This cannot be undone.")) return;
    state = defaultState();
    saveState();
    init(); // re-init UI and seed
  });
}

function persistSelectedMonth() {
  const y = clampInt(yearInput.value, 2000, 2100, new Date().getFullYear());
  const m = clampInt(monthSelect.value, 0, 11, new Date().getMonth());
  state.ui.selectedYear = y;
  state.ui.selectedMonth = m;
  saveState();
}

function refreshAll() {
  // Refresh dropdowns dependent on categories
  renderCategoryDropdowns();

  // Recompute expected from: manual expected + goals + bills (monthly equivalents)
  const expectedByMinor = computeExpectedByMinor();

  // Compute actuals (selected month)
  const sel = getSelectedMonth();
  const actualByMinor = computeActualByMinor(sel.year, sel.month);

  // Render sections
  renderBudgetTable(expectedByMinor, actualByMinor);
  renderTransactionsTable(sel.year, sel.month);
  renderGoals(expectedByMinor);
  renderBills();
  renderCategories();

  renderSummary(actualByMinor);
}

function renderCategoryDropdowns() {
  // All minor categories for transactions
  const sortedAll = [...state.minorCategories].sort((a, b) =>
    (a.majorKey + a.name).localeCompare(b.majorKey + b.name)
  );
  txMinor.innerHTML = sortedAll.map(c => {
    const majorLabel = getMajorLabel(c.majorKey);
    return `<option value="${c.id}">${majorLabel} • ${escapeHtml(c.name)}</option>`;
  }).join("");

  // Only sinking fund categories for goals
  const sinking = sortedAll.filter(c => c.majorKey === "sinking");
  goalMinor.innerHTML = sinking.length
    ? sinking.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("")
    : `<option value="" disabled selected>Create a Sinking Fund minor category first</option>`;

  // Only bills categories for bills
  const bills = sortedAll.filter(c => c.majorKey === "bills");
  billMinor.innerHTML = bills.length
    ? bills.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("")
    : `<option value="" disabled selected>Create a Bills minor category first</option>`;
}

function renderSummary(actualByMinor) {
  // Aggregate by major types
  let income = 0;
  let expenses = 0;
  let saveInvest = 0;

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

  // simple conditional emphasis
  sumNet.classList.toggle("text-danger", net < 0);
  sumNet.classList.toggle("text-success", net >= 0);
}

function renderBudgetTable(expectedByMinor, actualByMinor) {
  // Group categories by major
  const majors = MAJOR_CATEGORIES.map(m => m.key);
  const catsByMajor = Object.fromEntries(majors.map(k => [k, []]));
  for (const c of state.minorCategories) catsByMajor[c.majorKey].push(c);

  for (const k of majors) {
    catsByMajor[k].sort((a, b) => a.name.localeCompare(b.name));
  }

  let rows = "";
  for (const major of majors) {
    const list = catsByMajor[major];
    if (!list.length) continue;

    const majorLabel = getMajorLabel(major);

    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      const exp = expectedByMinor[c.id] || 0;
      const act = actualByMinor[c.id] || 0;

      // For income, variance is act - exp; for outflows/savings, variance is exp - act (i.e., under budget is positive)
      const type = MAJOR_TYPES[c.majorKey];
      const variance = (type === "inflow") ? (act - exp) : (exp - act);

      rows += `
        <tr>
          <td>${i === 0 ? `<span class="badge badge-soft">${majorLabel}</span>` : ""}</td>
          <td>${escapeHtml(c.name)}</td>
          <td class="text-end">${formatMoney(exp)}</td>
          <td class="text-end">${formatMoney(act)}</td>
          <td class="text-end ${variance < 0 ? "text-danger" : "text-success"}">${formatMoney(variance)}</td>
          <td>
            <div class="d-flex gap-2">
              <button class="btn btn-sm btn-outline-secondary" onclick="editCategory('${c.id}')">Edit</button>
              <button class="btn btn-sm btn-outline-danger" onclick="deleteCategory('${c.id}')">Delete</button>
            </div>
          </td>
        </tr>
      `;
    }
  }

  budgetTbody.innerHTML = rows || `<tr><td colspan="6" class="text-muted">No categories yet. Add minor categories to begin.</td></tr>`;
}

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
          <button class="btn btn-sm btn-outline-danger" onclick="deleteTransaction('${t.id}')">Delete</button>
        </td>
      </tr>
    `;
  }).join("");
}

function renderGoals(expectedByMinor) {
  if (!state.goals.length) {
    goalsWrap.innerHTML = `<div class="text-muted">No goals yet. Add a savings goal to auto-populate expected sinking fund amounts.</div>`;
    return;
  }

  // For progress, we compute:
  // - all-time saved in the linked category (sum of all transactions in that category)
  // - selected-month saved in that category
  const sel = getSelectedMonth();
  const actualAllTimeByMinor = computeActualByMinor(null, null); // no filter
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
        <div class="col-lg-6">
          <div class="card card-goal shadow-sm">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-start gap-2">
                <div>
                  <div class="fw-semibold">${escapeHtml(g.name)}</div>
                  <div class="small-muted">
                    Category: <b>${escapeHtml(cat ? cat.name : "—")}</b>
                  </div>
                </div>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteGoal('${g.id}')">Delete</button>
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
                  <div class="small text-muted">Expected this month (category total incl. goals/bills/manual)</div>
                  <div class="fw-semibold">${formatMoney(expForCat)}</div>
                </div>
                <div class="col-12 small text-muted">
                  Deadline: ${g.deadlineISO ? escapeHtml(g.deadlineISO) : "—"}
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join("");
}

function renderBills() {
  const rows = state.bills
    .slice()
    .sort((a, b) => (a.nextDueISO || "").localeCompare(b.nextDueISO || ""))
    .map(b => {
      const cat = getCategory(b.minorCategoryId);
      const monthlyEq = computeBillMonthlyEquivalent(b);
      return `
        <tr>
          <td>${escapeHtml(b.name)}</td>
          <td>${escapeHtml(cat ? cat.name : "—")}</td>
          <td class="text-end">${formatMoney(b.amount)}</td>
          <td>${escapeHtml(capitalize(b.frequency))}</td>
          <td>${escapeHtml(b.nextDueISO)}</td>
          <td class="text-end">${formatMoney(monthlyEq)}</td>
          <td>
            <button class="btn btn-sm btn-outline-danger" onclick="deleteBill('${b.id}')">Delete</button>
          </td>
        </tr>
      `;
    });

  billsTbody.innerHTML = rows.join("") || `<tr><td colspan="7" class="text-muted">No recurring bills yet.</td></tr>`;
}

function renderCategories() {
  const rows = state.minorCategories
    .slice()
    .sort((a, b) => (a.majorKey + a.name).localeCompare(b.majorKey + b.name))
    .map(c => `
      <tr>
        <td>${escapeHtml(getMajorLabel(c.majorKey))}</td>
        <td>${escapeHtml(c.name)}</td>
        <td class="text-end">${formatMoney(c.manualExpectedMonthly || 0)}</td>
        <td>
          <div class="d-flex gap-2">
            <button class="btn btn-sm btn-outline-secondary" onclick="editCategory('${c.id}')">Edit</button>
            <button class="btn btn-sm btn-outline-danger" onclick="deleteCategory('${c.id}')">Delete</button>
          </div>
        </td>
      </tr>
    `);

  catTbody.innerHTML = rows.join("") || `<tr><td colspan="4" class="text-muted">No minor categories yet.</td></tr>`;
}

// ---------- Actions ----------
function upsertMinorCategory() {
  const id = categoryId.value?.trim();
  const majorKey = categoryMajor.value;
  const name = categoryName.value.trim();
  const expected = safeNumber(categoryExpected.value);

  if (!name) return;

  // Prevent duplicate minor name under same major (soft rule)
  const dupe = state.minorCategories.find(c =>
    c.majorKey === majorKey &&
    c.name.toLowerCase() === name.toLowerCase() &&
    c.id !== id
  );
  if (dupe) {
    showToast("That minor category already exists under this major.");
    return;
  }

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

window.editCategory = function (id) {
  const c = state.minorCategories.find(x => x.id === id);
  if (!c) return;

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

  const usedInTx = state.transactions.some(t => t.minorCategoryId === id);
  const usedInGoals = state.goals.some(g => g.minorCategoryId === id);
  const usedInBills = state.bills.some(b => b.minorCategoryId === id);

  if (usedInTx || usedInGoals || usedInBills) {
    alert("Cannot delete: this category is linked to transactions/goals/bills. Delete those first.");
    return;
  }

  if (!confirm(`Delete category "${c.name}"?`)) return;
  state.minorCategories = state.minorCategories.filter(x => x.id !== id);
  saveState();
  showToast("Category deleted.");
  refreshAll();
};

function addTransaction() {
  const date = txDate.value;
  const minorId = txMinor.value;
  const amount = safeNumber(txAmount.value);
  const desc = txDesc.value.trim();

  if (!date || !minorId || !isFinite(amount)) return;

  state.transactions.push({
    id: uid(),
    date,
    minorCategoryId: minorId,
    amount,
    description: desc,
    createdAt: new Date().toISOString(),
  });

  saveState();
  showToast("Transaction added.");
  closeModal("modalTransaction");
  txForm.reset();
  refreshAll();
}

window.deleteTransaction = function (id) {
  const t = state.transactions.find(x => x.id === id);
  if (!t) return;
  if (!confirm("Delete this transaction?")) return;

  state.transactions = state.transactions.filter(x => x.id !== id);
  saveState();
  showToast("Transaction deleted.");
  refreshAll();
};

function addGoal() {
  if (!state.minorCategories.some(c => c.majorKey === "sinking")) {
    alert("Create a Sinking Fund minor category first.");
    return;
  }

  const name = goalName.value.trim();
  const minorId = goalMinor.value;
  const total = safeNumber(goalTotal.value);

  const dateISO = goalDeadlineDate.value || "";
  const durationMonths = goalDurationMonths.value ? clampInt(goalDurationMonths.value, 1, 600, 12) : null;

  if (!name || !minorId || !isFinite(total) || total <= 0) return;

  const cat = getCategory(minorId);
  if (!cat || cat.majorKey !== "sinking") {
    alert("Goal must be linked to a Sinking Fund minor category.");
    return;
  }

  let deadlineISO = "";
  if (dateISO) {
    deadlineISO = dateISO;
  } else if (durationMonths) {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth() + durationMonths, now.getDate());
    deadlineISO = toISODate(d);
  } else {
    alert("Provide a deadline date or duration (months).");
    return;
  }

  state.goals.push({
    id: uid(),
    name,
    minorCategoryId: minorId,
    totalAmount: total,
    deadlineISO,
    createdAt: new Date().toISOString(),
  });

  saveState();
  showToast("Goal added.");
  closeModal("modalGoal");
  goalForm.reset();
  refreshAll();
}

window.deleteGoal = function (id) {
  const g = state.goals.find(x => x.id === id);
  if (!g) return;
  if (!confirm(`Delete goal "${g.name}"?`)) return;

  state.goals = state.goals.filter(x => x.id !== id);
  saveState();
  showToast("Goal deleted.");
  refreshAll();
};

function addBill() {
  if (!state.minorCategories.some(c => c.majorKey === "bills")) {
    alert("Create a Bills minor category first.");
    return;
  }

  const name = billName.value.trim();
  const minorId = billMinor.value;
  const amount = safeNumber(billAmount.value);
  const freq = billFreq.value;
  const nextDue = billNextDue.value;

  if (!name || !minorId || !isFinite(amount) || amount <= 0 || !nextDue) return;

  const cat = getCategory(minorId);
  if (!cat || cat.majorKey !== "bills") {
    alert("Bill must be linked to a Bills minor category.");
    return;
  }

  state.bills.push({
    id: uid(),
    name,
    minorCategoryId: minorId,
    amount,
    frequency: freq,
    nextDueISO: nextDue,
    createdAt: new Date().toISOString(),
  });

  saveState();
  showToast("Bill added.");
  closeModal("modalBill");
  billForm.reset();
  refreshAll();
}

window.deleteBill = function (id) {
  const b = state.bills.find(x => x.id === id);
  if (!b) return;
  if (!confirm(`Delete bill "${b.name}"?`)) return;

  state.bills = state.bills.filter(x => x.id !== id);
  saveState();
  showToast("Bill deleted.");
  refreshAll();
};

// ---------- Core calculations ----------
function computeExpectedByMinor() {
  // Start with manual expected
  const expected = {};
  for (const c of state.minorCategories) {
    expected[c.id] = safeNumber(c.manualExpectedMonthly || 0);
  }

  // Add goal monthly requirements to their linked sinking fund category
  for (const g of state.goals) {
    const monthly = computeGoalMonthlyRequired(g);
    expected[g.minorCategoryId] = (expected[g.minorCategoryId] || 0) + monthly;
  }

  // Add bill monthly equivalents to their linked bills category
  for (const b of state.bills) {
    const monthlyEq = computeBillMonthlyEquivalent(b);
    expected[b.minorCategoryId] = (expected[b.minorCategoryId] || 0) + monthlyEq;
  }

  return expected;
}

function computeGoalMonthlyRequired(goal) {
  // Required monthly = total / monthsRemaining (>=1)
  // NOTE: This is a simple planner. If you want "remaining amount = total - savedAllTime", swap in savedAllTime here.
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
  // if year/month are null, compute all-time totals
  const totals = {};
  for (const t of state.transactions) {
    if (year != null && month != null) {
      if (!isInMonth(t.date, year, month)) continue;
    }
    totals[t.minorCategoryId] = (totals[t.minorCategoryId] || 0) + safeNumber(t.amount);
  }
  return totals;
}

// ---------- Helpers ----------
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
  // isoDate "YYYY-MM-DD"
  if (!isoDate) return false;
  const [y, m] = isoDate.split("-").map(n => parseInt(n, 10));
  return y === year && (m - 1) === month;
}

function monthsBetweenInclusive(startDate, endDate) {
  // inclusive month count (rough planning): from current month to deadline month
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

function capitalize(s) {
  return (s || "").slice(0,1).toUpperCase() + (s || "").slice(1);
}

function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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

// ---------- Storage ----------
function defaultState() {
  return {
    ui: { selectedYear: null, selectedMonth: null },
    minorCategories: [],
    transactions: [],
    goals: [],
    bills: [],
    meta: { createdAt: new Date().toISOString() }
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);

    // Basic shape hardening
    return {
      ui: parsed.ui || { selectedYear: null, selectedMonth: null },
      minorCategories: Array.isArray(parsed.minorCategories) ? parsed.minorCategories : [],
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
      goals: Array.isArray(parsed.goals) ? parsed.goals : [],
      bills: Array.isArray(parsed.bills) ? parsed.bills : [],
      meta: parsed.meta || { createdAt: new Date().toISOString() }
    };
  } catch {
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ---------- Export/Import ----------
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
      // minimal validation
      if (!parsed || typeof parsed !== "object") throw new Error("Invalid");
      state = {
        ui: parsed.ui || state.ui,
        minorCategories: Array.isArray(parsed.minorCategories) ? parsed.minorCategories : [],
        transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
        goals: Array.isArray(parsed.goals) ? parsed.goals : [],
        bills: Array.isArray(parsed.bills) ? parsed.bills : [],
        meta: parsed.meta || { createdAt: new Date().toISOString() }
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

// ---------- Seed data (optional, just for better first-run UX) ----------
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
    manualExpectedMonthly: s.manualExpectedMonthly,
    createdAt: new Date().toISOString(),
  }));
}