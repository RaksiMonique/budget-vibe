/* ---------- DOM ---------- */
const yearInput = document.getElementById("yearInput");
const monthSelect = document.getElementById("monthSelect");
const btnThisMonth = document.getElementById("btnThisMonth");
const displayMonthYear = document.getElementById("displayMonthYear");
const pensionInput = document.getElementById("pensionInput");
const themeToggle = document.getElementById("theme-toggle");
const btnRecalc = document.getElementById("btnRecalc");

const sumIncome = document.getElementById("sumIncome");
const sumExpenses = document.getElementById("sumExpenses");
const sumNet = document.getElementById("sumNet");
const metricSavingsRate = document.getElementById("metricSavingsRate");
const metricInvestRate = document.getElementById("metricInvestRate");

const sumStocksValue = document.getElementById("sumStocksValue");
const sumDivTTM = document.getElementById("sumDivTTM");

const billsPaidSummary = document.getElementById("billsPaidSummary");
const billsPaidBar = document.getElementById("billsPaidBar");

const budgetTbody = document.getElementById("budgetTbody");
const txTbody = document.getElementById("txTbody");
const accountsTbody = document.getElementById("accountsTbody");
const goalsWrap = document.getElementById("goalsWrap");
const billsTbody = document.getElementById("billsTbody");
const catTbody = document.getElementById("catTbody");
const sinkingCatTbody = document.getElementById("sinkingCatTbody");
const billsCatTbody = document.getElementById("billsCatTbody");

const btnExport = document.getElementById("btnExport");
const fileImport = document.getElementById("fileImport");
const btnReset = document.getElementById("btnReset");

/* Debt Snowball */
const debtForm = document.getElementById("debtForm");
const debtModalTitle = document.getElementById("debtModalTitle");
const debtId = document.getElementById("debtId");
const debtName = document.getElementById("debtName");
const debtBalance = document.getElementById("debtBalance");
const debtMinPayment = document.getElementById("debtMinPayment");
const debtInterestRate = document.getElementById("debtInterestRate");
const debtTbody = document.getElementById("debtTbody");
const totalDebtPayment = document.getElementById("totalDebtPayment");
const btnGenerateDebtPlan = document.getElementById("btnGenerateDebtPlan");
const debtPlanSummary = document.getElementById("debtPlanSummary");
const debtPlanTbody = document.getElementById("debtPlanTbody");

/* Rentals tab */
const rentalForm = document.getElementById("rentalForm");
const modalRentalEl = document.getElementById("modalRental");
const rentalModalTitle = document.getElementById("rentalModalTitle");
const rentalId = document.getElementById("rentalId");
const rentalName = document.getElementById("rentalName");
const rentalAddress = document.getElementById("rentalAddress");
const rentalTenant = document.getElementById("rentalTenant");
const rentalAmount = document.getElementById("rentalAmount");
const rentalsTbody = document.getElementById("rentalsTbody");
const rentalIncomeTbody = document.getElementById("rentalIncomeTbody");
const rentalYear = document.getElementById("rentalYear");
const btnRentalRefresh = document.getElementById("btnRentalRefresh");

/* Assets tab */
const assetForm = document.getElementById("assetForm");
const modalAssetEl = document.getElementById("modalAsset");
const assetModalTitle = document.getElementById("assetModalTitle");
const assetId = document.getElementById("assetId");
const assetName = document.getElementById("assetName");
const assetCategory = document.getElementById("assetCategory");
const assetValue = document.getElementById("assetValue");
const assetNotes = document.getElementById("assetNotes");
const assetsTbody = document.getElementById("assetsTbody");
const assetsDebtsTbody = document.getElementById("assetsDebtsTbody");

/* Net Worth tab */
const nwAssets = document.getElementById("nwAssets");
const nwLiabilities = document.getElementById("nwLiabilities");
const nwTotal = document.getElementById("nwTotal");
const nwTbody = document.getElementById("nwTbody");

/* FIRE tab */
const fireForm = document.getElementById("fireForm");
const fireCurrentAge = document.getElementById("fireCurrentAge");
const fireCurrentPortfolio = document.getElementById("fireCurrentPortfolio");
const fireAnnualInvestment = document.getElementById("fireAnnualInvestment");
const fireAnnualSpending = document.getElementById("fireAnnualSpending");
const fireAnnualReturn = document.getElementById("fireAnnualReturn");
const fireWithdrawalRate = document.getElementById("fireWithdrawalRate");
const fireResultSummary = document.getElementById("fireResultSummary");
const fireChartCanvas = document.getElementById("fireChartCanvas");

/* Transaction Filters */
const txFilterDesc = document.getElementById("txFilterDesc");
const txFilterCategory = document.getElementById("txFilterCategory");
const txFilterClear = document.getElementById("txFilterClear");

/* Averages tab */
const avgStart = document.getElementById("avgStart");
const avgEnd = document.getElementById("avgEnd");
const avgMonths = document.getElementById("avgMonths");
const avgIncomeValue = document.getElementById("avgIncomeValue");
const avgExpenseValue = document.getElementById("avgExpenseValue");
const avgTbody = document.getElementById("avgTbody");
const btnAvgRefresh = document.getElementById("btnAvgRefresh");
const annualOverviewYear = document.getElementById("annualOverviewYear");
const annualOverviewTbody = document.getElementById("annualOverviewTbody");
const annualMajor = document.getElementById("annualMajor");
const annualMinor = document.getElementById("annualMinor");

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
const holdingPortfolio = document.getElementById("holdingPortfolio");
const portfolioList = document.getElementById("portfolioList");
const holdingAvgPrice = document.getElementById("holdingAvgPrice");
const holdingShares = document.getElementById("holdingShares");
const holdingCancel = document.getElementById("holdingCancel");
const holdingsTbody = document.getElementById("holdingsTbody");

