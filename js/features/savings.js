function initSavings() {
  // Goal Modal Events
  modalGoalEl.addEventListener("show.bs.modal", () => {
    goalNewAccountWrap.style.display = 'none';
    goalNewAccountName.value = '';

    if (!goalId.value) {
      goalModalTitle.textContent = "Add Savings Goal";
      goalSaved.value = "0";
    } else {
      goalModalTitle.textContent = "Edit Savings Goal";
    }
    repopulateGoalAccountOptions(goalId.value ? false : true);
    toggleNewGoalAccountInput();
  });

  goalAccount.addEventListener("change", toggleNewGoalAccountInput);
  btnSaveNewGoalAccount.addEventListener("click", saveNewGoalAccount);

  goalForm.addEventListener("submit", (e) => { e.preventDefault(); upsertGoal(); });

  // Event delegation for Goals
  goalsWrap.addEventListener("click", handleGoalAction);
}

/* =========================
   Goals Logic
   ========================= */

function repopulateGoalAccountOptions(forceSelectFirst) {
  const accs = state.accounts.sort((a,b) => a.name.localeCompare(b.name));
  const optionsHtml = accs.map(a => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join("");
  const addNewOption = `<option value="--new--">-- Add New Account --</option>`;
  goalAccount.innerHTML = addNewOption + optionsHtml;

  if (forceSelectFirst && accs.length) {
    goalAccount.value = accs[0].id;
  } else if (!accs.length) {
    goalAccount.value = "--new--";
  }
}

function toggleNewGoalAccountInput() {
  if (goalAccount.value === '--new--') {
    goalNewAccountWrap.style.display = 'block';
    goalNewAccountName.focus();
  } else {
    goalNewAccountWrap.style.display = 'none';
  }
}

function saveNewGoalAccount() {
  const newName = goalNewAccountName.value.trim();
  if (!newName) {
    showToast("Please enter an account name.");
    return;
  }

  const dupe = state.accounts.find(a => a.name.toLowerCase() === newName.toLowerCase());
  if (dupe) {
    showToast("An account with that name already exists.");
    return;
  }

  const newAccount = { id: uid(), name: newName, initialBalance: 0, type: 'Savings', createdAt: new Date().toISOString() };
  state.accounts.push(newAccount);
  saveState();
  showToast("Account added.");

  goalNewAccountName.value = '';
  repopulateGoalAccountOptions(false);
  goalAccount.value = newAccount.id;
  toggleNewGoalAccountInput();
}

function upsertGoal() {
  const id = goalId.value?.trim();
  const name = goalName.value.trim();
  const accId = goalAccount.value;
  const total = safeNumber(goalTotal.value);
  const saved = safeNumber(goalSaved.value);
  let deadDate = goalDeadlineDate.value;
  const deadDur = safeNumber(goalDurationMonths.value);

  if (!name || !accId || total <= 0) {
    showToast("Please fill all required fields.");
    return;
  }

  if (accId === '--new--') {
    showToast("Please save the new account before adding the goal.");
    return;
  }

  // If no date is provided but a duration is, calculate the deadline date.
  if (!deadDate && deadDur > 0) {
    deadDate = toISODate(addMonths(new Date(), deadDur));
  }

  if (id) {
    const g = state.goals.find(x => x.id === id);
    if (!g) return;

    const cat = state.minorCategories.find(c => c.id === g.minorCategoryId);
    if (!cat) {
      showToast("Error: Linked category not found.");
      return;
    }

    // Check for name collision if name is changed
    if (name.toLowerCase() !== cat.name.toLowerCase()) {
      const dupe = state.minorCategories.find(c =>
        c.majorKey === "sinking" &&
        c.name.toLowerCase() === name.toLowerCase()
      );
      if (dupe) {
        showToast("A savings goal/sinking fund with that name already exists.");
        return;
      }
    }

    g.name = name;
    g.accountId = accId;
    g.totalAmount = total;
    g.deadlineISO = deadDate || null;
    cat.initialBalance = saved;
    cat.name = name; // Sync name
    showToast("Savings Goal updated.");
  } else {
    // Check for duplicate name
    const dupe = state.minorCategories.find(c =>
      c.majorKey === "sinking" &&
      c.name.toLowerCase() === name.toLowerCase()
    );
    if (dupe) {
      showToast("A savings goal/sinking fund with that name already exists.");
      return;
    }

    // Create new category
    const newCat = {
      id: uid(),
      majorKey: "sinking",
      name: name,
      initialBalance: saved,
      manualExpectedMonthly: 0,
      createdAt: new Date().toISOString()
    };
    state.minorCategories.push(newCat);

    state.goals.push({
      id: uid(),
      name,
      minorCategoryId: newCat.id,
      accountId: accId,
      totalAmount: total,
      deadlineISO: deadDate || null,
      createdAt: new Date().toISOString(),
    });
    showToast("Savings Goal added.");
  }

  saveState();
  closeModal("modalGoal");
  goalForm.reset();
  goalId.value = "";
  refreshAll();
}

function renderGoals(expectedByMinor) {
  if (!goalsWrap) return;
  
  if (!state.goals.length) {
    goalsWrap.innerHTML = `<div class="col-12 text-muted">No savings goals yet. Add one to track progress.</div>`;
    return;
  }

  goalsWrap.innerHTML = state.goals.map(g => {
    const cat = getCategory(g.minorCategoryId);
    const currentSaved = computeSinkingFundBalance(g.minorCategoryId);
    const progress = Math.min(100, Math.max(0, (currentSaved / g.totalAmount) * 100));
    const monthlyReq = expectedByMinor[g.minorCategoryId] || 0;

    // Calculate time left
    const now = new Date();
    const deadline = g.deadlineISO ? new Date(g.deadlineISO + "T00:00:00") : null;
    let timeLabel = "";
    if (deadline && !isNaN(deadline.getTime())) {
      const diffYear = deadline.getFullYear() - now.getFullYear();
      const diffMonth = deadline.getMonth() - now.getMonth();
      const monthsLeft = Math.max(0, (diffYear * 12 + diffMonth) + 1);
      timeLabel = `<div class="small text-muted mb-2">Due ${g.deadlineISO} (${monthsLeft} month${monthsLeft !== 1 ? 's' : ''} left)</div>`;
    }

    return `
      <div class="col-md-6 col-xl-4">
        <div class="card h-100 shadow-soft">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start mb-2">
              <h6 class="fw-bold mb-0">${escapeHtml(g.name)}</h6>
            </div>
            
            ${timeLabel}
            
            <div class="d-flex justify-content-between small text-muted mb-1">
              <span>Saved: ${formatMoney(currentSaved)}</span>
              <span>Goal: ${formatMoney(g.totalAmount)}</span>
            </div>
            
            <div class="progress mb-3" style="height: 8px;">
              <div class="progress-bar" role="progressbar" style="width: ${progress}%"></div>
            </div>

            <div class="d-flex justify-content-between align-items-end">
              <div class="small">
                <div class="text-muted">Monthly Req:</div>
                <div class="fw-bold text-success">${formatMoney(monthlyReq)}</div>
              </div>
              <div>
                <button class="btn btn-sm btn-outline-secondary" onclick="editGoal('${g.id}')">Edit</button>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteGoal('${g.id}')">Delete</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function handleGoalAction(e) {} // Not strictly needed if using onclick handlers in template, but good for delegation if refactored

window.editGoal = function(id) {
  const g = state.goals.find(x => x.id === id);
  if (!g) return;

  const cat = getCategory(g.minorCategoryId);
  
  goalId.value = g.id;
  goalName.value = g.name;
  goalTotal.value = g.totalAmount;
  goalSaved.value = String(cat?.initialBalance || 0);
  goalDeadlineDate.value = g.deadlineISO || "";

  openModal("modalGoal");
  // After modal opens, the 'show.bs.modal' listener fires, but we need to set values after that
  // So we wait a tick or set them here and ensure repopulation respects value
  setTimeout(() => {
    repopulateGoalAccountOptions(false);
    goalAccount.value = g.accountId;
    toggleNewGoalAccountInput();
  }, 50);
};

window.deleteGoal = function(id) {
  const g = state.goals.find(x => x.id === id);
  if (!g) return;

  const minorId = g.minorCategoryId;
  const cat = state.minorCategories.find(c => c.id === minorId);

  // Check usage before deleting
  const usedInTx = state.transactions.some(t => t.minorCategoryId === minorId || t.sinkingFundId === minorId);
  const usedInBills = state.bills.some(b => b.sinkingFundLink === minorId);

  if (usedInTx || usedInBills) {
    alert(`Cannot delete "${g.name}": It is linked to existing transactions or recurring bills. Please re-assign or delete those items first.`);
    return;
  }

  showConfirmationModal(`Delete savings goal "${g.name}"? This will also delete the associated sinking fund and cannot be undone.`, () => {
    state.goals = state.goals.filter(x => x.id !== id);
    if (cat) {
      state.minorCategories = state.minorCategories.filter(c => c.id !== minorId);
    }
    saveState();
    showToast("Savings Goal deleted.");
    refreshAll();
  });
};