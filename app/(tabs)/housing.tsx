import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { NotificationBell } from '@/components/NotificationBell';
import { Button, Card, Input, Screen } from '@/components/ui';
import { useHousing } from '@/contexts/HousingContext';
import { useColors } from '@/contexts/ThemeContext';
import { type Colors, radius, shadow, spacing, typography } from '@/lib/design-tokens';
import { useMemo, useState } from 'react';
import { HOUSING_TYPES, HousingType, RoomType, BTO_STAGES, HOUSING_STAGE_EXTRAS, HOUSING_STAGE_LABELS, stagesForHousingType, roomTypesForHousingType, HousingBallotExtra, HousingAppointmentExtra } from '@/lib/types';
import { Platform, ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

function formatDateLabel(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' });
}

function StageTimeline({
  stages,
  currentStage,
  milestoneDates,
  milestoneExtras,
  onChangeStage,
  onChangeDate,
  onChangeExtra,
}: {
  stages: string[];
  currentStage: string;
  milestoneDates: Record<string, string>;
  milestoneExtras: Record<string, HousingBallotExtra | HousingAppointmentExtra>;
  onChangeStage: (stage: string) => void;
  onChangeDate: (stage: string, isoDate: string) => void;
  onChangeExtra: (stage: string, patch: Partial<HousingBallotExtra & HousingAppointmentExtra>) => void;
}) {
  const colors = useColors();
  const timelineStyles = useMemo(() => makeTimelineStyles(colors), [colors]);
  const currentIndex = stages.indexOf(currentStage);
  const [pickerStage, setPickerStage] = useState<string | null>(null);
  const [pickerDate, setPickerDate] = useState<Date>(new Date());
  const [editingExtra, setEditingExtra] = useState<Record<string, boolean>>({});

  function openPicker(stage: string) {
    const existing = milestoneDates[stage];
    setPickerDate(existing ? new Date(existing) : new Date());
    setPickerStage(stage);
  }

  function handlePickerChange(event: DateTimePickerEvent, date?: Date) {
    if (Platform.OS === 'android') {
      if (event.type === 'set' && date && pickerStage) {
        onChangeDate(pickerStage, date.toISOString().split('T')[0]);
      }
      setPickerStage(null);
    } else {
      if (date) setPickerDate(date);
    }
  }

  function confirmIos() {
    if (pickerStage) {
      onChangeDate(pickerStage, pickerDate.toISOString().split('T')[0]);
    }
    setPickerStage(null);
  }

  function clearDate(stage: string) {
    onChangeDate(stage, '');
    if (pickerStage === stage) setPickerStage(null);
  }

  return (
    <View style={timelineStyles.root}>
      {stages.map((stage, index) => {
        const isDone = index < currentIndex;
        const isCurrent = index === currentIndex;
        const isLast = index === stages.length - 1;
        const dateStr = milestoneDates[stage] ?? '';
        const isEditable = isDone || isCurrent;
        const isPickerOpen = pickerStage === stage;
        const extraType = HOUSING_STAGE_EXTRAS[stage];
        const extra = milestoneExtras[stage] as (HousingBallotExtra & HousingAppointmentExtra) | undefined;

        return (
          <View key={stage}>
            <View style={timelineStyles.row}>
              {/* Track */}
              <View style={timelineStyles.track}>
                <View style={[timelineStyles.connector, index === 0 && timelineStyles.connectorInvisible]} />
                <View style={[timelineStyles.node, isDone && timelineStyles.nodeDone, isCurrent && timelineStyles.nodeCurrent]}>
                  {isDone ? <Text style={timelineStyles.checkmarkText}>✓</Text>
                    : isCurrent ? <View style={timelineStyles.innerDot} />
                    : null}
                </View>
                <View style={[timelineStyles.connector, isLast && timelineStyles.connectorInvisible]} />
              </View>

              {/* Content */}
              <View style={timelineStyles.content}>
                <View style={timelineStyles.labelRow}>
                  <Text style={[timelineStyles.stageLabel, isDone && timelineStyles.stageLabelDone, isCurrent && timelineStyles.stageLabelCurrent]}>
                    {isDone
                      ? (HOUSING_STAGE_LABELS[stage]?.done ?? stage)
                      : (HOUSING_STAGE_LABELS[stage]?.pending ?? stage)}
                  </Text>
                  {isCurrent && <View style={timelineStyles.badge}><Text style={timelineStyles.badgeText}>Current</Text></View>}
                  {isDone && <View style={timelineStyles.badgeDone}><Text style={timelineStyles.badgeDoneText}>Done</Text></View>}
                </View>

                {/* Date picker row */}
                {isEditable && (
                  <View style={timelineStyles.dateRow}>
                    {dateStr ? (
                      <Pressable onPress={() => openPicker(stage)} style={timelineStyles.dateChip}>
                        <Text style={timelineStyles.dateChipText}>{formatDateLabel(dateStr)}</Text>
                        <Text style={timelineStyles.dateChipEdit}> · edit</Text>
                      </Pressable>
                    ) : (
                      <Pressable onPress={() => openPicker(stage)} style={timelineStyles.addDateBtn}>
                        <Text style={timelineStyles.addDateBtnText}>+ Add date</Text>
                      </Pressable>
                    )}
                    {dateStr ? (
                      <Pressable onPress={() => clearDate(stage)} hitSlop={8}>
                        <Text style={timelineStyles.clearDate}>✕</Text>
                      </Pressable>
                    ) : null}
                  </View>
                )}

                {/* Inline date picker */}
                {isPickerOpen && (
                  <View style={timelineStyles.pickerWrap}>
                    {Platform.OS === 'web' ? (
                      <WebDateInput
                        value={milestoneDates[stage] ?? ''}
                        onChange={(iso) => {
                          if (iso) onChangeDate(stage, iso);
                          setPickerStage(null);
                        }}
                        onCancel={() => setPickerStage(null)}
                      />
                    ) : (
                      <>
                        <DateTimePicker
                          value={pickerDate}
                          mode="date"
                          display={Platform.OS === 'ios' ? 'inline' : 'default'}
                          onChange={handlePickerChange}
                          themeVariant="light"
                        />
                        {Platform.OS === 'ios' && (
                          <View style={timelineStyles.iosActions}>
                            <Pressable onPress={() => setPickerStage(null)} style={timelineStyles.iosBtn}>
                              <Text style={timelineStyles.iosBtnCancel}>Skip</Text>
                            </Pressable>
                            <Pressable onPress={confirmIos} style={[timelineStyles.iosBtn, timelineStyles.iosBtnConfirm]}>
                              <Text style={timelineStyles.iosBtnConfirmText}>Confirm</Text>
                            </Pressable>
                          </View>
                        )}
                      </>
                    )}
                  </View>
                )}

                {/* Ballot extra fields */}
                {isEditable && extraType === 'ballot' && (() => {

                  const isEditingThis = !!editingExtra[stage];
                  const ballotExtra = extra as HousingBallotExtra | undefined;
                  const hasSummary = ballotExtra?.ballotNumber && ballotExtra?.totalSupply;
                  return (
                    <View style={timelineStyles.extraBox}>
                      <View style={timelineStyles.extraHeaderRow}>
                        <Text style={timelineStyles.extraLabel}>Ballot result</Text>
                        <Pressable
                          onPress={() => setEditingExtra((s) => ({ ...s, [stage]: !s[stage] }))}
                          style={({ pressed }) => [timelineStyles.miniEditBtn, pressed && { opacity: 0.6 }]}>
                          <Text style={timelineStyles.miniEditBtnText}>{isEditingThis ? 'Done' : 'Edit'}</Text>
                        </Pressable>
                      </View>
                      {isEditingThis ? (
                        <>
                          <View style={timelineStyles.ballotRow}>
                            <View style={timelineStyles.ballotField}>
                              <Text style={timelineStyles.ballotFieldLabel}>Your queue no.</Text>
                              <BallotTextInput
                                value={ballotExtra?.ballotNumber ?? ''}
                                placeholder="e.g. 234"
                                onChangeText={(v) => onChangeExtra(stage, { ballotNumber: v })}
                              />
                            </View>
                            <Text style={timelineStyles.slash}>/</Text>
                            <View style={timelineStyles.ballotField}>
                              <Text style={timelineStyles.ballotFieldLabel}>Total supply</Text>
                              <BallotTextInput
                                value={ballotExtra?.totalSupply ?? ''}
                                placeholder="e.g. 480"
                                onChangeText={(v) => onChangeExtra(stage, { totalSupply: v })}
                              />
                            </View>
                          </View>
                        </>
                      ) : hasSummary ? (
                        <Text style={timelineStyles.ballotSummary}>
                          Queue #{(extra as HousingBallotExtra).ballotNumber} of {(extra as HousingBallotExtra).totalSupply} units
                        </Text>
                      ) : (
                        <Text style={timelineStyles.extraEmpty}>No ballot data yet — tap Edit to add</Text>
                      )}
                    </View>
                  );
                })()}

              </View>

              {/* Nav buttons — right column, only for current stage */}
              {isCurrent && (
                <View style={timelineStyles.navCol}>
                  <Pressable
                    disabled={currentIndex === 0}
                    onPress={() => onChangeStage(stages[currentIndex - 1])}
                    style={({ pressed }) => [
                      timelineStyles.navBtn,
                      currentIndex === 0 && timelineStyles.navBtnDisabled,
                      pressed && currentIndex > 0 && timelineStyles.navBtnPressed,
                    ]}>
                    <Text style={[
                      timelineStyles.navBtnText,
                      currentIndex === 0 && timelineStyles.navBtnTextDisabled,
                    ]}>← Go back</Text>
                  </Pressable>
                  <Pressable
                    disabled={currentIndex === stages.length - 1}
                    onPress={() => onChangeStage(stages[currentIndex + 1])}
                    style={({ pressed }) => [
                      timelineStyles.navBtnNext,
                      currentIndex === stages.length - 1 && timelineStyles.navBtnDisabled,
                      pressed && currentIndex < stages.length - 1 && timelineStyles.navBtnPressed,
                    ]}>
                    <Text style={[
                      timelineStyles.navBtnNextText,
                      currentIndex === stages.length - 1 && timelineStyles.navBtnTextDisabled,
                    ]}>Mark as done →</Text>
                  </Pressable>
                </View>
              )}
            </View>
          </View>
        );
      })}

    </View>
  );
}

import { TextInput } from 'react-native';

function WebDateInput({
  value,
  onChange,
  onCancel,
}: {
  value: string;
  onChange: (iso: string) => void;
  onCancel: () => void;
}) {
  const colors = useColors();
  const timelineStyles = useMemo(() => makeTimelineStyles(colors), [colors]);
  return (
    <View style={timelineStyles.webDateWrap}>
      {/* @ts-ignore — web-only input element */}
      <input
        type="date"
        defaultValue={value}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        style={{
          fontSize: 14,
          fontFamily: 'Inter_400Regular, sans-serif',
          color: colors.text,
          backgroundColor: colors.surface,
          border: `1.5px solid ${colors.border}`,
          borderRadius: 8,
          padding: '8px 12px',
          outline: 'none',
          width: '100%',
          boxSizing: 'border-box',
        } as React.CSSProperties}
        autoFocus
      />
      <View style={timelineStyles.iosActions}>
        <Pressable onPress={onCancel} style={timelineStyles.iosBtn}>
          <Text style={timelineStyles.iosBtnCancel}>Skip</Text>
        </Pressable>
      </View>
    </View>
  );
}

function BallotTextInput({ value, placeholder, onChangeText }: { value: string; placeholder: string; onChangeText: (v: string) => void }) {
  const colors = useColors();
  const timelineStyles = useMemo(() => makeTimelineStyles(colors), [colors]);
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.textMuted}
      style={timelineStyles.inlineInput}
    />
  );
}

