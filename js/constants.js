export const MAJOR_CATEGORIES = [
  { key: "income", label: "Income", color: "#A4747D" },
  { key: "fixed", label: "Fixed Expenses", color: "#C27250" },
  { key: "variable", label: "Variable Expenses", color: "#D29F80" },
  { key: "bills", label: "Bills", color: "#735557" },
  { key: "sinking", label: "Sinking (Savings) Fund", color: "#69856D" },
  { key: "fun", label: "Fun Money", color: "#97866A" },
  { key: "invest", label: "Investments", color: "#B6C1B1" },
  { key: "transfer", label: "Transfer", color: "#9E9E9E" },
];

export const MAJOR_TYPES = {
  income: "inflow",
  fixed: "outflow",
  variable: "outflow",
  bills: "outflow",
  sinking: "outflow",
  fun: "outflow",
  invest: "outflow",
  transfer: "transfer",
};

export const FREQUENCY_TO_MONTHLY_MULTIPLIER = {
  weekly: 52 / 12,
  biweekly: 26 / 12,
  monthly: 1,
  quarterly: 1 / 3,
  yearly: 1 / 12,
};

export const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];