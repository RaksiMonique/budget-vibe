import { state } from './store.js';
import { safeNumber, monthsBetweenInclusive } from './utils.js';

export function computeSinkingFundBalance(minorId) {
  let balance = 0;
  for (const t of state.transactions) {
    const amt = safeNumber(t.amount);
    if (t.minorCategoryId === minorId) {
      balance += amt;
    }
    if (t.sinkingFundId === minorId) {
      balance -= amt;
    }
  }
  return balance;
}

export function computeGoalMonthlyRequired(goal) {
  const total = safeNumber(goal.totalAmount);
  if (total <= 0) return 0;

  const now = new Date();
  const deadline = goal.deadlineISO ? new Date(goal.deadlineISO + "T00:00:00") : null;
  if (!deadline || isNaN(deadline.getTime()) || deadline < now) return 0;

  let months = monthsBetweenInclusive(now, deadline);
  months = Math.max(1, months);

  return total / months;
}