const NODE_SIZE = 24;
const CONNECTOR_WIDTH = 2;

function makeTimelineStyles(colors: Colors) { return StyleSheet.create({
  root: {
    paddingTop: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  track: {
    width: NODE_SIZE + spacing.md,
    alignItems: 'center',
  },
  connector: {
    flex: 1,
    width: CONNECTOR_WIDTH,
    minHeight: 10,
    borderLeftWidth: CONNECTOR_WIDTH,
    borderStyle: 'dashed',
    borderColor: colors.border,
    marginLeft: -CONNECTOR_WIDTH / 2,
  },
  connectorInvisible: {
    borderColor: 'transparent',
  },
  node: {
    width: NODE_SIZE,
    height: NODE_SIZE,
    borderRadius: NODE_SIZE / 2,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  nodeDone: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  nodeCurrent: {
    borderColor: colors.accent,
    backgroundColor: colors.surface,
    borderWidth: 2.5,
    ...shadow.elevated,
  },
  innerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  checkmarkText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '700',
    lineHeight: 14,
  },
  content: {
    flex: 1,
    paddingLeft: spacing.sm,
    paddingBottom: spacing.md,
    paddingTop: 3,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  stageLabel: {
    ...typography.body,
    color: colors.textMuted,
  },
  stageLabelDone: {
    color: colors.textSecondary,
    textDecorationLine: 'line-through',
  },
  stageLabelCurrent: {
    ...typography.bodyMedium,
    color: colors.text,
    textDecorationLine: 'none',
  },
  badge: {
    backgroundColor: colors.accentLight,
    borderRadius: 99,
    paddingVertical: 2,
    paddingHorizontal: 9,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    color: colors.accent,
    letterSpacing: 0.3,
  },
  badgeDone: {
    backgroundColor: colors.positiveLight,
    borderRadius: 99,
    paddingVertical: 2,
    paddingHorizontal: 9,
  },
  badgeDoneText: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    color: colors.positive,
    letterSpacing: 0.3,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  addDateBtn: {
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  addDateBtnText: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
    color: colors.textMuted,
  },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: 99,
    backgroundColor: colors.accentLight,
    borderWidth: 1,
    borderColor: '#C8DDD4',
  },
  dateChipText: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
    color: colors.accent,
  },
  dateChipEdit: {
    fontSize: 11,
    color: colors.accentMid,
  },
  clearDate: {
    fontSize: 11,
    color: colors.textMuted,
    paddingHorizontal: 4,
  },
  pickerWrap: {
    marginTop: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  webDateWrap: {
    padding: spacing.sm,
  },
  iosActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    padding: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  iosBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
  },
  iosBtnCancel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  iosBtnConfirm: {
    backgroundColor: colors.accent,
  },
  iosBtnConfirmText: {
    ...typography.caption,
    color: '#FFFFFF',
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
  },
  navCol: {
    justifyContent: 'center',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingLeft: spacing.sm,
    paddingTop: 3,
    paddingBottom: spacing.md,
    flexShrink: 0,
  },
  navBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  navBtnNext: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
  },
  navBtnDisabled: {
    opacity: 0.3,
  },
  navBtnPressed: {
    opacity: 0.75,
  },
  navBtnText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
  },
  navBtnNextText: {
    ...typography.caption,
    color: '#FFFFFF',
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
  },
  navBtnTextDisabled: {
    color: colors.textMuted,
  },
  extraBox: {
    marginTop: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  extraHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  extraLabel: {
    ...typography.label,
    color: colors.textMuted,
  },
  miniEditBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 99,
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface,
  },
  miniEditBtnText: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
    color: colors.textSecondary,
  },
  extraEmpty: {
    ...typography.caption,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  ballotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  ballotField: {
    flex: 1,
  },
  ballotFieldLabel: {
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
    color: colors.textMuted,
    marginBottom: 3,
  },
  slash: {
    fontSize: 22,
    color: colors.textMuted,
    marginTop: 12,
  },
  ballotSummary: {
    ...typography.caption,
    color: colors.accent,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
    marginTop: spacing.xs,
  },
  inlineInput: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    fontSize: 14,
    marginBottom: spacing.xs,
  },
  appointmentHint: {
    ...typography.caption,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginBottom: spacing.sm,
  },
}); }

