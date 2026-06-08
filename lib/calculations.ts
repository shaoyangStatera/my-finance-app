import type { MonthlyCheckin } from './types';

export function totalIncome(checkin: MonthlyCheckin): number {
  return Object.values(checkin.ledger.income).reduce((sum, v) => sum + (v ?? 0), 0);
}

export function totalFixedExpenses(checkin: MonthlyCheckin): number {
  return checkin.ledger.fixedExpenses.reduce((sum, item) => sum + item.amount, 0);
}

export function totalDiscretionarySpent(checkin: MonthlyCheckin): number {
  return checkin.ledger.discretionary.reduce((sum, item) => sum + item.spent, 0);
}

export function totalDiscretionaryBudget(checkin: MonthlyCheckin): number {
  return checkin.ledger.discretionary.reduce((sum, item) => sum + item.budget, 0);
}

export function netSavings(checkin: MonthlyCheckin): number {
  return totalIncome(checkin) - totalFixedExpenses(checkin) - totalDiscretionarySpent(checkin);
}

export function savingsRate(checkin: MonthlyCheckin): number {
  const income = totalIncome(checkin);
  if (income <= 0) return 0;
  return (netSavings(checkin) / income) * 100;
}

export function totalInvestments(checkin: MonthlyCheckin): number {
  return checkin.investments.reduce((sum, item) => sum + item.value, 0);
}

export function totalInsurancePremiums(checkin: MonthlyCheckin): number {
  return checkin.insurance.reduce((sum, item) => sum + item.premium, 0);
}

export function totalCpf(checkin: MonthlyCheckin): number {
  return Object.values(checkin.cpf).reduce(
    (sum, b) => sum + (b?.oa ?? 0) + (b?.sa ?? 0) + (b?.ma ?? 0),
    0,
  );
}
