import { NotificationBell } from '@/components/NotificationBell';
import { MonthPicker } from '@/components/MonthPicker';
import { PieChartCard } from '@/components/charts';
import { Button, Card, Input, MoneyInput, Screen, Stat } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { useCheckin } from '@/contexts/CheckinContext';
import { useFamily, useMemberNames } from '@/contexts/FamilyContext';
import { ViewToggle, useFilteredCheckin } from '@/contexts/ViewModeContext';
import { investmentsByHolding, investmentsByOwner } from '@/lib/chart-data';
import { formatCurrency } from '@/lib/format';
import type { InvestmentItem, InvestmentType, PersonOwner, StockQuote } from '@/lib/types';
import { INVESTMENT_TYPES } from '@/lib/types';
import { fetchStockQuote } from '@/lib/api';
import { useColors } from '@/contexts/ThemeContext';
import { type Colors, radius, spacing, typography } from '@/lib/design-tokens';
import { useState, useCallback, useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

function newId() {
  return Math.random().toString(36).slice(2, 10);
}

function emptyInvestment(owner: PersonOwner): InvestmentItem {
  return {
    id: newId(),
    name: '',
    type: 'Other',
    ticker: '',
    qty: 0,
    entryPrice: 0,
    entryDate: '',
    currentPrice: 0,
    currentPriceUpdatedAt: '',
    value: 0,
    platform: '',
    owner,
  };
}

/** Compute current value: qty × currentPrice if stock, else manual value */
function computedValue(item: InvestmentItem): number {
  if (item.type === 'Stocks' && item.qty > 0 && item.currentPrice > 0) {
    return item.qty * item.currentPrice;
  }
  if (item.type === 'Stocks' && item.qty > 0 && item.entryPrice > 0) {
    return item.qty * item.entryPrice;
  }
  return item.value;
}

function gainLoss(item: InvestmentItem): { amount: number; pct: number } | null {
  if (item.type !== 'Stocks' || !item.qty || !item.entryPrice) return null;
  const cost = item.qty * item.entryPrice;
  const current = item.qty * (item.currentPrice || item.entryPrice);
  const amount = current - cost;
  const pct = cost > 0 ? (amount / cost) * 100 : 0;
  return { amount, pct };
}

// ─── Stock lookup sub-component ───────────────────────────────────────────────

function TickerLookup({
  ticker,
  onQuote,
}: {
  ticker: string;
  onQuote: (q: StockQuote) => void;
}) {
  const colors = useColors();
  const tickerStyles = useMemo(() => makeTickerStyles(colors), [colors]);
  const [input, setInput] = useState(ticker);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<StockQuote | null>(null);
  const [error, setError] = useState('');

  async function lookup() {
    const sym = input.trim().toUpperCase();
    if (!sym) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const q = await fetchStockQuote(sym);
      setResult(q);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not fetch quote');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={tickerStyles.root}>
      <View style={tickerStyles.row}>
        <View style={tickerStyles.inputWrap}>
          <Input
            label="Ticker / symbol"
            value={input}
            onChangeText={(t) => setInput(t.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="e.g. AAPL, ES3.SI"
            returnKeyType="search"
            onSubmitEditing={lookup}
          />
        </View>
        <Pressable
          onPress={lookup}
          style={({ pressed }) => [tickerStyles.lookupBtn, pressed && { opacity: 0.75 }]}>
          {loading
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={tickerStyles.lookupBtnText}>Look up</Text>}
        </Pressable>
      </View>

      {error ? <Text style={tickerStyles.error}>{error}</Text> : null}

      {result && (
        <View style={tickerStyles.resultCard}>
          <View style={tickerStyles.resultRow}>
            <View>
              <Text style={tickerStyles.resultTicker}>{result.ticker}</Text>
              <Text style={tickerStyles.resultName}>{result.name}</Text>
            </View>
            <View style={tickerStyles.resultRight}>
              <Text style={tickerStyles.resultPrice}>
                {result.currency} {result.price.toFixed(2)}
              </Text>
              <Text style={[
                tickerStyles.resultChange,
                result.change >= 0 ? tickerStyles.positive : tickerStyles.negative,
              ]}>
                {result.change >= 0 ? '+' : ''}{result.change.toFixed(2)} ({result.changePct.toFixed(2)}%)
              </Text>
            </View>
          </View>
          <Pressable
            onPress={() => onQuote(result)}
            style={({ pressed }) => [tickerStyles.useBtn, pressed && { opacity: 0.8 }]}>
            <Text style={tickerStyles.useBtnText}>Use this quote</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// ─── Investment card (edit mode) ──────────────────────────────────────────────

function InvestmentEditCard({
  item,
  onUpdate,
  onRemove,
}: {
  item: InvestmentItem;
  onUpdate: (patch: Partial<InvestmentItem>) => void;
  onRemove: () => void;
}) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const gl = gainLoss(item);

  return (
    <View style={styles.itemBlock}>
      {/* Investment type selector */}
      <Text style={styles.fieldLabel}>Type</Text>
      <View style={styles.typeRow}>
        {INVESTMENT_TYPES.map((t) => (
          <Pressable
            key={t}
            onPress={() => onUpdate({ type: t as InvestmentType, ticker: '', currentPrice: 0 })}
            style={({ pressed }) => [
              styles.typeChip,
              item.type === t && styles.typeChipSelected,
              pressed && { opacity: 0.7 },
            ]}>
            <Text style={[styles.typeChipText, item.type === t && styles.typeChipTextSelected]}>
              {t}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Ticker lookup for stocks */}
      {item.type === 'Stocks' && (
        <TickerLookup
          ticker={item.ticker}
          onQuote={(q) => onUpdate({
            ticker: q.ticker,
            name: item.name || q.name,
            currentPrice: q.price,
            currentPriceUpdatedAt: new Date().toISOString(),
          })}
        />
      )}

      <Input
        label="Name / description"
        value={item.name}
        onChangeText={(t) => onUpdate({ name: t })}
        placeholder={item.type === 'Stocks' ? 'e.g. Apple Inc.' : 'e.g. S&P 500 ETF'}
      />
      <Input
        label="Platform / broker"
        value={item.platform}
        onChangeText={(t) => onUpdate({ platform: t })}
        placeholder="e.g. IBKR, DBS Vickers"
      />

      {/* Qty + entry price for stocks; manual value for others */}
      {item.type === 'Stocks' ? (
        <>
          <View style={styles.twoCol}>
            <View style={styles.col}>
              <MoneyInput
                label="Qty (units)"
                value={item.qty}
                onChangeValue={(v) => onUpdate({ qty: v })}
              />
            </View>
            <View style={styles.col}>
              <MoneyInput
                label="Entry price"
                value={item.entryPrice}
                onChangeValue={(v) => onUpdate({ entryPrice: v })}
              />
            </View>
          </View>
          <Input
            label="Entry date"
            value={item.entryDate}
            onChangeText={(t) => onUpdate({ entryDate: t })}
            placeholder="YYYY-MM-DD"
          />
          {item.currentPrice > 0 && (
            <View style={styles.quoteSummary}>
              <Text style={styles.quoteSummaryLabel}>Current price</Text>
              <Text style={styles.quoteSummaryValue}>
                {item.currentPrice.toFixed(2)}
              </Text>
              {gl && (
                <Text style={[styles.glText, gl.amount >= 0 ? styles.glPositive : styles.glNegative]}>
                  {gl.amount >= 0 ? '+' : ''}{formatCurrency(gl.amount)} ({gl.pct.toFixed(1)}%)
                </Text>
              )}
            </View>
          )}
        </>
      ) : (
        <MoneyInput
          label="Current value (SGD)"
          value={item.value}
          onChangeValue={(v) => onUpdate({ value: v })}
        />
      )}

      <Pressable onPress={onRemove} style={styles.removeBtn}>
        <Text style={styles.removeText}>Remove</Text>
      </Pressable>
    </View>
  );
}

// ─── Investment view card (read mode) ─────────────────────────────────────────

function InvestmentViewCard({ item }: { item: InvestmentItem }) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const value = computedValue(item);
  const gl = gainLoss(item);

  return (
    <View style={styles.viewItem}>
      <View style={styles.viewItemLeft}>
        <Text style={styles.viewItemName}>{item.name || item.ticker || 'Unnamed'}</Text>
        <View style={styles.viewItemMeta}>
          <View style={styles.viewTypeBadge}>
            <Text style={styles.viewTypeBadgeText}>{item.type}</Text>
          </View>
          {item.ticker ? <Text style={styles.viewTicker}>{item.ticker}</Text> : null}
          {item.platform ? <Text style={styles.viewPlatform}>{item.platform}</Text> : null}
        </View>
        {item.type === 'Stocks' && item.qty > 0 && (
          <Text style={styles.viewQty}>{item.qty} units @ {item.entryPrice > 0 ? `${item.entryPrice.toFixed(2)} entry` : '—'}</Text>
        )}
      </View>
      <View style={styles.viewItemRight}>
        <Text style={styles.viewValue}>{formatCurrency(value)}</Text>
        {gl && (
          <Text style={[styles.viewGl, gl.amount >= 0 ? styles.glPositive : styles.glNegative]}>
            {gl.amount >= 0 ? '+' : ''}{gl.pct.toFixed(1)}%
          </Text>
        )}
      </View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function WealthScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { monthYear, setMonthYear, checkin, isLoading, isSaving, saveCheckin, updateCheckin } =
    useCheckin();
  const { family } = useFamily();
  const memberNames = useMemberNames();
  const { user } = useAuth();
  const { filteredCheckin, activeMembers, inMeMode } = useFilteredCheckin();
  const [editing, setEditing] = useState(false);

  // In edit mode always show all family members so new holdings can be added.
  // In view mode use activeMembers (filtered by view toggle).
  const membersFromFamily = family?.members.map((m) => ({ userId: m.userId, displayName: m.displayName })) ?? [];
  const membersFromData = Array.from(new Set(checkin?.investments.map((i) => i.owner) ?? []))
    .filter((uid) => !membersFromFamily.some((m) => m.userId === uid))
    .map((k) => ({ userId: k, displayName: k }));

  const fallback = user && membersFromFamily.length === 0 && membersFromData.length === 0
    ? [{ userId: user._id, displayName: user.displayName }]
    : [];

  const allMembers: { userId: string; displayName: string }[] = [
    ...membersFromFamily,
    ...membersFromData,
    ...fallback,
  ];

  const isAdmin = user?.familyRole === 'admin';

  // View mode uses filtered members; edit mode shows all for admins, own only for non-admins
  const editMembers = isAdmin ? allMembers : allMembers.filter((m) => m.userId === user?._id);
  const members = editing ? editMembers : (activeMembers.length > 0 ? activeMembers : allMembers);

  const displayCheckin = editing ? checkin : (filteredCheckin ?? checkin);

  const itemsFor = useCallback((owner: PersonOwner) =>
    (checkin?.investments ?? [])
      .map((item, globalIndex) => ({ item, globalIndex }))
      .filter(({ item }) => item.owner === owner),
  [checkin?.investments]);

  const displayItemsFor = useCallback((owner: PersonOwner) =>
    (displayCheckin?.investments ?? [])
      .map((item, globalIndex) => ({ item, globalIndex }))
      .filter(({ item }) => item.owner === owner),
  [displayCheckin?.investments]);

  if (isLoading || !checkin || !filteredCheckin) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const totalValue = displayCheckin!.investments.reduce((s, inv) => s + computedValue(inv), 0);

  return (
    <Screen>
      {/* Header */}
      <View style={styles.pageHeader}>
        <View style={styles.pageTitleCol}>
          <Text style={styles.pageTitle}>Investments</Text>
          <Text style={styles.pageSubtitle}>Portfolio holdings by person</Text>
        </View>
        <NotificationBell />
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
          <Card elevated>
            <Text style={styles.summaryLabel}>Total portfolio</Text>
            <Text style={styles.summaryValue}>{formatCurrency(totalValue)}</Text>
          </Card>
          <PieChartCard title="Holdings by person" data={investmentsByOwner(displayCheckin!, memberNames)} />
          <PieChartCard title="Holdings breakdown" data={investmentsByHolding(displayCheckin!)} />
        </>
      )}

      {/* Per-person sections */}
      {members.map((m) => {
        const entries = editing ? itemsFor(m.userId) : displayItemsFor(m.userId);

        return (
          <View key={m.userId} style={styles.personSection}>
            <Text style={styles.personTitle}>{m.displayName}</Text>

            {!editing && (
              <Card>
                <Stat
                  label="Total"
                  value={formatCurrency(entries.reduce((s, { item }) => s + computedValue(item), 0))}
                />
                {entries.length === 0 && (
                  <Text style={styles.emptyHint}>No holdings yet — tap Edit to add.</Text>
                )}
                {entries.map(({ item }) => (
                  <InvestmentViewCard key={item.id} item={item} />
                ))}
              </Card>
            )}

            {editing && (
              <Card>
                {entries.map(({ item, globalIndex }) => (
                  <InvestmentEditCard
                    key={item.id}
                    item={item}
                    onUpdate={(patch) =>
                      updateCheckin((c) => {
                        const investments = [...c.investments];
                        investments[globalIndex] = { ...investments[globalIndex], ...patch };
                        return { ...c, investments };
                      })
                    }
                    onRemove={() =>
                      updateCheckin((c) => ({
                        ...c,
                        investments: c.investments.filter((_, i) => i !== globalIndex),
                      }))
                    }
                  />
                ))}
                <Button
                  label={`Add ${m.displayName} holding`}
                  variant="secondary"
                  onPress={() =>
                    updateCheckin((c) => ({
                      ...c,
                      investments: [...c.investments, emptyInvestment(m.userId)],
                    }))
                  }
                />
              </Card>
            )}
          </View>
        );
      })}

      {editing && (
        <Button
          label="Save Changes"
          onPress={() => { saveCheckin(); setEditing(false); }}
          loading={isSaving}
        />
      )}
    </Screen>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(colors: Colors) { return StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  pageHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: spacing.lg, paddingBottom: spacing.sm, gap: spacing.sm,
  },
  pageTitleCol: { flex: 1 },
  pageTitle: {
    fontSize: 26, fontWeight: '300', fontFamily: 'Inter_400Regular',
    color: colors.text, letterSpacing: -0.5,
  },
  pageSubtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },

  editBtn: {
    alignSelf: 'flex-end', borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, paddingVertical: 6, paddingHorizontal: spacing.md,
    backgroundColor: colors.surface, marginBottom: spacing.md,
  },
  editBtnPressed: { opacity: 0.65 },
  editBtnText: { ...typography.label, color: colors.textSecondary, textTransform: 'none', letterSpacing: 0, fontSize: 13 },

  summaryLabel: { ...typography.label, color: colors.textMuted, marginBottom: 4 },
  summaryValue: {
    fontSize: 28, fontFamily: 'Inter_600SemiBold', fontWeight: '600',
    color: colors.text, letterSpacing: -0.8,
  },

  personSection: { marginBottom: spacing.md },
  personTitle: {
    fontSize: 18, fontFamily: 'Inter_600SemiBold', fontWeight: '600',
    color: colors.text, marginBottom: spacing.sm, marginTop: spacing.sm, letterSpacing: -0.2,
  },

  // Edit item
  itemBlock: {
    paddingBottom: spacing.lg, marginBottom: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  fieldLabel: { ...typography.label, color: colors.textMuted, marginBottom: spacing.sm, marginTop: spacing.sm },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.md },
  typeChip: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: 99,
    paddingVertical: 5, paddingHorizontal: spacing.md, backgroundColor: colors.surface,
  },
  typeChipSelected: { borderColor: colors.accent, backgroundColor: colors.accentLight },
  typeChipText: { fontSize: 13, fontFamily: 'Inter_500Medium', fontWeight: '500', color: colors.textSecondary },
  typeChipTextSelected: { color: colors.accent },
  twoCol: { flexDirection: 'row', gap: spacing.sm },
  col: { flex: 1 },
  quoteSummary: {
    backgroundColor: colors.accentLight, borderRadius: radius.sm,
    padding: spacing.sm, marginTop: spacing.sm, gap: 2,
  },
  quoteSummaryLabel: { ...typography.label, color: colors.accentMid, fontSize: 10 },
  quoteSummaryValue: { fontSize: 16, fontFamily: 'Inter_600SemiBold', fontWeight: '600', color: colors.accent },
  glText: { ...typography.caption },
  glPositive: { color: colors.positive },
  glNegative: { color: colors.negative },
  removeBtn: { marginTop: spacing.sm },
  removeText: { ...typography.caption, color: colors.negative },
  emptyHint: { ...typography.caption, color: colors.textMuted, paddingVertical: spacing.sm },

  // View item
  viewItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderLight,
  },
  viewItemLeft: { flex: 1, gap: 3 },
  viewItemName: { ...typography.bodyMedium, color: colors.text },
  viewItemMeta: { flexDirection: 'row', gap: spacing.xs, alignItems: 'center', flexWrap: 'wrap' },
  viewTypeBadge: {
    backgroundColor: colors.accentLight, borderRadius: 99,
    paddingVertical: 2, paddingHorizontal: 8,
  },
  viewTypeBadgeText: { fontSize: 10, fontFamily: 'Inter_600SemiBold', fontWeight: '600', color: colors.accent },
  viewTicker: { fontSize: 11, fontFamily: 'Inter_600SemiBold', fontWeight: '600', color: colors.textSecondary },
  viewPlatform: { ...typography.caption, color: colors.textMuted },
  viewQty: { ...typography.caption, color: colors.textMuted },
  viewItemRight: { alignItems: 'flex-end', gap: 2 },
  viewValue: { fontSize: 15, fontFamily: 'Inter_600SemiBold', fontWeight: '600', color: colors.text },
  viewGl: { ...typography.caption },
}); }

function makeTickerStyles(colors: Colors) { return StyleSheet.create({
  root: { marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  inputWrap: { flex: 1 },
  lookupBtn: {
    backgroundColor: colors.accent, borderRadius: radius.sm,
    paddingVertical: 12, paddingHorizontal: spacing.md,
    marginBottom: 2, minWidth: 80, alignItems: 'center',
  },
  lookupBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', fontWeight: '600', color: '#fff' },
  error: { ...typography.caption, color: colors.negative, marginTop: 4 },
  resultCard: {
    backgroundColor: colors.background, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.borderLight,
    padding: spacing.sm, marginTop: spacing.sm, gap: spacing.sm,
  },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  resultTicker: { fontSize: 15, fontFamily: 'Inter_600SemiBold', fontWeight: '600', color: colors.text },
  resultName: { ...typography.caption, color: colors.textSecondary, marginTop: 2, maxWidth: 160 },
  resultRight: { alignItems: 'flex-end' },
  resultPrice: { fontSize: 16, fontFamily: 'Inter_600SemiBold', fontWeight: '600', color: colors.text },
  resultChange: { ...typography.caption, marginTop: 2 },
  positive: { color: colors.positive },
  negative: { color: colors.negative },
  useBtn: {
    backgroundColor: colors.accent, borderRadius: radius.sm,
    paddingVertical: 8, alignItems: 'center',
  },
  useBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', fontWeight: '600', color: '#fff' },
}); }
