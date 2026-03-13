const STORAGE_KEY = "budgetTracker.v1";

// Apply theme on initial load to prevent flash
(function() {
  try {
    const storedState = JSON.parse(localStorage.getItem(STORAGE_KEY));
    let theme = storedState?.ui?.theme;
    if (!theme || theme === "system") {
      theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.setAttribute("data-theme", theme);
  } catch (e) {
    document.documentElement.setAttribute("data-theme", "light");
  }
})();

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
      txFilterStart: "",
      txFilterEnd: "",
      divYear: null,
      theme: null,
      rentalYear: null,
      pensionRate: 0,
      pensionRates: {},
    },
    minorCategories: [],
    accounts: [],
    transactions: [],
    otherAssets: [],
    rentals: [],
    rentalIncome: {},
    debts: [],
    fire: {
      currentAge: 30,
      currentPortfolio: 0,
      annualInvestment: 12000,
      annualSpending: 50000,
      annualReturn: 7,
      withdrawalRate: 4
    },
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
      accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [],
      pensionRates: (parsed.pensionRates && typeof parsed.pensionRates === "object") ? parsed.pensionRates : {},
      otherAssets: Array.isArray(parsed.otherAssets) ? parsed.otherAssets : [],
      rentals: Array.isArray(parsed.rentals) ? parsed.rentals : [],
      rentalIncome: (parsed.rentalIncome && typeof parsed.rentalIncome === "object") ? parsed.rentalIncome : {},
      debts: Array.isArray(parsed.debts) ? parsed.debts : [],
      fire: parsed.fire || base.fire,
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