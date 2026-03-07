function initAssets() {
  assetsTbody.addEventListener("click", (e) => {
    const button = e.target.closest("button[data-id]");
    if (!button) return;
    const id = button.dataset.id;
    if (button.dataset.action === "edit-asset") editAsset(id);
    else if (button.dataset.action === "delete-asset") deleteAsset(id);
  });
  assetForm.addEventListener("submit", (e) => { e.preventDefault(); upsertAsset(); });
  modalAssetEl.addEventListener("hidden.bs.modal", () => {
    assetForm.reset();
    assetId.value = "";
    assetModalTitle.textContent = "Add Asset";
  });
}

function renderAssets() {
  if (assetsTbody) {
    const list = state.otherAssets.slice().sort((a, b) => a.name.localeCompare(b.name));
    assetsTbody.innerHTML = list.map(a => `
      <tr>
        <td>
          <div class="fw-semibold">${escapeHtml(a.name)}</div>
          ${a.notes ? `<div class="small text-muted">${escapeHtml(a.notes)}</div>` : ""}
        </td>
        <td>${escapeHtml(a.category)}</td>
        <td class="text-end">${formatMoney(a.value)}</td>
        <td>
          <div class="d-flex gap-2">
            <button class="btn btn-sm btn-outline-secondary" data-action="edit-asset" data-id="${a.id}">Edit</button>
            <button class="btn btn-sm btn-outline-danger" data-action="delete-asset" data-id="${a.id}">Delete</button>
          </div>
        </td>
      </tr>
    `).join("") || `<tr><td colspan="4" class="text-muted">No other assets added yet.</td></tr>`;
  }
}

function upsertAsset() {
  const id = assetId.value?.trim();
  const name = assetName.value.trim();
  const category = assetCategory.value;
  const value = safeNumber(assetValue.value);
  const notes = assetNotes.value.trim();

  if (!name) return;

  if (id) {
    const a = state.otherAssets.find(x => x.id === id);
    if (!a) return;
    a.name = name;
    a.category = category;
    a.value = value;
    a.notes = notes;
    showToast("Asset updated.");
  } else {
    state.otherAssets.push({
      id: uid(),
      name,
      category,
      value,
      notes,
      createdAt: new Date().toISOString()
    });
    showToast("Asset added.");
  }
  saveState();
  closeModal("modalAsset");
  refreshAll();
}

function editAsset(id) {
  const a = state.otherAssets.find(x => x.id === id);
  if (!a) return;
  assetId.value = a.id;
  assetName.value = a.name;
  assetCategory.value = a.category;
  assetValue.value = String(a.value);
  assetNotes.value = a.notes || "";
  assetModalTitle.textContent = "Edit Asset";
  openModal("modalAsset");
}

function deleteAsset(id) {
  const a = state.otherAssets.find(x => x.id === id);
  if (!a) return;
  showConfirmationModal(`Delete asset "${a.name}"?`, () => {
    state.otherAssets = state.otherAssets.filter(x => x.id !== id);
    saveState();
    showToast("Asset deleted.");
    refreshAll();
  });
}