function initBudget() {
  // Placeholder for budget initialization if needed
}

function renderBudgetTable(expectedByMinor, actualByMinor) {
  if (!budgetTbody) return;

  let html = "";

  // Filter out transfer category from budget view
  const categories = MAJOR_CATEGORIES.filter(m => m.key !== 'transfer');

  for (const major of categories) {
    const minors = state.minorCategories
      .filter(c => c.majorKey === major.key)
      .sort((a, b) => a.name.localeCompare(b.name));

    if (minors.length === 0) continue;

    // Calculate totals for the major category
    let totalExpected = 0;
    let totalActual = 0;
    minors.forEach(c => {
      totalExpected += (expectedByMinor[c.id] || 0);
      totalActual += (actualByMinor[c.id] || 0);
    });

    // Header Row
    // Using colspan="5" to accommodate the extra column for totals
    html += `
      <tr class="table-group-header">
        <td colspan="5" class="fw-bold text-uppercase text-muted small" style="background-color: ${major.color}20;">
          ${escapeHtml(major.label)}
        </td>
      </tr>
    `;

    minors.forEach((minor, index) => {
      const exp = expectedByMinor[minor.id] || 0;
      const act = actualByMinor[minor.id] || 0;
      const type = MAJOR_TYPES[major.key];
      
      let diff = 0;
      let diffClass = "";
      
      if (type === 'inflow') {
        diff = act - exp;
        diffClass = diff >= 0 ? 'text-success' : 'text-danger';
      } else {
        diff = exp - act;
        diffClass = diff >= 0 ? 'text-success' : 'text-danger';
      }

      const isLast = index === minors.length - 1;
      let totalHtml = "";
      
      if (isLast) {
        // Display the total to the right of the last line
        totalHtml = `
          <span class="fw-bold text-muted small text-nowrap">
            Total: ${formatMoney(totalActual)} / ${formatMoney(totalExpected)}
          </span>
        `;
      }

      html += `
        <tr>
          <td class="ps-4">${escapeHtml(minor.name)}</td>
          <td class="text-end">${formatMoney(exp)}</td>
          <td class="text-end">${formatMoney(act)}</td>
          <td class="text-end ${diffClass}">${formatMoney(diff)}</td>
          <td class="ps-3 align-middle">${totalHtml}</td>
        </tr>
      `;
    });
  }

  budgetTbody.innerHTML = html;
}