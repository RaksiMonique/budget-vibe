let netWorthChart = null;

function initNetWorth() {
  // No specific event listeners for net worth tab itself,
  // but keeping this for consistency.
}

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