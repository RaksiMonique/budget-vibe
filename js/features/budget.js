function initBudget() {
  btnRecalc.addEventListener("click", () => refreshAll());
}

/* =========================
   Budget table
   ========================= */
function renderBudgetTable(expectedByMinor, actualByMinor) {
  const majors = MAJOR_CATEGORIES.map(m => m.key);
  const catsByMajor = Object.fromEntries(majors.map(k => [k, []]));
  for (const c of state.minorCategories) catsByMajor[c.majorKey].push(c);
  for (const k of majors) catsByMajor[k].sort((a, b) => a.name.localeCompare(b.name));

  let rows = "";
  for (const major of majors) {
    if (major === "transfer") continue;
    const list = catsByMajor[major];
    if (!list.length) continue;

    const majorLabel = getMajorLabel(major);

    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      const exp = expectedByMinor[c.id] || 0;
      const act = actualByMinor[c.id] || 0;

      const type = MAJOR_TYPES[c.majorKey];
      const variance = (type === "inflow") ? (act - exp) : (exp - act);

      const locked = (c.majorKey === "bills" || c.majorKey === "sinking");
      const actionsHtml = locked
        ? `<span class="text-muted small">Manage in ${c.majorKey === "bills" ? "Bills" : "Sinking (Savings)"} tab</span>`
        : `
          <div class="d-flex gap-2">
            <button class="btn btn-sm btn-outline-secondary" onclick="editGeneralCategory('${c.id}')">Edit</button>
            <button class="btn btn-sm btn-outline-danger" onclick="deleteCategory('${c.id}')">Delete</button>
          </div>
        `;

      rows += `
        <tr>
          <td>${i === 0 ? `<span class="badge-soft">${escapeHtml(majorLabel)}</span>` : ""}</td>
          <td>${escapeHtml(c.name)}</td>
          <td class="text-end">${formatMoney(exp)}</td>
          <td class="text-end">${formatMoney(act)}</td>
          <td class="text-end ${variance < 0 ? "text-danger" : "text-success"}">${formatMoney(variance)}</td>
          <td>${actionsHtml}</td>
        </tr>
      `;
    }
  }

  budgetTbody.innerHTML = rows || `<tr><td colspan="6" class="text-muted">No categories yet.</td></tr>`;
}