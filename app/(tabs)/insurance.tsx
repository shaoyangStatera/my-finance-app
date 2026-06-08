import { MonthPicker } from '@/components/MonthPicker';
import { PieChartCard } from '@/components/charts';
import { Button, Card, Input, MoneyInput, Screen, Stat } from '@/components/ui';
import { useCheckin } from '@/contexts/CheckinContext';
import { ViewToggle, useFilteredCheckin } from '@/contexts/ViewModeContext';
import { totalInsurancePremiums } from '@/lib/calculations';
import { insuranceByOwner, insuranceByPolicy } from '@/lib/chart-data';
import { formatCurrency } from '@/lib/format';
import type { InsuranceItem, PersonOwner } from '@/lib/types';
import { colors, spacing, typography } from '@/lib/design-tokens';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

function newId() {
  return Math.random().toString(36).slice(2, 10);
}

function InsuranceSection({
  owner,
  label,
  insurance,
  onUpdate,
  onRemove,
  onAdd,
}: {
  owner: PersonOwner;
  label: string;
  insurance: InsuranceItem[];
  onUpdate: (index: number, patch: Partial<InsuranceItem>) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
}) {
  const total = insurance.reduce((s, i) => s + i.premium, 0);

  return (
    <View style={styles.personSection}>
      <Text style={styles.personTitle}>{label}</Text>
      <Card>
        <Stat label="Monthly premiums" value={formatCurrency(total)} />
        {insurance.map((item, index) => (
          <View key={item.id} style={styles.itemBlock}>
            <Input label="Policy name" value={item.name} onChangeText={(t) => onUpdate(index, { name: t })} />
            <Input label="Coverage" value={item.coverage} onChangeText={(t) => onUpdate(index, { coverage: t })} />
            <MoneyInput label="Monthly premium" value={item.premium} onChangeValue={(v) => onUpdate(index, { premium: v })} />
            <Input
              label="Renewal date"
              value={item.renewalDate}
              onChangeText={(t) => onUpdate(index, { renewalDate: t })}
              placeholder="YYYY-MM-DD"
            />
            <Pressable onPress={() => onRemove(index)}>
              <Text style={styles.remove}>Remove</Text>
            </Pressable>
          </View>
        ))}
        <Button label="Add policy" variant="secondary" onPress={onAdd} />
      </Card>
    </View>
  );
}

export default function InsuranceScreen() {
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

  const data = filteredCheckin;

  const existingOwners = Array.from(new Set(checkin.insurance.map((i) => i.owner)));
  const members: { userId: string; displayName: string }[] = activeMembers.length > 0
    ? activeMembers
    : existingOwners.map((k) => ({ userId: k, displayName: k }));

  function itemsFor(items: InsuranceItem[], owner: PersonOwner) {
    return items
      .map((item, globalIndex) => ({ item, globalIndex }))
      .filter(({ item }) => item.owner === owner);
  }

  function renderPerson(owner: PersonOwner, label: string) {
    const entries = itemsFor(data.insurance, owner);
    return (
      <InsuranceSection
        key={owner}
        owner={owner}
        label={label}
        insurance={entries.map((e) => e.item)}
        onUpdate={(localIndex, patch) => {
          const globalIndex = entries[localIndex].globalIndex;
          updateCheckin((c) => {
            const insurance = [...c.insurance];
            insurance[globalIndex] = { ...insurance[globalIndex], ...patch };
            return { ...c, insurance };
          });
        }}
        onRemove={(localIndex) => {
          const globalIndex = entries[localIndex].globalIndex;
          updateCheckin((c) => ({
            ...c,
            insurance: c.insurance.filter((_, i) => i !== globalIndex),
          }));
        }}
        onAdd={() =>
          updateCheckin((c) => ({
            ...c,
            insurance: [
              ...c.insurance,
              { id: newId(), name: '', type: 'other', premium: 0, renewalDate: '', coverage: '', owner },
            ],
          }))
        }
      />
    );
  }

  return (
    <Screen>
      <View style={styles.pageHeader}>
        <View style={styles.pageTitleCol}>
          <Text style={styles.pageTitle}>Insurance</Text>
          <Text style={styles.pageSubtitle}>Policies and premiums by person</Text>
        </View>
        <MonthPicker monthYear={monthYear} onChange={setMonthYear} inline />
      </View>

      <ViewToggle />

      <Card elevated>
        <Text style={styles.summaryLabel}>Total monthly premiums</Text>
        <Text style={styles.summaryValue}>{formatCurrency(totalInsurancePremiums(data))}</Text>
      </Card>

      <PieChartCard title="Premiums by person" data={insuranceByOwner(data)} />
      <PieChartCard title="Premiums by policy" data={insuranceByPolicy(data)} />

      {members.map((m) => renderPerson(m.userId, m.displayName))}

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
  pageTitleCol: { flex: 1 },
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
    marginTop: 2,
  },
  summaryLabel: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 28,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    color: colors.text,
    letterSpacing: -0.8,
  },
  personSection: { marginBottom: spacing.md },
  personTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
    letterSpacing: -0.2,
  },
  itemBlock: {
    marginBottom: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  remove: {
    ...typography.caption,
    color: colors.negative,
    marginTop: spacing.sm,
  },
});
