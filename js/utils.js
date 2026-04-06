// /home/rowan/rox-prjects/budget-site/js/utils.js

function getSelectedMonth() {
  const year = clampInt(yearInput.value, 2000, 2100, new Date().getFullYear());
  const month = clampInt(monthSelect.value, 0, 11, new Date().getMonth());
  return { year, month };
}

function getMajorLabel(key) {
  return MAJOR_CATEGORIES.find(m => m.key === key)?.label || key;
}

function getCategory(id) {
  return state.minorCategories.find(c => c.id === id) || null;
}

function getTransferCategory() {
  return state.minorCategories.find(c => c.majorKey === "transfer");
}

function ensureTransferCategory() {
  if (!getTransferCategory()) {
    state.minorCategories.push({
      id: uid(), majorKey: "transfer", name: "Transfer", manualExpectedMonthly: 0,
      createdAt: new Date().toISOString(),
    });
  }
}

function isInMonth(isoDate, year, month) {
  if (!isoDate) return false;
  const [y, m] = isoDate.split("-").map(n => parseInt(n, 10));
  return y === year && (m - 1) === month;
}

function monthsBetweenInclusive(startDate, endDate) {
  const sY = startDate.getFullYear(), sM = startDate.getMonth();
  const eY = endDate.getFullYear(), eM = endDate.getMonth();
  return (eY - sY) * 12 + (eM - sM) + 1;
}

function uid() {
  return Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
}

function safeNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function clampInt(v, min, max, fallback) {
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function formatMoney(n) {
  const x = Number.isFinite(n) ? n : 0;
  return x.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function formatNumber(n) {
  const x = Number.isFinite(n) ? n : 0;
  return x.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

function capitalize(s) {
  return (s || "").slice(0, 1).toUpperCase() + (s || "").slice(1);
}

function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseISODate(iso) {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  return isNaN(d.getTime()) ? null : d;
}

function isInRange(dateISO, startISO, endISO) {
  return dateISO >= startISO && dateISO <= endISO;
}

function countMonthsInclusive(start, end) {
  return monthsBetweenInclusive(start, end);
}

function escapeHtml(str) {
  return (str ?? "").toString()
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
