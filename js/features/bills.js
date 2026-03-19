import { state, saveState, getCategory } from '../store.js';
import { FREQUENCY_TO_MONTHLY_MULTIPLIER } from '../constants.js';
import { uid, safeNumber, formatMoney, escapeHtml, capitalize, toISODate, showToast, openModal, closeModal, showConfirmationModal, addMonths, addYears, isInMonth } from '../utils.js';

let refreshPage;

export function initBills(refreshAll) {
    refreshPage = refreshAll;

    document.getElementById('billsCatTbody').addEventListener('click', e => {
        const button = e.target.closest('button[data-action]');
        if (!button) return;
        const id = button.dataset.id;
        if (button.dataset.action === 'edit-bills-category') {
            editBillsCategory(id);
        } else if (button.dataset.action === 'delete-bills-category') {
            deleteBillsCategory(id);
        }
    });

    document.getElementById('billsTbody').addEventListener('click', e => {
        const button = e.target.closest('button[data-action]');
        if (!button) return;
        const id = button.dataset.id;
        if (button.dataset.action === 'edit-bill') {
            editBill(id);
        } else if (button.dataset.action === 'delete-bill') {
            deleteBill(id);
        }
    });

    document.getElementById('billMinor').addEventListener("change", toggleNewBillMinorInput);
    document.getElementById('billFreq').addEventListener("change", toggleBillSinkingFundWrap);
    document.getElementById('billSinkingFund').addEventListener("change", () => {
        document.getElementById('billSinkingFundSelectWrap').style.display = document.getElementById('billSinkingFund').checked ? "block" : "none";
    });
}

export function renderBillsCategories(expectedByMinor) {
  const billsCatTbody = document.getElementById('billsCatTbody');
  const bills = state.minorCategories
    .filter(c => c.majorKey === "bills")
    .sort((a, b) => a.name.localeCompare(b.name));

  if (!bills.length) {
    billsCatTbody.innerHTML = `<tr><td colspan="3" class="text-muted">No bills categories yet.</td></tr>`;
    return;
  }

  billsCatTbody.innerHTML = bills.map(c => `
    <tr>
      <td data-label="Minor">${escapeHtml(c.name)}</td>
      <td data-label="Expected (Auto)" class="text-end">${formatMoney(expectedByMinor[c.id] || 0)}</td>
      <td data-label="Actions">
        <div class="d-flex gap-2">
          <button class="btn btn-sm btn-outline-secondary" data-action="edit-bills-category" data-id="${c.id}">Edit</button>
          <button class="btn btn-sm btn-outline-danger" data-action="delete-bills-category" data-id="${c.id}">Delete</button>
        </div>
      </td>
    </tr>
  `).join("");
}

export function upsertBillsCategory(refreshAll) {
  const id = document.getElementById('billsCategoryId').value?.trim();
  const name = document.getElementById('billsCategoryName').value.trim();
  if (!name) return;

  const dupe = state.minorCategories.find(c =>
    c.majorKey === "bills" &&
    c.name.toLowerCase() === name.toLowerCase() &&
    c.id !== id
  );
  if (dupe) { showToast("That bills category already exists."); return; }

  if (id) {
    const c = state.minorCategories.find(x => x.id === id);
    if (!c) return;
    c.name = name;
    c.manualExpectedMonthly = 0;
    showToast("Bills category updated.");
  } else {
    state.minorCategories.push({
      id: uid(),
      majorKey: "bills",
      name,
      manualExpectedMonthly: 0,
      createdAt: new Date().toISOString(),
    });
    showToast("Bills category added.");
  }

  saveState();
  closeModal("modalBillsCategory");
  document.getElementById('billsCategoryForm').reset();
  document.getElementById('billsCategoryId').value = "";
  document.getElementById('billsCategoryModalTitle').textContent = "Add Bills Category";
  refreshAll();
}

