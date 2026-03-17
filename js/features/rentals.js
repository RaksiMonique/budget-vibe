function initRentals() {
  // Main rental property modal
  rentalForm.addEventListener("submit", (e) => { e.preventDefault(); upsertRental(); });
  modalRentalEl.addEventListener("hidden.bs.modal", () => {
    rentalForm.reset();
    rentalId.value = "";
    rentalModalTitle.textContent = "Add Rental Property";
  });

  // Event delegation for main rentals table
  rentalsTbody.addEventListener("click", (e) => {
    const button = e.target.closest("button[data-action]");
    if (!button) return;

    const action = button.dataset.action;
    const rentalId = button.dataset.id || button.dataset.rentalId;
    const expenseId = button.dataset.expenseId;

    if (action === "edit-rental") {
      editRental(rentalId);
    } else if (action === "delete-rental") {
      deleteRental(rentalId);
    } else if (action === "manage-expenses") {
      openRentalExpensesModal(rentalId);
    } else if (action === "edit-rental-expense") {
      // Open the modal and pre-fill the form for editing this specific expense
      openRentalExpensesModal(rentalId);
      editRentalExpense(rentalId, expenseId);
    } else if (action === "delete-rental-expense") {
      // Delete an expense directly from the main table view
      deleteRentalExpense(rentalId, expenseId);
    }
  });

  // Rental expenses modal
  rentalExpensesForm.addEventListener("submit", (e) => { e.preventDefault(); upsertRentalExpense(); });
  btnCancelRentalExpense.addEventListener("click", resetRentalExpenseForm);
  
  // Event delegation for expenses table inside the modal
  rentalExpensesTbody.addEventListener("click", (e) => {
    const button = e.target.closest("button[data-expense-id]");
    if (!button) return;
    const rentalId = rentalForExpenseId.value;
    const expenseId = button.dataset.expenseId;
    if (button.dataset.action === "edit-expense") {
      editRentalExpense(rentalId, expenseId);
    } else if (button.dataset.action === "delete-expense") {
      deleteRentalExpense(rentalId, expenseId);
    }
  });

  // Income tracker
  btnRentalRefresh.addEventListener("click", renderRentalIncome);
  rentalYear.addEventListener("change", renderRentalIncome);
  rentalIncomeTbody.addEventListener("change", (e) => {
    if (e.target.tagName === 'INPUT' && e.target.dataset.key) {
      updateRentalIncome(e.target.dataset.key, e.target.value);
    }
  });
}

// --- Main Property Management ---

function renderRentals() {
  if (!rentalsTbody) return;
  const list = state.rentals.slice().sort((a, b) => a.name.localeCompare(b.name));

  if (!list.length) {
    rentalsTbody.innerHTML = `<tr><td colspan="6" class="text-muted">No rental properties added yet.</td></tr>`;
    return;
  }

  let html = "";
  list.forEach(r => {
    const monthlyRent = safeNumber(r.monthlyRent);

    let totalMonthlyExpenses = 0;
    if (r.expenses && r.expenses.length > 0) {
      r.expenses.forEach(exp => {
        totalMonthlyExpenses += computeBillMonthlyEquivalent(exp);
      });
    }

    const profit = monthlyRent - totalMonthlyExpenses;
    const profitClass = profit >= 0 ? 'text-success' : 'text-danger';

    html += `
      <tr class="rental-property-row">
        <td>
          <div class="fw-bold">${escapeHtml(r.name)}</div>
          <div class="small text-muted">${escapeHtml(r.address || '—')}</div>
        </td>
        <td>${escapeHtml(r.tenant || '—')}</td>
        <td class="text-end">${formatMoney(monthlyRent)}</td>
        <td class="text-end">${formatMoney(totalMonthlyExpenses)}</td>
        <td class="text-end fw-bold ${profitClass}">${formatMoney(profit)}</td>
        <td>
          <div class="d-flex gap-2">
            <button class="btn btn-sm btn-outline-primary" data-action="manage-expenses" data-id="${r.id}">Manage Expenses</button>
            <button class="btn btn-sm btn-outline-secondary" data-action="edit-rental" data-id="${r.id}">Edit</button>
            <button class="btn btn-sm btn-outline-danger" data-action="delete-rental" data-id="${r.id}">Delete</button>
          </div>
        </td>
      </tr>
    `;

    if (r.expenses && r.expenses.length > 0) {
      const expensesHtml = r.expenses
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(exp => {
          const monthlyEq = computeBillMonthlyEquivalent(exp);
          return `
            <tr>
              <td class="ps-4">${escapeHtml(exp.name)}</td>
              <td class="text-end">${formatMoney(exp.amount)}</td>
              <td>${escapeHtml(capitalize(exp.frequency))}</td>
              <td class="text-end">${formatMoney(monthlyEq)}</td>
              <td class="text-end">
                <div class="d-flex gap-1 justify-content-end">
                  <button class="btn btn-sm btn-outline-secondary py-0 px-1" data-action="edit-rental-expense" data-rental-id="${r.id}" data-expense-id="${exp.id}">Edit</button>
                  <button class="btn btn-sm btn-outline-danger py-0 px-1" data-action="delete-rental-expense" data-rental-id="${r.id}" data-expense-id="${exp.id}">Del</button>
                </div>
              </td>
            </tr>
          `;
        }).join("");

      html += `
        <tr class="rental-expenses-row">
          <td colspan="6" class="p-0" style="border-top: none; background-color: var(--bg-soft);">
            <div class="p-3" style="background-color: var(--bg-soft);">
              <table class="table table-sm table-borderless mb-0 small" style="background-color: var(--bg-soft);">
                <thead><tr><th class="ps-4">Expense Name</th><th class="text-end">Amount</th><th>Freq.</th><th class="text-end">Monthly Eq.</th><th class="text-end">Actions</th></tr></thead>
                <tbody>${expensesHtml}</tbody>
              </table>
            </div>
          </td>
        </tr>
      `;
    }
  });

  rentalsTbody.innerHTML = html;
}

