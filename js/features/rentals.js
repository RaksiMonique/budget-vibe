function initRentals() {
  rentalsTbody.addEventListener("click", (e) => {
    const button = e.target.closest("button[data-id]");
    if (!button) return;
    const id = button.dataset.id;
    if (button.dataset.action === "edit-rental") editRental(id);
    else if (button.dataset.action === "delete-rental") deleteRental(id);
  });

  rentalForm.addEventListener("submit", (e) => { e.preventDefault(); upsertRental(); });

  modalRentalEl.addEventListener("hidden.bs.modal", () => {
    rentalForm.reset();
    rentalId.value = "";
    rentalModalTitle.textContent = "Add Rental Property";
  });

  rentalYear.addEventListener("change", () => {
    state.ui.rentalYear = clampInt(rentalYear.value, 2000, 2100, new Date().getFullYear());
    rentalYear.value = String(state.ui.rentalYear);
    saveState();
    renderRentals();
  });

  btnRentalRefresh.addEventListener("click", () => renderRentals());
}

function renderRentals() {
  if (!rentalsTbody || !rentalIncomeTbody) return;

  // 1. Render Properties List
  const list = state.rentals.slice().sort((a, b) => a.name.localeCompare(b.name));
  rentalsTbody.innerHTML = list.map(r => `
    <tr>
      <td>${escapeHtml(r.name)}</td>
      <td>${escapeHtml(r.address || "—")}</td>
      <td>${escapeHtml(r.tenant || "—")}</td>
      <td class="text-end">${formatMoney(r.amount)}</td>
      <td>
        <div class="d-flex gap-2">
          <button class="btn btn-sm btn-outline-secondary" data-action="edit-rental" data-id="${r.id}">Edit</button>
          <button class="btn btn-sm btn-outline-danger" data-action="delete-rental" data-id="${r.id}">Delete</button>
        </div>
      </td>
    </tr>
  `).join("") || `<tr><td colspan="5" class="text-muted">No rental properties added yet.</td></tr>`;

  // 2. Render Income Matrix
  const year = state.ui.rentalYear;
  ensureRentalYear(year);

  if (list.length === 0) {
    rentalIncomeTbody.innerHTML = `<tr><td colspan="14" class="text-muted">Add a property to track income.</td></tr>`;
    return;
  }

  rentalIncomeTbody.innerHTML = list.map(r => {
    const arr = getRentalIncomeArray(year, r.id);
    const total = arr.reduce((a, b) => a + safeNumber(b), 0);
    
    const inputs = arr.map((val, idx) => {
      const v = safeNumber(val);
      return `
        <td class="text-end p-1">
          <input 
            class="form-control form-control-sm text-end px-1" 
            style="min-width: 60px;"
            data-rental-year="${year}"
            data-rental-id="${r.id}"
            data-rental-month="${idx}"
            value="${v ? v : ""}"
            placeholder="${formatNumber(r.amount)}"
          >
        </td>
      `;
    }).join("");

    return `
      <tr>
        <td>${escapeHtml(r.name)}</td>
        ${inputs}
        <td class="text-end fw-bold">${formatMoney(total)}</td>
      </tr>
    `;
  }).join("");

  // Add listeners to new inputs
  rentalIncomeTbody.querySelectorAll("input[data-rental-year]").forEach(inp => {
    inp.addEventListener("input", (e) => {
      const el = e.target;
      const y = parseInt(el.dataset.rentalYear, 10);
      const rId = el.dataset.rentalId;
      const m = parseInt(el.dataset.rentalMonth, 10);
      const v = safeNumber(el.value);
      setRentalIncomeValue(y, rId, m, v);
      saveState();
    });
    inp.addEventListener("blur", () => renderRentals()); // Update totals on blur
  });
}

function upsertRental() {
  const id = rentalId.value?.trim();
  const name = rentalName.value.trim();
  const address = rentalAddress.value.trim();
  const tenant = rentalTenant.value.trim();
  const amount = safeNumber(rentalAmount.value);

  if (!name) return;

  if (id) {
    const r = state.rentals.find(x => x.id === id);
    if (!r) return;
    r.name = name;
    r.address = address;
    r.tenant = tenant;
    r.amount = amount;
    showToast("Property updated.");
  } else {
    state.rentals.push({
      id: uid(), name, address, tenant, amount,
      createdAt: new Date().toISOString()
    });
    showToast("Property added.");
  }
  saveState();
  closeModal("modalRental");
  refreshAll();
}

function editRental(id) {
  const r = state.rentals.find(x => x.id === id);
  if (!r) return;
  rentalId.value = r.id;
  rentalName.value = r.name;
  rentalAddress.value = r.address || "";
  rentalTenant.value = r.tenant || "";
  rentalAmount.value = String(r.amount);
  rentalModalTitle.textContent = "Edit Rental Property";
  openModal("modalRental");
}

function deleteRental(id) {
  const r = state.rentals.find(x => x.id === id);
  if (!r) return;
  showConfirmationModal(`Delete property "${r.name}"?`, () => {
    state.rentals = state.rentals.filter(x => x.id !== id);
    // Clean up income data
    for (const y of Object.keys(state.rentalIncome || {})) {
      if (state.rentalIncome[y] && state.rentalIncome[y][id]) delete state.rentalIncome[y][id];
    }
    saveState();
    showToast("Property deleted.");
    refreshAll();
  });
}

function ensureRentalYear(year) {
  if (!state.rentalIncome[year]) state.rentalIncome[year] = {};
}

function getRentalIncomeArray(year, rentalId) {
  ensureRentalYear(year);
  if (!state.rentalIncome[year][rentalId]) state.rentalIncome[year][rentalId] = Array(12).fill(0);
  return state.rentalIncome[year][rentalId];
}

function setRentalIncomeValue(year, rentalId, monthIdx, value) {
  const arr = getRentalIncomeArray(year, rentalId);
  arr[monthIdx] = safeNumber(value);
  state.rentalIncome[year][rentalId] = arr;
}