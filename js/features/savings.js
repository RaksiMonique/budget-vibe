function initSavings() {
  // Goal Modal Events
  modalGoalEl.addEventListener("show.bs.modal", () => {
    // Reset new input state
    goalNewMinorWrap.style.display = 'none';
    goalNewMinorName.value = '';

    if (!goalId.value) {
      goalModalTitle.textContent = "Add Savings Goal";
    } else {
      goalModalTitle.textContent = "Edit Savings Goal";
    }

    repopulateGoalMinorOptions(goalId.value ? null : true); // Force select first if adding
    repopulateGoalAccountOptions();
    toggleNewGoalMinorInput();
  });

  goalMinor.addEventListener("change", toggleNewGoalMinorInput);
  goalForm.addEventListener("submit", (e) => { e.preventDefault(); upsertGoal(); });

  // Sinking Category Modal (Legacy/Direct)
  sinkingCategoryForm.addEventListener("submit", (e) => { e.preventDefault(); upsertSinkingCategory(); });
  
  // Event delegation for Goals and Sinking Categories tables
  goalsWrap.addEventListener("click", handleGoalAction);
  sinkingCatTbody.addEventListener("click", handleSinkingAction);
}

/* =========================
   Goals Logic
   ========================= */

function repopulateGoalMinorOptions(forceSelectFirst) {
  // Filter for sinking funds
  const sinkingCats = state.minorCategories
    .filter(c => c.majorKey === "sinking")
    .sort((a, b) => a.name.localeCompare(b.name));

  // Map existing goals to find which categories are already taken
  const usedMinors = new Set();
  state.goals.forEach(g => {
    // If we are editing a goal, don't mark its own category as used (so we can keep it selected)
    if (goalId.value && g.id === goalId.value) return;
    usedMinors.add(g.minorCategoryId);
  });

  let optionsHtml = sinkingCats.map(c => {
    const isUsed = usedMinors.has(c.id);
    const label = isUsed ? `${escapeHtml(c.name)} (Already linked)` : escapeHtml(c.name);
    return `<option value="${c.id}" ${isUsed ? 'disabled' : ''}>${label}</option>`;
  }).join("");

  // Add the "New" option at the top
  const addNewOption = `<option value="--new--">-- Add New Sinking Fund --</option>`;
  goalMinor.innerHTML = addNewOption + optionsHtml;

  // Selection logic
  if (goalId.value) {
    // If editing, value is set by openModal, but we need to ensure it's still valid
    const currentGoal = state.goals.find(g => g.id === goalId.value);
    if (currentGoal) goalMinor.value = currentGoal.minorCategoryId;
  } else if (forceSelectFirst) {
    // If adding, try to select the first available existing category
    const firstAvailable = sinkingCats.find(c => !usedMinors.has(c.id));
    if (firstAvailable) {
      goalMinor.value = firstAvailable.id;
    } else {
      goalMinor.value = "--new--";
    }
  }
}

