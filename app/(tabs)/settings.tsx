import { useAuth } from '@/contexts/AuthContext';
import { useFamily } from '@/contexts/FamilyContext';
import { useNotifications } from '@/contexts/NotificationsContext';
import { usePreferences } from '@/contexts/PreferencesContext';
import {
  setMemberLabel,
  transferAdmin,
  updateNotificationPrefs,
  ApiError,
} from '@/lib/api';
import { colors, radius, shadow, spacing, typography } from '@/lib/design-tokens';
import { MEMBER_LABELS, type NotificationPrefs } from '@/lib/types';
import { router } from 'expo-router';
import { useState, useCallback } from 'react';
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ─── Emoji & colour palettes ──────────────────────────────────────────────────

const AVATAR_EMOJIS = [
  '🏡', '🌿', '💎', '🦁', '🐼', '🦊', '🐻', '🐸',
  '🌸', '🌊', '🔥', '⚡', '🎯', '🚀', '💡', '🎸',
  '🍀', '🌙', '☀️', '❄️', '🦋', '🎨', '📚', '🎵',
];

const BG_COLORS = [
  { label: 'Warm cream',  value: '#F5F4F0' },
  { label: 'White',       value: '#FFFFFF' },
  { label: 'Sage',        value: '#E8F0EC' },
  { label: 'Sky',         value: '#EEF4FF' },
  { label: 'Blush',       value: '#FFF0F0' },
  { label: 'Sand',        value: '#FDF5E6' },
  { label: 'Lavender',    value: '#F3EEFF' },
  { label: 'Slate',       value: '#F0F4F8' },
  { label: 'Midnight',    value: '#1A1A2E' },
  { label: 'Forest',      value: '#1C2B24' },
];

// ─── Reusable primitives ──────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      {title ? <Text style={styles.sectionTitle}>{title}</Text> : null}
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function Row({
  icon, label, value, onPress, destructive, chevron = true, right,
}: {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
  chevron?: boolean;
  right?: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress && !right}
      style={({ pressed }) => [styles.row, pressed && onPress && styles.rowPressed]}>
      <Text style={styles.rowIcon}>{icon}</Text>
      <Text style={[styles.rowLabel, destructive && styles.rowLabelDestructive]}>{label}</Text>
      {right ?? (
        <>
          {value ? <Text style={styles.rowValue}>{value}</Text> : null}
          {chevron && onPress ? <Text style={styles.chevron}>›</Text> : null}
        </>
      )}
    </Pressable>
  );
}

