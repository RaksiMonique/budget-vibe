import { state, saveState, getMajorLabel } from '../store.js';
import { uid, safeNumber, formatMoney, escapeHtml, showToast, openModal, closeModal, showConfirmationModal } from '../utils.js';
import { deleteBillsCategory } from './bills.js';
import { deleteSinkingCategory } from './savings.js';

let refreshPage;

export function initCategories(refreshAll) {
  refreshPage = refreshAll;

  document.getElementById('categoryForm').addEventListener("submit", (e) => { e.preventDefault(); upsertGeneralMinorCategory(); });
  document.getElementById('modalCategory').addEventListener("hidden.bs.modal", () => {
    document.getElementById('categoryForm').reset();
    document.getElementById('categoryId').value = "";
    document.getElementById('categoryModalTitle').textContent = "Add Minor Category";
  });

  document.getElementById('catTbody').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.action === 'edit-general-category') editGeneralCategory(id);
    if (btn.dataset.action === 'delete-category') deleteCategory(id);
  });
}

export function renderGeneralCategories() {
  const catTbody = document.getElementById('catTbody');
  if (!catTbody) return;
  
  const rows = state.minorCategories
    .filter(c => c.majorKey !== "bills" && c.majorKey !== "sinking" && c.majorKey !== "transfer")
    .slice()
    .sort((a, b) => (a.majorKey + a.name).localeCompare(b.majorKey + b.name))
    .map(c => `
      <tr>
        <td data-label="Major">${escapeHtml(getMajorLabel(c.majorKey))}</td>
        <td data-label="Minor">${escapeHtml(c.name)}</td>
        <td data-label="Manual Expected" class="text-end">${formatMoney(c.manualExpectedMonthly || 0)}</td>
        <td data-label="Actions">
          <div class="d-flex gap-2">
            <button class="btn btn-sm btn-outline-secondary" data-action="edit-general-category" data-id="${c.id}">Edit</button>
            <button class="btn btn-sm btn-outline-danger" data-action="delete-category" data-id="${c.id}">Delete</button>
          </div>
        </td>
      </tr>
    `);

  catTbody.innerHTML = rows.join("") || `<tr><td colspan="4" class="text-muted">No general categories yet.</td></tr>`;
}

function upsertGeneralMinorCategory() {
  const id = document.getElementById('categoryId').value?.trim();
  const majorKey = document.getElementById('categoryMajor').value;
  const name = document.getElementById('categoryName').value.trim();
  const expected = safeNumber(document.getElementById('categoryExpected').value);
  
  if (!name) return;

  if (majorKey === "bills" || majorKey === "sinking") {
    showToast("Bills and Sinking Funds must be managed in their tabs.");
    return;
  }

  const dupe = state.minorCategories.find(c =>
    c.majorKey === majorKey &&
    c.name.toLowerCase() === name.toLowerCase() &&
    c.id !== id
  );
  if (dupe) { showToast("That category already exists."); return; }

  if (id) {
    const c = state.minorCategories.find(x => x.id === id);
    if (!c) return;
    c.majorKey = majorKey;
    c.name = name;
    c.manualExpectedMonthly = expected;
    showToast("Category updated.");
  } else {
    state.minorCategories.push({
      id: uid(),
      majorKey,
      name,
      manualExpectedMonthly: expected,
      createdAt: new Date().toISOString(),
    });
    showToast("Category added.");
  }

  saveState();
  closeModal("modalCategory");
  if (refreshPage) refreshPage();
}

function editGeneralCategory(id) {
  const c = state.minorCategories.find(x => x.id === id);
  if (!c) return;
  document.getElementById('categoryId').value = c.id;
  document.getElementById('categoryMajor').value = c.majorKey;
  document.getElementById('categoryName').value = c.name;
  document.getElementById('categoryExpected').value = String(c.manualExpectedMonthly || 0);
  document.getElementById('categoryModalTitle').textContent = "Edit Minor Category";
  openModal("modalCategory");
}

function deleteCategory(id) {
  const c = state.minorCategories.find(x => x.id === id);
  if (!c) return;

  // Dispatch to specific handlers if needed
  if (c.majorKey === "bills") return deleteBillsCategory(id);
  if (c.majorKey === "sinking") return deleteSinkingCategory(id);

  // Standard delete for other categories
  const usedInTx = state.transactions.some(t => t.minorCategoryId === id);
  const usedInGoals = state.goals.some(g => g.minorCategoryId === id);
  const usedInBills = state.bills.some(b => b.minorCategoryId === id);

  if (usedInTx || usedInGoals || usedInBills) {
    alert("Cannot delete: linked to transactions, goals, or bills. Delete those first.");
    return;
  }

  showConfirmationModal(`Delete category "${c.name}"?`, () => {
    state.minorCategories = state.minorCategories.filter(x => x.id !== id);
    saveState();
    showToast("Category deleted.");
    if (refreshPage) refreshPage();
  });
}