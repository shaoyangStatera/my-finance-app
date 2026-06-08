import type { MonthlyCheckin, PersonOwner } from './types';
import { assignColors, type ChartSlice } from './chart-colors';
import {
  netSavings,
  totalDiscretionarySpent,
  totalFixedExpenses,
  totalIncome,
  totalInsurancePremiums,
  totalInvestments,
} from './calculations';
import { sumCpf } from './format';

function safeCpf(checkin: MonthlyCheckin, key: string) {
  return checkin.cpf[key] ?? { oa: 0, sa: 0, ma: 0 };
}

export function incomeByPerson(checkin: MonthlyCheckin): ChartSlice[] {
  const income = checkin.ledger.income;
  return assignColors(
    Object.entries(income)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => ({ label: k, value: v })),
  );
}

export function cashflowBreakdown(checkin: MonthlyCheckin): ChartSlice[] {
  const income = totalIncome(checkin);
  const fixed = totalFixedExpenses(checkin);
  const discretionary = totalDiscretionarySpent(checkin);
  const savings = Math.max(0, netSavings(checkin));

  return assignColors([
    { label: 'Fixed expenses', value: fixed },
    { label: 'Discretionary', value: discretionary },
    { label: 'Savings', value: savings },
    ...(income > fixed + discretionary + savings
      ? [{ label: 'Unallocated', value: income - fixed - discretionary - savings }]
      : []),
  ]);
}

export function fixedExpensesBreakdown(checkin: MonthlyCheckin): ChartSlice[] {
  return assignColors(
    checkin.ledger.fixedExpenses.map((item) => ({
      label: item.label || 'Expense',
      value: item.amount,
    })),
  );
}

export function discretionarySpentBreakdown(checkin: MonthlyCheckin): ChartSlice[] {
  return assignColors(
    checkin.ledger.discretionary.map((item) => ({
      label: `${item.category} (${PERSON_LABELS[item.owner]})`,
      value: item.spent,
    })),
  );
}

export function discretionaryByPerson(checkin: MonthlyCheckin): ChartSlice[] {
  const totals: Record<PersonOwner, number> = {};
  for (const item of checkin.ledger.discretionary) {
    totals[item.owner] = (totals[item.owner] ?? 0) + item.spent;
  }
  return assignColors(
    Object.entries(totals).map(([k, v]) => ({ label: k, value: v })),
  );
}

export interface BarCompareItem {
  label: string;
  budget: number;
  spent: number;
}

export function discretionaryBudgetVsSpent(checkin: MonthlyCheckin): BarCompareItem[] {
  return checkin.ledger.discretionary
    .filter((item) => item.budget > 0 || item.spent > 0)
    .map((item) => ({
      label: item.category.slice(0, 12),
      budget: item.budget,
      spent: item.spent,
    }));
}

export function cpfByPerson(checkin: MonthlyCheckin): ChartSlice[] {
  return assignColors(
    Object.entries(checkin.cpf).map(([k, v]) => ({ label: k, value: sumCpf(v) })),
  );
}

export function cpfByAccountType(checkin: MonthlyCheckin): ChartSlice[] {
  let oa = 0, sa = 0, ma = 0;
  for (const v of Object.values(checkin.cpf)) {
    oa += v.oa; sa += v.sa; ma += v.ma;
  }
  return assignColors([
    { label: 'Ordinary (OA)', value: oa },
    { label: 'Special (SA)', value: sa },
    { label: 'MediSave (MA)', value: ma },
  ]);
}

export function cpfAccountBreakdown(
  checkin: MonthlyCheckin,
  owner: PersonOwner,
): ChartSlice[] {
  const balance = safeCpf(checkin, owner);
  return assignColors([
    { label: 'OA', value: balance.oa },
    { label: 'SA', value: balance.sa },
    { label: 'MA', value: balance.ma },
  ]);
}

export function investmentsByOwner(checkin: MonthlyCheckin): ChartSlice[] {
  const totals: Record<PersonOwner, number> = {};
  for (const item of checkin.investments) {
    totals[item.owner] = (totals[item.owner] ?? 0) + item.value;
  }
  return assignColors(
    Object.entries(totals).map(([k, v]) => ({ label: k, value: v })),
  );
}

export function investmentsByHolding(checkin: MonthlyCheckin): ChartSlice[] {
  return assignColors(
    checkin.investments.map((item) => ({
      label: item.name || item.platform || 'Investment',
      value: item.value,
    })),
  );
}

export function insuranceByOwner(checkin: MonthlyCheckin): ChartSlice[] {
  const totals: Record<PersonOwner, number> = {};
  for (const item of checkin.insurance) {
    totals[item.owner] = (totals[item.owner] ?? 0) + item.premium;
  }
  return assignColors(
    Object.entries(totals).map(([k, v]) => ({ label: k, value: v })),
  );
}

export function insuranceByPolicy(checkin: MonthlyCheckin): ChartSlice[] {
  return assignColors(
    checkin.insurance.map((item) => ({
      label: item.name || 'Policy',
      value: item.premium,
    })),
  );
}

export function householdWealthMix(checkin: MonthlyCheckin): ChartSlice[] {
  const totalCpf = Object.values(checkin.cpf).reduce((s, v) => s + sumCpf(v), 0);
  return assignColors([
    { label: 'CPF', value: totalCpf },
    { label: 'Investments', value: totalInvestments(checkin) },
  ]);
}

export function monthlyOutflowBreakdown(checkin: MonthlyCheckin): ChartSlice[] {
  return assignColors([
    { label: 'Fixed', value: totalFixedExpenses(checkin) },
    { label: 'Discretionary', value: totalDiscretionarySpent(checkin) },
    { label: 'Insurance', value: totalInsurancePremiums(checkin) },
  ]);
}