function upsertRental() {
  const id = rentalId.value.trim();
  const name = rentalName.value.trim();
  if (!name) return;

  const rental = {
    name,
    address: rentalAddress.value.trim(),
    tenant: rentalTenant.value.trim(),
    monthlyRent: safeNumber(rentalAmount.value),
  };

  if (id) {
    const existing = state.rentals.find(r => r.id === id);
    if (existing) {
      Object.assign(existing, rental);
      showToast("Property updated.");
    }
  } else {
    rental.id = uid();
    rental.expenses = [];
    rental.createdAt = new Date().toISOString();
    state.rentals.push(rental);
    showToast("Property added.");
  }
  saveState();
  closeModal("modalRental");
  refreshAll();
}

function editRental(id) {
  const r = state.rentals.find(r => r.id === id);
  if (!r) return;
  rentalId.value = r.id;
  rentalName.value = r.name;
  rentalAddress.value = r.address || "";
  rentalTenant.value = r.tenant || "";
  rentalAmount.value = r.monthlyRent || 0;
  rentalModalTitle.textContent = "Edit Rental Property";
  openModal("modalRental");
}

function deleteRental(id) {
  showConfirmationModal("Delete this property and all its associated expenses?", () => {
    state.rentals = state.rentals.filter(r => r.id !== id);
    if (state.rentalIncome) {
      for (const key in state.rentalIncome) {
        if (key.startsWith(id)) {
          delete state.rentalIncome[key];
        }
      }
    }
    saveState();
    showToast("Property deleted.");
    refreshAll();
  });
}

// --- Rental Expense Management ---

function openRentalExpensesModal(rentalId) {
  const rental = state.rentals.find(r => r.id === rentalId);
  if (!rental) return;

  rentalExpensesModalTitle.textContent = `Manage Expenses for "${escapeHtml(rental.name)}"`;
  rentalForExpenseId.value = rentalId;
  resetRentalExpenseForm();
  renderRentalExpensesTable(rental);
  openModal("modalRentalExpenses");
}

