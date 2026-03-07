function initAccounts() {
  accountsTbody.addEventListener("click", (e) => {
    const button = e.target.closest("button[data-id]");
    if (!button) return;

    const id = button.dataset.id;
    if (button.dataset.action === "edit-account") {
      editAccount(id);
    } else if (button.dataset.action === "delete-account") {
      deleteAccount(id);
    }
  });

  accountForm.addEventListener("submit", (e) => { e.preventDefault(); upsertAccount(); });
  modalAccountEl.addEventListener("hidden.bs.modal", () => {
    accountForm.reset();
    accountId.value = "";
    accountModalTitle.textContent = "Add Account";
  });
}

function renderAccounts() {
  if (!accountsTbody) return;

  // Calculate current balances
  // Balance = Initial + Inflow - Outflow
  const balances = {};
  state.accounts.forEach(a => {
    balances[a.id] = safeNumber(a.initialBalance);
  });

  state.transactions.forEach(t => {
    if (!t.accountId) return;
    if (balances[t.accountId] === undefined) return;

    const cat = getCategory(t.minorCategoryId);
    if (!cat) return; // Should not happen often
    const type = MAJOR_TYPES[cat.majorKey];

    if (type === 'transfer') {
      // For transfers, 'in' adds to balance, 'out' subtracts.
      // This correctly handles moving money between any two accounts.
      if (t.transferType === 'in') {
        balances[t.accountId] += safeNumber(t.amount);
      } else { // 'out' or undefined for legacy transfers
        balances[t.accountId] -= safeNumber(t.amount);
      }
    } else if (type === "inflow") {
      balances[t.accountId] += safeNumber(t.amount);
    } else {
      // Outflow or Savings (treated as money leaving the account)
      balances[t.accountId] -= safeNumber(t.amount);
    }
  });

  // Group accounts by type
  const groupedAccounts = {};
  state.accounts.forEach(acc => {
    const type = acc.type || 'Other';
    if (!groupedAccounts[type]) {
      groupedAccounts[type] = [];
    }
    groupedAccounts[type].push(acc);
  });

  let html = "";
  const groupOrder = ['Checking', 'Savings', 'Investment', 'Credit Card', 'Cash', 'Other'];

  groupOrder.forEach(groupName => {
    const accountsInGroup = groupedAccounts[groupName];
    if (accountsInGroup && accountsInGroup.length > 0) {
      // Add a header for the group
      html += `
        <tr class="table-group-header">
          <td colspan="4">${escapeHtml(groupName)}</td>
        </tr>
      `;
      
      // Sort accounts within the group by name
      accountsInGroup.sort((a, b) => a.name.localeCompare(b.name));

      accountsInGroup.forEach(a => {
        const current = balances[a.id];
        html += `
          <tr>
            <td class="ps-4">${escapeHtml(a.name)}</td>
            <td class="text-end text-muted">${formatMoney(a.initialBalance)}</td>
            <td class="text-end fw-bold ${current < 0 ? 'text-danger' : ''}">${formatMoney(current)}</td>
            <td>
              <div class="d-flex gap-2">
                <button class="btn btn-sm btn-outline-secondary" data-action="edit-account" data-id="${a.id}">Edit</button>
                <button class="btn btn-sm btn-outline-danger" data-action="delete-account" data-id="${a.id}">Delete</button>
              </div>
            </td>
          </tr>
        `;
      });
    }
  });

  accountsTbody.innerHTML = html || `<tr><td colspan="4" class="text-muted">No accounts found.</td></tr>`;
}

function upsertAccount() {
  const id = accountId.value?.trim();
  const name = accountName.value.trim();
  const type = accountType.value;
  const initBal = safeNumber(accountInitBalance.value);

  if (!name) return;

  if (id) {
    const a = state.accounts.find(x => x.id === id);
    if (!a) return;
    a.name = name;
    a.type = type;
    a.initialBalance = initBal;
    showToast("Account updated.");
  } else {
    state.accounts.push({
      id: uid(),
      name,
      type,
      initialBalance: initBal,
      createdAt: new Date().toISOString()
    });
    showToast("Account added.");
  }
  saveState();
  closeModal("modalAccount");
  refreshAll();
}

function editAccount(id) {
  const a = state.accounts.find(x => x.id === id);
  if (!a) return;
  accountId.value = a.id;
  accountName.value = a.name;
  accountType.value = a.type;
  accountInitBalance.value = String(a.initialBalance);
  accountModalTitle.textContent = "Edit Account";
  openModal("modalAccount");
}

function deleteAccount(id) {
  const a = state.accounts.find(x => x.id === id);
  if (!a) return;

  // Check if used in transactions
  const used = state.transactions.some(t => t.accountId === id);
  if (used) {
    alert("Cannot delete account: It has associated transactions. Delete them first.");
    return;
  }

  showConfirmationModal(`Delete account "${a.name}"?`, () => {
    state.accounts = state.accounts.filter(x => x.id !== id);
    saveState();
    showToast("Account deleted.");
    refreshAll();
  });
}

function seedStarterAccounts() {
  state.accounts = [
    { id: uid(), name: "Cash", type: "Cash", initialBalance: 0, createdAt: new Date().toISOString() },
    { id: uid(), name: "Checking", type: "Checking", initialBalance: 0, createdAt: new Date().toISOString() }
  ];
}