function editBillsCategory(id) {
  const c = state.minorCategories.find(x => x.id === id && x.majorKey === "bills");
  if (!c) return;

  document.getElementById('billsCategoryId').value = c.id;
  document.getElementById('billsCategoryName').value = c.name;
  document.getElementById('billsCategoryModalTitle').textContent = "Edit Bills Category";
  openModal("modalBillsCategory");
};

export function deleteBillsCategory(id) {
  const c = state.minorCategories.find(x => x.id === id && x.majorKey === "bills");
  if (!c) return;

  const usedInTx = state.transactions.some(t => t.minorCategoryId === id);
  const usedInBills = state.bills.some(b => b.minorCategoryId === id);
  if (usedInTx || usedInBills) {
    alert("Cannot delete: linked to transactions or recurring bills. Delete those first.");
    return;
  }

  showConfirmationModal(`Delete bills category "${c.name}"?`, () => {
    state.minorCategories = state.minorCategories.filter(x => x.id !== id);
    saveState();
    showToast("Bills category deleted.");
    refreshPage();
  });
};

export function renderBills(year, month) {
  const billsTbody = document.getElementById('billsTbody');
  const list = state.bills
    .slice()
    .sort((a, b) => {
      const ca = getCategory(a.minorCategoryId)?.name || "";
      const cb = getCategory(b.minorCategoryId)?.name || "";
      return ca.localeCompare(cb);
    });

  if (!list.length) {
    billsTbody.innerHTML = `<tr><td colspan="8" class="text-muted">No recurring bills added yet.</td></tr>`;
    return;
  }

  const paidMinors = new Set(
    state.transactions
      .filter(t => isInMonth(t.date, year, month))
      .map(t => t.minorCategoryId)
  );

  billsTbody.innerHTML = list.map(b => {
    const cat = getCategory(b.minorCategoryId);
    const billLabel = cat ? cat.name : "—";

    const monthlyEq = computeBillMonthlyEquivalent(b);
    const dueThisMonth = computeFirstDueInMonth(b, year, month);
    const paid = paidMinors.has(b.minorCategoryId);

    return `
      <tr>
        <td data-label="Bill (Minor)">${escapeHtml(billLabel)}</td>
        <td data-label="Amount" class="text-end">${formatMoney(b.amount)}</td>
        <td data-label="Frequency">${escapeHtml(capitalize(b.frequency))}</td>
        <td data-label="Next Due">${escapeHtml(b.nextDueISO || "—")}</td>
        <td data-label="Due In Selected Month">${escapeHtml(dueThisMonth || "—")}</td>
        <td data-label="Monthly Eq." class="text-end">${formatMoney(monthlyEq)}</td>
        <td data-label="Status">
          <span class="badge ${paid ? "text-bg-success" : "text-bg-secondary"}">
            ${paid ? "Paid" : "Unpaid"}
          </span>
        </td>
        <td data-label="Actions">
          <div class="d-flex gap-2">
            <button class="btn btn-sm btn-outline-secondary" data-action="edit-bill" data-id="${b.id}">Edit</button>
            <button class="btn btn-sm btn-outline-danger" data-action="delete-bill" data-id="${b.id}">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

export function computeFirstDueInMonth(bill, year, month) {
  if (!bill.nextDueISO) return null;
  let d = new Date(bill.nextDueISO + "T00:00:00");
  if (isNaN(d.getTime())) return null;

  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  const endISO = toISODate(end);

  while (toISODate(d) < toISODate(start)) {
    d = addByFrequency(d, bill.frequency);
    if (d.getFullYear() > year + 10) return null;
  }

  const iso = toISODate(d);
  if (iso >= toISODate(start) && iso <= endISO) return iso;
  return null;
}

function addByFrequency(dateObj, freq) {
  const d = new Date(dateObj.getTime());
  switch (freq) {
    case "weekly": d.setDate(d.getDate() + 7); return d;
    case "biweekly": d.setDate(d.getDate() + 14); return d;
    case "monthly": return addMonths(d, 1);
    case "quarterly": return addMonths(d, 3);
    case "yearly": return addYears(d, 1);
    default: return addMonths(d, 1);
  }
}

export function computeBillMonthlyEquivalent(bill) {
  const amt = safeNumber(bill.amount);
  const mult = FREQUENCY_TO_MONTHLY_MULTIPLIER[bill.frequency] || 1;
  return amt * mult;
}

export function isBillPaidByTransactions(bill, year, month) {
  return state.transactions.some(t =>
    t.minorCategoryId === bill.minorCategoryId &&
    isInMonth(t.date, year, month)
  );
}

export function handleBillModalOpen() {
    const billId = document.getElementById('billId');
    const billMinor = document.getElementById('billMinor');
    const billSinkingFund = document.getElementById('billSinkingFund');
    const billSinkingFundSelectWrap = document.getElementById('billSinkingFundSelectWrap');
    const billNewMinorWrap = document.getElementById('billNewMinorWrap');
    const billNewMinorName = document.getElementById('billNewMinorName');
    const billSinkingFundMinor = document.getElementById('billSinkingFundMinor');

    if (!billId.value) {
        document.getElementById('billModalTitle').textContent = "Add Recurring Bill";
        billSinkingFund.checked = false;
        billSinkingFundSelectWrap.style.display = "none";
    }

    billNewMinorWrap.style.display = 'none';
    billNewMinorName.value = '';

    const bills = state.minorCategories
        .filter(c => c.majorKey === "bills")
        .sort((a, b) => a.name.localeCompare(b.name));
    const options = bills.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
    const addNewOption = `<option value="--new--">-- Add New Bill Category --</option>`;
    const currentVal = billMinor.value;
    billMinor.innerHTML = addNewOption + options;
    if (billId.value && bills.some(c => c.id === currentVal)) {
        billMinor.value = currentVal;
    }

    const goalMap = new Map();
    state.goals.forEach(g => {
        goalMap.set(g.minorCategoryId, g.name);
    });

    const sinkingFunds = state.minorCategories
        .filter(c => c.majorKey === "sinking")
        .sort((a, b) => a.name.localeCompare(b.name));
    billSinkingFundMinor.innerHTML = sinkingFunds.map(c => {
        const goalName = goalMap.get(c.id);
        const optionText = goalName
        ? `${escapeHtml(c.name)} (Goal: ${escapeHtml(goalName)})`
        : escapeHtml(c.name);
        return `<option value="${c.id}">${optionText}</option>`;
    }).join("");

    toggleBillSinkingFundWrap();
    toggleNewBillMinorInput();
}

function toggleNewBillMinorInput() {
    const billMinor = document.getElementById('billMinor');
    const billNewMinorWrap = document.getElementById('billNewMinorWrap');
    const show = billMinor.value === '--new--';
    billNewMinorWrap.style.display = show ? 'block' : 'none';
    if (show) {
        document.getElementById('billNewMinorName').focus();
    }
}

function toggleBillSinkingFundWrap() {
    const billFreq = document.getElementById('billFreq');
    const billSinkingFundWrap = document.getElementById('billSinkingFundWrap');
    const freq = billFreq.value;
    const show = freq === 'quarterly' || freq === 'yearly';
    billSinkingFundWrap.style.display = show ? "block" : "none";
    if (!show) {
        document.getElementById('billSinkingFund').checked = false;
        document.getElementById('billSinkingFundSelectWrap').style.display = "none";
    }
}

function createNewBillCategory(name) {
  const dupe = state.minorCategories.find(c => c.majorKey === "bills" && c.name.toLowerCase() === name.toLowerCase());
  if (dupe) {
    showToast("A bill category with that name already exists.");
    return null;
  }

  const newCat = { id: uid(), majorKey: "bills", name, manualExpectedMonthly: 0, createdAt: new Date().toISOString() };
  state.minorCategories.push(newCat);
  showToast("New bill category created.");
  return newCat.id;
}

export function upsertBill(refreshAll) {
  const id = document.getElementById('billId').value?.trim();
  let minorId = document.getElementById('billMinor').value;

  if (minorId === '--new--') {
    const newName = document.getElementById('billNewMinorName').value.trim();
    if (!newName) {
      showToast("Please enter a name for the new bill category.");
      return;
    }
    const existing = state.minorCategories.find(c => c.majorKey === "bills" && c.name.toLowerCase() === newName.toLowerCase());
    if (existing) {
      minorId = existing.id;
    } else {
      const newId = createNewBillCategory(newName);
      if (!newId) return;
      minorId = newId;
    }
  }

  const amount = safeNumber(document.getElementById('billAmount').value);
  const freq = document.getElementById('billFreq').value;
  const nextDue = document.getElementById('billNextDue').value;
  const useSinkingFund = document.getElementById('billSinkingFund').checked;
  const sinkingFundLink = (useSinkingFund && document.getElementById('billSinkingFundWrap').style.display !== 'none') ? document.getElementById('billSinkingFundMinor').value : null;

  if (!minorId || !isFinite(amount) || amount <= 0 || !nextDue) return;

  const cat = getCategory(minorId);
  if (!cat || cat.majorKey !== "bills") {
    alert("Bill must be linked to a Bills minor category.");
    return;
  }

  const derivedName = cat.name;

  if (id) {
    const b = state.bills.find(x => x.id === id);
    if (!b) return;
    b.name = derivedName;
    b.minorCategoryId = minorId;
    b.amount = amount;
    b.frequency = freq;
    b.nextDueISO = nextDue;
    b.sinkingFundLink = sinkingFundLink;
    showToast("Bill updated.");
  } else {
    state.bills.push({
      id: uid(),
      name: derivedName,
      minorCategoryId: minorId,
      amount,
      frequency: freq,
      nextDueISO: nextDue,
      sinkingFundLink: sinkingFundLink,
      createdAt: new Date().toISOString(),
    });
    showToast("Bill added.");
  }

  saveState();
  closeModal("modalBill");
  document.getElementById('billForm').reset();
  document.getElementById('billId').value = "";
  document.getElementById('billModalTitle').textContent = "Add Recurring Bill";
  refreshAll();
}

function editBill(id) {
  const b = state.bills.find(x => x.id === id);
  if (!b) return;

  document.getElementById('billId').value = b.id;
  document.getElementById('billMinor').value = b.minorCategoryId;
  document.getElementById('billAmount').value = String(b.amount);
  document.getElementById('billFreq').value = b.frequency;
  document.getElementById('billNextDue').value = b.nextDueISO;

  handleBillModalOpen(); // Re-run modal open logic to populate and show/hide fields

  // This must run AFTER handleBillModalOpen to correctly set the state of the checkboxes/dropdowns
  if (b.sinkingFundLink && document.getElementById('billSinkingFundWrap').style.display !== 'none') {
    const billSinkingFund = document.getElementById('billSinkingFund');
    const billSinkingFundSelectWrap = document.getElementById('billSinkingFundSelectWrap');
    const billSinkingFundMinor = document.getElementById('billSinkingFundMinor');
    billSinkingFund.checked = true;
    billSinkingFundSelectWrap.style.display = "block";
    billSinkingFundMinor.value = b.sinkingFundLink;
  }

  document.getElementById('billModalTitle').textContent = "Edit Recurring Bill";
  openModal("modalBill");
};

function deleteBill(id) {
  const b = state.bills.find(x => x.id === id);
  if (!b) return;
  showConfirmationModal("Delete this recurring bill?", () => {
    state.bills = state.bills.filter(x => x.id !== id);
    saveState();
    showToast("Bill deleted.");
    refreshPage();
  });
}

export function deleteCategory(id) {
  // This is a generic delete that routes to the specific one
  const c = state.minorCategories.find(x => x.id === id);
  if (!c) return;

  if (c.majorKey === "bills") return deleteBillsCategory(id);
  // if (c.majorKey === "sinking") return deleteSinkingCategory(id); // This is in savings.js

  // ... logic for general categories
}