function repopulateGoalAccountOptions() {
  const accs = state.accounts.sort((a,b) => a.name.localeCompare(b.name));
  goalAccount.innerHTML = accs.map(a => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join("");
}

function toggleNewGoalMinorInput() {
  if (goalMinor.value === '--new--') {
    goalNewMinorWrap.style.display = 'block';
    goalNewMinorName.focus();
  } else {
    goalNewMinorWrap.style.display = 'none';
  }
}

function upsertGoal() {
  const id = goalId.value?.trim();
  let minorId = goalMinor.value;
  const name = goalName.value.trim();
  const accId = goalAccount.value;
  const total = safeNumber(goalTotal.value);
  let deadDate = goalDeadlineDate.value;
  const deadDur = safeNumber(goalDurationMonths.value);

  if (!name || !minorId || !accId || total <= 0) {
    showToast("Please fill all required fields.");
    return;
  }

  // Handle creation of new Sinking Fund on the fly
  // If no date is provided but a duration is, calculate the deadline date.
  if (!deadDate && deadDur > 0) {
    deadDate = toISODate(addMonths(new Date(), deadDur));
  }

  if (minorId === '--new--') {
    const newCatName = goalNewMinorName.value.trim();
    if (!newCatName) {
      showToast("Please enter a name for the new Sinking Fund.");
      return;
    }
    
    // Check duplicate
    const dupe = state.minorCategories.find(c => c.majorKey === "sinking" && c.name.toLowerCase() === newCatName.toLowerCase());
    if (dupe) {
      showToast("A Sinking Fund with that name already exists.");
      return;
    }

    // Create new category
    const newCat = {
      id: uid(),
      majorKey: "sinking",
      name: newCatName,
      manualExpectedMonthly: 0,
      createdAt: new Date().toISOString()
    };
    state.minorCategories.push(newCat);
    minorId = newCat.id; // Use this ID for the goal
  }

  if (id) {
    const g = state.goals.find(x => x.id === id);
    if (!g) return;
    g.name = name;
    g.minorCategoryId = minorId;
    g.accountId = accId;
    g.totalAmount = total;
    g.deadlineISO = deadDate || null;
    showToast("Savings Goal updated.");
  } else {
    state.goals.push({
      id: uid(),
      name,
      minorCategoryId: minorId,
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

    return `
      <div class="col-md-6 col-xl-4">
        <div class="card h-100 shadow-soft">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start mb-2">
              <h6 class="fw-bold mb-0">${escapeHtml(g.name)}</h6>
              <span class="badge badge-soft">${cat ? escapeHtml(cat.name) : 'Unknown'}</span>
            </div>
            
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
  
  goalId.value = g.id;
  goalName.value = g.name;
  goalTotal.value = g.totalAmount;
  goalDeadlineDate.value = g.deadlineISO || "";
  
  openModal("modalGoal");
  // After modal opens, the 'show.bs.modal' listener fires, but we need to set values after that
  // So we wait a tick or set them here and ensure repopulation respects value
  setTimeout(() => {
    repopulateGoalAccountOptions();
    goalAccount.value = g.accountId;
    repopulateGoalMinorOptions(false);
    goalMinor.value = g.minorCategoryId;
    toggleNewGoalMinorInput();
  }, 50);
};

window.deleteGoal = function(id) {
  const g = state.goals.find(x => x.id === id);
  if (!g) return;
  
  showConfirmationModal(`Delete savings goal "${g.name}"?`, () => {
    state.goals = state.goals.filter(x => x.id !== id);
    saveState();
    showToast("Savings Goal deleted.");
    refreshAll();
  });
};

/* =========================
   Sinking Categories Logic
   ========================= */

function renderSinkingCategories(expectedByMinor, actualByMinor) {
  if (!sinkingCatTbody) return;
  
  const cats = state.minorCategories
    .filter(c => c.majorKey === "sinking")
    .sort((a, b) => a.name.localeCompare(b.name));

  if (!cats.length) {
    sinkingCatTbody.innerHTML = `<tr><td colspan="4" class="text-muted">No sinking funds yet.</td></tr>`;
    return;
  }

  sinkingCatTbody.innerHTML = cats.map(c => {
    return `
      <tr>
        <td>${escapeHtml(c.name)}</td>
        <td class="text-end">${formatMoney(expectedByMinor[c.id] || 0)}</td>
        <td class="text-end">${formatMoney(actualByMinor[c.id] || 0)}</td>
        <td>
          <button class="btn btn-sm btn-outline-danger" onclick="deleteSinkingCategory('${c.id}')">Delete</button>
        </td>
      </tr>
    `;
  }).join("");
}

function handleSinkingAction(e) {} 

// Kept for app.js deleteCategory call
window.deleteSinkingCategory = function(id) {
  const c = state.minorCategories.find(x => x.id === id);
  if (!c) return;

  // Check usage
  const usedInTx = state.transactions.some(t => t.minorCategoryId === id);
  const usedInGoals = state.goals.some(g => g.minorCategoryId === id);
  const usedInBills = state.bills.some(b => b.sinkingFundLink === id);

  if (usedInTx || usedInGoals || usedInBills) {
    alert("Cannot delete: Linked to transactions, goals, or bills.");
    return;
  }

  showConfirmationModal(`Delete sinking fund "${c.name}"?`, () => {
    state.minorCategories = state.minorCategories.filter(x => x.id !== id);
    saveState();
    showToast("Sinking fund deleted.");
    refreshAll();
  });
};

// Kept for legacy support if modal still exists in HTML
function upsertSinkingCategory() {
  const id = sinkingCategoryId.value?.trim();
  const name = sinkingCategoryName.value.trim();
  if (!name) return;

  const dupe = state.minorCategories.find(c => c.majorKey === "sinking" && c.name.toLowerCase() === name.toLowerCase());
  if (dupe) { showToast("Sinking Fund already exists."); return; }

  state.minorCategories.push({
    id: uid(),
    majorKey: "sinking",
    name: name,
    manualExpectedMonthly: 0,
    createdAt: new Date().toISOString(),
  });
  
  saveState();
  closeModal("modalSinkingCategory");
  sinkingCategoryForm.reset();
  refreshAll();
}