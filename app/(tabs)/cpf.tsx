import { MonthPicker } from '@/components/MonthPicker';
import { PieChartCard } from '@/components/charts';
import { Button, Card, MoneyInput, Screen, Stat } from '@/components/ui';
import { useCheckin } from '@/contexts/CheckinContext';
import { ViewToggle, useFilteredCheckin } from '@/contexts/ViewModeContext';
import { cpfAccountBreakdown, cpfByAccountType, cpfByPerson } from '@/lib/chart-data';
import { formatCurrency, sumCpf } from '@/lib/format';
import { colors, radius, spacing, typography } from '@/lib/design-tokens';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

function CpfPersonCard({
  name,
  balance,
  onChange,
}: {
  name: string;
  balance: { oa: number; sa: number; ma: number };
  onChange: (field: 'oa' | 'sa' | 'ma', value: number) => void;
}) {
  return (
    <Card style={styles.personCard}>
      <Text style={styles.personName}>{name}</Text>
      <MoneyInput label="Ordinary (OA)" value={balance.oa} onChangeValue={(v) => onChange('oa', v)} />
      <MoneyInput label="Special (SA)" value={balance.sa} onChangeValue={(v) => onChange('sa', v)} />
      <MoneyInput label="MediSave (MA)" value={balance.ma} onChangeValue={(v) => onChange('ma', v)} />
      <Stat label="Total" value={formatCurrency(sumCpf(balance))} />
    </Card>
  );
}

export default function CpfScreen() {
  const { monthYear, setMonthYear, checkin, isLoading, isSaving, saveCheckin, updateCheckin } =
    useCheckin();
  const { filteredCheckin, activeMembers } = useFilteredCheckin();
  const [editing, setEditing] = useState(false);

  if (isLoading || !checkin || !filteredCheckin) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const members = activeMembers.length > 0
    ? activeMembers
    : Object.keys(checkin.cpf).map((k) => ({ userId: k, displayName: k }));

  const EMPTY_BALANCE = { oa: 0, sa: 0, ma: 0 };

  return (
    <Screen>
      {/* Header row: title + month picker */}
      <View style={styles.pageHeader}>
        <View style={styles.pageTitleCol}>
          <Text style={styles.pageTitle}>CPF balances</Text>
          <Text style={styles.pageSubtitle}>Snapshot as of this month's check-in</Text>
        </View>
        <MonthPicker monthYear={monthYear} onChange={setMonthYear} inline />
      </View>

      <ViewToggle />

      {/* Edit toggle */}
      <Pressable
        onPress={() => setEditing((v) => !v)}
        style={({ pressed }) => [styles.editBtn, pressed && styles.editBtnPressed]}>
        <Text style={styles.editBtnText}>{editing ? 'Done editing' : 'Edit'}</Text>
      </Pressable>

      {/* Charts — hidden while editing */}
      {!editing && (
        <>
          <Card>
            <View style={styles.accountMixRow}>
              <View style={styles.accountMixCol}>
                <PieChartCard
                  title="Combined household CPF"
                  data={cpfByPerson(filteredCheckin)}
                  centerLabel="Household"
                  compact
                />
              </View>
              <View style={styles.accountMixCol}>
                <PieChartCard
                  title="By account type"
                  data={cpfByAccountType(filteredCheckin)}
                  compact
                />
              </View>
            </View>
          </Card>

          {members.length > 0 && (
            <Card>
              <View style={styles.accountMixRow}>
                {members.map((m) => (
                  <View key={m.userId} style={styles.accountMixCol}>
                    <PieChartCard
                      title={m.displayName}
                      data={cpfAccountBreakdown(filteredCheckin, m.userId)}
                      compact
                    />
                  </View>
                ))}
              </View>
            </Card>
          )}
        </>
      )}

      {/* Input cards — only shown while editing */}
      {editing && (
        <>
          <View style={styles.personRow}>
            {members.map((m) => (
              <View key={m.userId} style={styles.personCol}>
                <CpfPersonCard
                  name={m.displayName}
                  balance={checkin.cpf[m.userId] ?? EMPTY_BALANCE}
                  onChange={(field, value) =>
                    updateCheckin((c) => ({
                      ...c,
                      cpf: {
                        ...c.cpf,
                        [m.userId]: { ...(c.cpf[m.userId] ?? EMPTY_BALANCE), [field]: value },
                      },
                    }))
                  }
                />
              </View>
            ))}
          </View>

          {members.length === 0 && (
            <Text style={styles.emptyHint}>
              No family members yet. Set up your family group to track CPF per person.
            </Text>
          )}

          <Button label="Save Changes" onPress={() => { saveCheckin(); setEditing(false); }} loading={isSaving} />
        </>
      )}
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
    paddingBottom: spacing.sm,
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
  editBtn: {
    alignSelf: 'flex-end',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
  },
  editBtnPressed: {
    opacity: 0.65,
  },
  editBtnText: {
    ...typography.label,
    color: colors.textSecondary,
    textTransform: 'none',
    letterSpacing: 0,
    fontSize: 13,
  },
  personName: {
    ...typography.bodyMedium,
    color: colors.text,
    marginBottom: spacing.md,
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
  },
  accountMixRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  accountMixCol: {
    flex: 1,
  },
  personCard: {
    marginBottom: 0,
    flex: 1,
  },
  personRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  personCol: {
    flex: 1,
  },
  emptyHint: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
});