function renderRentalExpensesTable(rental) {
  if (!rental.expenses || rental.expenses.length === 0) {
    rentalExpensesTbody.innerHTML = `<tr><td colspan="5" class="text-muted">No expenses added yet.</td></tr>`;
    return;
  }

  rentalExpensesTbody.innerHTML = rental.expenses
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(exp => {
      const monthlyEq = computeBillMonthlyEquivalent(exp);
      return `
        <tr>
          <td>${escapeHtml(exp.name)}</td>
          <td class="text-end">${formatMoney(exp.amount)}</td>
          <td>${escapeHtml(capitalize(exp.frequency))}</td>
          <td class="text-end">${formatMoney(monthlyEq)}</td>
          <td>
            <div class="d-flex gap-1">
              <button class="btn btn-sm btn-outline-secondary" data-action="edit-expense" data-expense-id="${exp.id}">Edit</button>
              <button class="btn btn-sm btn-outline-danger" data-action="delete-expense" data-expense-id="${exp.id}">Del</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
}

function upsertRentalExpense() {
  const rentalId = rentalForExpenseId.value;
  const expenseId = rentalExpenseId.value;
  const rental = state.rentals.find(r => r.id === rentalId);
  if (!rental) return;

  const expense = {
    name: rentalExpenseName.value.trim(),
    amount: safeNumber(rentalExpenseAmount.value),
    frequency: rentalExpenseFrequency.value,
    nextDueISO: rentalExpenseNextDue.value || null,
  };

  if (!expense.name || expense.amount <= 0) {
    showToast("Please provide a valid expense name and amount.");
    return;
  }

  if (expenseId) { // Editing
    const existing = rental.expenses.find(e => e.id === expenseId);
    if (existing) {
      Object.assign(existing, expense);
    }
  } else { // Adding
    expense.id = uid();
    if (!Array.isArray(rental.expenses)) rental.expenses = [];
    rental.expenses.push(expense);
  }

  saveState();
  showToast("Expense saved.");
  renderRentalExpensesTable(rental);
  renderRentals();
  resetRentalExpenseForm();
}

function editRentalExpense(rentalId, expenseId) {
  const rental = state.rentals.find(r => r.id === rentalId);
  const expense = rental?.expenses.find(e => e.id === expenseId);
  if (!expense) return;

  rentalExpenseFormTitle.textContent = "Edit Expense";
  rentalExpenseId.value = expense.id;
  rentalExpenseName.value = expense.name;
  rentalExpenseAmount.value = expense.amount;
  rentalExpenseFrequency.value = expense.frequency;
  rentalExpenseNextDue.value = expense.nextDueISO || "";
}

function deleteRentalExpense(rentalId, expenseId) {
  const rental = state.rentals.find(r => r.id === rentalId);
  if (!rental) return;

  showConfirmationModal("Delete this expense?", () => {
    rental.expenses = rental.expenses.filter(e => e.id !== expenseId);
    saveState();
    showToast("Expense deleted.");
    renderRentalExpensesTable(rental);
    renderRentals();
  });
}

function resetRentalExpenseForm() {
  rentalExpensesForm.reset();
  rentalExpenseId.value = "";
  rentalExpenseFormTitle.textContent = "Add Expense";
}

// --- Income Tracker (Stubbed) ---
function renderRentalIncome() {
  if (!rentalIncomeTbody) return;

  const year = parseInt(rentalYear.value, 10);
  const properties = state.rentals.slice().sort((a, b) => a.name.localeCompare(b.name));

  if (properties.length === 0) {
    rentalIncomeTbody.innerHTML = `<tr><td colspan="14" class="text-muted">No properties added yet.</td></tr>`;
    return;
  }

  let grandTotal = 0;

  rentalIncomeTbody.innerHTML = properties.map(p => {
    let yearTotal = 0;
    const monthCells = MONTHS.map((_, i) => {
      const key = `${p.id}-${year}-${i}`;
      const amount = state.rentalIncome[key] || 0;
      yearTotal += amount;
      return `
        <td class="p-1">
          <input type="number" class="form-control form-control-sm text-end" step="0.01" 
                 value="${amount || ''}" data-key="${key}" placeholder="0">
        </td>
      `;
    }).join("");

    grandTotal += yearTotal;

    return `
      <tr>
        <td>${escapeHtml(p.name)}</td>
        ${monthCells}
        <td class="text-end fw-bold">${formatMoney(yearTotal)}</td>
      </tr>
    `;
  }).join("");
}

function updateRentalIncome(key, value) {
  const val = safeNumber(value);
  if (!state.rentalIncome) state.rentalIncome = {};

  if (val > 0) {
    state.rentalIncome[key] = val;
  } else {
    delete state.rentalIncome[key]; // Keep state clean
  }

  saveState();
  renderRentalIncome(); // Re-render to update totals
}