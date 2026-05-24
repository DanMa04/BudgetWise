export const RETURN_RATE_PRESETS: Record<
  string,
  { rate: number; label: string }
> = {
  sp500: { rate: 10, label: "S&P 500 avg (10%)" },
  bond: { rate: 4, label: "Bond fund (4%)" },
  conservative: { rate: 6, label: "Conservative (6%)" },
  aggressive: { rate: 12, label: "Aggressive (12%)" },
};

export function computeDebtPayoff(
  balance: number,
  annualRatePct: number,
  minPayment: number,
  extraPayment: number
): { months: number; totalInterest: number; payoffDate: Date } {
  if (balance <= 0 || minPayment <= 0) {
    return { months: 0, totalInterest: 0, payoffDate: new Date() };
  }

  const monthlyRate = annualRatePct / 100 / 12;
  let remaining = balance;
  let totalInterest = 0;
  let months = 0;

  while (remaining > 0 && months < 360) {
    const interest = remaining * monthlyRate;
    let payment = minPayment + extraPayment;
    if (payment > remaining + interest) payment = remaining + interest;
    const principal = payment - interest;
    remaining = Math.max(0, remaining - principal);
    totalInterest += interest;
    months++;
  }

  const payoffDate = new Date();
  payoffDate.setMonth(payoffDate.getMonth() + months);

  return {
    months,
    totalInterest: Math.round(totalInterest * 100) / 100,
    payoffDate,
  };
}

export function computeInvestmentGrowth(
  currentBalance: number,
  monthlyContribution: number,
  annualRatePct: number,
  months: number
): { finalBalance: number } {
  const monthlyRate = annualRatePct / 100 / 12;
  let balance = currentBalance;

  for (let i = 0; i < months; i++) {
    balance = balance * (1 + monthlyRate) + monthlyContribution;
  }

  return { finalBalance: Math.round(balance * 100) / 100 };
}
