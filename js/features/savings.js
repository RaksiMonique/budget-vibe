function initSavings() {
  modalGoalEl.addEventListener("show.bs.modal", () => {
    const isEditing = !!goalId.value;
    const currentGoalId = goalId.value;

    // Populate the dropdown with only un-linked sinking funds
    const allSinkingFunds = state.minorCategories.filter(c => c.majorKey === "sinking");
    const linkedFundIds = new Set(
      state.goals
        .filter(g => g.id !== currentGoalId) // Exclude current goal if editing
        .map(g => g.minorCategoryId)
    );

    const availableSinkingFunds = allSinkingFunds
      .filter(fund => !linkedFundIds.has(fund.id))
      .sort((a, b) => a.name.localeCompare(b.name));

    goalMinor.innerHTML = availableSinkingFunds.length
      ? availableSinkingFunds.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("")
      : `<option value="" disabled selected>No available Sinking Funds</option>`;

    // Populate accounts dropdown
    const accs = state.accounts.slice().sort((a,b) => a.name.localeCompare(b.name));
    if (goalAccount) {
      goalAccount.innerHTML = accs.map(a => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join("");
    }

    // Handle modal state
    if (!isEditing) {
      goalModalTitle.textContent = "Add Savings Goal";
      goalForm.reset();
      goalDeadlineDate.value = "";
      goalDurationMonths.value = "";
    } else {
      // If editing, ensure the correct fund is selected after populating the dropdown
      const g = state.goals.find(x => x.id === currentGoalId);
      if (g) {
        goalMinor.value = g.minorCategoryId;
        if (goalAccount) goalAccount.value = g.accountId || "";
      }
    }
  });

  sinkingCategoryForm.addEventListener("submit", (e) => { e.preventDefault(); upsertSinkingCategory(); });
  goalForm.addEventListener("submit", (e) => { e.preventDefault(); upsertGoal(); });
}

/* =========================
   Savings Goals
   ========================= */
function renderGoals(expectedByMinor) {
  if (!state.goals.length) {
    goalsWrap.innerHTML = `<div class="text-muted">No goals yet.</div>`;
    return;
  }

  const sel = getSelectedMonth();
  const actualAllTimeByMinor = computeActualByMinor(null, null);
  const actualMonthByMinor = computeActualByMinor(sel.year, sel.month);

  goalsWrap.innerHTML = state.goals
    .slice()
    .sort((a, b) => (a.deadlineISO || "").localeCompare(b.deadlineISO || ""))
    .map(g => {
      const cat = getCategory(g.minorCategoryId);
      const savedAll = actualAllTimeByMinor[g.minorCategoryId] || 0;
      const savedMonth = actualMonthByMinor[g.minorCategoryId] || 0;
      const pct = g.totalAmount > 0 ? Math.min(100, (savedAll / g.totalAmount) * 100) : 0;

      const acc = state.accounts.find(a => a.id === g.accountId);
      const monthlyReq = computeGoalMonthlyRequired(g);
      const expForCat = expectedByMinor[g.minorCategoryId] || 0;

      return `
        <div class="col-12">
          <div class="card shadow-soft">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-start gap-2">
                <div>
                  <div class="fw-semibold">${escapeHtml(g.name)}</div>
                  <div class="small text-muted">Category: <b>${escapeHtml(cat ? cat.name : "—")}</b></div>
                  <div class="small text-muted">Account: <b>${escapeHtml(acc ? acc.name : "Unlinked")}</b></div>
                </div>
                <div class="d-flex gap-2">
                  <button class="btn btn-sm btn-outline-secondary" onclick="editGoal('${g.id}')">Edit</button>
                  <button class="btn btn-sm btn-outline-danger" onclick="deleteGoal('${g.id}')">Delete</button>
                </div>
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
                  <div class="small text-muted">Expected this month (category total)</div>
                  <div class="fw-semibold">${formatMoney(expForCat)}</div>
                </div>
                <div class="col-12 small text-muted">Deadline: ${g.deadlineISO ? escapeHtml(g.deadlineISO) : "—"}</div>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join("");
}

function upsertGoal() {
  const id = goalId.value?.trim();
  const name = goalName.value.trim();
  const minorId = goalMinor.value;
  const accId = goalAccount ? goalAccount.value : "";
  const total = safeNumber(goalTotal.value);

  const dateISO = goalDeadlineDate.value || "";
  const durationMonthsRaw = goalDurationMonths.value ? clampInt(goalDurationMonths.value, 1, 600, 12) : null;

  if (!name || !minorId || !accId || !isFinite(total) || total <= 0) return;

  const cat = getCategory(minorId);
  if (!cat || cat.majorKey !== "sinking") {
    alert("Goal must be linked to a Sinking Fund category.");
    return;
  }

  let deadlineISO = "";
  if (dateISO) {
    deadlineISO = dateISO;
  } else if (durationMonthsRaw) {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth() + durationMonthsRaw, now.getDate());
    deadlineISO = toISODate(d);
  } else {
    alert("Provide a deadline date or duration (months).");
    return;
  }

  if (id) {
    const g = state.goals.find(x => x.id === id);
    if (!g) return;
    g.name = name;
    g.minorCategoryId = minorId;
    g.accountId = accId;
    g.totalAmount = total;
    g.deadlineISO = deadlineISO;
    showToast("Goal updated.");
  } else {
    state.goals.push({
      id: uid(),
      name,
      minorCategoryId: minorId,
      accountId: accId,
      totalAmount: total,
      deadlineISO,
      createdAt: new Date().toISOString(),
    });
    showToast("Goal added.");
  }

  saveState();
  closeModal("modalGoal");
  goalForm.reset();
  goalId.value = "";
  goalModalTitle.textContent = "Add Savings Goal";
  refreshAll();
}

window.editGoal = function (id) {
  const g = state.goals.find(x => x.id === id);
  if (!g) return;

  goalId.value = g.id;
  goalName.value = g.name;
  goalMinor.value = g.minorCategoryId;
  if (goalAccount) goalAccount.value = g.accountId || "";
  goalTotal.value = String(g.totalAmount || 0);

  goalDeadlineDate.value = g.deadlineISO || "";
  goalDurationMonths.value = "";

  goalModalTitle.textContent = "Edit Savings Goal";
  openModal("modalGoal");
};

window.deleteGoal = function (id) {
  const g = state.goals.find(x => x.id === id);
  if (!g) return;
  showConfirmationModal(`Delete goal "${g.name}"?`, () => {
    state.goals = state.goals.filter(x => x.id !== id);
    saveState();
    showToast("Goal deleted.");
    refreshAll();
  });
};

/* =========================
   Sinking categories
   ========================= */
function renderSinkingCategories(expectedByMinor, actualByMinor) {
  const sinking = state.minorCategories
    .filter(c => c.majorKey === "sinking")
    .sort((a, b) => a.name.localeCompare(b.name));

  if (!sinking.length) {
    sinkingCatTbody.innerHTML = `<tr><td colspan="4" class="text-muted">No sinking fund categories yet.</td></tr>`;
    return;
  }

  sinkingCatTbody.innerHTML = sinking.map(c => `
    <tr>
      <td>${escapeHtml(c.name)}</td>
      <td class="text-end">${formatMoney(expectedByMinor[c.id] || 0)}</td>
      <td class="text-end">${formatMoney(actualByMinor[c.id] || 0)}</td>
      <td>
        <div class="d-flex gap-2">
          <button class="btn btn-sm btn-outline-secondary" onclick="editSinkingCategory('${c.id}')">Edit</button>
          <button class="btn btn-sm btn-outline-danger" onclick="deleteSinkingCategory('${c.id}')">Delete</button>
        </div>
      </td>
    </tr>
  `).join("");
}

function upsertSinkingCategory() {
  const id = sinkingCategoryId.value?.trim();
  const name = sinkingCategoryName.value.trim();
  if (!name) return;

  const dupe = state.minorCategories.find(c =>
    c.majorKey === "sinking" &&
    c.name.toLowerCase() === name.toLowerCase() &&
    c.id !== id
  );
  if (dupe) { showToast("That sinking fund already exists."); return; }

  if (id) {
    const c = state.minorCategories.find(x => x.id === id);
    if (!c) return;
    c.name = name;
    c.manualExpectedMonthly = 0;
    showToast("Sinking fund updated.");
  } else {
    state.minorCategories.push({
      id: uid(),
      majorKey: "sinking",
      name,
      manualExpectedMonthly: 0,
      createdAt: new Date().toISOString(),
    });
    showToast("Sinking fund added.");
  }

  saveState();
  closeModal("modalSinkingCategory");
  sinkingCategoryForm.reset();
  sinkingCategoryId.value = "";
  sinkingCategoryModalTitle.textContent = "Add Sinking Fund";
  refreshAll();
}

window.editSinkingCategory = function (id) {
  const c = state.minorCategories.find(x => x.id === id && x.majorKey === "sinking");
  if (!c) return;

  sinkingCategoryId.value = c.id;
  sinkingCategoryName.value = c.name;
  sinkingCategoryModalTitle.textContent = "Edit Sinking Fund";
  openModal("modalSinkingCategory");
};

window.deleteSinkingCategory = function (id) {
  const c = state.minorCategories.find(x => x.id === id && x.majorKey === "sinking");
  if (!c) return;

  const usedInTx = state.transactions.some(t => t.minorCategoryId === id);
  const usedInGoals = state.goals.some(g => g.minorCategoryId === id);
  if (usedInTx || usedInGoals) {
    alert("Cannot delete: linked to transactions or goals. Delete those first.");
    return;
  }

  if (!confirm(`Delete sinking fund "${c.name}"?`)) return;
  state.minorCategories = state.minorCategories.filter(x => x.id !== id);
  saveState();
  showToast("Sinking fund deleted.");
  refreshAll();
};