function ToggleRow({
  icon, label, value, onValueChange,
}: {
  icon: string;
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowIcon}>{icon}</Text>
      <Text style={[styles.rowLabel, { flex: 1 }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: colors.accentLight }}
        thumbColor={value ? colors.accent : colors.textMuted}
      />
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const { user, logout, isGuest, updateUser } = useAuth();
  const { family, createFamily, joinFamily, approveRequest, reload: reloadFamily } = useFamily();
  const { prefs, setAvatarEmoji, setBgColor, setNotifPrefs } = usePreferences();
  const { notifications, unreadCount, markRead } = useNotifications();
  const insets = useSafeAreaInsets();

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(user?.displayName ?? '');
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [showBgPicker, setShowBgPicker] = useState(false);

  // Family management state
  const [showCreateFamily, setShowCreateFamily] = useState(false);
  const [showJoinFamily, setShowJoinFamily] = useState(false);
  const [familyNameInput, setFamilyNameInput] = useState('');
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [familyError, setFamilyError] = useState('');
  const [familySubmitting, setFamilySubmitting] = useState(false);

  // Label editing state (memberId -> selected label)
  const [editingLabelFor, setEditingLabelFor] = useState<string | null>(null);
  const [labelSaving, setLabelSaving] = useState(false);

  // Transfer admin state
  const [transferSubmitting, setTransferSubmitting] = useState<string | null>(null);

  // Notifications panel
  const [showNotifPanel, setShowNotifPanel] = useState(false);

  const isDark = prefs.bgColor === '#1A1A2E' || prefs.bgColor === '#1C2B24';
  const textOnBg = isDark ? '#FFFFFF' : colors.text;

  async function handleSaveName() {
    if (!nameInput.trim() || !user) return;
    updateUser({ ...user, displayName: nameInput.trim() }, '');
    setEditingName(false);
  }

  async function handleCreateFamily() {
    if (!familyNameInput.trim()) { setFamilyError('Family name is required'); return; }
    setFamilyError(''); setFamilySubmitting(true);
    try {
      await createFamily(familyNameInput.trim());
      setShowCreateFamily(false);
      setFamilyNameInput('');
    } catch (err) {
      setFamilyError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setFamilySubmitting(false);
    }
  }

  async function handleJoinFamily() {
    if (!inviteCodeInput.trim()) { setFamilyError('Invite code is required'); return; }
    setFamilyError(''); setFamilySubmitting(true);
    try {
      await joinFamily(inviteCodeInput.trim().toUpperCase());
      setShowJoinFamily(false);
      setInviteCodeInput('');
      reloadFamily();
    } catch (err) {
      setFamilyError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setFamilySubmitting(false);
    }
  }

  const handleSetLabel = useCallback(async (targetUserId: string, label: string) => {
    setLabelSaving(true);
    try {
      await setMemberLabel(targetUserId, label);
      reloadFamily();
      setEditingLabelFor(null);
    } catch {
      // silently fail
    } finally {
      setLabelSaving(false);
    }
  }, [reloadFamily]);

  const handleTransferAdmin = useCallback((newAdminUserId: string, newAdminName: string) => {
    const confirm = () => {
      setTransferSubmitting(newAdminUserId);
      transferAdmin(newAdminUserId)
        .then((res) => {
          updateUser(res.user, res.token);
          reloadFamily();
        })
        .catch(() => {
          // silently fail
        })
        .finally(() => setTransferSubmitting(null));
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Make ${newAdminName} the new family admin? You will become a regular member.`)) {
        confirm();
      }
    } else {
      Alert.alert(
        'Transfer admin role',
        `Make ${newAdminName} the new family admin? You will become a regular member.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Transfer', style: 'destructive', onPress: confirm },
        ],
      );
    }
  }, [updateUser, reloadFamily]);

  const handleNotifToggle = useCallback(async (key: keyof NotificationPrefs, value: boolean) => {
    const next: NotificationPrefs = { ...prefs.notifPrefs, [key]: value };
    setNotifPrefs(next);
    try { await updateNotificationPrefs(next); } catch { /* silently fail */ }
  }, [prefs.notifPrefs, setNotifPrefs]);

  const isAdmin = user?.familyRole === 'admin';

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: prefs.bgColor }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl }]}
      showsVerticalScrollIndicator={false}>

      {/* Profile hero */}
      <View style={styles.profileHero}>
        <Pressable
          onPress={() => setShowAvatarPicker((v) => !v)}
          style={[styles.avatarWrap, { backgroundColor: colors.accentLight }]}>
          <Text style={styles.avatarEmoji}>{prefs.avatarEmoji}</Text>
          <View style={styles.avatarEditBadge}><Text style={styles.avatarEditBadgeText}>✏️</Text></View>
        </Pressable>

        {editingName ? (
          <View style={styles.nameEditRow}>
            <TextInput
              value={nameInput}
              onChangeText={setNameInput}
              style={[styles.nameInput, { color: textOnBg }]}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleSaveName}
            />
            <Pressable onPress={handleSaveName} style={styles.nameSaveBtn}>
              <Text style={styles.nameSaveBtnText}>Save</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={() => { setNameInput(user?.displayName ?? ''); setEditingName(true); }} style={styles.nameRow}>
            <Text style={[styles.profileName, { color: textOnBg }]}>{user?.displayName ?? 'Guest'}</Text>
            <Text style={styles.nameEditHint}>✏️</Text>
          </Pressable>
        )}
        <Text style={[styles.profileEmail, { color: isDark ? 'rgba(255,255,255,0.5)' : colors.textMuted }]}>
          {isGuest ? 'Browsing as guest' : (user?.email ?? '')}
        </Text>
      </View>

      {/* Avatar picker */}
      {showAvatarPicker && (
        <View style={styles.pickerCard}>
          <Text style={styles.pickerLabel}>Choose your avatar</Text>
          <View style={styles.emojiGrid}>
            {AVATAR_EMOJIS.map((e) => (
              <Pressable
                key={e}
                onPress={() => { setAvatarEmoji(e); setShowAvatarPicker(false); }}
                style={[styles.emojiBtn, prefs.avatarEmoji === e && styles.emojiBtnSelected]}>
                <Text style={styles.emojiOption}>{e}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* BG color picker */}
      {showBgPicker && (
        <View style={styles.pickerCard}>
          <Text style={styles.pickerLabel}>Choose app background</Text>
          <View style={styles.colorGrid}>
            {BG_COLORS.map((c) => (
              <Pressable
                key={c.value}
                onPress={() => { setBgColor(c.value); setShowBgPicker(false); }}
                style={[styles.colorSwatch, { backgroundColor: c.value }, prefs.bgColor === c.value && styles.colorSwatchSelected]}>
                {prefs.bgColor === c.value && <Text style={styles.colorSwatchTick}>✓</Text>}
              </Pressable>
            ))}
          </View>
          <View style={styles.colorLabels}>
            {BG_COLORS.map((c) => (
              <Text key={c.value} style={styles.colorLabel}>{c.label}</Text>
            ))}
          </View>
        </View>
      )}

      {/* Appearance */}
      <Section title="Appearance">
        <Row icon="🎨" label="App background" onPress={() => setShowBgPicker((v) => !v)} />
        <Divider />
        <Row icon="😊" label="Avatar emoji" value={prefs.avatarEmoji} onPress={() => setShowAvatarPicker((v) => !v)} />
      </Section>

      {/* Account */}
      <Section title="Account">
        {isGuest ? (
          <>
            <Row icon="✨" label="Create account" onPress={() => router.push('/register')} />
            <Divider />
            <Row icon="🔐" label="Sign in" onPress={() => router.push('/login')} />
          </>
        ) : (
          <>
            <Row icon="👤" label="Display name" value={user?.displayName} onPress={() => { setNameInput(user?.displayName ?? ''); setEditingName(true); }} />
            <Divider />
            <Row icon="📧" label="Email" value={user?.email} chevron={false} />
          </>
        )}
      </Section>

      {/* Notifications */}
      {!isGuest && (
        <Section title="Notifications">
          <Row
            icon="🔔"
            label={`Activity alerts${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
            onPress={() => {
              setShowNotifPanel((v) => !v);
              if (!showNotifPanel && unreadCount > 0) markRead();
            }}
          />
          {showNotifPanel && (
            <View style={styles.notifPanel}>
              {notifications.length === 0 ? (
                <Text style={styles.notifEmpty}>No recent activity</Text>
              ) : (
                notifications.slice(0, 15).map((n) => {
                  const isRead = (n as typeof n & { isRead?: boolean }).isRead;
                  return (
                    <View key={n._id} style={[styles.notifItem, !isRead && styles.notifItemUnread]}>
                      <Text style={styles.notifIcon}>
                        {n.type === 'cpf' ? '🏦' : n.type === 'investment' ? '📈' : '💳'}
                      </Text>
                      <View style={styles.notifContent}>
                        <Text style={styles.notifMessage}>{n.message}</Text>
                        <Text style={styles.notifTime}>{new Date(n.createdAt).toLocaleDateString()}</Text>
                      </View>
                      {!isRead && <View style={styles.unreadDot} />}
                    </View>
                  );
                })
              )}
            </View>
          )}
          <Divider />
          <Text style={styles.notifPrefsHeader}>Notify me when someone updates:</Text>
          <ToggleRow
            icon="🏦"
            label="CPF data"
            value={prefs.notifPrefs.cpf}
            onValueChange={(v) => handleNotifToggle('cpf', v)}
          />
          <Divider />
          <ToggleRow
            icon="📈"
            label="Investments"
            value={prefs.notifPrefs.investment}
            onValueChange={(v) => handleNotifToggle('investment', v)}
          />
          <Divider />
          <ToggleRow
            icon="💳"
            label="Expenses"
            value={prefs.notifPrefs.expense}
            onValueChange={(v) => handleNotifToggle('expense', v)}
          />
        </Section>
      )}

      {/* Family group */}
      {!isGuest && (
        <Section title="Family group">
          {family ? (
            <>
              <Row icon="👨‍👩‍👧" label={family.name} value={`${family.members.length} member${family.members.length !== 1 ? 's' : ''}`} chevron={false} />
              <Divider />
              <Row icon="🔗" label="Invite code" value={family.inviteCode} chevron={false} />

              {/* Members list with labels + admin transfer */}
              <Divider />
              <View style={styles.membersSection}>
                <Text style={styles.membersSectionTitle}>Members</Text>
                {family.members.map((member, idx) => {
                  const currentLabel = family.memberLabels?.[member.userId] ?? '';
                  const isCurrentUser = member.userId === user?._id;
                  const isEditingThis = editingLabelFor === member.userId;

                  return (
                    <View key={member.userId}>
                      {idx > 0 && <View style={styles.memberDivider} />}
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
                          {currentLabel ? (
                            <Text style={styles.memberLabel}>{currentLabel}</Text>
                          ) : null}
                          <Text style={styles.memberEmail}>{member.email}</Text>
                        </View>

                        <View style={styles.memberActions}>
                          {/* Label edit button (admin only) */}
                          {isAdmin && (
                            <Pressable
                              onPress={() => setEditingLabelFor(isEditingThis ? null : member.userId)}
                              style={styles.labelBtn}>
                              <Text style={styles.labelBtnText}>{isEditingThis ? 'Done' : (currentLabel || 'Label')}</Text>
                            </Pressable>
                          )}

                          {/* Transfer admin button (admin only, for non-admin members) */}
                          {isAdmin && !isCurrentUser && member.role !== 'admin' && (
                            <Pressable
                              onPress={() => handleTransferAdmin(member.userId, member.displayName)}
                              disabled={transferSubmitting === member.userId}
                              style={styles.transferBtn}>
                              <Text style={styles.transferBtnText}>
                                {transferSubmitting === member.userId ? '…' : 'Make admin'}
                              </Text>
                            </Pressable>
                          )}
                        </View>
                      </View>

                      {/* Label picker */}
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
              </View>

              {/* Pending requests */}
              {family.pendingRequests.length > 0 && (
                <>
                  <Divider />
                  <View style={styles.pendingSection}>
                    <Text style={styles.pendingTitle}>Pending requests ({family.pendingRequests.length})</Text>
                    {family.pendingRequests.map((req) => (
                      <View key={req.userId} style={styles.pendingRow}>
                        <View style={styles.pendingInfo}>
                          <Text style={styles.pendingName}>{req.displayName}</Text>
                          <Text style={styles.pendingEmail}>{req.email}</Text>
                        </View>
                        <View style={styles.pendingActions}>
                          <Pressable onPress={() => approveRequest(req.userId, 'approve')} style={styles.approveBtn}>
                            <Text style={styles.approveBtnText}>Approve</Text>
                          </Pressable>
                          <Pressable onPress={() => approveRequest(req.userId, 'reject')} style={styles.rejectBtn}>
                            <Text style={styles.rejectBtnText}>Reject</Text>
                          </Pressable>
                        </View>
                      </View>
                    ))}
                  </View>
                </>
              )}
            </>
          ) : (
            <>
              <Row icon="✨" label="Create a family group" onPress={() => { setShowCreateFamily((v) => !v); setShowJoinFamily(false); setFamilyError(''); }} />
              <Divider />
              <Row icon="🔗" label="Join with invite code" onPress={() => { setShowJoinFamily((v) => !v); setShowCreateFamily(false); setFamilyError(''); }} />
            </>
          )}

          {/* Create family inline */}
          {showCreateFamily && !family && (
            <View style={styles.inlineForm}>
              {familyError ? <Text style={styles.inlineError}>{familyError}</Text> : null}
              <TextInput
                value={familyNameInput}
                onChangeText={setFamilyNameInput}
                placeholder='e.g. "The Tans"'
                placeholderTextColor={colors.textMuted}
                style={styles.inlineInput}
                returnKeyType="done"
                onSubmitEditing={handleCreateFamily}
              />
              <Pressable onPress={handleCreateFamily} disabled={familySubmitting} style={styles.inlineBtn}>
                <Text style={styles.inlineBtnText}>{familySubmitting ? 'Creating…' : 'Create family'}</Text>
              </Pressable>
            </View>
          )}

          {/* Join family inline */}
          {showJoinFamily && !family && (
            <View style={styles.inlineForm}>
              {familyError ? <Text style={styles.inlineError}>{familyError}</Text> : null}
              <TextInput
                value={inviteCodeInput}
                onChangeText={(t) => setInviteCodeInput(t.toUpperCase())}
                placeholder="e.g. A3F9C201"
                placeholderTextColor={colors.textMuted}
                style={styles.inlineInput}
                autoCapitalize="characters"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleJoinFamily}
              />
              <Pressable onPress={handleJoinFamily} disabled={familySubmitting} style={styles.inlineBtn}>
                <Text style={styles.inlineBtnText}>{familySubmitting ? 'Sending…' : 'Send request'}</Text>
              </Pressable>
            </View>
          )}
        </Section>
      )}

      {/* Support */}
      <Section title="Support">
        <Row
          icon="☕"
          label="Buy me a coffee"
          value="Support Nestworth"
          onPress={() => Linking.openURL('https://buymeacoffee.com/shaoyangchin')}
        />
      </Section>

      {/* Legal */}
      <Section title="Legal">
        <Row
          icon="📄"
          label="Terms of Service"
          onPress={() => Linking.openURL('https://nestworth.app/terms')}
        />
        <Divider />
        <Row
          icon="🔒"
          label="Privacy Policy"
          onPress={() => Linking.openURL('https://nestworth.app/privacy')}
        />
      </Section>

      {/* About */}
      <Section title="About">
        <Row icon="📱" label="Version" value="1.0.0" chevron={false} />
        <Divider />
        <Row icon="🛠️" label="Built with ♥ in Singapore" chevron={false} />
      </Section>

      {/* Sign out */}
      {!isGuest && (
        <Section title="">
          <Row
            icon="🚪"
            label="Sign out"
            destructive
            onPress={async () => { await logout(); router.replace('/welcome'); }}
          />
        </Section>
      )}
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },

  // Profile hero
  profileHero: { alignItems: 'center', paddingVertical: spacing.lg, gap: spacing.sm },
  avatarWrap: {
    width: 88, height: 88, borderRadius: 44,
    alignItems: 'center', justifyContent: 'center',
    ...shadow.elevated,
  },
  avatarEmoji: { fontSize: 44 },
  avatarEditBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
    ...shadow.card,
  },
  avatarEditBadgeText: { fontSize: 13 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  profileName: { fontSize: 22, fontFamily: 'Inter_600SemiBold', fontWeight: '600', letterSpacing: -0.3 },
  nameEditHint: { fontSize: 14, opacity: 0.5 },
  nameEditRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  nameInput: {
    fontSize: 20, fontFamily: 'Inter_600SemiBold', fontWeight: '600',
    borderBottomWidth: 1.5, borderBottomColor: colors.accent,
    paddingVertical: 4, minWidth: 140, textAlign: 'center',
  },
  nameSaveBtn: {
    backgroundColor: colors.accent, borderRadius: radius.sm,
    paddingVertical: 6, paddingHorizontal: spacing.md,
  },
  nameSaveBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', fontWeight: '600', color: '#fff' },
  profileEmail: { ...typography.caption },

  // Picker cards
  pickerCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, ...shadow.card,
    borderWidth: 1, borderColor: colors.borderLight,
  },
  pickerLabel: { ...typography.label, color: colors.textMuted, marginBottom: spacing.md },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  emojiBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.background,
  },
  emojiBtnSelected: { backgroundColor: colors.accentLight, borderWidth: 2, borderColor: colors.accent },
  emojiOption: { fontSize: 24 },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.xs },
  colorSwatch: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 1.5, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  colorSwatchSelected: { borderColor: colors.accent, borderWidth: 2.5 },
  colorSwatchTick: { fontSize: 14, color: colors.accent },
  colorLabels: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  colorLabel: { fontSize: 9, color: colors.textMuted, width: 36, textAlign: 'center' },

  // Sections
  section: { gap: spacing.xs },
  sectionTitle: { ...typography.label, color: colors.textMuted, paddingHorizontal: 4, marginBottom: 2 },
  sectionCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.borderLight,
    overflow: 'hidden',
  },

  // Rows
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

  // Notification panel
  notifPrefsHeader: {
    ...typography.caption, color: colors.textMuted,
    paddingHorizontal: spacing.md, paddingTop: spacing.xs, paddingBottom: 2,
  },
  notifPanel: {
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderLight,
    paddingVertical: spacing.xs,
  },
  notifEmpty: { ...typography.caption, color: colors.textMuted, padding: spacing.md, textAlign: 'center' },
  notifItem: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: spacing.md, paddingVertical: 10, gap: spacing.sm,
  },
  notifItemUnread: { backgroundColor: colors.accentLight },
  notifIcon: { fontSize: 16, width: 24, textAlign: 'center', marginTop: 1 },
  notifContent: { flex: 1 },
  notifMessage: { ...typography.body, color: colors.text, fontSize: 13 },
  notifTime: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  unreadDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: colors.accent, marginTop: 4,
  },

  // Members section
  membersSection: { padding: spacing.md, gap: spacing.sm },
  membersSectionTitle: { ...typography.label, color: colors.textMuted, marginBottom: spacing.xs },
  memberDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.borderLight, marginVertical: spacing.xs },
  memberRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm },
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

  // Label picker
  labelPicker: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs,
    padding: spacing.sm, backgroundColor: colors.background,
    borderRadius: radius.sm, marginTop: spacing.xs,
  },
  labelOption: {
    paddingVertical: 5, paddingHorizontal: spacing.sm,
    borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  labelOptionSelected: { backgroundColor: colors.accentLight, borderColor: colors.accent },
  labelOptionText: { fontSize: 12, color: colors.text },
  labelOptionTextSelected: { color: colors.accent, fontWeight: '600' },

  // Pending requests
  pendingSection: { padding: spacing.md, gap: spacing.sm },
  pendingTitle: { ...typography.label, color: colors.textMuted, marginBottom: spacing.xs },
  pendingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  pendingInfo: { flex: 1 },
  pendingName: { ...typography.bodyMedium, color: colors.text },
  pendingEmail: { ...typography.caption, color: colors.textMuted },
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

  // Inline family form
  inlineForm: { padding: spacing.md, gap: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderLight },
  inlineInput: {
    ...typography.body, color: colors.text,
    backgroundColor: colors.background,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: 10,
  },
  inlineBtn: {
    backgroundColor: colors.accent, borderRadius: radius.sm,
    paddingVertical: 10, alignItems: 'center',
  },
  inlineBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', fontWeight: '600', color: '#fff' },
  inlineError: { ...typography.caption, color: colors.negative, backgroundColor: colors.negativeLight, borderRadius: radius.sm, padding: spacing.sm, overflow: 'hidden' },
});