/* Dividends tab */
const divYear = document.getElementById("divYear");
const btnDivRefresh = document.getElementById("btnDivRefresh");
const divTbody = document.getElementById("divTbody");
const divMonthlyTotalsRow = document.getElementById("divMonthlyTotalsRow");

/* Accounts tab */
const accountForm = document.getElementById("accountForm");
const modalAccountEl = document.getElementById("modalAccount");
const accountModalTitle = document.getElementById("accountModalTitle");
const accountId = document.getElementById("accountId");
const accountName = document.getElementById("accountName");
const accountType = document.getElementById("accountType");
const accountInitBalance = document.getElementById("accountInitBalance");

/* Transfer modal */
const transferForm = document.getElementById("transferForm");
const modalTransferEl = document.getElementById("modalTransfer");
const transferDate = document.getElementById("transferDate");
const transferFromAccount = document.getElementById("transferFromAccount");
const transferToAccount = document.getElementById("transferToAccount");
const transferAmount = document.getElementById("transferAmount");
const transferDescription = document.getElementById("transferDescription");

/* General category modal */
const categoryForm = document.getElementById("categoryForm");
const modalCategoryEl = document.getElementById("modalCategory");
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
const txSubmitAddAnotherBtn = document.getElementById("txSubmitAddAnotherBtn");
const txId = document.getElementById("txId");
const txDate = document.getElementById("txDate");
const txAccount = document.getElementById("txAccount");
const txAccountBalance = document.getElementById("txAccountBalance");
const txMajor = document.getElementById("txMajor");
const txMinor = document.getElementById("txMinor");
const txNewMinorWrap = document.getElementById("txNewMinorWrap");
const txNewMinorName = document.getElementById("txNewMinorName");
const btnSaveNewTxMinor = document.getElementById("btnSaveNewTxMinor");
const txDesc = document.getElementById("txDesc");
const txAmount = document.getElementById("txAmount");
const txBillFundWrap = document.getElementById("txBillFundWrap");
const txUseBillFund = document.getElementById("txUseBillFund");
const txBillFundLabel = document.getElementById("txBillFundLabel");
const txBillFundAvailable = document.getElementById("txBillFundAvailable");

/* Goals */
const goalForm = document.getElementById("goalForm");
const modalGoalEl = document.getElementById("modalGoal");
const goalModalTitle = document.getElementById("goalModalTitle");
const goalId = document.getElementById("goalId");
const goalName = document.getElementById("goalName");
const goalMinor = document.getElementById("goalMinor");
const goalAccount = document.getElementById("goalAccount");
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
const billSinkingFund = document.getElementById("billSinkingFund");
const billSinkingFundWrap = document.getElementById("billSinkingFundWrap");
const billSinkingFundSelectWrap = document.getElementById("billSinkingFundSelectWrap");
const billSinkingFundMinor = document.getElementById("billSinkingFundMinor");

/* Bill Fund Modal */
const modalBillFundEl = document.getElementById("modalBillFund");
const billFundForm = document.getElementById("billFundForm");
const billFundModalTitle = document.getElementById("billFundModalTitle");
const billFundId = document.getElementById("billFundId");
const billFundBalance = document.getElementById("billFundBalance");
const billFundAddAmount = document.getElementById("billFundAddAmount");
const billFundHistoryTbody = document.getElementById("billFundHistoryTbody");

/* Toast */
const toastEl = document.getElementById("appToast");
const toastBody = document.getElementById("toastBody");
const toast = toastEl ? new bootstrap.Toast(toastEl, { delay: 2000 }) : null;

/* Confirmation Modal */
const modalConfirmEl = document.getElementById("modalConfirm");
const confirmModalBody = document.getElementById("confirmModalBody");
const confirmModalBtn = document.getElementById("confirmModalBtn");

/* ---------- UI Functions ---------- */

function showToast(msg) {
  if (!toast) return;
  toastBody.textContent = msg;
  toast.show();
}

function openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const m = bootstrap.Modal.getOrCreateInstance(el);
  m.show();
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const m = bootstrap.Modal.getInstance(el);
  if (m) m.hide();
}

function showConfirmationModal(message, onConfirm) {
  if (!modalConfirmEl) return;

  confirmModalBody.textContent = message;

  // Use .cloneNode to remove any previous event listeners
  const newBtn = confirmModalBtn.cloneNode(true);
  confirmModalBtn.parentNode.replaceChild(newBtn, confirmModalBtn);
  newBtn.addEventListener("click", () => { onConfirm(); closeModal("modalConfirm"); }, { once: true });

  openModal("modalConfirm");
}

function initModalAutoFocus() {
  const autoFocusMap = [
    { modal: "modalCategory", input: "categoryMajor" },
    { modal: "modalSinkingCategory", input: "sinkingCategoryName" },
    { modal: "modalBillsCategory", input: "billsCategoryName" },
    { modal: "modalTransaction", input: "txDate" },
    { modal: "modalGoal", input: "goalName" },
    { modal: "modalBill", input: "billMinor" },
    { modal: "modalAccount", input: "accountName" },
    { modal: "modalBillFund", input: "billFundAddAmount" },
  ];
  autoFocusMap.forEach(m => {
    const el = document.getElementById(m.modal);
    if(el) el.addEventListener("shown.bs.modal", () => {
      const inp = document.getElementById(m.input);
      if(inp) inp.focus();
    });
  });
}