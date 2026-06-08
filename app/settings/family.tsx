import { useAuth } from '@/contexts/AuthContext';
import { useFamily } from '@/contexts/FamilyContext';
import { ApiError, approveFamilyRequest, createFamily, inviteByEmail, joinFamily, setMemberLabel, transferAdmin } from '@/lib/api';
import { useColors } from '@/contexts/ThemeContext';
import { type Colors, radius, spacing, typography } from '@/lib/design-tokens';
import { MEMBER_LABELS } from '@/lib/types';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ─── Shared primitives ────────────────────────────────────────────────────────

function Divider() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return <View style={styles.divider} />;
}

function SectionCard({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return <View style={styles.card}>{children}</View>;
}

function Row({
  icon, label, value, onPress, destructive, chevron = true,
}: {
  icon: string; label: string; value?: string;
  onPress?: () => void; destructive?: boolean; chevron?: boolean;
}) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, pressed && onPress && styles.rowPressed]}>
      <Text style={styles.rowIcon}>{icon}</Text>
      <Text style={[styles.rowLabel, destructive && styles.rowLabelDestructive]}>{label}</Text>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      {chevron && onPress ? <Text style={styles.chevron}>›</Text> : null}
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function FamilySettingsScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { user, updateUser } = useAuth();
  const { family, reload: reloadFamily } = useFamily();
  const insets = useSafeAreaInsets();

  const isAdmin = user?.familyRole === 'admin';

  // No-family forms
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [familyNameInput, setFamilyNameInput] = useState('');
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [formError, setFormError] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Invite by email (admin)
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [inviteSubmitting, setInviteSubmitting] = useState(false);

  // Label editing
  const [editingLabelFor, setEditingLabelFor] = useState<string | null>(null);
  const [labelSaving, setLabelSaving] = useState(false);

  // Transfer admin
  const [transferSubmitting, setTransferSubmitting] = useState<string | null>(null);

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function handleCreateFamily() {
    if (!familyNameInput.trim()) { setFormError('Family name is required'); return; }
    setFormError(''); setFormSubmitting(true);
    try {
      const res = await createFamily(familyNameInput.trim());
      updateUser(res.user, res.token);
      setShowCreate(false);
      setFamilyNameInput('');
      reloadFamily();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally { setFormSubmitting(false); }
  }

  async function handleJoinFamily() {
    if (!inviteCodeInput.trim()) { setFormError('Invite code is required'); return; }
    setFormError(''); setFormSubmitting(true);
    try {
      await joinFamily(inviteCodeInput.trim().toUpperCase());
      setShowJoin(false);
      setInviteCodeInput('');
      reloadFamily();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally { setFormSubmitting(false); }
  }

  async function handleSendInvite() {
    const trimmed = inviteEmail.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setInviteError('Enter a valid email address'); return;
    }
    setInviteError(''); setInviteSuccess(''); setInviteSubmitting(true);
    try {
      const res = await inviteByEmail(trimmed);
      setInviteSuccess(res.message);
      setInviteEmail('');
    } catch (err) {
      setInviteError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally { setInviteSubmitting(false); }
  }

  const handleSetLabel = useCallback(async (targetUserId: string, label: string) => {
    setLabelSaving(true);
    try {
      await setMemberLabel(targetUserId, label);
      reloadFamily();
      setEditingLabelFor(null);
    } catch { /* silently fail */ }
    finally { setLabelSaving(false); }
  }, [reloadFamily]);

  const handleTransferAdmin = useCallback((newAdminUserId: string, newAdminName: string) => {
    const confirm = () => {
      setTransferSubmitting(newAdminUserId);
      transferAdmin(newAdminUserId)
        .then(() => reloadFamily())
        .catch(() => { /* silently fail */ })
        .finally(() => setTransferSubmitting(null));
    };
    if (Platform.OS === 'web') {
      if (window.confirm(`Make ${newAdminName} an admin? They will share admin privileges with you.`)) confirm();
    } else {
      Alert.alert(
        'Add as admin',
        `Make ${newAdminName} an admin? They will share admin privileges with you.`,
        [{ text: 'Cancel', style: 'cancel' }, { text: 'Add as admin', onPress: confirm }],
      );
    }
  }, [reloadFamily]);

  const handleApprove = useCallback(async (userId: string, action: 'approve' | 'reject') => {
    try {
      await approveFamilyRequest(userId, action);
      reloadFamily();
    } catch { /* silently fail */ }
  }, [reloadFamily]);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + spacing.xl }}
      showsVerticalScrollIndicator={false}>

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>Family group</Text>
      </View>

      <View style={styles.body}>

        {/* ── Has a family ─────────────────────────────────────────────── */}
        {family ? (
          <>
            {/* Family info */}
            <View style={styles.section}>
              <SectionCard>
                <Row icon="👨‍👩‍👧" label={family.name} value={`${family.members.length} member${family.members.length !== 1 ? 's' : ''}`} chevron={false} />
                <Divider />
                <Row icon="🔗" label="Invite code" value={family.inviteCode} chevron={false} />
              </SectionCard>
            </View>

            {/* Members */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Members</Text>
              <SectionCard>
                {family.members.map((member, idx) => {
                  const currentLabel = family.memberLabels?.[member.userId] ?? '';
                  const isCurrentUser = member.userId === user?._id;
                  const isEditingThis = editingLabelFor === member.userId;

                  return (
                    <View key={member.userId}>
                      {idx > 0 && <Divider />}
                      <View style={styles.memberRow}>
                        <View style={styles.memberInfo}>
                          <View style={styles.memberNameRow}>
                            <Text style={styles.memberName}>{member.displayName}</Text>
                            {member.role === 'admin' && (
                              <View style={styles.adminBadge}>
                                <Text style={styles.adminBadgeText}>Admin</Text>
                              </View>
                            )}
                            {isCurrentUser && (
                              <View style={styles.youBadge}>
                                <Text style={styles.youBadgeText}>You</Text>
                              </View>
                            )}
                          </View>
                          {currentLabel ? <Text style={styles.memberLabel}>{currentLabel}</Text> : null}
                          <Text style={styles.memberEmail}>{member.email}</Text>
                        </View>

                        <View style={styles.memberActions}>
                          {isAdmin && (
                            <Pressable
                              onPress={() => setEditingLabelFor(isEditingThis ? null : member.userId)}
                              style={styles.labelBtn}>
                              <Text style={styles.labelBtnText}>{isEditingThis ? 'Done' : (currentLabel || 'Label')}</Text>
                            </Pressable>
                          )}
                          {isAdmin && !isCurrentUser && member.role !== 'admin' && (
                            <Pressable
                              onPress={() => handleTransferAdmin(member.userId, member.displayName)}
                              disabled={transferSubmitting === member.userId}
                              style={styles.transferBtn}>
                              <Text style={styles.transferBtnText}>
                                {transferSubmitting === member.userId ? '…' : 'Add as admin'}
                              </Text>
                            </Pressable>
                          )}
                        </View>
                      </View>

                      {isEditingThis && isAdmin && (
                        <View style={styles.labelPicker}>
                          <Pressable
                            onPress={() => handleSetLabel(member.userId, '')}
                            disabled={labelSaving}
                            style={[styles.labelOption, !currentLabel && styles.labelOptionSelected]}>
                            <Text style={[styles.labelOptionText, !currentLabel && styles.labelOptionTextSelected]}>No label</Text>
                          </Pressable>
                          {MEMBER_LABELS.map((lbl) => (
                            <Pressable
                              key={lbl}
                              onPress={() => handleSetLabel(member.userId, lbl)}
                              disabled={labelSaving}
                              style={[styles.labelOption, currentLabel === lbl && styles.labelOptionSelected]}>
                              <Text style={[styles.labelOptionText, currentLabel === lbl && styles.labelOptionTextSelected]}>{lbl}</Text>
                            </Pressable>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })}
              </SectionCard>
            </View>

            {/* Pending requests */}
            {family.pendingRequests.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Pending requests ({family.pendingRequests.length})</Text>
                <SectionCard>
                  {family.pendingRequests.map((req, idx) => (
                    <View key={req.userId}>
                      {idx > 0 && <Divider />}
                      <View style={styles.pendingRow}>
                        <View style={styles.pendingInfo}>
                          <Text style={styles.memberName}>{req.displayName}</Text>
                          <Text style={styles.memberEmail}>{req.email}</Text>
                        </View>
                        <View style={styles.pendingActions}>
                          <Pressable onPress={() => handleApprove(req.userId, 'approve')} style={styles.approveBtn}>
                            <Text style={styles.approveBtnText}>Approve</Text>
                          </Pressable>
                          <Pressable onPress={() => handleApprove(req.userId, 'reject')} style={styles.rejectBtn}>
                            <Text style={styles.rejectBtnText}>Reject</Text>
                          </Pressable>
                        </View>
                      </View>
                    </View>
                  ))}
                </SectionCard>
              </View>
            )}

            {/* Invite by email (admin only) */}
            {isAdmin && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Invite someone</Text>
                <SectionCard>
                  <View style={styles.inviteForm}>
                    <Text style={styles.inviteHint}>
                      Send the invite code to someone's email. They must not already be in a family group.
                    </Text>
                    <TextInput
                      value={inviteEmail}
                      onChangeText={(t) => { setInviteEmail(t); setInviteError(''); setInviteSuccess(''); }}
                      placeholder="their@email.com"
                      placeholderTextColor={colors.textMuted}
                      style={styles.input}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="send"
                      onSubmitEditing={handleSendInvite}
                    />
                    {inviteError ? <Text style={styles.errorText}>{inviteError}</Text> : null}
                    {inviteSuccess ? <Text style={styles.successText}>{inviteSuccess}</Text> : null}
                    <Pressable
                      onPress={handleSendInvite}
                      disabled={inviteSubmitting}
                      style={[styles.btn, inviteSubmitting && styles.btnDisabled]}>
                      <Text style={styles.btnText}>{inviteSubmitting ? 'Sending…' : 'Send invite'}</Text>
                    </Pressable>
                  </View>
                </SectionCard>
              </View>
            )}
          </>
        ) : (
          /* ── No family ──────────────────────────────────────────────── */
          <>
            <View style={styles.section}>
              <SectionCard>
                <Row
                  icon="✨"
                  label="Create a family group"
                  onPress={() => { setShowCreate((v) => !v); setShowJoin(false); setFormError(''); }}
                />
                <Divider />
                <Row
                  icon="🔗"
                  label="Join with invite code"
                  onPress={() => { setShowJoin((v) => !v); setShowCreate(false); setFormError(''); }}
                />
              </SectionCard>
            </View>

            {showCreate && (
              <View style={styles.section}>
                <SectionCard>
                  <View style={styles.inviteForm}>
                    {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
                    <TextInput
                      value={familyNameInput}
                      onChangeText={setFamilyNameInput}
                      placeholder='e.g. "The Tans"'
                      placeholderTextColor={colors.textMuted}
                      style={styles.input}
                      returnKeyType="done"
                      onSubmitEditing={handleCreateFamily}
                    />
                    <Pressable
                      onPress={handleCreateFamily}
                      disabled={formSubmitting}
                      style={[styles.btn, formSubmitting && styles.btnDisabled]}>
                      <Text style={styles.btnText}>{formSubmitting ? 'Creating…' : 'Create family'}</Text>
                    </Pressable>
                  </View>
                </SectionCard>
              </View>
            )}

            {showJoin && (
              <View style={styles.section}>
                <SectionCard>
                  <View style={styles.inviteForm}>
                    <Text style={styles.inviteHint}>
                      Each person can only be in one family group at a time.
                    </Text>
                    {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
                    <TextInput
                      value={inviteCodeInput}
                      onChangeText={(t) => setInviteCodeInput(t.toUpperCase())}
                      placeholder="e.g. A3F9C201"
                      placeholderTextColor={colors.textMuted}
                      style={styles.input}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      returnKeyType="done"
                      onSubmitEditing={handleJoinFamily}
                    />
                    <Pressable
                      onPress={handleJoinFamily}
                      disabled={formSubmitting}
                      style={[styles.btn, formSubmitting && styles.btnDisabled]}>
                      <Text style={styles.btnText}>{formSubmitting ? 'Sending…' : 'Send join request'}</Text>
                    </Pressable>
                  </View>
                </SectionCard>
              </View>
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(colors: Colors) { return StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.xs,
  },
  backBtn: { alignSelf: 'flex-start' },
  backText: { ...typography.body, color: colors.accent, fontSize: 16 },
  title: {
    fontSize: 28, fontFamily: 'Inter_600SemiBold', fontWeight: '600',
    color: colors.text, letterSpacing: -0.5,
  },
  body: { paddingHorizontal: spacing.lg, gap: spacing.md },
  section: { gap: spacing.xs },
  sectionLabel: { ...typography.label, color: colors.textMuted, paddingHorizontal: 4, marginBottom: 2 },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.borderLight, overflow: 'hidden',
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: 14, gap: spacing.md,
  },
  rowPressed: { backgroundColor: colors.background },
  rowIcon: { fontSize: 18, width: 26, textAlign: 'center' },
  rowLabel: { flex: 1, ...typography.body, color: colors.text },
  rowLabelDestructive: { color: colors.negative },
  rowValue: { ...typography.caption, color: colors.textMuted, maxWidth: 140, textAlign: 'right' },
  chevron: { fontSize: 20, color: colors.textMuted, marginLeft: 2 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.borderLight, marginLeft: 58 },

  // Members
  memberRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: spacing.md, paddingVertical: 12, gap: spacing.sm,
  },
  memberInfo: { flex: 1 },
  memberNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  memberName: { ...typography.bodyMedium, color: colors.text },
  memberLabel: { ...typography.caption, color: colors.accent, marginTop: 2 },
  memberEmail: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  memberActions: { flexDirection: 'column', alignItems: 'flex-end', gap: spacing.xs },
  adminBadge: {
    backgroundColor: colors.accentLight, borderRadius: radius.xs,
    paddingVertical: 2, paddingHorizontal: 6,
  },
  adminBadgeText: { fontSize: 10, fontWeight: '600', color: colors.accent, fontFamily: 'Inter_600SemiBold' },
  youBadge: {
    backgroundColor: colors.positiveLight, borderRadius: radius.xs,
    paddingVertical: 2, paddingHorizontal: 6,
  },
  youBadgeText: { fontSize: 10, fontWeight: '600', color: colors.positive, fontFamily: 'Inter_600SemiBold' },
  labelBtn: {
    backgroundColor: colors.background, borderRadius: radius.xs,
    paddingVertical: 4, paddingHorizontal: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  labelBtnText: { fontSize: 11, color: colors.text, fontWeight: '500' },
  transferBtn: {
    backgroundColor: colors.negativeLight, borderRadius: radius.xs,
    paddingVertical: 4, paddingHorizontal: spacing.sm,
  },
  transferBtnText: { fontSize: 11, color: colors.negative, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  labelPicker: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs,
    paddingHorizontal: spacing.md, paddingBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  labelOption: {
    paddingVertical: 5, paddingHorizontal: spacing.sm,
    borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  labelOptionSelected: { backgroundColor: colors.accentLight, borderColor: colors.accent },
  labelOptionText: { fontSize: 12, color: colors.text },
  labelOptionTextSelected: { color: colors.accent, fontWeight: '600' },

  // Pending
  pendingRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: 12, gap: spacing.sm,
  },
  pendingInfo: { flex: 1 },
  pendingActions: { flexDirection: 'row', gap: spacing.xs },
  approveBtn: {
    backgroundColor: colors.positiveLight, borderRadius: radius.sm,
    paddingVertical: 5, paddingHorizontal: spacing.sm,
  },
  approveBtnText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', fontWeight: '600', color: colors.positive },
  rejectBtn: {
    backgroundColor: colors.negativeLight, borderRadius: radius.sm,
    paddingVertical: 5, paddingHorizontal: spacing.sm,
  },
  rejectBtnText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', fontWeight: '600', color: colors.negative },

  // Forms
  inviteForm: { padding: spacing.md, gap: spacing.sm },
  inviteHint: { ...typography.caption, color: colors.textMuted, lineHeight: 18 },
  input: {
    ...typography.body, color: colors.text,
    backgroundColor: colors.background,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: 10,
  },
  btn: {
    backgroundColor: colors.accent, borderRadius: radius.sm,
    paddingVertical: 10, alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', fontWeight: '600', color: '#fff' },
  errorText: {
    ...typography.caption, color: colors.negative,
    backgroundColor: colors.negativeLight, borderRadius: radius.sm,
    padding: spacing.sm, overflow: 'hidden',
  },
  successText: {
    ...typography.caption, color: colors.positive,
    backgroundColor: colors.positiveLight, borderRadius: radius.sm,
    padding: spacing.sm, overflow: 'hidden',
  },
}); }
