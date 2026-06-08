import { MonthPicker } from '@/components/MonthPicker';
import { BarCompareChart, PieChartCard } from '@/components/charts';
import { Button, Card, Input, MoneyInput, Screen, Stat } from '@/components/ui';
import { useCheckin } from '@/contexts/CheckinContext';
import { ViewToggle, useFilteredCheckin } from '@/contexts/ViewModeContext';
import { netSavings, savingsRate, totalFixedExpenses, totalIncome } from '@/lib/calculations';
import {
  discretionaryByPerson,
  discretionaryBudgetVsSpent,
  discretionarySpentBreakdown,
  fixedExpensesBreakdown,
  incomeByPerson,
} from '@/lib/chart-data';
import { formatCurrency } from '@/lib/format';
import type { PersonOwner } from '@/lib/types';
import { colors, radius, spacing, typography } from '@/lib/design-tokens';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

export default function LedgerScreen() {
  const { monthYear, setMonthYear, checkin, isLoading, isSaving, saveCheckin, updateCheckin } =
    useCheckin();
  const { filteredCheckin, activeMembers } = useFilteredCheckin();

  if (isLoading || !checkin || !filteredCheckin) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const members = activeMembers.length > 0
    ? activeMembers
    : Object.keys(checkin.ledger.income)
        .filter((k) => k !== 'other')
        .map((k) => ({ userId: k, displayName: k }));

  const ownerIds = members.map((m) => m.userId) as PersonOwner[];

  return (
    <Screen>
      <View style={styles.pageHeader}>
        <View style={styles.pageTitleCol}>
          <Text style={styles.pageTitle}>Monthly ledger</Text>
          <Text style={styles.pageSubtitle}>Income, fixed costs, and discretionary spend</Text>
        </View>
        <MonthPicker monthYear={monthYear} onChange={setMonthYear} inline />
      </View>

      <ViewToggle />

      <PieChartCard title="Income composition" data={incomeByPerson(filteredCheckin)} />

      <Card>
        <Text style={styles.groupLabel}>Income</Text>
        {members.map((m) => (
          <MoneyInput
            key={m.userId}
            label={m.displayName}
            value={checkin.ledger.income[m.userId] ?? 0}
            onChangeValue={(v) =>
              updateCheckin((c) => ({
                ...c,
                ledger: { ...c.ledger, income: { ...c.ledger.income, [m.userId]: v } },
              }))
            }
          />
        ))}
        <MoneyInput
          label="Other"
          value={checkin.ledger.income['other'] ?? 0}
          onChangeValue={(v) =>
            updateCheckin((c) => ({
              ...c,
              ledger: { ...c.ledger, income: { ...c.ledger.income, other: v } },
            }))
          }
        />
        <Stat label="Total income" value={formatCurrency(totalIncome(checkin))} />
      </Card>

      <PieChartCard title="Fixed expenses" data={fixedExpensesBreakdown(filteredCheckin)} />

      <Card>
        <Text style={styles.groupLabel}>Fixed expenses</Text>
        {checkin.ledger.fixedExpenses.map((item, index) => (
          <View key={index} style={styles.row}>
            <Input
              label="Label"
              value={item.label}
              onChangeText={(text) =>
                updateCheckin((c) => {
                  const fixedExpenses = [...c.ledger.fixedExpenses];
                  fixedExpenses[index] = { ...fixedExpenses[index], label: text };
                  return { ...c, ledger: { ...c.ledger, fixedExpenses } };
                })
              }
              style={styles.rowInput}
            />
            <MoneyInput
              label="Amount"
              value={item.amount}
              onChangeValue={(v) =>
                updateCheckin((c) => {
                  const fixedExpenses = [...c.ledger.fixedExpenses];
                  fixedExpenses[index] = { ...fixedExpenses[index], amount: v };
                  return { ...c, ledger: { ...c.ledger, fixedExpenses } };
                })
              }
              style={styles.rowInput}
            />
          </View>
        ))}
        <Stat label="Total fixed" value={formatCurrency(totalFixedExpenses(filteredCheckin))} />
      </Card>

      <PieChartCard
        title="Discretionary spend"
        subtitle="By category"
        data={discretionarySpentBreakdown(filteredCheckin)}
      />

      <PieChartCard title="Discretionary by person" data={discretionaryByPerson(filteredCheckin)} />

      <BarCompareChart
        title="Budget vs spent"
        subtitle="Stacked: spent (dark) + remaining budget (light)"
        items={discretionaryBudgetVsSpent(filteredCheckin)}
      />

      <Card>
        <Text style={styles.groupLabel}>Discretionary (by person)</Text>
        {ownerIds.map((owner) => {
          const memberLabel = members.find((m) => m.userId === owner)?.displayName ?? owner;
          const entries = checkin.ledger.discretionary
            .map((item, globalIndex) => ({ item, globalIndex }))
            .filter(({ item }) => item.owner === owner);

          return (
            <View key={owner} style={styles.personBlock}>
              <Text style={styles.personLabel}>{memberLabel}</Text>
              {entries.map(({ item, globalIndex }) => (
                <View key={globalIndex} style={styles.discRow}>
                  <Input
                    label="Category"
                    value={item.category}
                    onChangeText={(text) =>
                      updateCheckin((c) => {
                        const discretionary = [...c.ledger.discretionary];
                        discretionary[globalIndex] = { ...discretionary[globalIndex], category: text };
                        return { ...c, ledger: { ...c.ledger, discretionary } };
                      })
                    }
                  />
                  <View style={styles.row}>
                    <MoneyInput
                      label="Budget"
                      value={item.budget}
                      onChangeValue={(v) =>
                        updateCheckin((c) => {
                          const discretionary = [...c.ledger.discretionary];
                          discretionary[globalIndex] = { ...discretionary[globalIndex], budget: v };
                          return { ...c, ledger: { ...c.ledger, discretionary } };
                        })
                      }
                      style={styles.rowInput}
                    />
                    <MoneyInput
                      label="Spent"
                      value={item.spent}
                      onChangeValue={(v) =>
                        updateCheckin((c) => {
                          const discretionary = [...c.ledger.discretionary];
                          discretionary[globalIndex] = { ...discretionary[globalIndex], spent: v };
                          return { ...c, ledger: { ...c.ledger, discretionary } };
                        })
                      }
                      style={styles.rowInput}
                    />
                  </View>
                </View>
              ))}
              <Button
                label={`Add ${memberLabel} expense`}
                variant="secondary"
                onPress={() =>
                  updateCheckin((c) => ({
                    ...c,
                    ledger: {
                      ...c.ledger,
                      discretionary: [
                        ...c.ledger.discretionary,
                        { category: '', budget: 0, spent: 0, owner },
                      ],
                    },
                  }))
                }
              />
            </View>
          );
        })}
      </Card>

      <Card>
        <Stat
          label="Net savings"
          value={formatCurrency(netSavings(filteredCheckin))}
          hint={`${savingsRate(filteredCheckin).toFixed(1)}% savings rate`}
          tone={netSavings(filteredCheckin) >= 0 ? 'positive' : 'negative'}
        />
      </Card>

      <Input
        label="Notes"
        value={checkin.ledger.notes}
        onChangeText={(text) =>
          updateCheckin((c) => ({
            ...c,
            ledger: { ...c.ledger, notes: text },
          }))
        }
        multiline
        numberOfLines={3}
        style={styles.notes}
      />

      <Button label="Save Changes" onPress={saveCheckin} loading={isSaving} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  pageTitleCol: {
    flex: 1,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '300',
    fontFamily: 'Inter_400Regular',
    color: colors.text,
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  groupLabel: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  rowInput: {
    flex: 1,
  },
  discRow: {
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  personBlock: {
    marginBottom: spacing.lg,
  },
  personLabel: {
    ...typography.bodyMedium,
    color: colors.text,
    marginBottom: spacing.md,
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
  },
  notes: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
});
