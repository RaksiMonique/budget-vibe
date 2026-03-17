function initDebts() {
    debtForm.addEventListener("submit", (e) => { e.preventDefault(); upsertDebt(); });

    debtTbody.addEventListener("click", (e) => {
        const button = e.target.closest("button[data-id]");
        if (!button) return;
        const id = button.dataset.id;
        if (button.dataset.action === "edit-debt") {
            editDebt(id);
        } else if (button.dataset.action === "delete-debt") {
            deleteDebt(id);
        }
    });

    btnGenerateDebtPlan.addEventListener("click", generateDebtSnowballPlan);

    if (assetsDebtsTbody) {
        assetsDebtsTbody.addEventListener("click", (e) => {
            const button = e.target.closest("button[data-id]");
            if (!button) return;
            const id = button.dataset.id;
            if (button.dataset.action === "edit-debt") {
                editDebt(id);
            } else if (button.dataset.action === "delete-debt") {
                deleteDebt(id);
            }
        });
    }
}

function _renderDebtList(tbody) {
    if (!tbody) return;
    const debts = state.debts.slice().sort((a,b) => a.balance - b.balance);
    tbody.innerHTML = debts.map(d => `
        <tr>
            <td>${escapeHtml(d.name)}</td>
            <td class="text-end">${formatMoney(d.balance)}</td>
            <td class="text-end">${formatMoney(d.minPayment)}</td>
            <td class="text-end">${d.interestRate.toFixed(2)}%</td>
            <td>
                <div class="d-flex gap-2">
                    <button class="btn btn-sm btn-outline-secondary" data-action="edit-debt" data-id="${d.id}">Edit</button>
                    <button class="btn btn-sm btn-outline-danger" data-action="delete-debt" data-id="${d.id}">Delete</button>
                </div>
            </td>
        </tr>
    `).join("") || `<tr><td colspan="5" class="text-muted">No debts added yet.</td></tr>`;
}

function renderDebts() {
  _renderDebtList(debtTbody);
}

function renderDebtsForAssetsTab() {
  _renderDebtList(assetsDebtsTbody);
}

function upsertDebt() {
  const id = debtId.value?.trim();
  const name = debtName.value.trim();
  const balance = safeNumber(debtBalance.value);
  const minPayment = safeNumber(debtMinPayment.value);
  const interestRate = safeNumber(debtInterestRate.value);

  if (!name || !isFinite(balance) || !isFinite(minPayment) || !isFinite(interestRate)) return;

  if (id) {
    const d = state.debts.find(x => x.id === id);
    if (!d) return;
    d.name = name;
    d.balance = balance;
    d.minPayment = minPayment;
    d.interestRate = interestRate;
    showToast("Debt updated.");
  } else {
    state.debts.push({
      id: uid(), name, balance, minPayment, interestRate,
      createdAt: new Date().toISOString()
    });
    showToast("Debt added.");
  }
  saveState();
  closeModal("modalDebt");
  debtForm.reset();
  refreshAll();
}

function editDebt(id) {
  const d = state.debts.find(x => x.id === id);
  if (!d) return;
  debtId.value = d.id;
  debtName.value = d.name;
  debtBalance.value = d.balance;
  debtMinPayment.value = d.minPayment;
  debtInterestRate.value = d.interestRate;
  debtModalTitle.textContent = "Edit Debt";
  openModal("modalDebt");
}

function deleteDebt(id) {
  const d = state.debts.find(x => x.id === id);
  if (!d) return;
  showConfirmationModal(`Delete debt "${d.name}"?`, () => {
    state.debts = state.debts.filter(x => x.id !== id);
    saveState();
    showToast("Debt deleted.");
    refreshAll();
  });
}

function generateDebtSnowballPlan() {
  const totalPayment = safeNumber(totalDebtPayment.value);
  const totalMinimums = state.debts.reduce((sum, d) => sum + d.minPayment, 0);

  if (totalPayment < totalMinimums) {
    alert(`Total monthly payment must be at least the sum of minimum payments ($${totalMinimums.toFixed(2)}).`);
    return;
  }

  // Create a deep copy for simulation
  let simDebts = JSON.parse(JSON.stringify(state.debts));
  let plan = [];
  let month = 0;
  const safetyBreak = 600; // 50 years

  while (simDebts.some(d => d.balance > 0) && month < safetyBreak) {
    month++;
    let paymentPool = totalPayment;
    const currentDate = addMonths(new Date(), month -1);
    const monthStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

    // 1. Add interest
    for (const debt of simDebts) {
      if (debt.balance > 0) {
        const monthlyInterest = (debt.balance * (debt.interestRate / 100)) / 12;
        debt.balance += monthlyInterest;
      }
    }

    // Sort by balance for snowball
    simDebts.sort((a, b) => a.balance - b.balance);

    // 2. Pay minimums on non-target debts
    const targetDebt = simDebts.find(d => d.balance > 0);
    for (const debt of simDebts) {
      if (debt.id === targetDebt?.id || debt.balance <= 0) continue;

      const payment = Math.min(debt.balance, debt.minPayment);
      debt.balance -= payment;
      paymentPool -= payment;
      plan.push({ month: monthStr, name: debt.name, payment: payment, balance: debt.balance });
    }

    // 3. Pay snowball on target debt
    if (targetDebt) {
      const payment = Math.min(targetDebt.balance, paymentPool);
      targetDebt.balance -= payment;
      plan.push({ month: monthStr, name: targetDebt.name, payment: payment, balance: targetDebt.balance });
    }
  }

  renderDebtSnowballPlan(plan, month);
}

function renderDebtSnowballPlan(plan, totalMonths) {
  if (!plan || plan.length === 0) {
    debtPlanSummary.textContent = "No plan generated.";
    debtPlanTbody.innerHTML = "";
    return;
  }

  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  debtPlanSummary.textContent = `Payoff will take ${years} years and ${months} months.`;

  debtPlanTbody.innerHTML = plan.map(p => `
    <tr>
      <td>${p.month}</td>
      <td>${escapeHtml(p.name)}</td>
      <td class="text-end">${formatMoney(p.payment)}</td>
      <td class="text-end">${formatMoney(p.balance)}</td>
    </tr>
  `).join("");
}