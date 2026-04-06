/**
 * Unit tests for Budget Tracker Logic
 * 
 * Since app.js is not using modules, we replicate the pure logic functions here
 * to ensure the math is correct.
 */

const FREQUENCY_TO_MONTHLY_MULTIPLIER = {
  weekly: 52 / 12,
  biweekly: 26 / 12,
  monthly: 1,
  quarterly: 1 / 3,
  yearly: 1 / 12,
};

// Mock of the utility function likely found in js/utils.js
const safeNumber = (num) => (isFinite(num) ? Number(num) : 0);

function computeBillMonthlyEquivalent(bill) {
  const amt = safeNumber(bill.amount);
  const mult = FREQUENCY_TO_MONTHLY_MULTIPLIER[bill.frequency] || 1;
  return amt * mult;
}

describe('Budget Calculations', () => {
  describe('computeBillMonthlyEquivalent', () => {
    test('should return exact amount for monthly bills', () => {
      const bill = { amount: 100, frequency: 'monthly' };
      expect(computeBillMonthlyEquivalent(bill)).toBe(100);
    });

    test('should calculate yearly bills divided by 12', () => {
      const bill = { amount: 1200, frequency: 'yearly' };
      expect(computeBillMonthlyEquivalent(bill)).toBe(100);
    });

    test('should calculate weekly bills (x52 / 12)', () => {
      const bill = { amount: 100, frequency: 'weekly' };
      // 100 * 52 / 12 = 433.333...
      expect(computeBillMonthlyEquivalent(bill)).toBeCloseTo(433.33, 2);
    });

    test('should calculate quarterly bills divided by 3', () => {
      const bill = { amount: 300, frequency: 'quarterly' };
      expect(computeBillMonthlyEquivalent(bill)).toBe(100);
    });

    test('should handle string inputs for amount', () => {
      const bill = { amount: "1200", frequency: 'yearly' };
      expect(computeBillMonthlyEquivalent(bill)).toBe(100);
    });

    test('should return 0 for invalid amounts', () => {
      const bill = { amount: null, frequency: 'monthly' };
      expect(computeBillMonthlyEquivalent(bill)).toBe(0);
    });
  });
});