export default function HousingScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { housing, isLoading, isSaving, saveHousing, updateHousing } = useHousing();
  const [editing, setEditing] = useState(false);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  // No housing record yet — show empty state unless user has clicked "Set up housing"
  if (!housing && !editing) {
    return (
      <Screen>
        <View style={styles.pageHeader}>
          <View style={styles.pageTitleCol}>
            <Text style={styles.pageTitle}>Housing</Text>
            <Text style={styles.pageSubtitle}>Track your housing journey</Text>
          </View>
          <NotificationBell />
        </View>
        <Card elevated>
          <Text style={styles.emptyText}>No housing record yet. Tap below to set up your property.</Text>
          <Button label="Set up housing" onPress={() => setEditing(true)} />
        </Card>
      </Screen>
    );
  }

  // Use empty housing shell for rendering when creating a new record
  const EMPTY_SHELL = {
    housingType: '' as const,
    projectName: '',
    address: '',
    roomType: '' as const,
    flatPrice: 0,
    currentStage: '',
    milestoneDates: {} as Record<string, string>,
    milestoneExtras: {} as Record<string, HousingBallotExtra | HousingAppointmentExtra>,
    subsidyClawbackRate: 0,
  };
  const h = housing ?? EMPTY_SHELL;
  const stages = stagesForHousingType(h.housingType);

  return (
    <Screen>
      <View style={styles.pageHeader}>
        <View style={styles.pageTitleCol}>
          <Text style={styles.pageTitle}>Housing</Text>
          <Text style={styles.pageSubtitle}>
            {housing
              ? `${h.projectName || 'Your property'} — milestones & key dates`
              : 'Set up your property details'}
          </Text>
        </View>
        <NotificationBell />
      </View>

      {/* Project info card — only shown when a record already exists */}
      {housing && (
        <Card elevated>
          <View style={styles.cardHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.projectName}>{h.projectName || 'Unnamed project'}</Text>
              {h.address ? <Text style={styles.address}>{h.address}</Text> : null}
              <View style={styles.infoRow}>
                {h.housingType ? (
                  <View style={styles.infoPill}><Text style={styles.infoPillText}>{h.housingType}</Text></View>
                ) : null}
                {h.roomType ? (
                  <View style={styles.infoPill}><Text style={styles.infoPillText}>{h.roomType}</Text></View>
                ) : null}
                {h.flatPrice ? (
                  <View style={styles.infoPill}><Text style={styles.infoPillText}>S${h.flatPrice.toLocaleString()}</Text></View>
                ) : null}
                {h.subsidyClawbackRate ? (
                  <View style={styles.infoPill}><Text style={styles.infoPillText}>{Math.round(h.subsidyClawbackRate * 100)}% clawback</Text></View>
                ) : null}
              </View>
            </View>
            <Pressable
              onPress={() => setEditing((v) => !v)}
              style={({ pressed }) => [styles.editBtn, pressed && styles.editBtnPressed]}>
              <Text style={styles.editBtnText}>{editing ? 'Done' : 'Edit'}</Text>
            </Pressable>
          </View>
        </Card>
      )}

      {/* Journey timeline — hidden in edit mode */}
      {!editing && <Card>
        <Text style={styles.label}>Journey progress</Text>
        <StageTimeline
          stages={stages as unknown as string[]}
          currentStage={h.currentStage}
          milestoneDates={h.milestoneDates ?? {}}
          milestoneExtras={h.milestoneExtras ?? {}}
          onChangeStage={(stage) => updateHousing((cur) => ({ ...cur, currentStage: stage }))}
          onChangeDate={(stage, isoDate) =>
            updateHousing((cur) => ({ ...cur, milestoneDates: { ...cur.milestoneDates, [stage]: isoDate } }))
          }
          onChangeExtra={(stage, patch) =>
            updateHousing((cur) => ({
              ...cur,
              milestoneExtras: {
                ...cur.milestoneExtras,
                [stage]: { ...(cur.milestoneExtras?.[stage] ?? {}), ...patch },
              },
            }))
          }
        />
      </Card>}

      {/* Edit-only fields */}
      {editing && (
        <>
          <Card>
            {/* Housing type selector */}
            <Text style={styles.fieldLabel}>Housing type</Text>
            <View style={styles.roomTypeRow}>
              {HOUSING_TYPES.map((type) => (
                <Pressable
                  key={type}
                  onPress={() => updateHousing((cur) => ({
                    ...cur,
                    housingType: type as HousingType,
                    currentStage: stagesForHousingType(type as HousingType)[0],
                    roomType: '', // reset when housing type changes
                  }))}
                  style={({ pressed }) => [
                    styles.roomTypeChip,
                    h.housingType === type && styles.roomTypeChipSelected,
                    pressed && { opacity: 0.7 },
                  ]}>
                  <Text style={[styles.roomTypeChipText, h.housingType === type && styles.roomTypeChipTextSelected]}>
                    {type}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Input
              label="Project / development name"
              value={h.projectName}
              onChangeText={(text) => updateHousing((cur) => ({ ...cur, projectName: text }))}
            />
            <Input
              label="Address"
              value={h.address}
              onChangeText={(text) => updateHousing((cur) => ({ ...cur, address: text }))}
            />

            {/* Room type selector — hidden for Landed, options vary by housing type */}
            {roomTypesForHousingType(h.housingType) !== null && (() => {
              const roomTypes = roomTypesForHousingType(h.housingType)!;
              return (
                <>
                  <Text style={styles.fieldLabel}>Unit type</Text>
                  <View style={styles.roomTypeRow}>
                    {roomTypes.map((type) => (
                      <Pressable
                        key={type}
                        onPress={() => updateHousing((cur) => ({ ...cur, roomType: type as RoomType }))}
                        style={({ pressed }) => [
                          styles.roomTypeChip,
                          h.roomType === type && styles.roomTypeChipSelected,
                          pressed && { opacity: 0.7 },
                        ]}>
                        <Text style={[styles.roomTypeChipText, h.roomType === type && styles.roomTypeChipTextSelected]}>
                          {type}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              );
            })()}

            <Input
              label="Price (SGD)"
              value={h.flatPrice ? String(h.flatPrice) : ''}
              onChangeText={(text) => {
                const parsed = Number(text.replace(/[^0-9]/g, ''));
                updateHousing((cur) => ({ ...cur, flatPrice: Number.isNaN(parsed) ? 0 : parsed }));
              }}
              keyboardType="number-pad"
              placeholder="e.g. 450000"
            />
            {h.housingType === 'HDB BTO' && (
              <Input
                label="Subsidy clawback (%)"
                value={h.subsidyClawbackRate ? String(Math.round(h.subsidyClawbackRate * 100)) : ''}
                onChangeText={(text) => {
                  const parsed = Number(text.replace(/[^0-9.]/g, ''));
                  updateHousing((cur) => ({ ...cur, subsidyClawbackRate: Number.isNaN(parsed) ? 0 : parsed / 100 }));
                }}
                keyboardType="decimal-pad"
                placeholder="e.g. 11"
              />
            )}
          </Card>

          <Button
            label="Save Changes"
            onPress={() => { saveHousing(); setEditing(false); }}
            loading={isSaving}
          />
          {!housing && (
            <Pressable onPress={() => setEditing(false)} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
          )}
        </>
      )}
    </Screen>
  );
}

function makeStyles(colors: Colors) { return StyleSheet.create({
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
  pageTitleCol: { flex: 1 },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  editBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
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
  projectName: {
    ...typography.bodyMedium,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  address: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  infoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  infoPill: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 99,
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
  },
  infoPillText: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
    color: colors.textSecondary,
  },
  label: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  fieldLabel: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  roomTypeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
    marginBottom: spacing.md,
  },
  roomTypeChip: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 99,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
  },
  roomTypeChipSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentLight,
  },
  roomTypeChipText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
    color: colors.textSecondary,
  },
  roomTypeChipTextSelected: {
    color: colors.accent,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    lineHeight: 22,
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.xs,
  },
  cancelBtnText: {
    ...typography.caption,
    color: colors.textMuted,
  },
}); }
