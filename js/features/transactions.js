function initTransactions() {
  modalTransactionEl.addEventListener("show.bs.modal", () => {
    txNewMinorWrap.style.display = 'none';
    txNewMinorName.value = '';

    if (!txId.value) {
      setTxModalMode("add");
      txDate.value = toISODate(new Date());
      txDesc.value = "";
      txAmount.value = "";
      if (!txMajor.value) txMajor.value = "variable";
      repopulateTxMinorOptions(txMajor.value, true);
      toggleNewMinorInput();
    }
    // Populate accounts dropdown
    const currentAccId = txAccount.value;
    const accs = state.accounts.sort((a,b) => a.name.localeCompare(b.name));
    txAccount.innerHTML = accs.map(a => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join("");
    
    if (currentAccId && accs.some(a => a.id === currentAccId)) {
      txAccount.value = currentAccId;
    } else if (!txId.value && accs.length) {
      txAccount.value = accs[0].id;
    }

    // After everything, check for the link
    checkBillSinkingLink();
    updateTxAccountBalance();
  });

  txMajor.addEventListener("change", () => {
    repopulateTxMinorOptions(txMajor.value, true);
    toggleNewMinorInput();
    checkBillSinkingLink();
  });

  txAccount.addEventListener("change", updateTxAccountBalance);

  txMinor.addEventListener("change", () => {
    toggleNewMinorInput();
    checkBillSinkingLink();
  });

  btnSaveNewTxMinor.addEventListener('click', saveNewTxMinorCategory);

  txForm.addEventListener("submit", (e) => { e.preventDefault(); upsertTransaction(false); });
  txSubmitAddAnotherBtn.addEventListener("click", () => upsertTransaction(true));

  /* Transaction Filters */
  txFilterDesc.addEventListener("input", renderTransactionsTable);
  txFilterCategory.addEventListener("change", renderTransactionsTable);
  txFilterStart.addEventListener("change", () => {
    state.ui.txFilterStart = txFilterStart.value;
    saveState();
    renderTransactionsTable();
  });
  txFilterEnd.addEventListener("change", () => {
    state.ui.txFilterEnd = txFilterEnd.value;
    saveState();
    renderTransactionsTable();
  });

  txFilterClear.addEventListener("click", () => {
    txFilterDesc.value = "";
    txFilterCategory.value = "";
    txFilterStart.value = "";
    txFilterEnd.value = "";
    state.ui.txFilterStart = "";
    state.ui.txFilterEnd = "";
    saveState();
    renderTransactionsTable();
  });

  // Event Delegation for dynamic table content (Transactions)
  txTbody.addEventListener("click", (e) => {
    const button = e.target.closest("button[data-id]");
    if (!button) return;

    const id = button.dataset.id;
    if (button.dataset.action === "edit-tx") {
      editTransaction(id);
    } else if (button.dataset.action === "delete-tx") {
      deleteTransaction(id);
    }
  });
}

function renderTransactionsTable() {
  const filterDescVal = txFilterDesc.value.toLowerCase();
  const filterCatVal = txFilterCategory.value;
  const filterStart = txFilterStart.value;
  const filterEnd = txFilterEnd.value;

  let list;

  if (filterStart && filterEnd && filterStart <= filterEnd) {
    list = state.transactions.filter(t => isInRange(t.date, filterStart, filterEnd));
  } else {
    const sel = getSelectedMonth();
    list = state.transactions.filter(t => isInMonth(t.date, sel.year, sel.month));
  }
  
  if (filterDescVal) {
    list = list.filter(t => t.description?.toLowerCase().includes(filterDescVal));
  }
  if (filterCatVal) {
    list = list.filter(t => t.minorCategoryId === filterCatVal);
  }

  list.sort((a, b) => b.date.localeCompare(a.date)); // Show most recent first

  if (!list.length) {
    txTbody.innerHTML = `<tr><td colspan="7" class="text-muted">No transactions found matching filters.</td></tr>`;
    return;
  }

  txTbody.innerHTML = list.map(t => {
    const cat = getCategory(t.minorCategoryId);
    const majorLabel = cat ? getMajorLabel(cat.majorKey) : "—";
    const minorLabel = cat ? cat.name : "—";    
    const isTransfer = cat && cat.majorKey === 'transfer';

    return `
      <tr>
        <td>${escapeHtml(t.date)}</td>
        <td>${escapeHtml(t.description || "")} ${isTransfer ? '<span class="badge bg-secondary">Transfer</span>' : ''}</td>
        <td>${escapeHtml(state.accounts.find(a => a.id === t.accountId)?.name || "—")}</td>
        <td>${escapeHtml(majorLabel)}</td>
        <td>${escapeHtml(minorLabel)}</td>
        <td class="text-end">${formatMoney(t.amount)}</td>
        <td>
          <div class="d-flex gap-2">
            <button class="btn btn-sm btn-outline-secondary" data-action="edit-tx" data-id="${t.id}">Edit</button>
            <button class="btn btn-sm btn-outline-danger" data-action="delete-tx" data-id="${t.id}">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function setTxModalMode(mode) {
  if (mode === "edit") {
    txSubmitAddAnotherBtn.style.display = "none";
    txModalTitle.textContent = "Edit Transaction";
    txSubmitBtn.textContent = "Save";
    txSubmitBtn.classList.remove("btn-success");
    txSubmitBtn.classList.add("btn-primary");
  } else {
    txSubmitAddAnotherBtn.style.display = "inline-block";
    txModalTitle.textContent = "Add Transaction";
    txSubmitBtn.textContent = "Add";
    txSubmitBtn.classList.remove("btn-primary");
    txSubmitBtn.classList.add("btn-success");
  }
}

function upsertTransaction(keepOpen = false) {
  const id = txId.value?.trim();
  const date = txDate.value;
  const accId = txAccount.value;
  const originalMinorId = txMinor.value;
  const amount = safeNumber(txAmount.value);
  const desc = txDesc.value.trim();

  if (originalMinorId === '--new--') {
    showToast("Please select or save a new minor category.");
    return;
  }

  let sinkingFundId = null;

  // Sinking fund logic override
  if (txBillFundWrap.style.display !== 'none' && txUseBillFund.checked) {
    const originalBill = state.bills.find(b => b.minorCategoryId === originalMinorId);
    if (originalBill && originalBill.sinkingFundLink) {
      sinkingFundId = originalBill.sinkingFundLink;
    }
  }

  if (!date || !accId || !originalMinorId || !isFinite(amount)) return;

  const cat = getCategory(originalMinorId);
  if (!cat) {
    alert("Could not find the category for this transaction.");
    return;
  }

  if (id) {
    const t = state.transactions.find(x => x.id === id);
    if (!t) return;

    t.date = date;
    t.accountId = accId;
    t.minorCategoryId = originalMinorId;
    t.amount = amount;
    t.description = desc;
    t.sinkingFundId = sinkingFundId;

    showToast("Transaction updated.");
  } else {
    state.transactions.push({
      id: uid(),
      date,
      accountId: accId,
      minorCategoryId: originalMinorId,
      amount,
      description: desc,
      sinkingFundId,
      createdAt: new Date().toISOString(),
    });
    showToast("Transaction added.");
  }

  saveState();
  refreshAll();

  if (keepOpen) {
    // Reset specific fields but keep Date and Category context for rapid entry
    txId.value = "";
    txDesc.value = "";
    txAmount.value = "";
    txDesc.focus(); // Focus description for next entry
    showToast("Transaction added. Ready for next.");
  } else {
    closeModal("modalTransaction");
    txForm.reset();
    txId.value = "";
    setTxModalMode("add");
  }
}

function editTransaction(id) {
  const t = state.transactions.find(x => x.id === id);
  if (!t) return;

  const cat = getCategory(t.minorCategoryId);
  if (cat && cat.majorKey === "transfer") {
    alert("Transfers cannot be edited. Please delete the transfer and create a new one.");
    return;
  }
  const majorKey = cat ? cat.majorKey : "variable";

  txId.value = t.id;
  txDate.value = t.date;

  // Populate accounts
  const accs = state.accounts.sort((a,b) => a.name.localeCompare(b.name));
  txAccount.innerHTML = accs.map(a => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join("");
  txAccount.value = t.accountId || "";
  txMajor.value = majorKey;

  repopulateTxMinorOptions(majorKey, false);
  txMinor.value = t.minorCategoryId;

  checkBillSinkingLink();
  if (t.sinkingFundId && txBillFundWrap.style.display !== 'none') {
    txUseBillFund.checked = true;
  } else {
    txUseBillFund.checked = false;
  }

  txDesc.value = t.description || "";
  txAmount.value = String(t.amount);

  // Hide "Add Another" button when editing
  txSubmitAddAnotherBtn.style.display = "none";
  setTxModalMode("edit");
  openModal("modalTransaction");
}

function deleteTransaction(id) {
  const t = state.transactions.find(x => x.id === id);
  if (!t) return;

  const onConfirm = () => {
    if (t.transferId) {
      state.transactions = state.transactions.filter(x => x.transferId !== t.transferId);
      showToast("Transfer deleted.");
    } else {
      state.transactions = state.transactions.filter(x => x.id !== id);
      showToast("Transaction deleted.");
    }
    saveState();
    refreshAll();
  };

  const message = t.transferId ? "This will delete both sides of the transfer. Continue?" : "Delete this transaction?";
  showConfirmationModal(message, onConfirm);
}

function repopulateTxMinorOptions(majorKey, forceSelectFirst) {
  const minors = state.minorCategories
    .filter(c => c.majorKey === majorKey)
    .sort((a, b) => a.name.localeCompare(b.name));

  const optionsHtml = minors.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
  const addNewOption = `<option value="--new--">-- Add New Category --</option>`;

  txMinor.innerHTML = addNewOption + optionsHtml;

  if (forceSelectFirst && minors.length) {
    txMinor.value = minors[0].id;
  } else if (!minors.length) {
    txMinor.value = "--new--";
  }
}

function toggleNewMinorInput() {
  if (txMinor.value === '--new--') {
    txNewMinorWrap.style.display = 'block';
    txNewMinorName.focus();
  } else {
    txNewMinorWrap.style.display = 'none';
  }
}

function saveNewTxMinorCategory() {
  const newName = txNewMinorName.value.trim();
  const majorKey = txMajor.value;

  if (!newName) {
    showToast("Please enter a category name.");
    return;
  }

  const dupe = state.minorCategories.find(c =>
    c.majorKey === majorKey &&
    c.name.toLowerCase() === newName.toLowerCase()
  );
  if (dupe) {
    showToast("That category already exists.");
    return;
  }

  const newCategory = {
    id: uid(), majorKey, name: newName,
    manualExpectedMonthly: 0, createdAt: new Date().toISOString(),
  };
  state.minorCategories.push(newCategory);
  saveState();
  showToast("Category added.");

  txNewMinorName.value = '';
  repopulateTxMinorOptions(majorKey, false);
  txMinor.value = newCategory.id;
  toggleNewMinorInput();
  checkBillSinkingLink();
}

function checkBillSinkingLink() {
  const minorId = txMinor.value;
  const cat = getCategory(minorId);

  // Only applies to "Bills" categories
  if (!cat || cat.majorKey !== 'bills') {
    txBillFundWrap.style.display = "none";
    txUseBillFund.checked = false;
    return;
  }

  const bill = state.bills.find(b => b.minorCategoryId === minorId);
  if (bill && bill.sinkingFundLink) {
    txBillFundWrap.style.display = "block";

    const sinkingFundCat = getCategory(bill.sinkingFundLink);
    const goal = state.goals.find(g => g.minorCategoryId === bill.sinkingFundLink);

    if (sinkingFundCat) {
      let labelText = `Deduct from Sinking Fund: <b>${escapeHtml(sinkingFundCat.name)}</b>`;
      if (goal) {
        labelText = `Pay from Goal: <b>${escapeHtml(goal.name)}</b> (${escapeHtml(sinkingFundCat.name)})`;
      }
      txBillFundLabel.innerHTML = labelText;
    }

    // Calculate and display available funds
    const available = computeSinkingFundBalance(bill.sinkingFundLink);
    txBillFundAvailable.textContent = formatMoney(available);
  } else {
    txBillFundWrap.style.display = "none";
    txUseBillFund.checked = false;
  }
}

function updateTxAccountBalance() {
  if (!txAccountBalance) return;
  const accId = txAccount.value;
  if (!accId) {
    txAccountBalance.textContent = "—";
    txAccountBalance.className = "fw-bold";
    return;
  }
  const balances = computeAccountBalances();
  const bal = balances[accId] || 0;
  txAccountBalance.textContent = formatMoney(bal);
  txAccountBalance.className = "fw-bold " + (bal < 0 ? "text-danger" : "text-success");
}